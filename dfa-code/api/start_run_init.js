const input = items[0]?.json || {};
const body = input.body || input;
const now = new Date().toISOString();
const clean = (v) => String(v || '').trim();
const companyName = clean(body.company_name || body.companyName || body.company);
const ticker = clean(body.ticker || body.symbol);
const execType = clean(body.exec_type || body.executive);
const industry = clean(body.industry);
const expertPref = clean(body.expert_pref || body.expert || body.industry_expert);
const serviceProvider = clean(body.service_provider || body.my_company || body.provider_company) || 'MY COMPANY';
const slide_count = 10;
const peerListRaw = body.peer_list || body.peers || '';
const peer_list = Array.isArray(peerListRaw) ? peerListRaw : String(peerListRaw || '').split(/[,;\n|]/).map((s) => s.trim()).filter(Boolean);
const itInitiativesRaw = body.it_initiatives || body.it_initiative_list || body.initiative_roadmap || '';
const it_initiatives = Array.isArray(itInitiativesRaw) ? itInitiativesRaw : String(itInitiativesRaw || '').split(/[,;\n|]/).map((s) => s.trim()).filter(Boolean);
const expertLibrary = {
  'media': { name: 'Ben Thompson', reason: 'aggregation theory and distribution power' },
  'gaming': { name: 'Matthew Ball', reason: 'gaming platforms and interactive media economics' },
  'banking': { name: 'Jamie Dimon', reason: 'banking strategy, risk, and capital discipline' },
  'retail': { name: 'Jan Kniffen', reason: 'retail operations and inventory economics' },
  'healthcare': { name: 'Andy Slavitt', reason: 'healthcare reimbursement and regulation' },
  'technology': { name: 'Bill Gurley', reason: 'software unit economics' },
};
const industryKey = Object.keys(expertLibrary).find((k) => industry.toLowerCase().includes(k));
const expertResolved = expertPref.toLowerCase().includes('pick')
  ? (expertLibrary[industryKey] || { name: 'Sector specialist', reason: 'default industry expert' })
  : { name: expertPref, reason: 'user selected' };

if (!companyName) {
  return [{ json: { valid: false, accepted: false, status: 'blocked_missing_inputs', conversation_step: 'question_1', missing_inputs: ['company_name'], next_question: 'What is the company name you want analyzed (and ticker symbol if public)?', message: 'Question 1 is required before any analysis can start.', received_at: now } }];
}
if (!execType || !industry || !expertPref) {
  return [{ json: { valid: false, accepted: false, status: 'blocked_missing_inputs', conversation_step: 'question_2', missing_inputs: ['exec_type','industry','expert_pref'].filter((f) => !({exec_type: execType, industry, expert_pref: expertPref })[f]), next_question: 'Which C-level executive is this pitch for, what industry is the company in, and which industry expert perspective should inform the analysis?', message: 'Question 2 is required. No analysis will start until executive, industry, and expert are provided.', company_name_received: companyName, ticker_received: ticker, received_at: now } }];
}

const runId = body.run_id || `dfa_prod_${Date.now()}`;
const state = {
  valid: true,
  accepted: true,
  run_id: runId,
  created_at: now,
  updated_at: now,
  status: 'queued',
  current_stage: 'queued',
  conversation_complete: true,
  inputs: { company_name: companyName, ticker, exec_type: execType, industry, expert_pref: expertPref, expert_resolved: expertResolved, service_provider: serviceProvider, peer_list, it_initiatives, slide_count, source_notes: clean(body.source_notes || ''), human_review: Boolean(body.human_review) },
};
return [{ json: state }];
