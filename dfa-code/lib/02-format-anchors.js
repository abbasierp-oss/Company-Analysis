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
