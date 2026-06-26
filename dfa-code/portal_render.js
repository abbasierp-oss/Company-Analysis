// Portal HTML template for DFA production system (inlined into n8n Code node)
const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>DFA Production Analyst System</title>
  <style>
    :root { --bg:#0b1020; --panel:#121a33; --text:#f6f8ff; --muted:#aab4d4; --line:#2b365f; --accent:#7cc7ff; --good:#44d19d; --warn:#ffd166; --bad:#ff6b6b; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:Inter, ui-sans-serif, system-ui, sans-serif; background:radial-gradient(circle at top left, #1d2b5c, var(--bg) 42%); color:var(--text); }
    .wrap { max-width:1180px; margin:0 auto; padding:42px 20px 70px; }
    .hero { display:grid; grid-template-columns:1.05fr .95fr; gap:24px; align-items:start; }
    .card { background:rgba(18,26,51,.92); border:1px solid var(--line); border-radius:22px; box-shadow:0 24px 70px rgba(0,0,0,.35); }
    .intro, .box { padding:28px; }
    .eyebrow { color:var(--accent); font-weight:800; letter-spacing:.12em; text-transform:uppercase; font-size:12px; }
    h1 { font-size:40px; line-height:1.04; margin:12px 0 16px; }
    h2 { margin-top:0; }
    p { color:var(--muted); line-height:1.65; }
    .pillrow { display:flex; flex-wrap:wrap; gap:10px; margin-top:22px; }
    .pill { border:1px solid var(--line); background:rgba(124,199,255,.08); color:#dceeff; padding:8px 11px; border-radius:999px; font-size:12px; }
    form { padding:26px; display:grid; gap:14px; }
    label { display:block; color:#dbe5ff; font-size:13px; font-weight:800; margin-bottom:6px; }
    input, select, textarea { width:100%; background:#0f1730; border:1px solid var(--line); border-radius:13px; color:var(--text); padding:13px 14px; font:inherit; outline:none; }
    textarea { min-height:92px; resize:vertical; }
    .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .step { display:none; }
    .step.show { display:grid; gap:14px; }
    .step-title { padding:12px 14px; background:#0d1429; border:1px solid var(--line); border-radius:14px; color:#edf5ff; font-weight:800; }
    button { cursor:pointer; border:0; border-radius:13px; padding:14px 16px; font-weight:900; color:#06101f; background:linear-gradient(135deg, var(--accent), #9effd0); }
    button.secondary { background:#253153; color:var(--text); border:1px solid var(--line); }
    button:disabled { opacity:.6; cursor:not-allowed; }
    .status { margin-top:24px; padding:18px 20px; display:none; }
    .status.show { display:block; }
    .bar { height:9px; background:#0d1429; border-radius:999px; overflow:hidden; margin-top:14px; }
    .bar span { display:block; height:100%; width:0%; background:linear-gradient(90deg, var(--accent), var(--good)); border-radius:999px; transition:width .4s ease; }
    .results { display:none; margin-top:28px; gap:18px; }
    .results.show { display:grid; grid-template-columns:.85fr 1.15fr; }
    .metric { padding:13px 0; border-bottom:1px solid var(--line); }
    .metric:last-child { border-bottom:0; }
    .metric b { display:block; font-size:13px; color:var(--muted); margin-bottom:4px; }
    pre { white-space:pre-wrap; word-break:break-word; margin:0; background:#071024; border:1px solid var(--line); border-radius:16px; padding:18px; max-height:620px; overflow:auto; color:#edf5ff; line-height:1.5; }
    .actions { display:flex; gap:10px; flex-wrap:wrap; margin-top:14px; }
    .tabs { display:flex; gap:8px; margin-bottom:12px; }
    .tab { background:#253153; color:var(--text); border:1px solid var(--line); border-radius:10px; padding:8px 12px; font-size:13px; cursor:pointer; }
    .tab.active { background:var(--accent); color:#06101f; font-weight:800; }
    .panel { display:none; }
    .panel.show { display:block; }
    .small { color:var(--muted); font-size:12px; }
    .bad { color:var(--bad); }
    .good { color:var(--good); }
    @media (max-width:900px) { .hero, .results.show, .grid2 { grid-template-columns:1fr; } h1 { font-size:34px; } }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="hero">
      <div class="card intro">
        <div class="eyebrow">Damodaran-Style Financial Analyst System</div>
        <h1>Live SEC financials to full 9-section report and Gamma deck.</h1>
        <p>Financial figures are fetched live from SEC EDGAR and public market sources at run time. The system gates on your two required questions before starting analysis.</p>
        <div class="pillrow">
          <span class="pill">Live SEC EDGAR fetch</span>
          <span class="pill">Real-time market cap</span>
          <span class="pill">SEC peer benchmarks</span>
          <span class="pill">9-section report</span>
          <span class="pill">Gamma deck output</span>
        </div>
      </div>
      <div class="card">
        <form id="dfaForm">
          <div id="step1" class="step show">
            <div class="step-title">Question 1: What is the company name you want analyzed, and ticker symbol if public?</div>
            <div><label>Company name</label><input name="company_name" placeholder="Example: Microsoft Corporation" required /></div>
            <div><label>Ticker symbol if public</label><input name="ticker" placeholder="Example: MSFT" /></div>
            <button id="nextBtn" type="button">Continue to Question 2</button>
          </div>
          <div id="step2" class="step">
            <div class="step-title">Question 2: Which executive, industry, and expert perspective should be blended with Damodaran?</div>
            <div class="grid2">
              <div><label>C-level executive</label><select name="exec_type" required><option value="">Choose executive</option><option>CFO</option><option>CIO</option><option>CEO</option><option>COO</option><option>CDO</option><option>CISO</option><option>Board</option><option>Investor</option></select></div>
              <div><label>Industry</label><input name="industry" placeholder="Example: Technology" required /></div>
            </div>
            <div><label>Industry expert to blend</label><input name="expert_pref" placeholder="Expert name or type: pick for me" required /></div>
            <div class="grid2">
              <div><label>Service provider name</label><input name="service_provider" placeholder="Example: Evolo AI" /></div>
              <div><label>Slide count</label><select name="slide_count"><option>3</option><option selected>4</option><option>5</option></select></div>
            </div>
            <div><label>Peer list (optional)</label><input name="peer_list" placeholder="Comma-separated peers" /></div>
            <div><label>Source URLs or notes</label><textarea name="source_notes" placeholder="Investor relations URLs, annual reports, founder notes"></textarea></div>
            <div class="actions"><button class="secondary" id="backBtn" type="button">Back</button><button id="runBtn" type="submit">Run Production Analysis</button></div>
            <div class="small">Runs typically take 5–10 minutes. Financial data is always pulled fresh from SEC EDGAR at execution time.</div>
          </div>
        </form>
      </div>
    </section>
    <section id="status" class="card status">
      <b id="statusTitle">Running agents...</b>
      <p id="statusText">Initializing production pipeline.</p>
      <p class="small" id="progressLabel"></p>
      <div class="bar"><span id="progressBar"></span></div>
    </section>
    <section id="results" class="results">
      <div class="card box">
        <h2>Run Summary</h2>
        <div class="metric"><b>Run ID</b><span id="runId">-</span></div>
        <div class="metric"><b>Status</b><span id="runStatus">-</span></div>
        <div class="metric"><b>Company</b><span id="company">-</span></div>
        <div class="metric"><b>Market cap</b><span id="marketCap">-</span></div>
        <div class="metric"><b>Data fetched at</b><span id="fetchedAt">-</span></div>
        <div class="metric"><b>Latest SEC filing</b><span id="latestFiling">-</span></div>
        <div class="metric"><b>Expert</b><span id="expert">-</span></div>
        <div class="metric"><b>QA</b><span id="qa">-</span></div>
        <div class="actions">
          <button class="secondary" id="copyReport" type="button">Copy Full Report</button>
          <button class="secondary" id="copyMarkdown" type="button">Copy Gamma Markdown</button>
          <button class="secondary" id="copyJson" type="button">Copy Slide JSON</button>
        </div>
      </div>
      <div class="card box">
        <div class="tabs">
          <button class="tab active" data-tab="report" type="button">Full Report</button>
          <button class="tab" data-tab="deck" type="button">Gamma Deck</button>
        </div>
        <div id="panelReport" class="panel show"><pre id="report">Full report will appear here.</pre></div>
        <div id="panelDeck" class="panel"><pre id="deck">Gamma deck will appear here.</pre></div>
      </div>
    </section>
  </main>
  <script>
    const form = document.getElementById('dfaForm');
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const statusEl = document.getElementById('status');
    const resultsEl = document.getElementById('results');
    const runBtn = document.getElementById('runBtn');
    let latest = null;
    function apiBase() { return window.location.origin + '/webhook'; }
    function setText(id, value) { document.getElementById(id).textContent = value || '-'; }
    function copyText(value) { navigator.clipboard.writeText(value || '').catch(() => alert('Copy failed.')); }
    function showTab(name) {
      document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
      document.getElementById('panelReport').classList.toggle('show', name === 'report');
      document.getElementById('panelDeck').classList.toggle('show', name === 'deck');
    }
    document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));
    document.getElementById('nextBtn').addEventListener('click', () => {
      if (!form.company_name.value.trim()) { alert('Company name is required.'); return; }
      step1.classList.remove('show'); step2.classList.add('show');
    });
    document.getElementById('backBtn').addEventListener('click', () => {
      step2.classList.remove('show'); step1.classList.add('show');
    });
    async function pollStatus(statusUrl, resultUrl) {
      for (let i = 0; i < 180; i++) {
        const status = await (await fetch(statusUrl)).json();
        const pct = status.progress_pct || 0;
        document.getElementById('progressBar').style.width = Math.max(5, pct) + '%';
        document.getElementById('progressLabel').textContent = (status.progress_label || status.current_stage || 'running') + (pct ? ' (' + pct + '%)' : '');
        document.getElementById('statusText').textContent = status.message || ('Run ' + (status.run_id || '') + ' is ' + (status.status || 'running'));
        if (status.status === 'completed' || status.status === 'completed_with_warnings') {
          return await (await fetch(resultUrl)).json();
        }
        if (status.status === 'failed') throw new Error(status.message || 'Run failed.');
        await new Promise((r) => setTimeout(r, 5000));
      }
      throw new Error('Run still processing. Check result URL later.');
    }
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      resultsEl.classList.remove('show');
      statusEl.classList.add('show');
      runBtn.disabled = true;
      const payload = Object.fromEntries(new FormData(form).entries());
      try {
        const accepted = await (await fetch(apiBase() + '/dfa-production/start', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(payload) })).json();
        if (!accepted.accepted) throw new Error(accepted.message || accepted.next_question || 'Required input missing.');
        setText('runId', accepted.run_id);
        setText('runStatus', accepted.status || 'queued');
        setText('expert', accepted.expert_resolved && (accepted.expert_resolved.name + ' - ' + accepted.expert_resolved.reason));
        const data = await pollStatus(accepted.status_url, accepted.result_url);
        latest = data;
        const freshness = data.data_freshness || {};
        const market = data.market_data || {};
        setText('runStatus', data.status);
        setText('company', data.company && (data.company.legal_name || data.company.ticker));
        setText('marketCap', market.market_cap_usd ? ('$' + (market.market_cap_usd / 1e9).toFixed(2) + 'B') : (data.company && data.company.market_cap_usd ? ('$' + (data.company.market_cap_usd / 1e9).toFixed(2) + 'B') : 'N/A'));
        setText('fetchedAt', freshness.fetched_at || market.fetched_at || 'N/A');
        setText('latestFiling', (freshness.latest_filing_form || '') + ' ' + (freshness.latest_filing_date || ''));
        setText('qa', data.qa && data.qa.validation_status ? data.qa.validation_status : 'N/A');
        document.getElementById('report').textContent = data.final_report_markdown || 'No full report returned.';
        document.getElementById('deck').textContent = data.gamma_markdown || 'No deck markdown returned.';
        statusEl.classList.remove('show');
        resultsEl.classList.add('show');
      } catch (err) {
        document.getElementById('statusTitle').textContent = 'Run blocked or failed';
        document.getElementById('statusTitle').className = 'bad';
        document.getElementById('statusText').textContent = err.message || String(err);
      } finally {
        runBtn.disabled = false;
      }
    });
    document.getElementById('copyReport').addEventListener('click', () => copyText(latest && latest.final_report_markdown));
    document.getElementById('copyMarkdown').addEventListener('click', () => copyText(latest && latest.gamma_markdown));
    document.getElementById('copyJson').addEventListener('click', () => copyText(JSON.stringify((latest && latest.slides_json) || [], null, 2)));
  </script>
</body>
</html>`;
return [{ json: { html } }];
