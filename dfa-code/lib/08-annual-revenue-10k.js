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
