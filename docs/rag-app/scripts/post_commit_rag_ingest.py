#!/usr/bin/env python3
"""Template post-commit hook: keep a RAG corpus fresh after every commit.

Reindexes a project's docs/ (and any other configured paths) against a
running rag-bootstrap instance whenever a commit touches files under
those paths. This is a LOCAL git hook template — nothing installs it
automatically.

Usage (copy into the CONSUMING repo, not rag-bootstrap itself):

    cp /path/to/rag-bootstrap/scripts/post_commit_rag_ingest.py \
       /path/to/your/repo/.git/hooks/post-commit
    chmod +x /path/to/your/repo/.git/hooks/post-commit

Configuration (environment variables, all optional):

    RAG_ENDPOINT_URL    Full base URL of the RAG API.
                        Default: http://localhost:${RAG_PORT:-10000}
                        (RAG_PORT is web/API, base + 0 in the
                        RAG_PORT_BASE=10000 port scheme).
    RAG_PORT            Port used to build the default endpoint URL
                        when RAG_ENDPOINT_URL is unset. Default: 10000.
    RAG_INGEST_PATHS    Colon-separated repo-relative directories to
                        (re)index. Default: "docs".
                        Example: RAG_INGEST_PATHS="docs:src:app"
    RAG_INGEST_TIMEOUT  Per-request timeout in seconds. Default: 300.
    RAG_HOOK_QUIET      Set to 1 to suppress non-error output.

Behavior:
    - Only fires when the commit actually changed files under one of
      the configured paths (checked via `git diff-tree` on HEAD).
    - Sends the HOST-absolute path of each changed directory to
      POST /api/ingest/directory. The API container must be able to see
      that path — with the default DOCS_PATH same-path read-only mount
      this Just Works; otherwise mount your repo into the container at
      the same absolute path.
    - Never fails the commit: post-commit hooks cannot abort a commit,
      and this script always exits 0 so a down RAG stack costs you one
      warning line, not a broken workflow.
    - Tolerates both the current synchronous response (a list of
      ingested documents) and a future async response ({"job_id": ...}).

Dependencies: Python 3.8+ standard library only.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

DEFAULT_RAG_PORT = "10000"  # RAG_PORT_BASE + 0 (web/API)
DEFAULT_INGEST_PATHS = "docs"
DEFAULT_TIMEOUT_SECONDS = 300

QUIET = os.environ.get("RAG_HOOK_QUIET", "") == "1"


def log(msg: str) -> None:
    if not QUIET:
        print(f"[rag-ingest-hook] {msg}")


def warn(msg: str) -> None:
    print(f"[rag-ingest-hook] WARNING: {msg}", file=sys.stderr)


def endpoint_url() -> str:
    url = os.environ.get("RAG_ENDPOINT_URL")
    if url:
        return url.rstrip("/")
    port = os.environ.get("RAG_PORT", DEFAULT_RAG_PORT)
    return f"http://localhost:{port}"


def git(*args: str) -> str:
    return subprocess.check_output(
        ["git", *args], text=True, stderr=subprocess.DEVNULL
    ).strip()


def changed_files() -> list[str]:
    """Repo-relative paths touched by the commit that just landed."""
    out = git("diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD")
    return [line for line in out.splitlines() if line]


def watched_dirs(repo_root: str, changed: list[str]) -> list[str]:
    """Configured ingest dirs (absolute) that both exist and were touched."""
    raw = os.environ.get("RAG_INGEST_PATHS", DEFAULT_INGEST_PATHS)
    dirs: list[str] = []
    for rel in (p.strip().strip("/") for p in raw.split(":")):
        if not rel:
            continue
        prefix = rel + "/"
        if not any(f == rel or f.startswith(prefix) for f in changed):
            continue
        abs_dir = os.path.join(repo_root, rel)
        if not os.path.isdir(abs_dir):
            warn(f"configured ingest path is not a directory, skipping: {abs_dir}")
            continue
        dirs.append(abs_dir)
    return dirs


def ingest_directory(base_url: str, abs_dir: str, timeout: int) -> None:
    req = urllib.request.Request(
        f"{base_url}/api/ingest/directory",
        data=json.dumps({"path": abs_dir}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    if isinstance(body, list):
        log(f"reindexed {abs_dir}: {len(body)} document(s)")
    elif isinstance(body, dict) and "job_id" in body:
        log(f"reindex of {abs_dir} queued: job_id={body['job_id']}")
    else:
        log(f"reindexed {abs_dir}")


def main() -> int:
    try:
        repo_root = git("rev-parse", "--show-toplevel")
        changed = changed_files()
    except (subprocess.CalledProcessError, FileNotFoundError) as exc:
        warn(f"not a usable git checkout, skipping reindex ({exc})")
        return 0

    dirs = watched_dirs(repo_root, changed)
    if not dirs:
        log("no watched paths changed in this commit; nothing to reindex")
        return 0

    base_url = endpoint_url()
    try:
        timeout = int(os.environ.get("RAG_INGEST_TIMEOUT", DEFAULT_TIMEOUT_SECONDS))
    except ValueError:
        timeout = DEFAULT_TIMEOUT_SECONDS

    for abs_dir in dirs:
        try:
            ingest_directory(base_url, abs_dir, timeout)
        except urllib.error.HTTPError as exc:
            warn(f"RAG API rejected {abs_dir}: HTTP {exc.code} {exc.reason}")
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            warn(
                f"RAG API unreachable at {base_url} ({exc}); "
                "corpus may be stale until the next successful reindex"
            )
        except (json.JSONDecodeError, ValueError) as exc:
            warn(f"unexpected response while reindexing {abs_dir}: {exc}")

    return 0  # post-commit must never break the commit workflow


if __name__ == "__main__":
    sys.exit(main())
