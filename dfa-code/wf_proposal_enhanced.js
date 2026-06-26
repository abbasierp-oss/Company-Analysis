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

const assessment = [
  `Revenue ${formatQuarterlyMetric(q.revenue)} on ${period} (${metricCitation(q.revenue, qForm, qPeriod)}).`,
  `Operating margin ${formatQuarterlyMetric(q.operating_margin, 'pct')}; FCF ${formatQuarterlyMetric(q.free_cash_flow)} on the same quarterly anchor.`,
  `EPS ${formatQuarterlyMetric(q.eps, 'eps')}${q.eps?.one_time_flag ? ' — includes one-time items; see Section 2a unusual-quarter notes' : ''}.`,
  market.market_cap_usd != null
    ? `Market cap ${fmtUsdValue(market.market_cap_usd)} (${market.source_date || 'N/A'}, ${market.market_cap_source || 'Yahoo Finance'}).`
    : 'Market cap unavailable from live quote.',
  peerPublished
    ? `Peer positioning: Section 3 FY${state.peer_benchmarks?.benchmark_fy || 2025} comparison available.`
    : 'Peer comparison withheld — insufficient consistent peer data (Section 8).',
];

const priorities = [
  {
    title: 'Validate cash conversion vs. reported earnings',
    rationale: `FCF ${formatQuarterlyMetric(q.free_cash_flow)} vs. operating margin ${formatQuarterlyMetric(q.operating_margin, 'pct')} on ${period}.`,
    action: 'Reconcile net income to cash flow; isolate one-time items before setting margin targets.',
    metric: 'FCF margin on quarterly anchor',
  },
  {
    title: 'Clarify capital structure narrative',
    rationale: 'Section 7 flags capital-structure / M&A signals when supported by filings or shareholder communications.',
    action: 'Map disclosed financing or deal-related cash flows to leverage and reinvestment capacity.',
    metric: 'Net debt and interest coverage (FY ratios in Section 5)',
  },
  {
    title: 'Set peer-credible operating targets',
    rationale: peerPublished ? 'Use Section 3 FY peer margins as the external benchmark.' : 'Defer peer-based targets until Section 3 can be populated.',
    action: 'Adopt targets only where filing-backed baselines exist; mark gaps explicitly.',
    metric: 'Operating margin vs. peer median',
  },
];

const markdown = [
  '## Section 6: Executive Proposal — Analyst Recommendations',
  '',
  `Audience: ${execType} | Industry: ${industry}`,
  `Basis: quarterly anchor ${period} (report period ${qPeriod}); GAAP unless noted.`,
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
  '- Do not use market-implied share count as a substitute for quarterly weighted-average diluted shares in per-share analysis.',
  '- Do not cite peer rankings when Section 3 is withheld.',
].join('\n');

state.executive_proposal = { generated_at: now, assessment, priorities, markdown, source: 'analyst_recommendation_v1' };
state.sections = state.sections || {};
state.sections.s6_proposal = markdown;
state.audit_log = state.audit_log || [];
state.audit_log.push({ timestamp: now, workflow_name: 'WF_PROPOSAL', status: 'OK', message: `Analyst-style executive proposal for ${period}.` });
return [{ json: state }];
