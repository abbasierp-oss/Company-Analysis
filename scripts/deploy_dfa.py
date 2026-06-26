#!/usr/bin/env python3
"""Deploy DFA workflow upgrades to n8n cloud instance."""
import json
import os
import re
import ssl
import urllib.request
from copy import deepcopy
from pathlib import Path

BASE = 'https://evoloai.app.n8n.cloud'
API_KEY = os.environ.get('N8N_API_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3ZTk5ODA3OC0wMzY0LTQwNGUtOWMyYi0wOTVlYTM4ZWVlYzkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiN2I1ZDU1YzItYjIyOC00ZDU1LWI1OGYtOTM4N2M2NmZhZTdiIiwiaWF0IjoxNzgyNDk3MjYwLCJleHAiOjE3ODUwMDYwMDB9.gjeQ99YWx09tvjW2onjx2UMv9w9RsrBRSIWToGeNqdc')
ROOT = Path('/workspace')
CODE = ROOT / 'dfa-code'
WF_DIR = ROOT / 'dfa-workflows'
CTX = ssl.create_default_context()

CLAUDE_CRED = {"httpHeaderAuth": {"id": "higk8M4c3hFtCG0D", "name": "DFA Claude API Key"}}


def load_lib():
    return (CODE / 'dfa-financial-lib.js').read_text()


def bundle(filename):
    body = (CODE / filename).read_text()
    return load_lib() + '\n' + body


def api(method, path, data=None):
    headers = {'X-N8N-API-KEY': API_KEY, 'Accept': 'application/json', 'Content-Type': 'application/json'}
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(BASE + path, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, context=CTX, timeout=120) as r:
        return json.load(r)


def put_workflow(wf):
    payload = {
        'name': wf['name'],
        'nodes': wf['nodes'],
        'connections': wf['connections'],
        'settings': wf.get('settings', {}),
    }
    wid = wf['id']
    return api('PUT', f'/api/v1/workflows/{wid}', payload)


def set_node_code(wf, node_name, code):
    for n in wf['nodes']:
        if n['name'] == node_name:
            n['parameters']['jsCode'] = code
            return
    raise KeyError(node_name)


def claude_node(node_id, name, pos, json_expr):
    return {
        'id': node_id,
        'name': name,
        'type': 'n8n-nodes-base.httpRequest',
        'typeVersion': 4.4,
        'position': pos,
        'parameters': {
            'method': 'POST',
            'url': 'https://api.anthropic.com/v1/messages',
            'authentication': 'genericCredentialType',
            'genericAuthType': 'httpHeaderAuth',
            'sendHeaders': True,
            'headerParameters': {'parameters': [
                {'name': 'anthropic-version', 'value': '2023-06-01'},
                {'name': 'content-type', 'value': 'application/json'},
            ]},
            'sendBody': True,
            'contentType': 'json',
            'specifyBody': 'json',
            'jsonBody': json_expr,
            'options': {'response': {'response': {'responseFormat': 'json'}}},
        },
        'credentials': CLAUDE_CRED,
        'onError': 'continueRegularOutput',
        'retryOnFail': True,
        'maxTries': 3,
        'waitBetweenTries': 2000,
        'alwaysOutputData': True,
    }


def code_node(node_id, name, pos, code):
    return {
        'id': node_id,
        'name': name,
        'type': 'n8n-nodes-base.code',
        'typeVersion': 2,
        'position': pos,
        'parameters': {'mode': 'runOnceForAllItems', 'language': 'javaScript', 'jsCode': code},
    }


def patch_peer_benchmarks(wf):
    patch_timeouts(wf, 600)
    wf['nodes'] = [
        {'id': 'trigger', 'name': 'Subworkflow Input', 'type': 'n8n-nodes-base.executeWorkflowTrigger', 'typeVersion': 1, 'position': [0, 0], 'parameters': {}},
        code_node('peer_fetch', 'Fetch Peer SEC Benchmarks', [300, 0], bundle('wf_peer_benchmarks.js')),
    ]
    wf['connections'] = {'Subworkflow Input': {'main': [[{'node': 'Fetch Peer SEC Benchmarks', 'type': 'main', 'index': 0}]]}}


def patch_research_public(wf):
    market_node = {
        'id': 'market_price',
        'name': 'Fetch Live Market Price',
        'type': 'n8n-nodes-base.httpRequest',
        'typeVersion': 4.4,
        'position': [1300, -120],
        'parameters': {
            'method': 'GET',
            'url': "={{ 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent($json.entity?.ticker || $json.state?.entity?.ticker || $json.ticker || $('Prepare SEC Research URLs').first().json.ticker || 'AAPL') + '?interval=1d&range=1d' }}",
            'sendHeaders': True,
            'headerParameters': {'parameters': [{'name': 'User-Agent', 'value': 'DamodaranAnalystSystem/2.0'}]},
            'options': {'response': {'response': {'responseFormat': 'json'}}},
        },
        'onError': 'continueRegularOutput',
        'retryOnFail': True,
        'maxTries': 2,
        'alwaysOutputData': True,
    }
    names = {n['name'] for n in wf['nodes']}
    if 'Fetch Live Market Price' not in names:
        wf['nodes'].append(market_node)
    set_node_code(wf, 'Attach Public Serper Events', bundle('wf_research_attach.js'))
    wf['connections']['Serper Public News Search'] = {'main': [[{'node': 'Fetch Live Market Price', 'type': 'main', 'index': 0}]]}
    wf['connections']['Fetch Live Market Price'] = {'main': [[{'node': 'Attach Public Serper Events', 'type': 'main', 'index': 0}]]}


def patch_analyze(wf):
    patch_timeouts(wf, 900)
    wf['nodes'] = [
        {'id': 'trigger', 'name': 'Subworkflow Input', 'type': 'n8n-nodes-base.executeWorkflowTrigger', 'typeVersion': 1.2, 'position': [0, 0], 'parameters': {'inputSource': 'passthrough'}},
        code_node('logic', 'Prepare Claude Analysis Payloads', [260, 0], bundle('wf_analyze_prepare.js')),
        claude_node('claude_s4', 'Claude Section 4 Insights', [520, 0], "={{ JSON.stringify($json.claude_payloads.s4) }}"),
        claude_node('claude_s7', 'Claude Section 7 RTBL', [780, 0], "={{ JSON.stringify($('Prepare Claude Analysis Payloads').first().json.claude_payloads.s7) }}"),
        code_node('parse', 'Parse Claude Analysis Sections', [1040, 0], bundle('wf_analyze_parse.js')),
    ]
    wf['connections'] = {
        'Subworkflow Input': {'main': [[{'node': 'Prepare Claude Analysis Payloads', 'type': 'main', 'index': 0}]]},
        'Prepare Claude Analysis Payloads': {'main': [[{'node': 'Claude Section 4 Insights', 'type': 'main', 'index': 0}]]},
        'Claude Section 4 Insights': {'main': [[{'node': 'Claude Section 7 RTBL', 'type': 'main', 'index': 0}]]},
        'Claude Section 7 RTBL': {'main': [[{'node': 'Parse Claude Analysis Sections', 'type': 'main', 'index': 0}]]},
    }


def patch_proposal(wf):
    patch_timeouts(wf, 300)
    wf['nodes'] = [
        {'id': 'trigger', 'name': 'Subworkflow Input', 'type': 'n8n-nodes-base.executeWorkflowTrigger', 'typeVersion': 1.2, 'position': [0, 0], 'parameters': {'inputSource': 'passthrough'}},
        code_node('logic', 'Build Executive Proposal Section', [260, 0], bundle('wf_proposal_enhanced.js')),
    ]
    wf['connections'] = {'Subworkflow Input': {'main': [[{'node': 'Build Executive Proposal Section', 'type': 'main', 'index': 0}]]}}


def patch_value_realization(wf):
    patch_timeouts(wf, 300)
    wf['nodes'] = [
        {'id': 'trigger', 'name': 'Subworkflow Input', 'type': 'n8n-nodes-base.executeWorkflowTrigger', 'typeVersion': 1, 'position': [0, 0], 'parameters': {}},
        code_node('value', 'Build Section 9 Value Realization', [280, 0], bundle('wf_value_enhanced.js')),
    ]
    wf['connections'] = {'Subworkflow Input': {'main': [[{'node': 'Build Section 9 Value Realization', 'type': 'main', 'index': 0}]]}}


def patch_assemble_qa(wf):
    set_node_code(wf, 'Assemble And QA Report', bundle('wf_assemble_qa.js'))


def patch_financial_snapshot(wf):
    for n in wf['nodes']:
        if n['name'] == 'Build Exact Financial Snapshot':
            code = n['parameters']['jsCode']
            code = code.replace(
                "if (rowId === 'market_cap') return null;",
                "if (rowId === 'market_cap') {\n    const mc = state.research?.market_data?.market_cap_usd;\n    if (mc === null || mc === undefined) return null;\n    return { value: mc, unit: 'USD', period: state.research?.market_data?.source_date || 'latest', fiscal_label: 'Market cap', source_name: state.research?.market_data?.source_name || 'Market data', source_url: state.research?.market_data?.source_url || '', source_date: state.research?.market_data?.source_date || now, source_section: 'market_data', formula: 'Share price x diluted shares outstanding (SEC)', confidence: state.research?.market_data?.confidence || 'MEDIUM' };\n  }"
            )
            n['parameters']['jsCode'] = code


def patch_timeouts(wf, seconds=900):
    wf.setdefault('settings', {})['executionTimeout'] = seconds


def patch_main_prod(wf):
    init_code = """const input = items[0]?.json || {};
const body = input.body || input;
const now = new Date().toISOString();
const slideCountRaw = Number(body.slide_count || body.slideCount || body.inputs?.slide_count || 4);
const slideCount = [3,4,5].includes(slideCountRaw) ? slideCountRaw : 4;
const existing = body.state || (body.run_id && body.inputs ? body : null);
if (existing) {
  existing.updated_at = now;
  existing.status = existing.status || 'running';
  existing.current_stage = existing.current_stage || 'initialized';
  existing.audit_log = existing.audit_log || [];
  existing.audit_log.push({ timestamp: now, workflow_name: 'WF_MAIN_PROD', status: 'OK', message: 'Production orchestrator received existing state.' });
  return [{ json: existing }];
}
const peerListRaw = body.peer_list || body.peers || body.known_competitors || '';
const peer_list = Array.isArray(peerListRaw) ? peerListRaw : String(peerListRaw || '').split(/[,;\\n|]/).map((s) => s.trim()).filter(Boolean);
const state = {
  run_id: body.run_id || `dfa_prod_${Date.now()}`,
  created_at: now,
  updated_at: now,
  status: 'running',
  current_stage: 'initialized',
  inputs: {
    company_name: body.company_name || body.companyName || body.company || '',
    ticker: body.ticker || body.symbol || '',
    exec_type: body.exec_type || body.executive || '',
    industry: body.industry || '',
    company_type: body.company_type || body.companyType || 'auto',
    expert_pref: body.expert_pref || body.expert || '',
    expert_resolved: body.expert_resolved || null,
    service_provider: body.service_provider || body.my_company || 'MY COMPANY',
    peer_list,
    slide_count: slideCount,
    deck_type: `gamma_${slideCount}_slide_production`,
    gamma_api_enabled: Boolean(body.gamma_api_enabled),
    human_review: Boolean(body.human_review),
    advanced_context: { source_notes: body.source_notes || body.notes || body.urls || '', peers: peer_list },
  },
  entity: null,
  research: {},
  normalized: { periods: [], metrics: {}, gaps: [], reliability_map: {}, formulas: {} },
  sections: {},
  gamma_deck: null,
  delivery: {},
  audit_log: [{ timestamp: now, workflow_name: 'WF_MAIN_PROD', status: 'OK', message: 'Production run initialized with live-data pipeline v2.' }],
};
return [{ json: state }];"""
    set_node_code(wf, 'Initialize Production State', init_code)

    names = {n['name'] for n in wf['nodes']}
    if 'Approval Agent' not in names:
        wf['nodes'].append({
            'id': 'approval_agent',
            'name': 'Approval Agent',
            'type': 'n8n-nodes-base.executeWorkflow',
            'typeVersion': 1.3,
            'position': [3340, 0],
            'parameters': {
                'workflowId': {'__rl': True, 'value': 'tL3TaqFH9zZR0sAo', 'mode': 'id'},
                'workflowInputs': {'mappingMode': 'defineBelow', 'value': {}, 'matchingColumns': [], 'schema': [], 'attemptToConvertTypes': False, 'convertFieldsToString': False},
                'mode': 'each',
            },
        })
    wf['connections']['Value Realization Agent'] = {'main': [[{'node': 'Approval Agent', 'type': 'main', 'index': 0}]]}
    wf['connections']['Approval Agent'] = {'main': [[{'node': 'Assembly QA Agent', 'type': 'main', 'index': 0}]]}
    if 'Assembly QA Agent' in wf['connections'].get('Value Realization Agent', {}).get('main', [[]])[0]:
        pass

    patch_timeouts(wf, 1800)

    finalize = next(n for n in wf['nodes'] if n['name'] == 'Finalize Production Result')
    finalize['parameters']['jsCode'] = finalize['parameters']['jsCode'].replace(
        "gamma_markdown: state.gamma_deck?.gamma_markdown || ''",
        "gamma_markdown: state.gamma_deck?.gamma_markdown || '',\n  final_report_markdown: state.final_report_markdown || ''"
    )


def patch_api_start(wf):
    init = """const input = items[0]?.json || {};
const body = input.body || input;
const now = new Date().toISOString();
const clean = (v) => String(v || '').trim();
const step = clean(body.conversation_step || body.step || 'auto');
const companyName = clean(body.company_name || body.companyName || body.company);
const ticker = clean(body.ticker || body.symbol);
const execType = clean(body.exec_type || body.executive);
const industry = clean(body.industry);
const expertPref = clean(body.expert_pref || body.expert || body.industry_expert);
const serviceProvider = clean(body.service_provider || body.my_company || body.provider_company) || 'MY COMPANY';
const peerListRaw = body.peer_list || body.peers || '';
const peer_list = Array.isArray(peerListRaw) ? peerListRaw : String(peerListRaw || '').split(/[,;\\n|]/).map((s) => s.trim()).filter(Boolean);
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
  return [{ json: { valid: false, accepted: false, status: 'blocked_missing_inputs', conversation_step: 'question_2', missing_inputs: ['exec_type','industry','expert_pref'].filter((f) => !({exec_type: execType, industry, expert_pref: expertPref })[f]), next_question: 'Which C-level executive is this pitch for, what industry is the company in, and which industry expert perspective should I blend with Damodaran?', message: 'Question 2 is required. No analysis will start until executive, industry, and expert are provided.', company_name_received: companyName, ticker_received: ticker, received_at: now } }];
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
  inputs: { company_name: companyName, ticker, exec_type: execType, industry, expert_pref: expertPref, expert_resolved: expertResolved, service_provider: serviceProvider, peer_list, human_review: Boolean(body.human_review) },
};
return [{ json: state }];"""
    set_node_code(wf, 'Initialize Accepted Run', init)


def patch_approval(wf):
    wf['active'] = True
    set_node_code(wf, 'Prepare Human Review Gate', """const state = items[0]?.json?.state || items[0]?.json || {};
const reviewRequired = Boolean(state.inputs?.human_review);
state.approval = {
  required: reviewRequired,
  status: reviewRequired ? 'pending_human_review' : 'auto_approved',
  slack_message_template: reviewRequired ? `Report ready for ${state.inputs?.company_name}. Approve | Request Changes | Reject` : null,
};
state.delivery = state.delivery || {};
state.delivery.status = reviewRequired ? 'pending_approval' : 'approved_for_gamma';
state.audit_log = state.audit_log || [];
state.audit_log.push({ timestamp: new Date().toISOString(), workflow_name: 'WF_APPROVAL', status: reviewRequired ? 'PENDING' : 'SKIPPED', message: reviewRequired ? 'Human review required before external delivery.' : 'Auto-approved.' });
return [{ json: state }];""")


def main():
    patches_order = [
        ('tL3TaqFH9zZR0sAo', patch_approval),
        ('ygI1X49erRcL5Agz', patch_peer_benchmarks),
        ('vgS7dQ1OeCpHpXrU', patch_research_public),
        ('u7zcuTFphfzjenZ0', patch_proposal),
        ('VY5O6pYOMa28iWJb', patch_value_realization),
        ('Hep7G1mvINz1NdqG', patch_assemble_qa),
        ('uCs3FRw2T3nplPIE', patch_financial_snapshot),
        ('RLp9AMthAvTC0iBC', patch_analyze),
        ('0purjOnIMYZOauYb', patch_api_start),
        ('Qc2t6hELYvHMtuox', patch_main_prod),
    ]
    results = []
    for wid, fn in patches_order:
        path = WF_DIR / f'{wid}.json'
        wf = json.loads(path.read_text())
        fn(wf)
        path.write_text(json.dumps(wf, indent=2))
        resp = put_workflow(wf)
        results.append((wf['name'], wid, 'OK', resp.get('updatedAt')))
        print('UPDATED', wf['name'], wid)
        if wid == 'tL3TaqFH9zZR0sAo':
            api('POST', f'/api/v1/workflows/{wid}/activate', {})
            print('ACTIVATED', wf['name'])
    print(json.dumps(results, indent=2))


if __name__ == '__main__':
    main()
