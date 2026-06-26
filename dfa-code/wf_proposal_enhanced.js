const state = items[0]?.json?.state || items[0]?.json || {};
const now = new Date().toISOString();
const execType = state.inputs?.exec_type || 'executive';
const industry = state.inputs?.industry || 'industry';
const provider = state.inputs?.service_provider || 'MY COMPANY';
const metrics = state.normalized?.metrics || {};
function latest(name) { const s = metrics[name] || []; return Array.isArray(s) && s.length ? s[s.length - 1] : null; }
function signal(name, label) { const item = latest(name); return item ? `${label}: ${item.value} ${item.unit || ''} (${item.period || 'latest'})` : `${label}: N/A`; }
const peerGaps = (state.peer_benchmarks?.peers || []).filter((p) => p.source_status === 'SEC_PEER_FACTS_OK').length;
const painPoints = [
  `Cash-flow and margin focus: ${signal('free_cash_flow','FCF')} and ${signal('operating_margin','operating margin')}.`,
  `Market cap / scale: ${state.research?.market_data?.market_cap_usd ? fmtMetric(state.research.market_data.market_cap_usd) : 'N/A'} as of ${state.research?.market_data?.source_date || 'latest'}.`,
  `Peer context: ${peerGaps} SEC-backed peer comparisons available in section 3.`,
  `Data freshness: financials fetched at ${state.data_freshness?.fetched_at || now}; latest filing ${state.data_freshness?.latest_filing_form || 'N/A'} (${state.data_freshness?.latest_filing_date || 'N/A'}).`,
  `Operating visibility: connect finance automation and data workflows to margin, cash conversion, and risk for the ${execType}.`,
].slice(0, 5);
const initiatives = [
  { name: 'Metric-to-value diagnostic', targets: ['operating_margin','fcf_margin'], mechanism: 'Map source-backed signals to controllable levers.', fit: `${provider} finance transformation and data/AI diagnostic.`, impact: 'Conservative: 25-75 bps margin opportunity if waste confirmed.', timeline: '0-3 months', risks: 'Weak data ownership; assign metric owners.' },
  { name: 'Close and reporting automation', targets: ['close_cycle_days','forecast_accuracy'], mechanism: 'Standardize definitions and automate manual reporting.', fit: `${provider} finance transformation and cloud ERP.`, impact: 'Faster executive decisions; fewer reporting errors.', timeline: '0-3 months diagnostic, 3-12 months rollout', risks: 'System fragmentation; phased integration.' },
  { name: 'Cash-conversion improvement', targets: ['fcf_margin','working_capital_days'], mechanism: 'Improve billing, collections, and cash application.', fit: `${provider} order-to-cash automation.`, impact: 'Cash-cycle improvement if bottlenecks validated.', timeline: '3-12 months', risks: 'Contract complexity; segment redesign.' },
];
const markdown = ['## Section 6: Executive Proposal - Move The Metrics', '', `Audience: ${execType}`, `Industry: ${industry}`, `Service provider: ${provider}`, '', '### Top Trends / Pain Points', ...painPoints.map((p) => `- ${p}`), '', '### Initiatives', ...initiatives.map((item, i) => [`${i + 1}. ${item.name}`, `Targets: ${item.targets.join(', ')}`, `Mechanism: ${item.mechanism}`, `${provider} fit: ${item.fit}`, `Impact: ${item.impact}`, `Timeline: ${item.timeline}`, `Risks: ${item.risks}`].join('\n'))].join('\n\n');
state.executive_proposal = { generated_at: now, pain_points: painPoints, initiatives, markdown, source: 'enhanced_rule_based_v2' };
state.sections = state.sections || {};
state.sections.s6_proposal = markdown;
state.audit_log = state.audit_log || [];
state.audit_log.push({ timestamp: now, workflow_name: 'WF_PROPOSAL', status: 'OK', message: 'Executive proposal generated with live metrics and peer context.' });
return [{ json: state }];
