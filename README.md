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

1. **SEC EDGAR** — US-GAAP **and IFRS** taxonomies from company facts API
2. **Filing coverage** — domestic (`10-K`/`10-Q`) and foreign issuers (`20-F`/`6-K`)
3. **FX conversion** — non-USD reporters converted to USD via ECB reference rates (Frankfurter API)
4. **Yahoo Finance** — live share price; Yahoo shares fallback when SEC share count is stale
5. **`data_freshness` stamp** — filings, FX rate, native currency, issuer profile

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
