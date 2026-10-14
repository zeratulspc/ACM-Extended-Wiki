
/* Offline reference controls. No requests, analytics or stored patient data. */
(function () {
  "use strict";
  function drip(values) {
    var p = values.position, d = values.dropSet, max = values.maximum;
    var curve = values.curve, volume = values.volume, concentration = values.concentration;
    if (![p,d,max,curve,volume,concentration].every(Number.isFinite) ||
        p < 0 || p > 100 || [10,15,20,60].indexOf(d) < 0 ||
        max < 60 || max > 300 || curve < 1 || curve > 4 ||
        volume < 0 || volume > 10000 || concentration < 0 || concentration > 10000) return null;
    var drops = p <= 1 ? 0 : Math.round(max * Math.pow(p / 100, curve) / 5) * 5;
    var rate = drops / d;
    return { drops: drops, rate: rate, hourly: rate * 60, dose: rate * concentration,
      duration: volume === 0 ? 0 : rate > 0 ? volume / rate : null };
  }
  window.ACMEWiki = { calculateDrip: drip };
  var form = document.querySelector("[data-drip-calculator]");
  if (form) {
    var keys = ["position","dropSet","maximum","curve","volume","concentration"], out = {};
    ["drops","rate","hourly","dose","duration","error"].forEach(function (key) {
      out[key] = form.querySelector('[data-result="' + key + '"]');
    });
    function number(value) { return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value); }
    function update() {
      var values = {}, empty = false;
      keys.forEach(function (key) {
        var field = form.elements.namedItem(key);
        if (field.value.trim() === "") empty = true;
        values[key] = Number(field.value);
      });
      var result = empty || !form.checkValidity() ? null : drip(values);
      out.error.hidden = !!result;
      if (!result) {
        out.error.textContent = wikiText("Enter a valid value in every field. Clamp: 0 to 100%; maximum: 60 to 300 gtt/min; exponent: 1 to 4.");
        ["drops","rate","hourly","dose","duration"].forEach(function (key) { out[key].textContent = wikiText("Unavailable"); });
        return;
      }
      out.drops.textContent = number(result.drops) + " gtt/min";
      out.rate.textContent = number(result.rate) + " mL/min";
      out.hourly.textContent = number(result.hourly) + " mL/h";
      out.dose.textContent = number(result.dose) + " mg/min";
      out.duration.textContent = result.duration === null ? wikiText("Stopped") : number(result.duration) + " min";
    }
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    form.addEventListener("submit", function (event) { event.preventDefault(); update(); });
    update();
  }
  function revealAnchor() {
    var id;
    try { id = decodeURIComponent(window.location.hash.slice(1)); } catch (_) { return; }
    if (!id) return;
    var target = document.getElementById(id);
    if (!target) return;
    for (var parent = target; parent; parent = parent.parentElement) {
      if (parent.tagName === "DETAILS") parent.open = true;
    }
    requestAnimationFrame(function () { target.scrollIntoView({ block: "start" }); });
  }
  window.addEventListener("hashchange", revealAnchor);
  revealAnchor();
  var printDetails = [];
  window.addEventListener("beforeprint", function () {
    printDetails = Array.from(document.querySelectorAll("details")).filter(function (d) { return !d.open; });
    printDetails.forEach(function (d) { d.open = true; });
  });
  window.addEventListener("afterprint", function () {
    printDetails.forEach(function (d) { d.open = false; });
    printDetails = [];
  });
  document.addEventListener("keydown", function (event) {
    var el = event.target;
    if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey ||
        el.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return;
    var q = document.getElementById("q"), button = document.getElementById("mSearch");
    if (!q) return;
    event.preventDefault();
    if (window.innerWidth < 820 && button) button.click(); else q.focus();
  });
})();

/* Normalized DO2 illustration for perfusing scenarios at default settings. */
(function () {
"use strict";
function do2(blood,saline=0,plasma=0,hr=75,sat=97,ppv=false,peep=5,dilution=saline){
 const total=Math.max(.1,blood+saline+plasma),v=Math.min(1.1,total/6);
 let sv=Math.pow(v,1.6);
 if(ppv){const empty=1-Math.min(1,v/1.1),pen=Math.max(0,Math.min(1,(empty-.12)/.88))*.35*(1+Math.max(0,Math.min(1,(peep-5)/10))*.5);sv*=Math.max(.25,1-pen);}
 let rate=Math.max(.3,Math.min(1.35,1+(hr/75-1)*.4));
 if(hr>150){const raw=1-Math.max(0,Math.min(1,(hr-150)/70))*.55;rate*=1-(1-raw)*(1-Math.min(1,v));}
 return {sv,co:sv*rate,hb:Math.min(1,blood/Math.max(.1,blood+dilution+plasma)),do2:Math.min(1,blood/Math.max(.1,blood+dilution+plasma))*(sat/100)*sv*rate/.97};
}
window.ACMEWiki.calculateDO2 = function(v) {
 if (!v || !["blood","saline","plasma","heartRate","saturation","peep"].every(k => Number.isFinite(v[k])) || v.blood < .1 || v.blood > 6.6 || v.saline < 0 || v.saline > 6 || v.plasma < 0 || v.plasma > 6 || v.heartRate < 20 || v.heartRate > 220 || v.saturation < 1 || v.saturation > 100 || v.peep < 0 || v.peep > 20 || !["none","bvm","vent"].includes(v.support)) return null;
 return do2(v.blood,v.saline,v.plasma,v.heartRate,v.saturation,v.support!=="none",v.support==="vent"?v.peep:5);
};
const form=document.querySelector("[data-do2-calculator]");
if (!form) return;
const keys=["blood","saline","plasma","heartRate","saturation","peep"], labels={sv:"sv",co:"co",hb:"hb",delivery:"do2"};
function update(){
 const values={support:form.elements.namedItem("support").value};
 let empty=false;
 for(const key of keys){const field=form.elements.namedItem(key);if(field.value.trim()==="")empty=true;values[key]=Number(field.value);}
 const result=empty || !form.checkValidity()?null:window.ACMEWiki.calculateDO2(values);
 const error=form.querySelector('[data-do2-result="error"]');error.hidden=!!result;error.textContent=result?"":wikiText("Enter a valid value in each field to calculate delivery.");
 for(const [label,key] of Object.entries(labels))form.querySelector('[data-do2-result="'+label+'"]').textContent=result?new Intl.NumberFormat(undefined,{maximumFractionDigits:1}).format(result[key]*100)+"%":wikiText("Unavailable");
}
form.addEventListener("input",update);form.addEventListener("change",update);form.addEventListener("submit",e=>{e.preventDefault();update();});update();
})();


(function inspectCharts() {
  "use strict";
  const api = window.ACMEWiki;
  const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
  function medicationEffect(t,peak,hold,duration,route) {
    if (![t,peak,hold,duration].every(Number.isFinite) || peak<=0 || hold<0 ||
        duration<=peak+hold || !["iv","im"].includes(route)) return null;
    if(t<0 || t>=duration) return 0;
    if(t>peak && t<peak+hold) return 1;
    const elapsed=t-peak-hold, elimination=duration-peak-hold;
    const value=t>peak+hold
      ? route==="im" ? 1-(elapsed/elimination)**2 : Math.cos(elapsed/(elimination/3.1))/2+.5
      : route==="im" ? 1.1**(t-peak) : Math.sin(t/(2*peak/3.113));
    return clamp(value,0,1);
  }
  api.medicationEffect = medicationEffect;
  const pretty=(v,d=2)=>new Intl.NumberFormat(undefined,{maximumFractionDigits:d}).format(v);
  // Keep the inspection markers readable as SVG charts shrink on phones.
  api.sizeChartMarkers=(svg,dots)=>{
    const matrix=svg.getScreenCTM();
    const scale=matrix?Math.hypot(matrix.a,matrix.b):1;
    const radius=5.5/(Number.isFinite(scale)&&scale>0?scale:1);
    dots.forEach(dot=>{
      dot.setAttribute("r",radius);
      dot.setAttribute("stroke","#f2e8d2");
      dot.setAttribute("vector-effect","non-scaling-stroke");
    });
  };
  const configs={
    "hemorrhage-delivery":{min:0,max:50,ymax:125,label:wikiText("Blood loss"),unit:"%",names:[wikiText("SV / DO₂ at HR 75"),wikiText("DO₂ at HR 120")],
      values:x=>[100*(1-x/100)**1.6,124*(1-x/100)**1.6]},
    "pressure-bleeding":{min:0,max:160,ymax:2,label:"MAP",unit:"mmHg",names:[wikiText("Active bleeding multiplier")],
      values:x=>[x<=0?1:clamp(x/70,.55,2)],valueUnit:"×"},
    "ppv-delivery":{min:0,max:50,ymax:150,label:wikiText("Blood loss"),unit:"%",names:[wikiText("No PPV"),wikiText("PPV, PEEP 5"),wikiText("PPV, PEEP 15")],
      values:x=>["none","bvm","vent"].map(support=>100*api.calculateDO2({blood:6*(1-x/100),saline:0,plasma:0,heartRate:130,saturation:97,peep:15,support}).do2)},
    "poiseuille-radius":{min:50,max:100,ymax:100,label:wikiText("Relative radius"),unit:"%",names:[wikiText("Ideal relative flow")],
      values:x=>[100*(x/100)**4]},
    "altitude-pressure-gas":{min:0,max:10000,ymax:160,label:wikiText("Corrected altitude"),unit:"ft",names:[wikiText("Ambient pressure"),wikiText("Ideal closed gas volume")],
      values:x=>{const p=(1-2.25577e-5*x*.3048)**5.25588;return[100*p,100/p];}}
  };
  api.chartValues=(id,x)=>configs[id]&&Number.isFinite(x)&&x>=configs[id].min&&x<=configs[id].max ? configs[id].values(x) : null;
  let serial=0;
  document.querySelectorAll(".med-curve,.physiology-chart").forEach(figure=>{
    const med=figure.classList.contains("med-curve"), svg=figure.querySelector("svg");
    if(!svg)return;
    const cfg=med?{min:0,max:Number(figure.dataset.duration),ymax:100,label:wikiText("Time since delivery"),unit:"s",names:[wikiText("Relative game effect")],
      values:t=>[100*medicationEffect(t,Number(figure.dataset.peak),Number(figure.dataset.hold),Number(figure.dataset.duration),figure.dataset.route)]}:configs[figure.dataset.chart];
    if(!cfg || !Number.isFinite(cfg.max))return;
    const left=med?68:72,right=med?690:672,bottom=med?184:238,top=med?40:64;
    const lines=Array.from(svg.querySelectorAll("polyline"));
    if(lines.length!==cfg.names.length)return;
    const ns="http://www.w3.org/2000/svg", group=document.createElementNS(ns,"g");
    group.setAttribute("class","chart-cursor");group.setAttribute("aria-hidden","true");group.style.display="none";
    const guide=document.createElementNS(ns,"line");
    for(const [k,v] of Object.entries({y1:top,y2:bottom,stroke:"#bdcbd9","stroke-dasharray":"3 4","stroke-width":1}))guide.setAttribute(k,v);
    group.append(guide);
    const dots=lines.map(line=>{
      const dot=document.createElementNS(ns,"circle");
      for(const[k,v]of Object.entries({r:5.5,fill:line.getAttribute("stroke"),stroke:"#f2e8d2","stroke-width":2}))dot.setAttribute(k,v);
      group.append(dot);return dot;
    });
    
    const bubble=document.createElementNS(ns,"g"),box=document.createElementNS(ns,"rect");
    const bubbleWidth=270,bubbleHeight=med?68:20+cfg.names.length*18;
    for(const[k,v]of Object.entries({width:bubbleWidth,height:bubbleHeight,rx:5,fill:"#111c29",stroke:"#8ac3fb","stroke-width":1}))box.setAttribute(k,v);
    bubble.append(box);
    const bubbleText=document.createElementNS(ns,"text");
    for(const[k,v]of Object.entries({x:10,y:18,fill:"#f2e8d2","font-size":13}))bubbleText.setAttribute(k,v);
    bubble.append(bubbleText);group.append(bubble);
    // Draw every curve marker above the readout box on charts with several lines.
    dots.forEach(dot=>group.append(dot));
    svg.append(group);svg.classList.add("chart-interactive");
    const panel=document.createElement("div");panel.className="chart-inspector";panel.dataset.noGlossary="";
    const label=document.createElement("label"),input=document.createElement("input"),readout=document.createElement("output");
    input.id="chart-input-"+(++serial);input.type="number";input.min=cfg.min;input.max=cfg.max;input.step="any";
    input.value=cfg.min;label.htmlFor=input.id;label.append(document.createTextNode(cfg.label+" ("+cfg.unit+")"),input);
    readout.id="chart-readout-"+serial;readout.className="chart-readout";readout.setAttribute("aria-live","off");input.setAttribute("aria-describedby",readout.id);
    panel.append(label,readout);figure.insertBefore(panel,figure.querySelector("figcaption"));
    function render(x,fromPointer=false){
      if(!Number.isFinite(x)||x<cfg.min||x>cfg.max){group.style.display="none";readout.textContent=wikiText`Enter a value from ${cfg.min} to ${cfg.max} ${cfg.unit}.`;return;}
      const values=cfg.values(x),px=left+(x-cfg.min)/(cfg.max-cfg.min)*(right-left);
      guide.setAttribute("x1",px);guide.setAttribute("x2",px);
      values.forEach((v,i)=>{dots[i].setAttribute("cx",px);dots[i].setAttribute("cy",bottom-v/cfg.ymax*(bottom-top));});
      api.sizeChartMarkers(svg,dots);
      group.style.display="";
      if(fromPointer)input.value=String(Number(x.toFixed(med?3:2)));
      readout.replaceChildren();
      const row=(label,value)=>{const span=document.createElement("span"),strong=document.createElement("strong");strong.textContent=label+": ";span.append(strong,document.createTextNode(value));readout.append(span);};
      row(cfg.label,pretty(x,3)+" "+cfg.unit+(med&&x>=60?" ("+Math.floor(x/60)+" min "+pretty(x%60,3)+" s)":""));
      if(med)row(wikiText("Delivered reference dose"),figure.dataset.dose);
      
      values.forEach((v,i)=>row(cfg.names[i],pretty(v,3)+(cfg.valueUnit||"%")));
      const bubbleLines=[cfg.label+": "+pretty(x,3)+" "+cfg.unit];
      if(med)bubbleLines.push(wikiText("Dose: ")+figure.dataset.dose);
      values.forEach((v,i)=>bubbleLines.push((med?wikiText("Effect"):cfg.names[i])+": "+pretty(v,3)+(cfg.valueUnit||"%")));
      bubbleText.replaceChildren();
      bubbleLines.forEach((line,i)=>{const t=document.createElementNS(ns,"tspan");t.setAttribute("x",10);t.setAttribute("dy",i?18:0);t.textContent=line;bubbleText.append(t);});
      const by=clamp(bottom-values[0]/cfg.ymax*(bottom-top)-bubbleHeight-8,top,bottom-bubbleHeight);
      bubble.setAttribute("transform","translate("+(px+bubbleWidth+14<right?px+12:Math.max(left,px-bubbleWidth-12))+","+by+")");
    }
    input.addEventListener("input",()=>render(input.value.trim()===""?NaN:Number(input.value)));
    input.addEventListener("keydown",event=>{
      const steps={ArrowLeft:-1,ArrowRight:1,ArrowDown:-1,ArrowUp:1};
      if(event.key in steps){event.preventDefault();input.value=clamp(Number(input.value)+steps[event.key]*(event.shiftKey?10:1),cfg.min,cfg.max);render(Number(input.value));}
      if(event.key==="Home"||event.key==="End"){event.preventDefault();input.value=event.key==="Home"?cfg.min:cfg.max;render(Number(input.value));}
    });
    function locate(event){
      const matrix=svg.getScreenCTM();if(!matrix)return;
      const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;
      const local=point.matrixTransform(matrix.inverse());
      const fraction=clamp((local.x-left)/(right-left),0,1);
      render(cfg.min+fraction*(cfg.max-cfg.min),true);
    }
    svg.addEventListener("pointermove",locate);
    svg.addEventListener("pointerdown",locate);
    svg.addEventListener("pointerleave",event=>{if(event.pointerType!=="touch")group.style.display="none";});
    input.addEventListener("focus",()=>render(input.value.trim()===""?NaN:Number(input.value)));
    render(cfg.min);group.style.display="none";
  });
})();

(function linkGlossary(){
  "use strict";
  const aliases={
    "SVR":"svr","systemic resistance":"svr","hemoglobin":"haemoglobin","haemoglobin":"haemoglobin",
    "DO2":"oxygen-delivery","DO₂":"oxygen-delivery","SpO₂":"spo2","EtCO₂":"etco2","FiO₂":"fio2","PaCO₂":"paco2","PaO₂":"pao2",
    "SV":"stroke-volume","CO":"cardiac-output","HR":"heart-rate","BPM":"bpm",
    "intramuscular":"im","intravenous":"iv","intraosseous":"io","EJ":"ej",
    "AFib":"afib","AF":"afib","atrial fibrillation":"afib","AV-nodal":"av-node","AV node":"av-node","AV-nodal slowing":"av-node",
    "supraventricular tachycardia":"svt","ventricular tachycardia":"vt","ventricular fibrillation":"vf","pulseless electrical activity":"pea",
    "QT prolongation":"qt","prolonged QT":"qt","QT":"qt","QRS":"qrs","R-R":"rr-interval","P-QRS-T":"ecg",
    "systolic":"systolic","diastolic":"diastolic","ventricular":"ventricle","ventricles":"ventricle","atrial":"atrium","atria":"atrium","arteriolar":"arteriole","arterioles":"arteriole",
    "hypocalcemia":"hypocalcaemia","hypocalcemic":"hypocalcaemia","hypocalcaemic":"hypocalcaemia",
    "hypokalemia":"hypokalemia","hypokalaemia":"hypokalemia","hyperkalemia":"hyperkalaemia","hypernatremia":"hypernatraemia",
    "hypovolemia":"hypovolaemia","hypovolemic":"hypovolaemia","hypovolaemic":"hypovolaemia",
    "haemorrhage":"hemorrhage","hemorrhaged":"hemorrhage","haemorrhaged":"hemorrhage","hemorrhaging":"hemorrhage",
    "haemodilution":"hemodilution","haematocrit":"hematocrit","haemostasis":"hemostasis","clotting":"coagulation",
    "hypoxemic":"hypoxemia","hypoxaemia":"hypoxemia","hypoxic":"hypoxia","ischemic":"ischemia","ischaemia":"ischemia",
    "diaphoretic":"diaphoretic","cyanotic":"cyanosis","obtunded":"obtundation","obtundation":"obtundation",
    "tachypneic":"tachypnea","tachypnoea":"tachypnea","bradypneic":"bradypnea","apneic":"apnea","apnoea":"apnea",
    "agonal":"agonal","jaundiced":"jaundice","pinpoint":"miosis","mottling":"mottled",
    "arterial oxygen content":"oxygen-delivery","ionized calcium":"ionised-calcium",
    "coronary perfusion pressure":"coronary-perfusion","cerebral perfusion pressure":"cpp","intracranial pressure":"icp",
    "mean arterial pressure":"map","tidal volumes":"tidal-volume","VTi":"vti","VTe":"vte","MV":"minute-ventilation","RR":"respiratory-rate",
    "positive pressure ventilation":"ppv","positive-pressure ventilation":"ppv","bag valve mask":"bvm","bagging":"bvm",
    "end-tidal carbon dioxide":"etco2","intubate":"intubation","intubated":"intubation","auscultate":"auscultation","auscultating":"auscultation",
    "tachyarrhythmias":"tachyarrhythmia","arrhythmias":"arrhythmia","anticoagulation":"anticoagulation",
    "repolarization":"repolarisation","afterdepolarization":"afterdepolarisation","torsades":"torsades",
    "pressors":"pressor","vasopressor":"pressor","vasopressors":"pressor","catecholamines":"catecholamine",
    "inotropy":"contractility","chronotropic":"chronotropy","titration":"titrate","titrated":"titrate",
    "analgesic":"analgesia","analgesics":"analgesia","sedative":"sedation","sedatives":"sedation","sedated":"sedation",
    "hypnosis":"hypnosis","neuromuscular blockade":"neuromuscular-blocker","paralysis":"paralysis",
    "opioids":"opioid","benzodiazepines":"benzodiazepine","antiarrhythmics":"antiarrhythmic",
    "vesicants":"vesicant","crystalloids":"crystalloid","colloids":"colloid","antifibrinolytics":"antifibrinolytic",
    "diuresis":"diuresis","diuretic":"diuresis","contraindications":"contraindication","patent":"patency",
    "occluded":"occlusion","extravasated":"extravasation","infiltrated":"infiltration",
    "Semi-Fowler’s":"semi-fowlers","Semi-Fowler's":"semi-fowlers","Fowler’s":"fowlers","Fowler's":"fowlers",
    "Boyle’s law":"boyles-law","Boyle's law":"boyles-law","Dalton’s law":"daltons-law","Henry’s law":"henrys-law",
    "Frank–Starling":"frank-starling","Poiseuille":"poiseuille","Poiseuille's law":"poiseuille",
    "Breacher's syndrome":"breachers-syndrome","Breacher’s syndrome":"breachers-syndrome",
    "laminar":"laminar","turbulent":"turbulent","barometric":"barometric","Newtonian":"newtonian"
  };
  const entries=new Map();
  function add(label,slug){
    if(!TERMS[slug]||!label)return;
    entries.set(label.toLowerCase(),{slug,exact:/^[A-Z][A-Z0-9₂]*$/.test(label)?label:null});
  }
  Object.entries(TERMS).forEach(([slug,value])=>{add(value[0],slug);const short=value[0].match(/^(.+?) \(([A-Za-z0-9]+)\)$/);if(short){add(short[1],slug);add(short[2],slug);}});
  Object.entries(aliases).forEach(([label,slug])=>add(label,slug));
  const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const pattern=new RegExp("(?<![\\p{L}\\p{N}])("+Array.from(entries.keys()).sort((a,b)=>b.length-a.length).map(escape).join("|")+")(?![\\p{L}\\p{N}])","giu");
  const root=document.getElementById("mainContent");if(!root)return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{
    acceptNode(node){
      const p=node.parentElement;
      return p&&!p.closest("a,button,summary,script,style,svg,code,pre,input,select,textarea,option,nav,footer,.gl,.glist,[data-no-glossary]")
        &&node.textContent.trim()?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
    }
  });
  const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  nodes.forEach(node=>{
    const text=node.textContent;pattern.lastIndex=0;
    const matches=Array.from(text.matchAll(pattern)).filter(m=>{const e=entries.get(m[0].toLowerCase());return !e.exact||e.exact===m[0];});
    if(!matches.length)return;
    const fragment=document.createDocumentFragment();let at=0;
    for(const m of matches){
      fragment.append(document.createTextNode(text.slice(at,m.index)));
      const term=document.createElement("span");term.className="gl";term.dataset.t=entries.get(m[0].toLowerCase()).slug;
      term.setAttribute("role","button");term.tabIndex=0;term.setAttribute("aria-label",wikiText`Define ${m[0]}`);term.setAttribute("aria-haspopup","dialog");
      term.textContent=m[0];fragment.append(term);at=m.index+m[0].length;
    }
    fragment.append(document.createTextNode(text.slice(at)));node.replaceWith(fragment);
  });
  document.addEventListener("keydown",event=>{
    if(event.target.matches('.gl[role="button"]')&&["Enter"," "].includes(event.key)){event.preventDefault();event.target.click();}
  });
})();
