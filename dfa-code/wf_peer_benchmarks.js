const state = items[0]?.json?.state || items[0]?.json || {};
const now = new Date().toISOString();
const industry = String(state.inputs?.industry || '').toLowerCase();
const company = state.entity?.legal_name || state.inputs?.company_name || 'Company';
const inputPeers = parsePeerList(state.inputs?.peer_list || state.inputs?.advanced_context?.peers || state.inputs?.advanced_context?.known_competitors);
const peerNames = (inputPeers.length ? inputPeers : peerDefaults(industry, company))
  .filter((name) => normName(name) !== normName(company))
  .slice(0, 3);
const metricLabels = ['Revenue', 'Gross Margin', 'Operating Margin', 'Net Margin', 'FCF Margin', 'Current Ratio', 'YoY Revenue Growth', '3-Year Revenue CAGR', 'Net Debt / EBITDA', 'Interest Coverage', 'ROCE/ROIC', 'Asset Turnover'];
const directPeerMetrics = {
  Revenue: 'revenue',
};

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

function companyRowFromState() {
  const m = state.normalized?.metrics || {};
  function latest(name) {
    const s = m[name] || [];
    return Array.isArray(s) && s.length ? s[s.length - 1] : null;
  }
  const revenue = latest('revenue');
  const fcf = latest('free_cash_flow');
  return {
    name: company,
    role: 'target company',
    metrics: {
      Revenue: revenue ? fmtUsdValue(revenue.value) : 'N/A',
      'Gross Margin': latest('gross_margin') ? fmtPct(latest('gross_margin').value) : 'N/A',
      'Operating Margin': latest('operating_margin') ? fmtPct(latest('operating_margin').value) : 'N/A',
      'Net Margin': latest('net_margin') ? fmtPct(latest('net_margin').value) : 'N/A',
      'FCF Margin': fcf && revenue ? fmtPct(fcf.value / revenue.value) : 'N/A',
      'Current Ratio': latest('current_ratio') ? fmtRatio(latest('current_ratio').value) : 'N/A',
      'YoY Revenue Growth': 'N/A',
      '3-Year Revenue CAGR': 'N/A',
      'Net Debt / EBITDA': 'N/A',
      'Interest Coverage': 'N/A',
      'ROCE/ROIC': 'N/A',
      'Asset Turnover': 'N/A',
    },
    source_status: 'SEC_NORMALIZED',
    reliability: state.entity?.is_public ? 'HIGH' : 'MEDIUM',
  };
}

const peers = [];
for (let i = 0; i < peerNames.length; i++) {
  const name = peerNames[i];
  const role = i === 0 ? 'best-in-class or scale benchmark' : (i === 1 ? 'close competitor' : 'industry peer');
  let metrics = Object.fromEntries(metricLabels.map((m) => [m, 'N/A']));
  let source_status = 'NO_SEC_MATCH';
  let reliability = 'N/A';
  try {
    const { best, cik } = resolveCikFromDirectory(directory, name, '');
    if (cik) {
      const factsResp = await secGet.call(this, `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`);
      const usGaap = factsResp?.facts?.['us-gaap'] || {};
      const ifrs = factsResp?.facts?.['ifrs-full'] || {};
      const merged = mergeCompactFacts(compactFactsFromTaxonomy(usGaap, 'us-gaap'), compactFactsFromTaxonomy(ifrs, 'ifrs-full'));
      const peerNative = detectNativeCurrency(usGaap, ifrs);
      const peerFx = peerNative === 'USD' ? { rate: 1, from_currency: 'USD' } : await fetchFxToUsd.call(this, peerNative);
      const fy = [2026, 2025, 2024, 2023].find((y) => peerMetricDirectOnly(merged, 'revenue', y, peerFx, peerNative)) || 2025;
      for (const [label, metricKey] of Object.entries(directPeerMetrics)) {
        const direct = peerMetricDirectOnly(merged, metricKey, fy, peerFx, peerNative);
        metrics[label] = direct ? fmtUsdValue(direct.value) : 'N/A';
      }
      source_status = metrics.Revenue !== 'N/A' ? 'SEC_PEER_FACTS_OK' : 'SEC_PEER_NO_DIRECT_METRICS';
      reliability = metrics.Revenue !== 'N/A' ? 'HIGH' : 'LOW';
    }
  } catch (e) {
    source_status = `SEC_FETCH_ERROR: ${e.message || e}`;
    reliability = 'LOW';
  }
  peers.push({ name, role, ticker: null, metrics, source_status, reliability });
}

const companyRow = companyRowFromState();
const columns = ['Entity', 'Role', ...metricLabels];
const allRows = [companyRow, ...peers];
const markdown = [
  '## Section 3: Peer Comparison & Benchmarking',
  '',
  `Data fetched at runtime: ${now}`,
  '',
  '| ' + columns.join(' | ') + ' |',
  '|---|' + columns.slice(1).map(() => '---').join('|') + '|',
  ...allRows.map((row) => `| ${row.name} | ${row.role} | ${metricLabels.map((m) => row.metrics[m]).join(' | ')} |`),
  '',
  'Interpretation: peer metrics show N/A unless directly available from a single SEC EDGAR company-facts tag. Derived ratios and approximations are not computed for peers. Target company metrics use the normalized pipeline (USD).',
].join('\n');

state.peer_benchmarks = {
  generated_at: now,
  selection_rule: inputPeers.length ? 'user_provided_peers' : 'industry_default_selection',
  peers,
  company_row: companyRow,
  markdown,
};
state.sections = state.sections || {};
state.sections.s3_benchmarks = markdown;
state.audit_log = state.audit_log || [];
state.audit_log.push({
  timestamp: now,
  workflow_name: 'WF_PEER_BENCHMARKS',
  status: peers.some((p) => p.source_status === 'SEC_PEER_FACTS_OK') ? 'OK' : 'WARN',
  message: `Peer benchmark section built with ${peers.filter((p) => p.source_status === 'SEC_PEER_FACTS_OK').length}/${peers.length} SEC-backed peers (direct tags only).`,
});
return [{ json: state }];
