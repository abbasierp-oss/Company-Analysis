// HTTP helpers for production API
function apiBase() {
  return window.location.origin + '/webhook';
}

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
