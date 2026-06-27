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
