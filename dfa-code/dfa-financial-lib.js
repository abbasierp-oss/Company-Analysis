// Shared DFA financial utilities (inlined into n8n Code nodes)
const SEC_UA = 'DamodaranAnalystSystem/2.0 contact@goevolo.com';

function normName(v) {
  return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function tagRows(facts, tags) {
  for (const tag of tags) {
    const fact = facts[tag];
    if (!fact?.units) continue;
    const rows = Object.values(fact.units).flat().filter((r) => r && r.val !== undefined);
    if (rows.length) return { tag, rows };
  }
  return { tag: tags[0], rows: [] };
}

function latestAnnualRow(rows, fy) {
  return rows
    .filter((r) => r.form === '10-K' && Number(r.fy) === Number(fy))
    .sort((a, b) => String(a.end || '').localeCompare(String(b.end || '')) || String(a.filed || '').localeCompare(String(b.filed || '')))
    .at(-1) || null;
}

function latestQuarterRows(rows) {
  const qrows = rows.filter((r) => r.form === '10-Q' && r.fy && r.fp)
    .sort((a, b) => String(a.end || '').localeCompare(String(b.end || '')) || String(a.filed || '').localeCompare(String(b.filed || '')));
  const uniq = [];
  for (const row of qrows) {
    const key = `${row.fy}-${row.fp}`;
    if (!uniq.some((p) => p.key === key)) uniq.push({ key, fy: row.fy, fp: row.fp, end: row.end, filed: row.filed });
  }
  return uniq;
}

function compactFacts(usGaapAll) {
  const supported = [
    'RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet',
    'GrossProfit', 'OperatingIncomeLoss', 'NetIncomeLoss', 'ProfitLoss',
    'NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations',
    'PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets',
    'LongTermDebtAndFinanceLeaseObligationsNoncurrent', 'LongTermDebtNoncurrent', 'LongTermDebtAndFinanceLeaseObligationsCurrent',
    'AssetsCurrent', 'LiabilitiesCurrent', 'InterestExpenseNonOperating', 'InterestExpense',
    'EarningsPerShareDiluted', 'DepreciationDepletionAndAmortization', 'DepreciationDepletionAndAmortizationExpense', 'DepreciationAndAmortization',
    'StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
    'Assets', 'Liabilities', 'CashAndCashEquivalentsAtCarryingValue', 'ShortTermBorrowings'
  ];
  const out = {};
  for (const tag of supported) {
    const fact = usGaapAll[tag];
    if (!fact?.units) continue;
    const units = {};
    for (const [unitName, rows] of Object.entries(fact.units)) {
      if (!Array.isArray(rows)) continue;
      const compact = rows
        .filter((r) => r && r.val !== undefined && ['10-K', '10-Q'].includes(r.form))
        .sort((a, b) => String(a.filed || '').localeCompare(String(b.filed || '')) || String(a.end || '').localeCompare(String(b.end || '')))
        .slice(-20)
        .map((r) => ({ end: r.end, val: r.val, fy: r.fy, fp: r.fp, form: r.form, filed: r.filed, frame: r.frame }));
      if (compact.length) units[unitName] = compact;
    }
    if (Object.keys(units).length) out[tag] = { label: fact.label, units };
  }
  return out;
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
  const map = {
    revenue: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet'],
    gross_profit: ['GrossProfit'],
    operating_income: ['OperatingIncomeLoss'],
    net_income: ['NetIncomeLoss', 'ProfitLoss'],
    operating_cash_flow: ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'],
    capex: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'],
    long_term_debt: ['LongTermDebtAndFinanceLeaseObligationsNoncurrent', 'LongTermDebtNoncurrent'],
    current_assets: ['AssetsCurrent'],
    current_liabilities: ['LiabilitiesCurrent'],
    interest_expense: ['InterestExpenseNonOperating', 'InterestExpense'],
    equity: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
    assets: ['Assets'],
    cash: ['CashAndCashEquivalentsAtCarryingValue'],
    depreciation: ['DepreciationDepletionAndAmortization', 'DepreciationDepletionAndAmortizationExpense', 'DepreciationAndAmortization']
  };
  const found = tagRows(facts, map[metric] || [metric]);
  const row = latestAnnualRow(found.rows, fy);
  return row ? Number(row.val) : null;
}

function computeEntityMetrics(facts, sourceMeta) {
  const years = [2025, 2024, 2023];
  const latestFy = years.find((fy) => metricFromFacts(facts, 'revenue', fy) !== null) || years[1];
  const revenue = metricFromFacts(facts, 'revenue', latestFy);
  const gross = metricFromFacts(facts, 'gross_profit', latestFy);
  const op = metricFromFacts(facts, 'operating_income', latestFy);
  const net = metricFromFacts(facts, 'net_income', latestFy);
  const ocf = metricFromFacts(facts, 'operating_cash_flow', latestFy);
  const capex = metricFromFacts(facts, 'capex', latestFy);
  const ca = metricFromFacts(facts, 'current_assets', latestFy);
  const cl = metricFromFacts(facts, 'current_liabilities', latestFy);
  const interest = metricFromFacts(facts, 'interest_expense', latestFy);
  const debt = metricFromFacts(facts, 'long_term_debt', latestFy);
  const equity = metricFromFacts(facts, 'equity', latestFy);
  const assets = metricFromFacts(facts, 'assets', latestFy);
  const cash = metricFromFacts(facts, 'cash', latestFy);
  const dep = metricFromFacts(facts, 'depreciation', latestFy);
  const revY1 = metricFromFacts(facts, 'revenue', latestFy - 1);
  const revY3 = metricFromFacts(facts, 'revenue', latestFy - 3);
  const fcf = ocf !== null && capex !== null ? ocf - capex : null;
  const ebitda = op !== null && dep !== null ? op + dep : null;
  const safeDiv = (a, b) => (a !== null && b !== null && b !== 0 ? a / b : null);
  return {
    period: `FY${latestFy}`,
    revenue,
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
    source_meta: sourceMeta
  };
}

function fmtMetric(v, asPct = false) {
  if (v === null || v === undefined || Number.isNaN(v)) return 'N/A';
  if (asPct) return `${(v * 100).toFixed(1)}%`;
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(2)}B USD`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M USD`;
  return `${Number(v).toLocaleString('en-US')} USD`;
}

function peerDefaults(industry) {
  const key = String(industry || '').toLowerCase();
  const defaults = {
    technology: ['Microsoft', 'Alphabet', 'Meta Platforms', 'Amazon', 'NVIDIA'],
    saas: ['Salesforce', 'Adobe', 'ServiceNow', 'Atlassian', 'Workday'],
    retail: ['Walmart', 'Costco', 'Target', 'Amazon', 'Home Depot'],
    banking: ['JPMorgan Chase', 'Bank of America', 'Wells Fargo', 'Citigroup', 'Goldman Sachs'],
    healthcare: ['UnitedHealth Group', 'HCA Healthcare', 'Elevance Health', 'CVS Health', 'Humana'],
    manufacturing: ['General Electric', 'Honeywell', 'Caterpillar', '3M', 'Siemens'],
    gaming: ['Electronic Arts', 'Take-Two Interactive', 'Roblox', 'Nintendo', 'Sony'],
    media: ['Disney', 'Netflix', 'Comcast', 'Warner Bros. Discovery', 'Paramount Global']
  };
  const match = Object.keys(defaults).find((k) => key.includes(k)) || 'technology';
  return defaults[match];
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
  const text = content.map((p) => p.text || '').join('\n').trim() || JSON.stringify(response);
  try { return JSON.parse(text); } catch (e) {}
  const match = text.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch (e) {} }
  return { _raw: text };
}
