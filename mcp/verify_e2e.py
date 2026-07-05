"""End-to-end proof for the Basset Hound MCP server.

Drives the MCP tools through the REAL FastMCP dispatch path
(mcp.call_tool -> pydantic arg validation -> tool -> WS bridge -> browser)
against a LIVE browser, and asserts navigate + get_content + get_url +
extract_links + set_cookie/get_cookies (URL-filtered) + forensic_capture
actually round-trip.

The forensic_capture check writes a sealed evidence bundle to a throwaway temp
dir (under the OS temp dir — an allowed PathValidator write location) and
asserts the returned bundle_dir exists on disk with a valid manifest.json. The
temp dir is removed after the run (override with BASSET_FC_OUTPUT_DIR to keep
the bundle for inspection). NOTE: the verifier and the browser share this host,
so it can stat the on-disk bundle the browser wrote.

Prerequisite: a browser is running with its WS API up. Point at it via
BASSET_WS_PORT / BASSET_WS_HOST (defaults 127.0.0.1:8765).

    BASSET_WS_PORT=8765 python3 mcp/verify_e2e.py

Exits 0 on success, 2 on failure.
"""
import os
import sys
import json
import shutil
import asyncio
import tempfile
import importlib.util

os.environ.setdefault("BASSET_WS_HOST", "127.0.0.1")
os.environ.setdefault("BASSET_WS_PORT", "8765")
# forensic_capture is the heaviest tool (navigate + settle + ~15 sub-commands),
# so give the bridge a comfortable read timeout. Set BEFORE importing server.py,
# which reads BASSET_MCP_TIMEOUT into its module-level _READ_TIMEOUT at import.
os.environ.setdefault("BASSET_MCP_TIMEOUT", "120")

_SERVER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "server.py")
_spec = importlib.util.spec_from_file_location("bhb_mcp_server", _SERVER)
mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mod)
mcp = mod.mcp


async def call(name, args):
    res = await mcp.call_tool(name, args)
    texts = [getattr(c, "text", None) for c in res]
    texts = [t for t in texts if t is not None]
    raw = texts[0] if texts else "{}"
    try:
        return json.loads(raw)
    except Exception:
        return {"_raw": raw[:200]}


async def main():
    out = {}

    # Settle past the startup-homepage load (browser-side timing quirk).
    await call("navigate", {"url": "https://example.com/", "timeout": 30000})
    await asyncio.sleep(1.5)

    # Round-trip 1: example.com
    out["navigate_1"] = await call("navigate", {"url": "https://example.com/", "timeout": 30000})
    url1 = await call("get_url", {})
    out["get_url_1"] = url1
    gc = await call("get_content", {})
    content = gc.get("content", "") if isinstance(gc, dict) else ""
    content = content if isinstance(content, str) else ""
    out["get_content_1"] = {
        "success": gc.get("success"),
        "content_len": len(content),
        "has_example_marker": "Example Domain" in content,
        "content_head": content[:100],
    }

    # Round-trip 2: iana.org (proves get_url tracks a second navigation)
    out["navigate_2"] = await call("navigate", {"url": "https://www.iana.org/", "timeout": 30000})
    await asyncio.sleep(0.5)
    url2 = await call("get_url", {})
    out["get_url_2"] = url2

    cookies = await call("get_all_cookies", {})
    out["get_all_cookies"] = {"success": cookies.get("success"), "count": cookies.get("count")}

    # Round-trip 3: extract_links against a real content page (Wikipedia). Proves
    # the extract_* family reads the live <webview> DOM (not the empty shell).
    wiki_url = "https://en.wikipedia.org/wiki/Web_scraping"
    out["navigate_3"] = await call("navigate", {"url": wiki_url, "timeout": 30000})
    await asyncio.sleep(1.0)
    # Cross-check against the live DOM's own anchor count. Wikipedia lazy-loads a
    # variable number of anchors, so asserting extract_links.count == document.links.length
    # across two separate calls flakes by +/-1. Instead read document.links.length BEFORE
    # and AFTER the extraction and require the returned count to fall within that window
    # (exact when the DOM is quiescent). Mirrors the pattern in scripts/smoke-mvp.js.
    dom_before = await call("execute_script", {"script": "document.links.length"})
    links = await call("extract_links", {})
    dom_after = await call("execute_script", {"script": "document.links.length"})
    before = dom_before.get("result")
    after = dom_after.get("result")
    all_links = links.get("all") if isinstance(links, dict) else None
    link_count = links.get("count")
    all_len = len(all_links) if isinstance(all_links, list) else None
    out["extract_links"] = {
        "success": links.get("success"),
        "count": link_count,
        "all_len": all_len,
        "dom_before": before,
        "dom_after": after,
        "first_href": (all_links[0].get("href") if isinstance(all_links, list) and all_links else None),
    }

    # Round-trip 4: set_cookie -> get_cookies (URL-filtered) round-trip.
    cookie_name = "bhb_mcp_verify"
    out["set_cookie"] = await call(
        "set_cookie",
        {"name": cookie_name, "value": "1", "url": wiki_url},
    )
    got = await call("get_cookies", {"url": wiki_url})
    got_cookies = got.get("cookies") if isinstance(got, dict) else None
    got_names = [c.get("name") for c in got_cookies] if isinstance(got_cookies, list) else []
    out["get_cookies"] = {
        "success": got.get("success"),
        "count": len(got_cookies) if isinstance(got_cookies, list) else None,
        "found_test_cookie": cookie_name in got_names,
    }

    # Round-trip 5: forensic_capture -> sealed evidence bundle on disk. Proves the
    # one-call macro tool round-trips through MCP and actually seals a manifest.
    # Write to a throwaway temp dir under the OS temp dir (an allowed PathValidator
    # write location); the verifier shares the host with the browser, so it can
    # stat the on-disk bundle the browser wrote. Cleaned up in `finally`.
    fc_keep = bool(os.environ.get("BASSET_FC_OUTPUT_DIR"))
    fc_out = os.environ.get("BASSET_FC_OUTPUT_DIR") or tempfile.mkdtemp(prefix="bhb_fc_verify_")
    fc_bundle_ok = False
    try:
        fc = await call(
            "forensic_capture",
            {"url": "https://example.com/", "output_dir": fc_out, "settle_ms": 800},
        )
        bundle_dir = fc.get("bundle_dir") if isinstance(fc, dict) else None
        manifest_field = fc.get("manifest") if isinstance(fc, dict) else None
        manifest_files = (
            manifest_field.get("files") if isinstance(manifest_field, dict) else None
        )
        bundle_sha = (
            manifest_field.get("bundle_sha256") if isinstance(manifest_field, dict) else None
        )
        manifest_path = (
            os.path.join(bundle_dir, "manifest.json") if isinstance(bundle_dir, str) else None
        )
        manifest_on_disk = bool(manifest_path and os.path.isfile(manifest_path))
        # Parse the on-disk manifest.json to confirm it is real, sealed JSON.
        disk_manifest = {}
        if manifest_on_disk:
            try:
                with open(manifest_path, "r", encoding="utf-8") as fh:
                    disk_manifest = json.load(fh)
            except Exception:
                disk_manifest = {}
        fc_bundle_ok = (
            isinstance(fc, dict)
            and fc.get("success") is True
            and isinstance(bundle_dir, str)
            and os.path.isdir(bundle_dir)
            and manifest_on_disk
            and isinstance(manifest_files, list) and len(manifest_files) > 0
            and isinstance(bundle_sha, str) and len(bundle_sha) == 64
            and disk_manifest.get("bundle_sha256") == bundle_sha
            and disk_manifest.get("tool") == "forensic_capture"
        )
        out["forensic_capture"] = {
            "success": fc.get("success") if isinstance(fc, dict) else None,
            "bundle_dir": bundle_dir,
            "bundle_dir_exists": bool(isinstance(bundle_dir, str) and os.path.isdir(bundle_dir)),
            "manifest_on_disk": manifest_on_disk,
            "manifest_file_count": len(manifest_files) if isinstance(manifest_files, list) else None,
            "bundle_sha256": bundle_sha,
            "disk_seal_matches": disk_manifest.get("bundle_sha256") == bundle_sha,
            "final_url": fc.get("final_url") if isinstance(fc, dict) else None,
            "status_code": fc.get("status_code") if isinstance(fc, dict) else None,
            "challenge_suspected": fc.get("challenge_suspected") if isinstance(fc, dict) else None,
            "warnings": fc.get("warnings") if isinstance(fc, dict) else None,
        }
    finally:
        if not fc_keep:
            shutil.rmtree(fc_out, ignore_errors=True)

    print(json.dumps(out, indent=2)[:5000])

    gc_ok = gc.get("success") is True and "Example Domain" in content
    url1_ok = url1.get("success") is True and "example.com" in str(url1.get("url", ""))
    url2_ok = url2.get("success") is True and "iana.org" in str(url2.get("url", ""))
    cookies_ok = cookies.get("success") is True
    # extract_links: succeeded, count === all.length (internal consistency), and the
    # returned count falls within the live document.links window measured before/after
    # extraction. Fall back to a floor if the DOM probe was unavailable or the page
    # looked like a shell (bounded-window check — tolerant of +/-1 lazy-load drift).
    if isinstance(before, int) and isinstance(after, int) and min(before, after) >= 50:
        lo, hi = min(before, after), max(before, after)
        window_ok = isinstance(link_count, int) and lo <= link_count <= hi
    else:
        window_ok = isinstance(link_count, int) and link_count > 100
    links_ok = (
        links.get("success") is True
        and isinstance(link_count, int)
        and (all_len is None or link_count == all_len)
        and window_ok
    )
    get_cookies_ok = got.get("success") is True and cookie_name in got_names
    print(f"\nGET_CONTENT_OK={gc_ok} GET_URL(example)_OK={url1_ok} "
          f"GET_URL(iana)_OK={url2_ok} COOKIES_OK={cookies_ok} "
          f"EXTRACT_LINKS_OK={links_ok} GET_COOKIES_OK={get_cookies_ok} "
          f"FORENSIC_CAPTURE_OK={fc_bundle_ok}")

    await mod._bridge.aclose()
    all_ok = (
        gc_ok and url1_ok and url2_ok and cookies_ok and links_ok
        and get_cookies_ok and fc_bundle_ok
    )
    sys.exit(0 if all_ok else 2)


if __name__ == "__main__":
    asyncio.run(main())
