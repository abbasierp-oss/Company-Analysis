const state = items[0]?.json?.state || items[0]?.json || {};
const now = new Date().toISOString();
const promptText = buildExecutivePresentationPrompt(state);
const promptSection = [
  '## Executive Presentation Prompt',
  '',
  'Copy the prompt below into Gamma, Canva, PowerPoint Copilot, or any presentation tool to generate a board-ready deck.',
  '',
  '```',
  promptText,
  '```',
].join('\n');

state.presentation_prompt = {
  generated_at: now,
  slide_count: [3, 4, 5].includes(Number(state.inputs?.slide_count)) ? Number(state.inputs.slide_count) : 4,
  prompt_text: promptText,
  markdown: promptSection,
  status: promptText ? 'ready' : 'warn',
};
state.sections = state.sections || {};
state.sections.s10_presentation_prompt = promptSection;
if (state.final_report_markdown) {
  state.final_report_markdown = `${state.final_report_markdown}\n\n---\n\n${promptSection}`;
}
state.report_outputs = state.report_outputs || {};
state.report_outputs.presentation_prompt = promptText;
state.report_outputs.full_report_markdown = state.final_report_markdown || '';
state.delivery = state.delivery || {};
state.delivery.presentation_prompt = promptText;
state.delivery.status = 'presentation_prompt_ready';
state.audit_log = state.audit_log || [];
state.audit_log.push({
  timestamp: now,
  workflow_name: 'WF_PRESENTATION_PROMPT',
  status: 'OK',
  message: `Executive presentation prompt generated (${state.presentation_prompt.slide_count} slides).`,
});
return [{ json: state }];
