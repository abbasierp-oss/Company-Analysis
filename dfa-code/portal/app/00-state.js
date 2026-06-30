// DOM references and shared run state
const form = document.getElementById('dfaForm');
const outputPanel = document.getElementById('outputPanel');
const runBtn = document.getElementById('runBtn');
const copyPromptBtn = document.getElementById('copyPrompt');
const promptOutput = document.getElementById('promptOutput');
const outputStatus = document.getElementById('outputStatus');
const progressWrap = document.getElementById('progressWrap');
const dashboardEmpty = document.getElementById('dashboardEmpty');
const dashboardContent = document.getElementById('dashboardContent');
let latest = null;
let copyResetTimer = null;
