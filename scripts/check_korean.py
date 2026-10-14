#!/usr/bin/env python3
"""Translation coverage, numeric conservation and unchanged model checks."""
import json
import re
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
errors = []
count = 0
for path in sorted((ROOT / 'src/locales/ko').glob('*.json')):
    for source, translated in json.loads(path.read_text(encoding='utf-8')).items():
        count += 1
        if not isinstance(translated, str):
            errors.append(f'{path.name}: unfinished translation: {source}')
            continue
        numbers = lambda value: Counter(re.findall(r'\d+(?:\.\d+)?', value))
        if numbers(source) - numbers(translated):
            errors.append(f'{path.name}: missing source number: {source}')
        placeholders = lambda value: Counter(re.findall(r'\{\d+\}', value))
        if placeholders(source) != placeholders(translated):
            errors.append(f'{path.name}: changed runtime placeholders: {source}')


class Structure(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.tags = []
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        # These attributes drive controls, link targets and numerical models;
        # Korean must retain them exactly. Descriptive data-dose is excluded.
        self.tags.append((tag, {key: value for key, value in attrs if key in
            {'id', 'type', 'min', 'max', 'step', 'value', 'viewbox', 'd', 'points'}
            or key.startswith('data-') and key not in
            {'data-dose', 'data-mixture-components', 'data-mixture-contents',
             'data-edition', 'data-english-url', 'data-korean-url'}}))


def model(html):
    match = re.search(r'<script type="application/json" id="infusion-level-data">(.*?)</script>', html, re.S)
    if not match:
        return None
    display = {'medication','meaning','label','detail','basis','bandNote','modeNote','note',
               'referenceLabel','currentLabel','plateauLabel','therapeuticDisplayLabel'}
    def strip(value):
        if isinstance(value, dict):
            return {key: strip(v) for key, v in value.items() if key not in display}
        if isinstance(value, list):
            return [strip(v) for v in value]
        return value
    return strip(json.loads(match[1]))


files = sorted((ROOT / 'docs').glob('*.html'))
assert len(files) == 28
for file in files:
    english = file.read_text(encoding='utf-8')
    korean = (ROOT / 'docs/ko' / file.name).read_text(encoding='utf-8')
    if Structure(english).tags != Structure(korean).tags:
        errors.append(f'{file.name}: changed markup, control or chart/model attributes')
    if model(english) != model(korean):
        errors.append(f'{file.name}: changed infusion model inputs')
    scripts = lambda text: re.findall(r'<script>(.*?)</script>', text, re.S)[-1]
    def execution(text):
        return re.sub(r'var (?:ACM_MESSAGES|TERMS|IDX)=.*?;\n', '', scripts(text))
    if execution(english) != execution(korean):
        errors.append(f'{file.name}: editions have different execution logic')

if errors:
    raise SystemExit('\n'.join(errors))
print(f'Checked {count} catalog entries and {len(files)} page pairs: translations, source numbers, placeholders, markup and model inputs preserved.')
