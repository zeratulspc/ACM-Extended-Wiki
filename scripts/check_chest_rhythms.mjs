import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined });
const errors = [];
const monitor = page => page.on('pageerror', error => errors.push(page.url() + ': ' + error.message));
const visit = (page, file) => page.goto(pathToFileURL(resolve(root, 'docs', file)).href);
const rhythmNames = [
  'sinus', 'sinus-bradycardia', 'sinus-tachycardia', 'atrial-fibrillation',
  'afib-rvr', 'atrial-tachycardia', 'svt', 'vt-with-pulse', 'pulseless-vt',
  'vf', 'torsades', 'pea', 'asystole'
];

async function checkStaticStrips(page) {
  const strips = page.locator('.rhythm-monitor[data-rhythm]');
  assert.deepEqual(await strips.evaluateAll(elements => elements.map(element => element.dataset.rhythm)), rhythmNames,
    'Every documented rhythm needs its own monitor example');
  for (const strip of await strips.all()) {
    const name = await strip.getAttribute('data-rhythm');
    const trace = strip.locator('.rhythm-trace');
    assert(await trace.isVisible(), name + ': trace must remain visible');
    assert.equal(await trace.evaluate(element => getComputedStyle(element).stroke), 'rgb(0, 255, 0)',
      name + ': use the source monitor green');
    const geometry = await trace.evaluate(element => ({
      points: element.points.numberOfItems,
      length: element.getTotalLength(),
      finite: Array.from(element.points).every(point => Number.isFinite(point.x) && Number.isFinite(point.y))
    }));
    assert.equal(geometry.points, 201, name + ': retain the full six second trace');
    assert(geometry.finite && geometry.length > 0, name + ': geometry must be usable without JavaScript');
    assert.equal(await strip.locator('.rhythm-axis > span').count(), 7, name + ': retain readable time labels');
    assert(await strip.locator('svg title').textContent(), name + ': missing accessible title');
    assert.match(await strip.locator('figcaption').textContent(), /relative|calibrat/i,
      name + ': vertical display offsets must not imply a calibrated mV measurement');
  }
}

try {
  const motion = await browser.newPage({ viewport: { width: 1905, height: 1000 }, reducedMotion: 'no-preference' });
  monitor(motion);
  const start = new Date('2026-09-14T12:00:00Z');
  await motion.clock.install({ time: start });
  await motion.clock.pauseAt(new Date(start.getTime() + 1000));
  await visit(motion, 'airway.html');
  const demo = motion.locator('[data-chest-seal-demo]');
  const toggle = demo.locator('[data-seal-toggle]');
  const replay = demo.locator('[data-seal-replay]');
  const slider = demo.locator('[data-seal-position]');
  const frame = () => demo.getAttribute('data-seal-frame').then(Number);
  await demo.locator('[data-seal-stage]').scrollIntoViewIfNeeded();
  await motion.waitForTimeout(80); // IntersectionObserver is delivered by the browser, outside the virtual clock.
  assert.equal(await demo.locator('[data-seal-image]').count(), 11);
  await demo.locator('[data-seal-image]').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  assert.equal(await toggle.textContent(), 'Pause animation');

  await replay.click();
  await motion.clock.runFor(1900);
  assert(await frame() > 1 && await frame() < 4, 'The seal should be partway through the eased lift');
  const blending = await demo.locator('[data-seal-image]').evaluateAll(images =>
    images.map(image => Number(image.style.opacity)).filter(opacity => opacity > 0));
  assert.equal(blending.length, 2, 'An intermediate lift should crossfade two adjacent original frames');
  assert(Math.abs(blending.reduce((sum, opacity) => sum + opacity, 0) - 1) < .00001,
    'Crossfade opacity should sum to one, without retaining the prior transparent edges');
  assert.notEqual(await demo.locator('[data-seal-readout]').textContent(), 'Full lift',
    'A partial lift must not be presented as a completed burp');
  await toggle.click();
  const heldLift = await frame();
  await motion.clock.runFor(1000);
  assert.equal(await frame(), heldLift, 'Pause must preserve the current lifted frame');
  await toggle.click();
  await motion.clock.runFor(100);
  assert(await frame() >= heldLift && await frame() - heldLift < .6, 'Resume must continue the lift without a jump');

  await replay.click();
  await motion.clock.runFor(3000);
  assert.equal(await frame(), 5);
  assert.equal(await demo.locator('[data-seal-readout]').textContent(), 'Full lift');
  await motion.clock.runFor(2000);
  assert(await frame() > 0 && await frame() < 5, 'The seal should be returning to flat');
  await toggle.click();
  const heldReturn = await frame();
  await motion.clock.runFor(700);
  assert.equal(await frame(), heldReturn);
  await toggle.click();
  await motion.clock.runFor(100);
  assert(await frame() < heldReturn && heldReturn - await frame() < .6,
    'Resume during reseating must keep lowering the corner, without reversing direction');

  await slider.fill('5');
  assert.equal(await frame(), 5);
  assert.equal(await toggle.textContent(), 'Play animation', 'Manual inspection should pause the animation');
  await demo.locator('[data-seal-corner]').selectOption('left');
  assert.equal(await demo.locator('[data-seal-image="5"][data-corner="left"]').evaluate(image => image.style.opacity), '1');
  assert.equal(await demo.locator('[data-seal-image="5"][data-corner="right"]').evaluate(image => image.style.opacity), '0');
  await slider.fill('2');
  assert.equal(await frame(), 2);
  await toggle.click();
  await motion.clock.runFor(100);
  assert(await frame() >= 2 && await frame() < 2.6, 'Resume after seeking must account for easing');
  await motion.evaluate(() => window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
  await motion.waitForTimeout(80);
  const offscreen = await frame();
  await motion.clock.runFor(2000);
  assert.equal(await frame(), offscreen, 'An offscreen demonstration should pause');
  console.log('Chest seal lift, return, pause/resume, full-lift cue, corner selection, seek and offscreen pause passed');

  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  monitor(page);
  await visit(page, 'airway.html');
  assert(await page.locator('[data-seal-toggle]').isDisabled(), 'Reduced motion must prevent automatic playback');
  assert(await page.locator('[data-seal-replay]').isDisabled());
  await page.locator('[data-seal-position]').fill('5');
  assert.equal(await page.locator('[data-chest-seal-demo]').getAttribute('data-seal-frame'), '5.000');
  await page.waitForTimeout(150);
  assert.equal(await page.locator('[data-chest-seal-demo]').getAttribute('data-seal-frame'), '5.000',
    'Manual frame inspection remains available with reduced motion');

  await visit(page, 'circulation.html');
  await checkStaticStrips(page);
  for (const strip of await page.locator('.rhythm-monitor[data-rhythm]').all()) {
    const name = await strip.getAttribute('data-rhythm');
    const control = strip.locator('[data-rhythm-time]');
    await control.fill('2.37');
    assert.match(await strip.locator('[data-rhythm-readout]').textContent(), /Time: 2\.37 s/);
    assert.match(await strip.locator('[data-rhythm-readout]').textContent(), /relative units/);
    const error = await strip.evaluate(element => {
      // Compare the hover dot with the separately stored, static SVG trace at the same sample.
      const point = element.querySelector('.rhythm-trace').points.getItem(79);
      const dot = element.querySelector('.rhythm-dot');
      return Math.hypot(Number(dot.getAttribute('cx')) - point.x, Number(dot.getAttribute('cy')) - point.y);
    });
    assert(error < .02, name + ': readout dot must sit on the visible trace');
    assert(await strip.locator('.rhythm-cursor').isVisible(), name + ': missing inspection dot');
  }
  const first = page.locator('.rhythm-monitor').first();
  const input = first.locator('[data-rhythm-time]');
  await input.press('Home'); assert.equal(Number(await input.inputValue()), 0);
  await input.press('ArrowRight'); assert.equal(Number(await input.inputValue()), .03);
  await input.press('End'); assert.equal(Number(await input.inputValue()), 6);
  await input.press('ArrowRight'); assert.equal(Number(await input.inputValue()), 6);
  await input.fill('7');
  assert.match(await first.locator('[data-rhythm-readout]').textContent(), /0 to 6/);
  assert(!(await first.locator('.rhythm-cursor').isVisible()), 'Invalid time must not retain stale statistics');
  const svg = first.locator('svg');
  await svg.scrollIntoViewIfNeeded();
  for (const type of ['mouse', 'touch']) {
    await svg.evaluate((element, pointerType) => {
      const trace = element.querySelector('.rhythm-trace');
      const middle = trace.points.getItem(100);
      const point = element.createSVGPoint(); point.x = middle.x; point.y = middle.y;
      const screen = point.matrixTransform(element.getScreenCTM());
      element.dispatchEvent(new PointerEvent(pointerType === 'touch' ? 'pointerdown' : 'pointermove', {
        bubbles: true, pointerType, clientX: screen.x, clientY: screen.y
      }));
    }, type);
    assert(Math.abs(Number(await input.inputValue()) - 3) < .01, type + ': pointer inspection must map to time');
    assert(await first.locator('.rhythm-cursor').isVisible());
  }
  console.log('All 13 green rhythm strips, dot alignment, relative readouts, keyboard, bounds and pointer/touch inspection passed');

  await visit(page, 'ventilator.html');
  const mv = page.locator('.gl[data-t="minute-ventilation"]').filter({ hasText: /^MV$/ }).first();
  assert(await mv.count(), 'MV needs its glossary definition in ventilator settings');
  await mv.hover();
  await page.locator('#glpop.on').waitFor({ state: 'visible' });
  assert.match(await page.locator('#glpop').textContent(), /Minute ventilation \(MV\)/);
  assert.match(await page.locator('.glpop-d').textContent(), /L\/min/);
  assert.match(await page.locator('.glpop-d').textContent(), /game support ratio/);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  assert(!(await page.locator('#glpop').isVisible()));

  const noJS = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 1440, height: 1000 } });
  monitor(noJS);
  await visit(noJS, 'circulation.html');
  await checkStaticStrips(noJS);
  assert.equal(await noJS.locator('.rhythm-inspector:visible').count(), 0);
  await visit(noJS, 'airway.html');
  assert(await noJS.locator('[data-seal-image="0"]').isVisible());
  assert.equal(await noJS.locator('[data-seal-controls]:visible').count(), 0);
  assert.match(await noJS.locator('.seal-instructions').textContent(), /five notches/);
  assert.deepEqual(errors, [], 'New guides must not produce browser errors');
  console.log('MV hover, reduced motion, and complete static fallbacks without JavaScript passed');
} finally {
  await browser.close();
}
