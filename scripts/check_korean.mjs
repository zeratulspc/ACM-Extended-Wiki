import assert from 'node:assert/strict';
import {readdir, mkdir, readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

const root = resolve(import.meta.dirname, '..');
const files = (await readdir(resolve(root, 'docs/ko'))).filter(f => f.endsWith('.html'));
assert.equal(files.length, 28);
const output = process.env.WIKI_KOREAN_QA_DIR;
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined});
const visit = (page, file, locale = 'ko') => page.goto(pathToFileURL(resolve(root, 'docs', locale, file)).href);
const errors = [];
try {
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}, reducedMotion: 'reduce'});
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({width, height: 1000});
    for (const file of files) {
      await visit(page, file);
      if (width === 320) await page.evaluate(() => document.querySelectorAll('details').forEach(el => el.open = true));
      assert.equal(await page.locator('html').getAttribute('lang'), 'ko', file);
      assert.equal(await page.locator('#wiki-language').inputValue(), 'ko', file);
      assert.match(await page.locator('h1').textContent(), /[가-힣]/, file);
      assert(await page.locator('.brand-logo').evaluate(el => el.complete && el.naturalWidth > 0), file);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${file} overflow ${width}`);
      const clipped = await page.locator('.main .table-value,.main input,.main select').evaluateAll(nodes => nodes.filter(el => el.clientWidth && el.scrollWidth > el.clientWidth + 2).map(el => el.textContent.trim().slice(0,60)));
      assert.deepEqual(clipped, [], `${file} clipped text at ${width}px`);
      const headings = await page.locator('main h2[id],main h3[data-wiki-nav]').allTextContents();
      assert(headings.every(text => !/Sources and revision|What you see|How systems connect/.test(text)), file);
      assert.deepEqual(await page.evaluate(() => [...(window.ACM_TRANSLATION_MISSING || [])]), [], `${file} runtime translations`);
      const source = await readFile(resolve(root, 'docs', file), 'utf8');
      const translated = await readFile(resolve(root, 'docs/ko', file), 'utf8');
      const ids = text => [...text.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]).sort();
      assert.deepEqual(ids(translated), ids(source), `${file} anchors changed`);
    }
    console.log(`Korean: ${files.length} pages at ${width}px`);
  }
  await page.setViewportSize({width: 1440, height: 1000});
  for (const file of ['access.html','medications.html','ventilator.html','quick-reference.html','debug.html','tbi.html']) {
    await page.setViewportSize({width:390,height:844});
    await visit(page,file);
    await page.evaluate(() => {document.documentElement.style.fontSize='200%';document.querySelectorAll('details').forEach(el=>el.open=true);});
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1),`${file} enlarged Korean text`);
  }
  await page.setViewportSize({width:1440,height:1000});
  await visit(page, 'index.html');
  await page.locator('#q').fill('두부');
  assert(await page.locator('#qr a').count() > 0, 'Korean search must return results');
  assert.match(await page.locator('#qr').textContent(), /두부/);
  await page.locator('#q').fill('뇌');
  assert(await page.locator('#qr a').count() > 0, 'Single-syllable Korean search');
  await page.locator('#q').fill('zzzzzzzzzz');
  assert.match(await page.locator('#qr').textContent(), /검색 결과/);
  await visit(page, 'medications.html');
  await page.locator('main .gl').first().click();
  assert.match(await page.locator('.glpop-d').textContent(), /[가-힣]/, 'Korean glossary popup');
  const mathKo = await page.evaluate(() => ACMEWiki.medicationEffect(10, 30, 0, 300, 'iv'));
  await visit(page, 'medications.html', '');
  assert.equal(await page.evaluate(() => ACMEWiki.medicationEffect(10, 30, 0, 300, 'iv')), mathKo);
  await page.evaluate(() => location.hash = 'd-ketamine');
  await page.locator('#wiki-language').selectOption('ko');
  await Promise.all([page.waitForURL(/\/ko\/medications.html#d-ketamine$/), page.locator('[data-language-apply]').click()]);
  assert.equal(await page.locator('html').getAttribute('lang'), 'ko');
  await page.locator('#wiki-language').selectOption('en-GB');
  await Promise.all([page.waitForURL(/medications.html\?wiki-language=en-GB#d-ketamine$/), page.locator('[data-language-apply]').click()]);
  assert.equal(await page.locator('html').getAttribute('lang'), 'en-GB');
  await page.route('https://**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname.endsWith('.translate.goog')) return route.fulfill({contentType:'text/html',body:await readFile(resolve(root,'docs/medications.html'),'utf8')});
    if (url.hostname === 'hesherson.github.io' && url.pathname.endsWith('/ko/medications.html')) return route.fulfill({contentType:'text/html',body:await readFile(resolve(root,'docs/ko/medications.html'),'utf8')});
    return route.abort();
  });
  await page.goto('https://hesherson-github-io.translate.goog/ACM-Extended-Wiki/medications.html?_x_tr_tl=de#d-ketamine');
  await page.locator('#wiki-language').selectOption('ko');
  await Promise.all([page.waitForURL('https://hesherson.github.io/ACM-Extended-Wiki/ko/medications.html#d-ketamine'), page.locator('[data-language-apply]').click()]);
  assert.equal(await page.locator('html').getAttribute('lang'),'ko','Manual Korean edition must leave Google proxy');
  await visit(page, 'access.html');
  const drip = await page.evaluate(() => ACMEWiki.calculateDrip({position:50,dropSet:60,maximum:180,curve:2,volume:250,concentration:0.01}));
  assert.equal(drip.rate, 0.75);
  assert.match(await page.locator('[data-infusion-count]').textContent(), /지속 주입/);
  for (const option of await page.locator('[data-level-drug] option').evaluateAll(options => options.map(o => o.value))) {
    await page.locator('[data-level-drug]').selectOption(option);
    assert.match(await page.locator('[data-level-meaning]').textContent(), /[가-힣]/, `${option} meaning`);
    assert.match(await page.locator('[data-level-reference-label]').textContent(), /[가-힣]/, `${option} reference label`);
  }
  await page.locator('[data-level-drug]').selectOption('amiodarone');
  assert.match(await page.locator('[data-level-readout]').textContent(), /실제 유입/);
  await page.locator('[data-level-rate]').fill('-1');
  assert.match(await page.locator('[data-level-error]').textContent(), /전달 속도/);
  await page.locator('[data-level-rate]').fill('15');
  await page.locator('[data-mixture-picker]').selectOption('ketofol');
  assert.match(await page.locator('[data-mixture-step-count]:visible').textContent(), /단계/);
  await visit(page, 'airway.html');
  assert.match(await page.locator('[data-seal-readout]').first().textContent(), /밀봉재/);
  await page.locator('[data-seal-position]').first().fill('3');
  assert.match(await page.locator('[data-seal-readout]').first().textContent(), /3\/5/);
  assert.match(await page.locator('[data-capno-help]').textContent(), /[가-힣]/);
  await visit(page, 'circulation.html');
  await page.locator('[data-rhythm-time]').first().fill('1');
  assert.match(await page.locator('[data-rhythm-readout]').first().textContent(), /시간/);
  assert.deepEqual(await page.evaluate(() => [...(window.ACM_TRANSLATION_MISSING || [])]), []);
  const noJS = await browser.newPage({javaScriptEnabled:false, viewport:{width:390,height:844}});
  for (const file of files) {
    await visit(noJS, file);
    assert.match(await noJS.locator('h1').textContent(), /[가-힣]/);
    assert.equal(await noJS.locator('.edition-link').getAttribute('href'), '../' + file);
    assert(await noJS.locator('main').textContent(), file + ' no-JS content');
  }
  if (output) {
    await mkdir(output,{recursive:true});
    for (const file of ['index.html','access.html','medications.html','ventilator.html','quick-reference.html']) {
      await visit(page,file);
      await page.screenshot({path:resolve(output,file.replace('.html','-desktop.png'))});
      await page.setViewportSize({width:390,height:844});
      await page.screenshot({path:resolve(output,file.replace('.html','-mobile.png'))});
      await page.setViewportSize({width:1440,height:1000});
    }
    await visit(page,'quick-reference.html');
    await page.pdf({path:resolve(output,'korean-charts.pdf'),format:'A4',landscape:true,printBackground:true});
    await page.emulateMedia({media:'print'});
    await page.screenshot({path:resolve(output,'korean-charts-print.png'),fullPage:true});
  }
  assert.deepEqual(errors,[]);
  console.log('Korean language switching, anchors, search, glossary, runtime controls, arithmetic and no-JS checks passed.');
} finally {
  await browser.close();
}
