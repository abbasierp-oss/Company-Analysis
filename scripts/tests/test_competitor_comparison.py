import json
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
import sys
sys.path.insert(0, str(ROOT / 'scripts'))

from build_lib import build_financial_lib


class CompetitorResolutionTests(unittest.TestCase):
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

    def test_resolves_hbo_max_to_wbd(self):
        out = self._eval("resolveCompetitorEntity('HBO Max', 'streaming media')")
        self.assertEqual(out['entered_name'], 'HBO Max')
        self.assertIn('Warner Bros. Discovery', out['resolved_label'])
        self.assertEqual(out['parent_company'], 'Warner Bros. Discovery')
        self.assertEqual(out['category'], 'streaming')
        self.assertEqual(out['sec_lookup_name'], 'Warner Bros. Discovery')

    def test_resolves_disney_plus(self):
        out = self._eval("resolveCompetitorEntity('Disney+', 'streaming')")
        self.assertEqual(out['entered_name'], 'Disney+')
        self.assertIn('Disney', out['resolved_label'])
        self.assertEqual(out['sec_lookup_name'], 'Disney')

    def test_build_comparison_extracts_subscribers(self):
        state = {
            'inputs': {'industry': 'streaming media', 'source_notes': ''},
            'research': {
                'news_events': [{
                    'title': 'Disney+ subscribers',
                    'description': (
                        'Disney+ reached 150 million paid subscribers with ARPU of $7.50 per month '
                        'and an ad-supported tier.'
                    ),
                }],
            },
        }
        state_json = json.dumps(state)
        out = self._eval(f"buildCompetitorComparisons({state_json}, 'Netflix', ['Disney+', 'HBO Max'])")
        self.assertEqual(out['category'], 'streaming')
        self.assertGreaterEqual(len(out['rows']), 3)
        disney = next(r for r in out['rows'] if r['entered_name'] == 'Disney+')
        self.assertIn('Disney', disney['resolved_label'])
        self.assertNotEqual(disney['metrics']['subscribers'], 'N/A')

    def test_na_when_no_source_signal(self):
        state = {'inputs': {'industry': 'streaming'}, 'research': {'news_events': []}}
        out = self._eval(f"buildCompetitorComparisons({json.dumps(state)}, 'Netflix', ['Peacock'])")
        peacock = next(r for r in out['rows'] if r['entered_name'] == 'Peacock')
        self.assertEqual(peacock['resolved_label'], 'Peacock (NBCUniversal / Comcast)')
        self.assertEqual(peacock['metrics']['subscribers'], 'N/A')


if __name__ == '__main__':
    unittest.main()
