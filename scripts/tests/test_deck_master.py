import json
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
import sys
sys.path.insert(0, str(ROOT / 'scripts'))

from build_lib import build_financial_lib


class DeckMasterTests(unittest.TestCase):
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

    def test_slide_count_fixed_at_ten(self):
        self.assertEqual(self._eval('normalizeSlideCount(4)'), 10)
        self.assertEqual(self._eval('normalizeSlideCount(10)'), 10)

    def test_footer_master_two_columns(self):
        state = {
            'entity': {'legal_name': 'Netflix Inc', 'ticker': 'NFLX'},
            'inputs': {'company_name': 'Netflix', 'service_provider': 'Evolo AI'},
        }
        pkg = self._eval(f"buildPresentationPackage({json.dumps(state)})")
        footer = pkg['slide_master']['footer']
        self.assertEqual(footer['layout'], 'two_column')
        self.assertEqual(footer['columns'][0]['align'], 'left')
        self.assertEqual(footer['columns'][1]['align'], 'right')
        self.assertEqual(pkg['slide_count'], 10)
        self.assertEqual(len(pkg['slides_json']), 10)

    def test_netflix_logo_resolves(self):
        state = {
            'entity': {'legal_name': 'Netflix Inc', 'ticker': 'NFLX'},
            'inputs': {'company_name': 'Netflix', 'service_provider': 'Evolo AI'},
        }
        logos = self._eval(f"buildPresentationPackage({json.dumps(state)})")['logos']
        self.assertTrue(logos['company']['resolved'])
        self.assertEqual(logos['company']['align'], 'left')
        self.assertEqual(logos['provider']['align'], 'right')


if __name__ == '__main__':
    unittest.main()
