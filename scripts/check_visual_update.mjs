import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const htmlPages = readdirSync(root + '/docs').filter(file => file.endsWith('.html'));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined });
const errors = [];
const monitor = page => page.on('pageerror', error => errors.push(page.url() + ': ' + error.message));
const visit = (page, file) => page.goto(pathToFileURL(root + '/docs/' + file).href);
const stage = page => page.locator('[data-slide-select]').inputValue();
const visibleStages = page => page.locator('[data-slide]:visible').count();

async function checkInheritedTermColor(term) {
  const style = await term.evaluate(element => {
    const own = getComputedStyle(element);
    const parent = getComputedStyle(element.parentElement);
    return {
      color: own.color, parentColor: parent.color, background: own.backgroundColor,
      border: own.borderTopColor, borderWidth: own.borderTopWidth, borderStyle: own.borderTopStyle,
      outline: own.outlineStyle
    };
  });
  assert.equal(style.color, style.parentColor, 'Glossary text must inherit the surrounding text color');
  assert.equal(style.borderWidth, '1px');
  assert.equal(style.borderStyle, 'solid');
  const borderAlpha = Number(style.border.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/)?.[1] ?? 1);
  assert(borderAlpha <= 0.3, 'Glossary outline must remain subtle: ' + style.border);
  assert.equal(style.outline, 'none', 'Resting glossary term must not have an additional outline');
}

async function checkChartPointer(figure, { x = 0.5, y = 0.5 } = {}) {
  await figure.evaluate(element => {
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (parent.tagName === 'DETAILS') parent.open = true;
    }
  });
  const svg = figure.locator('svg.chart-interactive').first();
  await svg.scrollIntoViewIfNeeded();
  const readout = figure.locator('.chart-readout');
  assert.equal(await readout.count(), 1, 'Each graph needs an accessible stat readout');
  await svg.evaluate((element, point) => {
    const bounds = element.getBoundingClientRect();
    element.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, clientX: bounds.left + bounds.width * point.x,
      clientY: bounds.top + bounds.height * point.y, pointerType: 'mouse'
    }));
  }, { x, y });
  const dots = svg.locator('.chart-cursor circle');
  assert(await dots.count() > 0, 'A hover point must appear on the graph');
  assert(await dots.first().evaluate(element => {
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
  }), 'Graph hover point must be visible');
  assert((await readout.textContent()).trim().length > 0, 'Graph readout cannot be empty');
}

try {
  assert.equal(htmlPages.length, 28, 'Expected the complete 28-page build');
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  monitor(page);
  const overflow = [];
  for (const width of [390, 1905, 5120]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const file of htmlPages) {
      await visit(page, file);
      const size = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth }));
      if (size.page > size.viewport + 1) overflow.push({ file, width, scrollWidth: size.page });
    }
    await visit(page, 'access.html');
    for (const sequence of ['1', '2']) {
      await page.locator('[data-slide-select]').selectOption(sequence);
      const clippedFrames = await page.locator('[data-slide].slide-active [data-motion-frame]').evaluateAll(elements => elements.flatMap(element => {
        const image = element.getBoundingClientRect();
        const art = element.closest('.iv-art').getBoundingClientRect();
        const fits = image.left >= art.left - 1 && image.right <= art.right + 1 && image.top >= art.top - 1 && image.bottom <= art.bottom + 1;
        return fits ? [] : [{ frame: element.dataset.motionFrame, image: image.toJSON(), art: art.toJSON() }];
      }));
      assert.deepEqual(clippedFrames, [], 'Catheter sequence ' + sequence + ' must fit its illustration box at ' + width + 'px');
    }
    console.log('Checked all 28 pages and both catheter sequence bounds at ' + width + 'px');
  }
  assert.deepEqual(overflow, [], 'Pages must not overflow horizontally: ' + JSON.stringify(overflow));

  await page.setViewportSize({ width: 1905, height: 1000 });
  await visit(page, 'medications.html');
  assert.equal(await page.locator('.drug').count(), 33);
  assert.equal(await page.locator('.med-vial').count(), 33);
  assert.equal(await page.locator('#q').getAttribute('placeholder'), 'Search the wiki');
  assert.equal(await page.locator('h1').evaluate(element => getComputedStyle(element).color), 'rgb(241, 189, 89)');
  await checkInheritedTermColor(page.locator('.gl').first());
  await checkChartPointer(page.locator('figure.med-curve').first());

  await visit(page, 'access.html');
  assert.equal(await page.locator('[data-slide]').count(), 6);
  assert.deepEqual(await page.locator('[data-motion-frame]').evaluateAll(elements => elements.map(element => element.dataset.motionFrame)), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']);
  assert.equal(await page.locator('[data-slide]').filter({ has: page.locator('[data-motion-frame]') }).count(), 2);
  assert(!/%/.test(await page.locator('[data-slide-select]').textContent()), 'Threading must be one sequence, without separate percentage stages');
  assert(await page.locator('[data-slide]').evaluateAll(elements => elements.every(element => element.dataset.duration === '7000')));
  assert.equal(await page.locator('.slideshow-progress').getAttribute('aria-hidden'), 'true', 'Progress must not announce every frame');
  assert.equal(await visibleStages(page), 1);
  assert.equal(await page.locator('[data-slide-play]').textContent(), 'Play slideshow', 'Reduced-motion preference should start paused');
  assert.equal(await page.locator('[data-slide-play]').getAttribute('aria-pressed'), 'false');
  assert(!/\bLINE\b|connect.{0,20}line|line.{0,20}connect/i.test(await page.locator('[data-slide]').last().textContent()), 'Final catheter description must omit LINE instructions');
  await page.locator('[data-slide-select]').selectOption('4');
  assert((await page.locator('[data-slide-status]').textContent()).includes('Stage 5 of 6'));
  await page.locator('[data-slide-next]').click();
  assert.equal(await stage(page), '5');
  await page.locator('[data-slide-next]').click();
  assert.equal(await stage(page), '0', 'Next wraps from the last stage');
  await page.locator('[data-slide-prev]').click();
  assert.equal(await stage(page), '5', 'Previous wraps from the first stage');
  await page.locator('[data-slideshow]').focus();
  await page.keyboard.press('Home');
  assert.equal(await stage(page), '0');
  await page.keyboard.press('ArrowRight');
  assert.equal(await stage(page), '1');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await stage(page), '0');
  await page.keyboard.press('End');
  assert.equal(await stage(page), '5');
  await page.locator('[data-slide-all]').click();
  assert.equal(await visibleStages(page), 6);
  assert(await page.locator('[data-slide-prev]').isDisabled());
  assert(await page.locator('[data-slide-next]').isDisabled());
  assert(await page.locator('[data-slide-play]').isDisabled());
  for (const image of await page.locator('[data-slide] img').all()) {
    await image.scrollIntoViewIfNeeded();
    await image.evaluate(element => element.decode());
  }
  await page.locator('[data-slide-all]').click();
  assert.equal(await visibleStages(page), 1);
  assert.equal(await stage(page), '5', 'Show-all should preserve the chosen stage');
  assert.equal(await page.locator('.access-flow .flow-stage').count(), 3);
  assert.equal(await page.locator('.gauge-card').count(), 4);
  const capacity = page.locator('figure').filter({ has: page.locator('#gauge-title') });
  await capacity.locator('.chart-inspector select').selectOption('0');
  assert.match(await capacity.locator('.chart-readout').textContent(), /375 mL\/min/);
  await checkChartPointer(capacity, { x: 0.55, y: 0.82 });
  assert.match(await capacity.locator('.chart-readout').textContent(), /(?:FAST1|EZ) IO/);

  await visit(page, 'fluids.html');
  const conversion = page.locator('figure').filter({ has: page.locator('#fluid-graph-title') });
  await conversion.locator('.chart-inspector input').fill('5');
  await conversion.locator('.chart-inspector input').dispatchEvent('input');
  assert.match(await conversion.locator('.chart-readout').textContent(), /Plasma: 900 mL/);
  assert.match(await conversion.locator('.chart-readout').textContent(), /Crystalloid: 210 mL/);
  await checkChartPointer(conversion);

  await visit(page, 'ventilator.html');
  assert.equal(await page.locator('.vent-scenarios > .icard').count(), 6);
  for (const card of await page.locator('.vent-scenarios > .icard').all()) {
    assert(await card.locator('.sgrid .s').count() >= 4, 'Each ventilator card should show its setting grid');
    assert.match(await card.textContent(), /Why:/);
    assert.match(await card.textContent(), /Watch:/);
  }
  const pressure = page.locator('figure').filter({ has: page.locator('svg.wavefig') });
  await checkChartPointer(pressure);
  assert.match(await pressure.locator('.chart-readout').textContent(), /not to scale/);

  await visit(page, 'airway.html');
  assert.equal(await page.locator('.sound-grid audio').count(), 3);
  assert.equal(await page.locator('.sound-grid audio source').count(), 3);
  for (const audio of await page.locator('.sound-grid audio').all()) {
    assert.equal(await audio.getAttribute('autoplay'), null, 'Sound playback must be user controlled');
    assert.equal(await audio.getAttribute('controls'), '');
    assert(await audio.getAttribute('aria-label'), 'Every sound needs a meaningful accessible name');
    await audio.evaluate(element => new Promise((resolve, reject) => {
      element.addEventListener('loadedmetadata', () => resolve(), { once: true });
      element.addEventListener('error', () => reject(new Error('Audio could not load: ' + element.currentSrc)), { once: true });
      element.load();
    }));
  }
  console.log('Reduced-motion layout, terms, controls, readouts, six ventilator cards and three audio clips passed');

  const motion = await browser.newPage({ reducedMotion: 'no-preference', viewport: { width: 1905, height: 1000 } });
  monitor(motion);
  const clockStart = new Date('2026-09-14T12:00:00Z');
  await motion.clock.install({ time: clockStart });
  await motion.clock.pauseAt(new Date(clockStart.getTime() + 1000));
  await visit(motion, 'access.html');
  await motion.locator('[data-slideshow]').scrollIntoViewIfNeeded();
  await motion.waitForTimeout(80); // Allow the real IntersectionObserver to report visibility.
  assert(await motion.locator('[data-slideshow]').evaluate(element => element.classList.contains('slideshow-running')));
  await motion.locator('[data-slideshow]').focus();
  await motion.keyboard.press('Home');
  const progress = () => motion.locator('[data-slide-progress]').evaluate(element =>
    Number(element.style.transform.match(/scaleX\(([^)]+)\)/)[1]));
  const activeFrame = () => motion.locator('[data-slide].slide-active [data-motion-frame].frame-active').getAttribute('data-motion-frame');
  assert.equal(await motion.locator('[data-slide-play]').textContent(), 'Pause slideshow');
  assert.equal(await progress(), 0);
  await motion.clock.runFor(6900);
  assert.equal(await stage(motion), '0', 'A scene should remain for its seven-second dwell');
  assert(await progress() > 0.98 && await progress() < 1, 'Progress should reach the end of the same seven-second clock');
  await motion.clock.runFor(150); // Allow animation-frame scheduling after seven seconds.
  assert.equal(await stage(motion), '1', 'Slideshow must advance automatically after seven seconds');
  assert(await progress() < 0.01, 'Automatic advance must reset the progress line');
  assert.equal(await motion.locator('[data-slide].slide-leaving:visible').count(), 1, 'Outgoing scene should remain during the fade');
  assert.equal(await visibleStages(motion), 2);
  assert.equal(await motion.locator('[data-slide].slide-active').evaluate(element => getComputedStyle(element).transitionProperty), 'opacity');
  await motion.clock.runFor(330);
  assert.equal(await visibleStages(motion), 1, 'Outgoing scene should hide after its fade');

  // The six insertion frames form one fast, lightly crossfaded motion.
  await motion.locator('[data-slide-select]').selectOption('1');
  assert.equal(await progress(), 0, 'Selecting a scene starts a fresh dwell');
  assert.equal(await activeFrame(), '1');
  assert.equal(await motion.locator('[data-motion-frame]').first().evaluate(element => getComputedStyle(element).transitionDuration), '0.1s');
  await motion.clock.runFor(260);
  for (const frame of ['2', '3', '4', '5', '6']) {
    assert.equal(await activeFrame(), frame);
    if (frame !== '6') await motion.clock.runFor(220);
  }
  await motion.clock.runFor(800);
  assert.equal(await activeFrame(), '6', 'Insertion endpoint should hold briefly');
  await motion.clock.runFor(100);
  assert.equal(await activeFrame(), '1', 'Insertion should loop after its endpoint hold');

  // Threading frames belong to a second continuous group, not percentage scenes.
  await motion.locator('[data-slide-next]').click();
  assert.equal(await stage(motion), '2');
  assert.equal(await progress(), 0, 'Manual arrows reset the dwell and progress line');
  assert.equal(await activeFrame(), '7');
  await motion.clock.runFor(260);
  for (const frame of ['8', '9', '10', '11']) {
    assert.equal(await activeFrame(), frame);
    if (frame !== '11') await motion.clock.runFor(220);
  }
  await motion.clock.runFor(800);
  assert.equal(await activeFrame(), '11', 'Threading endpoint should hold briefly');
  await motion.clock.runFor(100);
  assert.equal(await activeFrame(), '7', 'Threading should loop after its endpoint hold');

  // Pause preserves elapsed time and the current motion frame.
  await motion.locator('[data-slide-play]').click();
  assert.equal(await motion.locator('[data-slide-play]').textContent(), 'Play slideshow');
  const pausedProgress = await progress();
  const pausedFrame = await activeFrame();
  await motion.clock.runFor(15000);
  assert.equal(await stage(motion), '2', 'Pause must stop automatic navigation');
  assert.equal(await progress(), pausedProgress, 'Pause must preserve elapsed dwell');
  assert.equal(await activeFrame(), pausedFrame, 'Pause must preserve the current catheter frame');
  await motion.locator('[data-slide-play]').click();
  const remaining = 7000 * (1 - pausedProgress);
  await motion.clock.runFor(Math.floor(remaining) - 60);
  assert.equal(await stage(motion), '2', 'Resume must finish the original remaining dwell');
  await motion.clock.runFor(90);
  assert.equal(await stage(motion), '3', 'Resume advances after the remaining time, without restarting the dwell');
  await motion.locator('[data-slide-play]').click();
  await motion.locator('[data-slide-prev]').click();
  assert.equal(await stage(motion), '2', 'Manual arrows must remain available while paused');
  assert.equal(await progress(), 0);
  await motion.locator('[data-slide-play]').click();
  await motion.clock.runFor(1800);

  // Leaving the guide or hiding its document must pause rather than reset time.
  await motion.evaluate(() => window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
  await motion.waitForTimeout(80);
  assert(await motion.locator('[data-slideshow]').evaluate(element => !element.classList.contains('slideshow-running')));
  const awayProgress = await progress();
  const awayFrame = await activeFrame();
  await motion.clock.runFor(9000);
  assert.equal(await progress(), awayProgress, 'Offscreen guide must preserve elapsed time');
  assert.equal(await activeFrame(), awayFrame);
  assert.equal(await stage(motion), '2');
  await motion.locator('[data-slideshow]').scrollIntoViewIfNeeded();
  await motion.waitForTimeout(80);
  await motion.clock.runFor(300);
  assert(await progress() > awayProgress, 'Returning onscreen must resume from the saved progress');
  await motion.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const hiddenProgress = await progress();
  await motion.clock.runFor(9000);
  assert.equal(await progress(), hiddenProgress, 'Hidden document must preserve elapsed time');
  await motion.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await motion.clock.runFor(300);
  assert(await progress() > hiddenProgress);
  await motion.locator('[data-slide-all]').click();
  await motion.clock.runFor(15000);
  assert.equal(await visibleStages(motion), 6, 'Show-all must stop timed navigation');
  assert.equal(await motion.locator('.slideshow-progress').evaluate(element => getComputedStyle(element).visibility), 'hidden');
  console.log('Seven-second dwell, synchronized progress, both fast catheter sequences, crossfades, manual reset and preserved pause time passed');
  await visit(motion, 'medications.html');
  const hoverTerm = motion.locator('.gl').first();
  await hoverTerm.hover();
  await checkInheritedTermColor(hoverTerm);
  assert.match(await hoverTerm.evaluate(element => getComputedStyle(element).transitionProperty), /background-size/);
  await motion.clock.runFor(800);
  assert(await motion.locator('#glpop').isHidden(), 'Definition should wait for the hover dwell');
  assert(await hoverTerm.evaluate(element => element.classList.contains('arming')));
  await motion.clock.runFor(400);
  assert(await motion.locator('#glpop').isVisible(), 'Definition should appear after the short hover dwell');
  assert.equal(await motion.locator('.glpop-in').evaluate(element => getComputedStyle(element).transitionDuration), '0.12s, 0.12s');
  await motion.locator('.glpop-x').click();
  await motion.clock.runFor(130);
  assert(await motion.locator('#glpop').isHidden());
  console.log('Glossary underline dwell and brief popup fade passed');

  const nojs = await browser.newPage({ javaScriptEnabled: false });
  await visit(nojs, 'access.html');
  assert.equal(await nojs.locator('[data-slide]:visible').count(), 6);
  assert.equal(await nojs.locator('[data-slide-controls]:visible').count(), 0);
  console.log('No-JavaScript fallback: all six stages remain readable');
  assert.deepEqual(errors, [], 'Browser JavaScript errors');
} finally {
  await browser.close();
}
