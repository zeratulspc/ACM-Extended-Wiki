/* Timed visual procedure guide. Stages remain available without JavaScript. */
(function () {
  'use strict';
  document.querySelectorAll('[data-slideshow]').forEach(root => {
    if (root.classList.contains('is-enhanced')) return;
    const slides = [...root.querySelectorAll('[data-slide]')];
    const select = root.querySelector('[data-slide-select]');
    const previous = root.querySelector('[data-slide-prev]');
    const next = root.querySelector('[data-slide-next]');
    const all = root.querySelector('[data-slide-all]');
    const play = root.querySelector('[data-slide-play]');
    const status = root.querySelector('[data-slide-status]');
    const progress = root.querySelector('[data-slide-progress]');
    if (!slides.length || !select || !play) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const frames = slides.map(slide => [...slide.querySelectorAll('[data-motion-frame]')]);
    // Buffer the original motion frames before a fast sequence starts.
    frames.flat().forEach(frame => { frame.loading = 'eager'; });
    const FRAME_TIME = 220, END_HOLD = 900;
    let index = 0, paused = reduced.matches, showAll = false, inView = false;
    let elapsed = 0, lastTick = 0, animation = 0, fadeTimer;
    const duration = () => Number(slides[index].dataset.duration) || 7000;
    const canRun = () => !paused && !showAll && inView && !document.hidden;

    // One clock drives the scene, its animation and the progress line. Pausing
    // preserves elapsed time, including when the guide leaves the viewport.
    function render() {
      if (progress) progress.style.transform = 'scaleX(' + Math.min(1, elapsed / duration()) + ')';
      const group = frames[index];
      if (!group.length || reduced.matches) return;
      const cycle = FRAME_TIME * (group.length - 1) + END_HOLD;
      const current = Math.min(group.length - 1, Math.floor((elapsed % cycle) / FRAME_TIME));
      group.forEach((frame, i) => frame.classList.toggle('frame-active', i === current));
    }
    function stopClock() {
      if (animation) {
        elapsed = Math.min(duration(), elapsed + performance.now() - lastTick);
        cancelAnimationFrame(animation);
        animation = 0;
        render();
      }
    }
    function tick(now) {
      animation = 0;
      if (!canRun()) return;
      elapsed += now - lastTick;
      lastTick = now;
      if (elapsed >= duration()) {
        change(index + 1, false, elapsed - duration());
        return;
      }
      render();
      animation = requestAnimationFrame(tick);
    }
    function schedule() {
      stopClock();
      root.classList.toggle('slideshow-running', canRun());
      if (!canRun()) return;
      lastTick = performance.now();
      animation = requestAnimationFrame(tick);
    }
    function controls(announce = false) {
      select.value = String(index);
      select.disabled = showAll;
      previous.disabled = showAll;
      next.disabled = showAll;
      all.setAttribute('aria-pressed', String(showAll));
      all.textContent = showAll ? wikiText('Show one stage') : wikiText('Show all stages');
      play.disabled = showAll;
      play.textContent = paused ? wikiText('Play slideshow') : wikiText('Pause slideshow');
      play.setAttribute('aria-pressed', String(!paused));
      status.setAttribute('aria-live', announce ? 'polite' : 'off');
      status.textContent = showAll ? wikiText`All ${slides.length} stages shown.` :
        wikiText`Stage ${index + 1} of ${slides.length}: ${slides[index].querySelector("h3,h4").textContent}`;
    }
    function change(value, manual = true, carry = 0) {
      clearTimeout(fadeTimer);
      stopClock();
      const old = slides[index];
      index = (value + slides.length) % slides.length;
      elapsed = Math.max(0, carry);
      const current = slides[index];
      slides.forEach(slide => {
        slide.hidden = slide !== current;
        slide.inert = slide !== current;
        slide.classList.remove('slide-active', 'slide-leaving');
        slide.removeAttribute('aria-hidden');
      });
      frames[index].forEach((frame, i) => frame.classList.toggle('frame-active', i === 0));
      if (old !== current && !reduced.matches) {
        old.hidden = false;
        old.classList.add('slide-leaving');
        old.setAttribute('aria-hidden', 'true');
        void current.offsetWidth;
        current.classList.add('slide-active');
        fadeTimer = setTimeout(() => {
          if (old !== slides[index]) old.hidden = true;
          old.classList.remove('slide-leaving');
        }, 320);
      } else current.classList.add('slide-active');
      controls(manual);
      render();
      schedule();
      window.dispatchEvent(new Event('scroll'));
    }
    previous.addEventListener('click', () => change(index - 1));
    next.addEventListener('click', () => change(index + 1));
    select.addEventListener('change', () => change(Number(select.value)));
    play.addEventListener('click', () => { paused = !paused; controls(true); schedule(); });
    all.addEventListener('click', () => {
      showAll = !showAll;
      stopClock();
      clearTimeout(fadeTimer);
      root.classList.toggle('show-all', showAll);
      if (showAll) {
        root.classList.remove('slideshow-running');
        slides.forEach(slide => {
          slide.hidden = false;
          slide.inert = false;
          slide.classList.add('slide-active');
          slide.classList.remove('slide-leaving');
          slide.removeAttribute('aria-hidden');
        });
        controls(true);
      } else change(index);
      window.dispatchEvent(new Event('scroll'));
    });
    root.addEventListener('keydown', event => {
      if (showAll || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
          /^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName) || event.target.isContentEditable) return;
      const keys = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: slides.length - 1 };
      if (!Object.prototype.hasOwnProperty.call(keys, event.key)) return;
      event.preventDefault();
      change(keys[event.key]);
    });
    document.addEventListener('visibilitychange', schedule);
    reduced.addEventListener('change', () => {
      if (reduced.matches) paused = true;
      controls();
      schedule();
    });
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        inView = entries[0].isIntersecting;
        schedule();
      }, { threshold: 0.1 });
      observer.observe(root);
    } else inView = true;
    root.classList.add('is-enhanced');
    root.querySelector('[data-slide-controls]').hidden = false;
    root.querySelector('[data-slide-hint]').hidden = false;
    change(0, false);
  });
})();
