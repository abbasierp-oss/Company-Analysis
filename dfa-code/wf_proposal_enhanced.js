const state = items[0]?.json?.state || items[0]?.json || {};
const now = new Date().toISOString();
const execType = state.inputs?.exec_type || 'executive';
const industry = state.inputs?.industry || 'industry';
const q = getQuarterlyAnchorMetrics(state);
const period = q.period_label || 'Quarterly anchor';
const qForm = state.data_freshness?.quarterly_anchor_form || '10-Q';
const market = state.research?.market_data || {};
const peerPublished = state.peer_benchmarks?.table_published === true;
const company = state.entity?.legal_name || state.inputs?.company_name || 'Company';

const revDisplay = formatQuarterlyMetric(q.revenue);
const opMarginDisplay = formatQuarterlyMetric(q.operating_margin, 'pct');
const fcfDisplay = formatQuarterlyMetric(q.free_cash_flow);
const epsDisplay = formatQuarterlyMetric(q.eps, 'eps');

const assessment = [
  `Revenue ${revDisplay} (${metricCitationShort(q.revenue, qForm)}) — baseline for growth and pricing decisions.`,
  `Operating margin ${opMarginDisplay}; FCF ${fcfDisplay} — together they show whether earnings convert to cash.`,
  `EPS ${epsDisplay}${q.eps?.one_time_flag ? ' — see Section 2a unusual-quarter notes before using as a run-rate' : ''}.`,
  market.market_cap_usd != null
    ? `Market cap ${fmtUsdValue(market.market_cap_usd)} (${market.market_cap_source || 'Yahoo share price × SEC shares outstanding'}) — frames urgency for margin and cash improvements.`
    : naReason('market cap requires live share price and SEC shares outstanding'),
  peerPublished
    ? `Peer comparison in Section 3 (${fyLabel(state)}) shows where ${company} leads or trails on filing-backed FY metrics.`
    : 'Peer comparison omitted — insufficient consistent peer SEC data for this run.',
];

function fyLabel(state) {
  const fy = state.peer_benchmarks?.benchmark_fy;
  return fy ? `FY${fy}` : 'latest fiscal year';
}

const priorities = [
  {
    title: 'Close the gap between reported earnings and cash',
    rationale: `FCF ${fcfDisplay} vs operating margin ${opMarginDisplay} on the ${period} anchor.`,
    financial_hook: `Every 100 bps of FCF margin on ${revDisplay} revenue changes annual cash generation materially.`,
    action: 'Run a margin-to-cash bridge; isolate one-time items before setting targets.',
    metric: `FCF margin on ${period}`,
  },
  {
    title: 'Align capital structure messaging with filing-backed leverage',
    rationale: 'Section 5 ratio dashboard shows debt, coverage, and ROCE on SEC anchors.',
    financial_hook: 'Interest coverage and net debt ratios in Section 5 determine refinancing flexibility.',
    action: 'Map disclosed financing or deal-related cash flows to leverage and reinvestment capacity.',
    metric: 'Interest coverage and net debt / EBITDA (Section 5)',
  },
  {
    title: 'Set operating targets only where filings support them',
    rationale: peerPublished
      ? `Use Section 3 FY peer table — operating margin ${opMarginDisplay} is the ${period} baseline.`
      : `Defer peer-based targets; use ${opMarginDisplay} operating margin as the internal baseline.`,
    financial_hook: `Operating margin ${opMarginDisplay} on ${revDisplay} revenue is the credible starting point for any improvement plan.`,
    action: 'Adopt targets tied to quarterly anchor metrics; document gaps where SEC data is incomplete.',
    metric: `Operating margin on ${period}`,
  },
];

const markdown = [
  '## Section 6: Executive Proposal — Recommendations',
  '',
  `Audience: ${execType} | Industry: ${industry}`,
  `Basis: quarterly anchor ${period}; GAAP unless noted. Each priority below links to a filing-backed financial metric.`,
  '',
  '### Assessment (filing-backed)',
  ...assessment.map((line) => `- ${line}`),
  '',
  '### Recommended priorities (financial hooks)',
  ...priorities.map((p, i) => [
    `${i + 1}. **${p.title}**`,
    `   - Financial hook: ${p.financial_hook}`,
    `   - Rationale: ${p.rationale}`,
    `   - Recommended action: ${p.action}`,
    `   - Metric to track: ${p.metric}`,
  ].join('\n')),
  '',
  '### What I would not do yet',
  '- Do not set multi-year margin goals off a quarter with disclosed one-time items without an adjusted baseline.',
  '- Do not substitute weighted-average diluted shares for point-in-time shares outstanding in market-cap math.',
  '- Do not cite peer rankings when peer comparison was omitted from this report.',
].join('\n');

state.executive_proposal = { generated_at: now, assessment, priorities, markdown, source: 'analyst_recommendation_v3' };
state.sections = state.sections || {};
state.sections.s6_proposal = markdown;
state.audit_log = state.audit_log || [];
state.audit_log.push({ timestamp: now, workflow_name: 'WF_PROPOSAL', status: 'OK', message: `Executive proposal with financial hooks for ${company}.` });
return [{ json: state }];
