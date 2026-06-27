// Competitor entity resolution and category-aware product comparison

const COMPETITOR_ENTITY_REGISTRY = [
  { id: 'netflix', aliases: ['netflix', 'nflx'], category: 'streaming', kind: 'standalone', resolved_label: 'Netflix', parent_company: 'Netflix, Inc.', sec_lookup: 'Netflix', ticker: 'NFLX', segment: 'Global streaming' },
  { id: 'disney_plus', aliases: ['disney+', 'disney plus', 'disneyplus'], category: 'streaming', kind: 'brand', resolved_label: 'Disney+ (Disney Entertainment)', parent_company: 'The Walt Disney Company', sec_lookup: 'Disney', ticker: 'DIS', segment: 'Disney+ DTC streaming' },
  { id: 'hulu', aliases: ['hulu'], category: 'streaming', kind: 'brand', resolved_label: 'Hulu (Disney Entertainment)', parent_company: 'The Walt Disney Company', sec_lookup: 'Disney', ticker: 'DIS', segment: 'Hulu streaming' },
  { id: 'hbo_max', aliases: ['hbo max', 'hbomax', 'max streaming'], category: 'streaming', kind: 'brand', resolved_label: 'Max (Warner Bros. Discovery)', parent_company: 'Warner Bros. Discovery', sec_lookup: 'Warner Bros. Discovery', ticker: 'WBD', segment: 'Max DTC streaming' },
  { id: 'max', aliases: ['max'], category: 'streaming', kind: 'brand', resolved_label: 'Max (Warner Bros. Discovery)', parent_company: 'Warner Bros. Discovery', sec_lookup: 'Warner Bros. Discovery', ticker: 'WBD', segment: 'Max DTC streaming', ambiguous_with: ['hbo_max'] },
  { id: 'paramount_plus', aliases: ['paramount+', 'paramount plus', 'paramountplus'], category: 'streaming', kind: 'brand', resolved_label: 'Paramount+ (Paramount Global)', parent_company: 'Paramount Global', sec_lookup: 'Paramount Global', ticker: 'PARA', segment: 'Paramount+ streaming' },
  { id: 'peacock', aliases: ['peacock', 'peacock tv'], category: 'streaming', kind: 'brand', resolved_label: 'Peacock (NBCUniversal / Comcast)', parent_company: 'Comcast', sec_lookup: 'Comcast', ticker: 'CMCSA', segment: 'Peacock streaming' },
  { id: 'apple_tv_plus', aliases: ['apple tv+', 'apple tv plus', 'appletvplus', 'apple tv'], category: 'streaming', kind: 'brand', resolved_label: 'Apple TV+ (Apple Services)', parent_company: 'Apple Inc.', sec_lookup: 'Apple', ticker: 'AAPL', segment: 'Apple TV+ subscription' },
  { id: 'amazon_prime_video', aliases: ['amazon prime video', 'prime video', 'amazon prime'], category: 'streaming', kind: 'service', resolved_label: 'Prime Video (Amazon)', parent_company: 'Amazon.com', sec_lookup: 'Amazon', ticker: 'AMZN', segment: 'Prime Video / Prime membership video' },
  { id: 'youtube_premium', aliases: ['youtube premium', 'youtube tv'], category: 'streaming', kind: 'service', resolved_label: 'YouTube Premium (Alphabet)', parent_company: 'Alphabet Inc.', sec_lookup: 'Alphabet', ticker: 'GOOGL', segment: 'YouTube subscription services' },
  { id: 'spotify', aliases: ['spotify'], category: 'audio_streaming', kind: 'standalone', resolved_label: 'Spotify', parent_company: 'Spotify Technology S.A.', sec_lookup: 'Spotify', ticker: 'SPOT', segment: 'Premium audio streaming' },
  { id: 'warner_bros_discovery', aliases: ['warner bros discovery', 'wbd', 'discovery+', 'discovery plus'], category: 'streaming', kind: 'parent', resolved_label: 'Warner Bros. Discovery (DTC portfolio)', parent_company: 'Warner Bros. Discovery', sec_lookup: 'Warner Bros. Discovery', ticker: 'WBD', segment: 'DTC streaming portfolio' },
  { id: 'disney', aliases: ['disney', 'walt disney'], category: 'streaming', kind: 'parent', resolved_label: 'The Walt Disney Company (DTC)', parent_company: 'The Walt Disney Company', sec_lookup: 'Disney', ticker: 'DIS', segment: 'Disney+ / Hulu / ESPN+ DTC' },
];

const COMPARISON_CATEGORY_SCHEMAS = {
  streaming: {
    label: 'Subscription video streaming',
    metrics: [
      { key: 'subscribers', label: 'Subscribers / paid memberships' },
      { key: 'arpu', label: 'ARPU / monetization' },
      { key: 'revenue', label: 'Revenue (segment or service)' },
      { key: 'profitability', label: 'Profitability' },
      { key: 'pricing', label: 'Entry pricing' },
      { key: 'ad_supported', label: 'Ad-supported tier' },
      { key: 'bundle', label: 'Bundle / plan structure' },
      { key: 'geography', label: 'Geographic availability' },
      { key: 'differentiator', label: 'Key product difference' },
    ],
  },
  audio_streaming: {
    label: 'Audio streaming',
    metrics: [
      { key: 'subscribers', label: 'Paid subscribers / MAUs' },
      { key: 'arpu', label: 'ARPU / monetization' },
      { key: 'revenue', label: 'Revenue' },
      { key: 'profitability', label: 'Profitability / margin' },
      { key: 'pricing', label: 'Entry pricing' },
      { key: 'ad_supported', label: 'Ad-supported tier' },
      { key: 'geography', label: 'Geographic availability' },
      { key: 'differentiator', label: 'Key product difference' },
    ],
  },
  default: {
    label: 'Company financial comparison',
    metrics: [
      { key: 'revenue', label: 'Revenue' },
      { key: 'operating_margin', label: 'Operating margin' },
      { key: 'subscribers', label: 'Customers / subscribers (if disclosed)' },
      { key: 'pricing', label: 'Pricing / monetization signal' },
      { key: 'differentiator', label: 'Key competitive difference' },
    ],
  },
};

function normalizeCompetitorKey(value) {
  return normName(value).replace(/[^a-z0-9]/g, '');
}

function registryEntryScore(entry, inputNorm, inputKey) {
  let best = 0;
  for (const alias of entry.aliases) {
    const aliasNorm = normName(alias);
    const aliasKey = normalizeCompetitorKey(alias);
    if (!aliasNorm) continue;
    if (inputNorm === aliasNorm || inputKey === aliasKey) return 1000 + alias.length;
    if (inputNorm.includes(aliasNorm) || aliasNorm.includes(inputNorm)) {
      best = Math.max(best, 500 + alias.length);
    }
  }
  return best;
}

function resolveCompetitorEntity(inputName, industryHint) {
  const entered = String(inputName || '').trim();
  const inputNorm = normName(entered);
  const inputKey = normalizeCompetitorKey(entered);
  if (!entered) {
    return {
      entered_name: entered,
      resolved_label: entered,
      parent_company: null,
      category: inferComparisonCategory(industryHint),
      sec_lookup_name: entered,
      ticker: null,
      kind: 'unknown',
      segment: null,
      ambiguous: false,
      resolution_note: null,
    };
  }

  const ranked = COMPETITOR_ENTITY_REGISTRY
    .map((entry) => ({ entry, score: registryEntryScore(entry, inputNorm, inputKey) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const best = ranked[0]?.entry || null;
  const runnerUp = ranked[1]?.entry || null;
  const ambiguous = Boolean(best && runnerUp && ranked[0].score === ranked[1].score && best.id !== runnerUp.id);

  if (best) {
    const category = best.category || inferComparisonCategory(industryHint);
    const resolutionNote = best.kind === 'brand' || best.kind === 'service'
      ? `Resolved product/service to ${best.resolved_label} (${best.parent_company}).`
      : null;
    return {
      entered_name: entered,
      resolved_label: best.resolved_label,
      parent_company: best.parent_company,
      category,
      sec_lookup_name: best.sec_lookup || best.parent_company || entered,
      ticker: best.ticker || null,
      kind: best.kind,
      segment: best.segment || null,
      ambiguous,
      resolution_note: ambiguous
        ? `Ambiguous match — showing best fit: ${best.resolved_label}.`
        : resolutionNote,
    };
  }

  return {
    entered_name: entered,
    resolved_label: entered,
    parent_company: null,
    category: inferComparisonCategory(industryHint),
    sec_lookup_name: entered,
    ticker: null,
    kind: 'unknown',
    segment: null,
    ambiguous: false,
    resolution_note: null,
  };
}

function inferComparisonCategory(industryHint) {
  const key = String(industryHint || '').toLowerCase();
  if (/(stream|video|ott|entertainment|media)/.test(key)) return 'streaming';
  if (/(music|audio|podcast)/.test(key)) return 'audio_streaming';
  return 'default';
}

function getComparisonSchema(category) {
  return COMPARISON_CATEGORY_SCHEMAS[category] || COMPARISON_CATEGORY_SCHEMAS.default;
}

function corpusForCompetitor(state, entity) {
  const names = [entity.entered_name, entity.resolved_label, entity.parent_company, entity.segment]
    .filter(Boolean);
  const signals = [
    ...(state.research?.news_events || []),
    ...(state.research?.private_research?.serper_results || []),
  ];
  const chunks = [];
  for (const item of signals) {
    const text = `${item.title || ''} ${item.description || item.snippet || ''}`.trim();
    if (!text) continue;
    if (names.some((name) => entityMentionedInText(text, name))) {
      chunks.push({ text, source: item.source_name || item.source_url || 'public search' });
    }
  }
  const notes = String(state.inputs?.source_notes || state.inputs?.advanced_context?.source_notes || '');
  if (notes && names.some((name) => entityMentionedInText(notes, name))) {
    chunks.push({ text: notes, source: 'user source notes' });
  }
  return chunks;
}

function parseSubscriberCount(text) {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(million|m|billion|b)?\s*(?:global\s+)?(?:paid\s+)?(?:streaming\s+)?(?:subscribers|memberships|subs|paid members)\b/i);
  if (!m) return null;
  const num = Number(m[1]);
  const unit = String(m[2] || '').toLowerCase();
  let n = num;
  if (unit.startsWith('b')) n *= 1e9;
  else if (unit.startsWith('m') || unit === 'million') n *= 1e6;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  return String(num);
}

function extractSubscriberMetric(text) {
  const parsed = parseSubscriberCount(text);
  return parsed ? `${parsed} subscribers` : null;
}

function extractArpuMetric(text) {
  const patterns = [
    /arpu[^$%\d]{0,20}\$?(\d+(?:\.\d+)?)/i,
    /average\s+revenue\s+per\s+(?:membership|user|subscriber)[^$]{0,12}\$?(\d+(?:\.\d+)?)/i,
    /revenue\s+per\s+(?:membership|subscriber)[^$]{0,12}\$?(\d+(?:\.\d+)?)/i,
    /\$(\d+(?:\.\d+)?)\s+arpu/i,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) return `$${m[1]}/month (ARPU)`;
  }
  const proxy = text.match(/(?:monetization|average\s+monthly\s+revenue)[^$]{0,20}\$?(\d+(?:\.\d+)?)\s*(?:\/|per)\s*month/i);
  if (proxy) return `$${proxy[1]}/month (monetization proxy)`;
  return null;
}

function extractSegmentRevenueMetric(text) {
  const patterns = [
    /(?:streaming|direct[- ]to[- ]consumer|dtc|subscription)\s+revenue[^$]{0,20}\$?(\d+(?:\.\d+)?)\s*(billion|million|b|m)\b/i,
    /\$(\d+(?:\.\d+)?)\s*(billion|million|b|m)\s+(?:in\s+)?(?:streaming|subscription|dtc)\s+revenue/i,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (!m) continue;
    const unit = String(m[2] || '').toLowerCase();
    const suffix = unit.startsWith('b') ? 'B' : 'M';
    return `$${m[1]}${suffix} (segment revenue)`;
  }
  return null;
}

function extractProfitabilityMetric(text) {
  const patterns = [
    /(?:streaming|dtc|direct[- ]to[- ]consumer)\s+(?:segment\s+)?operating\s+(?:income|profit)[^$%-]{0,20}(-?\$?\d+(?:\.\d+)?\s*(?:billion|million|b|m)?)/i,
    /operating\s+margin[^%]{0,12}(\d+(?:\.\d+)?)\s*%/i,
    /(?:profitable|profitability|loss)[^.]{0,60}(?:streaming|dtc|subscription)/i,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (!m) continue;
    if (m[1] && /%/.test(m[0])) return `${m[1]}% operating margin (proxy)`;
    if (m[1]) return `${m[1]} (segment profitability)`;
    return m[0].trim().slice(0, 120);
  }
  return null;
}

function extractPricingMetric(text) {
  const prices = [...text.matchAll(/\$(\d+(?:\.\d+)?)\s*(?:\/|per)\s*month/gi)].map((m) => Number(m[1]));
  if (!prices.length) {
    const alt = text.match(/(?:from|starting at|plans? from)\s*\$(\d+(?:\.\d+)?)/i);
    if (alt) prices.push(Number(alt[1]));
  }
  if (!prices.length) return null;
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  return low === high ? `From $${low}/month` : `$${low}–$${high}/month`;
}

function extractAdSupportedMetric(text) {
  if (/ad[- ]?free only|no ad[- ]?supported|without ads only/i.test(text)) return 'No (ad-free only)';
  if (/ad[- ]?supported|with ads|advertising tier|ad tier|ads plan|ad-supported/i.test(text)) return 'Yes';
  return null;
}

function extractBundleMetric(text) {
  const patterns = [
    /bundle(?:d)? with[^.]{0,80}/i,
    /included with prime/i,
    /disney bundle|hulu.*espn/i,
    /triple play|combo plan/i,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) return m[0].trim().slice(0, 140);
  }
  return null;
}

function extractGeographyMetric(text) {
  if (/global(?:ly)?|worldwide|190\+?\s*countries/i.test(text)) return 'Global';
  if (/united states|u\.s\.|north america/i.test(text) && !/global|worldwide/i.test(text)) return 'Primarily US';
  if (/europe|emea|apac|latin america/i.test(text)) return 'Multi-region (see sources)';
  return null;
}

function extractProductDifference(chunks) {
  const patterns = [
    /exclusive originals?/i,
    /live sports/i,
    /offline downloads?/i,
    /password sharing|account sharing/i,
    /bundle(?:d)? with/i,
    /gaming/i,
    /4k|uhd/i,
    /ad[- ]?supported tier/i,
  ];
  for (const chunk of chunks) {
    for (const pattern of patterns) {
      if (!pattern.test(chunk.text)) continue;
      const sentence = chunk.text.split(/[.!?]/).find((s) => pattern.test(s));
      if (sentence && sentence.trim().length > 12 && sentence.trim().length < 220) {
        return sentence.trim();
      }
    }
  }
  return null;
}

function extractCategoryMetrics(category, chunks) {
  const combined = chunks.map((c) => c.text).join(' ');
  const schema = getComparisonSchema(category);
  const values = {
    subscribers: extractSubscriberMetric(combined),
    arpu: extractArpuMetric(combined),
    revenue: extractSegmentRevenueMetric(combined),
    profitability: extractProfitabilityMetric(combined),
    pricing: extractPricingMetric(combined),
    ad_supported: extractAdSupportedMetric(combined),
    bundle: extractBundleMetric(combined),
    geography: extractGeographyMetric(combined),
    differentiator: extractProductDifference(chunks),
    operating_margin: null,
  };
  const metrics = {};
  for (const col of schema.metrics) {
    metrics[col.key] = values[col.key] || 'N/A';
  }
  return metrics;
}

function buildCompetitorComparisonRow(state, entity, role) {
  const chunks = corpusForCompetitor(state, entity);
  const metrics = extractCategoryMetrics(entity.category, chunks);
  return {
    entered_name: entity.entered_name,
    resolved_label: entity.resolved_label,
    parent_company: entity.parent_company,
    category: entity.category,
    category_label: getComparisonSchema(entity.category).label,
    kind: entity.kind,
    segment: entity.segment,
    role,
    ambiguous: entity.ambiguous,
    resolution_note: entity.resolution_note,
    metrics,
    source_status: chunks.length ? 'PUBLIC_SIGNAL' : 'NO_PUBLIC_SIGNAL',
    sources: [...new Set(chunks.map((c) => c.source).filter(Boolean))].slice(0, 3),
  };
}

function dominantComparisonCategory(entities) {
  const counts = {};
  for (const entity of entities) {
    const cat = entity.category || 'default';
    counts[cat] = (counts[cat] || 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || 'default';
}

function buildCompetitorComparisons(state, targetCompanyName, peerInputNames) {
  const industry = state.inputs?.industry || '';
  const targetEntity = resolveCompetitorEntity(targetCompanyName, industry);
  if (!targetEntity.parent_company && targetCompanyName) {
    targetEntity.resolved_label = targetCompanyName;
    targetEntity.sec_lookup_name = targetCompanyName;
  }
  const peerNames = (peerInputNames || []).filter(Boolean).slice(0, 5);
  const peerEntities = peerNames.map((name) => resolveCompetitorEntity(name, industry));
  const allEntities = [targetEntity, ...peerEntities];
  const category = dominantComparisonCategory(allEntities.filter((e) => e.category !== 'default')) || inferComparisonCategory(industry);
  const schema = getComparisonSchema(category);

  for (const entity of allEntities) {
    if (entity.category === 'default' && category !== 'default') entity.category = category;
  }

  const targetRow = buildCompetitorComparisonRow(state, targetEntity, 'target company');
  const competitorRows = peerEntities.map((entity, index) => {
    const roles = ['close competitor', 'industry peer', 'benchmark peer'];
    return buildCompetitorComparisonRow(state, entity, roles[index] || 'competitor');
  });
  const rows = [targetRow, ...competitorRows];

  const hasData = rows.some((row) => schema.metrics.some((col) => row.metrics[col.key] !== 'N/A'));
  const markdown = hasData ? formatCompetitorComparisonMarkdown(schema, rows) : '';

  return {
    category,
    category_label: schema.label,
    metric_columns: schema.metrics,
    rows,
    has_data: hasData,
    markdown,
  };
}

function formatCompetitorComparisonMarkdown(schema, rows) {
  const headers = ['Entered name', 'Resolved entity', 'Category', ...schema.metrics.map((m) => m.label)];
  const lines = [
    '### Product / service competitor comparison',
    '',
    'User-entered names are preserved; brands and services are resolved to the closest comparable business unit. Metrics show N/A when not found in public sources.',
    '',
    `| ${headers.join(' | ')} |`,
    `|---|${headers.slice(1).map(() => '---').join('|')}|`,
    ...rows.map((row) => {
      const cells = [
        row.entered_name,
        row.resolved_label + (row.parent_company && row.kind !== 'standalone' ? ` (${row.parent_company})` : ''),
        row.category_label || row.category,
        ...schema.metrics.map((col) => row.metrics[col.key] || 'N/A'),
      ];
      return `| ${cells.join(' | ')} |`;
    }),
  ];
  return lines.join('\n');
}

function peerProductSerperQueries(peerNames, industryHint) {
  const queries = [];
  for (const rawName of (peerNames || []).slice(0, 5)) {
    const entity = resolveCompetitorEntity(rawName, industryHint);
    const searchName = entity.resolved_label || rawName;
    const parent = entity.parent_company && entity.kind !== 'standalone' ? entity.parent_company : '';
    const label = parent ? `${searchName} ${parent}` : searchName;
    if (entity.category === 'streaming' || entity.category === 'audio_streaming') {
      queries.push(
        `${label} subscribers paid memberships ARPU streaming 2024 2025`,
        `${label} pricing plan monthly ad-supported bundle`,
        `${label} streaming revenue operating income segment profitability`,
      );
    } else {
      queries.push(
        `${label} revenue subscribers pricing competitive metrics`,
        `${label} market share product comparison`,
      );
    }
  }
  return queries.slice(0, 12);
}

// Backward-compatible wrapper used by peer benchmarks workflow
function buildProductPeerComparison(state, entityNames) {
  const company = state.entity?.legal_name || state.inputs?.company_name || entityNames?.[0] || 'Company';
  const peers = (entityNames || []).filter((name) => normName(name) !== normName(company));
  const comparison = buildCompetitorComparisons(state, company, peers.length ? peers : entityNames?.slice(1) || []);
  return {
    rows: comparison.rows,
    metric_columns: comparison.metric_columns,
    category: comparison.category,
    category_label: comparison.category_label,
    markdown: comparison.markdown,
    has_data: comparison.has_data,
  };
}
