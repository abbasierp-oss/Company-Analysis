import json
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
import sys
sys.path.insert(0, str(ROOT / 'scripts'))

from build_lib import build_financial_lib


class OrgCxoIntelTests(unittest.TestCase):
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

    def test_netflix_org_has_verified_ceo_cfo(self):
        state = {
            'entity': {'legal_name': 'Netflix Inc', 'ticker': 'NFLX'},
            'inputs': {'company_name': 'Netflix', 'exec_type': 'CFO'},
            'research': {'news_events': []},
        }
        out = self._eval(f"buildOrgCxoIntel({json.dumps(state)})")
        names = [n['name'] for n in out['org_structure']['nodes']]
        self.assertIn('Spence Neumann', names)
        self.assertIn('Ted Sarandos', names)

    def test_cxo_intel_for_selected_exec(self):
        state = {
            'entity': {'legal_name': 'Netflix Inc', 'ticker': 'NFLX'},
            'inputs': {'company_name': 'Netflix', 'exec_type': 'CFO'},
            'research': {'news_events': []},
        }
        out = self._eval(f"buildOrgCxoIntel({json.dumps(state)})")
        cxo = out['cxo_intel']
        self.assertEqual(cxo['exec_type'], 'CFO')
        self.assertEqual(cxo['name'], 'Spence Neumann')
        self.assertIn('Finance', cxo['functional_area'])

    def test_unknown_when_no_verified_data(self):
        state = {
            'entity': {'legal_name': 'Obscure Corp', 'ticker': 'ZZZZ'},
            'inputs': {'company_name': 'Obscure Corp', 'exec_type': 'CIO'},
            'research': {'news_events': []},
        }
        out = self._eval(f"buildOrgCxoIntel({json.dumps(state)})")
        self.assertEqual(out['cxo_intel']['name'], 'Unknown')


if __name__ == '__main__':
    unittest.main()
