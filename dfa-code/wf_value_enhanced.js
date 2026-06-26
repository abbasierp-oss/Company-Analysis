const state = items[0]?.json?.state || items[0]?.json || {};
const now = new Date().toISOString();
const company = state.entity?.legal_name || state.inputs?.company_name || 'the company';
const execType = state.inputs?.exec_type || 'executive';
const industry = state.inputs?.industry || 'industry';
const provider = state.inputs?.service_provider || 'MY COMPANY';
const metrics = state.normalized?.metrics || {};
function latest(name) { const s = metrics[name] || []; return Array.isArray(s) && s.length ? s[s.length - 1] : null; }
const opMargin = latest('operating_margin');
const fcf = latest('free_cash_flow');
const signals = [
  { insight: 'Margin and cash-flow visibility drive value more than headline growth.', value: `Operating margin ${opMargin ? opMargin.value : 'N/A'}; FCF ${fcf ? fcf.value : 'N/A'}`, idea: `${provider} builds KPI governance around source-cited drivers.`, proof: 'Validate with margin bridge and FCF bridge.', hook: `${execType} sees which actions move cash flow.` },
  { insight: 'Peer gaps reveal structural vs execution issues.', value: 'Benchmark table in section 3 with live SEC peer metrics.', idea: `${provider} targets the largest peer-underperformance areas.`, proof: 'Reconcile peer table vs internal KPI owners.', hook: `${execType} can prioritize the biggest credibility gap.` },
  { insight: 'Fresh filings reduce decision latency.', value: `Latest filing ${state.data_freshness?.latest_filing_form || 'N/A'} on ${state.data_freshness?.latest_filing_date || 'N/A'}`, idea: `${provider} automates close-to-insight reporting.`, proof: 'Compare close cycle and dashboard latency.', hook: `${execType} gets current numbers, not stale spreadsheets.` },
  { insight: 'Working-capital discipline converts profit to cash.', value: 'FCF margin and cash conversion metrics', idea: `${provider} order-to-cash and procure-to-pay programs.`, proof: 'Aging, billing cycle, supplier terms review.', hook: `${execType} can frame cash release without revenue growth.` },
  { insight: 'Market cap context frames strategic urgency.', value: state.research?.market_data?.market_cap_usd ? fmtMetric(state.research.market_data.market_cap_usd) : 'N/A for private or unavailable price', idea: `${provider} links initiatives to valuation-sensitive metrics.`, proof: 'Tie initiative ROI to margin/FCF/market narrative.', hook: `${execType} aligns operators with capital markets story.` },
];
const hypotheses = [
  { baseline_signal: opMargin ? `Operating margin ${opMargin.value}` : 'Operating margin N/A', target_improvement: '25-75 bps if manual waste confirmed', time_to_impact: '3-12 months', measurement_method: 'Monthly margin bridge' },
  { baseline_signal: fcf ? `FCF ${fcf.value}` : 'FCF N/A', target_improvement: '5-15% process-related FCF uplift after validation', time_to_impact: '3-12 months', measurement_method: 'FCF margin and collections aging' },
  { baseline_signal: `Data fetched ${state.data_freshness?.fetched_at || now}`, target_improvement: '20-40% reporting cycle reduction', time_to_impact: '0-3 months diagnostic', measurement_method: 'Close/reporting cycle days' },
];
const questions = [
  `For the ${execType}, which metric creates the most credibility if improved in two quarters?`,
  `For the ${execType}, where is the biggest bottleneck: data quality, process speed, cost, or risk?`,
  `In ${industry}, what constraint matters most: pricing, demand, regulation, supply, or technology?`,
  'Which peer does leadership benchmark against internally?',
  'Who owns the metric baseline and can approve a 30-day diagnostic?',
  'What event makes this urgent now: board pressure, margin miss, cash constraint, or audit issue?',
];
const narrative = `Situation: ${company} needs a source-cited view of strengths, weaknesses, and peer gaps using filings fetched ${state.data_freshness?.fetched_at || now}.\nImplication: Without metric ownership, leadership mistakes noise for strategy.\nMove: ${provider} runs a metric-to-value diagnostic tied to the ${execType} agenda.\nPayoff: Margin, cash conversion, cycle time, and risk visibility improve with measurable KPIs.\nAsk: Approve a 30-day diagnostic using the live financial snapshot and peer table.`;
const markdown = ['## Section 9: Insight To Value Realization And Selling Ideas', '', '### A) Insight-to-Value Map', ...signals.map((s) => `- Key insight: ${s.insight}\n  Value realization: ${s.value}\n  ${provider} selling idea: ${s.idea}\n  Proof: ${s.proof}\n  Executive hook: ${s.hook}`), '', '### B) Value Hypotheses', ...hypotheses.map((h, i) => `${i + 1}. Baseline: ${h.baseline_signal}\nTarget: ${h.target_improvement}\nTime: ${h.time_to_impact}\nMeasure: ${h.measurement_method}`), '', '### C) Discovery Questions', ...questions.map((q) => `- ${q}`), '', '### D) One-slide Sales Narrative', narrative].join('\n\n');
state.value_realization = { generated_at: now, markdown, source: 'enhanced_rule_based_v2' };
state.sections = state.sections || {};
state.sections.s9_sales = markdown;
state.audit_log = state.audit_log || [];
state.audit_log.push({ timestamp: now, workflow_name: 'WF_VALUE_REALIZATION', status: 'OK', message: 'Section 9 generated with live metrics, peers, and freshness context.' });
return [{ json: state }];
