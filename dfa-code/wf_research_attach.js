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
const anchors = state.research?.filing_anchors || resolveFilingAnchors(
  state.research?.filings?.recent_filings || [],
  state.entity?.issuer_profile,
);
state.research.filing_anchors = anchors;
const qAnchor = anchors.quarterly_10q;

try {
  const result = marketRaw?.chart?.result?.[0];
  const meta = result?.meta || {};
  const mergedFacts = state.research?.financials?.merged_facts || state.research?.financials?.raw_us_gaap_facts || {};
  const deiFacts = state.research?.financials?.raw_dei_facts || {};
  state.research.market_data = buildLiveMarketData(meta, mergedFacts, deiFacts, qAnchor, ticker);
  state.entity.market_cap_usd = state.research.market_data.market_cap_usd;
  state.entity.market_cap_as_of = state.research.market_data.source_date;
} catch (e) {
  state.research.market_data = { confidence: 'N/A', error: String(e.message || e), fetched_at: now };
}

state.research.one_time_items = detectOneTimeItems(state);

const fx = state.research?.financials?.fx_to_usd || {};
const fyAnchor = anchors.annual_10k;
const ref8k = anchors.recent_8k;
state.data_freshness = {
  fetched_at: now,
  currency: 'USD',
  quarterly_anchor_form: qAnchor?.form || null,
  quarterly_anchor_filing_date: qAnchor?.filing_date || null,
  quarterly_anchor_report_date: qAnchor?.report_date || null,
  annual_anchor_form: fyAnchor?.form || null,
  annual_anchor_filing_date: fyAnchor?.filing_date || null,
  annual_anchor_report_date: fyAnchor?.report_date || null,
  recent_8k_form: ref8k?.form || null,
  recent_8k_filing_date: ref8k?.filing_date || null,
  operating_filing_form: qAnchor?.form || fyAnchor?.form || null,
  operating_filing_date: qAnchor?.filing_date || fyAnchor?.filing_date || null,
  latest_filing_form: qAnchor?.form || fyAnchor?.form || null,
  latest_filing_date: qAnchor?.filing_date || fyAnchor?.filing_date || null,
  latest_report_date: qAnchor?.report_date || fyAnchor?.report_date || null,
  sec_company_facts_url: state.research?.financials?.source_url || null,
  market_price_as_of: state.research?.market_data?.source_date || null,
  market_data_source: state.research?.market_data?.source_name || 'Yahoo Finance',
  fx_to_usd: fx.rate || null,
  fx_as_of: fx.as_of || null,
  fx_source: fx.source_name || null,
  issuer_profile: state.entity?.issuer_profile?.description || null,
  rule: 'Financial figures anchor on latest 10-Q/6-K (quarterly) and 10-K/20-F (annual). 8-K is a recent-filing reference only. Market data from Yahoo Finance single live source. All report output is USD.',
};

state.research.source_status = state.research.source_status || {};
state.research.source_status.serper = organic.length ? 'OK' : 'EMPTY_OR_FAILED';
state.research.source_status.market_data = state.research.market_data?.market_cap_usd ? 'OK' : (state.research.market_data?.share_price_usd ? 'PARTIAL' : 'N/A');
state.audit_log = state.audit_log || [];
state.audit_log.push({
  timestamp: now,
  workflow_name: 'WF_RESEARCH_PUBLIC',
  status: 'OK',
  message: `Public research finalized. Yahoo market cap: ${state.research.market_data?.market_cap_usd ? fmtUsdValue(state.research.market_data.market_cap_usd) : 'N/A'} @ ${state.research.market_data?.source_date || 'N/A'}. WA diluted shares: ${state.research.market_data?.weighted_avg_diluted_shares || 'N/A'}.`,
});
return [{ json: state }];
