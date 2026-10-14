/* A short schematic sweep demonstration. The game's suction logic remains the reference. */
(() => {
  'use strict';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('.suction-demo').forEach((demo) => {
    const path = demo.querySelector('.suction-path');
    const trace = demo.querySelector('.suction-trace');
    const tip = demo.querySelector('.suction-tip');
    const tool = demo.querySelector('.suction-tool');
    const phase = demo.querySelector('.suction-phase');
    const toggle = demo.querySelector('[data-suction-toggle]');
    if (!path || !trace || !tip || !phase || !toggle) return;

    const length = path.getTotalLength();
    let elapsed = 0;
    let previousTime = 0;
    let frame = 0;
    let visible = !('IntersectionObserver' in window);
    let paused = false;
    const cycle = 6500;
    trace.style.strokeDasharray = String(length);

    function draw(progress, opacity = 1) {
      const point = path.getPointAtLength(length * progress);
      trace.style.strokeDashoffset = String(length * (1 - progress));
      trace.style.opacity = String(opacity);
      tip.setAttribute('cx', point.x.toFixed(2));
      tip.setAttribute('cy', point.y.toFixed(2));
      tip.style.opacity = String(opacity);
      if (tool) {
        tool.setAttribute('x', (point.x - 36.5).toFixed(2));
        tool.setAttribute('y', (point.y - 3.25).toFixed(2));
        tool.style.opacity = String(opacity);
      }
    }

    function describe(text) {
      if (phase.textContent !== text) phase.textContent = text;
    }

    function render() {
      const t = elapsed % cycle;
      if (reducedMotion.matches) {
        draw(1);
        describe(wikiText('Sweep side to side from bottom to top, then release and reassess.'));
      } else if (t < 4200) {
        draw(t / 4200);
        describe(wikiText('Make short side-to-side sweeps from bottom to top.'));
      } else if (t < 5200) {
        draw(1);
        describe(wikiText('Pause at the top, release suction and reassess.'));
      } else if (t < 5800) {
        draw(1, 1 - (t - 5200) / 600);
        describe(wikiText('End of example.'));
      } else {
        draw(0, (t - 5800) / 700);
        describe(wikiText('Return to the bottom for the next example.'));
      }
    }

    function shouldRun() {
      return visible && !document.hidden && !paused && !reducedMotion.matches;
    }

    function tick(now) {
      frame = 0;
      if (!shouldRun()) return;
      if (previousTime) elapsed += Math.min(now - previousTime, 100);
      previousTime = now;
      render();
      frame = window.requestAnimationFrame(tick);
    }

    function sync() {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
      toggle.hidden = reducedMotion.matches;
      toggle.textContent = paused ? wikiText('Play sweep') : wikiText('Pause sweep');
      toggle.setAttribute('aria-pressed', String(paused));
      render();
      if (shouldRun()) frame = window.requestAnimationFrame(tick);
    }

    toggle.addEventListener('click', () => { paused = !paused; sync(); });
    reducedMotion.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        sync();
      }, { threshold: 0.08 }).observe(demo);
    }
    sync();
  });

  // Keep the native playback controls; selecting another sound stops the previous preview.
  document.querySelectorAll('.sound-card audio').forEach((audio) => {
    audio.addEventListener('play', () => {
      document.querySelectorAll('.sound-card audio').forEach((other) => {
        if (other !== audio) other.pause();
      });
    });
  });
})();
