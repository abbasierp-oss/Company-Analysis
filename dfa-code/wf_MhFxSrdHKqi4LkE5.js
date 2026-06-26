const state = items[0]?.json?.state || items[0]?.json || {};
const now = new Date().toISOString();
const research = state.research || {};
const usGaap = research.financials?.raw_us_gaap_facts || {};
state.normalized = state.normalized || { periods: [], metrics: {}, gaps: [], reliability_map: {}, formulas: {} };
state.normalized.metrics = state.normalized.metrics || {};
state.normalized.gaps = state.normalized.gaps || [];
function sourceUrl() { return research.financials?.source_url || ''; }
function factCandidates(names) {
  for (const name of names) {
    const fact = usGaap[name];
    if (!fact?.units) continue;
    const units = fact.units.USD || fact.units.shares || fact.units['USD/shares'] || Object.values(fact.units)[0] || [];
    if (Array.isArray(units) && units.length) return { tag: name, units };
  }
  return null;
}
function annualSeries(metricName, names, unit = 'USD') {
  const candidate = factCandidates(names);
  if (!candidate) {
    addGap(metricName, `No supported SEC XBRL tag found. Tried: ${names.join(', ')}`);
    return [];
  }
  const byEnd = candidate.units
    .filter((row) => row.val !== undefined && row.form === '10-K')
    .reduce((map, row) => {
      const key = row.end || `${row.fy}-${row.fp}-${row.frame || ''}`;
      const existing = map.get(key);
      if (!existing || String(row.filed || '') > String(existing.filed || '')) map.set(key, row);
      return map;
    }, new Map());
  const series = Array.from(byEnd.values())
    .map((row) => ({
      value: row.val,
      unit,
      period: row.frame || (row.fy ? `FY${row.fy}` : row.end),
      fiscal_label: row.fp || 'FY',
      source_name: `SEC EDGAR Company Facts:${candidate.tag}`,
      source_url: sourceUrl(),
      source_date: row.filed || now,
      source_section: row.form || 'companyfacts',
      confidence: 'HIGH',
      notes: row.end || row.frame || '',
      is_estimate: false
    }))
    .sort((a, b) => String(a.notes || a.period).localeCompare(String(b.notes || b.period)))
    .slice(-5);
  if (!series.length) addGap(metricName, `SEC tag ${candidate.tag} exists but has no annual 10-K values.`);
  return series;
}
function addGap(metric, reason) {
  if (!state.normalized.gaps.some((gap) => gap.metric === metric && gap.reason === reason)) {
    state.normalized.gaps.push({ metric, reason, source: 'WF_NORMALIZE', timestamp: now });
  }
}
function latest(series) { return Array.isArray(series) ? series[series.length - 1] : null; }
function computedValue(metric, value, unit, sources, notes) {
  return {
    value,
    unit,
    period: sources[0]?.period || 'latest',
    fiscal_label: sources[0]?.fiscal_label || '',
    source_name: sources.map((s) => s.source_name).join(' + '),
    source_url: sources.map((s) => s.source_url).filter(Boolean).join(' | '),
    source_date: sources.map((s) => s.source_date).filter(Boolean).sort().slice(-1)[0] || now,
    source_section: 'computed',
    confidence: sources.every((s) => s.confidence === 'HIGH') ? 'HIGH' : 'MEDIUM',
    notes,
    is_estimate: sources.some((s) => s.is_estimate)
  };
}
const canonical = {
  revenue: annualSeries('revenue', ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet']),
  gross_profit: annualSeries('gross_profit', ['GrossProfit']),
  operating_income: annualSeries('operating_income', ['OperatingIncomeLoss']),
  net_income: annualSeries('net_income', ['NetIncomeLoss', 'ProfitLoss']),
  operating_cash_flow: annualSeries('operating_cash_flow', ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations']),
  capex: annualSeries('capex', ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets']),
  long_term_debt: annualSeries('long_term_debt', ['LongTermDebtAndFinanceLeaseObligationsNoncurrent', 'LongTermDebtNoncurrent', 'LongTermDebtAndFinanceLeaseObligationsCurrent']),
  current_assets: annualSeries('current_assets', ['AssetsCurrent']),
  current_liabilities: annualSeries('current_liabilities', ['LiabilitiesCurrent']),
  interest_expense: annualSeries('interest_expense', ['InterestExpenseNonOperating', 'InterestExpense']),
  diluted_eps: annualSeries('diluted_eps', ['EarningsPerShareDiluted'], 'USD/share'),
  diluted_shares: annualSeries('diluted_shares', ['WeightedAverageNumberOfDilutedSharesOutstanding', 'WeightedAverageNumberOfSharesOutstandingDiluted'], 'shares')
};
const lRevenue = latest(canonical.revenue);
const lOpIncome = latest(canonical.operating_income);
const lOcf = latest(canonical.operating_cash_flow);
const lCapex = latest(canonical.capex);
const lGrossProfit = latest(canonical.gross_profit);
const lNetIncome = latest(canonical.net_income);
const lCurrentAssets = latest(canonical.current_assets);
const lCurrentLiabilities = latest(canonical.current_liabilities);
if (lOcf && lCapex) canonical.free_cash_flow = [computedValue('free_cash_flow', lOcf.value - lCapex.value, 'USD', [lOcf, lCapex], 'Computed as operating cash flow minus capex.')];
else addGap('free_cash_flow', 'Requires operating cash flow and capex.');
if (lRevenue && lOpIncome && lRevenue.value) canonical.operating_margin = [computedValue('operating_margin', lOpIncome.value / lRevenue.value, 'ratio', [lOpIncome, lRevenue], 'Computed as operating income divided by revenue.')];
else addGap('operating_margin', 'Requires revenue and operating income.');
if (lRevenue && lGrossProfit && lRevenue.value) canonical.gross_margin = [computedValue('gross_margin', lGrossProfit.value / lRevenue.value, 'ratio', [lGrossProfit, lRevenue], 'Computed as gross profit divided by revenue.')];
else addGap('gross_margin', 'Requires revenue and gross profit.');
if (lRevenue && lNetIncome && lRevenue.value) canonical.net_margin = [computedValue('net_margin', lNetIncome.value / lRevenue.value, 'ratio', [lNetIncome, lRevenue], 'Computed as net income divided by revenue.')];
else addGap('net_margin', 'Requires revenue and net income.');
if (lCurrentAssets && lCurrentLiabilities && lCurrentLiabilities.value) canonical.current_ratio = [computedValue('current_ratio', lCurrentAssets.value / lCurrentLiabilities.value, 'ratio', [lCurrentAssets, lCurrentLiabilities], 'Computed as current assets divided by current liabilities.')];
else addGap('current_ratio', 'Requires current assets and current liabilities.');
state.normalized.metrics = { ...state.normalized.metrics, ...canonical };
state.normalized.periods = [...new Set(Object.values(state.normalized.metrics).flat().filter(Boolean).map((m) => m.period))].sort();
state.normalized.formulas = {
  fcf: 'Cash from operations - capital expenditures',
  operating_margin: 'Operating income / revenue',
  gross_margin: 'Gross profit / revenue',
  net_margin: 'Net income / revenue',
  fcf_margin: 'Free cash flow / revenue',
  current_ratio: 'Current assets / current liabilities',
  interest_coverage: 'EBIT / interest expense',
  roce: 'EBIT / capital employed'
};
state.normalized.reliability_map = {
  public_company_xbrl: research.financials?.confidence || 'N/A',
  filings: research.filings?.confidence || 'N/A',
  peer_metrics: research.peer_jobs?.confidence || 'PENDING',
  market_data: research.market_data_jobs?.confidence || 'PENDING',
  news_events: research.news_event_jobs?.confidence || 'PENDING',
  default_rules: {
    'public+edgar+recent': 'HIGH',
    'public+third_party_api': 'MEDIUM',
    'private+press_release': 'LOW',
    'private+estimate': 'VERY_LOW'
  }
};
state.normalized.source_coverage = {
  metrics_with_values: Object.entries(state.normalized.metrics).filter(([, v]) => Array.isArray(v) && v.length).length,
  gap_count: state.normalized.gaps.length,
  sources_used: [...new Set(Object.values(state.normalized.metrics).flat().filter(Boolean).map((m) => m.source_name))]
};
state.audit_log = state.audit_log || [];
state.audit_log.push({ timestamp: now, workflow_name: 'WF_NORMALIZE', status: 'OK', message: `Normalized ${state.normalized.source_coverage.metrics_with_values} metric groups with ${state.normalized.gaps.length} gaps.` });
return [{ json: state }];