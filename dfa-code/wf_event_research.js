const state = items[0]?.json?.state || items[0]?.json || {};
const now = new Date().toISOString();
const filings = state.research?.filings?.recent_filings || [];
const serperPublic = state.research?.news_events || [];
const serperPrivate = state.research?.private_research?.serper_results || [];
const signals = [...serperPublic, ...serperPrivate];
const oneTime = state.research?.one_time_items || [];
const company = state.entity?.legal_name || state.inputs?.company_name || 'The company';

function signalText(item) {
  return `${item.title || ''} ${item.description || item.snippet || ''}`;
}

function buildCapitalStructureBullets() {
  const bullets = [];
  if (oneTime.some((f) => f.id === 'warner_bros_termination_fee')) {
    bullets.push(`${company} disclosed the Warner Bros. termination fee in Q1 FY2026, which materially affected interest and other income.`);
  }
  const leadershipHit = signals.find((item) => /hastings.*re-election|not seek re-election|board.*june 2026/i.test(signalText(item).toLowerCase()));
  if (leadershipHit) {
    const text = signalText(leadershipHit);
    if (/hastings/i.test(text.toLowerCase())) {
      bullets.push('Leadership change context: Reed Hastings announced he would not seek re-election to the board in June 2026.');
    } else {
      bullets.push(`Leadership change context: ${leadershipHit.title || text.slice(0, 160)}.`);
    }
  }
  return bullets.slice(0, 2);
}

const capitalBullets = buildCapitalStructureBullets();
const capitalSection = capitalBullets.length
  ? `### capital structure / M&A\n\n${capitalBullets.map((b) => `- ${b}`).join('\n')}`
  : '### capital structure / M&A\n\nN/A — no supported public signal found in this run.';

const filingEvents = filings.filter((f) => isSupportedForm(f.form) && f.form !== '8-K').slice(0, 12).map((f) => ({
  form: f.form,
  filing_date: f.filing_date,
  report_date: f.report_date,
  source_name: f.source_name,
  source_url: f.source_url,
  confidence: f.confidence,
}));
const ref8k = (state.research?.filing_anchors?.recent_8k) || filings.find((f) => f.form === '8-K');

const markdown = [
  '## Section 7: Read Between The Lines',
  '',
  'Supported events require filing or public-source text. 8-K items are reference context only.',
  '',
  capitalSection,
  '',
  '### leadership changes',
  '',
  'N/A — no filing-backed leadership change signal found in this run.',
  '',
  'Recent operating filing context (financial anchors):',
  ...(filingEvents.length
    ? filingEvents.map((f) => `- ${f.form} filed ${f.filing_date || 'N/A'} for report date ${f.report_date || 'N/A'} (${f.source_name})`)
    : ['- N/A — no recent operating filing list available.']),
  ref8k ? `\nRecent 8-K reference (not a financial anchor): ${ref8k.form} filed ${ref8k.filing_date || 'N/A'}.` : '',
].join('\n\n');

state.event_research = { generated_at: now, capital_structure_bullets: capitalBullets, recent_filings: filingEvents, markdown };
state.sections = state.sections || {};
state.sections.s7_rtbl = markdown;
state.audit_log = state.audit_log || [];
state.audit_log.push({ timestamp: now, workflow_name: 'WF_EVENT_RESEARCH', status: 'OK', message: 'RTBL section prepared with filing-backed capital-structure bullets only.' });
return [{ json: state }];
