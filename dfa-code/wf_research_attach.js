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
  const mergedFacts = state.research?.financials?.merged_facts || state.research?.financials?.raw_us_gaap_facts || {};
  const deiFacts = state.research?.financials?.raw_dei_facts || {};
  const shareInfo = latestSharesOutstanding(mergedFacts, deiFacts, {
    sharesOutstanding: meta.sharesOutstanding,
    asOf,
  });
  sharesOutstanding = shareInfo?.value || null;
  const reconciled = reconcileMarketData(sharePrice, sharesOutstanding, sharePrice && sharesOutstanding ? sharePrice * sharesOutstanding : null);
  sharePrice = reconciled.share_price_usd;
  sharesOutstanding = reconciled.shares_outstanding;
  marketCap = reconciled.market_cap_usd;
  const adrNote = state.entity?.is_foreign_issuer ? ' ADR/local listing price used.' : '';
  state.research.market_data = {
    source_name: sharesOutstanding
      ? `Yahoo Finance price x ${shareInfo.source}${adrNote}`
      : 'Yahoo Finance (price only)',
    source_url: ticker ? `https://finance.yahoo.com/quote/${ticker}` : null,
    source_date: asOf,
    ticker,
    share_price_usd: sharePrice,
    share_price_currency: 'USD',
    shares_outstanding: sharesOutstanding,
    implied_shares_outstanding: reconciled.implied_shares_outstanding,
    shares_source: shareInfo?.source || null,
    shares_filed: shareInfo?.filed || null,
    market_cap_usd: marketCap,
    math_consistent: reconciled.math_consistent,
    math_note: reconciled.math_note,
    confidence: marketCap ? (reconciled.math_consistent && shareInfo?.confidence === 'HIGH' ? 'MEDIUM' : 'LOW') : (sharePrice ? 'LOW' : 'N/A'),
    fetched_at: now,
    adr_note: state.entity?.is_foreign_issuer ? 'Foreign issuer: market cap uses listing price x best available share count (USD).' : null,
  };
  state.entity.market_cap_usd = marketCap;
  state.entity.market_cap_as_of = asOf;
} catch (e) {
  state.research.market_data = { confidence: 'N/A', error: String(e.message || e), fetched_at: now };
}

const anchors = state.research?.filing_anchors || resolveFilingAnchors(
  state.research?.filings?.recent_filings || [],
  state.entity?.issuer_profile,
);
state.research.filing_anchors = anchors;
state.research.one_time_items = detectOneTimeItems(state);

const fx = state.research?.financials?.fx_to_usd || {};
const qAnchor = anchors.quarterly_10q;
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
  fx_to_usd: fx.rate || null,
  fx_as_of: fx.as_of || null,
  fx_source: fx.source_name || null,
  issuer_profile: state.entity?.issuer_profile?.description || null,
  rule: 'Financial figures anchor on latest 10-Q/6-K (quarterly) and 10-K/20-F (annual). 8-K is a recent-filing reference only. All report output is USD.',
};

state.research.source_status = state.research.source_status || {};
state.research.source_status.serper = organic.length ? 'OK' : 'EMPTY_OR_FAILED';
state.research.source_status.market_data = state.research.market_data?.market_cap_usd ? 'OK' : (state.research.market_data?.share_price_usd ? 'PARTIAL' : 'N/A');
state.audit_log = state.audit_log || [];
state.audit_log.push({
  timestamp: now,
  workflow_name: 'WF_RESEARCH_PUBLIC',
  status: 'OK',
  message: `Public research finalized. Market cap: ${marketCap ? fmtUsdValue(marketCap) : 'N/A'}. Quarterly anchor: ${qAnchor?.report_date || 'N/A'}. Annual anchor: ${fyAnchor?.report_date || 'N/A'}.`,
});
return [{ json: state }];
