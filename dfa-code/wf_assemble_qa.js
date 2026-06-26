const state = items[0]?.json?.state || items[0]?.json || {};
const now = new Date().toISOString();
state.sections = state.sections || {};
const sectionOrder = ['s1_source_pack','s2_snapshot','s3_benchmarks','s4_insights','s5_ratios','s6_proposal','s7_rtbl','s8_assumptions','s9_sales'];
const freshness = state.data_freshness || {};
const market = state.research?.market_data || {};
state.sections.s1_source_pack = state.sections.s1_source_pack || [
  '## Section 1: Company & Source Pack',
  '',
  `Legal name: ${state.entity?.legal_name || 'N/A'}`,
  `Ticker/CIK: ${state.entity?.ticker || 'N/A'} / ${state.entity?.cik || 'N/A'}`,
  `Exchange: ${state.entity?.exchange || 'N/A'}`,
  `Issuer profile: ${state.entity?.issuer_profile?.description || 'N/A'}`,
  `Fiscal year-end: ${state.entity?.fiscal_year_end || 'N/A'}`,
  `Native reporting currency: ${state.entity?.native_reporting_currency || state.research?.financials?.native_currency || 'N/A'}`,
  `USD comparability: ${freshness.fx_to_usd ? `FX ${freshness.fx_to_usd} (${freshness.fx_source || 'ECB'}) as of ${freshness.fx_as_of || 'N/A'}` : 'Native USD reporter'}`,
  `Market cap: ${market.market_cap_usd ? fmtMetric(market.market_cap_usd) : 'N/A'} (${market.source_date || 'N/A'})`,
  `Market cap source: ${market.source_name || 'N/A'}`,
  `Reliability: ${entityConfidence(state.entity, state.normalized)}`,
  `Latest filing: ${freshness.latest_filing_form || 'N/A'} filed ${freshness.latest_filing_date || 'N/A'}`,
  `Data fetched at: ${freshness.fetched_at || now}`,
  '',
  `Sources: ${(state.entity?.sources || []).map((s) => `${s.source_name} (${s.source_date})`).join(', ') || 'N/A'}`,
].join('\n');
function latestMetric(name) {
  const series = state.normalized?.metrics?.[name] || [];
  const item = Array.isArray(series) ? series[series.length - 1] : null;
  if (!item) return 'N/A';
  const cite = item.source_name ? ` — ${item.source_name}` : '';
  return `${item.value} ${item.unit || ''} (${item.period || 'latest'})${cite}`;
}
if (!state.sections.s2_snapshot && state.financial_snapshot?.markdown) {
  state.sections.s2_snapshot = state.financial_snapshot.markdown;
}
state.sections.s2_snapshot = state.sections.s2_snapshot || `## Section 2: Financial Snapshot\n\nSee financial_snapshot table in state. Revenue: ${latestMetric('revenue')}`;
state.sections.s8_assumptions = state.sections.s8_assumptions || [
  '## Section 8: Assumptions, Data Gaps & Reliability Notes',
  '',
  `Data freshness: ${freshness.rule || 'Live SEC fetch at execution time.'}`,
  `Fetched at: ${freshness.fetched_at || now}`,
  `Latest SEC filing used: ${freshness.latest_filing_form || 'N/A'} (${freshness.latest_filing_date || 'N/A'})`,
  '',
  `Reliability map: ${JSON.stringify(state.normalized?.reliability_map || {})}`,
  '',
  'Gaps:',
  (state.normalized?.gaps || []).map((g) => `- ${g.metric}: ${g.reason}`).join('\n') || '- None logged.',
  '',
  `Formulas: ${JSON.stringify(state.normalized?.formulas || {})}`,
].join('\n');
const missing = sectionOrder.filter((id) => !state.sections[id]);
const finalMarkdown = [
  '# Damodaran-Style Analyst Report',
  `Run ID: ${state.run_id || 'N/A'}`,
  `Generated at: ${now}`,
  `Financial data as-of: ${freshness.fetched_at || now}`,
  '',
].concat(sectionOrder.map((id) => state.sections[id] || `## ${id}\n\nN/A - section not generated.`)).join('\n\n---\n\n');
state.final_report_markdown = finalMarkdown;
state.report_outputs = {
  full_report_markdown: finalMarkdown,
  gamma_deck_markdown: state.gamma_deck?.gamma_markdown || '',
  dual_output: true,
};
const citationQa = {
  figure_source_policy: 'Every figure must cite SEC EDGAR, market data source, or explicit N/A gap.',
  financial_snapshot_ready: Boolean(state.financial_snapshot?.rows?.length || state.sections.s2_snapshot),
  ratio_dashboard_ready: Boolean(state.ratio_dashboard?.annual?.length || state.sections.s5_ratios),
  peer_benchmark_ready: Boolean(state.peer_benchmarks?.peers?.some((p) => p.source_status === 'SEC_PEER_FACTS_OK')),
  value_realization_ready: Boolean(state.sections.s9_sales),
  proposal_ready: Boolean(state.sections.s6_proposal),
  data_freshness_recorded: Boolean(freshness.fetched_at),
  gap_count: state.normalized?.source_coverage?.gap_count || (state.normalized?.gaps || []).length,
  warning_notes: [],
};
if (!citationQa.peer_benchmark_ready) citationQa.warning_notes.push('No SEC-backed peer metrics in this run.');
if (!citationQa.data_freshness_recorded) citationQa.warning_notes.push('Data freshness stamp missing.');
if ((state.normalized?.gaps || []).length > 8) citationQa.warning_notes.push('High gap count — verify issuer profile and SEC form coverage.');
if (state.entity?.is_foreign_issuer && !(state.normalized?.metrics?.revenue || []).length) citationQa.warning_notes.push('Foreign issuer with no normalized revenue — check 20-F/IFRS extraction.');
const qaWarnings = [...missing.map((id) => `Missing section: ${id}`), ...citationQa.warning_notes];
state.qa = {
  missing_sections: missing,
  validation_status: qaWarnings.length ? 'WARN' : 'PASS',
  checks: ['all_sections_present','data_freshness','citation_policy','dual_output_ready'],
  citation_qa: citationQa,
  warning: qaWarnings.join(' | '),
};
state.audit_log = state.audit_log || [];
state.audit_log.push({ timestamp: now, workflow_name: 'WF_ASSEMBLE_QA', status: state.qa.validation_status, message: state.qa.warning || 'Full report and dual outputs assembled.' });
return [{ json: state }];
