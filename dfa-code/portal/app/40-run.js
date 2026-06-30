// Run orchestration: form submit, polling, UI transitions
function beginRunUi(companyName) {
  outputPanel.classList.add('show');
  progressWrap.style.display = 'block';
  document.getElementById('progressBar').style.width = '8%';
  document.getElementById('progressLabel').textContent = 'Queued';
  outputStatus.textContent = 'Running Stoic Analysis for ' + companyName + '. Dashboard and prompt will appear below.';
  showPromptBox('', '');
  promptOutput.textContent = 'Generating your executive presentation prompt...\n\nThis usually takes 5–10 minutes. Please keep this page open.';
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

function validateForm() {
  if (!form.company_name.value.trim()) {
    alert('Company name is required.');
    form.company_name.focus();
    return false;
  }
  if (!form.exec_type.value || !form.industry.value.trim() || !form.expert_pref.value.trim()) {
    alert('Executive, industry, and expert fields are required.');
    return false;
  }
  return true;
}

async function startRun() {
  if (!validateForm()) return;

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
    promptOutput.textContent = 'The run did not complete. Your form entries are still filled in above.\n\nError: ' + (err.message || String(err));
    copyPromptBtn.disabled = true;
  } finally {
    runBtn.disabled = false;
  }
}
