# Company Analysis — Damodaran Financial Analyst (DFA) System

End-to-end n8n production system that produces a 9-section Damodaran-style financial analyst report and Gamma-ready deck from **live SEC EDGAR data** and public market prices.

## Production endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `https://evoloai.app.n8n.cloud/webhook/dfa-production` | GET | Web portal (2-step Q1/Q2 gating) |
| `https://evoloai.app.n8n.cloud/webhook/dfa-production/start` | POST | API start run |
| `https://evoloai.app.n8n.cloud/webhook/dfa-production/status?run_id=...` | GET | Live run status + data freshness |
| `https://evoloai.app.n8n.cloud/webhook/dfa-production/result?run_id=...` | GET | Full report + Gamma deck |

## Financial data freshness (critical)

Financials are **never cached across runs**. On every execution:

1. **SEC EDGAR** — company facts, filings, and XBRL metrics fetched at runtime
2. **Yahoo Finance** — live share price for market cap (price × SEC diluted shares)
3. **`data_freshness` stamp** — `fetched_at`, latest filing form/date, market price as-of
4. **Peer benchmarks** — up to 3 peers resolved via SEC directory + company facts API

All figures are USD. Missing data is explicitly marked `N/A`.

## Pipeline

```
Portal/API → WF_MAIN_PROD
  → Entity → Research (Public/Private) → Normalize
  → Financial Snapshot → Peer Benchmarks → Ratio Dashboard
  → Event Research → Analyze → Proposal → Value Realization
  → Approval → Assemble QA → Gamma Deck → Deliver
```

## Repository layout

- `dfa-code/` — JavaScript modules bundled into n8n Code nodes
- `dfa-workflows/` — Workflow JSON snapshots (IDs in `ids.json`)
- `scripts/deploy_dfa.py` — Deploy patches to n8n cloud
- `scripts/e2e_test_dfa.py` — End-to-end smoke test (Microsoft)

## Deploy

```bash
export N8N_API_KEY=your-public-api-key
python3 scripts/deploy_dfa.py
```

## Test

```bash
python3 scripts/e2e_test_dfa.py
```

## Cursor MCP (optional)

Copy `.cursor/mcp.json.example` to `.cursor/mcp.json` and set `N8N_MCP_TOKEN` (audience: `mcp-server-api`).
