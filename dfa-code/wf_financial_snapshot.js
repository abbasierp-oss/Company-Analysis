const state = items[0]?.json?.state || items[0]?.json || {};
const now = new Date().toISOString();
const facts = state.research?.financials?.merged_facts || state.research?.financials?.raw_us_gaap_facts || {};
const fx = state.research?.financials?.fx_to_usd || {};
const native = state.research?.financials?.native_currency || 'USD';
const anchors = state.research?.filing_anchors || resolveFilingAnchors(
  state.research?.filings?.recent_filings || [],
  state.entity?.issuer_profile,
);
const oneTimeFlags = state.research?.one_time_items || detectOneTimeItems(state);

function enrichAnchor(anchor) {
  if (!anchor) return null;
  const copy = { ...anchor };
  if (copy.report_date && (!copy.fy || !copy.fp)) {
    const rev = tagRowsMerged(facts, 'revenue').rows
      .filter((r) => String(r.end) === String(copy.report_date))
      .sort((a, b) => String(a.filed || '').localeCompare(String(b.filed || '')))
      .at(-1);
    if (rev) {
      copy.fy = copy.fy || rev.fy;
      copy.fp = copy.fp || rev.fp;
    }
  }
  return copy;
}

const qAnchor = enrichAnchor(anchors.quarterly_10q);
const fyAnchor = enrichAnchor(anchors.annual_10k);
const qPeriodLabel = qAnchor ? anchorPeriodLabel(qAnchor) : 'Latest Quarter';
const fyPeriodLabel = fyAnchor ? annualSectionLabel(fyAnchor) : 'Latest Fiscal Year';

function computedMetric(num, den, unit, formula, periodMeta, flagMetricId, periodLabel) {
  if (!num || !den || den.value === null || den.value === undefined || Number(den.value) === 0) return null;
  const flag = oneTimeFlagForMetric(oneTimeFlags, flagMetricId, periodLabel);
  return {
    value: Number(num.value) / Number(den.value),
    unit,
    reporting_period: periodMeta.reporting_period,
    period: periodMeta.period,
    source_name: `${num.source_name} / ${den.source_name}`,
    source_section: 'computed',
    source_date: [num.source_date, den.source_date].filter(Boolean).sort().at(-1),
    formula,
    confidence: 'MEDIUM',
    one_time_flag: flag ? flag.label : null,
  };
}

function formatValue(cell, kind) {
  if (!cell || cell.value === null || cell.value === undefined) {
    return naReason('required line item not found on the anchored SEC filing');
  }
  if (kind === 'ratio') return fmtPct(cell.value);
  if (kind === 'eps') return fmtEps(cell.value);
  return fmtUsdValue(cell.value);
}

function snapshotRow(metricId, label, anchor, kind, formula, flagMetricId) {
  const periodLabel = anchor ? anchorPeriodLabel(anchor) : naReason('no filing anchor for period label');
  let cell = null;
  if (metricId === 'operating_margin') {
    cell = computedMetric(
      metricAtAnchor(facts, 'operating_income', anchor, fx, native),
      metricAtAnchor(facts, 'revenue', anchor, fx, native),
      'ratio',
      'Operating income / revenue',
      { reporting_period: anchor?.report_date, period: periodLabel },
      flagMetricId || 'operating_margin',
      periodLabel,
    );
  } else if (metricId === 'net_margin') {
    cell = computedMetric(
      metricAtAnchor(facts, 'net_income', anchor, fx, native),
      metricAtAnchor(facts, 'revenue', anchor, fx, native),
      'ratio',
      'Net income / revenue',
      { reporting_period: anchor?.report_date, period: periodLabel },
      flagMetricId || 'net_margin',
      periodLabel,
    );
  } else if (metricId === 'ebitda') {
    const op = metricAtAnchor(facts, 'operating_income', anchor, fx, native);
    const da = metricAtAnchor(facts, 'depreciation', anchor, fx, native);
    if (op && da) {
      cell = {
        value: Number(op.value) + Number(da.value),
        unit: 'USD',
        reporting_period: op.reporting_period,
        period: op.period,
        source_name: `${op.source_name} + ${da.source_name}`,
        source_section: 'computed',
        source_date: op.source_date,
        formula: 'Operating income + depreciation/amortization',
        confidence: 'MEDIUM',
      };
    }
  } else if (metricId === 'free_cash_flow') {
    const ocf = metricAtAnchor(facts, 'operating_cash_flow', anchor, fx, native);
    const capex = metricAtAnchor(facts, 'capex', anchor, fx, native);
    if (ocf && capex) {
      cell = {
        value: Number(ocf.value) - Number(capex.value),
        unit: 'USD',
        reporting_period: ocf.reporting_period,
        period: ocf.period,
        source_name: `${ocf.source_name} - ${capex.source_name}`,
        source_section: 'computed',
        source_date: ocf.source_date,
        formula: 'Operating cash flow - capex',
        confidence: 'MEDIUM',
      };
    }
  } else {
    cell = metricAtAnchor(facts, metricId === 'eps' ? 'diluted_eps' : metricId, anchor, fx, native);
    if (cell && metricId === 'eps') {
      const flag = oneTimeFlagForMetric(oneTimeFlags, 'eps', periodLabel);
      if (flag) cell.one_time_flag = flag.label;
    }
    if (cell && metricId === 'net_income') {
      const flag = oneTimeFlagForMetric(oneTimeFlags, 'net_income', periodLabel);
      if (flag) cell.one_time_flag = flag.label;
    }
  }
  const flagNote = cell?.one_time_flag ? ` ⚠ ${cell.one_time_flag}` : '';
  const source = cell
    ? `${cell.source_section || 'SEC'} — ${cell.source_name || 'SEC EDGAR'}`
    : naReason('required line item not found on the anchored SEC filing');
  return {
    metric: metricId,
    label,
    value_display: formatValue(cell, kind) + flagNote,
    reporting_period: cell?.reporting_period || anchor?.report_date || naReason('reporting period not on filing'),
    source,
    raw: cell,
    formula: cell?.formula || formula || null,
  };
}

const quarterlyRows = [
  snapshotRow('revenue', 'Revenue', qAnchor, 'usd'),
  snapshotRow('operating_margin', 'Operating Margin', qAnchor, 'ratio', 'Operating income / revenue'),
  snapshotRow('net_margin', 'Net Margin', qAnchor, 'ratio', 'Net income / revenue'),
  snapshotRow('net_income', 'Net Income', qAnchor, 'usd'),
  snapshotRow('ebitda', 'EBITDA', qAnchor, 'usd'),
  snapshotRow('eps', 'EPS (diluted)', qAnchor, 'eps'),
  snapshotRow('long_term_debt', 'Long-term Debt', qAnchor, 'usd'),
  snapshotRow('free_cash_flow', 'Free Cash Flow (FCF)', qAnchor, 'usd'),
];

const dilutedWa = qAnchor ? dilutedSharesAtAnchor(facts, qAnchor) : null;
if (dilutedWa) {
  quarterlyRows.push({
    metric: 'weighted_avg_diluted_shares',
    label: 'Weighted-Avg Diluted Shares',
    value_display: Number(dilutedWa.value).toLocaleString('en-US'),
    reporting_period: dilutedWa.reporting_period || qAnchor?.report_date || naReason('report period not on quarterly anchor'),
    source: `${dilutedWa.source_name} — quarterly filing anchor; not market-implied shares`,
    raw: { value: dilutedWa.value, unit: 'shares', source_name: dilutedWa.source_name, reporting_period: dilutedWa.reporting_period },
  });
}

const annualRows = [
  snapshotRow('revenue', 'Revenue', fyAnchor, 'usd'),
  snapshotRow('operating_margin', 'Operating Margin', fyAnchor, 'ratio', 'Operating income / revenue'),
  snapshotRow('net_margin', 'Net Margin', fyAnchor, 'ratio', 'Net income / revenue'),
  snapshotRow('net_income', 'Net Income', fyAnchor, 'usd'),
  snapshotRow('ebitda', 'EBITDA', fyAnchor, 'usd'),
  snapshotRow('eps', 'EPS (diluted)', fyAnchor, 'eps'),
  snapshotRow('long_term_debt', 'Long-term Debt', fyAnchor, 'usd'),
  snapshotRow('free_cash_flow', 'Free Cash Flow (FCF)', fyAnchor, 'usd'),
];

const market = state.research?.market_data || {};
let markdownMarket;
if (market.incomplete) {
  markdownMarket = [
    '## Section 2c: Market Data',
    '',
    'Market data is incomplete in this run; share price is available, market cap is not populated, and implied shares are not computed.',
    '',
    market.share_price_usd != null ? `Share price: ${fmtUsdValue(market.share_price_usd)} (${market.source_date || naReason('quote date not returned')}, Yahoo Finance).` : '',
  ].filter(Boolean).join('\n');
} else {
  const marketRows = [
    {
      label: 'Computed Market Cap',
      value_display: market.market_cap_usd != null ? fmtUsdValue(market.market_cap_usd) : naReason('market cap requires share price and SEC DEI shares outstanding'),
      reporting_period: market.source_date || 'latest',
      source: market.market_cap_source || 'Computed: Yahoo share price × SEC DEI shares outstanding',
    },
    {
      label: 'Share Price (Yahoo Finance)',
      value_display: market.share_price_usd != null ? fmtUsdValue(market.share_price_usd) : naReason('live quote not returned from Yahoo Finance'),
      reporting_period: market.source_date || 'latest',
      source: `Yahoo Finance @ ${market.source_date || naReason('quote date not returned')}`,
    },
    {
      label: 'Shares Outstanding (DEI, point-in-time)',
      value_display: market.shares_outstanding != null ? Number(market.shares_outstanding).toLocaleString('en-US') : naReason('SEC DEI shares outstanding not found'),
      reporting_period: market.shares_outstanding_as_of || naReason('DEI shares as-of date not recorded'),
      source: market.shares_outstanding_source || 'SEC DEI',
    },
    {
      label: 'Weighted-Avg Diluted Shares (10-Q anchor)',
      value_display: market.weighted_avg_diluted_shares != null ? Number(market.weighted_avg_diluted_shares).toLocaleString('en-US') : naReason('weighted-average diluted shares not on quarterly anchor'),
      reporting_period: market.weighted_avg_diluted_shares_period || qAnchor?.report_date || naReason('quarterly anchor report period not recorded'),
      source: `${market.weighted_avg_diluted_shares_source || 'SEC EDGAR quarterly anchor'} — quarterly filing anchor; not market-implied shares`,
    },
  ];
  markdownMarket = [
    tableMarkdown(
      '## Section 2c: Market Data',
      `Live quote: Yahoo Finance @ ${market.source_date || naReason('quote date not returned')}.`,
      marketRows,
    ),
    '',
    'Note: Weighted-average diluted shares are for EPS calculation only and should not be used as a substitute for point-in-time shares outstanding or market-implied shares.',
  ].join('\n');
}

function tableMarkdown(title, anchorNote, rows) {
  return [
    title,
    '',
    anchorNote,
    '',
    '| Metric | Value (USD) | Reporting Period | Source |',
    '|---|---|---|---|',
    ...rows.map((r) => `| ${r.label} | ${r.value_display} | ${r.reporting_period} | ${r.source} |`),
  ].join('\n');
}

const qAnchorNote = qAnchor
  ? `Anchored on ${qAnchor.form} filed ${qAnchor.filing_date || naReason('filing date not recorded')} (report period ${qAnchor.report_date || naReason('report period not recorded')}).`
  : naReason('no interim filing anchor found');
const fyAnchorNote = fyAnchor
  ? `Anchored on ${fyAnchor.form} filed ${fyAnchor.filing_date || naReason('filing date not recorded')} (report period ${fyAnchor.report_date || naReason('report period not recorded')}).`
  : naReason('no annual filing anchor found');
const ref8k = anchors.recent_8k;
const refNote = ref8k
  ? `Recent 8-K reference (not used for financial anchors): ${ref8k.form} filed ${ref8k.filing_date || naReason('8-K filing date not recorded')}.`
  : 'No recent 8-K on file.';

const markdownQuarterly = tableMarkdown(
  `## Section 2a: Quarterly Financials (${qPeriodLabel})`,
  qAnchorNote,
  quarterlyRows,
);
const markdownAnnual = tableMarkdown(
  `## Section 2b: Annual Financials (${fyPeriodLabel})`,
  fyAnchorNote,
  annualRows,
);

const unusualLines = unusualQuarterNotes(state);
const markdownQuarterlyWithNotes = [
  markdownQuarterly,
  ...(unusualLines.length ? ['', '### Unusual quarter items (GAAP)', ...unusualLines, '', 'All figures above are GAAP from SEC filings unless noted. Non-GAAP/adjusted metrics are not shown in this table.'] : []),
].join('\n');

const threeYearRevenue = buildThreeYearRevenueFrom10K(state);

const markdown = [
  markdownQuarterlyWithNotes,
  '',
  markdownAnnual,
  '',
  threeYearRevenue.markdown,
  '',
  markdownMarket,
  '',
  refNote,
  '',
  'Notes: All monetary figures are shown in USD. When a value is unavailable, the report states the reason instead of showing a bare N/A.',
].join('\n');

state.research.one_time_items = oneTimeFlags;
state.financial_snapshot = {
  generated_at: now,
  currency: 'USD',
  filing_anchors: anchors,
  quarterly: { anchor: qAnchor, period_label: qPeriodLabel, rows: quarterlyRows, markdown: markdownQuarterlyWithNotes },
  annual: { anchor: fyAnchor, period_label: fyPeriodLabel, rows: annualRows, markdown: markdownAnnual },
  three_year_revenue: threeYearRevenue,
  market_data: { markdown: markdownMarket },
  markdown,
};
state.sections = state.sections || {};
state.sections.s2_quarterly = markdownQuarterlyWithNotes;
state.sections.s2_annual = markdownAnnual;
state.sections.s2_three_year_revenue = threeYearRevenue.markdown;
state.sections.s2_market_data = markdownMarket;
state.sections.s2_snapshot = markdown;
state.audit_log = state.audit_log || [];
state.audit_log.push({
  timestamp: now,
  workflow_name: 'WF_FINANCIAL_SNAPSHOT',
  status: 'OK',
  message: `Financial snapshot: quarterly ${qPeriodLabel}, annual ${fyPeriodLabel}, 3-year 10-K revenue, market data separated.`,
});
return [{ json: state }];
