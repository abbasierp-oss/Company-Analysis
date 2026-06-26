const state = items[0]?.json?.state || items[0]?.json || {};
const now = new Date().toISOString();
const facts = state.research?.financials?.merged_facts || state.research?.financials?.raw_us_gaap_facts || {};
const fx = state.research?.financials?.fx_to_usd || {};
const native = state.research?.financials?.native_currency || 'USD';
const years = [2025, 2024, 2023];

function annualValue(metricKey, fy) {
  const found = tagRowsMerged(facts, metricKey);
  const row = latestAnnualRow(found.rows, fy);
  if (!row) return null;
  const unit = Object.keys(facts[found.tag]?.units || {})[0] || native;
  const val = Number(row.val);
  return convertToUsd(val, unit, fx) ?? val;
}

function ratioRow(label, formula, numKey, denKey) {
  return years.map((fy) => {
    const num = annualValue(numKey, fy);
    const den = annualValue(denKey, fy);
    if (num === null || den === null || den === 0) return 'N/A';
    if (label.includes('Margin') || label.includes('FCF to Revenue') || label.includes('ROCE')) return `${((num / den) * 100).toFixed(1)}%`;
    return Number(num / den).toFixed(2);
  });
}

const revenue = years.map((fy) => annualValue('revenue', fy));
const op = years.map((fy) => annualValue('operating_income', fy));
const net = years.map((fy) => annualValue('net_income', fy));
const gross = years.map((fy) => annualValue('gross_profit', fy));
const ocf = years.map((fy) => annualValue('operating_cash_flow', fy));
const capex = years.map((fy) => annualValue('capex', fy));
const ca = years.map((fy) => annualValue('current_assets', fy));
const cl = years.map((fy) => annualValue('current_liabilities', fy));
const interest = years.map((fy) => annualValue('interest_expense', fy));
const debt = years.map((fy) => annualValue('long_term_debt', fy));
const equity = years.map((fy) => annualValue('equity', fy));
const assets = years.map((fy) => annualValue('assets', fy));

function safeRatio(num, den, asPct = false) {
  return years.map((_, i) => {
    if (num[i] === null || den[i] === null || den[i] === 0) return 'N/A';
    const v = num[i] / den[i];
    return asPct ? `${(v * 100).toFixed(1)}%` : v.toFixed(2);
  });
}

const fcf = years.map((_, i) => (ocf[i] !== null && capex[i] !== null ? ocf[i] - capex[i] : null));
const ratioDefs = [
  ['Debt to Equity', 'Long-term debt / equity', safeRatio(debt, equity)],
  ['Free Cash Flow to Revenue', 'FCF / revenue', safeRatio(fcf, revenue, true)],
  ['Current Ratio', 'Current assets / current liabilities', safeRatio(ca, cl)],
  ['Interest Coverage', 'Operating income / interest expense', safeRatio(op, interest)],
  ['Return on Capital Employed', 'Operating income / (assets - current liabilities)', years.map((_, i) => {
    if (op[i] === null || assets[i] === null || cl[i] === null || (assets[i] - cl[i]) === 0) return 'N/A';
    return `${((op[i] / (assets[i] - cl[i])) * 100).toFixed(1)}%`;
  })],
  ['Gross Margin', 'Gross profit / revenue', safeRatio(gross, revenue, true)],
  ['Operating Margin', 'Operating income / revenue', safeRatio(op, revenue, true)],
  ['Net Margin', 'Net income / revenue', safeRatio(net, revenue, true)],
];

const annual = ratioDefs.map(([label, formula, values]) => ({ label, formula, values }));
const markdown = [
  '## Section 5: Ratio Dashboard',
  '',
  '| Ratio | FY2025 | FY2024 | FY2023 | Formula |',
  '|---|---|---|---|---|',
  ...annual.map((r) => `| ${r.label} | ${r.values[0]} | ${r.values[1]} | ${r.values[2]} | ${r.formula} |`),
  '',
  `Notes: Ratios use SEC EDGAR line items from US-GAAP and IFRS taxonomies on annual forms (${SEC_ANNUAL_FORMS.join('/')}).${native !== 'USD' ? ` Native currency ${native} converted to USD at ${fx.rate} (${fx.as_of}).` : ''} N/A means required inputs were missing.`,
].join('\n');

state.ratio_dashboard = { generated_at: now, annual, markdown };
state.sections = state.sections || {};
state.sections.s5_ratios = markdown;
state.audit_log = state.audit_log || [];
state.audit_log.push({ timestamp: now, workflow_name: 'WF_RATIO_DASHBOARD', status: 'OK', message: 'Ratio dashboard built with foreign-issuer support.' });
return [{ json: state }];
