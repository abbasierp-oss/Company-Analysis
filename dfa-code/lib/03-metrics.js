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

function formatAnchoredMetricValue(metric, kind) {
  if (!metric || metric.value === null || metric.value === undefined) {
    const label = kind === 'pct' ? 'margin' : (kind === 'eps' ? 'EPS' : 'metric');
    return naReason(`${label} not found on the anchored quarterly filing`);
  }
  const flag = metric.one_time_flag ? ` ⚠ ${metric.one_time_flag}` : '';
  if (kind === 'pct' || metric.unit === 'ratio') return `${fmtPct(metric.value)}${flag}`;
  if (kind === 'eps' || metric.unit === 'USD/shares') return `${fmtEps(metric.value)}${flag}`;
  return `${fmtUsdValue(metric.value)}${flag}`;
}

function metricCitationShort(metric, fallbackForm) {
  if (metric?.source_name) return `Source: ${metric.source_name}`;
  return `Source: SEC EDGAR ${fallbackForm || 'filing'}`;
}

function companyDisplayName(entity, inputs) {
  const legal = entity?.legal_name || inputs?.company_name || 'the company';
  const ticker = String(entity?.ticker || inputs?.ticker || '').toUpperCase();
  if (ticker === 'NFLX' || /netflix/i.test(legal)) return 'Netflix';
  return legal.replace(/\s+(Inc|Corp|Corporation|Ltd|Group|Co)\.?$/i, '').trim() || legal;
}

function detectLeadershipBullet(state, signals) {
  const display = companyDisplayName(state.entity, state.inputs);
  const items = Array.isArray(signals) ? signals : [];
  for (const item of items) {
    const text = `${item.title || ''} ${item.description || item.snippet || ''}`;
    const lower = text.toLowerCase();
    if (!/re-election|re election|step down|resign|appointed (ceo|cfo)|board.*annual meeting|leadership transition/i.test(lower)) continue;
    if (/hastings/i.test(lower) && /not seek re-election|won't seek re-election|will not seek re-election/i.test(lower)) {
      return `Reed Hastings will not seek re-election to ${display}'s board at the June annual meeting.`;
    }
    const nameMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(?:will\s+not|won't|to)\s+(?:seek\s+)?re-election/i);
    if (nameMatch) {
      const month = /june/i.test(lower) ? 'June' : (/may/i.test(lower) ? 'May' : 'the upcoming');
      return `${nameMatch[1]} will not seek re-election to ${display}'s board at the ${month} annual meeting.`;
    }
    const title = String(item.title || '').trim();
    if (title.length > 24 && title.length < 220 && /board|ceo|cfo|re-election|resign/i.test(title)) {
      return title.endsWith('.') ? title : `${title}.`;
    }
  }
  return null;
}

function formatMarketCapProof(market) {
  if (!market?.market_cap_usd) return 'Computed market cap unavailable.';
  return `Computed market cap ${fmtUsdValue(market.market_cap_usd)} from Yahoo share price and SEC DEI shares outstanding.`;
}

function formatQuarterlyMetric(metric, kind) {
  return formatAnchoredMetricValue(metric, kind);
}

function formatAnnualMetric(metric, kind) {
  return formatAnchoredMetricValue(metric, kind);
}

function aggregateReportGaps(state) {
  const gaps = [...(state.normalized?.gaps || [])];
  const ts = new Date().toISOString();
  if (state.peer_benchmarks && !state.peer_benchmarks.table_published) {
    gaps.push({
      metric: 'peer_benchmarks',
      reason: state.peer_benchmarks.withhold_reason || 'Peer comparison omitted — core FY peer metrics incomplete across entities.',
      source: 'WF_PEER_BENCHMARKS',
      timestamp: ts,
    });
  }
  const qNa = (state.ratio_dashboard?.quarterly || []).filter((r) => isUnavailableDisplay(r.value)).length;
  const aNa = (state.ratio_dashboard?.annual || []).flatMap((r) => r.values || []).filter((v) => isUnavailableDisplay(v)).length;
  if (qNa > 0) gaps.push({ metric: 'quarterly_ratios', reason: `${qNa} quarterly ratio(s) unavailable on anchored filing — see Section 5 for reasons.`, source: 'WF_RATIO_DASHBOARD', timestamp: ts });
  if (aNa > 0) gaps.push({ metric: 'annual_ratios', reason: `${aNa} annual ratio value(s) unavailable — required line items missing.`, source: 'WF_RATIO_DASHBOARD', timestamp: ts });
  if (!state.research?.market_data?.market_cap_usd) {
    gaps.push({ metric: 'market_cap', reason: 'Computed market cap unavailable (requires Yahoo share price and SEC DEI shares outstanding).', source: 'WF_RESEARCH_PUBLIC', timestamp: ts });
  }
  return gaps;
}

function unusualQuarterNotes(state) {
  const flags = state.research?.one_time_items || [];
  if (!flags.some((f) => f.id === 'warner_bros_termination_fee')) return [];
  return [
    '- A one-time Warner Bros. termination fee was recognized in interest and other income in Q1 FY2026.',
    '- This item inflated net income and EPS; use adjusted analysis when evaluating core operating performance.',
  ];
}

function dilutedSharesAtAnchor(facts, anchor) {
  if (!anchor) return null;
  const found = tagRowsMerged(facts, 'diluted_shares');
  const row = found.rows
    .filter((r) => isInterimForm(r.form) && rowMatchesAnchor(r, anchor))
    .sort((a, b) => String(a.filed || '').localeCompare(String(b.filed || '')) || String(a.end || '').localeCompare(String(b.end || '')))
    .at(-1);
  if (!row) return null;
  return {
    value: Number(row.val),
    source_name: `SEC EDGAR ${found.taxonomy || 'us-gaap'}:${found.tag}`,
    reporting_period: row.end || anchor.report_date,
    source_section: row.form || anchor.form,
    concept: 'weighted_average_diluted',
  };
}

function deiSharesOutstanding(deiFacts) {
  if (!deiFacts?.EntityCommonStockSharesOutstanding) return null;
  const row = Object.values(deiFacts.EntityCommonStockSharesOutstanding.units || {}).flat()
    .filter((r) => r && r.val !== undefined)
    .sort((a, b) => String(a.filed || '').localeCompare(String(b.filed || '')) || String(a.end || '').localeCompare(String(b.end || '')))
    .at(-1);
  if (!row) return null;
  return {
    value: Number(row.val),
    source_name: 'SEC DEI:EntityCommonStockSharesOutstanding',
    reporting_period: row.end || row.filed,
    concept: 'shares_outstanding',
  };
}
