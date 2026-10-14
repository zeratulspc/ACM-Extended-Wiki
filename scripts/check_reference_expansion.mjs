import {chromium} from 'playwright';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined});
const page=await browser.newPage({viewport:{width:1905,height:1050},reducedMotion:'reduce'});
const screenshotDir=process.env.WIKI_SCREENSHOT_DIR;
const capture=(locator,name)=>screenshotDir?locator.screenshot({path:resolve(screenshotDir,name)}):Promise.resolve();
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const visit=file=>page.goto(pathToFileURL(resolve(root,'docs',file+'.html')).href);
const loadImages=async selector=>{
 for(const image of await page.locator(selector).all()){
  await image.scrollIntoViewIfNeeded();
  await image.evaluate(async image=>{await image.decode()});
 }
};
try{
 await visit('oxygen');
 const fields=page.locator('[data-do2-calculator] .ref-fields');
 assert.equal(await fields.locator('label > .gl').count(),0,'Glossary terms must stay inside a grouped label caption');
 assert.equal(await fields.locator('label > .ref-label-text').count(),7);
 const positions=await fields.locator('input').evaluateAll(items=>Object.fromEntries(items.map(el=>[el.name,el.getBoundingClientRect().y])));
 assert(Math.abs(positions.blood-positions.heartRate)<1,'Perfusing heart rate input must align with other inputs in its row');
 assert((await fields.locator('label').filter({has:page.locator('[name="heartRate"]')}).textContent()).includes('Perfusing heart rate (BPM)'));
 const heartTerms=await fields.locator('[name="heartRate"]').evaluate(el=>[...el.closest('label').querySelectorAll('.gl')].map(term=>term.getBoundingClientRect().y));
 assert(Math.max(...heartTerms)-Math.min(...heartTerms)<2,'Heart-rate glossary words must not become separate rows');
 await capture(page.locator('[data-do2-calculator]'),'review-calculator-fixed.png');
 const language=page.locator('#wiki-language');
 assert.deepEqual(await language.locator('option').evaluateAll(options=>options.map(option=>option.value)),['en-US','en-GB','ko','de','fr','es','ru']);
 await language.selectOption('en-GB');await page.locator('[data-language-apply]').click();
 assert.equal(await page.locator('html').getAttribute('lang'),'en-GB');
 assert((await page.locator('#spo2-and-poor-perfusion').textContent()).includes('hypovolaemia'));
 await language.selectOption('en-US');await page.locator('[data-language-apply]').click();
 assert.equal(await page.locator('html').getAttribute('lang'),'en-US');
 assert((await page.locator('#spo2-and-poor-perfusion').textContent()).includes('hypovolemia'));
 await language.selectOption('de');assert(await page.locator('[data-language-apply]').isDisabled(),'Local preview must not claim to translate unpublished content');
 assert((await page.locator('[data-language-note]').textContent()).includes('published website'));

 await page.route('https://wiki.example.test/**',route=>{
  const path=new URL(route.request().url()).pathname.slice(1)||'index.html';
  return route.fulfill({path:resolve(root,'docs',path)});
 });
 await page.addInitScript(()=>{window.__opened=[];window.open=(...args)=>{window.__opened.push(args);return null;};});
 await page.goto('https://wiki.example.test/oxygen.html#spo2-and-poor-perfusion');
 for(const locale of ['de','fr','es','ru']){
  await language.selectOption(locale);await page.locator('[data-language-apply]').click();
  const args=await page.evaluate(()=>window.__opened.at(-1));const url=new URL(args[0]);
  assert.equal(url.origin,'https://translate.google.com');assert.equal(url.searchParams.get('tl'),locale);
  assert.equal(url.searchParams.get('u'),'https://wiki.example.test/oxygen.html#spo2-and-poor-perfusion');
  assert(args[2].includes('noopener'));assert.equal(await page.locator('html').getAttribute('lang'),'en-US');
 }
 await language.selectOption('en-GB');await page.locator('[data-language-apply]').click();
 await page.goto('https://wiki.example.test/ventilator.html');
 assert.equal(await language.inputValue(),'en-GB');assert.equal(await page.locator('html').getAttribute('lang'),'en-GB');
 assert(await page.locator('.gl[data-t="vti"]').count()>0);
 assert(await page.locator('.gl[data-t="vte"]').count()>0);
 await page.goto('https://wiki.example.test/circulation.html');
 assert(await page.locator('.gl[data-t="vt"]').count()>0,'VT must retain its ventricular tachycardia definition');
 assert.equal(await page.locator('.gl[data-t="tidal-volume"]').filter({hasText:/^VT$/}).count(),0);

 await visit('airway');
 const capno=page.locator('[data-capnography]');
 assert.equal(await capno.locator('#capno-pattern option').count(),4);
 await capno.locator('#capno-rate').fill('12');await capno.locator('#capno-peak').fill('40');
 await capno.locator('#capno-time').fill('1.3');
 const normal=Number(await capno.locator('[data-capno-dot]').getAttribute('data-co2'));
 assert(normal>35&&normal<=40);
 await capno.locator('#capno-pattern').selectOption('cleft');
 await capno.locator('#capno-severity').fill('100');
 await capno.locator('#capno-time').fill('1.3');
 const cleft=Number(await capno.locator('[data-capno-dot]').getAttribute('data-co2'));
 assert(cleft<normal*.3,'Curare cleft should visibly interrupt the plateau');
 await capno.locator('#capno-pattern').selectOption('flat');
 assert.equal(Number(await capno.locator('[data-capno-dot]').getAttribute('data-co2')),0);
 await capno.locator('#capno-pattern').selectOption('shark');
 await capno.locator('#capno-time').fill('1.3');
 assert(Number(await capno.locator('[data-capno-dot]').getAttribute('data-co2'))>0);
 const svg=capno.locator('[data-capno-wave]');await svg.scrollIntoViewIfNeeded();
 await svg.evaluate(el=>{const b=el.getBoundingClientRect();el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',clientX:b.left+b.width*.5,clientY:b.top+b.height*.5}));el.dispatchEvent(new PointerEvent('pointerleave',{bubbles:true,pointerType:'touch'}));});
 assert(await capno.locator('[data-capno-cursor]').isVisible(),'Touch readout must remain visible after tapping');
 await capture(capno,'review-capnography-expanded.png');
 const suction=await page.locator('.suction-path').evaluate(path=>{
  const length=path.getTotalLength(),start=path.getPointAtLength(0),end=path.getPointAtLength(length);
  const points=Array.from({length:101},(_,i)=>path.getPointAtLength(length*i/100));
  return{start:start.y,end:end.y,width:Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x))};
 });
 assert(suction.start>suction.end,'Suction sweep must travel bottom to top');assert(suction.width>100,'Suction needs horizontal sweeping room');
 await capture(page.locator('.suction-demo'),'review-suction-upward.png');
 for(const width of [390,1905,5120]){
  await page.setViewportSize({width,height:1000});await svg.scrollIntoViewIfNeeded();
  const fit=await svg.evaluate(el=>({width:el.getBoundingClientRect().width,parent:el.parentElement.clientWidth}));
  assert(fit.width<=fit.parent+1,'Capnography time axis must fit at '+width);
 }
 await page.setViewportSize({width:1905,height:1050});await visit('zeus');
 assert.equal(await page.locator('.zeus-screenshot').count(),2);
 await loadImages('.zeus-screenshot');
 assert(await page.locator('.zeus-screenshot').evaluateAll(images=>images.every(image=>image.complete&&image.naturalWidth>0)));
 await capture(page.locator('.zeus-media-grid'),'review-fridge-guide.png');
 await visit('debug');assert.equal(await page.locator('.sec').count(),15);assert(await page.locator('tbody tr').count()>=195);
 await loadImages('img[src="img/debug/debug-menu.png"]');
 assert(await page.locator('img[src="img/debug/debug-menu.png"]').evaluate(image=>image.complete&&image.naturalWidth===1581));
 await capture(page.locator('.sec').first(),'review-debug-reference.png');
 assert.deepEqual(errors,[]);
 console.log('Passed calculator captions, English modes, four live-translation links, VTi/VTe/VT definitions, capnography, upward suction, Zeus screenshots and debug coverage.');
}finally{await browser.close();}
