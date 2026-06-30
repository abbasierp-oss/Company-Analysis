// Standardized peer comparison with SEC-first sourcing and labeled fallbacks

const PEER_CATEGORY_ROLES = ['target company', 'scale benchmark', 'close competitor', 'industry peer', 'category peer'];

const STREAMING_CATEGORY_PROXY = {
  revenue: 15e9,
  operating_margin: 0.12,
  net_margin: 0.08,
  fcf_margin: 0.1,
  revenue_growth: 0.08,
  source: 'Subscription streaming category median proxy',
  method: 'Estimated from comparable streaming peer set when entity SEC tags and curated fallback are unavailable',
};

const PEER_ANNUAL_FALLBACK = {
  netflix: {
    fy: 2024,
    revenue: 39.0e9,
    operating_margin: 0.267,
    net_margin: 0.22,
    fcf_margin: 0.18,
    revenue_growth: 0.156,
    source: 'Netflix FY2024 Form 10-K (approx. from filed annual figures)',
    method: 'Annual report compilation when live SEC tags are incomplete',
  },
  disney: {
    fy: 2024,
    revenue: 91.4e9,
    operating_margin: 0.111,
    net_margin: 0.072,
    fcf_margin: 0.09,
    revenue_growth: 0.03,
    source: 'Disney FY2024 Form 10-K (consolidated; approximation)',
    method: 'Latest annual report figures — consolidated entity, not Disney+ standalone',
  },
  'warner bros discovery': {
    fy: 2024,
    revenue: 38.2e9,
    operating_margin: 0.02,
    net_margin: -0.04,
    fcf_margin: 0.08,
    revenue_growth: -0.07,
    source: 'WBD FY2024 Form 10-K (consolidated; approximation)',
    method: 'Latest annual report — Max/HBO Max maps to parent WBD consolidated financials',
  },
  amazon: {
    fy: 2024,
    revenue: 638.0e9,
    operating_margin: 0.109,
    net_margin: 0.093,
    fcf_margin: 0.12,
    revenue_growth: 0.11,
    source: 'Amazon FY2024 Form 10-K (consolidated; approximation)',
    method: 'Prime Video compared via Amazon consolidated annual report — not Prime Video standalone',
  },
  apple: {
    fy: 2024,
    revenue: 391.0e9,
    operating_margin: 0.315,
    net_margin: 0.242,
    fcf_margin: 0.26,
    revenue_growth: 0.02,
    source: 'Apple FY2024 Form 10-K (consolidated; approximation)',
    method: 'Apple TV+ compared via Apple Services/consolidated annual report proxy',
  },
  comcast: {
    fy: 2024,
    revenue: 121.6e9,
    operating_margin: 0.19,
    net_margin: 0.11,
    fcf_margin: 0.14,
    revenue_growth: 0.05,
    source: 'Comcast FY2024 Form 10-K (consolidated; approximation)',
    method: 'Peacock compared via NBCUniversal/Comcast consolidated annual figures',
  },
  'paramount global': {
    fy: 2024,
    revenue: 28.7e9,
    operating_margin: 0.05,
    net_margin: -0.02,
    fcf_margin: 0.04,
    revenue_growth: -0.02,
    source: 'Paramount Global FY2024 Form 10-K (approximation)',
    method: 'Paramount+ compared via parent consolidated annual report',
  },
  alphabet: {
    fy: 2024,
    revenue: 350.0e9,
    operating_margin: 0.32,
    net_margin: 0.28,
    fcf_margin: 0.25,
    revenue_growth: 0.14,
    source: 'Alphabet FY2024 Form 10-K (consolidated; approximation)',
    method: 'YouTube Premium compared via Alphabet consolidated annual proxy',
  },
};

function fallbackKeyForEntity(name, secLookupName) {
  const keys = [secLookupName, name].filter(Boolean).map((n) => normName(n));
  for (const [key] of Object.entries(PEER_ANNUAL_FALLBACK)) {
    const nk = normName(key);
    if (keys.some((k) => k.includes(nk) || nk.includes(k))) return key;
  }
  return null;
}

function labeledApprox(value, kind, sourceNote) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const display = kind === 'pct' ? `~${fmtPct(value)}` : `~${fmtUsdValue(value)}`;
  return { display, approx: true, source_note: sourceNote };
}

function metricFromSecComputed(computed, key, fyLabel) {
  const map = {
    revenue: 'Revenue',
    operating_margin: 'Operating Margin',
    net_margin: 'Net Margin',
    fcf_margin: 'FCF Margin',
    revenue_growth: 'YoY Revenue Growth',
  };
  const val = computed[map[key]];
  if (!val || isUnavailableDisplay(val)) return null;
  return { display: `${val} (${fyLabel})`, approx: false, source_note: `SEC EDGAR company facts — FY${fyLabel.replace('FY', '')} annual filing` };
}

function buildPeerAnnualMetricBundle(merged, benchmarkFy, fx, native, entityName, secLookupName) {
  const fyCandidates = [benchmarkFy, benchmarkFy - 1, benchmarkFy - 2];
  const fy = fyCandidates.find((y) => annualFactValue(merged, 'revenue', y, fx, native)) || benchmarkFy;
  const fyLabel = `FY${fy}`;
  const computed = computePeerMetricsFromFacts(merged, fy, fx, native);

  const secSource = `SEC EDGAR annual company facts (${fyLabel})`;
  const bundle = {
    fy,
    fy_label: fyLabel,
    revenue: metricFromSecComputed(computed, 'revenue', fyLabel),
    operating_margin: metricFromSecComputed(computed, 'operating_margin', fyLabel),
    net_margin: metricFromSecComputed(computed, 'net_margin', fyLabel),
    fcf_margin: metricFromSecComputed(computed, 'fcf_margin', fyLabel),
    revenue_growth: metricFromSecComputed(computed, 'revenue_growth', fyLabel),
    primary_source: secSource,
    method: 'SEC filing',
  };

  const fallbackKey = fallbackKeyForEntity(entityName, secLookupName);
  const fallback = fallbackKey ? PEER_ANNUAL_FALLBACK[fallbackKey] : null;
  const fallbackFy = fallback ? `FY${fallback.fy}` : fyLabel;

  function fill(key, secKey, kind) {
    if (bundle[key]?.display) return;
    if (!fallback) {
      const proxy = STREAMING_CATEGORY_PROXY;
      const approx = labeledApprox(proxy[secKey], kind, `${proxy.source} — ${proxy.method}`);
      if (approx) {
        bundle[key] = { ...approx, display: `${approx.display} (${fyLabel}, category proxy)` };
        bundle.method = 'category median proxy';
        bundle.primary_source = `${bundle.primary_source}; ${proxy.source}`;
      }
      return;
    }
    const approx = labeledApprox(fallback[secKey], kind, `${fallback.source} — ${fallback.method}`);
    if (approx) {
      bundle[key] = { ...approx, display: `${approx.display} (${fallbackFy}, approximation)` };
      bundle.method = bundle.method === 'SEC filing' ? 'SEC filing + annual report fallback' : 'annual report fallback';
      bundle.primary_source = `${bundle.primary_source}; fallback: ${fallback.source}`;
    }
  }

  fill('revenue', 'revenue', 'usd');
  fill('operating_margin', 'operating_margin', 'pct');
  fill('net_margin', 'net_margin', 'pct');
  fill('fcf_margin', 'fcf_margin', 'pct');
  fill('revenue_growth', 'revenue_growth', 'pct');

  return bundle;
}

function buildCategoricalPeerRow(name, resolved, role, category, metricBundle) {
  const m = metricBundle;
  return {
    company_name: name,
    entered_name: resolved.entered_name || name,
    resolved_label: resolved.resolved_label || name,
    parent_company: resolved.parent_company || null,
    role,
    category: category || resolved.category || 'peer',
    category_label: getComparisonSchema(resolved.category || category || 'default').label,
    reporting_period: m.fy_label,
    latest_annual_revenue: m.revenue?.display || `~N/A (${m.fy_label})`,
    operating_margin: m.operating_margin?.display || `~N/A (${m.fy_label})`,
    net_margin: m.net_margin?.display || `~N/A (${m.fy_label})`,
    fcf_margin: m.fcf_margin?.display || `~N/A (${m.fy_label})`,
    revenue_growth: m.revenue_growth?.display || `~N/A (${m.fy_label})`,
    source_note: m.primary_source || m.method,
    method: m.method,
    approx_fields: ['revenue', 'operating_margin', 'net_margin', 'fcf_margin', 'revenue_growth']
      .filter((k) => m[k]?.approx),
  };
}

function formatCategoricalPeerMarkdown(rows, benchmarkFy, now, productComparisonMarkdown) {
  const lines = [
    '## Section 3: Peer Comparison & Benchmarking',
    '',
    `Data fetched at runtime: ${now}`,
    `Benchmark window: latest available annual filings aligned to FY${benchmarkFy} methodology. Quarterly figures are not mixed into this peer table.`,
    '',
    'Each peer row is categorically populated. Values prefixed with ~ are approximations from the latest annual report or curated market-source fallback when SEC company-facts tags are incomplete. See source note per row.',
    '',
    '| Company | Role / category | Reporting period | Latest annual revenue | Operating margin | Net margin | FCF margin | Revenue growth (YoY) | Source note |',
    '|---|---|---|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.company_name}${r.resolved_label && r.entered_name !== r.resolved_label ? ` → ${r.resolved_label}` : ''} | ${r.role} / ${r.category_label || r.category} | ${r.reporting_period} | ${r.latest_annual_revenue} | ${r.operating_margin} | ${r.net_margin} | ${r.fcf_margin} | ${r.revenue_growth} | ${r.source_note} |`),
  ];
  if (productComparisonMarkdown) {
    lines.push('', productComparisonMarkdown);
  }
  return lines.join('\n');
}
