<!-- RAG_HINT: single-include hint header. Orchestrators `cat` this file into
     subagent prompts instead of pasting a per-script RAG_NOTE. Canonical path:
     rag-bootstrap/agent_hints/HOW_TO_QUERY.md — edit here, lands everywhere. -->
RAG retrieval (saves tokens vs full-file Read):
- Endpoint: `$RAG_ENDPOINT_URL` if set, else `http://127.0.0.1:10000`.
- Query: `curl -sf -X POST "$RAG/api/v1/search" -H 'Content-Type: application/json' -d '{"query":"...","limit":5}'` (older servers: same body to `/api/search`; optional `"corpus":"<filepath prefix>"` scopes hits).
- Or CLI: `python3 <rag-bootstrap>/client/ragq.py "your question"` (`--corpus PREFIX` to scope; exit 3 = RAG down, fall back).
- Response: JSON list of `{document_filepath, chunk_index, content, score, ...}`.
- Cite hits as `[[RAG:<document_filepath>#<chunk_index>@<score>]]`.
- On 5xx/429/timeout: retry ONCE after 2s, then fall back to grep + Read for the rest of this turn. Never block the workflow on RAG.
- Retrieval-only: DO NOT integrate RAG into the consuming project's own runtime.
Full contract: `rag-bootstrap/docs/integration/CONSUMING_AGENTS_CONTRACT.md`.
