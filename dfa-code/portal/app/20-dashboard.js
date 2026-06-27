// Visual dashboard rendering
function parsePct(str) {
  if (!str || typeof str !== 'string') return null;
  const m = str.match(/(-?\d+(?:\.\d+)?)\s*%/);
  return m ? Number(m[1]) : null;
}

function barPct(metric) {
  if (!metric || metric.value == null) return 0;
  if (metric.kind === 'pct') return Math.min(100, Math.max(0, metric.value * 100));
  if (metric.kind === 'usd' && metric.id === 'revenue') return 100;
  if (metric.kind === 'usd' && metric.id === 'free_cash_flow') {
    const metrics = (latest && latest.dashboard && latest.dashboard.metrics) || [];
    const rev = metrics.find(function(m) { return m.id === 'revenue'; });
    if (rev && rev.value) return Math.min(100, Math.max(0, (metric.value / rev.value) * 100));
  }
  return 55;
}

function renderBarRows(container, rows) {
  container.innerHTML = rows.join('') || '<p class="small">No chart data available.</p>';
}

function renderInitiativeCards(recs, initiatives) {
  const initBlock = document.getElementById('initiativeBlock');
  const initCards = document.getElementById('initiativeCards');
  if (recs.length) {
    initBlock.style.display = 'block';
    initCards.innerHTML = recs.map(function(r) {
      return '<article class="initiative-card"><h4>' + (r.initiative_name || r.initiative || 'Initiative') + '</h4>'
        + '<p><strong>Recommendation:</strong> ' + (r.title || r.recommendation || '') + '</p>'
        + '<p><strong>Goal:</strong> ' + (r.initiative_goal || r.goal || '') + '</p>'
        + '<p><strong>Outcome metric:</strong> ' + (r.outcome_metric || '') + '</p>'
        + '<p class="tag">' + (r.goal_support || r.rationale || '') + '</p></article>';
    }).join('');
    return;
  }
  if (initiatives.length) {
    initBlock.style.display = 'block';
    initCards.innerHTML = initiatives.map(function(it) {
      return '<article class="initiative-card"><h4>' + it.name + '</h4><p>' + it.goal + '</p><p><strong>Metric:</strong> ' + it.metric + '</p></article>';
    }).join('');
    return;
  }
  initBlock.style.display = 'none';
}

function renderDashboard(data) {
  const dash = data && data.dashboard;
  if (!dash || dash.error) {
    dashboardEmpty.style.display = 'block';
    dashboardContent.style.display = 'none';
    dashboardEmpty.textContent = dash && dash.error
      ? 'Dashboard unavailable for this run.'
      : 'Metrics and initiative impact charts will appear here when your analysis completes.';
    return;
  }
  dashboardEmpty.style.display = 'none';
  dashboardContent.style.display = 'grid';

  const metricGrid = document.getElementById('metricGrid');
  metricGrid.innerHTML = (dash.metrics || []).slice(0, 6).map(function(m) {
    return '<div class="metric-tile"><b>' + m.label + '</b><span>' + m.display + '</span></div>';
  }).join('');

  const chartMetrics = (dash.metrics || []).filter(function(m) {
    return ['revenue', 'operating_margin', 'free_cash_flow', 'net_margin'].indexOf(m.id) >= 0;
  });
  renderBarRows(document.getElementById('financialBars'), chartMetrics.map(function(m) {
    const pct = barPct(m);
    return '<div class="bar-row"><div class="bar-label">' + m.label + '</div><div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div><div class="bar-val">' + m.display + '</div></div>';
  }));

  const peerChart = document.getElementById('peerChart');
  const peers = (dash.peer_comparison && dash.peer_comparison.peers) || [];
  if (peers.length) {
    peerChart.style.display = 'block';
    renderBarRows(document.getElementById('peerBars'), peers.map(function(p) {
      const pct = parsePct(p.operating_margin) || 30;
      return '<div class="bar-row"><div class="bar-label">' + p.name + '</div><div class="bar-track"><div class="bar-fill" style="width:' + Math.min(100, pct) + '%"></div></div><div class="bar-val">' + p.operating_margin + '</div></div>';
    }));
  } else {
    peerChart.style.display = 'none';
  }

  renderInitiativeCards(dash.recommendations || dash.initiative_impact || [], dash.initiatives || []);
}
