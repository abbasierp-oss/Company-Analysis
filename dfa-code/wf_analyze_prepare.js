const state = items[0]?.json?.state || items[0]?.json || {};
const inputs = state.inputs || {};
const expert = inputs.expert_resolved || { name: inputs.expert_pref || 'industry expert' };
const dataPack = { entity: state.entity, inputs, normalized: state.normalized, research: state.research, peer_benchmarks: state.peer_benchmarks, financial_snapshot: state.financial_snapshot, ratio_dashboard: state.ratio_dashboard, event_research: state.event_research, data_freshness: state.data_freshness };
const system = claudeBaseSystem(inputs, expert);
return [{ json: {
  state,
  claude_payloads: {
    s4: {
      model: 'claude-sonnet-4-6',
      max_tokens: 3500,
      temperature: 0.45,
      system,
      messages: [{ role: 'user', content: `Produce valid JSON only with key section_4_insights_markdown. Write exactly three strategic insights using SEC-backed metrics and peer_benchmarks table. Each insight must include Damodaran take, expert take, and so-what.\n\nINPUT_JSON:\n${JSON.stringify(dataPack).slice(0, 100000)}` }],
    },
    s7: {
      model: 'claude-sonnet-4-6',
      max_tokens: 2500,
      temperature: 0.3,
      system,
      messages: [{ role: 'user', content: `Produce valid JSON only with key section_7_rtbl_markdown. Read between the lines using filings, event_research, and metric changes. Use only supported evidence.\n\nINPUT_JSON:\n${JSON.stringify(dataPack).slice(0, 100000)}` }],
    },
  },
} }];
