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
    .section-title { padding:12px 14px; background:#0d1429; border:1px solid var(--line); border-radius:14px; color:#edf5ff; font-weight:800; }
    button { cursor:pointer; border:0; border-radius:13px; padding:14px 16px; font-weight:900; color:#06101f; background:linear-gradient(135deg, var(--accent), #9effd0); }
    button.secondary { background:#253153; color:var(--text); border:1px solid var(--line); }
    button:disabled { opacity:.6; cursor:not-allowed; }
    .output-panel { display:none; margin-top:28px; }
    .output-panel.show { display:block; }
    .prompt-card { margin-top:18px; }
    .prompt-label { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px; }
    .prompt-label h2 { margin:0; }
    .bar { height:9px; background:#0d1429; border-radius:999px; overflow:hidden; margin-top:14px; }
    .bar span { display:block; height:100%; width:0%; background:linear-gradient(90deg, var(--accent), var(--good)); border-radius:999px; transition:width .4s ease; }
    .results { display:none; margin-top:18px; gap:18px; }
    .results.show { display:grid; grid-template-columns:.85fr 1.15fr; }
    .metric { padding:13px 0; border-bottom:1px solid var(--line); }
    .metric:last-child { border-bottom:0; }
    .metric b { display:block; font-size:13px; color:var(--muted); margin-bottom:4px; }
    pre { white-space:pre-wrap; word-break:break-word; margin:0; background:#071024; border:1px solid var(--line); border-radius:16px; padding:18px; min-height:220px; max-height:620px; overflow:auto; color:#edf5ff; line-height:1.5; }
    .actions { display:flex; gap:10px; flex-wrap:wrap; margin-top:14px; }
    .tabs { display:flex; gap:8px; margin-bottom:12px; }
    .tab { background:#253153; color:var(--text); border:1px solid var(--line); border-radius:10px; padding:8px 12px; font-size:13px; cursor:pointer; }
    .tab.active { background:var(--accent); color:#06101f; font-weight:800; }
    .panel { display:none; }
    .panel.show { display:block; }
    .small { color:var(--muted); font-size:12px; }
    .bad { color:var(--bad); }
    .good { color:var(--good); }
    .status-line { margin:0 0 8px; }
    @media (max-width:900px) { .hero, .results.show, .grid2 { grid-template-columns:1fr; } h1 { font-size:34px; } }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="hero">
      <div class="card intro">
        <div class="eyebrow">Executive Financial Analysis System</div>
        <h1>Live SEC financials to full analyst report and presentation prompt.</h1>
        <p>Financial figures are fetched live from SEC EDGAR and public market sources at run time. Complete the form, then your presentation prompt will appear in the output box below.</p>
        <div class="pillrow">
          <span class="pill">Live SEC EDGAR fetch</span>
          <span class="pill">Real-time market cap</span>
          <span class="pill">SEC peer benchmarks</span>
          <span class="pill">Executive report</span>
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

          <div class="section-title">Peer comparison</div>
          <div><label for="peer_list">Peer products or competitors (optional)</label><input id="peer_list" name="peer_list" placeholder="Example: HBO Max, Disney+, Amazon Prime Video" aria-describedby="peerHelp" /></div>
          <p class="small" id="peerHelp">Enter streaming services or product peers (comma-separated). The report will compare subscribers, pricing tiers, ad-supported plans, and product differences when public data is available; otherwise N/A.</p>
          <div><label for="source_notes">Source URLs or notes</label><textarea id="source_notes" name="source_notes" placeholder="Investor relations URLs, pricing pages, subscriber disclosures, annual reports"></textarea></div>

          <div class="actions"><button id="runBtn" type="button">Run Production Analysis</button></div>
          <div class="small">Runs typically take 5-10 minutes. Your form entries stay on this page while the analysis runs.</div>
        </form>
      </div>
    </section>

    <section id="outputPanel" class="output-panel card box" aria-live="polite">
      <div class="prompt-label">
        <h2>Executive Presentation Prompt</h2>
        <button class="secondary" id="copyPrompt" type="button" disabled>Copy Prompt</button>
      </div>
      <p class="status-line small" id="outputStatus">Fill out the form and click Run Production Analysis.</p>
      <div class="bar" id="progressWrap" style="display:none;"><span id="progressBar"></span></div>
      <p class="small" id="progressLabel"></p>
      <div class="prompt-card">
        <pre id="promptOutput">Your presentation prompt will appear here. Paste it into Gamma, Canva, or PowerPoint Copilot when ready.</pre>
      </div>
      <p class="small" id="copyNotice"></p>

      <div id="results" class="results">
        <div>
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
          </div>
        </div>
        <div>
          <div class="tabs">
            <button class="tab" data-tab="report" type="button">Full Report</button>
            <button class="tab active" data-tab="prompt" type="button">Presentation Prompt</button>
          </div>
          <div id="panelReport" class="panel"><pre id="report">Full report will appear here.</pre></div>
          <div id="panelPrompt" class="panel show"><pre id="promptMirror">Presentation prompt will appear here.</pre></div>
        </div>
      </div>
    </section>
  </main>
  <script>
    const form = document.getElementById('dfaForm');
    const outputPanel = document.getElementById('outputPanel');
    const resultsEl = document.getElementById('results');
    const runBtn = document.getElementById('runBtn');
    const copyPromptBtn = document.getElementById('copyPrompt');
    const promptOutput = document.getElementById('promptOutput');
    const outputStatus = document.getElementById('outputStatus');
    const progressWrap = document.getElementById('progressWrap');
    let latest = null;

    function apiBase() { return window.location.origin + '/webhook'; }
    function setText(id, value) { document.getElementById(id).textContent = value || '-'; }

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

    function copyText(value, label) {
      const text = value || '';
      if (!text) { alert('Nothing to copy yet.'); return; }
      navigator.clipboard.writeText(text).then(() => {
        const notice = document.getElementById('copyNotice');
        if (notice) {
          notice.textContent = (label || 'Content') + ' copied to clipboard.';
          notice.className = 'small good';
          setTimeout(() => { notice.textContent = ''; notice.className = 'small'; }, 2500);
        }
      }).catch(() => alert('Copy failed. Select the text manually.'));
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

    function showTab(name) {
      document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
      document.getElementById('panelReport').classList.toggle('show', name === 'report');
      document.getElementById('panelPrompt').classList.toggle('show', name === 'prompt');
    }

    function showPromptBox(text, statusMessage) {
      const value = text || 'No presentation prompt returned yet. If the run is still processing, wait for completion and check again.';
      promptOutput.textContent = value;
      const mirror = document.getElementById('promptMirror');
      if (mirror) mirror.textContent = value;
      copyPromptBtn.disabled = !text;
      if (statusMessage) outputStatus.textContent = statusMessage;
    }

    function beginRunUi(companyName) {
      outputPanel.classList.add('show');
      resultsEl.classList.remove('show');
      progressWrap.style.display = 'block';
      document.getElementById('progressBar').style.width = '8%';
      document.getElementById('progressLabel').textContent = 'Queued';
      outputStatus.textContent = 'Running analysis for ' + companyName + '. Your form entries are kept above. The prompt will appear in the box below when ready (typically 5-10 minutes).';
      showPromptBox('', '');
      promptOutput.textContent = 'Generating your executive presentation prompt...\\n\\nThis usually takes 5-10 minutes. Please keep this page open.';
      copyPromptBtn.disabled = true;
      outputPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));

    async function pollStatus(runId) {
      let consecutiveFailures = 0;
      for (let i = 0; i < 180; i++) {
        try {
          const status = await fetchJson(statusUrlFor(runId), { method: 'GET' }, 3);
          consecutiveFailures = 0;
          const pct = status.progress_pct || 0;
          document.getElementById('progressBar').style.width = Math.max(8, pct) + '%';
          document.getElementById('progressLabel').textContent = (status.progress_label || status.current_stage || 'running') + (pct ? ' (' + pct + '%)' : '');
          outputStatus.textContent = status.message || ('Run ' + (status.run_id || runId) + ' is ' + (status.status || 'running'));
          if (status.status === 'completed' || status.status === 'completed_with_warnings') {
            return await fetchJson(resultUrlFor(runId), { method: 'GET' }, 4);
          }
          if (status.status === 'failed') throw new Error(status.message || 'Run failed.');
        } catch (err) {
          consecutiveFailures++;
          if (consecutiveFailures >= 12) {
            throw new Error((err && err.message) || 'Lost connection while checking run status. Save your run ID and try the result URL later.');
          }
          outputStatus.textContent = 'Temporary connection issue while the analysis runs. Retrying status check (' + consecutiveFailures + '/12)...';
          await new Promise(function(r) { setTimeout(r, 4000); });
          continue;
        }
        await new Promise(function(r) { setTimeout(r, 8000); });
      }
      throw new Error('Run still processing. Save your run ID and open the result URL later.');
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

        setText('runId', accepted.run_id);
        setText('runStatus', accepted.status || 'queued');
        setText('expert', accepted.expert_resolved && (accepted.expert_resolved.name + ' - ' + accepted.expert_resolved.reason));

        const data = await pollStatus(accepted.run_id);
        latest = data;
        const freshness = data.data_freshness || {};
        const market = data.market_data || {};
        const promptText = presentationPromptFrom(data);

        setText('runStatus', data.status);
        setText('company', data.company && (data.company.legal_name || data.company.ticker));
        setText('marketCap', market.market_cap_usd ? ('$' + (market.market_cap_usd / 1e9).toFixed(2) + 'B') : 'N/A');
        setText('fetchedAt', freshness.fetched_at || market.fetched_at || 'N/A');
        setText('latestFiling', (freshness.latest_filing_form || '') + ' ' + (freshness.latest_filing_date || ''));
        setText('qa', data.qa && data.qa.validation_status ? data.qa.validation_status : 'N/A');
        document.getElementById('report').textContent = data.final_report_markdown || 'No full report returned.';
        latest = { ...data, presentation_prompt: promptText };

        progressWrap.style.display = 'none';
        document.getElementById('progressLabel').textContent = '';
        showPromptBox(promptText, promptText ? 'Presentation prompt ready. Copy it into Gamma or any slide tool.' : 'Run completed, but no presentation prompt was returned.');
        resultsEl.classList.add('show');
        showTab('prompt');
        outputPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (err) {
        progressWrap.style.display = 'none';
        outputStatus.textContent = 'Run blocked or failed: ' + (err.message || String(err));
        outputStatus.className = 'status-line small bad';
        showPromptBox('', '');
        const savedRunId = document.getElementById('runId').textContent;
        const runHint = savedRunId && savedRunId !== '-' ? ('\\n\\nRun ID: ' + savedRunId + '\\nStatus URL: ' + statusUrlFor(savedRunId) + '\\nResult URL: ' + resultUrlFor(savedRunId)) : '';
        promptOutput.textContent = 'The run did not complete. Your form entries are still filled in above. Fix any issues and try again.\\n\\nError: ' + (err.message || String(err)) + runHint;
        copyPromptBtn.disabled = true;
      } finally {
        runBtn.disabled = false;
      }
    }

    runBtn.addEventListener('click', startRun);
    document.getElementById('copyReport').addEventListener('click', () => copyText(latest && latest.final_report_markdown, 'Full report'));
    copyPromptBtn.addEventListener('click', () => copyText(latest && latest.presentation_prompt, 'Presentation prompt'));
  </script>
</body>
</html>`;
return [{ json: { html } }];
