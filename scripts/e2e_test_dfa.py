#!/usr/bin/env python3
"""End-to-end smoke test for DFA production pipeline."""
import json
import ssl
import time
import urllib.parse
import urllib.request

BASE = 'https://evoloai.app.n8n.cloud/webhook'
CTX = ssl.create_default_context()


def post(path, payload):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(payload).encode(),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    with urllib.request.urlopen(req, context=CTX, timeout=60) as r:
        return json.load(r)


def get(path):
    req = urllib.request.Request(BASE + path, method='GET')
    with urllib.request.urlopen(req, context=CTX, timeout=60) as r:
        return json.load(r)


def main():
    payload = {
        'company_name': 'Microsoft Corporation',
        'ticker': 'MSFT',
        'exec_type': 'CFO',
        'industry': 'Technology',
        'expert_pref': 'pick for me',
        'service_provider': 'Evolo AI',
        'peer_list': 'Apple,Alphabet,Amazon',
    }
    print('Starting run...')
    accepted = post('/dfa-production/start', payload)
    print('Accepted:', json.dumps({k: accepted.get(k) for k in ['accepted', 'run_id', 'status_url', 'result_url']}, indent=2))
    if not accepted.get('accepted'):
        raise SystemExit('Run not accepted: ' + json.dumps(accepted))

    run_id = accepted['run_id']
    status_url = accepted['status_url'].replace(BASE, '')
    result_url = accepted['result_url'].replace(BASE, '')

    for i in range(180):
        status = get(status_url)
        pct = status.get('progress_pct', 0)
        print(f"[{i}] status={status.get('status')} stage={status.get('current_stage')} progress={pct}%")
        if status.get('status') in ('completed', 'completed_with_warnings'):
            break
        if status.get('status') == 'failed':
            raise SystemExit('Run failed: ' + json.dumps(status))
        time.sleep(10)

    result = get(result_url)
    checks = {
        'status_completed': result.get('status') in ('completed', 'completed_with_warnings'),
        'has_company': bool((result.get('company') or {}).get('legal_name')),
        'has_market_cap': bool((result.get('market_data') or {}).get('market_cap_usd')),
        'has_freshness': bool((result.get('data_freshness') or {}).get('fetched_at')),
        'has_full_report': len(result.get('final_report_markdown') or '') > 5000,
        'has_gamma': len(result.get('gamma_markdown') or '') > 500,
        'qa_pass': (result.get('qa') or {}).get('validation_status') in ('PASS', 'WARN'),
        'sections_9': all(
            s in (result.get('final_report_markdown') or '')
            for s in ['Section 1', 'Section 2', 'Section 3', 'Section 4', 'Section 5', 'Section 6', 'Section 7', 'Section 8', 'Section 9']
        ),
    }
    print('\nResult checks:')
    for k, v in checks.items():
        print(f'  {k}: {"PASS" if v else "FAIL"}')
    print('\nSummary:')
    print('  company:', result.get('company', {}).get('legal_name'))
    print('  market_cap:', (result.get('market_data') or {}).get('market_cap_usd'))
    print('  fetched_at:', (result.get('data_freshness') or {}).get('fetched_at'))
    print('  report_len:', len(result.get('final_report_markdown') or ''))
    print('  gamma_len:', len(result.get('gamma_markdown') or ''))
    if not all(checks.values()):
        raise SystemExit('E2E test failed')
    print('\nE2E test PASSED for run', run_id)


if __name__ == '__main__':
    main()
