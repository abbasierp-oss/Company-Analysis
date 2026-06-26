const prep = $('Prepare Claude Proposal Payload').first().json;
const state = prep.state;
const response = $('Claude Section 6 Proposal').first().json || {};
const now = new Date().toISOString();
const parsed = parseClaudeJson(response);
let markdown = parsed.section_6_proposal_markdown || '';

if (!markdown || markdown.length < 200) {
  const provider = state.inputs?.service_provider || 'MY COMPANY';
  const execType = state.inputs?.exec_type || 'executive';
  markdown = [
    '## Section 6: Executive Proposal - Move The Metrics',
    '',
    `Audience: ${execType}`,
    `Service provider: ${provider}`,
    '',
    'Claude generation was unavailable; fallback scaffold generated from normalized metrics.',
    '',
    parsed._raw ? `Raw model output: ${String(parsed._raw).slice(0, 1500)}` : 'No model output captured.',
  ].join('\n');
}

state.executive_proposal = { generated_at: now, markdown, source: markdown.includes('fallback') ? 'fallback' : 'claude' };
state.sections = state.sections || {};
state.sections.s6_proposal = markdown;
state.audit_log = state.audit_log || [];
state.audit_log.push({ timestamp: now, workflow_name: 'WF_PROPOSAL', status: markdown.includes('fallback') ? 'WARN' : 'OK', message: 'Section 6 executive proposal generated.' });
return [{ json: state }];
