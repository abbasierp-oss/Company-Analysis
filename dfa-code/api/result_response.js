const row = items[0]?.json || null;
let state = null;
try { state = row?.state_json ? JSON.parse(row.state_json) : null; } catch (e) {}
const freshness = state?.data_freshness || {};
const market = state?.research?.market_data || {};
return [{ json: {
  success: Boolean(row?.run_id),
  run_id: row?.run_id || null,
  status: row?.status || 'not_found',
  company: state?.entity || null,
  final_report_markdown: state?.final_report_markdown || row?.final_report_markdown || '',
  presentation_prompt: state?.presentation_prompt?.prompt_text || '',
  presentation_prompt_status: state?.presentation_prompt?.status || 'missing',
  data_freshness: freshness,
  market_data: market,
  source_coverage: state?.normalized?.source_coverage || {},
  qa: state?.qa || {},
  delivery: state?.delivery || {},
  approval: state?.approval || {},
  audit_log: (state?.audit_log || []).slice(-12),
  dashboard: (() => { try { return buildPortalDashboard(state || {}); } catch (e) { return { error: String(e.message || e) }; } })(),
  it_initiatives: state?.it_initiatives || [],
  recommendations: state?.executive_proposal?.priorities || [],
  message: row?.run_id ? 'Result found.' : 'No result found for the supplied run_id.',
} }];
