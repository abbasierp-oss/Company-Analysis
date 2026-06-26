#!/usr/bin/env python3
"""Validate foreign issuer (Sony) and domestic issuer (Microsoft) pipeline runs."""
import json
import ssl
import time
import urllib.request

BASE = 'https://evoloai.app.n8n.cloud/webhook'
CTX = ssl.create_default_context()


def post(path, payload):
    req = urllib.request.Request(BASE + path, data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(req, context=CTX, timeout=60) as r:
        return json.load(r)


def get(path, retries=5):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(BASE + path, method='GET')
            with urllib.request.urlopen(req, context=CTX, timeout=60) as r:
                return json.load(r)
        except Exception as e:
            if attempt == retries - 1:
                raise
            time.sleep(8 * (attempt + 1))


def run_case(name, payload, checks):
    print(f'\n=== {name} ===')
    accepted = post('/dfa-production/start', payload)
    if not accepted.get('accepted'):
        raise SystemExit(f'{name} not accepted: {json.dumps(accepted)}')
    run_id = accepted['run_id']
    status_url = accepted['status_url'].replace(BASE, '')
    result_url = accepted['result_url'].replace(BASE, '')
    for i in range(180):
        status = get(status_url)
        if status.get('status') in ('completed', 'completed_with_warnings'):
            break
        if status.get('status') == 'failed':
            raise SystemExit(f'{name} failed: {json.dumps(status)}')
        time.sleep(10)
    result = get(result_url)
    report = result.get('final_report_markdown') or ''
    outcomes = {}
    for key, fn in checks.items():
        try:
            outcomes[key] = bool(fn(result, report))
        except Exception as e:
            outcomes[key] = False
            print(' check error', key, e)
    print('Results:')
    for k, v in outcomes.items():
        print(f'  {k}: {"PASS" if v else "FAIL"}')
    if not all(outcomes.values()):
        raise SystemExit(f'{name} validation failed')
    print(f'{name} PASSED ({run_id})')
    return result


def main():
    sony = run_case('SONY foreign issuer', {
        'company_name': 'Sony Group Corp',
        'ticker': 'SONY',
        'exec_type': 'CIO',
        'industry': 'Gaming',
        'expert_pref': 'pick for me',
        'service_provider': 'AI Mark Labs',
    }, {
        'company': lambda r, rep: 'Sony' in (r.get('company') or {}).get('legal_name', ''),
        'foreign_issuer': lambda r, rep: 'foreign' in rep.lower() or '20-F' in rep or '6-K' in rep,
        'has_revenue': lambda r, rep: 'Revenue' in rep and 'N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A' not in rep.split('Operating Margin')[0],
        'has_filing': lambda r, rep: (r.get('data_freshness') or {}).get('latest_filing_form') in ('6-K', '20-F', '20-F/A'),
        'has_fx': lambda r, rep: bool((r.get('data_freshness') or {}).get('fx_to_usd')),
        'section4': lambda r, rep: 'Section 4' in rep and 'N/A - Claude output unavailable' not in rep,
        'sections9': lambda r, rep: all(s in rep for s in ['Section 1','Section 2','Section 3','Section 4','Section 5','Section 6','Section 7','Section 8','Section 9']),
    })
    print('Sony revenue snippet:', [line for line in (sony.get('final_report_markdown') or '').splitlines() if 'Revenue' in line][:2])

    run_case('MSFT domestic regression', {
        'company_name': 'Microsoft Corporation',
        'ticker': 'MSFT',
        'exec_type': 'CFO',
        'industry': 'Technology',
        'expert_pref': 'pick for me',
        'service_provider': 'Evolo AI',
    }, {
        'company': lambda r, rep: 'MICROSOFT' in (r.get('company') or {}).get('legal_name', '').upper(),
        'market_cap': lambda r, rep: bool((r.get('market_data') or {}).get('market_cap_usd')),
        'revenue': lambda r, rep: '| Revenue |' in rep and any(x in rep.split('| Revenue |',1)[1][:120] for x in ['B USD','M USD','USD']) and 'N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A' not in rep.split('Operating Margin')[0],
        'sections9': lambda r, rep: all(s in rep for s in ['Section 1','Section 2','Section 3','Section 4','Section 5','Section 6','Section 7','Section 8','Section 9']),
    })
    print('\nAll foreign-issuer validations PASSED')


if __name__ == '__main__':
    main()
