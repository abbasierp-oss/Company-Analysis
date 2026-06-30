const state = items[0]?.json?.state || items[0]?.json || {};
const now = new Date().toISOString();
const pkg = buildPresentationPackage(state);
const promptText = pkg.prompt_text;
const promptSection = [
  '## Executive Presentation Prompt',
  '',
  `**Deck:** ${DECK_SLIDE_COUNT} slides with shared footer (company logo left, service provider logo right).`,
  '',
  'Copy the prompt below into Gamma, Canva, PowerPoint Copilot, or any presentation tool to generate a board-ready deck.',
  '',
  ...(pkg.logo_fallback_notes.length ? ['**Logo fallback notes:**', ...pkg.logo_fallback_notes.map((n) => `- ${n}`), ''] : []),
  '```',
  promptText,
  '```',
].join('\n');

state.inputs = state.inputs || {};
state.inputs.slide_count = DECK_SLIDE_COUNT;
state.deck_assets = {
  generated_at: now,
  slide_count: DECK_SLIDE_COUNT,
  slide_master: pkg.slide_master,
  logos: pkg.logos,
};
state.gamma_deck = {
  generated_at: now,
  slide_count: DECK_SLIDE_COUNT,
  financial_slide_count: FINANCIAL_SLIDE_COUNT,
  slide_master: pkg.slide_master,
  logos: pkg.logos,
  slides_json: pkg.slides_json,
  gamma_markdown: pkg.gamma_markdown,
  org_cxo_intel: pkg.org_cxo_intel,
  logo_fallback_notes: pkg.logo_fallback_notes,
};
state.org_cxo_intel = pkg.org_cxo_intel;
state.presentation_prompt = {
  generated_at: now,
  slide_count: DECK_SLIDE_COUNT,
  prompt_text: promptText,
  markdown: promptSection,
  slide_master: pkg.slide_master,
  logos: pkg.logos,
  org_cxo_intel: pkg.org_cxo_intel,
  status: promptText ? 'ready' : 'warn',
};
state.sections = state.sections || {};
state.sections.s10_presentation_prompt = promptSection;
if (state.final_report_markdown) {
  state.final_report_markdown = `${state.final_report_markdown}\n\n---\n\n${promptSection}`;
}
state.report_outputs = state.report_outputs || {};
state.report_outputs.presentation_prompt = promptText;
state.report_outputs.gamma_deck = pkg.gamma_markdown;
state.report_outputs.org_cxo_intel = pkg.org_cxo_intel;
state.report_outputs.full_report_markdown = state.final_report_markdown || '';
state.delivery = state.delivery || {};
state.delivery.presentation_prompt = promptText;
state.delivery.org_cxo_intel = pkg.org_cxo_intel;
state.delivery.gamma_deck = state.gamma_deck;
state.delivery.status = 'presentation_prompt_ready';
state.audit_log = state.audit_log || [];
state.audit_log.push({
  timestamp: now,
  workflow_name: 'WF_PRESENTATION_PROMPT',
  status: 'OK',
  message: `Executive presentation package generated (${DECK_SLIDE_COUNT} slides, centralized footer master).`,
});
return [{ json: state }];
