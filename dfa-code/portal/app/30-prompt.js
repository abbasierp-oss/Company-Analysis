// Presentation prompt extraction and display
function presentationPromptFrom(data) {
  if (!data) return '';
  if (data.presentation_prompt) return data.presentation_prompt;
  const report = data.final_report_markdown || '';
  const marker = '## Executive Presentation Prompt';
  const start = report.indexOf(marker);
  if (start < 0) return '';
  const fence = String.fromCharCode(96, 96, 96);
  const fenceStart = report.indexOf(fence, start);
  if (fenceStart < 0) return '';
  const innerStart = report.indexOf('\n', fenceStart) + 1;
  const innerEnd = report.indexOf(fence, innerStart);
  return innerEnd > innerStart ? report.slice(innerStart, innerEnd).trim() : '';
}

function showPromptBox(text, statusMessage) {
  promptOutput.textContent = text || 'No presentation prompt returned yet.';
  copyPromptBtn.disabled = !text;
  setCopyButtonState(false);
  if (statusMessage) outputStatus.textContent = statusMessage;
}
