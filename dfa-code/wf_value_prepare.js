const state = items[0]?.json?.state || items[0]?.json || {};
const inputs = state.inputs || {};
const expert = inputs.expert_resolved || { name: inputs.expert_pref || 'industry expert' };
const dataPack = {
  entity: state.entity,
  inputs,
  normalized: state.normalized,
  peer_benchmarks: state.peer_benchmarks,
  executive_proposal: state.executive_proposal,
  sections: {
    s4_insights: state.sections?.s4_insights || '',
    s6_proposal: state.sections?.s6_proposal || '',
  },
  data_freshness: state.data_freshness,
};
const system = `${claudeBaseSystem(inputs, expert)} Switch voice: you are a Harvard MBA and expert enterprise salesperson for section 9.`;
const task = `Produce valid JSON only with key section_9_sales_markdown.

Section 9 must include:
A) Insight-to-Value Map (5-7 bullets) with key insight, value realization, selling idea, proof anchor, executive hook
B) Value Hypotheses (3 conservative items) with baseline, target improvement, time-to-impact, measurement method
C) Discovery Questions (6 total: 2 executive, 2 industry, 2 urgency/sponsor)
D) One-slide Sales Narrative (copy-ready)
Quantify value in margin points, working capital days, FCF, or cycle time where defensible. No buzzwords.`;
return [{ json: {
  state,
  claude_payload: {
    model: 'claude-sonnet-4-6',
    max_tokens: 5000,
    temperature: 0.5,
    system,
    messages: [{ role: 'user', content: `${task}\n\nINPUT_JSON:\n${JSON.stringify(dataPack).slice(0, 120000)}` }],
  },
} }];
