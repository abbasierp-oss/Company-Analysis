const state = items[0]?.json?.state || items[0]?.json || {};
const now = new Date().toISOString();
const execType = state.inputs?.exec_type || 'executive';
const industry = state.inputs?.industry || 'industry';
const q = getQuarterlyAnchorMetrics(state);
const period = q.period_label || 'Quarterly anchor';
const qForm = state.data_freshness?.quarterly_anchor_form || '10-Q';
const qPeriod = q.reporting_period || state.data_freshness?.quarterly_anchor_report_date || 'N/A';
const market = state.research?.market_data || {};
const peerPublished = state.peer_benchmarks?.table_published === true;
const company = state.entity?.legal_name || state.inputs?.company_name || 'Company';

const assessment = [
  `Revenue ${formatQuarterlyMetric(q.revenue)} (${metricCitationShort(q.revenue, qForm)}).`,
  `Operating margin ${formatQuarterlyMetric(q.operating_margin, 'pct')}; FCF ${formatQuarterlyMetric(q.free_cash_flow)}.`,
  `EPS ${formatQuarterlyMetric(q.eps, 'eps')}${q.eps?.one_time_flag ? ' — see Section 2a unusual-quarter notes' : ''}.`,
  market.market_cap_usd != null
    ? `Computed market cap ${fmtUsdValue(market.market_cap_usd)} (${market.market_cap_source || 'Yahoo share price × SEC DEI shares outstanding'}).`
    : 'Computed market cap unavailable from live quote.',
  peerPublished
    ? `Peer comparison available in Section 3 (FY${state.peer_benchmarks?.benchmark_fy || 2025}).`
    : 'Peer comparison withheld — see Section 8 gaps.',
];

const priorities = [
  {
    title: 'Validate cash conversion vs. reported earnings',
    rationale: `FCF ${formatQuarterlyMetric(q.free_cash_flow)} vs. operating margin ${formatQuarterlyMetric(q.operating_margin, 'pct')}.`,
    action: 'Reconcile net income to cash flow; isolate one-time items before setting margin targets.',
    metric: 'FCF on quarterly anchor',
  },
  {
    title: 'Clarify capital structure narrative',
    rationale: 'Section 7 summarizes filing-backed capital-structure signals when present.',
    action: 'Map disclosed financing or deal-related cash flows to leverage and reinvestment capacity.',
    metric: 'Net debt and interest coverage (FY ratios in Section 5)',
  },
  {
    title: 'Set filing-backed operating targets',
    rationale: peerPublished ? 'Use Section 3 FY peer table where populated.' : 'Defer peer-based targets until Section 3 can be populated.',
    action: 'Adopt targets only where filing-backed baselines exist; mark gaps explicitly.',
    metric: 'Operating margin on quarterly anchor',
  },
];

const markdown = [
  '## Section 6: Executive Proposal — Analyst Recommendations',
  '',
  `Audience: ${execType} | Industry: ${industry}`,
  `Basis: quarterly anchor ${period}; GAAP unless noted.`,
  '',
  '### Assessment (filing-backed)',
  ...assessment.map((line) => `- ${line}`),
  '',
  '### Recommended priorities',
  ...priorities.map((p, i) => [
    `${i + 1}. **${p.title}**`,
    `   - Rationale: ${p.rationale}`,
    `   - Recommended action: ${p.action}`,
    `   - Metric to track: ${p.metric}`,
  ].join('\n')),
  '',
  '### What I would not do yet',
  '- Do not set multi-year margin goals off a quarter with disclosed one-time items without an adjusted baseline.',
  '- Do not substitute weighted-average diluted shares for point-in-time shares outstanding in market-cap math.',
  '- Do not cite peer rankings when Section 3 is withheld.',
].join('\n');

state.executive_proposal = { generated_at: now, assessment, priorities, markdown, source: 'analyst_recommendation_v2' };
state.sections = state.sections || {};
state.sections.s6_proposal = markdown;
state.audit_log = state.audit_log || [];
state.audit_log.push({ timestamp: now, workflow_name: 'WF_PROPOSAL', status: 'OK', message: `Analyst-style executive proposal for ${company}.` });
return [{ json: state }];
