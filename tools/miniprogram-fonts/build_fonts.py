"""Builds the mini program's two bundled font subsets.

  python3 tools/miniprogram-fonts/build_fonts.py <LXGWWenKai-Regular.ttf> <SourceSerif4Variable-Roman font>

Snowlit Kai (LXGW WenKai, OFL) carries only the characters of headings whose text is fixed at build
time: elements with the `snowlit-kai` class whose text is static, plus EXTRA_KAI_TEXT for the few
bound headings with a known set of values. Snowlit Serif (Source Serif 4, OFL) carries Latin letters,
digits and a few marks for the wordmark, counts and dates. Everything else uses the system font.

Outputs (base64 WOFF inside WXSS, the format WeChat loads without a download domain):
  miniprogram/assets/fonts/snowlit-kai.wxss, snowlit-kai.chars.txt, snowlit-serif.wxss
Rerun after adding or changing a `snowlit-kai` heading; tests/fonts.test.js fails until you do.
"""
import base64
import io
import re
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parents[2] / 'miniprogram'
FONTS = ROOT / 'assets' / 'fonts'

# Bound headings that use the Kai face, with every value they can take.
EXTRA_KAI_TEXT = ['上午好']

SERIF_TEXT = ''.join(chr(code) for code in range(0x20, 0x7f)) + '·°—–‘’“”…'

KAI_ELEMENT = re.compile(r'class="[^"]*\bsnowlit-kai\b[^"]*"[^>]*>([^<]*)<')


def kai_characters():
    chars = set(''.join(EXTRA_KAI_TEXT))
    for path in sorted(ROOT.glob('pages/*/index.wxml')) + sorted(ROOT.glob('components/*/index.wxml')):
        for text in KAI_ELEMENT.findall(path.read_text(encoding='utf-8')):
            if '{{' not in text:
                chars.update(text.strip())
    return ''.join(sorted(ch for ch in chars if not ch.isspace()))


def rename(font, family):
    """OFL: a modified (subset) font must not keep its Reserved Font Name as its own name."""
    names = font['name']
    keep = {0, 13, 14}
    old_family = names.getDebugName(16) or names.getDebugName(1) or ''
    old_postscript = (names.getDebugName(6) or '').split('-')[0]
    for record in names.names:
        if record.nameID >= 256:
            value = record.toUnicode()
            if old_postscript:
                value = value.replace(old_postscript, family.replace(' ', ''))
            if old_family:
                value = value.replace(old_family, family)
            record.string = value
    # Axis and instance names (256+) stay: variation tables point at them.
    names.names = [record for record in names.names if record.nameID in keep or record.nameID >= 256]
    for name_id, value in {1: family, 2: 'Regular', 3: f'{family};subset', 4: family, 6: family.replace(' ', '-')}.items():
        names.setName(value, name_id, 3, 1, 0x409)
        names.setName(value, name_id, 1, 0, 0)


def subset_font(font, text, features, family):
    rename(font, family)
    options = subset.Options()
    options.flavor = 'woff'
    options.layout_features = features
    options.name_IDs = ['*']
    options.notdef_outline = True
    subsetter = subset.Subsetter(options)
    subsetter.populate(text=text)
    subsetter.subset(font)
    buffer = io.BytesIO()
    font.flavor = 'woff'
    font.save(buffer)
    return buffer.getvalue()


def write_face(name, family, data, weight):
    encoded = base64.b64encode(data).decode('ascii')
    (FONTS / name).write_text(
        '@font-face {\n'
        f'  font-family: "{family}";\n'
        f'  src: url(data:application/font-woff;charset=utf-8;base64,{encoded}) format("woff");\n'
        f'  font-weight: {weight};\n'
        '  font-style: normal;\n'
        '}\n',
        encoding='utf-8',
    )
    return len(data)


def main(kai_path, serif_path):
    chars = kai_characters()
    kai = subset_font(TTFont(kai_path), chars, ['kern', 'locl', 'vert'], 'Snowlit Kai')
    (FONTS / 'snowlit-kai.chars.txt').write_text(chars + '\n', encoding='utf-8')
    kai_size = write_face('snowlit-kai.wxss', 'Snowlit Kai', kai, '400')

    serif_font = instancer.instantiateVariableFont(TTFont(serif_path), {'wght': (400, 600), 'opsz': (8, 60)})
    serif = subset_font(serif_font, SERIF_TEXT, ['kern', 'liga', 'tnum', 'lnum', 'case'], 'Snowlit Serif')
    serif_size = write_face('snowlit-serif.wxss', 'Snowlit Serif', serif, '400 600')

    print(f'Snowlit Kai: {len(chars)} characters, {kai_size} bytes; Snowlit Serif: {serif_size} bytes')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
