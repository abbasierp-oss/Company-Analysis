const state = items[0]?.json?.state || items[0]?.json || {};
const inputs = state.inputs || {};
const expert = inputs.expert_resolved || { name: inputs.expert_pref || 'industry expert' };
const dataPack = {
  entity: state.entity,
  inputs,
  normalized: state.normalized,
  peer_benchmarks: state.peer_benchmarks,
  sections: { s4_insights: state.sections?.s4_insights || '' },
  data_freshness: state.data_freshness,
};
const system = claudeBaseSystem(inputs, expert);
const task = `Produce valid JSON only with key section_6_proposal_markdown.

Section 6: Executive Proposal for ${inputs.service_provider || 'MY COMPANY'} tailored to ${inputs.exec_type} in ${inputs.industry}.
Structure:
- Top 3-5 financial/operational trends grounded in numbers and peer gaps
- 3-5 initiatives each with target metric(s), mechanism, service fit, expected impact hypothesis, timeline (0-3, 3-12, 12+ months), dependencies/risks
Do not use placeholders. Use N/A when data is missing.`;
return [{ json: {
  state,
  claude_payload: {
    model: 'claude-sonnet-4-6',
    max_tokens: 5000,
    temperature: 0.45,
    system,
    messages: [{ role: 'user', content: `${task}\n\nINPUT_JSON:\n${JSON.stringify(dataPack).slice(0, 120000)}` }],
  },
} }];
