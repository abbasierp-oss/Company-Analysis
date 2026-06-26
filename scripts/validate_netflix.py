#!/usr/bin/env python3
"""Validate Netflix report structure: anchored tables, USD-only, market data separation."""
import json
import re
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


def run_netflix():
    print('\n=== NFLX report structure ===')
    accepted = post('/dfa-production/start', {
        'company_name': 'Netflix Inc',
        'ticker': 'NFLX',
        'exec_type': 'CEO',
        'industry': 'Media',
        'expert_pref': 'pick for me',
        'service_provider': 'AI Mark Labs',
    })
    if not accepted.get('accepted'):
        raise SystemExit(f'Not accepted: {json.dumps(accepted)}')
    run_id = accepted['run_id']
    status_url = accepted['status_url'].replace(BASE, '')
    result_url = accepted['result_url'].replace(BASE, '')
    for _ in range(180):
        status = get(status_url)
        if status.get('status') in ('completed', 'completed_with_warnings'):
            break
        if status.get('status') == 'failed':
            raise SystemExit(f'Run failed: {json.dumps(status)}')
        time.sleep(10)
    result = get(result_url)
    report = result.get('final_report_markdown') or ''
    freshness = result.get('data_freshness') or {}

    checks = {
        'section_2a_quarterly': 'Section 2a: Quarterly Financials' in report,
        'section_2b_annual': 'Section 2b: Annual Financials' in report,
        'section_2c_market': 'Section 2c: Market Data' in report,
        'reporting_period_column': 'Reporting Period' in report,
        'usd_only_header': 'Currency: USD' in report,
        'no_native_currency_in_s1': 'Native reporting currency' not in report.split('Section 2')[0],
        'quarterly_anchor_10q': freshness.get('quarterly_anchor_form') in ('10-Q', '6-K') or '10-Q' in report,
        'annual_anchor_10k': freshness.get('annual_anchor_form') in ('10-K', '20-F') or '10-K' in report,
        'market_cap_in_market_section': bool(re.search(r'Section 2c: Market Data[\s\S]*Market Cap', report)),
        'no_market_cap_in_quarterly': 'Market Cap' not in report.split('Section 2b')[0].split('Section 2a')[1] if 'Section 2a' in report and 'Section 2b' in report else True,
        'peer_direct_only': 'direct tags only' in report.lower() or 'N/A' in report.split('Section 3')[1][:2000] if 'Section 3' in report else True,
        'warner_flag_or_netflix_q1': (
            'Warner Bros' in report
            or 'termination fee' in report.lower()
            or 'Q1' in report
        ),
    }

    print('Results:')
    for k, v in checks.items():
        print(f'  {k}: {"PASS" if v else "FAIL"}')
    if not all(checks.values()):
        print('\nReport excerpt (Section 2):')
        start = report.find('Section 2a')
        print(report[start:start + 2500] if start >= 0 else report[:2500])
        raise SystemExit('Netflix validation failed')
    print(f'Netflix PASSED ({run_id})')
    return result


if __name__ == '__main__':
    run_netflix()
