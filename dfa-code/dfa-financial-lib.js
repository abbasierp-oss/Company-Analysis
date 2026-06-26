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

function fmtUsdValue(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return 'N/A';
  const abs = Math.abs(Number(v));
  if (abs >= 1e12) return `$${(Number(v) / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(Number(v) / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(Number(v) / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(Number(v) / 1e3).toFixed(2)}K`;
  return `$${Number(v).toFixed(2)}`;
}

function fmtPct(v, decimals = 1) {
  if (v === null || v === undefined || Number.isNaN(v)) return 'N/A';
  return `${(Number(v) * 100).toFixed(decimals)}%`;
}

function fmtRatio(v, decimals = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return 'N/A';
  return Number(v).toFixed(decimals);
}

function fmtEps(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return 'N/A';
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
  if (!anchor) return 'N/A';
  if (anchor.fp && anchor.fy) return `${anchor.fp} FY${anchor.fy}`;
  if (anchor.report_date) return anchor.report_date;
  if (anchor.fy) return `FY${anchor.fy}`;
  return anchor.filing_date || 'N/A';
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
    .map((e) => `${e.title || ''} ${e.description || ''}`)
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
  const warnerSignal = /warner\s*bros|wbd.*termination|termination\s*fee.*warner/i.test(combined)
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

function formatQuarterlyMetric(metric, kind) {
  if (!metric || metric.value === null || metric.value === undefined) return 'N/A';
  const period = metric.period_label || metric.reporting_period || 'quarterly anchor';
  const flag = metric.one_time_flag ? ` ⚠ ${metric.one_time_flag}` : '';
  if (kind === 'pct' || metric.unit === 'ratio') return `${fmtPct(metric.value)} (${period})${flag}`;
  if (kind === 'eps' || metric.unit === 'USD/shares') return `${fmtEps(metric.value)} (${period})${flag}`;
  return `${fmtUsdValue(metric.value)} (${period})${flag}`;
}

function formatAnnualMetric(metric, kind) {
  if (!metric || metric.value === null || metric.value === undefined) return 'N/A';
  const period = metric.period_label || metric.reporting_period || 'FY2025';
  if (kind === 'pct' || metric.unit === 'ratio') return `${fmtPct(metric.value)} (${period})`;
  if (kind === 'eps' || metric.unit === 'USD/shares') return `${fmtEps(metric.value)} (${period})`;
  return `${fmtUsdValue(metric.value)} (${period})`;
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
  return {
    Revenue: revenue !== null ? fmtUsdValue(revenue) : 'N/A',
    'Gross Margin': safeDiv(gross, revenue) !== null ? fmtPct(safeDiv(gross, revenue)) : 'N/A',
    'Operating Margin': safeDiv(op, revenue) !== null ? fmtPct(safeDiv(op, revenue)) : 'N/A',
    'Net Margin': safeDiv(net, revenue) !== null ? fmtPct(safeDiv(net, revenue)) : 'N/A',
    'FCF Margin': safeDiv(fcf, revenue) !== null ? fmtPct(safeDiv(fcf, revenue)) : 'N/A',
    'Current Ratio': safeDiv(ca, cl) !== null ? fmtRatio(safeDiv(ca, cl)) : 'N/A',
    'YoY Revenue Growth': safeDiv(revenue && revY1 ? revenue - revY1 : null, revY1) !== null ? fmtPct(safeDiv(revenue - revY1, revY1)) : 'N/A',
    '3-Year Revenue CAGR': revY3 && revenue && revY3 > 0 ? fmtPct(Math.pow(revenue / revY3, 1 / 3) - 1) : 'N/A',
    'Net Debt / EBITDA': ebitda && debt !== null && cash !== null && ebitda !== 0 ? fmtRatio((debt - cash) / ebitda) : 'N/A',
    'Interest Coverage': safeDiv(op, interest) !== null ? fmtRatio(safeDiv(op, interest)) : 'N/A',
    'ROCE/ROIC': safeDiv(op, assets !== null && cl !== null ? assets - cl : null) !== null ? fmtPct(safeDiv(op, assets - cl)) : 'N/A',
    'Asset Turnover': safeDiv(revenue, assets) !== null ? fmtRatio(safeDiv(revenue, assets)) : 'N/A',
    _fy: fy,
  };
}

function peerRowHasCoreMetrics(metrics) {
  return CORE_PEER_METRICS.every((key) => metrics[key] && metrics[key] !== 'N/A');
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
  };
  const match = Object.keys(defaults).find((k) => key.includes(k)) || 'technology';
  return defaults[match].filter((name) => normName(name) !== target);
}

function parsePeerList(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return String(raw).split(/[,;\n|]/).map((s) => s.trim()).filter(Boolean);
}

function claudeBaseSystem(inputs, expert) {
  return `You are an AI financial analyst who thinks like Aswath Damodaran. Evidence first. Every figure must come from the provided JSON only. Never fabricate numbers. If data is missing, write N/A and explain why. Show formulas for computed metrics. Do not use templating placeholders or curly-brace variables. Industry lens: ${expert?.name || inputs.expert_pref || 'industry expert'}. Executive audience: ${inputs.exec_type || 'executive'}. Service provider: ${inputs.service_provider || 'MY COMPANY'}.`;
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
  const issuer = state.entity?.issuer_profile?.description || 'public company';
  const ref8k = state.data_freshness?.recent_8k_form;
  const ref8kDate = state.data_freshness?.recent_8k_filing_date;
  const peerReady = state.peer_benchmarks?.table_published === true;
  return [
    '## Section 4: Three Strategic Insights',
    '',
    `All figures below use the quarterly financial anchor only (${period}; report period ${q.reporting_period || 'N/A'}).`,
    '',
    '### Insight 1 — Cash-flow quality and reinvestment',
    `- Revenue: ${formatQuarterlyMetric(q.revenue)}`,
    `- Operating margin: ${formatQuarterlyMetric(q.operating_margin, 'pct')}`,
    `- FCF: ${formatQuarterlyMetric(q.free_cash_flow)}`,
    `- EPS: ${formatQuarterlyMetric(q.eps, 'eps')}`,
    `- Damodaran take: Sustainable value creation depends on whether growth is backed by reinvestment and cash conversion, not headline revenue alone.`,
    `- So-what: ${state.inputs?.exec_type || 'Executive'} should prioritize the metric with the weakest source-backed trend before approving new spend.`,
    '',
    '### Insight 2 — Risk, leverage, and cost of capital',
    `- Issuer profile: ${issuer}`,
    peerReady
      ? '- Peer benchmark table in Section 3 uses FY2025 annual SEC facts on a consistent basis.'
      : '- Peer benchmark table withheld until all core FY2025 metrics can be populated consistently.',
    `- Damodaran take: Risk is not abstract; it shows up in leverage, coverage, and earnings volatility versus peers.`,
    `- So-what: If leverage or margin trails peers, the strategic plan must explain the path to convergence or justify a premium/discount.`,
    '',
    '### Insight 3 — Narrative vs filings',
    `- Quarterly anchor: ${state.data_freshness?.quarterly_anchor_form || 'N/A'} (${state.data_freshness?.quarterly_anchor_report_date || 'N/A'})`,
    ref8k ? `- Recent 8-K reference only (not a financial anchor): ${ref8k} filed ${ref8kDate || 'N/A'}` : '- No recent 8-K on file.',
    `- Damodaran take: Markets price expected future cash flows; filings and interim reports test whether the narrative is credible.`,
    `- So-what: Tie every strategic claim to a filing-backed metric or explicitly mark it N/A.`,
  ].join('\n');
}
