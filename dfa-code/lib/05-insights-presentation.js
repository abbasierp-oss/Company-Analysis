function claudeBaseSystem(inputs, expert) {
  return `You are an AI financial analyst preparing executive-ready analysis. Evidence first. Every figure must come from the provided JSON only. Never fabricate numbers. If data is missing, explain why instead of using bare N/A. Show formulas for computed metrics. Do not use templating placeholders or curly-brace variables. Industry lens: ${expert?.name || inputs.expert_pref || 'industry expert'}. Executive audience: ${inputs.exec_type || 'executive'}. Service provider: ${inputs.service_provider || 'MY COMPANY'}.`;
}

function parseClaudeJson(response) {
  const content = response?.content || [];
  const text = content.map((p) => p.text || '').join('\n').trim() || (typeof response === 'string' ? response : JSON.stringify(response));
  try { return JSON.parse(text); } catch (e) {}
  const match = text.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch (e) {} }
  return { _raw: text };
}

function buildDeterministicInsights(state) {
  const q = getQuarterlyAnchorMetrics(state);
  const period = q.period_label || 'Quarterly anchor';
  const qForm = state.data_freshness?.quarterly_anchor_form || '10-Q';
  const qPeriod = q.reporting_period || state.data_freshness?.quarterly_anchor_report_date || naReason('quarterly report period not recorded');
  const issuer = state.entity?.issuer_profile?.description || 'public company';
  const ref8k = state.data_freshness?.recent_8k_form;
  const ref8kDate = state.data_freshness?.recent_8k_filing_date;
  const peerReady = Boolean(state.peer_benchmarks?.markdown);
  const threeYear = state.financial_snapshot?.three_year_revenue;
  const annualTrend = threeYear?.narrative_summary || naReason('3-year 10-K revenue trend not available');
  return [
    '## Section 4: Three Strategic Insights',
    '',
    `Metric basis: quarterly anchor ${period} for operating metrics. Annual revenue growth is cited separately from the 3-Year Revenue From 10-Ks section (FY2025/FY2024/FY2023) and is not mixed with quarterly revenue.`,
    '',
    '### Insight 1 — Cash-flow quality and reinvestment',
    `- Revenue (quarterly anchor): ${formatQuarterlyMetric(q.revenue)} — ${metricCitationShort(q.revenue, qForm)}`,
    `- Operating margin (quarterly): ${formatQuarterlyMetric(q.operating_margin, 'pct')} — ${metricCitationShort(q.operating_margin, qForm)} (computed: operating income ÷ revenue)`,
    `- FCF (quarterly): ${formatQuarterlyMetric(q.free_cash_flow)} — ${metricCitationShort(q.free_cash_flow, qForm)} (computed: operating cash flow − capex)`,
    `- EPS (quarterly): ${formatQuarterlyMetric(q.eps, 'eps')} — ${metricCitationShort(q.eps, qForm)}`,
    `- **Annual growth view (10-K only):** ${annualTrend}`,
    `- Analyst view (interpretation): Sustainable value creation depends on whether growth is backed by reinvestment and cash conversion, not headline revenue alone.`,
    `- So-what: ${state.inputs?.exec_type || 'Executive'} should prioritize the metric with the weakest source-backed trend before approving new spend.`,
    '',
    '### Insight 2 — Risk, leverage, and cost of capital',
    `- Issuer profile: ${issuer} [filing classification]`,
    peerReady
      ? `- Peer context: Section 3 categorical peer table — latest annual revenue and margins (FY${state.peer_benchmarks?.benchmark_fy || 2025}); approximations labeled where SEC tags were incomplete.`
      : '- Peer context: Section 3 peer table not assembled for this run (see Section 8 gaps).',
    `- Analyst view (interpretation): Risk shows up in leverage, coverage, and earnings volatility versus peers.`,
    `- So-what: If leverage or margin trails peers, the strategic plan must explain convergence or justify a premium/discount.`,
    '',
    '### Insight 3 — Narrative vs filings',
    `- Quarterly anchor: ${qForm} filed ${state.data_freshness?.quarterly_anchor_filing_date || naReason('filing date not recorded')} (report period ${qPeriod}) [SEC filing]`,
    ref8k ? `- Recent 8-K (reference only, not financial anchor): ${ref8k} filed ${ref8kDate || naReason('8-K filing date not recorded')}` : '- No recent 8-K on file.',
    `- Analyst view (interpretation): Markets price expected future cash flows; interim filings test whether the narrative is credible.`,
    `- So-what: Tie every strategic claim to a filing-backed metric or mark it as interpretation with a stated reason.`,
  ].join('\n');
}

function buildExecutivePresentationPrompt(state) {
  const inputs = state.inputs || {};
  const company = companyDisplayName(state.entity, inputs);
  const legalName = state.entity?.legal_name || inputs.company_name || company;
  const ticker = state.entity?.ticker || inputs.ticker || '';
  const execType = inputs.exec_type || 'executive';
  const industry = inputs.industry || 'the industry';
  const provider = inputs.service_provider || 'our team';
  const expert = inputs.expert_resolved?.name || inputs.expert_pref || 'industry specialist';
  const slideCount = [3, 4, 5].includes(Number(inputs.slide_count)) ? Number(inputs.slide_count) : 4;
  const q = getQuarterlyAnchorMetrics(state);
  const period = q.period_label || 'latest quarter';
  const fyAnchor = state.research?.filing_anchors?.annual_10k;
  const fyLabel = fyAnchor?.fy ? `FY${fyAnchor.fy}` : annualSectionLabel(fyAnchor);
  const market = state.research?.market_data || {};
  const peerPublished = Boolean(state.peer_benchmarks?.markdown);
  const threeYear = state.financial_snapshot?.three_year_revenue;
  const freshness = state.data_freshness || {};
  const qForm = freshness.quarterly_anchor_form || '10-Q';

  const financialFacts = [
    `Revenue (${period}): ${formatQuarterlyMetric(q.revenue)}`,
    `Operating margin (${period}): ${formatQuarterlyMetric(q.operating_margin, 'pct')}`,
    `Net margin (${period}): ${formatQuarterlyMetric(q.net_margin, 'pct')}`,
    `Free cash flow (${period}): ${formatQuarterlyMetric(q.free_cash_flow)}`,
    `EPS (${period}): ${formatQuarterlyMetric(q.eps, 'eps')}`,
    market.market_cap_usd != null
      ? `Market cap: ${fmtUsdValue(market.market_cap_usd)} (${market.market_cap_source || 'computed from live share price and SEC shares outstanding'})`
      : naReason('market cap requires live share price and SEC shares outstanding'),
    market.share_price_usd != null ? `Share price: ${fmtUsdValue(market.share_price_usd)} as of ${market.source_date || 'latest quote'}` : null,
    threeYear?.narrative_summary ? `3-year annual revenue trend (10-K only): ${threeYear.narrative_summary}` : null,
  ].filter(Boolean);

  const priorities = (state.executive_proposal?.priorities || []).map((p, i) => (
    `${i + 1}. ${p.title} — Financial hook: ${p.financial_hook || p.rationale || p.metric}`
  ));

  const valueHooks = (state.value_realization?.signals || []).slice(0, 5).map((s) => (
    `- ${s.insight} → ${s.value}`
  ));

  const slideStructures = {
    3: [
      'Slide 1: Company snapshot — identity, latest financial headline numbers, and why this matters now for the board.',
      'Slide 2: Performance and priorities — margins, cash flow, and the top 2–3 filing-backed priorities with dollar or margin impact.',
      'Slide 3: Recommended actions and business case — what to do next, expected financial impact, and ask of the executive audience.',
    ],
    4: [
      'Slide 1: Company and market context — legal name, ticker, industry, market cap, and latest quarterly anchor.',
      'Slide 2: Financial performance — revenue, margins, FCF, and EPS from the quarterly filing; call out one-time items if disclosed.',
      'Slide 3: Strategic insights and risks — three insights tied to specific metrics; include peer context only if data was available.',
      'Slide 4: Executive recommendations and value case — priorities linked to financial metrics, discovery questions, and next-step ask.',
    ],
    5: [
      'Slide 1: Title and executive summary — company, audience, and the single most important financial message.',
      'Slide 2: Financial snapshot — quarterly and annual headline metrics with sources.',
      'Slide 3: Ratio and trend readout — leverage, coverage, and margin trends that frame risk.',
      'Slide 4: Opportunities tied to financials — each initiative linked to a baseline metric and target improvement.',
      'Slide 5: Recommended actions, timeline, and ask — 30/60/90-day moves with measurable KPIs.',
    ],
  };

  const slides = slideStructures[slideCount] || slideStructures[4];

  return [
    `Create a ${slideCount}-slide executive presentation for a ${execType} audience.`,
    '',
    'AUDIENCE AND TONE',
    `- Company: ${legalName}${ticker ? ` (${ticker})` : ''}`,
    `- Industry: ${industry}`,
    `- Expert lens to weave in (lightly): ${expert}`,
    `- Presenter positioning: ${provider} advising ${execType} leadership`,
    '- Tone: board-ready, concise, confident. Use plain business language.',
    '- Do NOT reference academic valuation frameworks, professor names, or niche finance jargon.',
  '',
    'DESIGN DIRECTION',
    '- Theme: clean executive finance — dark navy or charcoal with one accent color, large numbers, minimal text per slide.',
    '- Every slide should lead with a number or a clear decision, not a paragraph.',
    '- Use charts only where a trend or comparison is filing-backed.',
    '',
    'SLIDE OUTLINE (follow this structure)',
    ...slides.map((s) => `- ${s}`),
    '',
    'FILING-BACKED FINANCIAL FACTS (use these figures — do not invent numbers)',
    ...financialFacts.map((f) => `- ${f}`),
    `- Data anchor: ${qForm} filed ${freshness.quarterly_anchor_filing_date || naReason('filing date not recorded')} (report period ${freshness.quarterly_anchor_report_date || period})`,
    peerPublished
      ? `- Peer comparison available for ${fyLabel} — categorical annual peer table in Section 3 (approximations labeled).`
      : '- Peer comparison section not available for this run.',
    '',
    'OPPORTUNITIES TIED TO FINANCIALS',
    ...(priorities.length ? priorities : ['- Link each strategic opportunity to a baseline metric from the quarterly filing.']),
    ...(valueHooks.length ? ['', 'VALUE REALIZATION HOOKS', ...valueHooks] : []),
    '',
    'CONTENT RULES',
    '- Tie every recommendation to a specific IT initiative and the financial metric it moves (revenue, margin, FCF, leverage, or market cap).',
    '- If a figure was not available, state why briefly instead of showing "N/A".',
    '- Flag one-time items (e.g., termination fees) separately from core operating performance.',
    '- End with a clear ask: approve diagnostic, set metric targets, or schedule executive review.',
    '',
    'OUTPUT FORMAT',
    '- Produce slide titles, 3–4 bullets per slide, and brief speaker notes.',
    '- Suitable for import into Gamma, Canva, PowerPoint Copilot, or similar tools.',
  ].join('\n');
}
