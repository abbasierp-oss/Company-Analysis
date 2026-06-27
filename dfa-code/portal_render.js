// Stoic Analysis portal (inlined into n8n Code node)
const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Stoic Analysis</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect fill='%232c2416' width='64' height='64' rx='8'/%3E%3Ctext x='32' y='42' text-anchor='middle' font-family='Georgia,serif' font-size='28' fill='%23c9a227'%3ES%3C/text%3E%3C/svg%3E" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&display=swap');
    :root {
      --parchment: #f3ece0;
      --stone: #e4ddd0;
      --ink: #2c2416;
      --ink-soft: #5a4f42;
      --gold: #b8860b;
      --gold-light: #d4af37;
      --burgundy: #6b2d3c;
      --line: #c4b59a;
      --panel: rgba(255, 252, 245, 0.94);
      --shadow: 0 18px 50px rgba(44, 36, 22, 0.14);
      --good: #3d6b4f;
      --bad: #8b3a3a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: 'Cormorant Garamond', Georgia, 'Palatino Linotype', serif;
      font-size: 18px;
      color: var(--ink);
      background:
        radial-gradient(ellipse at 12% 0%, rgba(212, 175, 55, 0.12), transparent 42%),
        radial-gradient(ellipse at 88% 8%, rgba(107, 45, 60, 0.08), transparent 38%),
        linear-gradient(180deg, #ebe3d4 0%, var(--parchment) 38%, #efe8db 100%);
      min-height: 100vh;
    }
    .ornament { color: var(--gold); opacity: 0.55; letter-spacing: 0.35em; text-align: center; font-size: 11px; }
    .wrap { max-width: 1240px; margin: 0 auto; padding: 36px 20px 72px; }
    .brand-bar {
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      margin-bottom: 28px; padding-bottom: 18px; border-bottom: 1px solid var(--line);
    }
    .brand { display: flex; align-items: center; gap: 14px; }
    .brand-mark {
      width: 46px; height: 46px; border: 2px solid var(--gold);
      border-radius: 50%; display: grid; place-items: center;
      font-family: Cinzel, Georgia, serif; font-weight: 700; color: var(--gold);
      background: linear-gradient(145deg, #fffaf0, #efe4cf);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.6);
    }
    .brand h1 {
      margin: 0; font-family: Cinzel, Georgia, serif; font-size: 1.65rem;
      letter-spacing: 0.06em; font-weight: 700;
    }
    .brand p { margin: 2px 0 0; color: var(--ink-soft); font-size: 0.95rem; }
    .hero { display: grid; grid-template-columns: 1fr 1.05fr; gap: 24px; align-items: start; }
    .card {
      background: var(--panel); border: 1px solid var(--line);
      border-radius: 4px; box-shadow: var(--shadow);
      position: relative;
    }
    .card::before, .card::after {
      content: ''; position: absolute; width: 18px; height: 18px;
      border: 1px solid var(--gold-light); opacity: 0.45;
    }
    .card::before { top: 8px; left: 8px; border-right: 0; border-bottom: 0; }
    .card::after { bottom: 8px; right: 8px; border-left: 0; border-top: 0; }
    .intro, .box, form { padding: 28px; }
    .eyebrow {
      font-family: Cinzel, Georgia, serif; color: var(--burgundy);
      font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; font-size: 0.68rem;
    }
    h2 {
      font-family: Cinzel, Georgia, serif; font-weight: 700; letter-spacing: 0.04em;
      margin: 0 0 12px; font-size: 1.25rem;
    }
    .lead { color: var(--ink-soft); line-height: 1.55; margin: 10px 0 0; }
    .pillrow { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
    .pill {
      border: 1px solid var(--line); background: rgba(184, 134, 11, 0.08);
      color: var(--ink-soft); padding: 6px 12px; border-radius: 999px; font-size: 0.82rem;
    }
    form { display: grid; gap: 14px; }
    label {
      display: block; font-family: Cinzel, Georgia, serif; font-size: 0.72rem;
      letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-soft);
      margin-bottom: 6px; font-weight: 700;
    }
    input, select, textarea {
      width: 100%; background: #fffdf8; border: 1px solid var(--line);
      border-radius: 2px; color: var(--ink); padding: 12px 14px; font: inherit; outline: none;
    }
    input:focus, select:focus, textarea:focus { border-color: var(--gold); box-shadow: 0 0 0 2px rgba(184,134,11,0.15); }
    textarea { min-height: 88px; resize: vertical; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .section-title {
      padding: 10px 14px; background: linear-gradient(90deg, rgba(184,134,11,0.1), transparent);
      border-left: 3px solid var(--gold); color: var(--ink); font-family: Cinzel, Georgia, serif;
      font-size: 0.78rem; letter-spacing: 0.1em; text-transform: uppercase;
    }
    button {
      cursor: pointer; border: 1px solid var(--gold); border-radius: 2px;
      padding: 13px 18px; font-family: Cinzel, Georgia, serif; font-weight: 700;
      letter-spacing: 0.06em; text-transform: uppercase; font-size: 0.78rem;
      color: #fffaf0; background: linear-gradient(180deg, #8b6914, var(--gold));
      box-shadow: 0 4px 14px rgba(107, 45, 60, 0.12);
    }
    button:hover { filter: brightness(1.05); }
    button.secondary {
      background: #fffdf8; color: var(--ink); border-color: var(--line);
      box-shadow: none;
    }
    button.secondary.copied { background: var(--good); color: #fff; border-color: var(--good); }
    button:disabled { opacity: 0.55; cursor: not-allowed; }
    .output-panel { display: none; margin-top: 28px; }
    .output-panel.show { display: block; }
    .output-grid { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 22px; margin-top: 8px; }
    .dashboard { display: grid; gap: 16px; }
    .metric-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .metric-tile {
      background: #fffdf8; border: 1px solid var(--line); padding: 14px;
      border-radius: 2px;
    }
    .metric-tile b {
      display: block; font-family: Cinzel, Georgia, serif; font-size: 0.65rem;
      letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-soft); margin-bottom: 6px;
    }
    .metric-tile span { font-size: 1.35rem; font-weight: 600; color: var(--burgundy); }
    .chart-block {
      background: #fffdf8; border: 1px solid var(--line); padding: 16px; border-radius: 2px;
    }
    .chart-block h3 {
      margin: 0 0 12px; font-family: Cinzel, Georgia, serif; font-size: 0.85rem;
      letter-spacing: 0.06em; color: var(--ink-soft);
    }
    .bar-row { display: grid; grid-template-columns: 110px 1fr 64px; gap: 10px; align-items: center; margin-bottom: 10px; }
    .bar-label { font-size: 0.88rem; color: var(--ink-soft); }
    .bar-track { height: 12px; background: var(--stone); border-radius: 1px; overflow: hidden; }
    .bar-fill { height: 100%; background: linear-gradient(90deg, var(--burgundy), var(--gold)); border-radius: 1px; transition: width 0.5s ease; }
    .bar-val { font-size: 0.82rem; text-align: right; color: var(--ink); }
    .initiative-card {
      background: #fffdf8; border: 1px solid var(--line); border-left: 3px solid var(--burgundy);
      padding: 14px 16px; border-radius: 2px;
    }
    .initiative-card h4 { margin: 0 0 6px; font-family: Cinzel, Georgia, serif; font-size: 0.95rem; }
    .initiative-card p { margin: 4px 0; font-size: 0.92rem; color: var(--ink-soft); line-height: 1.45; }
    .initiative-card .tag { font-size: 0.75rem; color: var(--gold); font-style: italic; }
    .prompt-side { display: grid; gap: 12px; }
    .prompt-label { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .bar { height: 8px; background: var(--stone); border-radius: 1px; overflow: hidden; margin-top: 12px; }
    .bar span { display: block; height: 100%; width: 0%; background: linear-gradient(90deg, var(--burgundy), var(--gold)); transition: width 0.4s ease; }
    pre {
      white-space: pre-wrap; word-break: break-word; margin: 0;
      background: #fffdf8; border: 1px solid var(--line); border-radius: 2px;
      padding: 16px; min-height: 220px; max-height: 520px; overflow: auto;
      color: var(--ink); line-height: 1.5; font-size: 0.92rem;
    }
    .small { color: var(--ink-soft); font-size: 0.85rem; }
    .bad { color: var(--bad); }
    .good { color: var(--good); }
    .status-line { margin: 0 0 8px; }
    .empty-dash { padding: 24px; text-align: center; color: var(--ink-soft); font-style: italic; }
    @media (max-width: 960px) {
      .hero, .output-grid, .grid2, .metric-grid { grid-template-columns: 1fr; }
      .brand h1 { font-size: 1.35rem; }
      .bar-row { grid-template-columns: 90px 1fr 54px; }
    }
  </style>
</head>
<body>
  <main class="wrap">
    <header class="brand-bar">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">S</div>
        <div>
          <h1>Stoic Analysis</h1>
          <p>Executive financial intelligence with initiative-linked counsel</p>
        </div>
      </div>
    </header>

    <section class="hero">
      <div class="card intro">
        <div class="eyebrow">Financial &amp; Strategic Portal</div>
        <h2>Live SEC financials, visual dashboard, and presentation prompt.</h2>
        <p class="lead">Stoic Analysis fetches filing-backed metrics at run time, maps recommendations to your active IT initiatives, and renders a visual dashboard alongside your executive prompt.</p>
        <div class="pillrow">
          <span class="pill">SEC EDGAR</span>
          <span class="pill">Initiative mapping</span>
          <span class="pill">Visual dashboard</span>
          <span class="pill">Peer benchmarks</span>
          <span class="pill">Presentation prompt</span>
        </div>
      </div>
      <div class="card">
        <form id="dfaForm" action="#" method="post" onsubmit="return false;">
          <div class="section-title">Company</div>
          <div><label for="company_name">Company name</label><input id="company_name" name="company_name" placeholder="Example: Microsoft Corporation" required /></div>
          <div><label for="ticker">Ticker symbol if public</label><input id="ticker" name="ticker" placeholder="Example: MSFT" /></div>

          <div class="section-title">Executive context</div>
          <div class="grid2">
            <div><label for="exec_type">C-level executive</label><select id="exec_type" name="exec_type" required><option value="">Choose executive</option><option>CFO</option><option>CIO</option><option>CEO</option><option>COO</option><option>CDO</option><option>CISO</option><option>Board</option><option>Investor</option></select></div>
            <div><label for="industry">Industry</label><input id="industry" name="industry" placeholder="Example: Technology, Media, Streaming" required /></div>
          </div>
          <div><label for="expert_pref">Industry expert to blend</label><input id="expert_pref" name="expert_pref" placeholder="Expert name or type: pick for me" required /></div>
          <div class="grid2">
            <div><label for="service_provider">Service provider name</label><input id="service_provider" name="service_provider" placeholder="Example: Evolo AI" /></div>
            <div><label for="slide_count">Slide count</label><select id="slide_count" name="slide_count"><option>3</option><option selected>4</option><option>5</option></select></div>
          </div>

          <div class="section-title">IT initiatives &amp; peers</div>
          <div><label for="it_initiatives">Active IT initiatives (comma-separated)</label><input id="it_initiatives" name="it_initiatives" placeholder="Example: Cloud migration, ERP modernization, Data platform" aria-describedby="initHelp" /></div>
          <p class="small" id="initHelp">Recommendations are tied only to initiatives you list here or disclose in source notes. Generic advice is withheld.</p>
          <div><label for="peer_list">Peer products or competitors (optional)</label><input id="peer_list" name="peer_list" placeholder="Example: HBO Max, Disney+, Amazon Prime Video" /></div>
          <div><label for="source_notes">Source URLs or notes</label><textarea id="source_notes" name="source_notes" placeholder="Investor relations URLs, initiative roadmaps, annual reports"></textarea></div>

          <div><button id="runBtn" type="button">Run Stoic Analysis</button></div>
          <div class="small">Runs typically take 5–10 minutes. Your entries remain on this page while processing.</div>
        </form>
      </div>
    </section>

    <section id="outputPanel" class="output-panel card box" aria-live="polite">
      <div class="ornament">— ✦ —</div>
      <p class="status-line small" id="outputStatus">Complete the form and click Run Stoic Analysis.</p>
      <div class="bar" id="progressWrap" style="display:none;"><span id="progressBar"></span></div>
      <p class="small" id="progressLabel"></p>

      <div class="output-grid">
        <div class="dashboard" id="dashboard">
          <h2>Visual Dashboard</h2>
          <div class="empty-dash" id="dashboardEmpty">Metrics and initiative impact charts will appear here when your analysis completes.</div>
          <div id="dashboardContent" style="display:none;">
            <div class="metric-grid" id="metricGrid"></div>
            <div class="chart-block" id="financialChart">
              <h3>Financial Performance</h3>
              <div id="financialBars"></div>
            </div>
            <div class="chart-block" id="peerChart" style="display:none;">
              <h3>Peer Comparison</h3>
              <div id="peerBars"></div>
            </div>
            <div class="chart-block" id="initiativeBlock" style="display:none;">
              <h3>Initiative Impact</h3>
              <div id="initiativeCards"></div>
            </div>
          </div>
        </div>

        <div class="prompt-side">
          <div class="prompt-label">
            <h2>Presentation Prompt</h2>
            <button class="secondary" id="copyPrompt" type="button" disabled aria-live="polite">Copy</button>
          </div>
          <pre id="promptOutput">Your presentation prompt will appear here. Paste it into Gamma, Canva, or PowerPoint Copilot when ready.</pre>
          <p class="small" id="copyNotice"></p>
        </div>
      </div>
    </section>
  </main>
  <script>
    const form = document.getElementById('dfaForm');
    const outputPanel = document.getElementById('outputPanel');
    const runBtn = document.getElementById('runBtn');
    const copyPromptBtn = document.getElementById('copyPrompt');
    const promptOutput = document.getElementById('promptOutput');
    const outputStatus = document.getElementById('outputStatus');
    const progressWrap = document.getElementById('progressWrap');
    const dashboardEmpty = document.getElementById('dashboardEmpty');
    const dashboardContent = document.getElementById('dashboardContent');
    let latest = null;
    let copyResetTimer = null;

    function apiBase() { return window.location.origin + '/webhook'; }

    function statusUrlFor(runId) {
      return apiBase() + '/dfa-production/status?run_id=' + encodeURIComponent(runId);
    }

    function resultUrlFor(runId) {
      return apiBase() + '/dfa-production/result?run_id=' + encodeURIComponent(runId);
    }

    async function fetchJson(url, options, retries) {
      const maxRetries = typeof retries === 'number' ? retries : 4;
      let lastErr = null;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const resp = await fetch(url, Object.assign({ cache: 'no-store' }, options || {}));
          if (!resp.ok) {
            const detail = await resp.text().catch(function() { return ''; });
            throw new Error('HTTP ' + resp.status + (detail ? ': ' + detail.slice(0, 100) : ''));
          }
          const text = await resp.text();
          if (!text) throw new Error('Empty response from server');
          return JSON.parse(text);
        } catch (err) {
          lastErr = err;
          if (attempt < maxRetries) {
            await new Promise(function(r) { setTimeout(r, 1500 * (attempt + 1)); });
            continue;
          }
        }
      }
      throw lastErr || new Error('Request failed');
    }

    function parsePct(str) {
      if (!str || typeof str !== 'string') return null;
      const m = str.match(/(-?\\d+(?:\\.\\d+)?)\\s*%/);
      return m ? Number(m[1]) : null;
    }

    function barPct(metric) {
      if (!metric || metric.value == null) return 0;
      if (metric.kind === 'pct') return Math.min(100, Math.max(0, metric.value * 100));
      if (metric.kind === 'usd' && metric.id === 'revenue') return 100;
      if (metric.kind === 'usd' && metric.id === 'free_cash_flow') {
        const rev = (latest && latest.dashboard && latest.dashboard.metrics || []).find(function(m) { return m.id === 'revenue'; });
        if (rev && rev.value) return Math.min(100, Math.max(0, (metric.value / rev.value) * 100));
      }
      return 55;
    }

    function renderDashboard(data) {
      const dash = data && data.dashboard;
      if (!dash || dash.error) {
        dashboardEmpty.style.display = 'block';
        dashboardContent.style.display = 'none';
        dashboardEmpty.textContent = dash && dash.error ? 'Dashboard unavailable for this run.' : 'Metrics and initiative impact charts will appear here when your analysis completes.';
        return;
      }
      dashboardEmpty.style.display = 'none';
      dashboardContent.style.display = 'grid';

      const metricGrid = document.getElementById('metricGrid');
      metricGrid.innerHTML = (dash.metrics || []).slice(0, 6).map(function(m) {
        return '<div class="metric-tile"><b>' + m.label + '</b><span>' + m.display + '</span></div>';
      }).join('');

      const finBars = document.getElementById('financialBars');
      const chartMetrics = (dash.metrics || []).filter(function(m) {
        return ['revenue', 'operating_margin', 'free_cash_flow', 'net_margin'].indexOf(m.id) >= 0;
      });
      finBars.innerHTML = chartMetrics.map(function(m) {
        const pct = barPct(m);
        return '<div class="bar-row"><div class="bar-label">' + m.label + '</div><div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div><div class="bar-val">' + m.display + '</div></div>';
      }).join('') || '<p class="small">Financial chart data not available.</p>';

      const peerChart = document.getElementById('peerChart');
      const peerBars = document.getElementById('peerBars');
      const peers = (dash.peer_comparison && dash.peer_comparison.peers) || [];
      if (peers.length) {
        peerChart.style.display = 'block';
        peerBars.innerHTML = peers.map(function(p) {
          const pct = parsePct(p.operating_margin) || 30;
          return '<div class="bar-row"><div class="bar-label">' + p.name + '</div><div class="bar-track"><div class="bar-fill" style="width:' + Math.min(100, pct) + '%"></div></div><div class="bar-val">' + p.operating_margin + '</div></div>';
        }).join('');
      } else {
        peerChart.style.display = 'none';
      }

      const initBlock = document.getElementById('initiativeBlock');
      const initCards = document.getElementById('initiativeCards');
      const recs = dash.recommendations || dash.initiative_impact || [];
      if (recs.length) {
        initBlock.style.display = 'block';
        initCards.innerHTML = recs.map(function(r) {
          return '<article class="initiative-card"><h4>' + (r.initiative_name || r.initiative || 'Initiative') + '</h4><p><strong>Recommendation:</strong> ' + (r.title || r.recommendation || '') + '</p><p><strong>Goal:</strong> ' + (r.initiative_goal || r.goal || '') + '</p><p><strong>Outcome metric:</strong> ' + (r.outcome_metric || '') + '</p><p class="tag">' + (r.goal_support || r.rationale || '') + '</p></article>';
        }).join('');
      } else if ((dash.initiatives || []).length) {
        initBlock.style.display = 'block';
        initCards.innerHTML = dash.initiatives.map(function(it) {
          return '<article class="initiative-card"><h4>' + it.name + '</h4><p>' + it.goal + '</p><p><strong>Metric:</strong> ' + it.metric + '</p></article>';
        }).join('');
      } else {
        initBlock.style.display = 'none';
      }
    }

    function setCopyButtonState(copied) {
      if (copyResetTimer) { clearTimeout(copyResetTimer); copyResetTimer = null; }
      if (copied) {
        copyPromptBtn.textContent = 'Copied';
        copyPromptBtn.classList.add('copied');
        copyResetTimer = setTimeout(function() {
          copyPromptBtn.textContent = 'Copy';
          copyPromptBtn.classList.remove('copied');
        }, 2200);
      } else {
        copyPromptBtn.textContent = 'Copy';
        copyPromptBtn.classList.remove('copied');
      }
    }

    function copyPromptText() {
      const text = (latest && latest.presentation_prompt) || '';
      if (!text) { alert('Nothing to copy yet.'); return; }
      navigator.clipboard.writeText(text).then(function() {
        setCopyButtonState(true);
      }).catch(function() {
        alert('Copy failed. Select the text manually.');
      });
    }

    function presentationPromptFrom(data) {
      if (!data) return '';
      if (data.presentation_prompt) return data.presentation_prompt;
      const report = data.final_report_markdown || '';
      const marker = '## Executive Presentation Prompt';
      const start = report.indexOf(marker);
      if (start < 0) return '';
      const fence = String.fromCharCode(96, 96, 96);
      const fenceStart = report.indexOf(fence, start);
      if (fenceStart < 0) return '';
      const innerStart = report.indexOf('\\n', fenceStart) + 1;
      const innerEnd = report.indexOf(fence, innerStart);
      return innerEnd > innerStart ? report.slice(innerStart, innerEnd).trim() : '';
    }

    function showPromptBox(text, statusMessage) {
      const value = text || 'No presentation prompt returned yet.';
      promptOutput.textContent = value;
      copyPromptBtn.disabled = !text;
      setCopyButtonState(false);
      if (statusMessage) outputStatus.textContent = statusMessage;
    }

    function beginRunUi(companyName) {
      outputPanel.classList.add('show');
      progressWrap.style.display = 'block';
      document.getElementById('progressBar').style.width = '8%';
      document.getElementById('progressLabel').textContent = 'Queued';
      outputStatus.textContent = 'Running Stoic Analysis for ' + companyName + '. Dashboard and prompt will appear below.';
      showPromptBox('', '');
      promptOutput.textContent = 'Generating your executive presentation prompt...\\n\\nThis usually takes 5–10 minutes. Please keep this page open.';
      dashboardEmpty.style.display = 'block';
      dashboardContent.style.display = 'none';
      dashboardEmpty.textContent = 'Building your visual dashboard from live SEC data...';
      outputPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function pollStatus(runId) {
      let consecutiveFailures = 0;
      for (let i = 0; i < 180; i++) {
        try {
          const status = await fetchJson(statusUrlFor(runId), { method: 'GET' }, 3);
          consecutiveFailures = 0;
          const pct = status.progress_pct || 0;
          document.getElementById('progressBar').style.width = Math.max(8, pct) + '%';
          document.getElementById('progressLabel').textContent = (status.progress_label || status.current_stage || 'running') + (pct ? ' (' + pct + '%)' : '');
          outputStatus.textContent = status.message || ('Run ' + runId + ' is ' + (status.status || 'running'));
          if (status.status === 'completed' || status.status === 'completed_with_warnings') {
            return await fetchJson(resultUrlFor(runId), { method: 'GET' }, 4);
          }
          if (status.status === 'failed') throw new Error(status.message || 'Run failed.');
        } catch (err) {
          consecutiveFailures++;
          if (consecutiveFailures >= 12) {
            throw new Error((err && err.message) || 'Lost connection while checking run status.');
          }
          outputStatus.textContent = 'Temporary connection issue. Retrying (' + consecutiveFailures + '/12)...';
          await new Promise(function(r) { setTimeout(r, 4000); });
          continue;
        }
        await new Promise(function(r) { setTimeout(r, 8000); });
      }
      throw new Error('Run still processing. Save your run ID and try the result URL later.');
    }

    async function startRun() {
      if (!form.company_name.value.trim()) {
        alert('Company name is required.');
        form.company_name.focus();
        return;
      }
      if (!form.exec_type.value || !form.industry.value.trim() || !form.expert_pref.value.trim()) {
        alert('Executive, industry, and expert fields are required.');
        return;
      }

      runBtn.disabled = true;
      const payload = Object.fromEntries(new FormData(form).entries());
      beginRunUi(payload.company_name);

      try {
        const accepted = await fetchJson(apiBase() + '/dfa-production/start', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        }, 3);
        if (!accepted.accepted) throw new Error(accepted.message || accepted.next_question || 'Required input missing.');

        const data = await pollStatus(accepted.run_id);
        const promptText = presentationPromptFrom(data);
        latest = Object.assign({}, data, { presentation_prompt: promptText });

        progressWrap.style.display = 'none';
        document.getElementById('progressLabel').textContent = '';
        renderDashboard(latest);
        showPromptBox(promptText, promptText ? 'Presentation prompt ready.' : 'Run completed without a presentation prompt.');
        outputPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (err) {
        progressWrap.style.display = 'none';
        outputStatus.textContent = 'Run blocked or failed: ' + (err.message || String(err));
        outputStatus.className = 'status-line small bad';
        showPromptBox('', '');
        promptOutput.textContent = 'The run did not complete. Your form entries are still filled in above.\\n\\nError: ' + (err.message || String(err));
        copyPromptBtn.disabled = true;
      } finally {
        runBtn.disabled = false;
      }
    }

    runBtn.addEventListener('click', startRun);
    copyPromptBtn.addEventListener('click', copyPromptText);
  </script>
</body>
</html>`;
return [{ json: { html } }];
