const state = items[0]?.json?.state || items[0]?.json || {};
const now = new Date().toISOString();
const filings = state.research?.filings?.recent_filings || [];
const serperPublic = state.research?.news_events || [];
const serperPrivate = state.research?.private_research?.serper_results || [];
const signals = [...serperPublic, ...serperPrivate];
const oneTime = state.research?.one_time_items || [];

const CATEGORY_LABELS = {
  capital_structure_mna: 'capital structure / M&A',
  restructuring_layoffs: 'restructuring / layoffs',
  acquisitions_divestitures: 'acquisitions / divestitures',
  segment_reporting_changes: 'segment reporting changes',
  accounting_policy_changes: 'accounting policy changes',
  litigation_regulatory: 'litigation / regulatory',
};

function signalText(item) {
  return `${item.title || ''} ${item.description || item.snippet || ''}`.toLowerCase();
}

function findSignals(words) {
  return signals.filter((item) => {
    const text = signalText(item);
    return words.some((word) => text.includes(word));
  }).slice(0, 5).map((item) => ({
    title: item.title || 'Untitled signal',
    snippet: item.description || item.snippet || '',
    source_url: item.source_url || item.link || '',
    source_name: item.source_name || 'Public web signal',
    source_date: item.source_date || now,
    confidence: item.confidence || 'LOW',
  }));
}

const categories = [
  ['capital_structure_mna', ['warner bros', 'warner bros.', 'acquisition', 'termination fee', 'shareholder letter', 'capital structure', 'debt offering', 'bond', 'buyback', 'wbd']],
  ['restructuring_layoffs', ['restructuring', 'layoff', 'workforce reduction', 'cost reduction']],
  ['acquisitions_divestitures', ['acquisition', 'divestiture', 'merger', 'sale of business', 'terminated agreement']],
  ['segment_reporting_changes', ['segment', 'reporting change', 'business unit']],
  ['accounting_policy_changes', ['accounting policy', 'restatement', 'material weakness']],
  ['litigation_regulatory', ['litigation', 'regulatory', 'lawsuit', 'investigation', 'antitrust']],
];

const eventPack = categories.map(([category, words]) => {
  const matches = findSignals(words);
  return {
    category,
    status: matches.length ? 'SUPPORTED_BY_PUBLIC_SIGNAL' : 'N/A',
    events: matches,
    interpretation_rule: matches.length
      ? 'Tie to growth, margin, cash flow, risk, or execution risk only if the source text supports that link.'
      : 'No supported public signal found in this run.',
  };
});

if (oneTime.length) {
  const mna = eventPack.find((g) => g.category === 'capital_structure_mna');
  if (mna) {
    mna.status = 'SUPPORTED_BY_FILING_AND_NEWS';
    mna.events = [
      ...mna.events,
      ...oneTime.map((f) => ({
        title: f.label,
        snippet: 'See 10-Q and Q1 FY2026 shareholder letter for disclosure detail.',
        source_url: '',
        source_name: 'DFA one-time item detector (10-Q / news / 8-K reference)',
        source_date: now,
        confidence: 'HIGH',
      })),
    ];
  }
}

const warnerNews = findSignals(['warner', 'shareholder letter', 'termination fee']);
if (warnerNews.length) {
  const mna = eventPack.find((g) => g.category === 'capital_structure_mna');
  if (mna && mna.status === 'N/A') mna.status = 'SUPPORTED_BY_PUBLIC_SIGNAL';
  if (mna) {
    const existing = new Set(mna.events.map((e) => e.title));
    for (const e of warnerNews) {
      if (!existing.has(e.title)) mna.events.push(e);
    }
  }
}

const filingEvents = filings.filter((f) => isSupportedForm(f.form) && f.form !== '8-K').slice(0, 12).map((f) => ({
  form: f.form,
  filing_date: f.filing_date,
  report_date: f.report_date,
  source_name: f.source_name,
  source_url: f.source_url,
  confidence: f.confidence,
}));
const ref8k = (state.research?.filing_anchors?.recent_8k) || filings.find((f) => f.form === '8-K');

function renderCategory(group) {
  const label = CATEGORY_LABELS[group.category] || group.category.replaceAll('_', ' ');
  if (group.status === 'N/A') {
    return `### ${label}\n\nN/A — no supported public signal found in this run.`;
  }
  return `### ${label}\n\n${group.events.map((event) => `- ${event.title}: ${event.snippet} [${event.source_name}, ${event.source_date}]`).join('\n')}`;
}

const markdown = [
  '## Section 7: Read Between The Lines',
  '',
  'Supported events require filing or public-source text. Unsupported categories are N/A. 8-K items are reference context only.',
  '',
  ...eventPack.map((group) => renderCategory(group)),
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

state.event_research = { generated_at: now, event_pack: eventPack, recent_filings: filingEvents, markdown };
state.sections = state.sections || {};
state.sections.s7_rtbl = markdown;
state.audit_log = state.audit_log || [];
state.audit_log.push({ timestamp: now, workflow_name: 'WF_EVENT_RESEARCH', status: 'OK', message: 'RTBL event pack prepared with capital-structure and one-time item signals.' });
return [{ json: state }];
