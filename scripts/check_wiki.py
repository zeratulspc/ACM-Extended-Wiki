#!/usr/bin/env python3
"""Check navigation and compare output with an independent build, including ZIP copies."""
from html.parser import HTMLParser
from pathlib import Path
import json
import re
import subprocess
import tempfile
import shutil
import sys
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
VOID_TAGS = set("area base br col embed hr img input link meta param source track wbr".split())

class Page(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.ids = set()
        self.duplicates = []
        self.links = []
        self.article_stack = []
        self.structure_errors = []
        self.main_count = 0
        self.feed(text)
        if self.main_count != 1 or self.article_stack:
            self.structure_errors.append("Article must have one fully closed main element")

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if "id" in values:
            value = values["id"]
            if value in self.ids:
                self.duplicates.append(value)
            self.ids.add(value)
        for name in ("href", "src"):
            if name in values:
                self.links.append(values[name])
        if tag == "main":
            self.main_count += 1
        if tag == "main" or self.article_stack:
            if tag == "details" and "source-details" in values.get("class", "").split():
                if "details" in self.article_stack:
                    self.structure_errors.append("Source notes must not create nested disclosures")
            if tag not in VOID_TAGS:
                self.article_stack.append(tag)

    def handle_endtag(self, tag):
        if not self.article_stack or tag in VOID_TAGS:
            return
        if self.article_stack[-1] == tag:
            self.article_stack.pop()
            return
        self.structure_errors.append(
            f"Line {self.getpos()[0]}: </{tag}> crosses unclosed <{self.article_stack[-1]}>"
        )
        if tag in self.article_stack:
            while self.article_stack.pop() != tag:
                pass

def normalize(text):
    # Build dates and JSON object ordering are not content changes.
    text = re.sub(r"Updated \d{4}-\d{2}-\d{2}", "Updated DATE", text)
    text = re.sub(r"갱신일 \d{4}-\d{2}-\d{2}", "갱신일 DATE", text)
    def data(match):
        return "var " + match.group(1) + "=" + json.dumps(
            json.loads(match.group(2)), ensure_ascii=True, sort_keys=True,
            separators=(",", ":")
        ) + ";"
    return re.sub(r"var (TERMS|IDX)=(.*);", data, text)

pages = {path.relative_to(DOCS).as_posix(): Page(path.read_text(encoding="utf-8"))
         for path in DOCS.rglob("*.html")}
errors = []
expected = set(re.findall(r'^    \("[^"]+", "([^"]+)"', (ROOT / "build.py").read_text(), re.M))
expected |= {'ko/' + filename for filename in tuple(expected)}
if set(pages) != expected:
    errors.append("Generated page set differs from build.py: " + str(set(pages) ^ expected))
for filename, page in pages.items():
    errors.extend(f"{filename}: duplicate id {value}" for value in page.duplicates)
    errors.extend(f"{filename}: {value}" for value in page.structure_errors)
    for href in page.links:
        url = urlsplit(href)
        if url.scheme or url.netloc:
            continue
        target = ((DOCS / filename).parent / unquote(url.path)).resolve() if url.path else (DOCS / filename).resolve()
        path = target.relative_to(DOCS.resolve()).as_posix() if target.is_relative_to(DOCS.resolve()) else ''
        if not target.is_relative_to(DOCS.resolve()):
            errors.append(f"{filename}: reference escapes docs: {href}")
        elif not target.is_file():
            errors.append(f"{filename}: missing target {href}")
        elif url.fragment and path in pages and unquote(url.fragment) not in pages[path].ids:
            errors.append(f"{filename}: missing anchor {href}")

with tempfile.TemporaryDirectory(prefix="acme-wiki-check-") as scratch:
    clean = Path(scratch)
    shutil.copytree(ROOT / "src", clean / "src")
    shutil.copy2(ROOT / "build.py", clean / "build.py")
    subprocess.run([sys.executable, str(clean / "build.py")], cwd=clean,
                   check=True, capture_output=True, text=True)
    for filename in expected:
        generated = DOCS / filename
        if generated.is_file() and normalize(generated.read_text(encoding="utf-8")) != normalize(
                (clean / "docs" / filename).read_text(encoding="utf-8")):
            errors.append(f"{filename}: generated output is stale; run build.py")

if errors:
    raise SystemExit("\n".join(errors))
print(f"Checked {len(pages)} pages: article structure, source disclosures, generated content, IDs, local links and assets match.")
