// Copy-to-clipboard feedback
function setCopyButtonState(copied) {
  if (copyResetTimer) {
    clearTimeout(copyResetTimer);
    copyResetTimer = null;
  }
  if (!copied) {
    copyPromptBtn.textContent = 'Copy';
    copyPromptBtn.classList.remove('copied');
    return;
  }
  copyPromptBtn.textContent = 'Copied';
  copyPromptBtn.classList.add('copied');
  copyResetTimer = setTimeout(function() {
    copyPromptBtn.textContent = 'Copy';
    copyPromptBtn.classList.remove('copied');
  }, 2200);
}

function copyPromptText() {
  const text = (latest && latest.presentation_prompt) || '';
  if (!text) {
    alert('Nothing to copy yet.');
    return;
  }
  navigator.clipboard.writeText(text).then(function() {
    setCopyButtonState(true);
  }).catch(function() {
    alert('Copy failed. Select the text manually.');
  });
}
