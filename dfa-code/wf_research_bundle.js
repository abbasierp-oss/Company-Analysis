const prep = $('Prepare SEC Research URLs').first().json;
const submissions = $('Fetch SEC Submissions').first().json || {};
const facts = $('Fetch SEC Company Facts').first().json || {};
const state = prep.state;
const now = new Date().toISOString();
const recentForms = submissions.filings?.recent?.form || [];
const recentFilings = recentForms.map((form, index) => ({
  form,
  filing_date: submissions.filings.recent.filingDate?.[index] || null,
  accession_number: submissions.filings.recent.accessionNumber?.[index] || null,
  report_date: submissions.filings.recent.reportDate?.[index] || null,
  primary_document: submissions.filings.recent.primaryDocument?.[index] || null,
  source_name: 'SEC EDGAR Submissions API',
  source_url: prep.urls.sec_submissions,
  source_date: now,
  confidence: 'HIGH',
})).filter((filing) => isSupportedForm(filing.form)).slice(0, 40);

const usGaapAll = facts?.facts?.['us-gaap'] || {};
const ifrsAll = facts?.facts?.['ifrs-full'] || {};
const deiAll = facts?.facts?.dei || {};
const usGaapCompact = compactFactsFromTaxonomy(usGaapAll, 'us-gaap');
const ifrsCompact = compactFactsFromTaxonomy(ifrsAll, 'ifrs-full');
const mergedFacts = mergeCompactFacts(usGaapCompact, ifrsCompact);
const nativeCurrency = detectNativeCurrency(usGaapAll, ifrsAll);
const issuerProfile = detectIssuerProfile(recentForms.slice(0, 40));
const secFactsAvailable = Boolean(Object.keys(mergedFacts).length);

let fxToUsd = { rate: 1, as_of: now.slice(0, 10), source_name: 'N/A (USD reporter)', to_currency: 'USD', from_currency: 'USD' };
if (nativeCurrency !== 'USD') {
  fxToUsd = await fetchFxToUsd.call(this, nativeCurrency);
}

state.entity = state.entity || {};
state.entity.fiscal_year_end = state.entity.fiscal_year_end || submissions.fiscalYearEnd || null;
state.entity.exchange = state.entity.exchange || submissions.exchanges?.[0] || null;
state.entity.ticker = state.entity.ticker || submissions.tickers?.[0] || prep.ticker || null;
state.entity.native_reporting_currency = nativeCurrency;
state.entity.reporting_currency = 'USD';
state.entity.issuer_profile = issuerProfile;
state.entity.is_foreign_issuer = issuerProfile.type === 'foreign_private_issuer';
state.entity.confidence = entityConfidence(state.entity, state.normalized);

state.research = state.research || {};
state.research.financials = {
  source_name: 'SEC EDGAR Company Facts XBRL (US-GAAP + IFRS)',
  source_url: prep.urls.sec_company_facts,
  source_date: now,
  confidence: secFactsAvailable ? (issuerProfile.type === 'foreign_private_issuer' ? 'MEDIUM' : 'HIGH') : 'LOW',
  native_currency: nativeCurrency,
  fx_to_usd: fxToUsd,
  raw_us_gaap_facts: usGaapCompact,
  raw_ifrs_facts: ifrsCompact,
  merged_facts: mergedFacts,
  raw_dei_facts: deiAll,
  available_taxonomies: Object.keys(facts?.facts || {}),
  issuer_profile: issuerProfile,
};
state.research.filings = {
  source_name: 'SEC EDGAR Submissions API',
  source_url: prep.urls.sec_submissions,
  source_date: now,
  confidence: recentFilings.length ? 'HIGH' : 'LOW',
  recent_filings: recentFilings,
  issuer_profile: issuerProfile,
};
state.research.filing_anchors = resolveFilingAnchors(recentFilings, issuerProfile);
state.research.peer_jobs = {
  status: 'public_sources_only',
  primary_logic: 'Use founder override peers first; otherwise industry defaults. Pull peer financials from SEC EDGAR for US public peers.',
  target_metrics: ['revenue_growth_yoy', 'gross_margin', 'op_margin', 'fcf_margin', 'debt_to_equity', 'roic_when_inputs_exist'],
  confidence: 'PENDING_PEER_SEC_FETCH',
};
state.research.market_data_jobs = {
  status: 'free_public_sources_only',
  providers: ['SEC/DEI share counts', 'Yahoo Finance price', 'Yahoo shares fallback for stale SEC'],
  requested_fields: ['shares_outstanding', 'market_price', 'market_cap_computed'],
  confidence: 'PENDING_PUBLIC_SOURCE',
};
state.research.news_event_jobs = {
  status: 'credential_required',
  providers: ['SEC recent filings (10-K/10-Q/20-F/6-K)', 'Serper'],
  sec_recent_filings_available: recentFilings.length,
  serper_queries: [
    `${state.entity?.legal_name || state.inputs?.company_name} earnings transcript 2024 2025`,
    `${state.entity?.legal_name || state.inputs?.company_name} restructuring acquisition CEO CFO 2024 2025`,
    `${state.entity?.legal_name || state.inputs?.company_name} investor relations press release 2025`,
  ],
  confidence: recentFilings.length ? 'MEDIUM' : 'LOW',
};
state.research.source_status = {
  sec_submissions: recentFilings.length ? 'OK' : 'EMPTY_OR_FAILED',
  sec_company_facts: secFactsAvailable ? 'OK' : 'EMPTY_OR_FAILED',
  ifrs_taxonomy: Object.keys(ifrsCompact).length ? 'OK' : 'N/A',
  fx_conversion: fxToUsd?.rate ? 'OK' : (nativeCurrency === 'USD' ? 'N/A' : 'FAILED'),
  serper: 'OPTIONAL_DISCOVERY_HELPER',
};
state.audit_log = state.audit_log || [];
state.audit_log.push({
  timestamp: now,
  workflow_name: 'WF_RESEARCH_PUBLIC',
  status: secFactsAvailable ? 'OK' : 'WARN',
  message: secFactsAvailable
    ? `SEC bundle built (${issuerProfile.description}). Native currency ${nativeCurrency}; FX ${fxToUsd?.rate || 'N/A'}.`
    : 'SEC company facts unavailable.',
});
return [{ json: state }];
