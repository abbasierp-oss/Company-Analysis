const state = items[0]?.json?.state || items[0]?.json || {};
const now = new Date().toISOString();
const stage = '__STAGE__';
const label = '__LABEL__';
state.updated_at = now;
if (!['completed', 'completed_with_warnings', 'failed'].includes(state.status)) {
  state.status = 'running';
}
state.current_stage = stage;
state.progress = state.progress || { stages: [], pct: 0 };
const stages = [
  'initialized', 'entity_resolved', 'research_complete', 'financials_ready',
  'peers_ready', 'ratios_ready', 'analysis_complete', 'proposal_ready',
  'approval_complete', 'report_assembled', 'ready',
];
const idx = stages.indexOf(stage);
state.progress.pct = idx >= 0 ? Math.round((idx / (stages.length - 1)) * 100) : state.progress.pct;
state.progress.current = stage;
state.progress.label = label;
state.progress.stages = state.progress.stages || [];
if (!state.progress.stages.includes(stage)) {
  state.progress.stages.push(stage);
}
state.audit_log = state.audit_log || [];
state.audit_log.push({
  timestamp: now,
  workflow_name: 'WF_MAIN_PROD',
  status: 'OK',
  message: `Checkpoint: ${label}`,
});
return [{ json: state }];
