const state = items[0]?.json?.state || items[0]?.json || {};
const now = new Date().toISOString();
const company = state.entity?.legal_name || state.inputs?.company_name || 'the company';
const execType = state.inputs?.exec_type || 'executive';
const industry = state.inputs?.industry || 'industry';
const provider = state.inputs?.service_provider || 'MY COMPANY';
const q = getQuarterlyAnchorMetrics(state);
const period = q.period_label || 'Quarterly anchor';
const market = state.research?.market_data || {};
const peerPublished = state.peer_benchmarks?.table_published === true;
const revDisplay = formatQuarterlyMetric(q.revenue);
const opMarginDisplay = formatQuarterlyMetric(q.operating_margin, 'pct');
const fcfDisplay = formatQuarterlyMetric(q.free_cash_flow);

const signals = [
  {
    insight: 'Margin and cash-flow visibility drive value more than headline growth.',
    value: `Operating margin ${opMarginDisplay} and FCF ${fcfDisplay} on ${revDisplay} revenue (${period}).`,
    idea: `${provider} builds KPI governance around source-cited drivers.`,
    proof: `Validate with margin bridge: ${opMarginDisplay} → FCF ${fcfDisplay}.`,
    hook: `${execType} sees which actions move cash on a ${revDisplay} revenue base.`,
  },
  {
    insight: 'Peer gaps reveal structural vs execution issues.',
    value: peerPublished
      ? `FY${state.peer_benchmarks?.benchmark_fy || 2025} peer table in Section 3 — compare operating margin ${opMarginDisplay} to peers.`
      : `Internal baseline only: operating margin ${opMarginDisplay} on ${period} anchor.`,
    idea: `${provider} targets the largest filing-backed underperformance areas.`,
    proof: 'Reconcile peer or internal KPI owners against Section 2a quarterly metrics.',
    hook: `${execType} can prioritize the biggest credibility gap with a dollar or margin target.`,
  },
  {
    insight: 'Quarterly filing cadence reduces decision latency.',
    value: `Quarterly anchor ${state.data_freshness?.quarterly_anchor_form || '10-Q'} (${state.data_freshness?.quarterly_anchor_report_date || period}) — revenue ${revDisplay}.`,
    idea: `${provider} automates close-to-insight reporting.`,
    proof: 'Compare close cycle days vs time from filing to executive dashboard.',
    hook: `${execType} gets current numbers tied to ${period}, not stale spreadsheets.`,
  },
  {
    insight: 'Working-capital discipline converts profit to cash.',
    value: `FCF ${fcfDisplay} vs operating margin ${opMarginDisplay} — the spread shows conversion efficiency.`,
    idea: `${provider} order-to-cash and procure-to-pay programs.`,
    proof: 'Aging, billing cycle, and supplier terms review against FCF bridge.',
    hook: `${execType} can frame cash release without requiring revenue growth.`,
  },
  {
    insight: 'Market cap context frames strategic urgency.',
    value: market.market_cap_usd != null
      ? `${fmtUsdValue(market.market_cap_usd)} market cap on ${revDisplay} revenue — valuation sensitive to margin and FCF trends.`
      : naReason('market cap requires live share price and SEC shares outstanding'),
    idea: `${provider} links initiatives to valuation-sensitive metrics.`,
    proof: formatMarketCapProof(market),
    hook: `${execType} aligns operators with the capital markets story using filing-backed metrics.`,
  },
];
const hypotheses = [
  {
    baseline_signal: `Operating margin ${opMarginDisplay} on ${revDisplay}`,
    target_improvement: '25–75 bps if manual waste confirmed',
    time_to_impact: '3–12 months',
    measurement_method: `Monthly margin bridge on ${period} anchor`,
  },
  {
    baseline_signal: `FCF ${fcfDisplay}`,
    target_improvement: '5–15% process-related FCF uplift after validation',
    time_to_impact: '3–12 months',
    measurement_method: 'FCF margin and collections aging vs Section 2a',
  },
  {
    baseline_signal: `Data fetched ${state.data_freshness?.fetched_at || now}`,
    target_improvement: '20–40% reporting cycle reduction',
    time_to_impact: '0–3 months diagnostic',
    measurement_method: 'Close/reporting cycle days',
  },
];
const questions = [
  `For the ${execType}, which metric (${opMarginDisplay} margin, ${fcfDisplay} FCF, or ${revDisplay} revenue growth) creates the most credibility if improved in two quarters?`,
  `For the ${execType}, where is the biggest bottleneck: data quality, process speed, cost, or risk?`,
  `In ${industry}, what constraint matters most: pricing, demand, regulation, supply, or technology?`,
  peerPublished ? 'Which peer in Section 3 does leadership benchmark against internally?' : 'Which competitor does leadership benchmark against internally?',
  'Who owns the metric baseline and can approve a 30-day diagnostic?',
  'What event makes this urgent now: board pressure, margin miss, cash constraint, or audit issue?',
];
const narrative = `Situation: ${company} needs a source-cited view of strengths, weaknesses, and gaps using ${period} anchor (revenue ${revDisplay}, margin ${opMarginDisplay}, FCF ${fcfDisplay}).\nImplication: Without metric ownership, leadership mistakes noise for strategy.\nMove: ${provider} runs a metric-to-value diagnostic tied to the ${execType} agenda.\nPayoff: Margin, cash conversion, cycle time, and risk visibility improve with measurable KPIs anchored to SEC filings.\nAsk: Approve a 30-day diagnostic using the live quarterly financial snapshot${peerPublished ? ' and peer table' : ''}.`;
const markdown = [
  '## Section 9: Opportunities Tied to Financials',
  '',
  `Metric basis: quarterly anchor ${period} (${revDisplay} revenue, ${opMarginDisplay} operating margin, ${fcfDisplay} FCF).`,
  '',
  '### A) Insight-to-Value Map',
  ...signals.map((s) => `- **Insight:** ${s.insight}\n  **Financial baseline:** ${s.value}\n  **${provider} opportunity:** ${s.idea}\n  **Proof:** ${s.proof}\n  **Executive hook:** ${s.hook}`),
  '',
  '### B) Value Hypotheses (baseline → target)',
  ...hypotheses.map((h, i) => `${i + 1}. Baseline: ${h.baseline_signal}\n   Target: ${h.target_improvement}\n   Time: ${h.time_to_impact}\n   Measure: ${h.measurement_method}`),
  '',
  '### C) Discovery Questions',
  ...questions.map((qText) => `- ${qText}`),
  '',
  '### D) One-slide Sales Narrative',
  narrative,
].join('\n\n');
state.value_realization = { generated_at: now, markdown, signals, hypotheses, source: 'enhanced_rule_based_v5' };
state.sections = state.sections || {};
state.sections.s9_sales = markdown;
state.audit_log = state.audit_log || [];
state.audit_log.push({ timestamp: now, workflow_name: 'WF_VALUE_REALIZATION', status: 'OK', message: `Section 9 generated with financial hooks (${period}).` });
return [{ json: state }];
