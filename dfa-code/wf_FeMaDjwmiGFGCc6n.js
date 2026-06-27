const input = $('Subworkflow Input').first().json || {};
const state = input.state || input;
const directory = items[0]?.json || {};
const rows = Array.isArray(directory) ? directory : Object.values(directory);
const now = new Date().toISOString();
const companyName = state.inputs?.company_name || input.company_name || '';
const tickerInput = state.inputs?.ticker || input.ticker || '';
const { best, cik, ranked } = resolveCikFromDirectory(directory, companyName, tickerInput);
state.entity = {
  legal_name: best?.title || companyName || null,
  ticker: best?.ticker || tickerInput || null,
  cik,
  exchange: null,
  fiscal_year_end: null,
  native_reporting_currency: null,
  reporting_currency: null,
  is_public: Boolean(cik),
  is_foreign_issuer: false,
  issuer_profile: null,
  confidence: cik && ranked[0]?.score >= 80 ? 'MEDIUM' : (cik ? 'LOW' : 'LOW'),
  sources: [{ source_name: 'SEC Company Tickers Directory', source_url: 'https://www.sec.gov/files/company_tickers.json', source_date: now, confidence: cik ? 'HIGH' : 'LOW' }],
};
state.agent_status = state.agent_status || {};
state.agent_status.entity = cik ? 'resolved_public_company' : 'private_or_unresolved_public_company';
state.audit_log = state.audit_log || [];
state.audit_log.push({
  timestamp: now,
  workflow_name: 'WF_ENTITY',
  status: cik ? 'OK' : 'WARN',
  message: cik ? `Resolved ${state.entity.legal_name} with CIK ${cik}.` : 'No SEC public-company match; route to private/public-web research.',
});
return [{ json: state }];
