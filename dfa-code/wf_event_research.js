const state = items[0]?.json?.state || items[0]?.json || {};
const now = new Date().toISOString();
const filings = state.research?.filings?.recent_filings || [];
const serperPublic = state.research?.news_events || [];
const serperPrivate = state.research?.private_research?.serper_results || [];
const signals = [...serperPublic, ...serperPrivate];
const categories = [
  ['restructuring_layoffs', ['restructuring','layoff','workforce reduction','cost reduction']],
  ['acquisitions_divestitures', ['acquisition','divestiture','merger','sale of business']],
  ['leadership_changes', ['ceo','cfo','chief executive','chief financial','leadership transition']],
  ['segment_reporting_changes', ['segment','reporting change','business unit']],
  ['accounting_policy_changes', ['accounting policy','restatement','material weakness']],
  ['litigation_regulatory', ['litigation','regulatory','lawsuit','investigation','antitrust']]
];
function findSignals(words) {
  return signals.filter((item) => {
    const text = `${item.title || ''} ${item.snippet || ''}`.toLowerCase();
    return words.some((word) => text.includes(word));
  }).slice(0, 5).map((item) => ({ title: item.title || 'Untitled signal', snippet: item.snippet || '', source_url: item.source_url || item.link || '', source_name: item.source_name || 'Public web signal', source_date: item.source_date || now, confidence: item.confidence || 'LOW' }));
}
const eventPack = categories.map(([category, words]) => {
  const matches = findSignals(words);
  return { category, status: matches.length ? 'SUPPORTED_BY_PUBLIC_SIGNAL' : 'N/A', events: matches, interpretation_rule: matches.length ? 'Tie to growth, margin, cash flow, risk, or execution risk only if the source text supports that link.' : 'No supported public signal found in this run.' };
});
const filingEvents = filings.filter((f) => isSupportedForm(f.form)).slice(0, 12).map((f) => ({ form: f.form, filing_date: f.filing_date, report_date: f.report_date, source_name: f.source_name, source_url: f.source_url, confidence: f.confidence }));
const markdown = ['## Section 7: Read Between The Lines', '', 'This section only treats events as supported when filings or public-source signals exist. Unsupported categories are marked N/A.', '', ...eventPack.map((group) => [`### ${group.category.replaceAll('_',' ')}`, group.status === 'N/A' ? 'N/A - no supported public signal found.' : group.events.map((event) => `- ${event.title}: ${event.snippet} [${event.source_name}, ${event.source_date}]`).join('\n')].join('\n')), '', 'Recent filing context:', ...(filingEvents.length ? filingEvents.map((f) => `- ${f.form} filed ${f.filing_date || 'N/A'} for report date ${f.report_date || 'N/A'} (${f.source_name})`) : ['- N/A - no recent filing list available.'])].join('\n\n');
state.event_research = { generated_at: now, event_pack: eventPack, recent_filings: filingEvents, markdown };
state.sections = state.sections || {};
state.sections.s7_rtbl = markdown;
state.audit_log = state.audit_log || [];
state.audit_log.push({ timestamp: now, workflow_name: 'WF_EVENT_RESEARCH', status: 'OK', message: 'Read-between-lines event pack prepared with supported/N/A categories.' });
return [{ json: state }];