const state = items[0]?.json?.state || items[0]?.json || {};
const now = new Date().toISOString();
const industry = String(state.inputs?.industry || '').toLowerCase();
const company = state.entity?.legal_name || state.inputs?.company_name || 'Company';
const inputPeers = parsePeerList(state.inputs?.peer_list || state.inputs?.advanced_context?.peers || state.inputs?.advanced_context?.known_competitors);
const peerNames = (inputPeers.length ? inputPeers : peerDefaults(industry, company))
  .filter((name) => normName(name) !== normName(company))
  .slice(0, 5);
const fyAnchor = state.research?.filing_anchors?.annual_10k;
const benchmarkFy = fyAnchor?.fy ? Number(fyAnchor.fy) : 2025;

async function secGet(url) {
  return this.helpers.httpRequest({
    method: 'GET',
    url,
    headers: { 'User-Agent': SEC_UA, Accept: 'application/json' },
    json: true,
    timeout: 30000,
  });
}

let directory = state.research?.sec_directory;
if (!directory) {
  directory = await secGet.call(this, 'https://www.sec.gov/files/company_tickers.json');
  state.research = state.research || {};
  state.research.sec_directory = directory;
}

const facts = state.research?.financials?.merged_facts || state.research?.financials?.raw_us_gaap_facts || {};
const fx = state.research?.financials?.fx_to_usd || {};
const native = state.research?.financials?.native_currency || 'USD';

const targetResolved = resolveCompetitorEntity(company, industry);
const categoricalRows = [
  buildCategoricalPeerRow(company, targetResolved, 'target company', targetResolved.category, buildPeerAnnualMetricBundle(facts, benchmarkFy, fx, native, company, company)),
];

const resolvedPeers = peerNames.map((name) => resolveCompetitorEntity(name, industry));
for (let i = 0; i < peerNames.length; i++) {
  const name = peerNames[i];
  const resolved = resolvedPeers[i];
  const secLookupName = resolved.sec_lookup_name || name;
  const role = PEER_CATEGORY_ROLES[Math.min(i + 1, PEER_CATEGORY_ROLES.length - 1)];
  let merged = null;
  let peerFx = fx;
  let peerNative = native;
  try {
    const { cik } = resolveCikFromDirectory(directory, secLookupName, resolved.ticker || '');
    if (cik) {
      const factsResp = await secGet.call(this, `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`);
      const usGaap = factsResp?.facts?.['us-gaap'] || {};
      const ifrs = factsResp?.facts?.['ifrs-full'] || {};
      merged = mergeCompactFacts(compactFactsFromTaxonomy(usGaap, 'us-gaap'), compactFactsFromTaxonomy(ifrs, 'ifrs-full'));
      peerNative = detectNativeCurrency(usGaap, ifrs);
      peerFx = peerNative === 'USD' ? { rate: 1, from_currency: 'USD' } : await fetchFxToUsd.call(this, peerNative);
    }
  } catch (e) {
    merged = null;
  }
  const bundle = buildPeerAnnualMetricBundle(merged || {}, benchmarkFy, peerFx, peerNative, name, secLookupName);
  categoricalRows.push(buildCategoricalPeerRow(name, resolved, role, resolved.category, bundle));
}

const productComparison = buildCompetitorComparisons(state, company, peerNames);
const markdown = formatCategoricalPeerMarkdown(
  categoricalRows,
  benchmarkFy,
  now,
  productComparison.has_data ? productComparison.markdown : '',
);

state.peer_benchmarks = {
  generated_at: now,
  selection_rule: inputPeers.length ? 'user_provided_peers' : 'industry_default_selection',
  benchmark_fy: benchmarkFy,
  table_published: true,
  categorical_rows: categoricalRows,
  product_comparison_published: productComparison.has_data,
  product_comparison: productComparison,
  peers: categoricalRows,
  company_row: categoricalRows[0],
  markdown,
  withhold_reason: null,
};
state.sections = state.sections || {};
state.sections.s3_benchmarks = markdown;
state.audit_log = state.audit_log || [];
state.audit_log.push({
  timestamp: now,
  workflow_name: 'WF_PEER_BENCHMARKS',
  status: 'OK',
  message: `Categorical peer comparison published for ${categoricalRows.length} entities on FY${benchmarkFy} annual basis${productComparison.has_data ? ' plus product-level comparison.' : '.'}`,
});
return [{ json: state }];
