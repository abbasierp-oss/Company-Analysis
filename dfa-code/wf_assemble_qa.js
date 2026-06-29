const state = items[0]?.json?.state || items[0]?.json || {};
const now = new Date().toISOString();
state.sections = state.sections || {};
const freshness = state.data_freshness || {};
const anchors = state.research?.filing_anchors || {};

function fieldOrReason(value, reason) {
  return value || naReason(reason);
}

state.sections.s1_source_pack = state.sections.s1_source_pack || [
  '## Section 1: Company & Source Pack',
  '',
  `Legal name: ${fieldOrReason(state.entity?.legal_name, 'legal name not resolved from SEC directory')}`,
  `Ticker/CIK: ${fieldOrReason(state.entity?.ticker, 'ticker not provided')} / ${fieldOrReason(state.entity?.cik, 'CIK not resolved')}`,
  `Exchange: ${fieldOrReason(state.entity?.exchange, 'exchange not listed in SEC directory')}`,
  `Issuer profile: ${fieldOrReason(state.entity?.issuer_profile?.description, 'issuer profile not classified')}`,
  `Fiscal year-end: ${fieldOrReason(state.entity?.fiscal_year_end, 'fiscal year-end not found in filings')}`,
  'Reporting currency: USD (all figures converted to USD where applicable)',
  `Reliability: ${entityConfidence(state.entity, state.normalized)}`,
  `Quarterly financial anchor: ${fieldOrReason(freshness.quarterly_anchor_form, 'no quarterly anchor')} filed ${fieldOrReason(freshness.quarterly_anchor_filing_date, 'filing date not recorded')} (report period ${fieldOrReason(freshness.quarterly_anchor_report_date, 'report period not recorded')})`,
  `Annual financial anchor: ${fieldOrReason(freshness.annual_anchor_form, 'no annual anchor')} filed ${fieldOrReason(freshness.annual_anchor_filing_date, 'filing date not recorded')} (report period ${fieldOrReason(freshness.annual_anchor_report_date, 'report period not recorded')})`,
  freshness.recent_8k_form
    ? `Recent 8-K reference: ${freshness.recent_8k_form} filed ${freshness.recent_8k_filing_date || naReason('8-K filing date not recorded')}`
    : 'Recent 8-K reference: none on file for this run',
  `Data fetched at: ${freshness.fetched_at || now}`,
  '',
  (state.entity?.sources || []).length
    ? `Sources: ${state.entity.sources.map((s) => `${s.source_name} (${s.source_date})`).join(', ')}`
    : naReason('source list not populated'),
].join('\n');

function latestMetric(name) {
  const series = state.normalized?.metrics?.[name] || [];
  const item = Array.isArray(series) ? series[series.length - 1] : null;
  if (!item) return naReason(`${name} not found in normalized metrics`);
  const cite = item.source_name ? ` — ${item.source_name}` : '';
  const val = item.unit === 'ratio' ? fmtPct(item.value) : fmtUsdValue(item.value);
  return `${val} (${item.period || 'latest'})${cite}`;
}

if (!state.sections.s2_quarterly && state.financial_snapshot?.quarterly?.markdown) {
  state.sections.s2_quarterly = state.financial_snapshot.quarterly.markdown;
}
if (!state.sections.s2_annual && state.financial_snapshot?.annual?.markdown) {
  state.sections.s2_annual = state.financial_snapshot.annual.markdown;
}
if (!state.sections.s2_three_year_revenue && state.financial_snapshot?.three_year_revenue?.markdown) {
  state.sections.s2_three_year_revenue = state.financial_snapshot.three_year_revenue.markdown;
}
if (!state.sections.s2_market_data && state.financial_snapshot?.market_data?.markdown) {
  state.sections.s2_market_data = state.financial_snapshot.market_data.markdown;
}
if (!state.sections.s2_quarterly) {
  state.sections.s2_quarterly = state.sections.s2_snapshot || `## Section 2a: Quarterly Financials\n\nRevenue: ${latestMetric('revenue')}`;
}
if (!state.sections.s2_annual) {
  state.sections.s2_annual = `## Section 2b: Annual Financials\n\nSee normalized metrics. Revenue: ${latestMetric('revenue')}`;
}
if (!state.sections.s2_market_data) {
  const market = state.research?.market_data || {};
  state.sections.s2_market_data = [
    '## Section 2c: Market Data',
    '',
    `Market cap: ${market.market_cap_usd ? fmtUsdValue(market.market_cap_usd) : naReason('requires Yahoo share price and SEC DEI shares outstanding')}`,
    `Share price: ${market.share_price_usd ? fmtUsdValue(market.share_price_usd) : naReason('live quote not returned from Yahoo Finance')}`,
    `As of: ${fieldOrReason(market.source_date, 'quote timestamp not returned')}`,
    `Source: ${fieldOrReason(market.source_name, 'market data source not recorded')}`,
  ].join('\n');
}

if (!state.peer_benchmarks?.markdown) {
  delete state.sections.s3_benchmarks;
}

const allGaps = aggregateReportGaps(state);
state.sections.s8_assumptions = state.sections.s8_assumptions || [
  '## Section 8: Assumptions, Data Gaps & Reliability Notes',
  '',
  `Data freshness: ${freshness.rule || 'Live SEC fetch at execution time; all output in USD.'}`,
  `Fetched at: ${freshness.fetched_at || now}`,
  `Quarterly anchor: ${fieldOrReason(freshness.quarterly_anchor_form, 'no quarterly anchor')} (${fieldOrReason(freshness.quarterly_anchor_report_date, 'report period not recorded')})`,
  `Annual anchor: ${fieldOrReason(freshness.annual_anchor_form, 'no annual anchor')} (${fieldOrReason(freshness.annual_anchor_report_date, 'report period not recorded')})`,
  freshness.recent_8k_form
    ? `Recent 8-K (reference only): ${freshness.recent_8k_form} (${freshness.recent_8k_filing_date || naReason('8-K date not recorded')})`
    : 'Recent 8-K (reference only): none on file',
  `Market data: ${freshness.market_data_source || 'Yahoo Finance'} @ ${fieldOrReason(freshness.market_price_as_of, 'quote date not recorded')}`,
  '',
  `Reliability map: ${JSON.stringify(state.normalized?.reliability_map || {})}`,
  '',
  `Gaps and limitations (${allGaps.length}):`,
  allGaps.map((g) => `- ${g.metric}: ${g.reason}`).join('\n') || '- None logged.',
  '',
  `Formulas: ${JSON.stringify(state.normalized?.formulas || {})}`,
].join('\n');

const baseSectionOrder = [
  's1_source_pack', 's2_quarterly', 's2_annual', 's2_three_year_revenue', 's2_market_data',
  's3_benchmarks', 's4_insights', 's5_ratios', 's6_proposal',
  's7_rtbl', 's8_assumptions', 's9_sales',
];
const sectionOrder = baseSectionOrder.filter((id) => {
  if (id === 's3_benchmarks') {
    return Boolean(state.peer_benchmarks?.markdown);
  }
  return Boolean(state.sections[id]);
});

const includedSections = sectionOrder.map((id) => state.sections[id]);
const missing = baseSectionOrder.filter((id) => !sectionOrder.includes(id) && id !== 's3_benchmarks');

const finalMarkdown = [
  '# Executive Financial Analysis Report',
  `Run ID: ${state.run_id || naReason('run ID not assigned')}`,
  `Generated at: ${now}`,
  `Financial data as-of: ${freshness.fetched_at || now}`,
  'Currency: USD',
  '',
].concat(includedSections).join('\n\n---\n\n');

state.final_report_markdown = finalMarkdown;
state.report_outputs = {
  full_report_markdown: finalMarkdown,
  presentation_prompt: state.presentation_prompt?.prompt_text || '',
};
const citationQa = {
  figure_source_policy: 'Every figure must cite SEC EDGAR, market data source, or an explicit reason when unavailable. All values in USD.',
  financial_snapshot_ready: Boolean(state.financial_snapshot?.quarterly?.rows?.length || state.sections.s2_quarterly),
  quarterly_table_ready: Boolean(state.financial_snapshot?.quarterly?.rows?.length),
  annual_table_ready: Boolean(state.financial_snapshot?.annual?.rows?.length),
  three_year_revenue_ready: Boolean(state.financial_snapshot?.three_year_revenue?.has_data || state.sections.s2_three_year_revenue),
  market_data_separated: Boolean(state.financial_snapshot?.market_data?.rows?.length || state.sections.s2_market_data),
  ratio_dashboard_ready: Boolean(state.ratio_dashboard?.annual?.length || state.sections.s5_ratios),
  peer_benchmark_ready: Boolean(state.peer_benchmarks?.markdown),
  value_realization_ready: Boolean(state.sections.s9_sales),
  proposal_ready: Boolean(state.sections.s6_proposal),
  presentation_prompt_ready: Boolean(state.presentation_prompt?.prompt_text),
  data_freshness_recorded: Boolean(freshness.fetched_at),
  filing_anchors_recorded: Boolean(anchors.quarterly_10q || anchors.annual_10k),
  gap_count: aggregateReportGaps(state).length,
  warning_notes: [],
};
if (!citationQa.three_year_revenue_ready) citationQa.warning_notes.push('3-year 10-K revenue section missing or incomplete.');
if (!citationQa.peer_benchmark_ready) citationQa.warning_notes.push('Peer comparison section missing.');
if (!citationQa.data_freshness_recorded) citationQa.warning_notes.push('Data freshness stamp missing.');
if (!citationQa.filing_anchors_recorded) citationQa.warning_notes.push('Filing anchors missing.');
if ((state.normalized?.gaps || []).length > 8) citationQa.warning_notes.push('High gap count — verify issuer profile and SEC form coverage.');
if (state.entity?.is_foreign_issuer && !(state.normalized?.metrics?.revenue || []).length) citationQa.warning_notes.push('Foreign issuer with no normalized revenue — check 20-F/IFRS extraction.');
const qaWarnings = [...missing.map((id) => `Section omitted: ${id}`), ...citationQa.warning_notes];
state.qa = {
  missing_sections: missing,
  validation_status: qaWarnings.length ? 'WARN' : 'PASS',
  checks: ['sections_assembled', 'data_freshness', 'filing_anchors', 'usd_only', 'citation_policy', 'presentation_prompt_pending'],
  citation_qa: citationQa,
  warning: qaWarnings.join(' | '),
};
state.audit_log = state.audit_log || [];
state.audit_log.push({
  timestamp: now,
  workflow_name: 'WF_ASSEMBLE_QA',
  status: state.qa.validation_status,
  message: state.qa.warning || `Full report assembled (${sectionOrder.length} sections, USD, anchored tables).`,
});
return [{ json: state }];
