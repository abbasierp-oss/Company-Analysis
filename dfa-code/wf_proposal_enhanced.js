const state = items[0]?.json?.state || items[0]?.json || {};
const now = new Date().toISOString();
const execType = state.inputs?.exec_type || 'executive';
const industry = state.inputs?.industry || 'industry';
const provider = state.inputs?.service_provider || 'MY COMPANY';
const q = getQuarterlyAnchorMetrics(state);
const period = q.period_label || 'Quarterly anchor';
const market = state.research?.market_data || {};
const peerPublished = state.peer_benchmarks?.table_published === true;
const painPoints = [
  `Cash-flow and margin focus (${period}): FCF ${formatQuarterlyMetric(q.free_cash_flow)}; operating margin ${formatQuarterlyMetric(q.operating_margin, 'pct')}.`,
  `Revenue scale (${period}): ${formatQuarterlyMetric(q.revenue)}.`,
  `Market data (live): market cap ${market.market_cap_usd != null ? fmtUsdValue(market.market_cap_usd) : 'N/A'} as of ${market.source_date || 'latest'}${market.math_note ? ` — ${market.math_note}` : ''}.`,
  peerPublished
    ? `Peer context: Section 3 FY${state.peer_benchmarks?.benchmark_fy || 2025} peer table published with consistent SEC methodology.`
    : 'Peer context: Section 3 withheld until core FY metrics can be populated consistently across peers.',
  `Operating visibility: connect finance automation and data workflows to margin, cash conversion, and risk for the ${execType}.`,
].slice(0, 5);
const initiatives = [
  { name: 'Metric-to-value diagnostic', targets: ['operating_margin','fcf_margin'], mechanism: 'Map source-backed quarterly signals to controllable levers.', fit: `${provider} finance transformation and data/AI diagnostic.`, impact: 'Conservative: 25-75 bps margin opportunity if waste confirmed.', timeline: '0-3 months', risks: 'Weak data ownership; assign metric owners.' },
  { name: 'Close and reporting automation', targets: ['close_cycle_days','forecast_accuracy'], mechanism: 'Standardize definitions and automate manual reporting.', fit: `${provider} finance transformation and cloud ERP.`, impact: 'Faster executive decisions; fewer reporting errors.', timeline: '0-3 months diagnostic, 3-12 months rollout', risks: 'System fragmentation; phased integration.' },
  { name: 'Cash-conversion improvement', targets: ['fcf_margin','working_capital_days'], mechanism: 'Improve billing, collections, and cash application.', fit: `${provider} order-to-cash automation.`, impact: 'Cash-cycle improvement if bottlenecks validated.', timeline: '3-12 months', risks: 'Contract complexity; segment redesign.' },
];
const markdown = [
  '## Section 6: Executive Proposal - Move The Metrics',
  '',
  `Audience: ${execType}`,
  `Industry: ${industry}`,
  `Service provider: ${provider}`,
  `Metric basis: quarterly anchor ${period} only (no unstated annual figures).`,
  '',
  '### Top Trends / Pain Points',
  ...painPoints.map((p) => `- ${p}`),
  '',
  '### Initiatives',
  ...initiatives.map((item, i) => [`${i + 1}. ${item.name}`, `Targets: ${item.targets.join(', ')}`, `Mechanism: ${item.mechanism}`, `${provider} fit: ${item.fit}`, `Impact: ${item.impact}`, `Timeline: ${item.timeline}`, `Risks: ${item.risks}`].join('\n')),
].join('\n\n');
state.executive_proposal = { generated_at: now, pain_points: painPoints, initiatives, markdown, source: 'enhanced_rule_based_v3' };
state.sections = state.sections || {};
state.sections.s6_proposal = markdown;
state.audit_log = state.audit_log || [];
state.audit_log.push({ timestamp: now, workflow_name: 'WF_PROPOSAL', status: 'OK', message: `Executive proposal generated with quarterly anchor metrics (${period}).` });
return [{ json: state }];
