/* Original five-frame mod artwork, interpolated for an eased wiki demonstration.
   The in-game gesture is manual: one wheel notch per frame, full lift at frame 5. */
(() => {
  'use strict';
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('[data-chest-seal-demo]').forEach((demo) => {
    if (demo.dataset.sealReady) return;
    const controls = demo.querySelector('[data-seal-controls]');
    const toggle = demo.querySelector('[data-seal-toggle]');
    const replay = demo.querySelector('[data-seal-replay]');
    const corner = demo.querySelector('[data-seal-corner]');
    const slider = demo.querySelector('[data-seal-position]');
    const readout = demo.querySelector('[data-seal-readout]');
    const caption = demo.querySelector('[data-seal-caption]');
    const stage = demo.querySelector('[data-seal-stage]');
    const pictures = [...demo.querySelectorAll('[data-seal-image]')];
    if (!controls || !toggle || !replay || !corner || !slider || !readout || !caption || !stage || pictures.length !== 11) return;
    demo.dataset.sealReady = 'true';
    const cycle = 8000;
    let elapsed = 0;
    let previous = 0;
    let request = 0;
    let visible = !('IntersectionObserver' in window);
    let paused = motion.matches;
    let position = 0;
    const ease = (t) => t * t * (3 - 2 * t);

    function draw(value, description) {
      position = Math.max(0, Math.min(5, value));
      const lower = Math.floor(position);
      const upper = Math.ceil(position);
      const mix = position - lower;
      pictures.forEach((picture) => {
        const n = Number(picture.dataset.sealImage);
        const eligible = n === 0 || picture.dataset.corner === corner.value;
        const opacity = !eligible ? 0 : n === lower ? 1 - mix : n === upper ? mix : 0;
        picture.style.opacity = String(opacity);
      });
      const notch = Math.floor(position + 0.00001);
      slider.value = String(notch);
      slider.setAttribute('aria-valuetext', notch === 0 ? wikiText('Seal flat') : notch === 5 ? wikiText('Full lift: burp reached') : wikiText`Lift ${notch} of 5: incomplete burp`);
      readout.textContent = notch === 0 ? wikiText('Seal flat') : notch === 5 ? wikiText('Full lift') : wikiText`Lift ${notch} of 5`;
      demo.dataset.sealFrame = position.toFixed(3);
      const phrase = description || (position === 5 ? wikiText('Full lift: the game applies burping relief here.') : position === 0 ? wikiText('Seal flat: reassess breathing and circulation.') : wikiText('Partial lift: the burping action has not reached full lift.'));
      if (caption.textContent !== phrase) caption.textContent = phrase;
      stage.setAttribute('aria-label', wikiText`${corner.value === 'left' ? wikiText('Left') : wikiText('Right')} corner of the original chest seal. ${phrase}`);
    }

    function render() {
      const t = elapsed % cycle;
      if (t < 900) draw(0, wikiText('Start with a placed seal and an empty hand.'));
      else if (t < 2900) draw(5 * ease((t - 900) / 2000), wikiText('Lift the selected corner all the way with the mouse wheel.'));
      else if (t < 4500) draw(5, wikiText('Full lift: the game applies burping relief here.'));
      else if (t < 6500) draw(5 * (1 - ease((t - 4500) / 2000)), wikiText('Reverse the wheel to lay the same corner back down.'));
      else draw(0, wikiText('Seal flat: reassess breathing and circulation.'));
    }

    function shouldRun() { return visible && !document.hidden && !paused && !motion.matches; }
    function tick(now) {
      request = 0;
      if (!shouldRun()) return;
      if (previous) elapsed = (elapsed + Math.min(now - previous, 100)) % cycle;
      previous = now;
      render();
      request = window.requestAnimationFrame(tick);
    }
    function sync() {
      if (request) window.cancelAnimationFrame(request);
      request = 0;
      previous = 0;
      toggle.disabled = motion.matches;
      replay.disabled = motion.matches;
      toggle.textContent = motion.matches ? wikiText('Reduced motion') : paused ? wikiText('Play animation') : wikiText('Pause animation');
      toggle.setAttribute('aria-pressed', String(paused || motion.matches));
      caption.setAttribute('aria-live', paused || motion.matches ? 'polite' : 'off');
      if (shouldRun()) request = window.requestAnimationFrame(tick);
    }
    toggle.addEventListener('click', () => {
      paused = !paused;
      sync();
    });
    replay.addEventListener('click', () => { elapsed = 0; paused = false; render(); sync(); });
    corner.addEventListener('change', () => { draw(position); sync(); });
    slider.addEventListener('input', () => {
      paused = true;
      const chosen = Number(slider.value);
      let lo = 0, hi = 1;
      for (let i = 0; i < 20; i++) {
        const middle = (lo + hi) / 2;
        if (ease(middle) < chosen / 5) lo = middle; else hi = middle;
      }
      elapsed = chosen === 0 ? 0 : chosen === 5 ? 2900 : 900 + 2000 * (lo + hi) / 2;
      draw(chosen);
      sync();
    });
    motion.addEventListener('change', () => { paused = true; draw(Math.round(position)); sync(); });
    document.addEventListener('visibilitychange', sync);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { threshold: 0.1 }).observe(stage);
    }
    controls.hidden = false;
    draw(0);
    sync();
  });
})();
