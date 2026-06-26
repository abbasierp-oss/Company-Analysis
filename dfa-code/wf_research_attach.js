const state = $('Build Public Research Bundle').first().json;
const serper = $('Serper Public News Search').first().json || {};
const marketRaw = $('Fetch Live Market Price').first().json || {};
const now = new Date().toISOString();
const organic = serper.organic || [];
state.research.news_events = organic.slice(0, 10).map((item) => ({
  date: item.date || null,
  type: 'web_search_signal',
  title: item.title || '',
  description: item.snippet || '',
  source_url: item.link || '',
  source_name: 'Serper Google Search',
  source_date: now,
  confidence: item.link ? 'MEDIUM' : 'LOW',
  financial_impact_signal: 'Requires analyst interpretation; not assumed.',
}));

const ticker = state.entity?.ticker || state.inputs?.ticker;
let marketCap = null;
let sharePrice = null;
let sharesOutstanding = null;
try {
  const result = marketRaw?.chart?.result?.[0];
  const meta = result?.meta || {};
  sharePrice = meta.regularMarketPrice || meta.previousClose || null;
  const asOf = meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : now;
  const facts = state.research?.financials?.raw_us_gaap_facts || {};
  const shareTags = ['WeightedAverageNumberOfDilutedSharesOutstanding', 'WeightedAverageNumberOfSharesOutstandingDiluted', 'CommonStockSharesOutstanding'];
  const shareFound = tagRows(facts, shareTags);
  const shareRow = shareFound.rows.filter((r) => r.form === '10-K' || r.form === '10-Q').sort((a, b) => String(a.filed || '').localeCompare(String(b.filed || ''))).at(-1);
  sharesOutstanding = shareRow ? Number(shareRow.val) : null;
  if (sharePrice && sharesOutstanding) {
    marketCap = sharePrice * sharesOutstanding;
  }
  state.research.market_data = {
    source_name: sharesOutstanding ? 'Yahoo Finance price x SEC diluted shares' : 'Yahoo Finance (price only)',
    source_url: ticker ? `https://finance.yahoo.com/quote/${ticker}` : null,
    source_date: asOf,
    ticker,
    share_price_usd: sharePrice,
    shares_outstanding: sharesOutstanding,
    shares_source: shareRow ? `SEC EDGAR:${shareFound.tag}` : null,
    market_cap_usd: marketCap,
    confidence: marketCap ? 'MEDIUM' : (sharePrice ? 'LOW' : 'N/A'),
    fetched_at: now,
  };
  state.entity.market_cap_usd = marketCap;
  state.entity.market_cap_as_of = asOf;
} catch (e) {
  state.research.market_data = { confidence: 'N/A', error: String(e.message || e), fetched_at: now };
}

const filings = state.research?.filings?.recent_filings || [];
const latestFiling = filings[0] || null;
state.data_freshness = {
  fetched_at: now,
  latest_filing_form: latestFiling?.form || null,
  latest_filing_date: latestFiling?.filing_date || null,
  latest_report_date: latestFiling?.report_date || null,
  sec_company_facts_url: state.research?.financials?.source_url || null,
  market_price_as_of: state.research?.market_data?.source_date || null,
  rule: 'All financial figures are pulled live from SEC EDGAR and public market sources at workflow execution time.',
};

state.research.source_status = state.research.source_status || {};
state.research.source_status.serper = organic.length ? 'OK' : 'EMPTY_OR_FAILED';
state.research.source_status.market_data = state.research.market_data?.market_cap_usd ? 'OK' : (state.research.market_data?.share_price_usd ? 'PARTIAL' : 'N/A');
state.audit_log = state.audit_log || [];
state.audit_log.push({ timestamp: now, workflow_name: 'WF_RESEARCH_PUBLIC', status: 'OK', message: `Public research finalized. Market cap: ${marketCap ? fmtMetric(marketCap) : 'N/A'}.` });
return [{ json: state }];
