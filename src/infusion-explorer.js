/* Game estimates only. The source supplies bands, units and accumulation rules. */
(() => {
  const root = document.querySelector('[data-infusion-explorer]');
  if (!root) return;
  const data = JSON.parse(document.getElementById('infusion-level-data').textContent);
  const $ = name => root.querySelector(`[data-${name}]`);
  const finite = value => Number.isFinite(Number(value));
  const fmt = value => Number(value).toLocaleString('en-US', { maximumSignificantDigits: 4 });
  const scale = row => row.rateUnit === 'mcg/min' ? 1000 : 1;
  const label = row => row.bandLow != null ? `${fmt(row.bandLow)}–${fmt(row.bandHigh)} ${row.unit}`
    : row.bandHigh != null ? `${fmt(row.bandHigh)} ${row.unit}` : wikiText('No serum target');

  function project(row, options) {
    const { rateMgMin, minutes, weightKg = 83, stopMinutes = null, shock = false, esmolol = false } = options;
    if (row.model === 'none') return null;
    if (![rateMgMin, minutes, weightKg].every(finite) || rateMgMin < 0 || rateMgMin > 1000000 || minutes <= 0 || minutes > 360 || weightKg < 30 || weightKg > 200 || (stopMinutes != null && (!finite(stopMinutes) || stopMinutes < 0 || stopMinutes > minutes))) throw new RangeError('Invalid infusion inputs');
    let clearance = row.clearance;
    if (row.id === 'lidocaine') clearance = Math.max(0.05, clearance * (shock ? 0.6 : 1) * (esmolol ? 0.7 : 1));
    const k = row.model === 'one-compartment' ? clearance / (60 * weightKg * row.volumeLPerKg) : 0.693 / row.halfLifeSec;
    const plateau = rateMgMin * row.inputFactor / clearance;
    const points = [{ seconds: 0, level: 0, deliveredMg: 0 }];
    let level = 0, easedRate = 0, deliveredMg = 0;
    const end = Math.round(minutes * 60), stop = stopMinutes == null ? Infinity : stopMinutes * 60;
    for (let t = 1; t <= end; t++) {
      const admittedRate = t - 1 < stop ? rateMgMin : 0;
      if (row.inputEasing) {
        const tau = admittedRate > easedRate ? row.inputEasing.onsetSec : row.inputEasing.offsetSec;
        easedRate += (admittedRate - easedRate) * Math.min(1 / tau, 1);
      } else easedRate = admittedRate;
      const target = easedRate * row.inputFactor / clearance;
      level += k * (target - level);
      deliveredMg += admittedRate / 60;
      points.push({ seconds: t, level: Math.max(0, level), deliveredMg });
    }
    return { points, plateau, halfLifeMinutes: Math.log(2) / k / 60, clearance };
  }
  // Small public math surface lets verification check against independent values.
  window.ACMInfusionModel = Object.freeze({ project });
  let row = data.rows[0], result, yMax = 1, chartWidth = 780;
  const select = $('level-drug'), rate = $('level-rate'), slider = $('level-rate-slider');
  const duration = $('level-duration'), stopEnabled = $('level-stop-enabled'), stop = $('level-stop');
  const weight = $('level-weight'), time = $('level-time-slider');
  const svgNS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, value) => {
    const node = document.createElementNS(svgNS, tag);
    Object.entries(attrs).forEach(([key, val]) => node.setAttribute(key, val));
    if (value != null) node.textContent = value;
    return node;
  };
  const x = minute => 60 + (chartWidth - 76) * minute / Number(duration.value);
  const y = value => 226 - 212 * value / yMax;
  const txt = (name, value) => { $(name).textContent = value; };
  function thresholds(point) {
    const list = $('level-thresholds');
    list.replaceChildren();
    for (const boundary of row.thresholds) {
      const item = document.createElement('li'), value = document.createElement('b');
      value.textContent = `${boundary.comparison} ${fmt(boundary.value)} ${row.unit}: `;
      item.append(value, `${boundary.label}${boundary.detail ? '. ' + boundary.detail : ''}`);
      if (point && boundary.purpose === 'toxicity') item.dataset.reached = String(boundary.comparison === '>' ? point.level > boundary.value : point.level >= boundary.value);
      list.append(item);
    }
    for (const boundary of row.rateThresholds) {
      const item = document.createElement('li'), value = document.createElement('b');
      value.textContent = `${boundary.comparison} ${fmt(boundary.value * scale(row))} ${row.rateUnit}: `;
      item.append(value, wikiText`${boundary.label}. Reads ${boundary.basis || wikiText('actual admitted rate')}.`);
      list.append(item);
    }
    list.hidden = list.children.length === 0;
  }
  function inspect(minute) {
    if (!result) return;
    const point = result.points[Math.min(result.points.length - 1, Math.max(0, Math.round(minute * 60)))];
    const actualMinute = point.seconds / 60;
    time.value = actualMinute;
    txt('level-cursor-time', `${fmt(actualMinute)} min`);
    txt('level-current', `${fmt(point.level)} ${row.unit}`);
    txt('level-time', wikiText`At ${fmt(actualMinute)} min from a zero starting value`);
    const dose = row.rateUnit === 'mcg/min' ? `${fmt(point.deliveredMg * 1000)} mcg` : `${fmt(point.deliveredMg)} mg`;
    txt('level-readout', wikiText`${fmt(actualMinute)} min · ${fmt(point.level)} ${row.unit} · ${dose} admitted`);
    $('level-dot').setAttribute('cx', x(actualMinute));
    $('level-dot').setAttribute('cy', y(point.level));
    window.ACMEWiki.sizeChartMarkers($('level-svg'), [$('level-dot')]);
    $('level-cursor').setAttribute('x1', x(actualMinute));
    $('level-cursor').setAttribute('x2', x(actualMinute));
    thresholds(point);
  }
  function draw() {
    chartWidth = Math.max(140, $('level-svg').clientWidth);
    $('level-svg').setAttribute('viewBox', `0 0 ${chartWidth} 270`);
    $('level-hit').setAttribute('width', chartWidth - 76);
    const peak = Math.max(...result.points.map(p => p.level));
    yMax = Math.max(peak * 1.15, (row.bandHigh || 0) * 1.5, 0.0001);
    const grid = $('level-grid');
    grid.replaceChildren();
    for (let i = 0; i <= 4; i++) {
      const value = yMax * i / 4, minute = Number(duration.value) * i / 4;
      grid.append(el('line', { x1: 60, x2: chartWidth - 16, y1: y(value), y2: y(value), stroke: '#203440', 'stroke-width': 1 }));
      grid.append(el('text', { x: 52, y: y(value) + 4, 'text-anchor': 'end' }, fmt(value)));
      if (chartWidth > 400 || i % 2 === 0) grid.append(el('text', { x: x(minute), y: 249, 'text-anchor': i === 4 ? 'end' : 'middle' }, fmt(minute)));
    }
    const band = $('level-shade'), bounds = $('level-boundaries');
    bounds.replaceChildren();
    const shaded = row.bandLow != null && row.bandHigh != null;
    band.style.display = shaded ? '' : 'none';
    $('level-shade-key').hidden = !shaded;
    if (shaded) {
      Object.entries({ x: 60, y: y(row.bandHigh), width: chartWidth - 76, height: y(row.bandLow) - y(row.bandHigh) }).forEach(([key, value]) => band.setAttribute(key, value));
    }
    const boundaries = [...new Set([row.bandLow, row.bandHigh, ...row.thresholds.filter(b => b.purpose === 'toxicity').map(b => b.value)].filter(v => v != null && v <= yMax))];
    boundaries.forEach(value => bounds.append(el('line', { x1: 60, x2: chartWidth - 16, y1: y(value), y2: y(value), stroke: '#cfaa65', opacity: .6, 'stroke-dasharray': '5 6' })));
    const step = Math.max(1, Math.floor(result.points.length / 700));
    const points = result.points.filter((p, i) => i % step === 0 || i === result.points.length - 1);
    $('level-path').setAttribute('d', points.map((p, i) => `${i ? 'L' : 'M'}${x(p.seconds / 60).toFixed(2)},${y(p.level).toFixed(2)}`).join(' '));
    document.getElementById('level-chart-title').textContent = wikiText`${row.medication}: estimated game concentration`;
    txt('level-axis', row.unit);
  }
  function render() {
    txt('level-meaning', row.meaning);
    txt('level-band', label(row));
    txt('level-reference-label', row.bandLow == null && row.bandHigh != null ? wikiText('Caution boundary') : wikiText('Configured reference'));
    txt('level-band-note', row.therapeuticDisplayLabel);
    $('level-card-link').href = `#infusion-risk-${row.id}`;
    const modeled = row.model !== 'none';
    root.querySelectorAll('[data-model-control]').forEach(control => { control.hidden = !modeled; });
    $('weight-control').hidden = row.model !== 'one-compartment';
    $('lidocaine-controls').hidden = row.id !== 'lidocaine';
    $('level-plot').hidden = !modeled;
    $('level-output').hidden = false;
    $('level-error').hidden = true;
    if (!modeled) {
      result = null;
      txt('level-current-label', row.osmotherapy ? wikiText('Modeled ICP response') : wikiText('What the game reads'));
      txt('level-current', row.osmotherapy ? wikiText`Up to ${row.osmotherapy.icpDropPerReferenceMmHg} mmHg` : wikiText('Native medication effect'));
      txt('level-time', row.osmotherapy ? wikiText`Per ${row.osmotherapy.referenceVolumeMl} mL reference with a TBI state` : wikiText('Medication already on board, rather than a serum target'));
      txt('level-plateau-label', row.osmotherapy ? wikiText('Sodium ceiling') : wikiText('Preparation'));
      txt('level-plateau', row.osmotherapy ? `${row.osmotherapy.sodiumCeiling} mEq/L` : wikiText('Single drug or mixture'));
      txt('level-half-life', row.osmotherapy ? wikiText('Benefit stops here; this is not a target.') : wikiText('See Ketofol and the dose guide for combined effects.'));
      thresholds(null);
      return;
    }
    txt('level-current-label', wikiText('At the selected time'));
    txt('level-plateau-label', wikiText('With continuous delivery'));
    const rateValue = rate.value === '' ? NaN : Number(rate.value);
    const options = { rateMgMin: rateValue / scale(row), minutes: Number(duration.value), weightKg: row.model === 'one-compartment' ? (weight.value === '' ? NaN : Number(weight.value)) : 83, stopMinutes: stopEnabled.checked ? (stop.value === '' ? NaN : Number(stop.value)) : null, shock: $('level-shock').checked, esmolol: $('level-esmolol').checked };
    try { result = project(row, options); } catch {
      result = null;
      txt('level-error', rateValue / scale(row) > 1000000 ? wikiText('That value exceeds this calculator’s numerical range. Enter a smaller value.') : wikiText('Enter a nonnegative delivered rate, a weight of 30–200 kg and a stop time inside the chart duration.'));
      $('level-error').hidden = false;
      $('level-output').hidden = true;
      return;
    }
    txt('level-plateau', `${fmt(result.plateau)} ${row.unit}`);
    txt('level-half-life', wikiText`Estimated plateau if delivery continues; washout half-life about ${fmt(result.halfLifeMinutes)} min.`);
    const previousTime = Number(time.value), atEnd = previousTime === Number(time.max);
    time.max = duration.value;
    time.value = atEnd ? duration.value : Math.min(previousTime, Number(duration.value));
    stop.max = duration.value;
    slider.value = Math.min(rateValue, Number(slider.max));
    draw();
    inspect(Number(time.value));
  }
  function choose(id) {
    row = data.rows.find(item => item.id === id) || data.rows[0];
    select.value = row.id;
    if (row.model !== 'none') {
      rate.value = row.defaultRateMgMin * scale(row);
      slider.max = row.rateMaxMgMin * scale(row);
      slider.step = Number(slider.max) / 1000;
      txt('rate-unit', `(${row.rateUnit})`);
    }
    render();
  }
  select.addEventListener('change', () => choose(select.value));
  for (const control of [rate, weight, stop, $('level-shock'), $('level-esmolol')]) control.addEventListener('input', render);
  duration.addEventListener('input', () => { stop.value = Math.min(Number(stop.value), Number(duration.value)); render(); });
  slider.addEventListener('input', () => { rate.value = slider.value; render(); });
  stopEnabled.addEventListener('change', () => { stop.disabled = !stopEnabled.checked; render(); });
  time.addEventListener('input', () => inspect(Number(time.value)));
  const hit = $('level-hit');
  function pointer(event) {
    const matrix = $('level-svg').getScreenCTM();
    if (!matrix || !result) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    inspect(Math.max(0, Math.min(1, (point.x - 60) / (chartWidth - 76))) * Number(duration.value));
  }
  hit.addEventListener('pointermove', event => { if (event.pointerType === 'mouse' || event.buttons) pointer(event); });
  hit.addEventListener('pointerdown', pointer);
  document.querySelectorAll('[data-explore-infusion]').forEach(button => {
    button.hidden = false;
    button.addEventListener('click', () => {
      choose(button.dataset.exploreInfusion);
      root.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      select.focus({ preventScroll: true });
    });
  });
  $('explorer-controls').hidden = false;
  choose(select.value);
  new ResizeObserver(() => {
    if (result && Math.abs($('level-svg').clientWidth - chartWidth) > 1) { draw(); inspect(Number(time.value)); }
  }).observe($('level-svg'));
})();
