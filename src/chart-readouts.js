/* Readouts for the remaining reference charts. The plotted values and phase
   boundaries come from their SVG labels and paths, not an additional model. */
(function enhanceReferenceCharts() {
  "use strict";
  const ns = "http://www.w3.org/2000/svg";
  const api = window.ACMEWiki = window.ACMEWiki || {};
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const pretty = value => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
  let serial = 0;

  function element(tag, attrs) {
    const node = document.createElementNS(ns, tag);
    Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }

  function makeInspector(svg, labelText, options) {
    const figure = svg.closest("figure");
    if (!figure || svg.classList.contains("chart-interactive")) return null;
    const id = "reference-chart-" + (++serial);
    const panel = document.createElement("div");
    panel.className = "chart-inspector";
    panel.dataset.noGlossary = "";
    const label = document.createElement("label");
    const control = document.createElement(options ? "select" : "input");
    control.id = id;
    if (options) options.forEach((text, index) => {
      const option = document.createElement("option");
      option.value = index;
      option.textContent = text;
      control.append(option);
    });
    label.htmlFor = id;
    label.append(document.createTextNode(labelText), control);
    const readout = document.createElement("output");
    readout.id = id + "-readout";
    readout.className = "chart-readout";
    readout.setAttribute("aria-live", "off");
    control.setAttribute("aria-describedby", readout.id);
    panel.append(label, readout);
    figure.insertBefore(panel, figure.querySelector("figcaption"));

    const group = element("g", { class: "chart-cursor", "aria-hidden": "true" });
    group.style.pointerEvents = "none";
    const guide = element("line", { stroke: "#a8b8c5", "stroke-dasharray": "3 4", "stroke-width": 1 });
    group.append(guide);
    const bubble = element("g");
    const box = element("rect", { width: 290, height: 68, rx: 5, fill: "#111c29", stroke: "#667685", "stroke-width": 1 });
    const text = element("text", { x: 10, y: 19, fill: "#f2e8d2", "font-size": 14 });
    bubble.append(box, text);
    group.append(bubble);
    svg.append(group);
    svg.classList.add("chart-interactive");
    svg.dataset.extraReadout = "";

    function update(rows, points, bounds) {
      readout.replaceChildren();
      rows.forEach(([name, value]) => {
        const row = document.createElement("span");
        const strong = document.createElement("strong");
        strong.textContent = name + ": ";
        row.append(strong, document.createTextNode(value));
        readout.append(row);
      });
      group.querySelectorAll("circle").forEach(node => node.remove());
      points.forEach(point => group.append(element("circle", {
        cx: point.x, cy: point.y, r: 5.5, fill: point.color || "#edbd58", stroke: "#f2e8d2", "stroke-width": 2
      })));
      api.sizeChartMarkers(svg, Array.from(group.querySelectorAll("circle")));
      const first = points[0];
      guide.setAttribute("x1", first.x);
      guide.setAttribute("x2", first.x);
      guide.setAttribute("y1", bounds.top);
      guide.setAttribute("y2", bounds.bottom);
      const height = 14 + rows.length * 19;
      box.setAttribute("height", height);
      text.replaceChildren();
      rows.forEach(([name, value], index) => {
        const line = element("tspan", { x: 10, dy: index ? 19 : 0 });
        line.textContent = name + ": " + value;
        text.append(line);
      });
      const x = first.x + 306 <= bounds.right
        ? first.x + 16 : Math.max(bounds.left, first.x - 306);
      const y = clamp(first.y - height - 12, bounds.top, bounds.bottom - height);
      bubble.setAttribute("transform", "translate(" + x + "," + y + ")");
      group.style.display = "";
    }
    function locate(event, callback) {
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      let local;
      try { local = point.matrixTransform(matrix.inverse()); } catch (_) { return; }
      callback(local);
    }
    function bind(render, pointer) {
      control.addEventListener("input", () => render());
      control.addEventListener("change", () => render());
      control.addEventListener("focus", () => render());
      svg.addEventListener("pointermove", event => locate(event, pointer));
      svg.addEventListener("pointerdown", event => locate(event, pointer));
      svg.addEventListener("pointerleave", event => { if (event.pointerType !== "touch") group.style.display = "none"; });
      render();
      group.style.display = "none";
    }
    return { control, readout, group, update, bind };
  }

  function enhanceCapacity() {
    const svg = document.getElementById("gauge-title")?.closest("svg");
    if (!svg) return;
    // The labels are the authoritative displayed capacities. Bar widths are
    // rounded, so use each rectangle only to position its highlight.
    const labels = Array.from(svg.querySelectorAll("text"));
    const bars = Array.from(svg.querySelectorAll("rect"));
    const choices = bars.map(bar => {
      const y = Number(bar.getAttribute("y"));
      const row = labels.filter(label => Math.abs(Number(label.getAttribute("y")) - y - 19) < 1);
      return { bar, name: row.find(label => Number(label.getAttribute("x")) === 0)?.textContent,
        value: Number(row.find(label => Number(label.getAttribute("x")) === 520)?.textContent) };
    });
    if (choices.length !== 6 || choices.some(choice => !choice.name || !Number.isFinite(choice.value))) return;
    const view = makeInspector(svg, wikiText("Access type"), choices.map(choice => choice.name));
    if (!view) return;
    function render() {
      const choice = choices[Number(view.control.value)];
      if (!choice) return;
      const x = Number(choice.bar.getAttribute("x")) + Number(choice.bar.getAttribute("width"));
      const y = Number(choice.bar.getAttribute("y")) + Number(choice.bar.getAttribute("height")) / 2;
      view.update([[wikiText("Access"), choice.name], [wikiText("Base capacity"), pretty(choice.value) + " mL/min"]],
        [{ x, y, color: "#55a9fa" }], { left: 110, right: 690, top: 35, bottom: 305 });
    }
    view.bind(render, point => {
      let index = 0;
      let distance = Infinity;
      choices.forEach((choice, i) => {
        const center = Number(choice.bar.getAttribute("y")) + Number(choice.bar.getAttribute("height")) / 2;
        if (Math.abs(center - point.y) < distance) { index = i; distance = Math.abs(center - point.y); }
      });
      view.control.value = index;
      render();
    });
  }

  function enhanceFluidConversion() {
    const svg = document.getElementById("fluid-graph-title")?.closest("svg");
    if (!svg) return;
    const view = makeInspector(svg, wikiText("Time after fluid is present (min)"));
    if (!view) return;
    const input = view.control;
    Object.assign(input, { type: "number", min: "0", max: "25", step: "any", value: "0" });
    // Labelled chart rates: 180 mL/min plasma, 42 mL/min crystalloid.
    // Both start with 1,000 mL present, without losses or a capacity limit.
    const values = minutes => [Math.min(1000, 180 * minutes), Math.min(1000, 42 * minutes)];
    api.fluidConversionValues = minutes => Number.isFinite(minutes) && minutes >= 0 && minutes <= 25 ? values(minutes) : null;
    function render() {
      const minutes = input.value.trim() === "" ? NaN : Number(input.value);
      if (!Number.isFinite(minutes) || minutes < 0 || minutes > 25) {
        view.group.style.display = "none";
        view.readout.textContent = wikiText("Enter a time from 0 to 25 minutes.");
        return;
      }
      const converted = values(minutes);
      const x = 65 + minutes / 25 * 605;
      view.update([[wikiText("Time"), pretty(minutes) + " min"], [wikiText("Plasma"), pretty(converted[0]) + " mL"],
        [wikiText("Crystalloid"), pretty(converted[1]) + " mL"]], converted.map((volume, index) => ({
          x, y: 260 - volume / 1000 * 220, color: ["#55a9fa", "#e5be73"][index]
        })), { left: 65, right: 680, top: 35, bottom: 260 });
    }
    input.addEventListener("keydown", event => {
      const steps = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 };
      if (event.key in steps) {
        event.preventDefault();
        input.value = clamp(Number(input.value) + steps[event.key] * (event.shiftKey ? 5 : 0.1), 0, 25).toFixed(2);
        render();
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        input.value = event.key === "Home" ? "0" : "25";
        render();
      }
    });
    view.bind(render, point => {
      input.value = (clamp((point.x - 65) / 605, 0, 1) * 25).toFixed(2);
      render();
    });
  }

  function enhancePressureSchematic() {
    const svg = document.querySelector("svg.wavefig");
    if (!svg) return;
    const trace = Array.from(svg.querySelectorAll("path")).find(path => path.getAttribute("stroke-width") === "2.6");
    if (!trace) return;
    const points = (trace.getAttribute("d").match(/[ML]\s*[-\d.]+[\s,]+[-\d.]+/gi) || []).map(pair =>
      pair.slice(1).trim().split(/[\s,]+/).map(Number));
    if (points.length < 2 || points.some(pair => pair.length !== 2 || pair.some(value => !Number.isFinite(value)))) return;
    // Existing labelled phase boundaries, in SVG coordinates. This figure has
    // no numeric ticks, so never infer seconds or cmH2O from its artwork.
    const phases = [
      { name: wikiText("Inspiratory flow"), start: 96, end: 246, observation: wikiText("Pressure rises toward its peak") },
      { name: wikiText("Inspiratory pause"), start: 246, end: 400, observation: wikiText("Pressure settles toward a plateau") },
      { name: wikiText("Expiratory flow"), start: 400, end: 534, observation: wikiText("Pressure falls toward PEEP") },
      { name: wikiText("Expiratory pause"), start: 534, end: 600, observation: wikiText("Pressure rests near PEEP") },
      { name: wikiText("Next inspiration"), start: 600, end: 648, observation: wikiText("A new breath begins") }
    ];
    const view = makeInspector(svg, wikiText("Breath phase (schematic)"), phases.map(phase => phase.name));
    if (!view) return;
    function render(at) {
      const phase = phases[Number(view.control.value)];
      const x = Number.isFinite(at) ? clamp(at, 96, 648) : (phase.start + phase.end) / 2;
      const next = points.findIndex(point => point[0] >= x);
      const high = points[Math.max(1, next)];
      const low = points[Math.max(0, next - 1)];
      const y = low[1] + (high[1] - low[1]) * (x - low[0]) / (high[0] - low[0]);
      view.update([[wikiText("Phase"), phase.name]], [{ x, y }], { left: 98, right: 664, top: 50, bottom: 300 });
      const row = document.createElement("span");
      row.textContent = phase.observation + wikiText(". Shape only; time and pressure are not to scale.");
      view.readout.append(row);
    }
    view.bind(render, point => {
      const x = clamp(point.x, 96, 648);
      const index = phases.findIndex(phase => x >= phase.start && x < phase.end);
      view.control.value = index < 0 ? phases.length - 1 : index;
      render(x);
    });
  }

  enhanceCapacity();
  enhanceFluidConversion();
  enhancePressureSchematic();
})();
