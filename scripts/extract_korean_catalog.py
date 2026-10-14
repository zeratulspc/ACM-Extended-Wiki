#!/usr/bin/env python3
"""Refresh Korean source catalogs without overwriting existing translations."""
import json
import re
import subprocess
import sys
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOGS = ROOT / 'src' / 'locales' / 'ko'
ATTRS = {'aria-label', 'title', 'placeholder', 'alt', 'data-mixture-contents', 'data-dose'}
SKIP = {'script', 'style', 'code', 'pre', 'kbd'}


def normalize(text):
    return re.sub(r'\s+', ' ', text).strip()


class Texts(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.skip = []
        self.texts = set()

    def add(self, text):
        value = normalize(text)
        if re.search('[A-Za-z]', value):
            self.texts.add(value)

    def handle_starttag(self, tag, attrs):
        if tag in SKIP:
            self.skip.append(tag)
        if not self.skip:
            for key, value in attrs:
                if key in ATTRS and value:
                    self.add(value)

    def handle_endtag(self, tag):
        if self.skip and tag == self.skip[-1]:
            self.skip.pop()

    def handle_data(self, data):
        if not self.skip:
            self.add(data)


def save(name, sources):
    path = CATALOGS / (name + '.json')
    old = json.loads(path.read_text()) if path.exists() else {}
    # Build dates are supplied by the builder, never translated as fixed strings.
    sources = {s for s in sources if not re.match(r'ACM Extended Wiki / Source build .* / Updated \d', s)}
    known = {}
    for file in CATALOGS.glob('*.json'):
        known.update({key: value for key, value in json.loads(file.read_text()).items() if value is not None})
    # Keep explicit extra keys (for example the Korean edition's return link)
    # and reuse already reviewed translations of identical source phrases.
    values = {s: old.get(s, known.get(s)) for s in sorted(sources | old.keys())}
    path.write_text(json.dumps(values, ensure_ascii=False, indent=2) + '\n')


def main():
    subprocess.run([sys.executable, str(ROOT / 'build.py'), '--english-only'], check=True)
    CATALOGS.mkdir(parents=True, exist_ok=True)
    pages = {}
    for file in sorted((ROOT / 'docs').glob('*.html')):
        parser = Texts()
        parser.feed(file.read_text())
        pages[file.stem] = parser.texts
    counts = Counter(s for values in pages.values() for s in values)
    shared = {s for s, n in counts.items() if n >= 8}
    save('shared', shared)
    for name, texts in pages.items():
        save(name, texts - shared)
    print('Catalogs:', len(pages), 'pages;', len(counts), 'unique strings')


if __name__ == '__main__':
    main()
