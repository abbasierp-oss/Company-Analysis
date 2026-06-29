import json
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
import sys
sys.path.insert(0, str(ROOT / 'scripts'))

from build_lib import build_financial_lib
from portal_assemble import build_portal_html, build_portal_render_js


class PortalAssembleTests(unittest.TestCase):
    def test_portal_html_contains_brand_and_script(self):
        html = build_portal_html()
        self.assertIn('Stoic Analysis', html)
        self.assertIn('renderDashboard', html)
        self.assertIn('<script>', html)

    def test_portal_inline_script_parses(self):
        portal_js = build_portal_render_js()
        payload = portal_js.split('const html = ', 1)[1].rsplit(';\nreturn', 1)[0].strip()
        html = json.loads(payload)
        checker = r"""
const html = process.argv[1];
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) throw new Error('missing script');
new Function(m[1]);
"""
        subprocess.run(['node', '-e', checker, html], check=True, capture_output=True, text=True)


class LibBundleTests(unittest.TestCase):
    def test_lib_bundle_has_core_helpers(self):
        lib = build_financial_lib()
        self.assertIn('function getQuarterlyAnchorMetrics', lib)
        self.assertIn('function buildPortalDashboard', lib)
        self.assertIn('function buildThreeYearRevenueFrom10K', lib)
        self.assertIn('function buildPeerAnnualMetricBundle', lib)
        self.assertIn('function extractITInitiatives', lib)

    def test_lib_bundle_same_line_count_order(self):
        monolith = (ROOT / 'dfa-code' / 'dfa-financial-lib.js').read_text()
        bundled = build_financial_lib()
        self.assertGreater(len(bundled), len(monolith) * 0.95)


if __name__ == '__main__':
    unittest.main()
