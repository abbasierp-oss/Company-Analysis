const IT_INITIATIVE_PATTERNS = [
  { re: /cloud\s+(?:migration|modernization|transformation|platform)/i, name: 'Cloud migration / modernization', goal: 'Modernize infrastructure and reduce run cost', metric: 'Infrastructure cost and deployment velocity' },
  { re: /(?:erp|sap|oracle|workday)\s+(?:upgrade|implementation|migration|rollout)/i, name: 'ERP / core systems modernization', goal: 'Unify finance and operations on a single platform', metric: 'Close cycle time and reporting accuracy' },
  { re: /data\s+(?:platform|lake|warehouse|analytics|governance)/i, name: 'Enterprise data platform', goal: 'Improve decision latency with governed analytics', metric: 'Reporting cycle time and data quality' },
  { re: /(?:ai|artificial intelligence|machine learning|genai|generative ai)/i, name: 'AI / intelligent automation', goal: 'Automate high-volume workflows and insights', metric: 'Process cost and cycle time' },
  { re: /cyber(?:security)?|zero\s*trust|identity\s+(?:management|governance)/i, name: 'Cybersecurity / zero trust', goal: 'Reduce breach and compliance risk', metric: 'Risk exposure and audit readiness' },
  { re: /customer\s+(?:360|crm|experience|engagement)/i, name: 'Customer experience / CRM', goal: 'Grow retention and lifetime value', metric: 'Revenue retention and churn' },
  { re: /digital\s+(?:transformation|channel|commerce)/i, name: 'Digital transformation', goal: 'Shift revenue and service delivery to digital channels', metric: 'Digital revenue mix and margin' },
  { re: /automation|rpa|process\s+(?:mining|optimization)/i, name: 'Process automation', goal: 'Remove manual effort in core processes', metric: 'Operating margin and FCF conversion' },
  { re: /(?:devops|ci\/?cd|platform\s+engineering)/i, name: 'Engineering platform / DevOps', goal: 'Accelerate product delivery', metric: 'Release frequency and incident rate' },
];

function parseInitiativeList(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((s) => String(s).trim()).filter(Boolean);
  return String(raw).split(/[,;\n|]/).map((s) => s.trim()).filter(Boolean);
}

function extractITInitiatives(state) {
  const inputs = state.inputs || {};
  const explicit = parseInitiativeList(inputs.it_initiatives || inputs.it_initiative_list || inputs.initiative_roadmap);
  const fromNotes = parseInitiativeList(inputs.source_notes).filter((line) => /initiative|roadmap|program|migration|modernization|transformation|platform/i.test(line));
  const corpus = [
    String(inputs.source_notes || ''),
    ...(state.research?.news_events || []).map((e) => `${e.title || ''} ${e.description || ''}`),
  ].join('\n');

  const found = [];
  const seen = new Set();

  function addInitiative(item) {
    const key = normName(item.name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    found.push(item);
  }

  for (const name of [...explicit, ...fromNotes]) {
    addInitiative({
      name,
      goal: 'Stated company IT priority',
      metric: 'Executive KPI tied to this program',
      source: explicit.includes(name) ? 'user_initiative_list' : 'user_source_notes',
      status: 'disclosed',
    });
  }

  for (const pattern of IT_INITIATIVE_PATTERNS) {
    if (!pattern.re.test(corpus)) continue;
    addInitiative({
      name: pattern.name,
      goal: pattern.goal,
      metric: pattern.metric,
      source: 'public_disclosure_search',
      status: 'disclosed',
    });
  }

  return found;
}

function linkRecommendationToInitiative(priority, initiatives, index) {
  const initiative = initiatives[index % initiatives.length];
  return {
    ...priority,
    initiative_name: initiative.name,
    initiative_goal: initiative.goal,
    outcome_metric: priority.metric || initiative.metric,
    goal_support: `Supports "${initiative.goal}" through ${priority.title.toLowerCase()}.`,
    rationale: `${priority.rationale} This recommendation advances the active initiative "${initiative.name}".`,
    source: initiative.source,
  };
}

function buildPortalDashboard(state) {
  const q = getQuarterlyAnchorMetrics(state);
  const market = state.research?.market_data || {};
  const initiatives = extractITInitiatives(state);
  const linked = (state.executive_proposal?.priorities || []).map((p, i) => linkRecommendationToInitiative(p, initiatives, i));
  const peers = state.peer_benchmarks?.peers || [];
  const targetPeer = state.peer_benchmarks?.target || null;
  const productComparison = state.peer_benchmarks?.product_comparison || {};
  const competitorRows = productComparison.rows || [];
  const competitorColumns = productComparison.metric_columns || [];

  function metricTile(id, label, metric, kind) {
    const val = metric && metric.value != null ? formatQuarterlyMetric(metric, kind) : naReason(label + ' not on anchored filing');
    const num = metric && metric.value != null ? Number(metric.value) : null;
    return { id, label, display: val, value: num, kind: kind || 'usd' };
  }

  const metrics = [
    metricTile('revenue', 'Revenue', q.revenue, 'usd'),
    metricTile('operating_margin', 'Operating Margin', q.operating_margin, 'pct'),
    metricTile('net_margin', 'Net Margin', q.net_margin, 'pct'),
    metricTile('free_cash_flow', 'Free Cash Flow', q.free_cash_flow, 'usd'),
    metricTile('eps', 'EPS', q.eps, 'eps'),
  ];

  if (market.market_cap_usd != null) {
    metrics.push({ id: 'market_cap', label: 'Market Cap', display: fmtUsdValue(market.market_cap_usd), value: market.market_cap_usd, kind: 'usd' });
  }

  const peerBars = peers.slice(0, 3).map((peer) => {
    const op = peer.metrics?.['Operating Margin'] || peer.metrics?.['Op Margin'] || 'N/A';
    const rev = peer.metrics?.Revenue || 'N/A';
    return { name: peer.name, operating_margin: op, revenue: rev, role: peer.role || 'peer' };
  });

  return {
    company: companyDisplayName(state.entity, state.inputs),
    period_label: q.period_label || 'Quarterly anchor',
    metrics,
    initiatives,
    recommendations: linked,
    peer_comparison: {
      published: state.peer_benchmarks?.table_published === true,
      benchmark_fy: state.peer_benchmarks?.benchmark_fy || null,
      target: targetPeer ? { name: targetPeer.name, metrics: targetPeer.metrics } : null,
      peers: peerBars,
      product_comparison: {
        published: productComparison.has_data === true,
        category: productComparison.category || null,
        category_label: productComparison.category_label || null,
        metric_columns: competitorColumns,
        rows: competitorRows.slice(0, 6),
      },
    },
    initiative_impact: linked.map((rec) => ({
      initiative: rec.initiative_name,
      recommendation: rec.title,
      outcome_metric: rec.outcome_metric,
      goal: rec.initiative_goal,
    })),
  };
}
