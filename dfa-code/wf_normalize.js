const state = items[0]?.json?.state || items[0]?.json || {};
const now = new Date().toISOString();
const research = state.research || {};
const facts = research.financials?.merged_facts || research.financials?.raw_us_gaap_facts || {};
const fx = research.financials?.fx_to_usd || { rate: 1, from_currency: research.financials?.native_currency || 'USD' };
const nativeCurrency = research.financials?.native_currency || 'USD';

state.normalized = state.normalized || { periods: [], metrics: {}, gaps: [], reliability_map: {}, formulas: {} };
state.normalized.metrics = state.normalized.metrics || {};
state.normalized.gaps = state.normalized.gaps || [];

function sourceUrl() { return research.financials?.source_url || ''; }

function factCandidates(metricKey) {
  const found = tagRowsMerged(facts, metricKey);
  if (!found.rows.length) return null;
  const unitName = Object.keys(facts[found.tag]?.units || {}).find((u) => facts[found.tag].units[u]?.length) || nativeCurrency;
  return { tag: found.tag, taxonomy: found.taxonomy, unitName, rows: found.rows };
}

function annualSeries(metricName, metricKey) {
  const candidate = factCandidates(metricKey);
  if (!candidate) {
    addGap(metricName, `No supported SEC XBRL tag found. Tried: ${(METRIC_TAG_MAP[metricKey] || []).join(', ')}`);
    return [];
  }
  const byFy = candidate.rows
    .filter((row) => row.val !== undefined && isAnnualForm(row.form) && (row.fp === 'FY' || row.form === '10-K' || !row.fp))
    .reduce((map, row) => {
      const key = String(row.fy || row.end || row.filed);
      const existing = map.get(key);
      if (!existing) map.set(key, row);
      else if (String(row.filed || '') > String(existing.filed || '')) map.set(key, row);
      else if (String(row.filed || '') === String(existing.filed || '') && metricName === 'revenue' && Number(row.val) > Number(existing.val)) map.set(key, row);
      return map;
    }, new Map());
  const series = Array.from(byFy.values())
    .map((row) => {
      const nativeVal = Number(row.val);
      const usdVal = convertToUsd(nativeVal, candidate.unitName, fx);
      return {
        value: usdVal !== null ? usdVal : nativeVal,
        native_value: nativeVal,
        unit: usdVal !== null ? 'USD' : candidate.unitName,
        native_unit: candidate.unitName,
        period: row.frame || (row.fy ? `FY${row.fy}` : row.end),
        fiscal_label: row.fp || 'FY',
        source_name: `SEC EDGAR ${candidate.taxonomy}:${candidate.tag}`,
        source_url: sourceUrl(),
        source_date: row.filed || now,
        source_section: row.form || 'companyfacts',
        confidence: candidate.taxonomy === 'ifrs-full' ? 'MEDIUM' : 'HIGH',
        notes: fx?.rate && candidate.unitName !== 'USD' ? `Converted from ${candidate.unitName} at ${fx.rate} (${fx.as_of})` : (row.end || ''),
        is_estimate: false,
      };
    })
    .sort((a, b) => String(a.period).localeCompare(String(b.period)))
    .slice(-6);
  if (!series.length) addGap(metricName, `SEC tag ${candidate.tag} exists but has no annual values on ${SEC_ANNUAL_FORMS.join('/')}.`);
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
    is_estimate: sources.some((s) => s.is_estimate),
  };
}

const canonical = {
  revenue: annualSeries('revenue', 'revenue'),
  gross_profit: annualSeries('gross_profit', 'gross_profit'),
  operating_income: annualSeries('operating_income', 'operating_income'),
  net_income: annualSeries('net_income', 'net_income'),
  operating_cash_flow: annualSeries('operating_cash_flow', 'operating_cash_flow'),
  capex: annualSeries('capex', 'capex'),
  long_term_debt: annualSeries('long_term_debt', 'long_term_debt'),
  current_assets: annualSeries('current_assets', 'current_assets'),
  current_liabilities: annualSeries('current_liabilities', 'current_liabilities'),
  interest_expense: annualSeries('interest_expense', 'interest_expense'),
  diluted_eps: annualSeries('diluted_eps', 'diluted_eps'),
  diluted_shares: annualSeries('diluted_shares', 'diluted_shares'),
};

const lRevenue = latest(canonical.revenue);
const lOpIncome = latest(canonical.operating_income);
const lOcf = latest(canonical.operating_cash_flow);
const lCapex = latest(canonical.capex);
const lGrossProfit = latest(canonical.gross_profit);
const lNetIncome = latest(canonical.net_income);
const lCurrentAssets = latest(canonical.current_assets);
const lCurrentLiabilities = latest(canonical.current_liabilities);

if (lOcf && lCapex) canonical.free_cash_flow = [computedValue('free_cash_flow', lOcf.value - lCapex.value, 'USD', [lOcf, lCapex], 'Operating cash flow minus capex.')];
else addGap('free_cash_flow', 'Requires operating cash flow and capex.');
if (lRevenue && lOpIncome && lRevenue.value) canonical.operating_margin = [computedValue('operating_margin', lOpIncome.value / lRevenue.value, 'ratio', [lOpIncome, lRevenue], 'Operating income / revenue.')];
else addGap('operating_margin', 'Requires revenue and operating income.');
if (lRevenue && lGrossProfit && lRevenue.value) canonical.gross_margin = [computedValue('gross_margin', lGrossProfit.value / lRevenue.value, 'ratio', [lGrossProfit, lRevenue], 'Gross profit / revenue.')];
else addGap('gross_margin', 'Requires revenue and gross profit.');
if (lRevenue && lNetIncome && lRevenue.value) canonical.net_margin = [computedValue('net_margin', lNetIncome.value / lRevenue.value, 'ratio', [lNetIncome, lRevenue], 'Net income / revenue.')];
else addGap('net_margin', 'Requires revenue and net income.');
if (lCurrentAssets && lCurrentLiabilities && lCurrentLiabilities.value) canonical.current_ratio = [computedValue('current_ratio', lCurrentAssets.value / lCurrentLiabilities.value, 'ratio', [lCurrentAssets, lCurrentLiabilities], 'Current assets / current liabilities.')];
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
  roce: 'EBIT / capital employed',
  fx_note: nativeCurrency !== 'USD' ? `Monetary series converted to USD using ${fx.source_name || 'FX'} rate ${fx.rate} as of ${fx.as_of}` : 'Native USD reporter',
};
state.normalized.reliability_map = {
  public_company_xbrl: research.financials?.confidence || 'N/A',
  issuer_profile: state.entity?.issuer_profile?.type || 'unknown',
  native_currency: nativeCurrency,
  fx_conversion: fx?.rate ? 'OK' : (nativeCurrency === 'USD' ? 'N/A' : 'FAILED'),
  filings: research.filings?.confidence || 'N/A',
  peer_metrics: research.peer_jobs?.confidence || 'PENDING',
  market_data: research.market_data_jobs?.confidence || 'PENDING',
  news_events: research.news_event_jobs?.confidence || 'PENDING',
};
state.normalized.source_coverage = {
  metrics_with_values: Object.entries(state.normalized.metrics).filter(([, v]) => Array.isArray(v) && v.length).length,
  gap_count: state.normalized.gaps.length,
  sources_used: [...new Set(Object.values(state.normalized.metrics).flat().filter(Boolean).map((m) => m.source_name))],
};
state.entity.confidence = entityConfidence(state.entity, state.normalized);
state.audit_log = state.audit_log || [];
state.audit_log.push({
  timestamp: now,
  workflow_name: 'WF_NORMALIZE',
  status: 'OK',
  message: `Normalized ${state.normalized.source_coverage.metrics_with_values} metric groups (${nativeCurrency}${fx?.rate ? `→USD@${fx.rate}` : ''}) with ${state.normalized.gaps.length} gaps.`,
});
return [{ json: state }];
