const prep = $('Prepare SEC Research URLs').first().json;
const submissions = $('Fetch SEC Submissions').first().json || {};
const facts = $('Fetch SEC Company Facts').first().json || {};
const state = prep.state;
const now = new Date().toISOString();
const recentFilings = (submissions.filings?.recent?.form || []).map((form, index) => ({
  form,
  filing_date: submissions.filings.recent.filingDate?.[index] || null,
  accession_number: submissions.filings.recent.accessionNumber?.[index] || null,
  report_date: submissions.filings.recent.reportDate?.[index] || null,
  primary_document: submissions.filings.recent.primaryDocument?.[index] || null,
  source_name: 'SEC EDGAR Submissions API',
  source_url: prep.urls.sec_submissions,
  source_date: now,
  confidence: 'HIGH'
})).filter((filing) => ['10-K', '10-Q', '8-K'].includes(filing.form)).slice(0, 40);
const usGaapAll = facts?.facts?.['us-gaap'] || {};
const supportedFactTags = [
  'RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet',
  'GrossProfit', 'OperatingIncomeLoss', 'NetIncomeLoss', 'ProfitLoss',
  'NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations',
  'PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets',
  'LongTermDebtAndFinanceLeaseObligationsNoncurrent', 'LongTermDebtNoncurrent', 'LongTermDebtAndFinanceLeaseObligationsCurrent',
  'AssetsCurrent', 'LiabilitiesCurrent', 'InterestExpenseNonOperating', 'InterestExpense',
  'EarningsPerShareDiluted', 'WeightedAverageNumberOfDilutedSharesOutstanding', 'WeightedAverageNumberOfSharesOutstandingDiluted',
  'DepreciationDepletionAndAmortization', 'DepreciationDepletionAndAmortizationExpense', 'DepreciationAndAmortization',
  'StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
  'Assets', 'Liabilities', 'CashAndCashEquivalentsAtCarryingValue', 'ShortTermBorrowings'
];
function compactFact(fact) {
  const compactUnits = {};
  for (const [unitName, rows] of Object.entries(fact.units || {})) {
    if (!Array.isArray(rows)) continue;
    const compactRows = rows
      .filter((row) => row && row.val !== undefined && ['10-K', '10-Q'].includes(row.form))
      .sort((a, b) => String(a.end || '').localeCompare(String(b.end || '')) || String(a.filed || '').localeCompare(String(b.filed || '')))
      .slice(-16)
      .map((row) => ({ end: row.end, val: row.val, fy: row.fy, fp: row.fp, form: row.form, filed: row.filed, frame: row.frame }));
    if (compactRows.length) compactUnits[unitName] = compactRows;
  }
  return { label: fact.label, description: fact.description, units: compactUnits };
}
const usGaapCompact = Object.fromEntries(supportedFactTags.filter((tag) => usGaapAll[tag]).map((tag) => [tag, compactFact(usGaapAll[tag])]).filter(([, fact]) => Object.keys(fact.units || {}).length));
const secFactsAvailable = Boolean(Object.keys(usGaapCompact).length);
state.entity = state.entity || {};
state.entity.fiscal_year_end = state.entity.fiscal_year_end || submissions.fiscalYearEnd || null;
state.entity.exchange = state.entity.exchange || submissions.exchanges?.[0] || null;
state.entity.ticker = state.entity.ticker || submissions.tickers?.[0] || prep.ticker || null;
state.entity.reporting_currency = state.entity.reporting_currency || 'USD';
state.research = state.research || {};
state.research.financials = {
  source_name: 'SEC EDGAR Company Facts XBRL',
  source_url: prep.urls.sec_company_facts,
  source_date: now,
  confidence: secFactsAvailable ? 'HIGH' : 'LOW',
  raw_us_gaap_facts: usGaapCompact,
  available_taxonomies: Object.keys(facts?.facts || {})
};
state.research.filings = {
  source_name: 'SEC EDGAR Submissions API',
  source_url: prep.urls.sec_submissions,
  source_date: now,
  confidence: recentFilings.length ? 'HIGH' : 'LOW',
  recent_filings: recentFilings
};
state.research.peer_jobs = {
  status: 'public_sources_only',
  primary_logic: 'Use founder override peers first; otherwise use DFA_Peer_Defaults/Claude peer selector. Pull peer financials from SEC EDGAR for US public peers. Do not require paid peer APIs.',
  target_metrics: ['revenue_growth_yoy', 'gross_margin', 'op_margin', 'fcf_margin', 'debt_to_equity', 'roic_when_inputs_exist'],
  confidence: 'PENDING_PEER_SEC_FETCH'
};
state.research.market_data_jobs = {
  status: 'free_public_sources_only',
  providers: ['SEC share counts', 'company IR pages', 'public market pages discovered via Serper/founder URLs'],
  requested_fields: ['shares_outstanding_from_SEC', 'market_price_if_public_source_available', 'market_cap_computed_if_price_and_shares_available'],
  rule: 'If public market price source is unavailable, market cap is N/A. Do not use paid market data APIs.',
  confidence: 'PENDING_PUBLIC_SOURCE'
};
state.research.news_event_jobs = {
  status: 'credential_required',
  providers: ['SEC recent filings', 'Serper'],
  sec_recent_filings_available: recentFilings.length,
  serper_queries: [
    `${state.entity?.legal_name || state.inputs?.company_name} earnings transcript 2024 2025`,
    `${state.entity?.legal_name || state.inputs?.company_name} restructuring acquisition CEO CFO 2024 2025`,
    `${state.entity?.legal_name || state.inputs?.company_name} investor relations press release 2025`
  ],
  confidence: recentFilings.length ? 'MEDIUM' : 'LOW'
};
state.research.source_status = {
  sec_submissions: recentFilings.length ? 'OK' : 'EMPTY_OR_FAILED',
  sec_company_facts: secFactsAvailable ? 'OK' : 'EMPTY_OR_FAILED',
  fmp: 'DISABLED_NO_PAID_APIS',
  polygon: 'DISABLED_NO_PAID_APIS',
  alpha_vantage: 'DISABLED_NO_PAID_APIS',
  serper: 'OPTIONAL_DISCOVERY_HELPER',
  company_ir_pages: 'PUBLIC_SOURCE_PRIORITY',
  sec_filing_html: 'PUBLIC_SOURCE_FALLBACK'
};
state.audit_log = state.audit_log || [];
state.audit_log.push({ timestamp: now, workflow_name: 'WF_RESEARCH_PUBLIC', status: secFactsAvailable ? 'OK' : 'WARN', message: secFactsAvailable ? 'SEC public research bundle built.' : 'SEC company facts unavailable; fallback provider required.' });
return [{ json: state }];