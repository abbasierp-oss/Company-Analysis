import json
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
import sys
sys.path.insert(0, str(ROOT / 'scripts'))

from build_lib import build_financial_lib


class AnnualRevenueAndPeerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.lib = build_financial_lib()

    def _eval(self, expr: str):
        script = """
const lib = require('fs').readFileSync(0, 'utf8');
eval(lib);
const out = %s;
console.log(JSON.stringify(out));
""" % expr
        result = subprocess.run(
            ['node', '-e', script],
            input=self.lib,
            check=True,
            capture_output=True,
            text=True,
            cwd=ROOT,
        )
        return json.loads(result.stdout.strip())

    def test_three_year_revenue_section_title(self):
        state = {
            'entity': {'legal_name': 'Netflix Inc', 'ticker': 'NFLX'},
            'inputs': {'company_name': 'Netflix'},
            'research': {
                'financials': {
                    'merged_facts': {},
                    'fx_to_usd': {'rate': 1},
                    'native_currency': 'USD',
                },
                'filings': {'recent_filings': []},
            },
        }
        out = self._eval(f"buildThreeYearRevenueFrom10K({json.dumps(state)})")
        self.assertIn('3-Year Revenue From 10-Ks', out['markdown'])
        self.assertEqual(out['years'], [2025, 2024, 2023])
        self.assertEqual(len(out['rows']), 3)

    def test_peer_bundle_uses_fallback_for_hbo_max_parent(self):
        out = self._eval("buildPeerAnnualMetricBundle({}, 2025, {rate:1}, 'USD', 'HBO Max', 'Warner Bros. Discovery')")
        self.assertIn('~', out['revenue']['display'])
        self.assertIn('approximation', out['revenue']['display'].lower())

    def test_categorical_peer_row_has_required_fields(self):
        resolved = self._eval("resolveCompetitorEntity('Disney+', 'streaming')")
        bundle = self._eval("buildPeerAnnualMetricBundle({}, 2025, {rate:1}, 'USD', 'Disney+', 'Disney')")
        row = self._eval(
            f"buildCategoricalPeerRow('Disney+', {json.dumps(resolved)}, 'close competitor', 'streaming', {json.dumps(bundle)})"
        )
        for field in ['company_name', 'role', 'latest_annual_revenue', 'operating_margin', 'net_margin', 'fcf_margin', 'revenue_growth', 'source_note']:
            self.assertIn(field, row)
            self.assertTrue(row[field])


if __name__ == '__main__':
    unittest.main()
