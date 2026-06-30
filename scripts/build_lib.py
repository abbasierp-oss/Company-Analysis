"""Build bundled dfa-financial-lib.js from ordered lib modules."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CODE = ROOT / 'dfa-code'
LIB_PARTS = sorted((CODE / 'lib').glob('*.js'))


def build_financial_lib() -> str:
    chunks = [path.read_text().strip() for path in LIB_PARTS]
    return '\n\n'.join(chunk for chunk in chunks if chunk) + '\n'


def write_financial_lib(out_path: Path | None = None) -> str:
    code = build_financial_lib()
    target = out_path or (CODE / 'dfa-financial-lib.js')
    target.write_text(code)
    return code


if __name__ == '__main__':
    write_financial_lib()
    print('Wrote', CODE / 'dfa-financial-lib.js')
