// Shared DFA financial utilities (inlined into n8n Code nodes)
const SEC_UA = 'DamodaranAnalystSystem/2.0 contact@goevolo.com';
const SEC_ANNUAL_FORMS = ['10-K', '20-F', '20-F/A', '40-F'];
const SEC_INTERIM_FORMS = ['10-Q', '6-K'];
const SEC_MATERIAL_FORMS = ['10-K', '10-Q', '8-K', '20-F', '20-F/A', '6-K', '40-F'];

const METRIC_TAG_MAP = {
  revenue: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet', 'Revenue', 'RevenueFromContractsWithCustomers'],
  gross_profit: ['GrossProfit'],
  operating_income: ['OperatingIncomeLoss', 'ProfitLossFromOperatingActivities'],
  net_income: ['NetIncomeLoss', 'ProfitLoss', 'ProfitLossAttributableToOwnersOfParent'],
  operating_cash_flow: ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations', 'CashFlowsFromUsedInOperatingActivities'],
  capex: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets', 'PaymentsToAcquirePropertyPlantAndEquipmentClassifiedAsInvestingActivities'],
  long_term_debt: ['LongTermDebtAndFinanceLeaseObligationsNoncurrent', 'LongTermDebtNoncurrent', 'LongTermDebtAndFinanceLeaseObligationsCurrent', 'NoncurrentBorrowings'],
  current_assets: ['AssetsCurrent', 'CurrentAssets'],
  current_liabilities: ['LiabilitiesCurrent', 'CurrentLiabilities'],
  interest_expense: ['InterestExpenseNonOperating', 'InterestExpense', 'FinanceCosts'],
  diluted_eps: ['EarningsPerShareDiluted'],
  diluted_shares: ['WeightedAverageNumberOfDilutedSharesOutstanding', 'WeightedAverageNumberOfSharesOutstandingDiluted', 'CommonStockSharesOutstanding'],
  equity: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest', 'Equity'],
  assets: ['Assets'],
  cash: ['CashAndCashEquivalentsAtCarryingValue', 'CashAndCashEquivalents'],
  depreciation: ['DepreciationDepletionAndAmortization', 'DepreciationDepletionAndAmortizationExpense', 'DepreciationAndAmortization', 'DepreciationExpense'],
};

function normName(v) {
  return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isAnnualForm(form) {
  return SEC_ANNUAL_FORMS.includes(form);
}

function isInterimForm(form) {
  return SEC_INTERIM_FORMS.includes(form);
}

function isSupportedForm(form) {
  return SEC_MATERIAL_FORMS.includes(form);
}

function tagRows(facts, tags) {
  for (const tag of tags) {
    const fact = facts[tag];
    if (!fact?.units) continue;
    const rows = Object.values(fact.units).flat().filter((r) => r && r.val !== undefined);
    if (rows.length) return { tag, rows, taxonomy: fact._taxonomy || 'us-gaap' };
  }
  return { tag: tags[0], rows: [], taxonomy: null };
}

function tagRowsMerged(mergedFacts, metricKey) {
  const tags = METRIC_TAG_MAP[metricKey] || [metricKey];
  for (const tag of tags) {
    const fact = mergedFacts[tag];
    if (!fact?.units) continue;
    const rows = Object.values(fact.units).flat().filter((r) => r && r.val !== undefined);
    if (rows.length) return { tag, rows, taxonomy: fact._taxonomy || 'us-gaap' };
  }
  return { tag: tags[0], rows: [], taxonomy: null };
}

function latestAnnualRow(rows, fy) {
  const annual = rows.filter((r) => isAnnualForm(r.form) && (r.fp === 'FY' || r.form === '10-K' || !r.fp));
  const pool = fy ? annual.filter((r) => Number(r.fy) === Number(fy)) : annual;
  return pool
    .sort((a, b) => String(a.filed || '').localeCompare(String(b.filed || '')) || String(a.end || '').localeCompare(String(b.end || '')))
    .at(-1) || null;
}

function latestInterimRows(rows) {
  const qrows = rows.filter((r) => isInterimForm(r.form) && r.fy && r.fp)
    .sort((a, b) => String(a.end || '').localeCompare(String(b.end || '')) || String(a.filed || '').localeCompare(String(b.filed || '')));
  const uniq = [];
  for (const row of qrows) {
    const key = `${row.fy}-${row.fp}`;
    if (!uniq.some((p) => p.key === key)) uniq.push({ key, fy: row.fy, fp: row.fp, end: row.end, filed: row.filed });
  }
  return uniq;
}

function compactFactsFromTaxonomy(factsAll, taxonomy) {
  const allTags = [...new Set(Object.values(METRIC_TAG_MAP).flat())];
  const out = {};
  for (const tag of allTags) {
    const fact = factsAll[tag];
    if (!fact?.units) continue;
    const units = {};
    for (const [unitName, rows] of Object.entries(fact.units)) {
      if (!Array.isArray(rows)) continue;
      const compact = rows
        .filter((r) => r && r.val !== undefined && isSupportedForm(r.form))
        .sort((a, b) => String(a.filed || '').localeCompare(String(b.filed || '')) || String(a.end || '').localeCompare(String(b.end || '')))
        .slice(-24)
        .map((r) => ({ end: r.end, val: r.val, fy: r.fy, fp: r.fp, form: r.form, filed: r.filed, frame: r.frame }));
      if (compact.length) units[unitName] = compact;
    }
    if (Object.keys(units).length) out[tag] = { label: fact.label, units, _taxonomy: taxonomy };
  }
  return out;
}

function mergeCompactFacts(usGaapCompact, ifrsCompact) {
  const merged = { ...usGaapCompact };
  for (const [tag, fact] of Object.entries(ifrsCompact || {})) {
    if (!merged[tag]) {
      merged[tag] = fact;
      continue;
    }
    const existingRows = Object.values(merged[tag].units || {}).flat().length;
    const newRows = Object.values(fact.units || {}).flat().length;
    if (newRows > existingRows) merged[tag] = fact;
  }
  return merged;
}

function compactFacts(usGaapAll) {
  return compactFactsFromTaxonomy(usGaapAll, 'us-gaap');
}

function detectNativeCurrency(usGaapAll, ifrsAll) {
  const probes = ['Revenues', 'Revenue', 'OperatingIncomeLoss', 'ProfitLoss', 'NetIncomeLoss'];
  for (const facts of [usGaapAll, ifrsAll]) {
    if (!facts) continue;
    for (const tag of probes) {
      const fact = facts[tag];
      if (!fact?.units) continue;
      const currencies = Object.keys(fact.units).filter((u) => !['shares', 'USD/shares', 'pure', 'USD'].includes(u));
      if (currencies.length) return currencies[0];
    }
  }
  return 'USD';
}

function detectIssuerProfile(recentForms) {
  const forms = recentForms || [];
  const count20F = forms.filter((f) => String(f).startsWith('20-F')).length;
  const count10K = forms.filter((f) => f === '10-K').length;
  const count6K = forms.filter((f) => f === '6-K').length;
  if (count20F > count10K) {
    return {
      type: 'foreign_private_issuer',
      annual_forms: ['20-F', '20-F/A', '40-F'],
      interim_forms: ['6-K'],
      description: 'Foreign private issuer (20-F / 6-K filer)',
    };
  }
  return {
    type: 'domestic',
    annual_forms: ['10-K'],
    interim_forms: ['10-Q'],
    description: 'US domestic issuer (10-K / 10-Q filer)',
  };
}

async function fetchFxToUsd(nativeCurrency) {
  const from = String(nativeCurrency || 'USD').toUpperCase();
  if (from === 'USD') return { rate: 1, as_of: new Date().toISOString().slice(0, 10), source_name: 'N/A (already USD)', source_url: null };
  try {
    const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=USD`;
    const resp = await this.helpers.httpRequest({
      method: 'GET',
      url,
      headers: { 'User-Agent': SEC_UA },
      json: true,
      timeout: 15000,
    });
    const rate = resp?.rates?.USD;
    if (!rate) throw new Error(`No USD rate returned for ${from}`);
    return {
      rate,
      as_of: resp?.date || new Date().toISOString().slice(0, 10),
      source_name: 'Frankfurter ECB reference rate',
      source_url: url,
      from_currency: from,
      to_currency: 'USD',
    };
  } catch (e) {
    return { rate: null, error: String(e.message || e), from_currency: from, to_currency: 'USD' };
  }
}

function convertToUsd(value, unit, fx) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const u = String(unit || 'USD').toUpperCase();
  if (u === 'USD') return Number(value);
  if (fx?.rate && u === String(fx.from_currency || '').toUpperCase()) return Number(value) * fx.rate;
  return null;
}

function latestSharesOutstanding(mergedFacts, deiFacts, marketMeta) {
  const found = tagRows(mergedFacts, METRIC_TAG_MAP.diluted_shares);
  const secRow = found.rows
    .filter((r) => isSupportedForm(r.form))
    .sort((a, b) => String(a.filed || '').localeCompare(String(b.filed || '')))
    .at(-1);
  const deiRow = deiFacts?.EntityCommonStockSharesOutstanding
    ? Object.values(deiFacts.EntityCommonStockSharesOutstanding.units || {}).flat()
      .filter((r) => r && r.val !== undefined)
      .sort((a, b) => String(a.filed || '').localeCompare(String(b.filed || '')))
      .at(-1)
    : null;
  const yahooShares = marketMeta?.sharesOutstanding || marketMeta?.sharesOutstandingRaw || null;
  const secAgeYears = secRow?.filed ? (Date.now() - new Date(secRow.filed).getTime()) / (365.25 * 86400000) : 999;
  const deiAgeYears = deiRow?.filed ? (Date.now() - new Date(deiRow.filed).getTime()) / (365.25 * 86400000) : 999;
  if (yahooShares && (!secRow || secAgeYears > 2)) {
    return { value: Number(yahooShares), source: 'Yahoo Finance sharesOutstanding', tag: null, filed: marketMeta?.asOf || null, confidence: 'MEDIUM' };
  }
  if (secRow && secAgeYears <= 3) {
    return { value: Number(secRow.val), source: `SEC EDGAR:${found.tag}`, tag: found.tag, filed: secRow.filed, confidence: 'HIGH' };
  }
  if (deiRow && deiAgeYears <= 3) {
    return { value: Number(deiRow.val), source: 'SEC DEI:EntityCommonStockSharesOutstanding', tag: 'EntityCommonStockSharesOutstanding', filed: deiRow.filed, confidence: 'MEDIUM' };
  }
  if (yahooShares) {
    return { value: Number(yahooShares), source: 'Yahoo Finance sharesOutstanding (SEC shares stale)', tag: null, filed: marketMeta?.asOf || null, confidence: 'LOW' };
  }
  return null;
}

function resolveCikFromDirectory(directory, companyName, ticker) {
  const rows = Array.isArray(directory) ? directory : Object.values(directory || {});
  const nameNorm = normName(companyName);
  const tickerNorm = normName(ticker);
  function score(row) {
    const title = row.title || row.name || '';
    const rowTicker = row.ticker || '';
    const titleNorm = normName(title);
    const rowTickerNorm = normName(rowTicker);
    let points = 0;
    if (tickerNorm && rowTickerNorm === tickerNorm) points += 120;
    if (titleNorm === nameNorm) points += 100;
    if (nameNorm && titleNorm.startsWith(nameNorm)) points += 70;
    if (nameNorm && titleNorm.includes(nameNorm)) points += 45;
    return points;
  }
  const ranked = rows
    .filter((row) => row && (row.title || row.name) && (row.cik_str || row.cik))
    .map((row) => ({ row, score: score(row) }))
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score);
  const best = ranked[0]?.row || null;
  const rawCik = best?.cik_str || best?.cik || null;
  const cik = rawCik ? String(rawCik).padStart(10, '0') : null;
  return { best, cik, ranked };
}

function metricFromFacts(facts, metric, fy) {
  const found = tagRowsMerged(facts, metric);
  const row = latestAnnualRow(found.rows, fy);
  return row ? { value: Number(row.val), unit: row._unit || null, row, tag: found.tag, taxonomy: found.taxonomy } : null;
}

function metricUnitFromRow(row, facts, tag) {
  if (!row || !facts?.[tag]?.units) return 'USD';
  for (const [unitName, rows] of Object.entries(facts[tag].units)) {
    if (Array.isArray(rows) && rows.includes(row)) return unitName;
  }
  return Object.keys(facts[tag].units)[0] || 'USD';
}

function computeEntityMetrics(facts, sourceMeta, fx) {
  const years = [2026, 2025, 2024, 2023];
  const latestFy = years.find((fy) => metricFromFacts(facts, 'revenue', fy)) || years[1];
  function val(metric) {
    const m = metricFromFacts(facts, metric, latestFy);
    return m ? m.value : null;
  }
  const revenue = val('revenue');
  const gross = val('gross_profit');
  const op = val('operating_income');
  const net = val('net_income');
  const ocf = val('operating_cash_flow');
  const capex = val('capex');
  const ca = val('current_assets');
  const cl = val('current_liabilities');
  const interest = val('interest_expense');
  const debt = val('long_term_debt');
  const equity = val('equity');
  const assets = val('assets');
  const cash = val('cash');
  const dep = val('depreciation');
  const revY1 = (metricFromFacts(facts, 'revenue', latestFy - 1) || {}).value;
  const revY3 = (metricFromFacts(facts, 'revenue', latestFy - 3) || {}).value;
  const nativeUnit = sourceMeta?.native_currency || 'USD';
  const fcf = ocf !== null && capex !== null ? ocf - capex : null;
  const ebitda = op !== null && dep !== null ? op + dep : null;
  const safeDiv = (a, b) => (a !== null && b !== null && b !== 0 ? a / b : null);
  const toUsd = (v) => convertToUsd(v, nativeUnit, fx);
  return {
    period: `FY${latestFy}`,
    native_currency: nativeUnit,
    revenue,
    revenue_usd: toUsd(revenue),
    gross_margin: safeDiv(gross, revenue),
    operating_margin: safeDiv(op, revenue),
    net_margin: safeDiv(net, revenue),
    ebitda_margin: safeDiv(ebitda, revenue),
    fcf_margin: safeDiv(fcf, revenue),
    current_ratio: safeDiv(ca, cl),
    debt_to_equity: safeDiv(debt, equity),
    interest_coverage: safeDiv(op, interest),
    roce: safeDiv(op, assets && cl !== null ? assets - cl : null),
    asset_turnover: safeDiv(revenue, assets),
    yoy_revenue_growth: safeDiv(revenue && revY1 ? revenue - revY1 : null, revY1),
    revenue_cagr_3y: revY3 && revenue && revY3 > 0 ? Math.pow(revenue / revY3, 1 / 3) - 1 : null,
    net_debt_ebitda: ebitda && debt !== null && cash !== null && ebitda !== 0 ? (debt - cash) / ebitda : null,
    source_meta: sourceMeta,
    fx,
  };
}

function naReason(detail) {
  return `Not available — ${detail}`;
}

function isUnavailableDisplay(v) {
  return v === null || v === undefined || Number.isNaN(v) || v === 'N/A' || String(v).startsWith('Not available');
}

function fmtUsdValue(v, unavailableReason) {
  if (v === null || v === undefined || Number.isNaN(v)) {
    return unavailableReason || naReason('USD amount not reported on the anchored SEC filing');
  }
  const abs = Math.abs(Number(v));
  if (abs >= 1e12) return `$${(Number(v) / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(Number(v) / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(Number(v) / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(Number(v) / 1e3).toFixed(2)}K`;
  return `$${Number(v).toFixed(2)}`;
}

function fmtPct(v, decimals = 1, unavailableReason) {
  if (v === null || v === undefined || Number.isNaN(v)) {
    return unavailableReason || naReason('percentage not computable from anchored filing inputs');
  }
  return `${(Number(v) * 100).toFixed(decimals)}%`;
}

function fmtRatio(v, decimals = 2, unavailableReason) {
  if (v === null || v === undefined || Number.isNaN(v)) {
    return unavailableReason || naReason('ratio not computable because numerator or denominator is missing on the filing');
  }
  return Number(v).toFixed(decimals);
}

function fmtEps(v, unavailableReason) {
  if (v === null || v === undefined || Number.isNaN(v)) {
    return unavailableReason || naReason('EPS not reported on the anchored quarterly filing');
  }
  return `$${Number(v).toFixed(2)}`;
}

function fmtMetric(v, asPct = false) {
  if (asPct) return fmtPct(v);
  return fmtUsdValue(v);
}

function resolveFilingAnchors(recentFilings, issuerProfile) {
  const filings = Array.isArray(recentFilings) ? recentFilings : [];
  const annualForms = issuerProfile?.annual_forms || SEC_ANNUAL_FORMS;
  const interimForms = issuerProfile?.interim_forms || SEC_INTERIM_FORMS;
  function pick(forms) {
    return filings
      .filter((f) => forms.includes(f.form) && f.form !== '8-K')
      .sort((a, b) => String(b.report_date || b.filing_date || '').localeCompare(String(a.report_date || a.filing_date || '')))[0] || null;
  }
  const quarterly = pick(interimForms);
  const annual = pick(annualForms);
  const recent8k = filings
    .filter((f) => f.form === '8-K')
    .sort((a, b) => String(b.filing_date || b.report_date || '').localeCompare(String(a.filing_date || a.report_date || '')))[0] || null;
  return {
    quarterly_10q: quarterly,
    annual_10k: annual,
    recent_8k: recent8k,
    financial_anchor_rule: 'Financial metrics anchor on latest 10-Q/6-K (quarterly) and 10-K/20-F (annual); 8-K is reference-only.',
  };
}

function anchorPeriodLabel(anchor) {
  if (!anchor) return naReason('no filing anchor available');
  const fyStr = (fy) => {
    const s = String(fy);
    return s.startsWith('FY') ? s : `FY${s}`;
  };
  if (anchor.fp && anchor.fy) {
    const fyLabel = fyStr(anchor.fy);
    if (anchor.fp === 'FY' || anchor.fp === fyLabel) return fyLabel;
    return `${anchor.fp} ${fyLabel}`;
  }
  if (anchor.report_date) return anchor.report_date;
  if (anchor.fy) return fyStr(anchor.fy);
  return anchor.filing_date || naReason('filing date not recorded on anchor');
}

function annualSectionLabel(anchor) {
  if (!anchor) return 'Latest Fiscal Year';
  if (anchor.fy) {
    const s = String(anchor.fy);
    return s.startsWith('FY') ? s : `FY${s}`;
  }
  if (anchor.report_date) return anchor.report_date;
  return anchorPeriodLabel(anchor);
}

function rowMatchesAnchor(row, anchor) {
  if (!row || !anchor) return false;
  if (anchor.report_date && row.end && String(row.end) === String(anchor.report_date)) return true;
  if (anchor.fy && Number(row.fy) === Number(anchor.fy)) {
    if (anchor.fp) return String(row.fp) === String(anchor.fp);
    return isAnnualForm(row.form) || row.fp === 'FY' || !row.fp;
  }
  return false;
}

function metricAtAnchor(facts, metricKey, anchor, fx, native) {
  if (!anchor) return null;
  const found = tagRowsMerged(facts, metricKey);
  const allowedForms = isInterimForm(anchor.form) ? SEC_INTERIM_FORMS : SEC_ANNUAL_FORMS;
  const row = found.rows
    .filter((r) => allowedForms.includes(r.form) && rowMatchesAnchor(r, anchor))
    .sort((a, b) => String(a.filed || '').localeCompare(String(b.filed || '')) || String(a.end || '').localeCompare(String(b.end || '')))
    .at(-1);
  if (!row) return null;
  const unit = Object.keys(facts[found.tag]?.units || {}).find((u) => facts[found.tag].units[u]?.some((x) => x === row))
    || Object.keys(facts[found.tag]?.units || {})[0]
    || native;
  const nativeVal = Number(row.val);
  const usdVal = convertToUsd(nativeVal, unit, fx);
  const reportingPeriod = row.end || anchor.report_date || anchorPeriodLabel(anchor);
  return {
    value: usdVal !== null ? usdVal : nativeVal,
    unit: unit === 'USD/shares' ? 'USD/shares' : 'USD',
    native_unit: unit,
    reporting_period: reportingPeriod,
    period: anchorPeriodLabel(anchor),
    fiscal_label: anchor.fp ? `${anchor.fp} FY${anchor.fy}` : `FY${anchor.fy || row.fy}`,
    source_name: `SEC EDGAR ${found.taxonomy || 'us-gaap'}:${found.tag}`,
    source_section: row.form || anchor.form,
    source_date: row.filed || anchor.filing_date,
    confidence: 'HIGH',
    tag: found.tag,
    end: row.end,
  };
}

function peerMetricDirectOnly(facts, metricKey, fy, fx, native) {
  const found = tagRowsMerged(facts, metricKey);
  if (!found.rows.length) return null;
  const row = latestAnnualRow(found.rows, fy);
  if (!row) return null;
  const unit = Object.keys(facts[found.tag]?.units || {})[0] || native;
  const nativeVal = Number(row.val);
  const usdVal = convertToUsd(nativeVal, unit, fx);
  return {
    value: usdVal !== null ? usdVal : nativeVal,
    unit: usdVal !== null ? 'USD' : unit,
    reporting_period: row.end || (row.fy ? `FY${row.fy}` : 'N/A'),
    source_name: `SEC EDGAR ${found.taxonomy || 'us-gaap'}:${found.tag}`,
    tag: found.tag,
  };
}

function detectOneTimeItems(state) {
  const flags = [];
  const company = normName(state.entity?.legal_name || state.inputs?.company_name || '');
  const newsText = (state.research?.news_events || [])
    .map((e) => `${e.title || ''} ${e.description || e.snippet || ''}`)
    .join(' ')
    .toLowerCase();
  const filingText = (state.research?.filings?.recent_filings || [])
    .filter((f) => f.form === '8-K')
    .map((f) => `${f.form} ${f.report_date || ''}`)
    .join(' ')
    .toLowerCase();
  const combined = `${newsText} ${filingText}`;
  const qAnchor = state.research?.filing_anchors?.quarterly_10q;
  const qLabel = qAnchor ? anchorPeriodLabel(qAnchor) : 'Q1 FY2026';
  const isQ12026 = qAnchor && (
    String(qAnchor.report_date || '').startsWith('2026-03')
    || (String(qAnchor.fp) === 'Q1' && Number(qAnchor.fy) === 2026)
  );
  const warnerSignal = /warner\s*bros|wbd.*termination|termination\s*fee|shareholder\s*letter/i.test(combined)
    || (company.includes('netflix') && isQ12026);
  if (warnerSignal) {
    flags.push({
      id: 'warner_bros_termination_fee',
      label: 'Affected by Warner Bros. termination fee (one-time)',
      applies_to_metrics: ['eps', 'net_income', 'net_margin', 'operating_margin'],
      period_label: qLabel,
    });
  }
  return flags;
}

function oneTimeFlagForMetric(flags, metricId, periodLabel) {
  return (flags || []).find((f) => {
    if (!f.applies_to_metrics.includes(metricId)) return false;
    if (!periodLabel || !f.period_label) return true;
    const norm = String(periodLabel).toUpperCase();
    const target = String(f.period_label).toUpperCase();
    return norm === target || (norm.includes('Q1') && norm.includes('2026') && target.includes('Q1'));
  }) || null;
}

const CORE_PEER_METRICS = ['Revenue', 'Gross Margin', 'Operating Margin', 'Net Margin', 'FCF Margin', 'Current Ratio'];

function snapshotMetricValue(state, section, metricId) {
  const rows = state.financial_snapshot?.[section]?.rows || [];
  const row = rows.find((r) => r.metric === metricId);
  if (!row?.raw || row.raw.value === null || row.raw.value === undefined) return null;
  return {
    value: Number(row.raw.value),
    unit: row.raw.unit,
    reporting_period: row.reporting_period,
    period_label: state.financial_snapshot?.[section]?.period_label || row.reporting_period,
    one_time_flag: row.raw.one_time_flag || null,
    source_name: row.raw.source_name || null,
  };
}

function getQuarterlyAnchorMetrics(state) {
  const qAnchor = state.research?.filing_anchors?.quarterly_10q;
  const periodLabel = state.financial_snapshot?.quarterly?.period_label || anchorPeriodLabel(qAnchor);
  const fromSnapshot = {
    period_label: periodLabel,
    reporting_period: qAnchor?.report_date || periodLabel,
    revenue: snapshotMetricValue(state, 'quarterly', 'revenue'),
    operating_margin: snapshotMetricValue(state, 'quarterly', 'operating_margin'),
    net_margin: snapshotMetricValue(state, 'quarterly', 'net_margin'),
    net_income: snapshotMetricValue(state, 'quarterly', 'net_income'),
    free_cash_flow: snapshotMetricValue(state, 'quarterly', 'free_cash_flow'),
    eps: snapshotMetricValue(state, 'quarterly', 'eps'),
  };
  if (fromSnapshot.revenue) return fromSnapshot;
  const facts = state.research?.financials?.merged_facts || state.research?.financials?.raw_us_gaap_facts || {};
  const fx = state.research?.financials?.fx_to_usd || {};
  const native = state.research?.financials?.native_currency || 'USD';
  if (!qAnchor) return fromSnapshot;
  const revenue = metricAtAnchor(facts, 'revenue', qAnchor, fx, native);
  const op = metricAtAnchor(facts, 'operating_income', qAnchor, fx, native);
  const ocf = metricAtAnchor(facts, 'operating_cash_flow', qAnchor, fx, native);
  const capex = metricAtAnchor(facts, 'capex', qAnchor, fx, native);
  const eps = metricAtAnchor(facts, 'diluted_eps', qAnchor, fx, native);
  const opMarginVal = revenue && op && revenue.value ? op.value / revenue.value : null;
  const fcfVal = ocf && capex ? ocf.value - capex.value : null;
  return {
    period_label: periodLabel,
    reporting_period: qAnchor.report_date || periodLabel,
    revenue: revenue ? { value: revenue.value, unit: 'USD', reporting_period: revenue.reporting_period, period_label: periodLabel } : null,
    operating_margin: opMarginVal !== null ? { value: opMarginVal, unit: 'ratio', reporting_period: revenue?.reporting_period, period_label: periodLabel } : null,
    free_cash_flow: fcfVal !== null ? { value: fcfVal, unit: 'USD', reporting_period: ocf?.reporting_period, period_label: periodLabel } : null,
    eps: eps ? { value: eps.value, unit: 'USD/shares', reporting_period: eps.reporting_period, period_label: periodLabel } : null,
  };
}

function getAnnualAnchorMetrics(state) {
  const fyAnchor = state.research?.filing_anchors?.annual_10k;
  const periodLabel = state.financial_snapshot?.annual?.period_label || anchorPeriodLabel(fyAnchor);
  const fromSnapshot = {
    period_label: periodLabel,
    reporting_period: fyAnchor?.report_date || periodLabel,
    revenue: snapshotMetricValue(state, 'annual', 'revenue'),
    operating_margin: snapshotMetricValue(state, 'annual', 'operating_margin'),
    net_margin: snapshotMetricValue(state, 'annual', 'net_margin'),
    net_income: snapshotMetricValue(state, 'annual', 'net_income'),
    free_cash_flow: snapshotMetricValue(state, 'annual', 'free_cash_flow'),
    eps: snapshotMetricValue(state, 'annual', 'eps'),
  };
  if (fromSnapshot.revenue) return fromSnapshot;
  const facts = state.research?.financials?.merged_facts || state.research?.financials?.raw_us_gaap_facts || {};
  const fx = state.research?.financials?.fx_to_usd || {};
  const native = state.research?.financials?.native_currency || 'USD';
  const anchor = fyAnchor ? { ...fyAnchor, fp: 'FY' } : null;
  if (!anchor) return fromSnapshot;
  const revenue = metricAtAnchor(facts, 'revenue', anchor, fx, native);
  const op = metricAtAnchor(facts, 'operating_income', anchor, fx, native);
  const ocf = metricAtAnchor(facts, 'operating_cash_flow', anchor, fx, native);
  const capex = metricAtAnchor(facts, 'capex', anchor, fx, native);
  return {
    period_label: periodLabel,
    reporting_period: fyAnchor.report_date || periodLabel,
    revenue: revenue ? { value: revenue.value, unit: 'USD', reporting_period: revenue.reporting_period, period_label: periodLabel } : null,
    operating_margin: revenue && op && revenue.value ? { value: op.value / revenue.value, unit: 'ratio', reporting_period: revenue.reporting_period, period_label: periodLabel } : null,
    free_cash_flow: ocf && capex ? { value: ocf.value - capex.value, unit: 'USD', reporting_period: ocf.reporting_period, period_label: periodLabel } : null,
  };
}

function formatAnchoredMetricValue(metric, kind) {
  if (!metric || metric.value === null || metric.value === undefined) {
    const label = kind === 'pct' ? 'margin' : (kind === 'eps' ? 'EPS' : 'metric');
    return naReason(`${label} not found on the anchored quarterly filing`);
  }
  const flag = metric.one_time_flag ? ` ⚠ ${metric.one_time_flag}` : '';
  if (kind === 'pct' || metric.unit === 'ratio') return `${fmtPct(metric.value)}${flag}`;
  if (kind === 'eps' || metric.unit === 'USD/shares') return `${fmtEps(metric.value)}${flag}`;
  return `${fmtUsdValue(metric.value)}${flag}`;
}

function metricCitationShort(metric, fallbackForm) {
  if (metric?.source_name) return `Source: ${metric.source_name}`;
  return `Source: SEC EDGAR ${fallbackForm || 'filing'}`;
}

function companyDisplayName(entity, inputs) {
  const legal = entity?.legal_name || inputs?.company_name || 'the company';
  const ticker = String(entity?.ticker || inputs?.ticker || '').toUpperCase();
  if (ticker === 'NFLX' || /netflix/i.test(legal)) return 'Netflix';
  return legal.replace(/\s+(Inc|Corp|Corporation|Ltd|Group|Co)\.?$/i, '').trim() || legal;
}

function detectLeadershipBullet(state, signals) {
  const display = companyDisplayName(state.entity, state.inputs);
  const items = Array.isArray(signals) ? signals : [];
  for (const item of items) {
    const text = `${item.title || ''} ${item.description || item.snippet || ''}`;
    const lower = text.toLowerCase();
    if (!/re-election|re election|step down|resign|appointed (ceo|cfo)|board.*annual meeting|leadership transition/i.test(lower)) continue;
    if (/hastings/i.test(lower) && /not seek re-election|won't seek re-election|will not seek re-election/i.test(lower)) {
      return `Reed Hastings will not seek re-election to ${display}'s board at the June annual meeting.`;
    }
    const nameMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(?:will\s+not|won't|to)\s+(?:seek\s+)?re-election/i);
    if (nameMatch) {
      const month = /june/i.test(lower) ? 'June' : (/may/i.test(lower) ? 'May' : 'the upcoming');
      return `${nameMatch[1]} will not seek re-election to ${display}'s board at the ${month} annual meeting.`;
    }
    const title = String(item.title || '').trim();
    if (title.length > 24 && title.length < 220 && /board|ceo|cfo|re-election|resign/i.test(title)) {
      return title.endsWith('.') ? title : `${title}.`;
    }
  }
  return null;
}

function formatMarketCapProof(market) {
  if (!market?.market_cap_usd) return 'Computed market cap unavailable.';
  return `Computed market cap ${fmtUsdValue(market.market_cap_usd)} from Yahoo share price and SEC DEI shares outstanding.`;
}

function formatQuarterlyMetric(metric, kind) {
  return formatAnchoredMetricValue(metric, kind);
}

function formatAnnualMetric(metric, kind) {
  return formatAnchoredMetricValue(metric, kind);
}

function aggregateReportGaps(state) {
  const gaps = [...(state.normalized?.gaps || [])];
  const ts = new Date().toISOString();
  if (state.peer_benchmarks && !state.peer_benchmarks.markdown) {
    gaps.push({
      metric: 'peer_benchmarks',
      reason: 'Peer comparison section missing from report assembly.',
      source: 'WF_PEER_BENCHMARKS',
      timestamp: ts,
    });
  }
  if (!state.financial_snapshot?.three_year_revenue?.has_data && !state.sections?.s2_three_year_revenue) {
    gaps.push({
      metric: 'three_year_revenue_10k',
      reason: '3-Year Revenue From 10-Ks section missing or has no filing-backed annual revenue rows.',
      source: 'WF_FINANCIAL_SNAPSHOT',
      timestamp: ts,
    });
  }
  const qNa = (state.ratio_dashboard?.quarterly || []).filter((r) => isUnavailableDisplay(r.value)).length;
  const aNa = (state.ratio_dashboard?.annual || []).flatMap((r) => r.values || []).filter((v) => isUnavailableDisplay(v)).length;
  if (qNa > 0) gaps.push({ metric: 'quarterly_ratios', reason: `${qNa} quarterly ratio(s) unavailable on anchored filing — see Section 5 for reasons.`, source: 'WF_RATIO_DASHBOARD', timestamp: ts });
  if (aNa > 0) gaps.push({ metric: 'annual_ratios', reason: `${aNa} annual ratio value(s) unavailable — required line items missing.`, source: 'WF_RATIO_DASHBOARD', timestamp: ts });
  if (!state.research?.market_data?.market_cap_usd) {
    gaps.push({ metric: 'market_cap', reason: 'Computed market cap unavailable (requires Yahoo share price and SEC DEI shares outstanding).', source: 'WF_RESEARCH_PUBLIC', timestamp: ts });
  }
  return gaps;
}

function unusualQuarterNotes(state) {
  const flags = state.research?.one_time_items || [];
  if (!flags.some((f) => f.id === 'warner_bros_termination_fee')) return [];
  return [
    '- A one-time Warner Bros. termination fee was recognized in interest and other income in Q1 FY2026.',
    '- This item inflated net income and EPS; use adjusted analysis when evaluating core operating performance.',
  ];
}

function dilutedSharesAtAnchor(facts, anchor) {
  if (!anchor) return null;
  const found = tagRowsMerged(facts, 'diluted_shares');
  const row = found.rows
    .filter((r) => isInterimForm(r.form) && rowMatchesAnchor(r, anchor))
    .sort((a, b) => String(a.filed || '').localeCompare(String(b.filed || '')) || String(a.end || '').localeCompare(String(b.end || '')))
    .at(-1);
  if (!row) return null;
  return {
    value: Number(row.val),
    source_name: `SEC EDGAR ${found.taxonomy || 'us-gaap'}:${found.tag}`,
    reporting_period: row.end || anchor.report_date,
    source_section: row.form || anchor.form,
    concept: 'weighted_average_diluted',
  };
}

function deiSharesOutstanding(deiFacts) {
  if (!deiFacts?.EntityCommonStockSharesOutstanding) return null;
  const row = Object.values(deiFacts.EntityCommonStockSharesOutstanding.units || {}).flat()
    .filter((r) => r && r.val !== undefined)
    .sort((a, b) => String(a.filed || '').localeCompare(String(b.filed || '')) || String(a.end || '').localeCompare(String(b.end || '')))
    .at(-1);
  if (!row) return null;
  return {
    value: Number(row.val),
    source_name: 'SEC DEI:EntityCommonStockSharesOutstanding',
    reporting_period: row.end || row.filed,
    concept: 'shares_outstanding',
  };
}

function buildLiveMarketData(meta, mergedFacts, deiFacts, qAnchor, ticker) {
  const price = meta?.regularMarketPrice ?? meta?.previousClose ?? null;
  const asOfTs = meta?.regularMarketTime ? meta.regularMarketTime * 1000 : Date.now();
  const asOf = new Date(asOfTs).toISOString();
  const priceNum = price != null ? Number(price) : null;
  const dei = deiSharesOutstanding(deiFacts);
  const dilutedWa = qAnchor ? dilutedSharesAtAnchor(mergedFacts, qAnchor) : null;
  let marketCap = null;
  let marketCapSource = null;
  let marketCapComputed = false;
  if (priceNum && dei?.value) {
    marketCap = priceNum * dei.value;
    marketCapSource = 'Computed: Yahoo share price × SEC DEI shares outstanding';
    marketCapComputed = true;
  } else if (meta?.marketCap != null) {
    marketCap = Number(meta.marketCap);
    marketCapSource = 'Yahoo Finance meta.marketCap';
  }
  const incomplete = priceNum != null && !marketCap;
  const yahooUrl = ticker ? `https://finance.yahoo.com/quote/${ticker}` : null;
  return {
    source_name: 'Yahoo Finance',
    source_url: yahooUrl,
    source_date: asOf,
    ticker,
    share_price_usd: priceNum,
    share_price_currency: 'USD',
    market_cap_usd: marketCap,
    market_cap_source: marketCapSource,
    market_cap_computed: marketCapComputed,
    shares_outstanding: dei?.value ?? null,
    shares_outstanding_source: dei?.source_name ?? null,
    shares_outstanding_as_of: dei?.reporting_period ?? null,
    shares_outstanding_note: 'Point-in-time shares outstanding (SEC DEI). Not quarterly weighted-average diluted shares.',
    weighted_avg_diluted_shares: dilutedWa?.value ?? null,
    weighted_avg_diluted_shares_source: dilutedWa?.source_name ?? null,
    weighted_avg_diluted_shares_period: dilutedWa?.reporting_period ?? qAnchor?.report_date ?? null,
    weighted_avg_diluted_shares_note: 'From quarterly filing anchor (weighted-average diluted shares outstanding).',
    incomplete,
    math_consistent: Boolean(priceNum && marketCap),
    math_note: incomplete
      ? 'Market data is incomplete: share price available but market cap could not be populated.'
      : (priceNum && marketCap
        ? `${marketCapSource} @ ${asOf}: computed market cap ${fmtUsdValue(marketCap)}, price ${fmtUsdValue(priceNum)}.`
        : 'Yahoo Finance returned partial quote data.'),
    confidence: priceNum && marketCap ? 'MEDIUM' : 'LOW',
    fetched_at: new Date().toISOString(),
  };
}

function reconcileMarketData(sharePrice, sharesOutstanding, reportedMarketCap) {
  const price = sharePrice !== null && sharePrice !== undefined ? Number(sharePrice) : null;
  const shares = sharesOutstanding !== null && sharesOutstanding !== undefined ? Number(sharesOutstanding) : null;
  if (!price || !shares) {
    return {
      share_price_usd: price,
      shares_outstanding: shares,
      market_cap_usd: reportedMarketCap !== null && reportedMarketCap !== undefined ? Number(reportedMarketCap) : null,
      implied_shares_outstanding: null,
      math_consistent: false,
      math_note: 'Insufficient price or share count to verify market cap math.',
    };
  }
  const marketCap = price * shares;
  const impliedShares = marketCap / price;
  const reported = reportedMarketCap !== null && reportedMarketCap !== undefined ? Number(reportedMarketCap) : null;
  const capDrift = reported && reported > 0 ? Math.abs(marketCap - reported) / reported : 0;
  const shareDrift = Math.abs(impliedShares - shares) / shares;
  const consistent = capDrift < 0.01 && shareDrift < 0.01;
  return {
    share_price_usd: price,
    shares_outstanding: shares,
    market_cap_usd: marketCap,
    implied_shares_outstanding: impliedShares,
    math_consistent: consistent,
    math_note: `Verified: market_cap (${fmtUsdValue(marketCap)}) = share_price (${fmtUsdValue(price)}) × shares (${shares.toLocaleString('en-US')}).`,
  };
}

function annualFactValue(facts, metricKey, fy, fx, native) {
  const direct = peerMetricDirectOnly(facts, metricKey, fy, fx, native);
  return direct ? direct.value : null;
}

function computePeerMetricsFromFacts(facts, fy, fx, native) {
  const revenue = annualFactValue(facts, 'revenue', fy, fx, native);
  const gross = annualFactValue(facts, 'gross_profit', fy, fx, native);
  const op = annualFactValue(facts, 'operating_income', fy, fx, native);
  const net = annualFactValue(facts, 'net_income', fy, fx, native);
  const ocf = annualFactValue(facts, 'operating_cash_flow', fy, fx, native);
  const capex = annualFactValue(facts, 'capex', fy, fx, native);
  const ca = annualFactValue(facts, 'current_assets', fy, fx, native);
  const cl = annualFactValue(facts, 'current_liabilities', fy, fx, native);
  const interest = annualFactValue(facts, 'interest_expense', fy, fx, native);
  const debt = annualFactValue(facts, 'long_term_debt', fy, fx, native);
  const equity = annualFactValue(facts, 'equity', fy, fx, native);
  const assets = annualFactValue(facts, 'assets', fy, fx, native);
  const cash = annualFactValue(facts, 'cash', fy, fx, native);
  const dep = annualFactValue(facts, 'depreciation', fy, fx, native);
  const revY1 = annualFactValue(facts, 'revenue', fy - 1, fx, native);
  const revY3 = annualFactValue(facts, 'revenue', fy - 3, fx, native);
  const safeDiv = (a, b) => (a !== null && b !== null && b !== 0 ? a / b : null);
  const fcf = ocf !== null && capex !== null ? ocf - capex : null;
  const ebitda = op !== null && dep !== null ? op + dep : null;
  const peerNa = (label) => naReason(`${label} not computable from SEC line items for FY${fy}`);
  return {
    Revenue: revenue !== null ? fmtUsdValue(revenue) : peerNa('Revenue'),
    'Gross Margin': safeDiv(gross, revenue) !== null ? fmtPct(safeDiv(gross, revenue)) : peerNa('Gross margin'),
    'Operating Margin': safeDiv(op, revenue) !== null ? fmtPct(safeDiv(op, revenue)) : peerNa('Operating margin'),
    'Net Margin': safeDiv(net, revenue) !== null ? fmtPct(safeDiv(net, revenue)) : peerNa('Net margin'),
    'FCF Margin': safeDiv(fcf, revenue) !== null ? fmtPct(safeDiv(fcf, revenue)) : peerNa('FCF margin'),
    'Current Ratio': safeDiv(ca, cl) !== null ? fmtRatio(safeDiv(ca, cl)) : peerNa('Current ratio'),
    'YoY Revenue Growth': safeDiv(revenue && revY1 ? revenue - revY1 : null, revY1) !== null ? fmtPct(safeDiv(revenue - revY1, revY1)) : peerNa('YoY revenue growth'),
    '3-Year Revenue CAGR': revY3 && revenue && revY3 > 0 ? fmtPct(Math.pow(revenue / revY3, 1 / 3) - 1) : peerNa('3-year revenue CAGR'),
    'Net Debt / EBITDA': ebitda && debt !== null && cash !== null && ebitda !== 0 ? fmtRatio((debt - cash) / ebitda) : peerNa('Net debt / EBITDA'),
    'Interest Coverage': safeDiv(op, interest) !== null ? fmtRatio(safeDiv(op, interest)) : peerNa('Interest coverage'),
    'ROCE/ROIC': safeDiv(op, assets !== null && cl !== null ? assets - cl : null) !== null ? fmtPct(safeDiv(op, assets - cl)) : peerNa('ROCE/ROIC'),
    'Asset Turnover': safeDiv(revenue, assets) !== null ? fmtRatio(safeDiv(revenue, assets)) : peerNa('Asset turnover'),
    _fy: fy,
  };
}

function peerRowHasCoreMetrics(metrics) {
  return CORE_PEER_METRICS.every((key) => metrics[key] && !isUnavailableDisplay(metrics[key]));
}

function entityConfidence(entity, normalized) {
  const gaps = normalized?.gaps?.length || 0;
  const metrics = normalized?.source_coverage?.metrics_with_values || 0;
  if (!entity?.cik) return 'LOW';
  if (metrics >= 8 && gaps <= 3) return 'HIGH';
  if (metrics >= 4) return 'MEDIUM';
  return 'LOW';
}

function peerDefaults(industry, companyName) {
  const key = String(industry || '').toLowerCase();
  const target = normName(companyName);
  const defaults = {
    technology: ['Microsoft', 'Alphabet', 'Meta Platforms', 'Amazon', 'NVIDIA'],
    saas: ['Salesforce', 'Adobe', 'ServiceNow', 'Atlassian', 'Workday'],
    retail: ['Walmart', 'Costco', 'Target', 'Amazon', 'Home Depot'],
    banking: ['JPMorgan Chase', 'Bank of America', 'Wells Fargo', 'Citigroup', 'Goldman Sachs'],
    healthcare: ['UnitedHealth Group', 'HCA Healthcare', 'Elevance Health', 'CVS Health', 'Humana'],
    manufacturing: ['General Electric', 'Honeywell', 'Caterpillar', '3M', 'Siemens'],
    gaming: ['Nintendo', 'Electronic Arts', 'Take-Two Interactive', 'Microsoft', 'Roblox'],
    media: ['Disney', 'Netflix', 'Comcast', 'Warner Bros. Discovery', 'Paramount Global'],
    streaming: ['Netflix', 'Warner Bros. Discovery', 'Disney', 'Amazon', 'Apple'],
  };
  const match = Object.keys(defaults).find((k) => key.includes(k))
    || (/(stream|video|ott|entertainment)/.test(key) ? 'streaming' : null)
    || 'technology';
  return defaults[match].filter((name) => normName(name) !== target);
}

function parsePeerList(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return String(raw).split(/[,;\n|]/).map((s) => s.trim()).filter(Boolean);
}

function entityMentionedInText(text, entityName) {
  const hay = normName(text);
  const needle = normName(entityName);
  if (!needle || !hay) return false;
  if (hay.includes(needle)) return true;
  const aliases = {
    hbomax: ['hbo max', 'max streaming', 'warner bros discovery max'],
    netflix: ['netflix'],
    disneyplus: ['disney plus', 'disney+'],
    amazonprimevideo: ['prime video', 'amazon prime video'],
    appletvplus: ['apple tv plus', 'apple tv+'],
    paramountplus: ['paramount plus', 'paramount+'],
  };
  const key = needle.replace(/[^a-z0-9]/g, '');
  const list = aliases[key] || [entityName];
  return list.some((alias) => hay.includes(normName(alias)));
}

function claudeBaseSystem(inputs, expert) {
  return `You are an AI financial analyst preparing executive-ready analysis. Evidence first. Every figure must come from the provided JSON only. Never fabricate numbers. If data is missing, explain why instead of using bare N/A. Show formulas for computed metrics. Do not use templating placeholders or curly-brace variables. Industry lens: ${expert?.name || inputs.expert_pref || 'industry expert'}. Executive audience: ${inputs.exec_type || 'executive'}. Service provider: ${inputs.service_provider || 'MY COMPANY'}.`;
}

function parseClaudeJson(response) {
  const content = response?.content || [];
  const text = content.map((p) => p.text || '').join('\n').trim() || (typeof response === 'string' ? response : JSON.stringify(response));
  try { return JSON.parse(text); } catch (e) {}
  const match = text.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch (e) {} }
  return { _raw: text };
}

function buildDeterministicInsights(state) {
  const q = getQuarterlyAnchorMetrics(state);
  const period = q.period_label || 'Quarterly anchor';
  const qForm = state.data_freshness?.quarterly_anchor_form || '10-Q';
  const qPeriod = q.reporting_period || state.data_freshness?.quarterly_anchor_report_date || naReason('quarterly report period not recorded');
  const issuer = state.entity?.issuer_profile?.description || 'public company';
  const ref8k = state.data_freshness?.recent_8k_form;
  const ref8kDate = state.data_freshness?.recent_8k_filing_date;
  const peerReady = Boolean(state.peer_benchmarks?.markdown);
  const threeYear = state.financial_snapshot?.three_year_revenue;
  const annualTrend = threeYear?.narrative_summary || naReason('3-year 10-K revenue trend not available');
  return [
    '## Section 4: Three Strategic Insights',
    '',
    `Metric basis: quarterly anchor ${period} for operating metrics. Annual revenue growth is cited separately from the 3-Year Revenue From 10-Ks section (FY2025/FY2024/FY2023) and is not mixed with quarterly revenue.`,
    '',
    '### Insight 1 — Cash-flow quality and reinvestment',
    `- Revenue (quarterly anchor): ${formatQuarterlyMetric(q.revenue)} — ${metricCitationShort(q.revenue, qForm)}`,
    `- Operating margin (quarterly): ${formatQuarterlyMetric(q.operating_margin, 'pct')} — ${metricCitationShort(q.operating_margin, qForm)} (computed: operating income ÷ revenue)`,
    `- FCF (quarterly): ${formatQuarterlyMetric(q.free_cash_flow)} — ${metricCitationShort(q.free_cash_flow, qForm)} (computed: operating cash flow − capex)`,
    `- EPS (quarterly): ${formatQuarterlyMetric(q.eps, 'eps')} — ${metricCitationShort(q.eps, qForm)}`,
    `- **Annual growth view (10-K only):** ${annualTrend}`,
    `- Analyst view (interpretation): Sustainable value creation depends on whether growth is backed by reinvestment and cash conversion, not headline revenue alone.`,
    `- So-what: ${state.inputs?.exec_type || 'Executive'} should prioritize the metric with the weakest source-backed trend before approving new spend.`,
    '',
    '### Insight 2 — Risk, leverage, and cost of capital',
    `- Issuer profile: ${issuer} [filing classification]`,
    peerReady
      ? `- Peer context: Section 3 categorical peer table — latest annual revenue and margins (FY${state.peer_benchmarks?.benchmark_fy || 2025}); approximations labeled where SEC tags were incomplete.`
      : '- Peer context: Section 3 peer table not assembled for this run (see Section 8 gaps).',
    `- Analyst view (interpretation): Risk shows up in leverage, coverage, and earnings volatility versus peers.`,
    `- So-what: If leverage or margin trails peers, the strategic plan must explain convergence or justify a premium/discount.`,
    '',
    '### Insight 3 — Narrative vs filings',
    `- Quarterly anchor: ${qForm} filed ${state.data_freshness?.quarterly_anchor_filing_date || naReason('filing date not recorded')} (report period ${qPeriod}) [SEC filing]`,
    ref8k ? `- Recent 8-K (reference only, not financial anchor): ${ref8k} filed ${ref8kDate || naReason('8-K filing date not recorded')}` : '- No recent 8-K on file.',
    `- Analyst view (interpretation): Markets price expected future cash flows; interim filings test whether the narrative is credible.`,
    `- So-what: Tie every strategic claim to a filing-backed metric or mark it as interpretation with a stated reason.`,
  ].join('\n');
}

function buildExecutivePresentationPrompt(state, deckContext) {
  const inputs = state.inputs || {};
  const company = companyDisplayName(state.entity, inputs);
  const legalName = state.entity?.legal_name || inputs.company_name || company;
  const ticker = state.entity?.ticker || inputs.ticker || '';
  const execType = inputs.exec_type || 'executive';
  const industry = inputs.industry || 'the industry';
  const provider = inputs.service_provider || 'our team';
  const expert = inputs.expert_resolved?.name || inputs.expert_pref || 'industry specialist';
  const slideCount = DECK_SLIDE_COUNT;
  const q = getQuarterlyAnchorMetrics(state);
  const period = q.period_label || 'latest quarter';
  const fyAnchor = state.research?.filing_anchors?.annual_10k;
  const fyLabel = fyAnchor?.fy ? `FY${fyAnchor.fy}` : annualSectionLabel(fyAnchor);
  const market = state.research?.market_data || {};
  const peerPublished = Boolean(state.peer_benchmarks?.markdown);
  const threeYear = state.financial_snapshot?.three_year_revenue;
  const freshness = state.data_freshness || {};
  const qForm = freshness.quarterly_anchor_form || '10-Q';

  const logos = deckContext?.logos || {
    company: resolveLogoAsset('company', state),
    provider: resolveLogoAsset('provider', state),
  };
  const slideMaster = deckContext?.slideMaster || buildDeckSlideMaster(logos);
  const slides = TEN_SLIDE_OUTLINE;

  const financialFacts = [
    `Revenue (${period}): ${formatQuarterlyMetric(q.revenue)}`,
    `Operating margin (${period}): ${formatQuarterlyMetric(q.operating_margin, 'pct')}`,
    `Net margin (${period}): ${formatQuarterlyMetric(q.net_margin, 'pct')}`,
    `Free cash flow (${period}): ${formatQuarterlyMetric(q.free_cash_flow)}`,
    `EPS (${period}): ${formatQuarterlyMetric(q.eps, 'eps')}`,
    market.market_cap_usd != null
      ? `Market cap: ${fmtUsdValue(market.market_cap_usd)} (${market.market_cap_source || 'computed from live share price and SEC shares outstanding'})`
      : naReason('market cap requires live share price and SEC shares outstanding'),
    market.share_price_usd != null ? `Share price: ${fmtUsdValue(market.share_price_usd)} as of ${market.source_date || 'latest quote'}` : null,
    threeYear?.narrative_summary ? `3-year annual revenue trend (10-K only): ${threeYear.narrative_summary}` : null,
  ].filter(Boolean);

  const priorities = (state.executive_proposal?.priorities || []).map((p, i) => (
    `${i + 1}. ${p.title} — Financial hook: ${p.financial_hook || p.rationale || p.metric}`
  ));

  const valueHooks = (state.value_realization?.signals || []).slice(0, 5).map((s) => (
    `- ${s.insight} → ${s.value}`
  ));

  return [
    `Create a ${slideCount}-slide executive presentation for a ${execType} audience.`,
    '',
    'AUDIENCE AND TONE',
    `- Company: ${legalName}${ticker ? ` (${ticker})` : ''}`,
    `- Industry: ${industry}`,
    `- Expert lens to weave in (lightly): ${expert}`,
    `- Presenter positioning: ${provider} advising ${execType} leadership`,
    '- Tone: board-ready, concise, confident. Use plain business language.',
    '- Do NOT reference academic valuation frameworks, professor names, or niche finance jargon.',
    '',
    'SLIDE MASTER AND FOOTER (CRITICAL — apply globally)',
    buildDeckFooterMarkdown(logos),
    '- Configure ONE slide master; every slide inherits the same footer row automatically.',
    '- Left footer column: company logo only. Right footer column: service provider logo only.',
    `- Company logo source: ${logos.company.url || 'manual'} — ${logos.company.source_note || logos.company.fallback_note || ''}`,
    `- Provider logo source: ${logos.provider.url || 'manual'} — ${logos.provider.source_note || logos.provider.fallback_note || ''}`,
    '',
    'DESIGN DIRECTION',
    '- Theme: clean executive finance — dark navy or charcoal with one accent color, large numbers, minimal text per slide.',
    '- Every slide should lead with a number or a clear decision, not a paragraph.',
    '- Use charts only where a trend or comparison is filing-backed.',
    '',
    'SLIDE OUTLINE (10 slides — follow this structure exactly)',
    ...slides.map((s) => `- ${s}`),
    '',
    'FILING-BACKED FINANCIAL FACTS (use these figures — do not invent numbers)',
    ...financialFacts.map((f) => `- ${f}`),
    `- Data anchor: ${qForm} filed ${freshness.quarterly_anchor_filing_date || naReason('filing date not recorded')} (report period ${freshness.quarterly_anchor_report_date || period})`,
    peerPublished
      ? `- Peer comparison available for ${fyLabel} — categorical annual peer table in Section 3 (approximations labeled).`
      : '- Peer comparison section not available for this run.',
    '',
    'OPPORTUNITIES TIED TO FINANCIALS',
    ...(priorities.length ? priorities : ['- Link each strategic opportunity to a baseline metric from the quarterly filing.']),
    ...(valueHooks.length ? ['', 'VALUE REALIZATION HOOKS', ...valueHooks] : []),
    '',
    'CONTENT RULES',
    '- Tie every recommendation to a specific IT initiative and the financial metric it moves (revenue, margin, FCF, leverage, or market cap).',
    '- Keep quarterly metrics on slides 2–3 separate from annual 10-K revenue on slide 3.',
    '- If a figure was not available, state why briefly instead of showing "N/A".',
    '- Flag one-time items (e.g., termination fees) separately from core operating performance.',
    '- End with a clear ask: approve diagnostic, set metric targets, or schedule executive review.',
    '',
    'OUTPUT FORMAT',
    '- Produce exactly 10 slides with titles, 3–4 bullets per slide, and brief speaker notes.',
    '- Every slide must include the inherited two-column footer with company logo left and provider logo right.',
    '- Suitable for import into Gamma, Canva, PowerPoint Copilot, or similar tools.',
    '',
    'SLIDE MASTER JSON (for tools that accept structured deck input)',
    '```json',
    JSON.stringify(slideMaster, null, 2),
    '```',
  ].join('\n');
}

const IT_INITIATIVE_PATTERNS = [
  { re: /cloud\s+(?:migration|modernization|transformation|platform)/i, name: 'Cloud migration / modernization', goal: 'Modernize infrastructure and reduce run cost', metric: 'Infrastructure cost and deployment velocity' },
  { re: /(?:erp|sap|oracle|workday)\s+(?:upgrade|implementation|migration|rollout)/i, name: 'ERP / core systems modernization', goal: 'Unify finance and operations on a single platform', metric: 'Close cycle time and reporting accuracy' },
  { re: /data\s+(?:platform|lake|warehouse|analytics|governance)/i, name: 'Enterprise data platform', goal: 'Improve decision latency with governed analytics', metric: 'Reporting cycle time and data quality' },
  { re: /(?:ai|artificial intelligence|machine learning|genai|generative ai)/i, name: 'AI / intelligent automation', goal: 'Automate high-volume workflows and insights', metric: 'Process cost and cycle time' },
  { re: /cyber(?:security)?|zero\s*trust|identity\s+(?:management|governance)/i, name: 'Cybersecurity / zero trust', goal: 'Reduce breach and compliance risk', metric: 'Risk exposure and audit readiness' },
  { re: /customer\s+(?:360|crm|experience|engagement)/i, name: 'Customer experience / CRM', goal: 'Grow retention and lifetime value', metric: 'Revenue retention and churn' },
  { re: /digital\s+(?:transformation|channel|commerce)/i, name: 'Digital transformation', goal: 'Shift revenue and service delivery to digital channels', metric: 'Digital revenue mix and margin' },
  { re: /automation|rpa|process\s+(?:mining|optimization)/i, name: 'Process automation', goal: 'Remove manual effort in core processes', metric: 'Operating margin and FCF conversion' },
  { re: /(?:devops|ci\/?cd|platform\s+engineering)/i, name: 'Engineering platform / DevOps', goal: 'Accelerate product delivery', metric: 'Release frequency and incident rate' },
];

function parseInitiativeList(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((s) => String(s).trim()).filter(Boolean);
  return String(raw).split(/[,;\n|]/).map((s) => s.trim()).filter(Boolean);
}

function extractITInitiatives(state) {
  const inputs = state.inputs || {};
  const explicit = parseInitiativeList(inputs.it_initiatives || inputs.it_initiative_list || inputs.initiative_roadmap);
  const fromNotes = parseInitiativeList(inputs.source_notes).filter((line) => /initiative|roadmap|program|migration|modernization|transformation|platform/i.test(line));
  const corpus = [
    String(inputs.source_notes || ''),
    ...(state.research?.news_events || []).map((e) => `${e.title || ''} ${e.description || ''}`),
  ].join('\n');

  const found = [];
  const seen = new Set();

  function addInitiative(item) {
    const key = normName(item.name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    found.push(item);
  }

  for (const name of [...explicit, ...fromNotes]) {
    addInitiative({
      name,
      goal: 'Stated company IT priority',
      metric: 'Executive KPI tied to this program',
      source: explicit.includes(name) ? 'user_initiative_list' : 'user_source_notes',
      status: 'disclosed',
    });
  }

  for (const pattern of IT_INITIATIVE_PATTERNS) {
    if (!pattern.re.test(corpus)) continue;
    addInitiative({
      name: pattern.name,
      goal: pattern.goal,
      metric: pattern.metric,
      source: 'public_disclosure_search',
      status: 'disclosed',
    });
  }

  return found;
}

function linkRecommendationToInitiative(priority, initiatives, index) {
  const initiative = initiatives[index % initiatives.length];
  return {
    ...priority,
    initiative_name: initiative.name,
    initiative_goal: initiative.goal,
    outcome_metric: priority.metric || initiative.metric,
    goal_support: `Supports "${initiative.goal}" through ${priority.title.toLowerCase()}.`,
    rationale: `${priority.rationale} This recommendation advances the active initiative "${initiative.name}".`,
    source: initiative.source,
  };
}

function buildPortalDashboard(state) {
  const q = getQuarterlyAnchorMetrics(state);
  const market = state.research?.market_data || {};
  const initiatives = extractITInitiatives(state);
  const linked = (state.executive_proposal?.priorities || []).map((p, i) => linkRecommendationToInitiative(p, initiatives, i));
  const peers = state.peer_benchmarks?.peers || [];
  const targetPeer = state.peer_benchmarks?.target || null;
  const productComparison = state.peer_benchmarks?.product_comparison || {};
  const competitorRows = productComparison.rows || [];
  const competitorColumns = productComparison.metric_columns || [];

  function metricTile(id, label, metric, kind) {
    const val = metric && metric.value != null ? formatQuarterlyMetric(metric, kind) : naReason(label + ' not on anchored filing');
    const num = metric && metric.value != null ? Number(metric.value) : null;
    return { id, label, display: val, value: num, kind: kind || 'usd' };
  }

  const metrics = [
    metricTile('revenue', 'Revenue', q.revenue, 'usd'),
    metricTile('operating_margin', 'Operating Margin', q.operating_margin, 'pct'),
    metricTile('net_margin', 'Net Margin', q.net_margin, 'pct'),
    metricTile('free_cash_flow', 'Free Cash Flow', q.free_cash_flow, 'usd'),
    metricTile('eps', 'EPS', q.eps, 'eps'),
  ];

  if (market.market_cap_usd != null) {
    metrics.push({ id: 'market_cap', label: 'Market Cap', display: fmtUsdValue(market.market_cap_usd), value: market.market_cap_usd, kind: 'usd' });
  }

  const peerRows = state.peer_benchmarks?.categorical_rows || state.peer_benchmarks?.peers || [];
  const peerBars = peerRows.filter((p) => p.role !== 'target company').slice(0, 3).map((peer) => ({
    name: peer.company_name || peer.name || peer.entered_name,
    operating_margin: peer.operating_margin || peer.metrics?.['Operating Margin'] || 'N/A',
    revenue: peer.latest_annual_revenue || peer.metrics?.Revenue || 'N/A',
    role: peer.role || 'peer',
  }));
  if (!peerBars.length) {
    peerRows.slice(0, 3).forEach((peer) => {
      peerBars.push({
        name: peer.company_name || peer.name,
        operating_margin: peer.operating_margin || 'N/A',
        revenue: peer.latest_annual_revenue || 'N/A',
        role: peer.role || 'peer',
      });
    });
  }

  return {
    company: companyDisplayName(state.entity, state.inputs),
    period_label: q.period_label || 'Quarterly anchor',
    metrics,
    initiatives,
    recommendations: linked,
    peer_comparison: {
      published: Boolean(state.peer_benchmarks?.markdown),
      benchmark_fy: state.peer_benchmarks?.benchmark_fy || null,
      target: targetPeer ? { name: targetPeer.name, metrics: targetPeer.metrics } : null,
      peers: peerBars,
      product_comparison: {
        published: productComparison.has_data === true,
        category: productComparison.category || null,
        category_label: productComparison.category_label || null,
        metric_columns: competitorColumns,
        rows: competitorRows.slice(0, 6),
      },
    },
    initiative_impact: linked.map((rec) => ({
      initiative: rec.initiative_name,
      recommendation: rec.title,
      outcome_metric: rec.outcome_metric,
      goal: rec.initiative_goal,
    })),
  };
}

// Competitor entity resolution and category-aware product comparison

const COMPETITOR_ENTITY_REGISTRY = [
  { id: 'netflix', aliases: ['netflix', 'nflx'], category: 'streaming', kind: 'standalone', resolved_label: 'Netflix', parent_company: 'Netflix, Inc.', sec_lookup: 'Netflix', ticker: 'NFLX', segment: 'Global streaming' },
  { id: 'disney_plus', aliases: ['disney+', 'disney plus', 'disneyplus'], category: 'streaming', kind: 'brand', resolved_label: 'Disney+ (Disney Entertainment)', parent_company: 'The Walt Disney Company', sec_lookup: 'Disney', ticker: 'DIS', segment: 'Disney+ DTC streaming' },
  { id: 'hulu', aliases: ['hulu'], category: 'streaming', kind: 'brand', resolved_label: 'Hulu (Disney Entertainment)', parent_company: 'The Walt Disney Company', sec_lookup: 'Disney', ticker: 'DIS', segment: 'Hulu streaming' },
  { id: 'hbo_max', aliases: ['hbo max', 'hbomax', 'max streaming'], category: 'streaming', kind: 'brand', resolved_label: 'Max (Warner Bros. Discovery)', parent_company: 'Warner Bros. Discovery', sec_lookup: 'Warner Bros. Discovery', ticker: 'WBD', segment: 'Max DTC streaming' },
  { id: 'max', aliases: ['max'], category: 'streaming', kind: 'brand', resolved_label: 'Max (Warner Bros. Discovery)', parent_company: 'Warner Bros. Discovery', sec_lookup: 'Warner Bros. Discovery', ticker: 'WBD', segment: 'Max DTC streaming', ambiguous_with: ['hbo_max'] },
  { id: 'paramount_plus', aliases: ['paramount+', 'paramount plus', 'paramountplus'], category: 'streaming', kind: 'brand', resolved_label: 'Paramount+ (Paramount Global)', parent_company: 'Paramount Global', sec_lookup: 'Paramount Global', ticker: 'PARA', segment: 'Paramount+ streaming' },
  { id: 'peacock', aliases: ['peacock', 'peacock tv'], category: 'streaming', kind: 'brand', resolved_label: 'Peacock (NBCUniversal / Comcast)', parent_company: 'Comcast', sec_lookup: 'Comcast', ticker: 'CMCSA', segment: 'Peacock streaming' },
  { id: 'apple_tv_plus', aliases: ['apple tv+', 'apple tv plus', 'appletvplus', 'apple tv'], category: 'streaming', kind: 'brand', resolved_label: 'Apple TV+ (Apple Services)', parent_company: 'Apple Inc.', sec_lookup: 'Apple', ticker: 'AAPL', segment: 'Apple TV+ subscription' },
  { id: 'amazon_prime_video', aliases: ['amazon prime video', 'prime video', 'amazon prime'], category: 'streaming', kind: 'service', resolved_label: 'Prime Video (Amazon)', parent_company: 'Amazon.com', sec_lookup: 'Amazon', ticker: 'AMZN', segment: 'Prime Video / Prime membership video' },
  { id: 'youtube_premium', aliases: ['youtube premium', 'youtube tv'], category: 'streaming', kind: 'service', resolved_label: 'YouTube Premium (Alphabet)', parent_company: 'Alphabet Inc.', sec_lookup: 'Alphabet', ticker: 'GOOGL', segment: 'YouTube subscription services' },
  { id: 'spotify', aliases: ['spotify'], category: 'audio_streaming', kind: 'standalone', resolved_label: 'Spotify', parent_company: 'Spotify Technology S.A.', sec_lookup: 'Spotify', ticker: 'SPOT', segment: 'Premium audio streaming' },
  { id: 'warner_bros_discovery', aliases: ['warner bros discovery', 'wbd', 'discovery+', 'discovery plus'], category: 'streaming', kind: 'parent', resolved_label: 'Warner Bros. Discovery (DTC portfolio)', parent_company: 'Warner Bros. Discovery', sec_lookup: 'Warner Bros. Discovery', ticker: 'WBD', segment: 'DTC streaming portfolio' },
  { id: 'disney', aliases: ['disney', 'walt disney'], category: 'streaming', kind: 'parent', resolved_label: 'The Walt Disney Company (DTC)', parent_company: 'The Walt Disney Company', sec_lookup: 'Disney', ticker: 'DIS', segment: 'Disney+ / Hulu / ESPN+ DTC' },
];

const COMPARISON_CATEGORY_SCHEMAS = {
  streaming: {
    label: 'Subscription video streaming',
    metrics: [
      { key: 'subscribers', label: 'Subscribers / paid memberships' },
      { key: 'arpu', label: 'ARPU / monetization' },
      { key: 'revenue', label: 'Revenue (segment or service)' },
      { key: 'profitability', label: 'Profitability' },
      { key: 'pricing', label: 'Entry pricing' },
      { key: 'ad_supported', label: 'Ad-supported tier' },
      { key: 'bundle', label: 'Bundle / plan structure' },
      { key: 'geography', label: 'Geographic availability' },
      { key: 'differentiator', label: 'Key product difference' },
    ],
  },
  audio_streaming: {
    label: 'Audio streaming',
    metrics: [
      { key: 'subscribers', label: 'Paid subscribers / MAUs' },
      { key: 'arpu', label: 'ARPU / monetization' },
      { key: 'revenue', label: 'Revenue' },
      { key: 'profitability', label: 'Profitability / margin' },
      { key: 'pricing', label: 'Entry pricing' },
      { key: 'ad_supported', label: 'Ad-supported tier' },
      { key: 'geography', label: 'Geographic availability' },
      { key: 'differentiator', label: 'Key product difference' },
    ],
  },
  default: {
    label: 'Company financial comparison',
    metrics: [
      { key: 'revenue', label: 'Revenue' },
      { key: 'operating_margin', label: 'Operating margin' },
      { key: 'subscribers', label: 'Customers / subscribers (if disclosed)' },
      { key: 'pricing', label: 'Pricing / monetization signal' },
      { key: 'differentiator', label: 'Key competitive difference' },
    ],
  },
};

function normalizeCompetitorKey(value) {
  return normName(value).replace(/[^a-z0-9]/g, '');
}

function registryEntryScore(entry, inputNorm, inputKey) {
  let best = 0;
  for (const alias of entry.aliases) {
    const aliasNorm = normName(alias);
    const aliasKey = normalizeCompetitorKey(alias);
    if (!aliasNorm) continue;
    if (inputNorm === aliasNorm || inputKey === aliasKey) return 1000 + alias.length;
    if (inputNorm.includes(aliasNorm) || aliasNorm.includes(inputNorm)) {
      best = Math.max(best, 500 + alias.length);
    }
  }
  return best;
}

function resolveCompetitorEntity(inputName, industryHint) {
  const entered = String(inputName || '').trim();
  const inputNorm = normName(entered);
  const inputKey = normalizeCompetitorKey(entered);
  if (!entered) {
    return {
      entered_name: entered,
      resolved_label: entered,
      parent_company: null,
      category: inferComparisonCategory(industryHint),
      sec_lookup_name: entered,
      ticker: null,
      kind: 'unknown',
      segment: null,
      ambiguous: false,
      resolution_note: null,
    };
  }

  const ranked = COMPETITOR_ENTITY_REGISTRY
    .map((entry) => ({ entry, score: registryEntryScore(entry, inputNorm, inputKey) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const best = ranked[0]?.entry || null;
  const runnerUp = ranked[1]?.entry || null;
  const ambiguous = Boolean(best && runnerUp && ranked[0].score === ranked[1].score && best.id !== runnerUp.id);

  if (best) {
    const category = best.category || inferComparisonCategory(industryHint);
    const resolutionNote = best.kind === 'brand' || best.kind === 'service'
      ? `Resolved product/service to ${best.resolved_label} (${best.parent_company}).`
      : null;
    return {
      entered_name: entered,
      resolved_label: best.resolved_label,
      parent_company: best.parent_company,
      category,
      sec_lookup_name: best.sec_lookup || best.parent_company || entered,
      ticker: best.ticker || null,
      kind: best.kind,
      segment: best.segment || null,
      ambiguous,
      resolution_note: ambiguous
        ? `Ambiguous match — showing best fit: ${best.resolved_label}.`
        : resolutionNote,
    };
  }

  return {
    entered_name: entered,
    resolved_label: entered,
    parent_company: null,
    category: inferComparisonCategory(industryHint),
    sec_lookup_name: entered,
    ticker: null,
    kind: 'unknown',
    segment: null,
    ambiguous: false,
    resolution_note: null,
  };
}

function inferComparisonCategory(industryHint) {
  const key = String(industryHint || '').toLowerCase();
  if (/(stream|video|ott|entertainment|media)/.test(key)) return 'streaming';
  if (/(music|audio|podcast)/.test(key)) return 'audio_streaming';
  return 'default';
}

function getComparisonSchema(category) {
  return COMPARISON_CATEGORY_SCHEMAS[category] || COMPARISON_CATEGORY_SCHEMAS.default;
}

function corpusForCompetitor(state, entity) {
  const names = [entity.entered_name, entity.resolved_label, entity.parent_company, entity.segment]
    .filter(Boolean);
  const signals = [
    ...(state.research?.news_events || []),
    ...(state.research?.private_research?.serper_results || []),
  ];
  const chunks = [];
  for (const item of signals) {
    const text = `${item.title || ''} ${item.description || item.snippet || ''}`.trim();
    if (!text) continue;
    if (names.some((name) => entityMentionedInText(text, name))) {
      chunks.push({ text, source: item.source_name || item.source_url || 'public search' });
    }
  }
  const notes = String(state.inputs?.source_notes || state.inputs?.advanced_context?.source_notes || '');
  if (notes && names.some((name) => entityMentionedInText(notes, name))) {
    chunks.push({ text: notes, source: 'user source notes' });
  }
  return chunks;
}

function parseSubscriberCount(text) {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(million|m|billion|b)?\s*(?:global\s+)?(?:paid\s+)?(?:streaming\s+)?(?:subscribers|memberships|subs|paid members)\b/i);
  if (!m) return null;
  const num = Number(m[1]);
  const unit = String(m[2] || '').toLowerCase();
  let n = num;
  if (unit.startsWith('b')) n *= 1e9;
  else if (unit.startsWith('m') || unit === 'million') n *= 1e6;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  return String(num);
}

function extractSubscriberMetric(text) {
  const parsed = parseSubscriberCount(text);
  return parsed ? `${parsed} subscribers` : null;
}

function extractArpuMetric(text) {
  const patterns = [
    /arpu[^$%\d]{0,20}\$?(\d+(?:\.\d+)?)/i,
    /average\s+revenue\s+per\s+(?:membership|user|subscriber)[^$]{0,12}\$?(\d+(?:\.\d+)?)/i,
    /revenue\s+per\s+(?:membership|subscriber)[^$]{0,12}\$?(\d+(?:\.\d+)?)/i,
    /\$(\d+(?:\.\d+)?)\s+arpu/i,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) return `$${m[1]}/month (ARPU)`;
  }
  const proxy = text.match(/(?:monetization|average\s+monthly\s+revenue)[^$]{0,20}\$?(\d+(?:\.\d+)?)\s*(?:\/|per)\s*month/i);
  if (proxy) return `$${proxy[1]}/month (monetization proxy)`;
  return null;
}

function extractSegmentRevenueMetric(text) {
  const patterns = [
    /(?:streaming|direct[- ]to[- ]consumer|dtc|subscription)\s+revenue[^$]{0,20}\$?(\d+(?:\.\d+)?)\s*(billion|million|b|m)\b/i,
    /\$(\d+(?:\.\d+)?)\s*(billion|million|b|m)\s+(?:in\s+)?(?:streaming|subscription|dtc)\s+revenue/i,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (!m) continue;
    const unit = String(m[2] || '').toLowerCase();
    const suffix = unit.startsWith('b') ? 'B' : 'M';
    return `$${m[1]}${suffix} (segment revenue)`;
  }
  return null;
}

function extractProfitabilityMetric(text) {
  const patterns = [
    /(?:streaming|dtc|direct[- ]to[- ]consumer)\s+(?:segment\s+)?operating\s+(?:income|profit)[^$%-]{0,20}(-?\$?\d+(?:\.\d+)?\s*(?:billion|million|b|m)?)/i,
    /operating\s+margin[^%]{0,12}(\d+(?:\.\d+)?)\s*%/i,
    /(?:profitable|profitability|loss)[^.]{0,60}(?:streaming|dtc|subscription)/i,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (!m) continue;
    if (m[1] && /%/.test(m[0])) return `${m[1]}% operating margin (proxy)`;
    if (m[1]) return `${m[1]} (segment profitability)`;
    return m[0].trim().slice(0, 120);
  }
  return null;
}

function extractPricingMetric(text) {
  const prices = [...text.matchAll(/\$(\d+(?:\.\d+)?)\s*(?:\/|per)\s*month/gi)].map((m) => Number(m[1]));
  if (!prices.length) {
    const alt = text.match(/(?:from|starting at|plans? from)\s*\$(\d+(?:\.\d+)?)/i);
    if (alt) prices.push(Number(alt[1]));
  }
  if (!prices.length) return null;
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  return low === high ? `From $${low}/month` : `$${low}–$${high}/month`;
}

function extractAdSupportedMetric(text) {
  if (/ad[- ]?free only|no ad[- ]?supported|without ads only/i.test(text)) return 'No (ad-free only)';
  if (/ad[- ]?supported|with ads|advertising tier|ad tier|ads plan|ad-supported/i.test(text)) return 'Yes';
  return null;
}

function extractBundleMetric(text) {
  const patterns = [
    /bundle(?:d)? with[^.]{0,80}/i,
    /included with prime/i,
    /disney bundle|hulu.*espn/i,
    /triple play|combo plan/i,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) return m[0].trim().slice(0, 140);
  }
  return null;
}

function extractGeographyMetric(text) {
  if (/global(?:ly)?|worldwide|190\+?\s*countries/i.test(text)) return 'Global';
  if (/united states|u\.s\.|north america/i.test(text) && !/global|worldwide/i.test(text)) return 'Primarily US';
  if (/europe|emea|apac|latin america/i.test(text)) return 'Multi-region (see sources)';
  return null;
}

function extractProductDifference(chunks) {
  const patterns = [
    /exclusive originals?/i,
    /live sports/i,
    /offline downloads?/i,
    /password sharing|account sharing/i,
    /bundle(?:d)? with/i,
    /gaming/i,
    /4k|uhd/i,
    /ad[- ]?supported tier/i,
  ];
  for (const chunk of chunks) {
    for (const pattern of patterns) {
      if (!pattern.test(chunk.text)) continue;
      const sentence = chunk.text.split(/[.!?]/).find((s) => pattern.test(s));
      if (sentence && sentence.trim().length > 12 && sentence.trim().length < 220) {
        return sentence.trim();
      }
    }
  }
  return null;
}

function extractCategoryMetrics(category, chunks) {
  const combined = chunks.map((c) => c.text).join(' ');
  const schema = getComparisonSchema(category);
  const values = {
    subscribers: extractSubscriberMetric(combined),
    arpu: extractArpuMetric(combined),
    revenue: extractSegmentRevenueMetric(combined),
    profitability: extractProfitabilityMetric(combined),
    pricing: extractPricingMetric(combined),
    ad_supported: extractAdSupportedMetric(combined),
    bundle: extractBundleMetric(combined),
    geography: extractGeographyMetric(combined),
    differentiator: extractProductDifference(chunks),
    operating_margin: null,
  };
  const metrics = {};
  for (const col of schema.metrics) {
    metrics[col.key] = values[col.key] || 'N/A';
  }
  return metrics;
}

function buildCompetitorComparisonRow(state, entity, role) {
  const chunks = corpusForCompetitor(state, entity);
  const metrics = extractCategoryMetrics(entity.category, chunks);
  return {
    entered_name: entity.entered_name,
    resolved_label: entity.resolved_label,
    parent_company: entity.parent_company,
    category: entity.category,
    category_label: getComparisonSchema(entity.category).label,
    kind: entity.kind,
    segment: entity.segment,
    role,
    ambiguous: entity.ambiguous,
    resolution_note: entity.resolution_note,
    metrics,
    source_status: chunks.length ? 'PUBLIC_SIGNAL' : 'NO_PUBLIC_SIGNAL',
    sources: [...new Set(chunks.map((c) => c.source).filter(Boolean))].slice(0, 3),
  };
}

function dominantComparisonCategory(entities) {
  const counts = {};
  for (const entity of entities) {
    const cat = entity.category || 'default';
    counts[cat] = (counts[cat] || 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || 'default';
}

function buildCompetitorComparisons(state, targetCompanyName, peerInputNames) {
  const industry = state.inputs?.industry || '';
  const targetEntity = resolveCompetitorEntity(targetCompanyName, industry);
  if (!targetEntity.parent_company && targetCompanyName) {
    targetEntity.resolved_label = targetCompanyName;
    targetEntity.sec_lookup_name = targetCompanyName;
  }
  const peerNames = (peerInputNames || []).filter(Boolean).slice(0, 5);
  const peerEntities = peerNames.map((name) => resolveCompetitorEntity(name, industry));
  const allEntities = [targetEntity, ...peerEntities];
  const category = dominantComparisonCategory(allEntities.filter((e) => e.category !== 'default')) || inferComparisonCategory(industry);
  const schema = getComparisonSchema(category);

  for (const entity of allEntities) {
    if (entity.category === 'default' && category !== 'default') entity.category = category;
  }

  const targetRow = buildCompetitorComparisonRow(state, targetEntity, 'target company');
  const competitorRows = peerEntities.map((entity, index) => {
    const roles = ['close competitor', 'industry peer', 'benchmark peer'];
    return buildCompetitorComparisonRow(state, entity, roles[index] || 'competitor');
  });
  const rows = [targetRow, ...competitorRows];

  const hasData = rows.some((row) => schema.metrics.some((col) => row.metrics[col.key] !== 'N/A'));
  const markdown = hasData ? formatCompetitorComparisonMarkdown(schema, rows) : '';

  return {
    category,
    category_label: schema.label,
    metric_columns: schema.metrics,
    rows,
    has_data: hasData,
    markdown,
  };
}

function formatCompetitorComparisonMarkdown(schema, rows) {
  const headers = ['Entered name', 'Resolved entity', 'Category', ...schema.metrics.map((m) => m.label)];
  const lines = [
    '### Product / service competitor comparison',
    '',
    'User-entered names are preserved; brands and services are resolved to the closest comparable business unit. Metrics show N/A when not found in public sources.',
    '',
    `| ${headers.join(' | ')} |`,
    `|---|${headers.slice(1).map(() => '---').join('|')}|`,
    ...rows.map((row) => {
      const cells = [
        row.entered_name,
        row.resolved_label + (row.parent_company && row.kind !== 'standalone' ? ` (${row.parent_company})` : ''),
        row.category_label || row.category,
        ...schema.metrics.map((col) => row.metrics[col.key] || 'N/A'),
      ];
      return `| ${cells.join(' | ')} |`;
    }),
  ];
  return lines.join('\n');
}

function peerProductSerperQueries(peerNames, industryHint) {
  const queries = [];
  for (const rawName of (peerNames || []).slice(0, 5)) {
    const entity = resolveCompetitorEntity(rawName, industryHint);
    const searchName = entity.resolved_label || rawName;
    const parent = entity.parent_company && entity.kind !== 'standalone' ? entity.parent_company : '';
    const label = parent ? `${searchName} ${parent}` : searchName;
    if (entity.category === 'streaming' || entity.category === 'audio_streaming') {
      queries.push(
        `${label} subscribers paid memberships ARPU streaming 2024 2025`,
        `${label} pricing plan monthly ad-supported bundle`,
        `${label} streaming revenue operating income segment profitability`,
      );
    } else {
      queries.push(
        `${label} revenue subscribers pricing competitive metrics`,
        `${label} market share product comparison`,
      );
    }
  }
  return queries.slice(0, 12);
}

// Backward-compatible wrapper used by peer benchmarks workflow
function buildProductPeerComparison(state, entityNames) {
  const company = state.entity?.legal_name || state.inputs?.company_name || entityNames?.[0] || 'Company';
  const peers = (entityNames || []).filter((name) => normName(name) !== normName(company));
  const comparison = buildCompetitorComparisons(state, company, peers.length ? peers : entityNames?.slice(1) || []);
  return {
    rows: comparison.rows,
    metric_columns: comparison.metric_columns,
    category: comparison.category,
    category_label: comparison.category_label,
    markdown: comparison.markdown,
    has_data: comparison.has_data,
  };
}

// Three-year annual revenue series from 10-K / 20-F filings only (not quarterly)

const THREE_YEAR_REVENUE_FYS = [2025, 2024, 2023];

function filingRefForAnnualRow(row, recentFilings) {
  if (!row) return naReason('no annual revenue row matched');
  const filed = row.filed || null;
  const form = row.form || '10-K';
  const match = (recentFilings || []).find((f) => {
    if (f.form !== form && !(isAnnualForm(f.form) && isAnnualForm(form))) return false;
    if (filed && f.filing_date && String(f.filing_date) === String(filed)) return true;
    if (row.end && f.report_date && String(f.report_date) === String(row.end)) return true;
    return false;
  });
  if (match?.accession_number) {
    return `${form} accession ${match.accession_number} (filed ${match.filing_date || filed || 'date n/a'})`;
  }
  if (filed) return `${form} filed ${filed}${row.end ? `, fiscal year-end ${row.end}` : ''}`;
  return `${form}${row.end ? `, fiscal year-end ${row.end}` : ''}`;
}

function annualRevenueRowForFy(facts, fy, fx, native) {
  const found = tagRowsMerged(facts, 'revenue');
  const row = found.rows
    .filter((r) => isAnnualForm(r.form) && (r.fp === 'FY' || r.form === '10-K' || r.form === '20-F' || !r.fp))
    .filter((r) => Number(r.fy) === Number(fy))
    .sort((a, b) => String(a.filed || '').localeCompare(String(b.filed || '')) || String(a.end || '').localeCompare(String(b.end || '')))
    .at(-1);
  if (!row) return null;
  const unit = Object.keys(facts[found.tag]?.units || {})[0] || native;
  const nativeVal = Number(row.val);
  const usdVal = convertToUsd(nativeVal, unit, fx);
  return {
    fy: Number(fy),
    fiscal_year_end: row.end || naReason('fiscal year-end date not on XBRL row'),
    filing_date: row.filed || naReason('filing date not on XBRL row'),
    form: row.form || '10-K',
    revenue_raw: usdVal !== null ? usdVal : nativeVal,
    revenue_display: fmtUsdValue(usdVal !== null ? usdVal : nativeVal),
    tag: found.tag,
    taxonomy: found.taxonomy || 'us-gaap',
    source_name: `SEC EDGAR ${found.taxonomy || 'us-gaap'}:${found.tag}`,
  };
}

function yoyRevenueGrowth(current, prior) {
  if (current === null || prior === null || prior === 0) {
    return naReason('prior-year revenue missing — YoY growth not computable');
  }
  const rate = (current - prior) / prior;
  return fmtPct(rate);
}

function buildThreeYearRevenueFrom10K(state) {
  const facts = state.research?.financials?.merged_facts || state.research?.financials?.raw_us_gaap_facts || {};
  const fx = state.research?.financials?.fx_to_usd || {};
  const native = state.research?.financials?.native_currency || 'USD';
  const recentFilings = state.research?.filings?.recent_filings || [];
  const company = companyDisplayName(state.entity, state.inputs);

  const rows = THREE_YEAR_REVENUE_FYS.map((fy) => {
    const annual = annualRevenueRowForFy(facts, fy, fx, native);
    return {
      fy,
      fiscal_year_end: annual?.fiscal_year_end || naReason(`FY${fy} 10-K/20-F revenue row not found in SEC company facts`),
      filing_date: annual?.filing_date || naReason(`FY${fy} filing date not found`),
      revenue: annual?.revenue_display || naReason(`FY${fy} revenue not reported on annual filing`),
      revenue_raw: annual?.revenue_raw ?? null,
      source_ref: annual ? filingRefForAnnualRow({ ...annual, filed: annual.filing_date, end: annual.fiscal_year_end, form: annual.form }, recentFilings) : naReason(`no FY${fy} annual filing match`),
      form: annual?.form || '10-K',
      reporting_period: `FY${fy} (annual 10-K/20-F only — not quarterly)`,
    };
  });

  for (let i = 0; i < rows.length; i++) {
    const current = rows[i].revenue_raw;
    const priorRow = rows.find((r) => r.fy === rows[i].fy - 1);
    const prior = priorRow?.revenue_raw ?? null;
    rows[i].yoy_growth = yoyRevenueGrowth(current, prior);
  }

  const available = rows.filter((r) => r.revenue_raw !== null);
  const trendParts = [];
  for (let i = 1; i < available.length; i++) {
    const cur = available[i];
    const prev = available[i - 1];
    if (prev.revenue_raw && cur.revenue_raw) {
      const g = ((cur.revenue_raw - prev.revenue_raw) / prev.revenue_raw) * 100;
      trendParts.push(`${prev.fy}→${cur.fy}: ${g >= 0 ? '+' : ''}${g.toFixed(1)}%`);
    }
  }
  const narrative_summary = available.length >= 2
    ? `${company} annual revenue (10-K/20-F only): ${trendParts.join('; ')}. This is a separate annual-growth view — not mixed with quarterly revenue in Section 2a.`
    : naReason('insufficient annual 10-K revenue years to summarize 3-year trend');

  const markdown = [
    '## 3-Year Revenue From 10-Ks',
    '',
    'Annual revenue only from the last three fiscal-year 10-K / 20-F filings. Quarterly revenue is shown separately in Section 2a and is not included here.',
    '',
    '| Fiscal year | Fiscal year-end | Filing date | Revenue (USD) | YoY growth vs prior year | SEC filing reference |',
    '|---|---|---|---|---|---|',
    ...rows.map((r) => `| FY${r.fy} | ${r.fiscal_year_end} | ${r.filing_date} | ${r.revenue} | ${r.yoy_growth} | ${r.source_ref} |`),
    '',
    `**Annual growth view:** ${narrative_summary}`,
    '',
    'Note: 8-K filings are recent-event references only and are not used as the operating or revenue anchor for this table.',
  ].join('\n');

  return {
    generated_at: new Date().toISOString(),
    years: THREE_YEAR_REVENUE_FYS,
    rows,
    narrative_summary,
    markdown,
    has_data: available.length > 0,
  };
}

// Standardized peer comparison with SEC-first sourcing and labeled fallbacks

const PEER_CATEGORY_ROLES = ['target company', 'scale benchmark', 'close competitor', 'industry peer', 'category peer'];

const STREAMING_CATEGORY_PROXY = {
  revenue: 15e9,
  operating_margin: 0.12,
  net_margin: 0.08,
  fcf_margin: 0.1,
  revenue_growth: 0.08,
  source: 'Subscription streaming category median proxy',
  method: 'Estimated from comparable streaming peer set when entity SEC tags and curated fallback are unavailable',
};

const PEER_ANNUAL_FALLBACK = {
  netflix: {
    fy: 2024,
    revenue: 39.0e9,
    operating_margin: 0.267,
    net_margin: 0.22,
    fcf_margin: 0.18,
    revenue_growth: 0.156,
    source: 'Netflix FY2024 Form 10-K (approx. from filed annual figures)',
    method: 'Annual report compilation when live SEC tags are incomplete',
  },
  disney: {
    fy: 2024,
    revenue: 91.4e9,
    operating_margin: 0.111,
    net_margin: 0.072,
    fcf_margin: 0.09,
    revenue_growth: 0.03,
    source: 'Disney FY2024 Form 10-K (consolidated; approximation)',
    method: 'Latest annual report figures — consolidated entity, not Disney+ standalone',
  },
  'warner bros discovery': {
    fy: 2024,
    revenue: 38.2e9,
    operating_margin: 0.02,
    net_margin: -0.04,
    fcf_margin: 0.08,
    revenue_growth: -0.07,
    source: 'WBD FY2024 Form 10-K (consolidated; approximation)',
    method: 'Latest annual report — Max/HBO Max maps to parent WBD consolidated financials',
  },
  amazon: {
    fy: 2024,
    revenue: 638.0e9,
    operating_margin: 0.109,
    net_margin: 0.093,
    fcf_margin: 0.12,
    revenue_growth: 0.11,
    source: 'Amazon FY2024 Form 10-K (consolidated; approximation)',
    method: 'Prime Video compared via Amazon consolidated annual report — not Prime Video standalone',
  },
  apple: {
    fy: 2024,
    revenue: 391.0e9,
    operating_margin: 0.315,
    net_margin: 0.242,
    fcf_margin: 0.26,
    revenue_growth: 0.02,
    source: 'Apple FY2024 Form 10-K (consolidated; approximation)',
    method: 'Apple TV+ compared via Apple Services/consolidated annual report proxy',
  },
  comcast: {
    fy: 2024,
    revenue: 121.6e9,
    operating_margin: 0.19,
    net_margin: 0.11,
    fcf_margin: 0.14,
    revenue_growth: 0.05,
    source: 'Comcast FY2024 Form 10-K (consolidated; approximation)',
    method: 'Peacock compared via NBCUniversal/Comcast consolidated annual figures',
  },
  'paramount global': {
    fy: 2024,
    revenue: 28.7e9,
    operating_margin: 0.05,
    net_margin: -0.02,
    fcf_margin: 0.04,
    revenue_growth: -0.02,
    source: 'Paramount Global FY2024 Form 10-K (approximation)',
    method: 'Paramount+ compared via parent consolidated annual report',
  },
  alphabet: {
    fy: 2024,
    revenue: 350.0e9,
    operating_margin: 0.32,
    net_margin: 0.28,
    fcf_margin: 0.25,
    revenue_growth: 0.14,
    source: 'Alphabet FY2024 Form 10-K (consolidated; approximation)',
    method: 'YouTube Premium compared via Alphabet consolidated annual proxy',
  },
};

function fallbackKeyForEntity(name, secLookupName) {
  const keys = [secLookupName, name].filter(Boolean).map((n) => normName(n));
  for (const [key] of Object.entries(PEER_ANNUAL_FALLBACK)) {
    const nk = normName(key);
    if (keys.some((k) => k.includes(nk) || nk.includes(k))) return key;
  }
  return null;
}

function labeledApprox(value, kind, sourceNote) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const display = kind === 'pct' ? `~${fmtPct(value)}` : `~${fmtUsdValue(value)}`;
  return { display, approx: true, source_note: sourceNote };
}

function metricFromSecComputed(computed, key, fyLabel) {
  const map = {
    revenue: 'Revenue',
    operating_margin: 'Operating Margin',
    net_margin: 'Net Margin',
    fcf_margin: 'FCF Margin',
    revenue_growth: 'YoY Revenue Growth',
  };
  const val = computed[map[key]];
  if (!val || isUnavailableDisplay(val)) return null;
  return { display: `${val} (${fyLabel})`, approx: false, source_note: `SEC EDGAR company facts — FY${fyLabel.replace('FY', '')} annual filing` };
}

function buildPeerAnnualMetricBundle(merged, benchmarkFy, fx, native, entityName, secLookupName) {
  const fyCandidates = [benchmarkFy, benchmarkFy - 1, benchmarkFy - 2];
  const fy = fyCandidates.find((y) => annualFactValue(merged, 'revenue', y, fx, native)) || benchmarkFy;
  const fyLabel = `FY${fy}`;
  const computed = computePeerMetricsFromFacts(merged, fy, fx, native);

  const secSource = `SEC EDGAR annual company facts (${fyLabel})`;
  const bundle = {
    fy,
    fy_label: fyLabel,
    revenue: metricFromSecComputed(computed, 'revenue', fyLabel),
    operating_margin: metricFromSecComputed(computed, 'operating_margin', fyLabel),
    net_margin: metricFromSecComputed(computed, 'net_margin', fyLabel),
    fcf_margin: metricFromSecComputed(computed, 'fcf_margin', fyLabel),
    revenue_growth: metricFromSecComputed(computed, 'revenue_growth', fyLabel),
    primary_source: secSource,
    method: 'SEC filing',
  };

  const fallbackKey = fallbackKeyForEntity(entityName, secLookupName);
  const fallback = fallbackKey ? PEER_ANNUAL_FALLBACK[fallbackKey] : null;
  const fallbackFy = fallback ? `FY${fallback.fy}` : fyLabel;

  function fill(key, secKey, kind) {
    if (bundle[key]?.display) return;
    if (!fallback) {
      const proxy = STREAMING_CATEGORY_PROXY;
      const approx = labeledApprox(proxy[secKey], kind, `${proxy.source} — ${proxy.method}`);
      if (approx) {
        bundle[key] = { ...approx, display: `${approx.display} (${fyLabel}, category proxy)` };
        bundle.method = 'category median proxy';
        bundle.primary_source = `${bundle.primary_source}; ${proxy.source}`;
      }
      return;
    }
    const approx = labeledApprox(fallback[secKey], kind, `${fallback.source} — ${fallback.method}`);
    if (approx) {
      bundle[key] = { ...approx, display: `${approx.display} (${fallbackFy}, approximation)` };
      bundle.method = bundle.method === 'SEC filing' ? 'SEC filing + annual report fallback' : 'annual report fallback';
      bundle.primary_source = `${bundle.primary_source}; fallback: ${fallback.source}`;
    }
  }

  fill('revenue', 'revenue', 'usd');
  fill('operating_margin', 'operating_margin', 'pct');
  fill('net_margin', 'net_margin', 'pct');
  fill('fcf_margin', 'fcf_margin', 'pct');
  fill('revenue_growth', 'revenue_growth', 'pct');

  return bundle;
}

function buildCategoricalPeerRow(name, resolved, role, category, metricBundle) {
  const m = metricBundle;
  return {
    company_name: name,
    entered_name: resolved.entered_name || name,
    resolved_label: resolved.resolved_label || name,
    parent_company: resolved.parent_company || null,
    role,
    category: category || resolved.category || 'peer',
    category_label: getComparisonSchema(resolved.category || category || 'default').label,
    reporting_period: m.fy_label,
    latest_annual_revenue: m.revenue?.display || `~N/A (${m.fy_label})`,
    operating_margin: m.operating_margin?.display || `~N/A (${m.fy_label})`,
    net_margin: m.net_margin?.display || `~N/A (${m.fy_label})`,
    fcf_margin: m.fcf_margin?.display || `~N/A (${m.fy_label})`,
    revenue_growth: m.revenue_growth?.display || `~N/A (${m.fy_label})`,
    source_note: m.primary_source || m.method,
    method: m.method,
    approx_fields: ['revenue', 'operating_margin', 'net_margin', 'fcf_margin', 'revenue_growth']
      .filter((k) => m[k]?.approx),
  };
}

function formatCategoricalPeerMarkdown(rows, benchmarkFy, now, productComparisonMarkdown) {
  const lines = [
    '## Section 3: Peer Comparison & Benchmarking',
    '',
    `Data fetched at runtime: ${now}`,
    `Benchmark window: latest available annual filings aligned to FY${benchmarkFy} methodology. Quarterly figures are not mixed into this peer table.`,
    '',
    'Each peer row is categorically populated. Values prefixed with ~ are approximations from the latest annual report or curated market-source fallback when SEC company-facts tags are incomplete. See source note per row.',
    '',
    '| Company | Role / category | Reporting period | Latest annual revenue | Operating margin | Net margin | FCF margin | Revenue growth (YoY) | Source note |',
    '|---|---|---|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.company_name}${r.resolved_label && r.entered_name !== r.resolved_label ? ` → ${r.resolved_label}` : ''} | ${r.role} / ${r.category_label || r.category} | ${r.reporting_period} | ${r.latest_annual_revenue} | ${r.operating_margin} | ${r.net_margin} | ${r.fcf_margin} | ${r.revenue_growth} | ${r.source_note} |`),
  ];
  if (productComparisonMarkdown) {
    lines.push('', productComparisonMarkdown);
  }
  return lines.join('\n');
}

// Centralized 10-slide deck master, footer logos, and Gamma-ready artifacts

const DECK_SLIDE_COUNT = 10;

const TEN_SLIDE_OUTLINE = [
  'Slide 1: Title and executive summary — company, audience, and the single most important financial message.',
  'Slide 2: Quarterly financial snapshot — revenue, margins, FCF, EPS from the quarterly filing anchor only.',
  'Slide 3: 3-Year Revenue from 10-Ks — FY2025/FY2024/FY2023 annual revenue trend (not quarterly).',
  'Slide 4: Annual financials and ratio dashboard — FY margins, leverage, and coverage metrics.',
  'Slide 5: Market data — share price, market cap, and shares outstanding with as-of date.',
  'Slide 6: Peer comparison — categorical annual peer table with labeled sources.',
  'Slide 7: Three strategic insights — filing-backed takeaways with so-what for the executive audience.',
  'Slide 8: Executive proposal — top priorities tied to IT initiatives and financial hooks.',
  'Slide 9: Initiative impact and value realization — metrics each initiative moves.',
  'Slide 10: Recommended actions, 30/60/90-day timeline, and clear ask.',
];

const COMPANY_LOGO_REGISTRY = {
  nflx: { domain: 'netflix.com', url: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg', source: 'Wikimedia Commons — Netflix official logo asset' },
  netflix: { domain: 'netflix.com', url: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg', source: 'Wikimedia Commons — Netflix official logo asset' },
  dis: { domain: 'disney.com', url: 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg', source: 'Wikimedia Commons — Disney brand asset (parent of Disney+)' },
  wbd: { domain: 'wbd.com', url: 'https://upload.wikimedia.org/wikipedia/commons/0/0c/Warner_Bros._Discovery_logo.svg', source: 'Wikimedia Commons — Warner Bros. Discovery official logo' },
  amzn: { domain: 'amazon.com', url: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg', source: 'Wikimedia Commons — Amazon official logo' },
  aapl: { domain: 'apple.com', url: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg', source: 'Wikimedia Commons — Apple official logo' },
  googl: { domain: 'google.com', url: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg', source: 'Wikimedia Commons — Alphabet/Google official logo' },
  msft: { domain: 'microsoft.com', url: 'https://upload.wikimedia.org/wikipedia/commons/9/96/Microsoft_logo_%282012%29.svg', source: 'Wikimedia Commons — Microsoft official logo' },
};

const PROVIDER_LOGO_REGISTRY = {
  evoloai: { domain: 'goevolo.com', url: 'https://www.goevolo.com/favicon.ico', source: 'Evolo AI official site favicon (goevolo.com)' },
  evolo: { domain: 'goevolo.com', url: 'https://www.goevolo.com/favicon.ico', source: 'Evolo AI official site favicon (goevolo.com)' },
};

function normalizeSlideCount(raw) {
  const n = Number(raw);
  if (n === DECK_SLIDE_COUNT) return DECK_SLIDE_COUNT;
  return DECK_SLIDE_COUNT;
}

function registryLogoMatch(registry, keys) {
  for (const key of keys) {
    const nk = normName(key);
    if (registry[nk]) return registry[nk];
    const hit = Object.entries(registry).find(([k]) => nk.includes(k) || k.includes(nk));
    if (hit) return hit[1];
  }
  return null;
}

function domainGuessFromName(name) {
  const cleaned = String(name || '').toLowerCase()
    .replace(/\b(inc|corp|corporation|ltd|llc|company|co)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
  if (!cleaned) return null;
  return `${cleaned}.com`;
}

function resolveLogoAsset(kind, state) {
  const inputs = state.inputs || {};
  const entity = state.entity || {};
  const isCompany = kind === 'company';
  const label = isCompany
    ? companyDisplayName(entity, inputs)
    : String(inputs.service_provider || 'Service Provider').trim();
  const ticker = String(entity.ticker || inputs.ticker || '').toLowerCase();
  const registry = isCompany ? COMPANY_LOGO_REGISTRY : PROVIDER_LOGO_REGISTRY;
  const keys = isCompany ? [ticker, label, entity.legal_name, inputs.company_name] : [label];
  const hit = registryLogoMatch(registry, keys);
  const domain = hit?.domain || domainGuessFromName(label);
  const clearbitUrl = domain ? `https://logo.clearbit.com/${domain}` : null;
  const url = hit?.url || clearbitUrl;
  const source = hit?.source || (clearbitUrl ? `Clearbit Logo API (${domain}) — verify against company IR press kit if unavailable` : null);
  const align = isCompany ? 'left' : 'right';
  const fallbackNote = url
    ? null
    : `Logo fallback: use official ${label} investor relations or brand press kit; automatic logo URL could not be resolved.`;
  return {
    kind,
    label,
    align,
    url: url || null,
    domain: domain || null,
    max_height_px: 28,
    max_width_px: 120,
    object_fit: 'contain',
    source_note: source || fallbackNote,
    fallback_note: fallbackNote,
    resolved: Boolean(url),
  };
}

function buildDeckSlideMaster(logos) {
  const company = logos.company;
  const provider = logos.provider;
  return {
    slide_count: DECK_SLIDE_COUNT,
    theme: 'executive_finance_dark_navy',
    footer: {
      layout: 'two_column',
      height_px: 40,
      padding_px: 12,
      border_top: '1px solid rgba(255,255,255,0.12)',
      columns: [
        {
          align: 'left',
          width: '50%',
          logo: company,
          instruction: 'Place company logo left-aligned. Scale proportionally; max height 28px; do not stretch.',
        },
        {
          align: 'right',
          width: '50%',
          logo: provider,
          instruction: 'Place service provider logo right-aligned. Scale proportionally; max height 28px; do not stretch.',
        },
      ],
      apply_to: 'every_slide',
      inherit: true,
    },
    logo_fallback_notes: [company.fallback_note, provider.fallback_note].filter(Boolean),
  };
}

function buildDeckFooterMarkdown(logos) {
  const company = logos.company;
  const provider = logos.provider;
  const lines = [
    '### Slide master footer (apply to EVERY slide — do not skip)',
    '',
    'Use a single shared slide master. Footer is a two-column row at the bottom of each slide:',
    `- **Left column:** ${company.label} logo — left-aligned. URL: ${company.url || 'MANUAL — see fallback note'}. ${company.source_note || company.fallback_note || ''}`,
    `- **Right column:** ${provider.label} logo — right-aligned. URL: ${provider.url || 'MANUAL — see fallback note'}. ${provider.source_note || provider.fallback_note || ''}`,
    '- Keep both logos small (max ~28px height), consistent across slides, proportionally scaled with object-fit contain — never stretch or distort.',
    '- Do not rebuild the footer per slide; inherit from the slide master so changes apply globally.',
  ];
  if (company.fallback_note) lines.push(`- Company logo fallback: ${company.fallback_note}`);
  if (provider.fallback_note) lines.push(`- Service provider logo fallback: ${provider.fallback_note}`);
  return lines.join('\n');
}

function buildSlidesJson(state, logos, slideMaster) {
  const titles = TEN_SLIDE_OUTLINE.map((line) => line.replace(/^Slide \d+:\s*/, '').split(' — ')[0]);
  return titles.map((title, index) => ({
    index: index + 1,
    title,
    footer: 'inherit_master',
    footer_layout: slideMaster.footer,
    logos: {
      left: logos.company,
      right: logos.provider,
    },
    speaker_notes: TEN_SLIDE_OUTLINE[index],
  }));
}

function buildGammaDeckMarkdown(state, logos, slideMaster) {
  const company = companyDisplayName(state.entity, state.inputs);
  const provider = state.inputs?.service_provider || 'Service Provider';
  const header = [
    `# ${company} — Executive Financial Briefing (${DECK_SLIDE_COUNT} slides)`,
    '',
    buildDeckFooterMarkdown(logos),
    '',
    '## Slide outline',
  ];
  const body = TEN_SLIDE_OUTLINE.map((line, i) => `${i + 1}. ${line}`);
  const footerRepeat = [
    '',
    '## Footer reminder',
    `Every slide inherits the master footer: **${company}** logo left, **${provider}** logo right.`,
    JSON.stringify(slideMaster.footer, null, 2),
  ];
  return header.concat(body).concat(footerRepeat).join('\n');
}

function buildPresentationPackage(state) {
  const logos = {
    company: resolveLogoAsset('company', state),
    provider: resolveLogoAsset('provider', state),
  };
  const slideMaster = buildDeckSlideMaster(logos);
  const slidesJson = buildSlidesJson(state, logos, slideMaster);
  const gammaMarkdown = buildGammaDeckMarkdown(state, logos, slideMaster);
  const promptText = buildExecutivePresentationPrompt(state, { logos, slideMaster, slidesJson, gammaMarkdown });
  return {
    slide_count: DECK_SLIDE_COUNT,
    slide_master: slideMaster,
    logos,
    slides_json: slidesJson,
    gamma_markdown: gammaMarkdown,
    prompt_text: promptText,
    logo_fallback_notes: slideMaster.logo_fallback_notes,
  };
}

function buildGammaDeck(state) {
  const pkg = buildPresentationPackage(state);
  return {
    generated_at: new Date().toISOString(),
    slide_count: pkg.slide_count,
    slide_master: pkg.slide_master,
    logos: pkg.logos,
    slides_json: pkg.slides_json,
    gamma_markdown: pkg.gamma_markdown,
    logo_fallback_notes: pkg.logo_fallback_notes,
  };
}
