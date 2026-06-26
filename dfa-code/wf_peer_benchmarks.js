const state = items[0]?.json?.state || items[0]?.json || {};
const now = new Date().toISOString();
const industry = String(state.inputs?.industry || '').toLowerCase();
const company = state.entity?.legal_name || state.inputs?.company_name || 'Company';
const inputPeers = parsePeerList(state.inputs?.peer_list || state.inputs?.advanced_context?.peers || state.inputs?.advanced_context?.known_competitors);
const peerNames = (inputPeers.length ? inputPeers : peerDefaults(industry))
  .filter((name) => normName(name) !== normName(company))
  .slice(0, 3);
const metricLabels = ['Revenue', 'Gross Margin', 'Operating Margin', 'Net Margin', 'FCF Margin', 'Current Ratio', 'YoY Revenue Growth', '3-Year Revenue CAGR', 'Net Debt / EBITDA', 'Interest Coverage', 'ROCE/ROIC', 'Asset Turnover'];

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
  const pb = state.peer_benchmarks?.company_metrics;
  if (pb) return pb;
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
      Revenue: revenue ? fmtMetric(revenue.value) : 'N/A',
      'Gross Margin': latest('gross_margin') ? fmtMetric(latest('gross_margin').value, true) : 'N/A',
      'Operating Margin': latest('operating_margin') ? fmtMetric(latest('operating_margin').value, true) : 'N/A',
      'Net Margin': latest('net_margin') ? fmtMetric(latest('net_margin').value, true) : 'N/A',
      'FCF Margin': fcf && revenue ? fmtMetric(fcf.value / revenue.value, true) : 'N/A',
      'Current Ratio': latest('current_ratio') ? Number(latest('current_ratio').value).toFixed(2) : 'N/A',
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
      const compact = compactFacts(usGaap);
      const computed = computeEntityMetrics(compact, { source_name: 'SEC EDGAR Company Facts XBRL', cik, legal_name: best?.title || name, fetched_at: now });
      metrics = {
        Revenue: fmtMetric(computed.revenue),
        'Gross Margin': fmtMetric(computed.gross_margin, true),
        'Operating Margin': fmtMetric(computed.operating_margin, true),
        'Net Margin': fmtMetric(computed.net_margin, true),
        'FCF Margin': fmtMetric(computed.fcf_margin, true),
        'Current Ratio': fmtMetric(computed.current_ratio),
        'YoY Revenue Growth': fmtMetric(computed.yoy_revenue_growth, true),
        '3-Year Revenue CAGR': fmtMetric(computed.revenue_cagr_3y, true),
        'Net Debt / EBITDA': computed.net_debt_ebitda !== null ? Number(computed.net_debt_ebitda).toFixed(2) : 'N/A',
        'Interest Coverage': fmtMetric(computed.interest_coverage),
        'ROCE/ROIC': fmtMetric(computed.roce, true),
        'Asset Turnover': fmtMetric(computed.asset_turnover),
      };
      source_status = 'SEC_PEER_FACTS_OK';
      reliability = 'HIGH';
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
  'Interpretation: peer metrics are computed from live SEC EDGAR company facts at execution time. Cells remain N/A when the peer cannot be resolved to a US public CIK or required XBRL tags are missing.',
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
  message: `Peer benchmark section built with ${peers.filter((p) => p.source_status === 'SEC_PEER_FACTS_OK').length}/${peers.length} SEC-backed peers.`,
});
return [{ json: state }];
