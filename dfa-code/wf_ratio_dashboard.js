const state = items[0]?.json?.state || items[0]?.json || {};
const now = new Date().toISOString();
const facts = state.research?.financials?.merged_facts || state.research?.financials?.raw_us_gaap_facts || {};
const fx = state.research?.financials?.fx_to_usd || {};
const native = state.research?.financials?.native_currency || 'USD';
const anchors = state.research?.filing_anchors || {};
const fyAnchor = anchors.annual_10k || null;
const qAnchor = anchors.quarterly_10q || null;

function annualValue(metricKey, fy) {
  if (fyAnchor && fyAnchor.fy && Number(fyAnchor.fy) === Number(fy)) {
    const anchored = metricAtAnchor(facts, metricKey, { ...fyAnchor, fp: 'FY' }, fx, native);
    if (anchored) return anchored.value;
  }
  const found = tagRowsMerged(facts, metricKey);
  const row = latestAnnualRow(found.rows, fy);
  if (!row) return null;
  const unit = Object.keys(facts[found.tag]?.units || {})[0] || native;
  return convertToUsd(Number(row.val), unit, fx) ?? Number(row.val);
}

function quarterlyValue(metricKey) {
  const cell = metricAtAnchor(facts, metricKey, qAnchor, fx, native);
  return cell ? cell.value : null;
}

function safeRatio(num, den, asPct = false) {
  if (num === null || den === null || den === 0) return 'N/A';
  const v = num / den;
  return asPct ? fmtPct(v) : fmtRatio(v);
}

const years = [2025, 2024, 2023];
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
const fcf = years.map((_, i) => (ocf[i] !== null && capex[i] !== null ? ocf[i] - capex[i] : null));

function annualRatioRow(label, formula, values) {
  return { label, formula, values, reporting_period: years.map((fy) => `FY${fy}`) };
}

function safeRatioSeries(numArr, denArr, asPct = false) {
  return years.map((_, i) => safeRatio(numArr[i], denArr[i], asPct));
}

const annual = [
  annualRatioRow('Debt to Equity', 'Long-term debt / equity', safeRatioSeries(debt, equity)),
  annualRatioRow('Free Cash Flow to Revenue', 'FCF / revenue', safeRatioSeries(fcf, revenue, true)),
  annualRatioRow('Current Ratio', 'Current assets / current liabilities', safeRatioSeries(ca, cl)),
  annualRatioRow('Interest Coverage', 'Operating income / interest expense', safeRatioSeries(op, interest)),
  annualRatioRow('Return on Capital Employed', 'Operating income / (assets - current liabilities)', years.map((_, i) => {
    if (op[i] === null || assets[i] === null || cl[i] === null || (assets[i] - cl[i]) === 0) return 'N/A';
    return fmtPct(op[i] / (assets[i] - cl[i]));
  })),
  annualRatioRow('Gross Margin', 'Gross profit / revenue', safeRatioSeries(gross, revenue, true)),
  annualRatioRow('Operating Margin', 'Operating income / revenue', safeRatioSeries(op, revenue, true)),
  annualRatioRow('Net Margin', 'Net income / revenue', safeRatioSeries(net, revenue, true)),
];

const qRevenue = quarterlyValue('revenue');
const qOp = quarterlyValue('operating_income');
const qNet = quarterlyValue('net_income');
const qGross = quarterlyValue('gross_profit');
const qOcf = quarterlyValue('operating_cash_flow');
const qCapex = quarterlyValue('capex');
const qCa = quarterlyValue('current_assets');
const qCl = quarterlyValue('current_liabilities');
const qInterest = quarterlyValue('interest_expense');
const qDebt = quarterlyValue('long_term_debt');
const qEquity = quarterlyValue('equity');
const qAssets = quarterlyValue('assets');
const qFcf = qOcf !== null && qCapex !== null ? qOcf - qCapex : null;
const qPeriod = qAnchor ? anchorPeriodLabel(qAnchor) : 'Latest Quarter';

const quarterly = [
  { label: 'Debt to Equity', formula: 'Long-term debt / equity', value: safeRatio(qDebt, qEquity), reporting_period: qAnchor?.report_date || qPeriod },
  { label: 'Free Cash Flow to Revenue', formula: 'FCF / revenue', value: safeRatio(qFcf, qRevenue, true), reporting_period: qAnchor?.report_date || qPeriod },
  { label: 'Current Ratio', formula: 'Current assets / current liabilities', value: safeRatio(qCa, qCl), reporting_period: qAnchor?.report_date || qPeriod },
  { label: 'Interest Coverage', formula: 'Operating income / interest expense', value: safeRatio(qOp, qInterest), reporting_period: qAnchor?.report_date || qPeriod },
  { label: 'Return on Capital Employed', formula: 'Operating income / (assets - current liabilities)', value: (qOp !== null && qAssets !== null && qCl !== null && (qAssets - qCl) !== 0) ? fmtPct(qOp / (qAssets - qCl)) : 'N/A', reporting_period: qAnchor?.report_date || qPeriod },
  { label: 'Gross Margin', formula: 'Gross profit / revenue', value: safeRatio(qGross, qRevenue, true), reporting_period: qAnchor?.report_date || qPeriod },
  { label: 'Operating Margin', formula: 'Operating income / revenue', value: safeRatio(qOp, qRevenue, true), reporting_period: qAnchor?.report_date || qPeriod },
  { label: 'Net Margin', formula: 'Net income / revenue', value: safeRatio(qNet, qRevenue, true), reporting_period: qAnchor?.report_date || qPeriod },
];

const fyAnchorNote = fyAnchor
  ? `FY2025 column anchored on ${fyAnchor.form} (report period ${fyAnchor.report_date || 'N/A'}).`
  : 'FY2025 uses latest available annual SEC facts.';
const markdown = [
  '## Section 5: Ratio Dashboard',
  '',
  `### Quarterly Ratios (${qPeriod})`,
  '',
  '| Ratio | Value | Reporting Period | Formula |',
  '|---|---|---|---|',
  ...quarterly.map((r) => `| ${r.label} | ${r.value} | ${r.reporting_period} | ${r.formula} |`),
  '',
  '### Annual Ratios',
  '',
  fyAnchorNote,
  '',
  '| Ratio | FY2025 | FY2024 | FY2023 | Formula |',
  '|---|---|---|---|---|',
  ...annual.map((r) => `| ${r.label} | ${r.values[0]} | ${r.values[1]} | ${r.values[2]} | ${r.formula} |`),
  '',
  'Notes: All ratios use SEC EDGAR line items converted to USD. Values are rounded to 1–2 decimal places. N/A means required inputs were missing on the anchored filing.',
].join('\n');

state.ratio_dashboard = { generated_at: now, quarterly, annual, markdown };
state.sections = state.sections || {};
state.sections.s5_ratios = markdown;
state.audit_log = state.audit_log || [];
state.audit_log.push({ timestamp: now, workflow_name: 'WF_RATIO_DASHBOARD', status: 'OK', message: 'Ratio dashboard built with quarterly and annual anchors.' });
return [{ json: state }];
