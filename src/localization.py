"""Build the authored Korean edition from reviewable, source-keyed catalogs.

Only visible text and presentation attributes are translated. IDs, equations,
links, input values and scripts remain structural data. A missing translation
is a build error so source updates cannot silently ship English paragraphs.
"""
import json
import re
from html import escape, unescape
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).parent
CATALOGS = ROOT / 'locales' / 'ko'
ATTRS = {'aria-label', 'title', 'placeholder', 'alt', 'data-mixture-contents', 'data-dose'}
SKIP = {'script', 'style', 'code', 'pre', 'kbd'}


def normalize(text):
    return re.sub(r'\s+', ' ', text).strip()


def load(name):
    file = CATALOGS / (name + '.json')
    return json.loads(file.read_text(encoding='utf-8')) if file.exists() else {}


class Korean:
    def __init__(self, page):
        self.page = page
        self.catalog = {**load('shared'), **load('data'), **load(page)}
        self.missing = set()

    def text(self, text):
        key = normalize(text)
        if not re.search('[A-Za-z]', key):
            return text
        footer = re.fullmatch(r'ACM Extended Wiki / Source build (.*?) / Updated (\d{4}-\d{2}-\d{2})', key)
        if footer:
            translated = f'ACM Extended 위키 / 소스 빌드 {footer[1]} / 갱신일 {footer[2]}'
        else:
            translated = self.catalog.get(key)
        # An explicit empty string intentionally omits English-only grammar
        # (for example an article). Null always means unfinished translation.
        if not isinstance(translated, str):
            self.missing.add(key)
            return text
        # Keep the spaces around inline links, bold text and glossary buttons.
        leading = re.match(r'^\s*', text)[0]
        trailing = re.search(r'\s*$', text)[0]
        # English separates every word; Korean particles attach to the
        # preceding inline link/term. Do not render "가이드 에서".
        if re.match(r'^(?:[,.!?;:]|(?:에서[는도]?|으로[는도]?|은|는|이|가|을|를|의|과|와|도|로|에|에게|까지|부터|이며|이고)(?=\s|[,.!?;:]|$))', translated.lstrip()):
            leading = ''
            translated = translated.lstrip()
        return leading + translated + trailing

    def html(self, html, assets=False):
        parser = TranslateHTML(self, html, assets)
        parser.feed(html)
        return parser.result()

    def check(self):
        if self.missing:
            raise ValueError(f'{self.page}: {len(self.missing)} missing Korean translations:\n' +
                             '\n'.join(sorted(self.missing)))


class TranslateHTML(HTMLParser):
    """Patch source ranges instead of serializing HTML, preserving markup."""
    def __init__(self, locale, source, assets):
        super().__init__(convert_charrefs=True)
        self.locale, self.source, self.assets = locale, source, assets
        self.offsets = [0] + [m.end() for m in re.finditer('\n', source)]
        self.edits = []
        self.skip = []

    def position(self):
        line, col = self.getpos()
        return self.offsets[line - 1] + col

    def handle_starttag(self, tag, attrs):
        if tag in SKIP:
            self.skip.append(tag)
        raw = self.get_starttag_text()
        start = self.position()
        # Attributes are patched within the original tag; JS/data attributes
        # stay untouched except the explicitly declared presentation fields.
        pattern = r'([\w:-]+)(\s*=\s*)([\"\'])(.*?)\3'
        def replace(match):
            key, eq, quote, value = match.groups()
            decoded = unescape(value)
            if not self.skip and key in ATTRS:
                value = escape(self.locale.text(decoded), quote=True)
            elif self.assets and key in {'src', 'href'} and decoded.startswith(('img/', 'audio/')):
                value = '../' + value
            elif key == 'data-mixture-components':
                components = json.loads(decoded)
                for item in components:
                    item['name'] = self.locale.text(item['name'])
                value = escape(json.dumps(components, ensure_ascii=False), quote=True)
            return key + eq + quote + value + quote
        updated = re.sub(pattern, replace, raw, flags=re.S)
        if updated != raw:
            self.edits.append((start, start + len(raw), updated))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if self.skip and tag == self.skip[-1]:
            self.skip.pop()

    def handle_endtag(self, tag):
        if self.skip and tag == self.skip[-1]:
            self.skip.pop()

    def handle_data(self, data):
        if self.skip:
            return
        translated = self.locale.text(data)
        if translated == data:
            return
        start = self.position()
        # convert_charrefs=True supplies decoded text, so find its raw extent
        # at the next tag (entities may have a different source length).
        end = self.source.find('<', start)
        if end < 0:
            end = len(self.source)
        self.edits.append((start, end, escape(translated, quote=False)))

    def result(self):
        value = self.source
        for start, end, replacement in sorted(self.edits, reverse=True):
            value = value[:start] + replacement + value[end:]
        return value


def translate_level_data(html, locale):
    """Translate descriptive JSON fields without changing model inputs."""
    fields = {'medication', 'meaning', 'label', 'detail', 'basis', 'bandNote',
              'modeNote', 'note', 'referenceLabel', 'currentLabel', 'plateauLabel',
              'therapeuticDisplayLabel'}
    def walk(data):
        if isinstance(data, list):
            return [walk(value) for value in data]
        if isinstance(data, dict):
            return {key: locale.text(value) if key in fields and isinstance(value, str)
                    else walk(value) for key, value in data.items()}
        return data
    def sub(match):
        payload = walk(json.loads(match[2]))
        return match[1] + json.dumps(payload, ensure_ascii=False).replace('<', '\\u003c') + match[3]
    return re.sub(r'(<script type="application/json" id="infusion-level-data">)(.*?)(</script>)', sub, html, flags=re.S)
