const state = items[0]?.json?.state || items[0]?.json || {};
const now = new Date().toISOString();
const filings = state.research?.filings?.recent_filings || [];
const serperPublic = state.research?.news_events || [];
const serperPrivate = state.research?.private_research?.serper_results || [];
const signals = [...serperPublic, ...serperPrivate];
const oneTime = state.research?.one_time_items || [];
const company = state.entity?.legal_name || state.inputs?.company_name || 'The company';

function buildCapitalStructureBullets() {
  const bullets = [];
  if (oneTime.some((f) => f.id === 'warner_bros_termination_fee')) {
    bullets.push(`${company} disclosed the Warner Bros. termination fee in Q1 FY2026, which materially affected interest and other income.`);
  }
  return bullets;
}

const capitalBullets = buildCapitalStructureBullets();
const leadershipBullet = detectLeadershipBullet(state, signals);
const filingEvents = filings.filter((f) => isSupportedForm(f.form) && f.form !== '8-K').slice(0, 12).map((f) => ({
  form: f.form,
  filing_date: f.filing_date,
  report_date: f.report_date,
  source_name: f.source_name,
  source_url: f.source_url,
  confidence: f.confidence,
}));
const ref8k = (state.research?.filing_anchors?.recent_8k) || filings.find((f) => f.form === '8-K');

const parts = [
  '## Section 7: Read Between The Lines',
  '',
  'Supported events require filing or public-source text. 8-K items are reference context only.',
];

if (capitalBullets.length) {
  parts.push('', '### Capital structure / M&A', '', ...capitalBullets.map((b) => `- ${b}`));
}
if (leadershipBullet) {
  parts.push('', '### Leadership changes', '', leadershipBullet);
}
if (filingEvents.length) {
  parts.push(
    '',
    '### Recent operating filing context (financial anchors)',
    '',
    ...filingEvents.map((f) => `- ${f.form} filed ${f.filing_date || naReason('filing date not recorded')} for report date ${f.report_date || naReason('report period not recorded')} (${f.source_name})`),
  );
}
if (ref8k) {
  parts.push('', `Recent 8-K reference (not a financial anchor): ${ref8k.form} filed ${ref8k.filing_date || naReason('8-K filing date not recorded')}.`);
}

const markdown = parts.join('\n');

state.org_cxo_intel = buildOrgCxoIntel(state);
state.event_research = { generated_at: now, capital_structure_bullets: capitalBullets, leadership_bullet: leadershipBullet, recent_filings: filingEvents, org_cxo_intel: state.org_cxo_intel, markdown };
state.sections = state.sections || {};
state.sections.s7_rtbl = markdown;
state.audit_log = state.audit_log || [];
state.audit_log.push({ timestamp: now, workflow_name: 'WF_EVENT_RESEARCH', status: 'OK', message: 'RTBL section prepared with available signals only.' });
return [{ json: state }];
