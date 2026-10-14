/* ECG teaching strips from hesherson/ACM-Extended at
   dd50edf34497588d473ffe3c70797f2eaa52f6f8:
   addons/circulation/functions/fnc_displayAEDMonitor_generateEKG.sqf
   addons/acm_extended/functions/fn_genRhythmEKG.sqf
   addons/circulation/functions/fnc_handleAED.sqf
   Native/custom shapes and noise retain the game's 30 ms sampling. The
   six-second strips extend the monitor's 176-column window. AFib uses a
   fixed example sequence within its scheduler's interval distribution;
   this is not a captured patient's rhythm. Movement/CPR artifacts are off.
   Screen offsets are relative display units, not calibrated millivolts. */
(() => {
  'use strict';
  const api = window.ACMEWiki = window.ACMEWiki || {};
  const duration = 6;
  const dt = .03;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const sin = degrees => Math.sin(degrees * Math.PI / 180);
  // SQF rounds halves away from zero, including offsets before a beat.
  const round = value => Math.sign(value) * Math.floor(Math.abs(value) + .5);
  const nativeNoise = (i, amp, salt = 0) => (sin(i * 137.507 + salt) * .62 + sin(i * 47.311 + 91 + salt) * .38) * amp;
  const customNoise = (i, amp, salt = 0) => (sin(i * 127.31 + salt) * .58 + sin(i * 43.73 + 79 + salt) * .42) * amp;
  const definitions = {
    sinus: { code: 0, rate: 75 },
    'sinus-bradycardia': { code: 0, rate: 45 },
    'sinus-tachycardia': { code: 0, rate: 130 },
    'atrial-fibrillation': { code: 103, rate: 90 },
    'afib-rvr': { code: 100, rate: 150 },
    'atrial-tachycardia': { code: 101, rate: 185 },
    svt: { code: 104, rate: 190 },
    'vt-with-pulse': { code: 4, rate: 230 },
    'pulseless-vt': { code: 3, rate: 230 },
    vf: { code: 2, rate: 0 },
    torsades: { code: 102, rate: 220 },
    pea: { code: 5, rate: 80 },
    asystole: { code: 1, rate: 0 }
  };
  function beatAt(time, rate, irregular) {
    const rr = 60 / rate;
    const anchor = .3;
    if (!irregular) {
      const ordinal = round((time - anchor) / rr);
      return { time: anchor + ordinal * rr, ordinal };
    }
    // All factors are within the current random[.62,.94,1.42] range.
    // Two of ten examples add the scheduler's permitted longer pause.
    const factors = [.76, 1.26, .88, .66, 1.70, 1.04, .72, 1.31, .94, 1.51];
    const beats = [{ time: anchor - rr, ordinal: -1 }, { time: anchor, ordinal: 0 }];
    for (let i = 0; beats[beats.length - 1].time < duration + rr; i++) {
      beats.push({ time: beats[beats.length - 1].time + Math.max(.24, rr * factors[i % factors.length]), ordinal: i + 1 });
    }
    return beats.reduce((best, beat) => Math.abs(beat.time - time) < Math.abs(best.time - time) ? beat : best);
  }
  function nativeSample(code, rate, time, index) {
    if (code === 1) return nativeNoise(index, 1.8, 13);
    if (code === 2) return sin(index * 71.7 + 11) * 14 + sin(index * 31.9 + 123) * 9 + sin(index * 113.3 + 41) * 6 + nativeNoise(index, 3, 211);
    const beat = beatAt(time, rate, false);
    let template, rIndex, noiseAmp;
    if (code === 5) {
      template = [0,-2,-8,-20,-38,-50,-48,-36,-16,5,18,27,23,14,6,1,0]; rIndex = 5; noiseAmp = 2.6;
    } else if (code === 3 || code === 4) {
      template = [5,-30,-47,-49,-49,-47,-42,-34,-24]; rIndex = 3; noiseAmp = 2.5;
    } else {
      const fast = (60 / rate / dt) < 18;
      template = fast ? [0,-4,-40,22,4,-4,2,0] : [0,-1,-5,2,-4,-40,25,5,0,-5,-7,-1,5,4,.8];
      rIndex = fast ? 2 : 5; noiseAmp = 1.8;
    }
    const ti = rIndex + round((time - beat.time) / dt);
    if (ti < 0 || ti >= template.length) return nativeNoise(index, code === 5 ? 2.2 : 1.4, code * 37);
    let value = template[ti];
    if (code === 5) {
      const amplitude = .84 + .30 * ((sin(beat.ordinal * 73 + 19) + 1) / 2);
      const tAmplitude = .78 + .44 * ((sin(beat.ordinal * 41 + 117) + 1) / 2);
      const base = sin(beat.ordinal * 29 + 53) * 2.4;
      value = value * amplitude + base;
      if (ti >= 9) value = (value - base) * tAmplitude + base;
      if ([4,7,8].includes(ti) && Math.abs(sin(beat.ordinal * 97 + 7)) > .72) value += sin(beat.ordinal * 131 + ti * 17) * 5.5;
    }
    return value + nativeNoise(index, noiseAmp, beat.ordinal * 17 + code * 31);
  }
  function customSample(code, rate, time, index) {
    const rr = 60 / rate;
    if (code === 102) {
      // Mature torsades, after the default 15.84 s entry morph has ended.
      // An example starts at beat zero to make a full spindle easy to see.
      const beatFloat = time / Math.max(rr, dt * 5);
      const ordinal = Math.floor(beatFloat);
      const phase = beatFloat - ordinal;
      const variants = [[0,-8,-34,-47,27,-25,13,-7,0], [0,-13,-42,15,-37,20,-15,8,0], [0,-5,-26,-50,22,-20,10,-9,0]];
      const shape = variants[Math.abs(ordinal) % 3];
      const env = sin((ordinal + phase) * (180 / 7));
      const amplitude = .12 + .88 * Math.abs(env);
      const polarity = env < 0 ? -1 : 1;
      return shape[Math.min(8, Math.floor(phase * 9))] * amplitude * polarity + sin(index * 149.3 + ordinal * 23) * 4.5 + customNoise(index, 3.5, 102 + ordinal * 11);
    }
    const irregular = code === 100 || code === 103;
    const beat = beatAt(time, rate, irregular);
    let template, rIndex, noiseAmp;
    const baseline = irregular ? sin(index * 29.7 + 17) * 3.2 + sin(index * 53.1 + 101) * 2 : 0;
    if (code === 101) {
      const fast = rr / dt < 15;
      template = fast ? [0,-5,-42,22,3,-3,0] : [0,-6,-8,-2,2,-44,25,5,-4,-2,5,8,2];
      rIndex = fast ? 2 : 5; noiseAmp = 1.5;
    } else {
      template = rr / dt < 11 ? [0,-44,18,-4,0] : [0,-46,18,-3,-7,-9,-6,-2,0];
      rIndex = 1; noiseAmp = irregular ? 1.8 : 1.4;
    }
    const ti = rIndex + round((time - beat.time) / dt);
    if (ti < 0 || ti >= template.length) return baseline + customNoise(index, irregular ? 1.2 : .9, code);
    const amplitude = .94 + .12 * ((sin(beat.ordinal * 67 + code * 3) + 1) / 2);
    return baseline + template[ti] * amplitude + customNoise(index, noiseAmp, beat.ordinal * 19 + code);
  }
  function samples(name) {
    const definition = definitions[name];
    if (!definition) return null;
    return Array.from({ length: Math.round(duration / dt) + 1 }, (_, index) => {
      const time = index * dt;
      const value = definition.code >= 100 ? customSample(definition.code, definition.rate, time, index) : nativeSample(definition.code, definition.rate, time, index);
      return { time, value, deflection: -value };
    });
  }
  const cache = Object.fromEntries(Object.keys(definitions).map(name => [name, samples(name)]));
  api.rhythmStripSamples = name => cache[name]?.map(point => ({ ...point })) || null;
  api.rhythmStripExample = (name, time) => {
    if (!cache[name] || !Number.isFinite(time) || time < 0 || time > duration) return null;
    // Inspection follows the drawn line between native samples.
    const a = Math.min(199, Math.floor(time / dt));
    const amount = clamp((time - a * dt) / dt, 0, 1);
    const value = cache[name][a].value + (cache[name][a + 1].value - cache[name][a].value) * amount;
    return { time, value, deflection: -value };
  };
  if (typeof document === 'undefined') return;
  document.querySelectorAll('.rhythm-monitor[data-rhythm]').forEach(root => {
    const name = root.dataset.rhythm;
    const svg = root.querySelector('.rhythm-ecg');
    if (!svg || svg.dataset.rhythmReady || !cache[name]) return;
    svg.dataset.rhythmReady = 'true';
    svg.classList.add('chart-interactive');
    const control = root.querySelector('[data-rhythm-time]');
    const cursor = root.querySelector('.rhythm-cursor');
    const guide = root.querySelector('.rhythm-guide');
    const dot = root.querySelector('.rhythm-dot');
    const bubble = root.querySelector('.rhythm-bubble');
    const readout = root.querySelector('[data-rhythm-readout]');
    root.querySelector('.rhythm-inspector').hidden = false;
    const plot = { left: 24, right: 976, top: 15, bottom: 178, baseline: 114, scale: 1.35 };
    function inspect(time) {
      const result = api.rhythmStripExample(name, time);
      if (!result) {
        cursor.style.display = 'none';
        readout.textContent = wikiText('Choose a time from 0 to 6 seconds.');
        return;
      }
      const x = plot.left + time / duration * (plot.right - plot.left);
      const y = plot.baseline + result.value * plot.scale;
      guide.setAttribute('x1', x); guide.setAttribute('x2', x);
      dot.setAttribute('cx', x); dot.setAttribute('cy', y);
      api.sizeChartMarkers(svg, [dot]);
      dot.dataset.time = time; dot.dataset.deflection = result.deflection;
      const label = wikiText('Time: ') + time.toFixed(2) + ' s';
      const value = wikiText('Deflection: ') + (result.deflection > 0 ? '+' : '') + result.deflection.toFixed(1) + wikiText(' relative units');
      root.querySelector('[data-rhythm-bubble-time]').textContent = label;
      root.querySelector('[data-rhythm-bubble-value]').textContent = wikiText('Offset: ') + (result.deflection > 0 ? '+' : '') + result.deflection.toFixed(1) + wikiText(' units');
      bubble.setAttribute('transform', 'translate(' + clamp(x + 14, plot.left, plot.right - 276) + ',' + clamp(y - 74, plot.top, plot.bottom - 61) + ')');
      readout.replaceChildren();
      [label, value].forEach(text => { const span = document.createElement('span'); span.textContent = text; readout.append(span); });
      cursor.style.display = '';
    }
    control.addEventListener('input', () => inspect(control.value.trim() === '' ? NaN : Number(control.value)));
    control.addEventListener('focus', () => inspect(Number(control.value)));
    control.addEventListener('keydown', event => {
      const steps = { ArrowLeft: -.03, ArrowRight: .03, ArrowDown: -.03, ArrowUp: .03 };
      if (!(event.key in steps) && event.key !== 'Home' && event.key !== 'End') return;
      event.preventDefault();
      const value = event.key === 'Home' ? 0 : event.key === 'End' ? duration : clamp((Number(control.value) || 0) + steps[event.key], 0, duration);
      control.value = value.toFixed(2); inspect(value);
    });
    function pointer(event) {
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
      let local;
      try { local = point.matrixTransform(matrix.inverse()); } catch (_) { return; }
      const time = clamp((local.x - plot.left) / (plot.right - plot.left) * duration, 0, duration);
      control.value = time.toFixed(2); inspect(time);
    }
    svg.addEventListener('pointermove', pointer);
    svg.addEventListener('pointerdown', pointer);
    svg.addEventListener('pointerleave', event => { if (event.pointerType !== 'touch') cursor.style.display = 'none'; });
    inspect(0); cursor.style.display = 'none';
  });
})();
