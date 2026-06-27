const row = items[0]?.json || null;
let state = null;
try { state = row?.state_json ? JSON.parse(row.state_json) : null; } catch (e) {}
const freshness = state?.data_freshness || {};
const progress = state?.progress || {};
return [{ json: {
  success: Boolean(row?.run_id),
  run_id: row?.run_id || null,
  status: row?.status || 'not_found',
  company_name: row?.company_name || state?.inputs?.company_name || null,
  current_stage: state?.current_stage || (row?.status === 'completed' ? 'ready' : 'unknown'),
  progress_pct: progress.pct || (row?.status === 'completed' ? 100 : (row?.status === 'running' ? 15 : 0)),
  progress_label: progress.label || state?.current_stage || null,
  data_freshness: freshness,
  market_data: state?.research?.market_data || null,
  presentation_prompt_status: state?.presentation_prompt?.status || null,
  qa_status: state?.qa?.validation_status || null,
  updated_at: row?.updated_at || state?.updated_at || null,
  audit_log: (state?.audit_log || []).slice(-8),
  message: row?.run_id
    ? (row.status === 'completed' || row.status === 'completed_with_warnings'
      ? 'Run completed. Fetch result endpoint for full report.'
      : `Run is ${row.status || 'running'} at stage ${state?.current_stage || 'unknown'}.`)
    : 'No run found for the supplied run_id.',
} }];
