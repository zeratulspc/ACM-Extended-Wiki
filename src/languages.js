/* English spelling is local. Other choices explicitly open Google's live website translator. */
(function () {
  'use strict';
  const form=document.querySelector('[data-language-picker]');
  if(!form)return;
  const select=form.querySelector('select');
  const button=form.querySelector('[data-language-apply]');
  const note=form.querySelector('[data-language-note]');
  const choices=['en-US','en-GB','ko','de','fr','es','ru'];
  const korean=form.dataset.edition==='ko';
  const key='acmWikiLanguage';
  let selected='en-US';
  try{const saved=localStorage.getItem(key);if(choices.includes(saved))selected=saved;}catch(error){}
  if(korean)selected='ko';
  else if(selected==='ko')selected='en-US';
  const proxyLanguage=new URLSearchParams(location.search).get('_x_tr_tl');
  const isProxy=location.hostname.endsWith('.translate.goog');
  if(isProxy&&choices.includes(proxyLanguage))selected=proxyLanguage;
  select.value=selected;
  const original=new WeakMap();
  const pairs=[
    ['hemorrhage','haemorrhage'],['hemorrhages','haemorrhages'],['hemorrhagic','haemorrhagic'],
    ['hemorrhaging','haemorrhaging'],['hemorrhaged','haemorrhaged'],['hemoglobin','haemoglobin'],['hemothorax','haemothorax'],
    ['hemolysis','haemolysis'],['hemolytic','haemolytic'],['edema','oedema'],['edematous','oedematous'],
    ['hypovolemia','hypovolaemia'],['hypovolemic','hypovolaemic'],['hypervolemia','hypervolaemia'],
    ['hypoxemia','hypoxaemia'],['hypoxemic','hypoxaemic'],['anemia','anaemia'],['anemic','anaemic'],
    ['anesthesia','anaesthesia'],['anesthetic','anaesthetic'],['anesthetics','anaesthetics'],
    ['ischemia','ischaemia'],['ischemic','ischaemic'],['apnea','apnoea'],['dyspnea','dyspnoea'],
    ['liter','litre'],['liters','litres'],['milliliter','millilitre'],['milliliters','millilitres'],
    ['millimeter','millimetre'],['millimeters','millimetres'],['hypocalcemia','hypocalcaemia'],
    ['hypokalemia','hypokalaemia'],['hyperkalemia','hyperkalaemia'],['hypernatremia','hypernatraemia'],
    ['hemodilution','haemodilution'],['hematocrit','haematocrit'],['hemostasis','haemostasis'],
    ['color','colour'],['colors','colours'],['colored','coloured'],['coloring','colouring'],
    ['center','centre'],['centered','centred'],['centers','centres'],['fiber','fibre'],['fibers','fibres'],
    ['behavior','behaviour'],['behaviors','behaviours'],['analyze','analyse'],['analyzing','analysing'],
    ['visualize','visualise'],['visualized','visualised'],['visualization','visualisation'],
    ['stabilize','stabilise'],['stabilized','stabilised'],['stabilization','stabilisation'],
    ['normalization','normalisation'],['organized','organised'],['organize','organise']
  ];
  const lookup=new Map();pairs.forEach(pair=>pair.forEach(word=>lookup.set(word,pair)));
  const pattern=new RegExp('\\b('+[...lookup.keys()].sort((a,b)=>b.length-a.length).join('|')+')\\b','gi');
  function spelling(text,locale){
    return text.replace(pattern,word=>{
      const pair=lookup.get(word.toLowerCase());let replacement=pair[locale==='en-GB'?1:0];
      if(word===word.toUpperCase())replacement=replacement.toUpperCase();
      else if(word[0]===word[0].toUpperCase())replacement=replacement[0].toUpperCase()+replacement.slice(1);
      return replacement;
    });
  }
  let english=selected==='en-GB'?'en-GB':'en-US';
  function translateEnglish(root=document.body){
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){
      return node.parentElement&&!node.parentElement.closest('script,style,code,pre,kbd,input,textarea,[translate="no"],.notranslate')
        ?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
    }});
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      if(!original.has(node))original.set(node,node.textContent);
      const text=spelling(original.get(node),english);
      if(node.textContent!==text)node.textContent=text;
    });
    root.querySelectorAll('[aria-label], [title], [placeholder]').forEach(element=>{
      if(element.closest('[translate="no"],.notranslate,code,pre,kbd'))return;
      for(const name of ['aria-label','title','placeholder'])if(element.hasAttribute(name)){
        element.setAttribute(name,spelling(element.getAttribute(name),english));
      }
    });
    if(!isProxy)document.documentElement.lang=english;
  }
  function sourceUrl(){
    if(!/^https?:$/.test(location.protocol))return null;
    if(/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname))return null;
    const canonical=document.querySelector('link[rel="canonical"]')?.href;
    if(isProxy&&!canonical)return null;
    const url=new URL(isProxy?canonical:location.href);
    for(const key of [...url.searchParams.keys()])if(key.startsWith('_x_tr_'))url.searchParams.delete(key);
    url.hash=location.hash;
    return url;
  }
  function describe(){
    const local=select.value.startsWith('en-')||select.value==='ko';
    button.disabled=!local&&!sourceUrl();
    button.textContent=wikiText(local?'Apply language':'Open translation');
    note.textContent=wikiText(select.value==='ko'?'Authored Korean edition. Available offline.':
      local?'English spelling preference is saved.':
      sourceUrl()?'Automatic translation via Google. Opens a new tab.':'Live translation is available on the published website.');
  }
  select.addEventListener('change',describe);
  form.addEventListener('submit',event=>{
    event.preventDefault();selected=select.value;
    try{localStorage.setItem(key,selected);}catch(error){}
    if(selected==='ko'||(korean&&selected.startsWith('en-'))){
      const target=new URL(selected==='ko'?form.dataset.koreanUrl:form.dataset.englishUrl,isProxy?sourceUrl():location.href);
      target.hash=location.hash;
      if(selected.startsWith('en-'))target.searchParams.set('wiki-language',selected);
      location.href=target.href;return;
    }
    if(selected.startsWith('en-')){
      english=selected;
      if(isProxy){const source=sourceUrl();if(source){source.searchParams.set('wiki-language',selected);window.open(source.href,'_blank','noopener,noreferrer');}return;}
      translateEnglish();note.textContent=wikiText(selected==='en-GB'?'UK English applied.':'US English applied.');
    }else{
      const source=sourceUrl();if(!source){describe();return;}
      const url=new URL('https://translate.google.com/translate');
      url.searchParams.set('sl',korean?'ko':'en');url.searchParams.set('tl',selected);
      url.searchParams.set('hl',selected);url.searchParams.set('u',source.href);
      window.open(url.href,'_blank','noopener,noreferrer');
    }
  });
  const queryEnglish=new URLSearchParams(location.search).get('wiki-language');
  if(!korean&&(queryEnglish==='en-US'||queryEnglish==='en-GB')){
    english=queryEnglish;select.value=queryEnglish;
    try{localStorage.setItem(key,queryEnglish);}catch(error){}
  }
  document.querySelectorAll("code,pre,kbd").forEach(element=>element.setAttribute("translate","no"));
  if(!isProxy&&!korean)translateEnglish();
  // Dynamic definitions and search results receive the same English spelling preference.
  for(const id of ['glpop','qr']){
    const target=document.getElementById(id);if(!target)continue;
    const observer=new MutationObserver(()=>{
      if(isProxy||korean)return;
      observer.disconnect();translateEnglish(target);observer.observe(target,{childList:true,subtree:true});
    });observer.observe(target,{childList:true,subtree:true});
  }
  describe();
})();
