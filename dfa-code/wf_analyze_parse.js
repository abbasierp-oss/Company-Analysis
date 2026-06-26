const prep = $('Prepare Claude Analysis Payloads').first().json;
const state = prep.state;
state.sections = state.sections || {};
const now = new Date().toISOString();
function textFrom(nodeName) {
  const json = $(nodeName).first().json || {};
  const content = json.content || [];
  return content.map((p) => p.text || '').join('\n').trim() || JSON.stringify(json);
}
const s4 = parseClaudeJson(textFrom('Claude Section 4 Insights'));
const s7 = parseClaudeJson(textFrom('Claude Section 7 RTBL'));
if (state.peer_benchmarks?.markdown) state.sections.s3_benchmarks = state.peer_benchmarks.markdown;
if (state.ratio_dashboard?.markdown) state.sections.s5_ratios = state.ratio_dashboard.markdown;
state.sections.s4_insights = buildDeterministicInsights(state);
if (s4.section_4_insights_markdown && !state.financial_snapshot?.quarterly?.rows?.length) {
  state.sections.s4_insights = s4.section_4_insights_markdown;
}
state.sections.s7_rtbl = s7.section_7_rtbl_markdown || state.event_research?.markdown || state.sections.s7_rtbl || '## Section 7: Read Between The Lines\n\nN/A - insufficient filing/event signals.';
state.audit_log = state.audit_log || [];
state.audit_log.push({ timestamp: now, workflow_name: 'WF_ANALYZE', status: 'OK', message: 'Analysis sections 4 and 7 generated; sections 3 and 5 sourced from deterministic agents.' });
return [{ json: state }];
