const state = items[0]?.json?.state || items[0]?.json || {};
const now = new Date().toISOString();
const industry = String(state.inputs?.industry || '').toLowerCase();
const company = state.entity?.legal_name || state.inputs?.company_name || 'Company';
const inputPeers = parsePeerList(state.inputs?.peer_list || state.inputs?.advanced_context?.peers || state.inputs?.advanced_context?.known_competitors);
const peerNames = (inputPeers.length ? inputPeers : peerDefaults(industry, company))
  .filter((name) => normName(name) !== normName(company))
  .slice(0, 3);
const metricLabels = ['Revenue', 'Gross Margin', 'Operating Margin', 'Net Margin', 'FCF Margin', 'Current Ratio', 'YoY Revenue Growth', '3-Year Revenue CAGR', 'Net Debt / EBITDA', 'Interest Coverage', 'ROCE/ROIC', 'Asset Turnover'];
const fyAnchor = state.research?.filing_anchors?.annual_10k;
const benchmarkFy = fyAnchor?.fy ? Number(fyAnchor.fy) : 2025;
const fyLabel = `FY${benchmarkFy}`;

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

function companyRowFromAnchors() {
  const annual = getAnnualAnchorMetrics(state);
  const label = annual.period_label || fyLabel;
  const facts = state.research?.financials?.merged_facts || state.research?.financials?.raw_us_gaap_facts || {};
  const fx = state.research?.financials?.fx_to_usd || {};
  const native = state.research?.financials?.native_currency || 'USD';
  const computed = computePeerMetricsFromFacts(facts, benchmarkFy, fx, native);
  const metrics = {};
  for (const key of metricLabels) {
    const val = computed[key];
    metrics[key] = val && !isUnavailableDisplay(val) ? `${val} (${label})` : naReason(`${key} not available for target company FY${benchmarkFy}`);
  }
  return {
    name: company,
    role: 'target company',
    metrics,
    source_status: 'SEC_ANNUAL_ANCHOR',
    reliability: peerRowHasCoreMetrics(metrics) ? 'HIGH' : 'MEDIUM',
  };
}

const peers = [];
for (let i = 0; i < peerNames.length; i++) {
  const name = peerNames[i];
  const role = i === 0 ? 'best-in-class or scale benchmark' : (i === 1 ? 'close competitor' : 'industry peer');
  let metrics = Object.fromEntries(metricLabels.map((m) => [m, naReason('peer SEC data not yet fetched')]));
  let source_status = 'NO_SEC_MATCH';
  let reliability = naReason('peer not matched in SEC directory');
  try {
    const { best, cik } = resolveCikFromDirectory(directory, name, '');
    if (cik) {
      const factsResp = await secGet.call(this, `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`);
      const usGaap = factsResp?.facts?.['us-gaap'] || {};
      const ifrs = factsResp?.facts?.['ifrs-full'] || {};
      const merged = mergeCompactFacts(compactFactsFromTaxonomy(usGaap, 'us-gaap'), compactFactsFromTaxonomy(ifrs, 'ifrs-full'));
      const peerNative = detectNativeCurrency(usGaap, ifrs);
      const peerFx = peerNative === 'USD' ? { rate: 1, from_currency: 'USD' } : await fetchFxToUsd.call(this, peerNative);
      const fy = [benchmarkFy, benchmarkFy - 1, benchmarkFy - 2].find((y) => annualFactValue(merged, 'revenue', y, peerFx, peerNative)) || benchmarkFy;
      const computed = computePeerMetricsFromFacts(merged, fy, peerFx, peerNative);
      for (const key of metricLabels) {
        metrics[key] = computed[key] && !isUnavailableDisplay(computed[key]) ? `${computed[key]} (FY${fy})` : naReason(`${key} not available for ${name} FY${fy}`);
      }
      source_status = peerRowHasCoreMetrics(metrics) ? 'SEC_PEER_FACTS_OK' : 'SEC_PEER_INCOMPLETE';
      reliability = peerRowHasCoreMetrics(metrics) ? 'HIGH' : 'LOW';
    }
  } catch (e) {
    source_status = `SEC_FETCH_ERROR: ${e.message || e}`;
    reliability = 'LOW';
  }
  peers.push({ name, role, ticker: null, metrics, source_status, reliability });
}

const companyRow = companyRowFromAnchors();
const peersWithCore = peers.filter((p) => peerRowHasCoreMetrics(p.metrics));
const tablePublished = peerRowHasCoreMetrics(companyRow.metrics) && peersWithCore.length >= 2;
let markdown;
if (tablePublished) {
  const columns = ['Entity', 'Role', ...metricLabels];
  const allRows = [companyRow, ...peersWithCore];
  markdown = [
    '## Section 3: Peer Comparison & Benchmarking',
    '',
    `Data fetched at runtime: ${now}`,
    `Benchmark period: ${fyLabel} annual SEC facts (consistent methodology across entities).`,
    '',
    '| ' + columns.join(' | ') + ' |',
    '|---|' + columns.slice(1).map(() => '---').join('|') + '|',
    ...allRows.map((row) => `| ${row.name} | ${row.role} | ${metricLabels.map((m) => row.metrics[m]).join(' | ')} |`),
    '',
    'Interpretation: peer metrics are computed consistently from SEC EDGAR line items for the same annual period. Margins and ratios are derived only when all required inputs exist on company facts.',
  ].join('\n');
} else {
  markdown = null;
}

state.peer_benchmarks = {
  generated_at: now,
  selection_rule: inputPeers.length ? 'user_provided_peers' : 'industry_default_selection',
  benchmark_fy: benchmarkFy,
  table_published: tablePublished,
  peers,
  company_row: companyRow,
  markdown,
  withhold_reason: tablePublished ? null : `Peer comparison omitted — only ${peersWithCore.length} of ${peers.length} peers had complete core FY${benchmarkFy} metrics from SEC filings.`,
};
state.sections = state.sections || {};
if (tablePublished && markdown) {
  state.sections.s3_benchmarks = markdown;
} else {
  delete state.sections.s3_benchmarks;
}
state.audit_log = state.audit_log || [];
state.audit_log.push({
  timestamp: now,
  workflow_name: 'WF_PEER_BENCHMARKS',
  status: tablePublished ? 'OK' : 'WARN',
  message: tablePublished
    ? `Peer table published with ${peersWithCore.length} complete peers on FY${benchmarkFy}.`
    : `Peer table withheld (${peersWithCore.length}/${peers.length} peers with complete core metrics).`,
});
return [{ json: state }];
