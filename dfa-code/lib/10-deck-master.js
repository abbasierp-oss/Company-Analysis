// Centralized 10-slide deck master, footer logos, and Gamma-ready artifacts

const DECK_SLIDE_COUNT = 10;

const TEN_SLIDE_OUTLINE = [
  'Slide 1: Title and executive summary — company, audience, and the single most important financial message.',
  'Slide 2: Quarterly financial snapshot — revenue, margins, FCF, EPS from the quarterly filing anchor only.',
  'Slide 3: 3-Year Revenue from 10-Ks — FY2025/FY2024/FY2023 annual revenue trend (not quarterly).',
  'Slide 4: Annual financials and ratio dashboard — FY margins, leverage, and coverage metrics.',
  'Slide 5: Market data — share price, market cap, and shares outstanding with as-of date.',
  'Slide 6: Peer comparison — categorical annual peer table with labeled sources.',
  'Slide 7: Three strategic insights — filing-backed takeaways with so-what for the executive audience.',
  'Slide 8: Executive proposal — top priorities tied to IT initiatives and financial hooks.',
  'Slide 9: Initiative impact and value realization — metrics each initiative moves.',
  'Slide 10: Recommended actions, 30/60/90-day timeline, and clear ask.',
];

const COMPANY_LOGO_REGISTRY = {
  nflx: { domain: 'netflix.com', url: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg', source: 'Wikimedia Commons — Netflix official logo asset' },
  netflix: { domain: 'netflix.com', url: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg', source: 'Wikimedia Commons — Netflix official logo asset' },
  dis: { domain: 'disney.com', url: 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg', source: 'Wikimedia Commons — Disney brand asset (parent of Disney+)' },
  wbd: { domain: 'wbd.com', url: 'https://upload.wikimedia.org/wikipedia/commons/0/0c/Warner_Bros._Discovery_logo.svg', source: 'Wikimedia Commons — Warner Bros. Discovery official logo' },
  amzn: { domain: 'amazon.com', url: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg', source: 'Wikimedia Commons — Amazon official logo' },
  aapl: { domain: 'apple.com', url: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg', source: 'Wikimedia Commons — Apple official logo' },
  googl: { domain: 'google.com', url: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg', source: 'Wikimedia Commons — Alphabet/Google official logo' },
  msft: { domain: 'microsoft.com', url: 'https://upload.wikimedia.org/wikipedia/commons/9/96/Microsoft_logo_%282012%29.svg', source: 'Wikimedia Commons — Microsoft official logo' },
};

const PROVIDER_LOGO_REGISTRY = {
  evoloai: { domain: 'goevolo.com', url: 'https://www.goevolo.com/favicon.ico', source: 'Evolo AI official site favicon (goevolo.com)' },
  evolo: { domain: 'goevolo.com', url: 'https://www.goevolo.com/favicon.ico', source: 'Evolo AI official site favicon (goevolo.com)' },
};

function normalizeSlideCount(raw) {
  const n = Number(raw);
  if (n === DECK_SLIDE_COUNT) return DECK_SLIDE_COUNT;
  return DECK_SLIDE_COUNT;
}

function registryLogoMatch(registry, keys) {
  for (const key of keys) {
    const nk = normName(key);
    if (registry[nk]) return registry[nk];
    const hit = Object.entries(registry).find(([k]) => nk.includes(k) || k.includes(nk));
    if (hit) return hit[1];
  }
  return null;
}

function domainGuessFromName(name) {
  const cleaned = String(name || '').toLowerCase()
    .replace(/\b(inc|corp|corporation|ltd|llc|company|co)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
  if (!cleaned) return null;
  return `${cleaned}.com`;
}

function resolveLogoAsset(kind, state) {
  const inputs = state.inputs || {};
  const entity = state.entity || {};
  const isCompany = kind === 'company';
  const label = isCompany
    ? companyDisplayName(entity, inputs)
    : String(inputs.service_provider || 'Service Provider').trim();
  const ticker = String(entity.ticker || inputs.ticker || '').toLowerCase();
  const registry = isCompany ? COMPANY_LOGO_REGISTRY : PROVIDER_LOGO_REGISTRY;
  const keys = isCompany ? [ticker, label, entity.legal_name, inputs.company_name] : [label];
  const hit = registryLogoMatch(registry, keys);
  const domain = hit?.domain || domainGuessFromName(label);
  const clearbitUrl = domain ? `https://logo.clearbit.com/${domain}` : null;
  const url = hit?.url || clearbitUrl;
  const source = hit?.source || (clearbitUrl ? `Clearbit Logo API (${domain}) — verify against company IR press kit if unavailable` : null);
  const align = isCompany ? 'left' : 'right';
  const fallbackNote = url
    ? null
    : `Logo fallback: use official ${label} investor relations or brand press kit; automatic logo URL could not be resolved.`;
  return {
    kind,
    label,
    align,
    url: url || null,
    domain: domain || null,
    max_height_px: 28,
    max_width_px: 120,
    object_fit: 'contain',
    source_note: source || fallbackNote,
    fallback_note: fallbackNote,
    resolved: Boolean(url),
  };
}

function buildDeckSlideMaster(logos) {
  const company = logos.company;
  const provider = logos.provider;
  return {
    slide_count: DECK_SLIDE_COUNT,
    theme: 'executive_finance_dark_navy',
    footer: {
      layout: 'two_column',
      height_px: 40,
      padding_px: 12,
      border_top: '1px solid rgba(255,255,255,0.12)',
      columns: [
        {
          align: 'left',
          width: '50%',
          logo: company,
          instruction: 'Place company logo left-aligned. Scale proportionally; max height 28px; do not stretch.',
        },
        {
          align: 'right',
          width: '50%',
          logo: provider,
          instruction: 'Place service provider logo right-aligned. Scale proportionally; max height 28px; do not stretch.',
        },
      ],
      apply_to: 'every_slide',
      inherit: true,
    },
    logo_fallback_notes: [company.fallback_note, provider.fallback_note].filter(Boolean),
  };
}

function buildDeckFooterMarkdown(logos) {
  const company = logos.company;
  const provider = logos.provider;
  const lines = [
    '### Slide master footer (apply to EVERY slide — do not skip)',
    '',
    'Use a single shared slide master. Footer is a two-column row at the bottom of each slide:',
    `- **Left column:** ${company.label} logo — left-aligned. URL: ${company.url || 'MANUAL — see fallback note'}. ${company.source_note || company.fallback_note || ''}`,
    `- **Right column:** ${provider.label} logo — right-aligned. URL: ${provider.url || 'MANUAL — see fallback note'}. ${provider.source_note || provider.fallback_note || ''}`,
    '- Keep both logos small (max ~28px height), consistent across slides, proportionally scaled with object-fit contain — never stretch or distort.',
    '- Do not rebuild the footer per slide; inherit from the slide master so changes apply globally.',
  ];
  if (company.fallback_note) lines.push(`- Company logo fallback: ${company.fallback_note}`);
  if (provider.fallback_note) lines.push(`- Service provider logo fallback: ${provider.fallback_note}`);
  return lines.join('\n');
}

function buildSlidesJson(state, logos, slideMaster) {
  const titles = TEN_SLIDE_OUTLINE.map((line) => line.replace(/^Slide \d+:\s*/, '').split(' — ')[0]);
  return titles.map((title, index) => ({
    index: index + 1,
    title,
    footer: 'inherit_master',
    footer_layout: slideMaster.footer,
    logos: {
      left: logos.company,
      right: logos.provider,
    },
    speaker_notes: TEN_SLIDE_OUTLINE[index],
  }));
}

function buildGammaDeckMarkdown(state, logos, slideMaster) {
  const company = companyDisplayName(state.entity, state.inputs);
  const provider = state.inputs?.service_provider || 'Service Provider';
  const header = [
    `# ${company} — Executive Financial Briefing (${DECK_SLIDE_COUNT} slides)`,
    '',
    buildDeckFooterMarkdown(logos),
    '',
    '## Slide outline',
  ];
  const body = TEN_SLIDE_OUTLINE.map((line, i) => `${i + 1}. ${line}`);
  const footerRepeat = [
    '',
    '## Footer reminder',
    `Every slide inherits the master footer: **${company}** logo left, **${provider}** logo right.`,
    JSON.stringify(slideMaster.footer, null, 2),
  ];
  return header.concat(body).concat(footerRepeat).join('\n');
}

function buildPresentationPackage(state) {
  const logos = {
    company: resolveLogoAsset('company', state),
    provider: resolveLogoAsset('provider', state),
  };
  const slideMaster = buildDeckSlideMaster(logos);
  const slidesJson = buildSlidesJson(state, logos, slideMaster);
  const gammaMarkdown = buildGammaDeckMarkdown(state, logos, slideMaster);
  const promptText = buildExecutivePresentationPrompt(state, { logos, slideMaster, slidesJson, gammaMarkdown });
  return {
    slide_count: DECK_SLIDE_COUNT,
    slide_master: slideMaster,
    logos,
    slides_json: slidesJson,
    gamma_markdown: gammaMarkdown,
    prompt_text: promptText,
    logo_fallback_notes: slideMaster.logo_fallback_notes,
  };
}

function buildGammaDeck(state) {
  const pkg = buildPresentationPackage(state);
  return {
    generated_at: new Date().toISOString(),
    slide_count: pkg.slide_count,
    slide_master: pkg.slide_master,
    logos: pkg.logos,
    slides_json: pkg.slides_json,
    gamma_markdown: pkg.gamma_markdown,
    logo_fallback_notes: pkg.logo_fallback_notes,
  };
}
