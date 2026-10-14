/* Teaching traces use the four morphology functions in ACM Extended's
   fn_emmaTick.sqf (21f8694). Selected peak values scale the normalized shape
   into an illustrative CO2 trace; this is not an EMMA pixel-height conversion,
   patient physiology calculation or emulation of its averaged numeric readout. */
(() => {
  'use strict';
  const api = window.ACMEWiki = window.ACMEWiki || {};
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const titles = { normal: wikiText('Normal plateau'), shark: wikiText('Obstruction / shark fin'), cleft: wikiText('Curare cleft'), flat: wikiText('Flat trace') };

  function sample({ pattern, peak, rate, severity, time }) {
    if (!(pattern in titles) || ![peak, rate, severity, time].every(Number.isFinite) ||
        peak < 5 || peak > 80 || rate < 4 || rate > 60 || severity < 0 || severity > 1 || time < 0) return null;
    const period = 60 / Math.round(rate);
    const phase = (time / period) % 1;
    let value = phase < .05 ? phase / .05 : phase < .40 ? .9 + .1 * ((phase - .05) / .35) :
      phase < .45 ? 1 - ((phase - .40) / .05) : 0;
    let label = phase < .05 ? wikiText('Exhaled gas rises') : phase < .40 ? wikiText('Expiratory plateau') :
      phase < .45 ? wikiText('Inspiratory downstroke') : wikiText('Baseline');
    if (pattern === 'shark') {
      const fin = phase < .42 ? (phase / .42) ** .55 : phase < .47 ? (1 - ((phase - .42) / .05)) * .95 : 0;
      value = value * (1 - severity) + fin * severity;
      label = phase < .42 ? wikiText('Sloping expiration') : phase < .47 ? wikiText('Inspiratory downstroke') : wikiText('Baseline');
    } else if (pattern === 'cleft') {
      const width = .05 + .05 * severity;
      if (Math.abs(phase - .26) < width) {
        value *= 1 - (.30 + .45 * severity) * (1 - Math.abs(phase - .26) / width);
        label = wikiText('Cleft during expiration');
      }
    } else if (pattern === 'flat') { value = 0; label = wikiText('No exhaled CO2 waveform'); }
    return { co2: clamp(value, 0, 1) * peak, phase: label, period };
  }
  api.capnographyExample = sample;

  document.querySelectorAll('[data-capnography]').forEach(root => {
    const svg = root.querySelector('[data-capno-wave]');
    if (!svg || svg.dataset.capnoReady) return;
    svg.dataset.capnoReady = 'true';
    svg.classList.add('chart-interactive');
    const fields = Object.fromEntries(['pattern', 'peak', 'rate', 'severity'].map(name => [name, root.querySelector('[name="' + name + '"]')]));
    const input = root.querySelector('#capno-time');
    const cursor = root.querySelector('[data-capno-cursor]');
    const guide = root.querySelector('[data-capno-guide]');
    const dot = root.querySelector('[data-capno-dot]');
    const bubble = root.querySelector('[data-capno-bubble]');
    const readout = root.querySelector('[data-capno-readout]');
    const help = root.querySelector('[data-capno-help]');
    const play = root.querySelector('[data-capno-play]');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const duration = 10.5;
    const plot = { left: 72, right: 972, top: 36, bottom: 276 };
    let parameters = { pattern: 'normal', peak: 40, rate: 12, severity: .7 };
    let playing = false;
    let inspecting = false;
    let visible = !('IntersectionObserver' in window);
    let frame = 0;
    let previous = 0;
    let scanTime = 0;
    let currentValid = true;
    let pointerShown = false;
    input.setAttribute('aria-describedby', readout.id);
    root.querySelector('[data-capno-controls]').hidden = false;
    root.querySelector('[data-capno-inspector]').hidden = false;

    function row(name, value) {
      const span = document.createElement('span');
      const strong = document.createElement('strong');
      strong.textContent = name + ': ';
      span.append(strong, document.createTextNode(value));
      return span;
    }
    function inspect(time, updateInput = false) {
      if (!currentValid || !Number.isFinite(time) || time < 0 || time > duration) {
        cursor.style.display = 'none';
        readout.textContent = currentValid ? wikiText('Choose a time from 0 to 10.5 seconds.') : wikiText('Enter valid example settings to inspect the waveform.');
        return;
      }
      const result = sample({ ...parameters, time });
      const x = plot.left + time / duration * (plot.right - plot.left);
      const y = plot.bottom - result.co2 / 80 * (plot.bottom - plot.top);
      guide.setAttribute('x1', x); guide.setAttribute('x2', x);
      dot.setAttribute('cx', x); dot.setAttribute('cy', y);
      api.sizeChartMarkers(svg, [dot]);
      dot.dataset.time = time; dot.dataset.co2 = result.co2;
      const left = x + 280 <= plot.right ? x + 14 : x - 278;
      const top = clamp(y - 75, plot.top + 4, plot.bottom - 65);
      bubble.setAttribute('transform', 'translate(' + clamp(left, plot.left, plot.right - 264) + ',' + top + ')');
      root.querySelector('[data-capno-bubble-time]').textContent = wikiText('Time: ') + time.toFixed(2) + ' s';
      root.querySelector('[data-capno-bubble-value]').textContent = wikiText('Example CO2: ') + result.co2.toFixed(2) + ' mmHg';
      cursor.style.display = '';
      readout.replaceChildren(row(wikiText('Time'), time.toFixed(2) + ' s'), row(wikiText('Example CO2'), result.co2.toFixed(2) + ' mmHg'), row(wikiText('Phase'), result.phase));
      if (updateInput) input.value = time.toFixed(2);
      scanTime = time;
    }

    function updateChart() {
      const selected = fields.pattern.value;
      const severe = selected === 'shark' || selected === 'cleft';
      fields.severity.disabled = !severe;
      fields.peak.disabled = selected === 'flat';
      fields.rate.disabled = selected === 'flat';
      root.querySelector('[data-capno-severity-label]').textContent = selected === 'cleft' ? wikiText('Unmatched effort') : selected === 'shark' ? wikiText('Obstruction severity') : wikiText('Shape severity');
      root.querySelector('[data-capno-severity-value]').textContent = severe ? fields.severity.value + '%' : wikiText('Not used');
      root.querySelectorAll('[data-capno-pattern-note]').forEach(note => { note.hidden = note.dataset.capnoPatternNote !== selected; });
      currentValid = Object.entries(fields).filter(([name]) => name !== 'pattern').every(([, field]) => field.disabled || field.value.trim() !== '' && field.checkValidity());
      if (!currentValid) {
        help.textContent = wikiText('Use a breathing rate of 4–60/min and a CO2 level of 5–80 mmHg.');
        inspect(NaN); stopScan(); return;
      }
      // Disabled controls retain the last valid settings when flat is selected.
      parameters = { pattern: selected, peak: Number(fields.peak.value) || parameters.peak,
        rate: Number(fields.rate.value) || parameters.rate, severity: Number(fields.severity.value) / 100 };
      if (selected === 'flat') { parameters.peak = clamp(parameters.peak, 5, 80); parameters.rate = clamp(parameters.rate, 4, 60); }
      const points = [];
      for (let i = 0; i <= 1500; i++) {
        const time = i / 1500 * duration;
        points.push((plot.left + i / 1500 * (plot.right - plot.left)).toFixed(2) + ',' +
          (plot.bottom - sample({ ...parameters, time }).co2 / 80 * (plot.bottom - plot.top)).toFixed(2));
      }
      root.querySelector('[data-capno-line]').setAttribute('points', points.join(' '));
      const summary = titles[selected] + (selected === 'flat' ? wikiText(': no waveform in this example.') : wikiText(', example CO2 level ') + parameters.peak + wikiText(' mmHg and breathing rate ') + parameters.rate + '/min.');
      help.textContent = summary + wikiText(' Hover, tap or choose a time to inspect the trace.');
      root.querySelector('#capno-desc').textContent = summary + wikiText(' The graph spans 10.5 seconds.');
      inspect(input.value.trim() === '' ? NaN : Number(input.value));
      if (!pointerShown && !playing && document.activeElement !== input) cursor.style.display = 'none';
    }

    function shouldRun() { return playing && currentValid && visible && !document.hidden && !inspecting; }
    function tick(now) {
      frame = 0;
      if (!shouldRun()) return;
      if (previous) scanTime = (scanTime + Math.min(now - previous, 100) / 1000) % duration;
      previous = now;
      inspect(scanTime, true);
      frame = requestAnimationFrame(tick);
    }
    function syncScan() {
      cancelAnimationFrame(frame); frame = 0; previous = 0;
      play.textContent = playing ? wikiText('Pause scan') : wikiText('Play scan');
      play.setAttribute('aria-pressed', String(playing));
      if (shouldRun()) frame = requestAnimationFrame(tick);
    }
    function stopScan() { playing = false; syncScan(); }
    play.addEventListener('click', () => { playing = !playing; inspecting = false; syncScan(); });
    Object.values(fields).forEach(field => field.addEventListener('input', updateChart));
    fields.pattern.addEventListener('change', updateChart);
    input.addEventListener('input', () => { stopScan(); pointerShown = true; inspect(input.value.trim() === '' ? NaN : Number(input.value)); });
    input.addEventListener('focus', () => { inspecting = true; pointerShown = true; syncScan(); inspect(Number(input.value)); });
    input.addEventListener('blur', () => { inspecting = false; syncScan(); });
    input.addEventListener('keydown', event => {
      const steps = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 };
      if (event.key in steps) {
        event.preventDefault(); stopScan();
        inspect(clamp((Number(input.value) || 0) + steps[event.key] * (event.shiftKey ? .1 : .01), 0, duration), true);
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault(); stopScan(); inspect(event.key === 'Home' ? 0 : duration, true);
      }
    });
    function locate(event) {
      const matrix = svg.getScreenCTM(); if (!matrix || !currentValid) return;
      const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
      let local; try { local = point.matrixTransform(matrix.inverse()); } catch (_) { return; }
      inspecting = true; pointerShown = true; syncScan();
      inspect(clamp((local.x - plot.left) / (plot.right - plot.left), 0, 1) * duration, true);
    }
    svg.addEventListener('pointermove', locate);
    svg.addEventListener('pointerdown', locate);
    svg.addEventListener('pointerleave', event => {
      inspecting = false;
      // A tap ends with pointerleave: retain that selected sample for reading.
      if (event.pointerType === 'touch') { stopScan(); return; }
      pointerShown = false;
      if (!playing) cursor.style.display = 'none';
      syncScan();
    });
    document.addEventListener('visibilitychange', syncScan);
    reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) stopScan(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; syncScan(); }, { threshold: .08 }).observe(svg);
    updateChart();
  });
})();
