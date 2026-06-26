const state = items[0]?.json?.state || items[0]?.json || {};
const now = new Date().toISOString();
const facts = state.research?.financials?.merged_facts || state.research?.financials?.raw_us_gaap_facts || {};
const metrics = state.normalized?.metrics || {};
const fx = state.research?.financials?.fx_to_usd || {};
const native = state.research?.financials?.native_currency || 'USD';

function metricFromNormalized(name) {
  const s = metrics[name] || [];
  return Array.isArray(s) && s.length ? s[s.length - 1] : null;
}

function annual(metricKey, fy) {
  const found = tagRowsMerged(facts, metricKey);
  const row = latestAnnualRow(found.rows, fy);
  if (!row) return null;
  const unit = Object.keys(facts[found.tag]?.units || {})[0] || native;
  const nativeVal = Number(row.val);
  const usdVal = convertToUsd(nativeVal, unit, fx);
  return {
    value: usdVal !== null ? usdVal : nativeVal,
    unit: usdVal !== null ? 'USD' : unit,
    period: `FY${fy}`,
    fiscal_label: `FY${fy}`,
    source_name: `SEC EDGAR ${found.taxonomy || 'us-gaap'}:${found.tag}`,
    source_url: state.research?.financials?.source_url || '',
    source_date: row.filed || now,
    source_section: row.form,
    confidence: 'HIGH',
  };
}

function quarterly(metricKey, q) {
  if (!q) return null;
  const found = tagRowsMerged(facts, metricKey);
  const row = found.rows
    .filter((r) => isInterimForm(r.form) && Number(r.fy) === Number(q.fy) && String(r.fp) === String(q.fp))
    .sort((a, b) => String(a.filed || '').localeCompare(String(b.filed || '')))
    .at(-1);
  if (!row) return null;
  const unit = Object.keys(facts[found.tag]?.units || {})[0] || native;
  const nativeVal = Number(row.val);
  const usdVal = convertToUsd(nativeVal, unit, fx);
  return {
    value: usdVal !== null ? usdVal : nativeVal,
    unit: usdVal !== null ? 'USD' : unit,
    period: `${q.fp} FY${q.fy}`,
    fiscal_label: `${q.fp} FY${q.fy}`,
    source_name: `SEC EDGAR ${found.taxonomy || 'us-gaap'}:${found.tag}`,
    source_url: state.research?.financials?.source_url || '',
    source_date: row.filed || now,
    source_section: row.form,
    confidence: 'HIGH',
  };
}

function qPeriods() {
  const found = tagRowsMerged(facts, 'revenue');
  const rows = found.rows.filter((r) => isInterimForm(r.form) && r.fy && r.fp)
    .sort((a, b) => String(a.end || '').localeCompare(String(b.end || '')) || String(a.filed || '').localeCompare(String(b.filed || '')));
  const unique = [];
  for (const row of rows) {
    const key = `${row.fy}-${row.fp}`;
    if (!unique.some((p) => p.key === key)) unique.push({ key, fy: row.fy, fp: row.fp, end: row.end });
  }
  const latest = unique.at(-1) || null;
  const previous = unique.at(-2) || null;
  const sameLastYear = latest ? unique.find((p) => Number(p.fy) === Number(latest.fy) - 1 && p.fp === latest.fp) || null : null;
  return { latest, previous, sameLastYear };
}

function computed(name, inputs, fn, unit, formula) {
  if (inputs.some((x) => !x || x.value === undefined || x.value === null) || (inputs[1] && Number(inputs[1].value) === 0)) return null;
  return {
    value: fn(...inputs.map((x) => Number(x.value))),
    unit,
    period: inputs[0].period,
    fiscal_label: inputs[0].fiscal_label,
    source_name: inputs.map((x) => x.source_name).join(' + '),
    source_url: inputs.map((x) => x.source_url).filter(Boolean).join(' | '),
    source_date: inputs.map((x) => x.source_date).filter(Boolean).sort().at(-1) || now,
    source_section: 'computed',
    formula,
    confidence: 'MEDIUM',
  };
}

function formatCell(cell) {
  if (!cell) return { display: 'N/A', value: null, reason: 'Required source line item was not available.', confidence: 'N/A' };
  const disp = cell.unit === 'ratio' ? `${(cell.value * 100).toFixed(1)}%` : `${cell.value} ${cell.unit || ''}`.trim();
  return { display: disp, ...cell };
}

const qp = qPeriods();
const periodDefs = [
  { key: 'latest_quarter', label: 'Latest Reported Quarter', type: 'quarter', q: qp.latest },
  { key: 'previous_quarter', label: 'Previous Quarter', type: 'quarter', q: qp.previous },
  { key: 'same_quarter_last_year', label: 'Same Quarter Last Year', type: 'quarter', q: qp.sameLastYear },
  ...[2025, 2024, 2023, 2022, 2021].map((fy) => ({ key: String(fy), label: String(fy), type: 'annual', fy })),
];

function baseMetric(metric, period) {
  if (period.type === 'annual') {
    const norm = metrics[metric] || [];
    const hit = [...norm].reverse().find((m) => String(m.period || '').includes(String(period.fy)));
    if (hit) return hit;
    return annual(metric, period.fy);
  }
  return quarterly(metric, period.q);
}

function metricFor(rowId, period) {
  const revenue = baseMetric('revenue', period);
  if (rowId === 'revenue') return revenue;
  if (rowId === 'operating_margin') return computed('operating_margin', [baseMetric('operating_income', period), revenue], (op, rev) => op / rev, 'ratio', 'Operating income / revenue');
  if (rowId === 'net_margin') return computed('net_margin', [baseMetric('net_income', period), revenue], (ni, rev) => ni / rev, 'ratio', 'Net income / revenue');
  if (rowId === 'ebitda') {
    const op = baseMetric('operating_income', period);
    const da = baseMetric('depreciation', period);
    return computed('ebitda', [op, da], (a, b) => a + b, 'USD', 'Operating income + depreciation/amortization');
  }
  if (rowId === 'eps') return baseMetric('diluted_eps', period);
  if (rowId === 'long_term_debt') return baseMetric('long_term_debt', period);
  if (rowId === 'free_cash_flow') return computed('fcf', [baseMetric('operating_cash_flow', period), baseMetric('capex', period)], (ocf, capex) => ocf - capex, 'USD', 'Operating cash flow - capex');
  if (rowId === 'market_cap') {
    const mc = state.research?.market_data?.market_cap_usd;
    if (mc === null || mc === undefined) return null;
    return {
      value: mc,
      unit: 'USD',
      period: state.research?.market_data?.source_date || 'latest',
      fiscal_label: 'Market cap',
      source_name: state.research?.market_data?.source_name || 'Market data',
      source_url: state.research?.market_data?.source_url || '',
      source_date: state.research?.market_data?.source_date || now,
      source_section: 'market_data',
      formula: 'Share price x shares outstanding',
      confidence: state.research?.market_data?.confidence || 'MEDIUM',
    };
  }
  return null;
}

const rowDefs = [
  ['revenue', 'Revenue'], ['operating_margin', 'Operating Margin'], ['net_margin', 'Net Margin'], ['ebitda', 'EBITDA'],
  ['eps', 'EPS (diluted if available)'], ['long_term_debt', 'Long-term Debt'], ['free_cash_flow', 'Free Cash Flow (FCF)'], ['market_cap', 'Market Cap'],
];
const rows = rowDefs.map(([id, label]) => ({ metric: id, label, cells: Object.fromEntries(periodDefs.map((p) => [p.label, formatCell(metricFor(id, p))])) }));
const fxNote = native !== 'USD' && fx?.rate ? ` Native reporter currency ${native}; USD comparability uses ${fx.source_name || 'FX'} @ ${fx.rate} (${fx.as_of}).` : '';
const markdown = [
  '## Section 2: Financial Snapshot Table (USD comparability)',
  '',
  '| Metric | ' + periodDefs.map((p) => p.label).join(' | ') + ' |',
  '|---|' + periodDefs.map(() => '---').join('|') + '|',
  ...rows.map((row) => `| ${row.label} | ${periodDefs.map((p) => row.cells[p.label].display).join(' | ')} |`),
  '',
  `Notes: Monetary figures shown in USD where FX conversion is available.${fxNote} N/A means the required source line item was not found on supported SEC forms (${SEC_ANNUAL_FORMS.join('/')}, ${SEC_INTERIM_FORMS.join('/')}).`,
].join('\n');

state.financial_snapshot = { generated_at: now, currency: 'USD', native_currency: native, periods: periodDefs, rows, markdown };
state.sections = state.sections || {};
state.sections.s2_snapshot = markdown;
state.audit_log = state.audit_log || [];
state.audit_log.push({ timestamp: now, workflow_name: 'WF_FINANCIAL_SNAPSHOT', status: 'OK', message: 'Financial snapshot prepared with foreign-issuer SEC form support.' });
return [{ json: state }];
