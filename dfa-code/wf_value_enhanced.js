const state = items[0]?.json?.state || items[0]?.json || {};
const now = new Date().toISOString();
const company = state.entity?.legal_name || state.inputs?.company_name || 'the company';
const execType = state.inputs?.exec_type || 'executive';
const industry = state.inputs?.industry || 'industry';
const provider = state.inputs?.service_provider || 'MY COMPANY';
const q = getQuarterlyAnchorMetrics(state);
const period = q.period_label || 'Quarterly anchor';
const market = state.research?.market_data || {};
const peerPublished = Boolean(state.peer_benchmarks?.markdown);
const initiatives = extractITInitiatives(state);
const revDisplay = formatQuarterlyMetric(q.revenue);
const opMarginDisplay = formatQuarterlyMetric(q.operating_margin, 'pct');
const fcfDisplay = formatQuarterlyMetric(q.free_cash_flow);

const signalTemplates = [
  {
    insight: 'Margin and cash-flow visibility drive value more than headline growth.',
    value: `Operating margin ${opMarginDisplay} and FCF ${fcfDisplay} on ${revDisplay} revenue (${period}).`,
    idea: (it) => `${provider} accelerates "${it.name}" with KPI governance on ${it.metric}.`,
    proof: (it) => `Validate initiative "${it.name}" against margin bridge: ${opMarginDisplay} → FCF ${fcfDisplay}.`,
    hook: (it) => `${execType} sees how ${it.name} moves cash on a ${revDisplay} revenue base.`,
    match: /data|automation|erp|platform/i,
  },
  {
    insight: 'Peer gaps reveal structural vs execution issues.',
    value: peerPublished
      ? `FY${state.peer_benchmarks?.benchmark_fy || 2025} peer table in Section 3 — compare operating margin ${opMarginDisplay} to peers.`
      : `Internal baseline only: operating margin ${opMarginDisplay} on ${period} anchor.`,
    idea: (it) => `${provider} targets underperformance through "${it.name}" (${it.goal}).`,
    proof: (it) => `Reconcile ${it.metric} owners for initiative "${it.name}" against Section 2a metrics.`,
    hook: (it) => `${execType} can prioritize ${it.name} where peer credibility gaps are largest.`,
    match: /digital|customer|cloud|ai/i,
  },
  {
    insight: 'Quarterly filing cadence reduces decision latency.',
    value: `Quarterly anchor ${state.data_freshness?.quarterly_anchor_form || '10-Q'} (${state.data_freshness?.quarterly_anchor_report_date || period}) — revenue ${revDisplay}.`,
    idea: (it) => `${provider} connects "${it.name}" to close-to-insight reporting.`,
    proof: (it) => `Measure ${it.metric} before/after ${it.name} milestones.`,
    hook: (it) => `${execType} gets filing-backed numbers for ${it.name}, not stale spreadsheets.`,
    match: /data|analytics|erp|reporting/i,
  },
  {
    insight: 'Working-capital discipline converts profit to cash.',
    value: `FCF ${fcfDisplay} vs operating margin ${opMarginDisplay} — the spread shows conversion efficiency.`,
    idea: (it) => `${provider} aligns "${it.name}" with order-to-cash and procure-to-pay outcomes.`,
    proof: (it) => `FCF bridge review tied to ${it.metric} for ${it.name}.`,
    hook: (it) => `${execType} frames cash release via ${it.name} without requiring revenue growth.`,
    match: /automation|erp|process/i,
  },
  {
    insight: 'Market cap context frames strategic urgency.',
    value: market.market_cap_usd != null
      ? `${fmtUsdValue(market.market_cap_usd)} market cap on ${revDisplay} revenue — valuation sensitive to margin and FCF trends.`
      : naReason('market cap requires live share price and SEC shares outstanding'),
    idea: (it) => `${provider} links "${it.name}" to valuation-sensitive metrics (${it.metric}).`,
    proof: formatMarketCapProof(market),
    hook: (it) => `${execType} aligns ${it.name} with the capital markets story.`,
    match: /ai|digital|cyber|cloud/i,
  },
];

function initiativeForTemplate(template, used) {
  const hit = initiatives.find((it) => template.match.test(it.name) && !used.has(normName(it.name)));
  if (hit) return hit;
  return initiatives.find((it) => !used.has(normName(it.name))) || null;
}

const used = new Set();
const signals = [];
for (const template of signalTemplates) {
  const initiative = initiativeForTemplate(template, used);
  if (!initiative) continue;
  used.add(normName(initiative.name));
  signals.push({
    insight: template.insight,
    value: template.value,
    initiative_name: initiative.name,
    initiative_goal: initiative.goal,
    outcome_metric: initiative.metric,
    idea: template.idea(initiative),
    proof: template.proof(initiative),
    hook: template.hook(initiative),
  });
}

const hypotheses = signals.slice(0, 3).map((s) => ({
  initiative: s.initiative_name,
  baseline_signal: s.value,
  target_improvement: `Improve ${s.outcome_metric} through ${s.initiative_name}`,
  time_to_impact: '3–12 months',
  measurement_method: s.outcome_metric,
}));

const questions = [
  `For the ${execType}, which initiative-owned metric (${opMarginDisplay} margin, ${fcfDisplay} FCF, or ${revDisplay} revenue) creates the most credibility if improved in two quarters?`,
  initiatives.length ? `Which IT initiative (${initiatives.map((i) => i.name).join(', ')}) is most constrained by data, process, or funding?` : 'Which disclosed IT initiative should anchor the next executive review?',
  `In ${industry}, what constraint matters most for active programs: pricing, demand, regulation, supply, or technology?`,
  peerPublished ? 'Which peer in Section 3 does leadership benchmark against internally?' : 'Which competitor does leadership benchmark against internally?',
  'Who owns each initiative metric baseline and can approve a 30-day diagnostic?',
  'What event makes initiative acceleration urgent now: board pressure, margin miss, cash constraint, or audit issue?',
];

const narrative = initiatives.length
  ? `Situation: ${company} is executing ${initiatives.length} IT initiative(s) while operating at ${period} anchor (revenue ${revDisplay}, margin ${opMarginDisplay}, FCF ${fcfDisplay}).\nImplication: Without initiative-to-metric linkage, leadership funds programs that do not move filing-backed outcomes.\nMove: ${provider} runs an initiative impact diagnostic tied to the ${execType} agenda.\nPayoff: Each program shows progress on ${initiatives[0].metric} and related financial KPIs.\nAsk: Approve a 30-day diagnostic mapped to active initiatives.`
  : `Situation: ${company} needs initiative disclosure before opportunity sizing (${period} anchor: revenue ${revDisplay}, margin ${opMarginDisplay}, FCF ${fcfDisplay}).\nImplication: Generic recommendations are withheld without a roadmap.\nMove: ${provider} collects the IT initiative list, then ties opportunities to SEC-backed metrics.\nAsk: Provide active initiatives in the portal, then approve a diagnostic.`;

const markdownParts = [
  '## Section 9: Opportunities Tied to Financials',
  '',
  `Metric basis: quarterly anchor ${period} (${revDisplay} revenue, ${opMarginDisplay} operating margin, ${fcfDisplay} FCF).`,
  '',
  '### Active IT initiatives',
  ...(initiatives.length
    ? initiatives.map((it) => `- **${it.name}** — ${it.goal}; outcome metric: ${it.metric}`)
  : ['- No initiatives identified — opportunities below are withheld until a roadmap is provided.']),
];

if (signals.length) {
  markdownParts.push(
    '',
    '### A) Initiative-to-Value Map',
    ...signals.map((s) => `- **Initiative:** ${s.initiative_name}\n  **Goal:** ${s.initiative_goal}\n  **Financial baseline:** ${s.value}\n  **Outcome metric:** ${s.outcome_metric}\n  **${provider} opportunity:** ${s.idea}\n  **Proof:** ${s.proof}\n  **Executive hook:** ${s.hook}`),
    '',
    '### B) Value Hypotheses (initiative → target)',
    ...hypotheses.map((h, i) => `${i + 1}. Initiative: ${h.initiative}\n   Baseline: ${h.baseline_signal}\n   Target: ${h.target_improvement}\n   Time: ${h.time_to_impact}\n   Measure: ${h.measurement_method}`),
  );
}

markdownParts.push(
  '',
  '### C) Discovery Questions',
  ...questions.map((qText) => `- ${qText}`),
  '',
  '### D) One-slide Sales Narrative',
  narrative,
);

const markdown = markdownParts.join('\n\n');
state.value_realization = { generated_at: now, markdown, signals, hypotheses, initiatives, source: 'initiative_linked_v6' };
state.sections = state.sections || {};
state.sections.s9_sales = markdown;
state.audit_log = state.audit_log || [];
state.audit_log.push({ timestamp: now, workflow_name: 'WF_VALUE_REALIZATION', status: signals.length ? 'OK' : 'WARN', message: `Section 9 with ${signals.length} initiative-linked signals (${period}).` });
return [{ json: state }];
