const state = items[0]?.json?.state || items[0]?.json || {};
const targets = state.inputs?.delivery_targets || ['webhook_response'];
state.delivery = state.delivery || {};
state.delivery.targets = targets;
state.delivery.final_artifact_type = 'presentation_prompt';
state.delivery.payloads = {
  presentation_tool: {
    action: 'copy_prompt_into_gamma_canva_or_ppt',
    artifact_field: 'presentation_prompt.prompt_text',
    note: 'Paste the executive presentation prompt into Gamma, Canva, PowerPoint Copilot, or similar.',
  },
  gamma_deck: {
    action: 'import_structured_deck',
    artifact_field: 'gamma_deck',
    slide_count: state.gamma_deck?.slide_count || DECK_SLIDE_COUNT,
    slide_master_field: 'gamma_deck.slide_master',
    slides_field: 'gamma_deck.slides_json',
    markdown_field: 'gamma_deck.gamma_markdown',
  },
  full_report: {
    action: 'copy_full_report_markdown',
    artifact_field: 'final_report_markdown',
  },
};
state.audit_log = state.audit_log || [];
state.audit_log.push({
  timestamp: new Date().toISOString(),
  workflow_name: 'WF_DELIVERY',
  status: 'OK',
  message: 'Delivery payloads prepared (report + 10-slide deck with shared footer master).',
});
return [{ json: state }];
