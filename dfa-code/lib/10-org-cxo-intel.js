// Organization structure and CXO intel — built from cached research signals only

const EXEC_TYPE_PROFILES = {
  CEO: { role_keys: ['ceo', 'chief executive officer', 'co-ceo'], function: 'Enterprise strategy, operations, and external leadership', default_reports_to: 'Board of Directors' },
  CFO: { role_keys: ['cfo', 'chief financial officer'], function: 'Finance, capital allocation, treasury, and investor relations', default_reports_to: 'CEO' },
  CIO: { role_keys: ['cio', 'chief information officer'], function: 'Enterprise technology, information systems, and digital platforms', default_reports_to: 'CEO' },
  COO: { role_keys: ['coo', 'chief operating officer'], function: 'Operations, delivery, and business execution', default_reports_to: 'CEO' },
  CDO: { role_keys: ['cdo', 'chief data officer', 'chief digital officer'], function: 'Data, analytics, and digital products', default_reports_to: 'CEO' },
  CISO: { role_keys: ['ciso', 'chief information security officer'], function: 'Cybersecurity, risk, and information protection', default_reports_to: 'CEO' },
  Board: { role_keys: ['board', 'director', 'chair'], function: 'Governance and fiduciary oversight', default_reports_to: 'Shareholders' },
  Investor: { role_keys: ['investor'], function: 'Capital allocation and shareholder perspective', default_reports_to: 'N/A' },
};

const COMPANY_ORG_REGISTRY = {
  netflix: {
    source: 'Netflix public leadership / DEF 14A officer listing (curated high-confidence)',
    confidence: 'HIGH',
    nodes: [
      { role: 'Co-CEO', name: 'Ted Sarandos', reports_to: 'Board of Directors', confidence: 'HIGH' },
      { role: 'Co-CEO', name: 'Greg Peters', reports_to: 'Board of Directors', confidence: 'HIGH' },
      { role: 'CFO', name: 'Spence Neumann', reports_to: 'Co-CEOs', confidence: 'HIGH' },
      { role: 'Chief Legal Officer', name: 'Unknown', reports_to: 'Co-CEOs', confidence: 'LOW' },
      { role: 'Chief Communications Officer', name: 'Unknown', reports_to: 'Co-CEOs', confidence: 'LOW' },
    ],
  },
  disney: {
    source: 'The Walt Disney Company public leadership (curated high-confidence)',
    confidence: 'HIGH',
    nodes: [
      { role: 'CEO', name: 'Bob Iger', reports_to: 'Board of Directors', confidence: 'HIGH' },
      { role: 'CFO', name: 'Unknown', reports_to: 'CEO', confidence: 'LOW' },
      { role: 'CTO', name: 'Unknown', reports_to: 'CEO', confidence: 'LOW' },
    ],
  },
};

function researchSignals(state) {
  return [
    ...(state.research?.news_events || []),
    ...(state.research?.private_research?.serper_results || []),
  ];
}

function researchCorpusText(state) {
  const notes = String(state.inputs?.source_notes || state.inputs?.advanced_context?.source_notes || '');
  const leadership = state.event_research?.leadership_bullet || '';
  return [
    notes,
    leadership,
    ...researchSignals(state).map((s) => `${s.title || ''} ${s.description || s.snippet || ''}`),
  ].join('\n');
}

function registryOrgForCompany(state) {
  const keys = [
    normName(state.entity?.ticker),
    normName(companyDisplayName(state.entity, state.inputs)),
    normName(state.entity?.legal_name),
    normName(state.inputs?.company_name),
  ].filter(Boolean);
  for (const [key, entry] of Object.entries(COMPANY_ORG_REGISTRY)) {
    if (keys.some((k) => k.includes(key) || key.includes(k))) return entry;
  }
  return null;
}

function normalizeRoleLabel(roleText) {
  const r = String(roleText || '').trim();
  if (!r) return 'Unknown';
  if (/chief financial/i.test(r)) return 'CFO';
  if (/chief executive|co-ceo/i.test(r)) return /co-ceo/i.test(r) ? 'Co-CEO' : 'CEO';
  if (/chief operating/i.test(r)) return 'COO';
  if (/chief information officer|cio/i.test(r)) return 'CIO';
  if (/chief technology/i.test(r)) return 'CTO';
  if (/chief data/i.test(r)) return 'CDO';
  if (/chief information security|ciso/i.test(r)) return 'CISO';
  return r.replace(/\s+/g, ' ').slice(0, 48);
}

function extractOfficersFromCorpus(corpus) {
  const found = [];
  const seen = new Set();
  const patterns = [
    /([A-Z][a-z]+(?:\s+(?:[A-Z]\.|[A-Z][a-z]+)){1,2})\s*,?\s+(?:has been (?:named|appointed)\s+)?(?:as\s+)?(?:the\s+)?(Co-Chief Executive Officer|Chief [A-Za-z\s]+ Officer)/gi,
    /(Chief [A-Za-z\s]+ Officer)\s+([A-Z][a-z]+(?:\s+(?:[A-Z]\.|[A-Z][a-z]+)){1,2})/gi,
    /([A-Z][a-z]+(?:\s+(?:[A-Z]\.|[A-Z][a-z]+)){1,2})\s+(?:was|is)\s+appointed\s+(?:as\s+)?(?:the\s+)?(Chief [A-Za-z\s]+ Officer|CFO|CEO|COO|CIO)/gi,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(corpus)) !== null) {
      let name;
      let roleRaw;
      if (/^Chief/i.test(match[1])) {
        roleRaw = match[1];
        name = match[2];
      } else {
        name = match[1];
        roleRaw = match[2];
      }
      const role = normalizeRoleLabel(roleRaw);
      const key = `${normName(name)}|${normName(role)}`;
      if (!name || seen.has(key)) continue;
      seen.add(key);
      found.push({
        role,
        name: name.trim(),
        reports_to: 'Unknown',
        confidence: 'MEDIUM',
        source: 'Public search / news signal',
      });
    }
  }
  return found;
}

function mergeOrgNodes(registryNodes, extractedNodes) {
  const merged = [];
  const byRole = new Map();
  for (const node of registryNodes || []) {
    const roleKey = normName(node.role);
    if (!byRole.has(roleKey) || node.confidence === 'HIGH') byRole.set(roleKey, { ...node });
    merged.push(node);
  }
  for (const node of extractedNodes || []) {
    const roleKey = normName(node.role);
    if (byRole.has(roleKey) && byRole.get(roleKey).confidence === 'HIGH') continue;
    if (!merged.some((n) => normName(n.role) === roleKey && normName(n.name) === normName(node.name))) {
      merged.push(node);
      byRole.set(roleKey, node);
    }
  }
  return merged.filter((n) => n.name && n.name !== 'Unknown' ? true : n.confidence === 'HIGH');
}

function buildOrgStructure(state) {
  const company = companyDisplayName(state.entity, state.inputs);
  const registry = registryOrgForCompany(state);
  const corpus = researchCorpusText(state);
  const extracted = extractOfficersFromCorpus(corpus);
  const nodes = mergeOrgNodes(registry?.nodes || [], extracted);
  const verified = nodes.filter((n) => n.name && n.name !== 'Unknown');
  const topRoles = ['CEO', 'Co-CEO', 'CFO', 'COO', 'CIO', 'CTO', 'CDO', 'CISO'];
  const hierarchy = [];
  const ceos = verified.filter((n) => /ceo/i.test(n.role));
  if (ceos.length) {
    hierarchy.push({
      level: 0,
      label: ceos.length > 1 ? `Co-CEOs: ${ceos.map((c) => c.name).join('; ')}` : `${ceos[0].role}: ${ceos[0].name}`,
      reports_to: ceos[0].reports_to || 'Board of Directors',
      confidence: ceos[0].confidence || 'MEDIUM',
    });
    const parent = ceos.length > 1 ? 'Co-CEOs' : 'CEO';
    for (const role of topRoles.filter((r) => r !== 'CEO' && r !== 'Co-CEO')) {
      const hit = verified.find((n) => normName(n.role).includes(normName(role)) || n.role === role);
      hierarchy.push({
        level: 1,
        label: hit ? `${hit.role}: ${hit.name}` : `${role}: Unknown`,
        reports_to: hit?.reports_to && hit.reports_to !== 'Unknown' ? hit.reports_to : parent,
        confidence: hit ? hit.confidence : 'LOW',
      });
    }
  } else {
    hierarchy.push({ level: 0, label: 'CEO: Unknown', reports_to: 'Board of Directors', confidence: 'LOW' });
    for (const role of ['CFO', 'COO', 'CIO', 'CTO']) {
      const hit = verified.find((n) => normName(n.role).includes(normName(role)));
      hierarchy.push({
        level: 1,
        label: hit ? `${hit.role}: ${hit.name}` : `${role}: Unknown`,
        reports_to: hit?.reports_to || 'CEO (unverified)',
        confidence: hit ? hit.confidence : 'LOW',
      });
    }
  }
  const sourceNote = registry?.source
    || (verified.length ? 'Public search signals + user source notes' : 'No high-confidence officer roster verified — roles marked Unknown');
  return {
    company,
    nodes: verified,
    hierarchy,
    source_note: sourceNote,
    confidence: registry?.confidence || (verified.length ? 'MEDIUM' : 'LOW'),
    has_verified_data: verified.length > 0,
  };
}

function matchExecProfile(execType) {
  const key = String(execType || 'CEO').trim();
  return EXEC_TYPE_PROFILES[key] || EXEC_TYPE_PROFILES.CEO;
}

function findCxoInOrg(org, execType) {
  const profile = matchExecProfile(execType);
  const roleNeedle = normName(execType);
  const hit = (org.nodes || []).find((n) => {
    const roleNorm = normName(n.role);
    return roleNorm.includes(roleNeedle) || profile.role_keys.some((k) => roleNorm.includes(normName(k)));
  });
  return hit || null;
}

function cxoIntelBullets(state, execType, personName) {
  const bullets = [];
  const corpus = researchSignals(state);
  const nameParts = String(personName || '').split(/\s+/).filter((p) => p.length > 2);
  for (const item of corpus) {
    const text = `${item.title || ''} ${item.description || item.snippet || ''}`.trim();
    if (!text || text.length < 24) continue;
    const lower = text.toLowerCase();
    const execLower = String(execType || '').toLowerCase();
    const nameHit = personName && personName !== 'Unknown' && nameParts.some((p) => lower.includes(p.toLowerCase()));
    const roleHit = lower.includes(execLower) || lower.includes(`chief ${execLower.charAt(0)}${execLower.slice(1).toLowerCase()}`);
    if (!nameHit && !roleHit) continue;
    const sentence = text.split(/[.!?]/).find((s) => s.length > 30 && s.length < 220) || text.slice(0, 200);
    bullets.push({ text: sentence.trim(), source: item.source_name || item.source_url || 'public search', confidence: item.confidence || 'MEDIUM' });
    if (bullets.length >= 3) break;
  }
  if (state.event_research?.leadership_bullet) {
    bullets.unshift({ text: state.event_research.leadership_bullet, source: 'leadership signal', confidence: 'MEDIUM' });
  }
  return bullets.slice(0, 3);
}

function buildCxoIntel(state, org) {
  const execType = state.inputs?.exec_type || 'CEO';
  const profile = matchExecProfile(execType);
  const orgHit = findCxoInOrg(org, execType);
  const name = orgHit?.name || 'Unknown';
  const title = orgHit?.role && orgHit.role !== 'Unknown' ? orgHit.role : execType;
  const reportingLine = orgHit?.reports_to && orgHit.reports_to !== 'Unknown'
    ? orgHit.reports_to
    : (execType === 'CEO' || execType === 'Board' ? 'Board of Directors' : profile.default_reports_to);
  const directReports = 'Unknown';
  const intelBullets = cxoIntelBullets(state, execType, name);
  const intelSummary = intelBullets.length
    ? intelBullets.map((b) => b.text).join(' ')
    : `No verified public intel signals found for the selected ${execType}; use company IR leadership page for latest biography.`;
  return {
    exec_type: execType,
    name,
    title,
    functional_area: profile.function,
    reporting_line: reportingLine,
    direct_reports: directReports,
    team_structure: directReports,
    intel_summary: intelSummary,
    intel_bullets: intelBullets,
    confidence: orgHit?.confidence || (intelBullets.length ? 'MEDIUM' : 'LOW'),
    source_note: org.source_note,
  };
}

function formatOrgStructureMarkdown(org) {
  const lines = [
    '### Organization structure (presentation slide)',
    '',
    `**${org.company}** — high-confidence roles only; unverified positions marked Unknown.`,
    '',
    '| Role / leader | Reports to | Confidence |',
    '|---|---|---|',
    ...org.hierarchy.map((row) => `| ${row.label} | ${row.reports_to} | ${row.confidence} |`),
    '',
    `Source: ${org.source_note}`,
  ];
  return lines.join('\n');
}

function formatCxoIntelMarkdown(cxo) {
  return [
    '### CXO intel (presentation slide)',
    '',
    `**Target executive:** ${cxo.exec_type}`,
    '',
    '| Field | Value |',
    '|---|---|',
    `| Name | ${cxo.name} |`,
    `| Title | ${cxo.title} |`,
    `| Functional area | ${cxo.functional_area} |`,
    `| Reporting line | ${cxo.reporting_line} |`,
    `| Direct reports / team | ${cxo.direct_reports} |`,
    `| Intel summary | ${cxo.intel_summary} |`,
    '',
    `Source: ${cxo.source_note} (confidence: ${cxo.confidence})`,
  ].join('\n');
}

function buildOrgCxoIntel(state) {
  if (state.org_cxo_intel?.org_structure && state.org_cxo_intel?.cxo_intel) {
    return state.org_cxo_intel;
  }
  const org = buildOrgStructure(state);
  const cxo = buildCxoIntel(state, org);
  return {
    generated_at: new Date().toISOString(),
    org_structure: org,
    cxo_intel: cxo,
    org_slide_markdown: formatOrgStructureMarkdown(org),
    cxo_slide_markdown: formatCxoIntelMarkdown(cxo),
  };
}
