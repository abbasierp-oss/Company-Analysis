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
