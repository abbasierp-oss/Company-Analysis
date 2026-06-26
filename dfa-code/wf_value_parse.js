const prep = $('Prepare Claude Value Payload').first().json;
const state = prep.state;
const response = $('Claude Section 9 Value').first().json || {};
const now = new Date().toISOString();
const parsed = parseClaudeJson(response);
let markdown = parsed.section_9_sales_markdown || '';

if (!markdown || markdown.length < 200) {
  const provider = state.inputs?.service_provider || 'MY COMPANY';
  const company = state.entity?.legal_name || state.inputs?.company_name || 'the company';
  markdown = [
    '## Section 9: Insight To Value Realization And Selling Ideas',
    '',
    `Fallback scaffold for ${company}.`,
    '',
    parsed._raw ? String(parsed._raw).slice(0, 2000) : 'Claude output unavailable.',
    '',
    `Next step: ${provider} 30-day metric-to-value diagnostic.`,
  ].join('\n');
}

state.value_realization = { generated_at: now, markdown, source: markdown.includes('Fallback') ? 'fallback' : 'claude' };
state.sections = state.sections || {};
state.sections.s9_sales = markdown;
state.audit_log = state.audit_log || [];
state.audit_log.push({ timestamp: now, workflow_name: 'WF_VALUE_REALIZATION', status: markdown.includes('Fallback') ? 'WARN' : 'OK', message: 'Section 9 value realization generated.' });
return [{ json: state }];
