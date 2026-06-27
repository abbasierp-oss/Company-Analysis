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
const initiatives = extractITInitiatives(state);

const revDisplay = formatQuarterlyMetric(q.revenue);
const opMarginDisplay = formatQuarterlyMetric(q.operating_margin, 'pct');
const fcfDisplay = formatQuarterlyMetric(q.free_cash_flow);
const epsDisplay = formatQuarterlyMetric(q.eps, 'eps');

function fyLabel(state) {
  const fy = state.peer_benchmarks?.benchmark_fy;
  return fy ? `FY${fy}` : 'latest fiscal year';
}

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

const initiativeTemplates = [
  {
    title: 'Close the gap between reported earnings and cash',
    rationale: `FCF ${fcfDisplay} vs operating margin ${opMarginDisplay} on the ${period} anchor.`,
    financial_hook: `Every 100 bps of FCF margin on ${revDisplay} revenue changes annual cash generation materially.`,
    action: 'Instrument the initiative with a margin-to-cash bridge and automated close checkpoints.',
    metric: `FCF margin on ${period}`,
    initiative_match: /data|automation|erp|platform|analytics/i,
  },
  {
    title: 'Align capital structure messaging with filing-backed leverage',
    rationale: 'Section 5 ratio dashboard shows debt, coverage, and ROCE on SEC anchors.',
    financial_hook: 'Interest coverage and net debt ratios in Section 5 determine refinancing flexibility.',
    action: 'Connect financing disclosures to initiative governance and reporting cadence.',
    metric: 'Interest coverage and net debt / EBITDA (Section 5)',
    initiative_match: /erp|data|cyber|governance/i,
  },
  {
    title: 'Set operating targets only where filings support them',
    rationale: peerPublished
      ? `Use Section 3 FY peer table — operating margin ${opMarginDisplay} is the ${period} baseline.`
      : `Defer peer-based targets; use ${opMarginDisplay} operating margin as the internal baseline.`,
    financial_hook: `Operating margin ${opMarginDisplay} on ${revDisplay} revenue is the credible starting point for any improvement plan.`,
    action: 'Tie initiative milestones to quarterly anchor metrics with source-cited dashboards.',
    metric: `Operating margin on ${period}`,
    initiative_match: /digital|customer|ai|automation|cloud/i,
  },
];

function pickInitiative(template, used) {
  const match = initiatives.find((it) => template.initiative_match.test(it.name) && !used.has(normName(it.name)));
  if (match) return match;
  return initiatives.find((it) => !used.has(normName(it.name))) || null;
}

const usedInitiatives = new Set();
const priorities = [];

for (const template of initiativeTemplates) {
  const initiative = pickInitiative(template, usedInitiatives);
  if (!initiative) continue;
  usedInitiatives.add(normName(initiative.name));
  priorities.push(linkRecommendationToInitiative({
    title: template.title,
    rationale: template.rationale,
    financial_hook: template.financial_hook,
    action: template.action,
    metric: template.metric,
  }, [initiative], 0));
}

const markdownParts = [
  '## Section 6: Executive Proposal — Recommendations',
  '',
  `Audience: ${execType} | Industry: ${industry}`,
  `Basis: quarterly anchor ${period}; GAAP unless noted. Each priority is tied to a disclosed or user-provided IT initiative.`,
  '',
  '### Active IT initiatives (source of truth)',
];

if (initiatives.length) {
  markdownParts.push(...initiatives.map((it) => `- **${it.name}** — Goal: ${it.goal}; tracks ${it.metric} (source: ${it.source}).`));
} else {
  markdownParts.push('- No IT initiatives identified. Add initiatives in the portal or source notes to generate initiative-linked recommendations.');
}

markdownParts.push('', '### Assessment (filing-backed)', ...assessment.map((line) => `- ${line}`));

if (priorities.length) {
  markdownParts.push('', '### Recommendations mapped to initiatives');
  markdownParts.push(...priorities.map((p, i) => [
    `${i + 1}. **${p.title}**`,
    `   - Initiative: ${p.initiative_name}`,
    `   - Goal support: ${p.goal_support}`,
    `   - Outcome metric: ${p.outcome_metric}`,
    `   - Financial hook: ${p.financial_hook}`,
    `   - Rationale: ${p.rationale}`,
    `   - Recommended action: ${p.action}`,
  ].join('\n')));
} else {
  markdownParts.push('', '### Recommendations', '- Withheld — no initiative-linked recommendations could be produced without a disclosed IT initiative list.');
}

markdownParts.push(
  '',
  '### What I would not do yet',
  '- Do not set multi-year margin goals off a quarter with disclosed one-time items without an adjusted baseline.',
  '- Do not recommend programs that are not tied to an active IT initiative on the roadmap.',
  '- Do not cite peer rankings when peer comparison was omitted from this report.',
);

const markdown = markdownParts.join('\n');

state.it_initiatives = initiatives;
state.executive_proposal = { generated_at: now, assessment, priorities, initiatives, markdown, source: 'initiative_linked_v4' };
state.sections = state.sections || {};
state.sections.s6_proposal = markdown;
state.audit_log = state.audit_log || [];
state.audit_log.push({ timestamp: now, workflow_name: 'WF_PROPOSAL', status: priorities.length ? 'OK' : 'WARN', message: `Executive proposal with ${priorities.length} initiative-linked priorities for ${company}.` });
return [{ json: state }];
