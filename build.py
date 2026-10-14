#!/usr/bin/env python3
"""
PILLAR guide builder.

WHY THIS EXISTS. Every output page is SELF-CONTAINED: css inlined, no external stylesheet, no framework. That is
what lets a card survive being emailed, saved to a phone, opened with no signal, and printed. The cost of that is
duplication, so the duplication is moved to build time: you edit one stylesheet and one layout, run this, and every
page is rewritten.

    python3 build.py

    src/_pillar.css       the stylesheet. Edit once, applies everywhere.
    src/content/*.html    one file per page. Body content ONLY, no <html>, no <style>.
    docs/                 output. This is the folder GitHub Pages serves.

ADDING A PAGE: drop a file in src/content/ and add a line to PAGES below. That is the whole process.
ADDING AN IMAGE: put it in src/img/ and reference it as img/thing.png. build.py copies
                 src/img into docs/img every build, so docs/ can always be deleted safely.
"""
import os, re, datetime, json, sys, shutil
from html import escape

sys.dont_write_bytecode = True   # keep src/ free of __pycache__
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "src"))
from glossary_terms import TERMS
from infusion_guide import render_infusion_guide
from infusion_explorer import render_infusion_explorer
from mixture_guide import render_mixture_guide
from hardcore_medications import render_slow_push_guide, add_push_card_notes
from responsive_tables import responsive_tables
from route_lists import stack_route_lists
from print_reference import render_print_reference
from reading_layout import group_sections, fold_source_notes, heading_marks, plain
from localization import Korean, load as load_korean, translate_level_data

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")
OUT = os.path.join(ROOT, "docs")

VERSION = "1.2.1"
PUBLIC_URL = "https://zeratulspc.github.io/ACM-Extended-Wiki/"
REVIEWED = {"quick-reference", "airway", "ventilator", "accessibility", "zeus", "glossary", "ov_tbi", "ov_chest", "ov_oxygen", "ov_bleeding", "tbi", "obtunded", "blast", "index", "access", "medications", "descriptors", "fluids", "ov_access", "circulation", "settings", "menu", "ov_intro", "ov_circ", "oxygen", "flight", "bleeding", "debug"}

# slug, filename, nav title, nav group.
# Order here is the order in the sidebar. Groups are emitted in first-seen order.
PAGES = [
    ("index", "index.html", "Wiki home", "Quick reference"),
    ("medications", "medications.html", "Medication cards", "Quick reference"),
    ("quick-reference", "quick-reference.html", "Printable charts", "Quick reference"),
    ("access", "access.html", "IV access & infusions", "Quick reference"),
    ("fluids", "fluids.html", "Fluids & blood volume", "Quick reference"),
    ("descriptors", "descriptors.html", "Clinical descriptors", "Quick reference"),
    ("glossary", "glossary.html", "Glossary", "Quick reference"),
    ("ventilator", "ventilator.html", "Ventilator Settings & Tips", "Systems"),
    ("airway", "airway.html", "Airway & Breathing", "Systems"),
    ("oxygen", "oxygen.html", "Oxygen Delivery (DO2)", "Systems"),
    ("bleeding", "bleeding.html", "Haemorrhage & Shock", "Systems"),
    ("circulation", "circulation.html", "Cardiac rhythms", "Systems"),
    ("tbi", "tbi.html", "Traumatic Brain Injury", "Systems"),
    ("obtunded", "obtunded.html", "Obtunded states", "Systems"),
    ("blast", "blast.html", "Blast overpressure", "Systems"),
    ("flight", "flight.html", "Flight Physiology", "Systems"),
    ("menu", "menu.html", "Medical Menu", "Interface"),
    ("accessibility", "accessibility.html", "Accessibility", "Interface"),
    ("settings", "settings.html", "Settings reference", "Reference"),
    ("zeus", "zeus.html", "Zeus modules", "Reference"),
    ("debug", "debug.html", "Debug menu", "Reference"),
    ("ov_intro", "ov_intro.html", "How systems connect", "Further reference"),
    ("ov_bleeding", "ov_bleeding.html", "Bleeding & resuscitation", "Further reference"),
    ("ov_oxygen", "ov_oxygen.html", "Oxygen readings", "Further reference"),
    ("ov_circ", "ov_circ.html", "Rhythm treatment reference", "Further reference"),
    ("ov_chest", "ov_chest.html", "Breathing support", "Further reference"),
    ("ov_tbi", "ov_tbi.html", "Head injury assessment", "Further reference"),
    ("ov_access", "ov_access.html", "Flow calculation reference", "Further reference"),
]

HEAD = """<!DOCTYPE html>
<html lang="en-US">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Cache-Control" content="no-cache, must-revalidate">
<title>{title}</title>
<link rel="canonical" href="{canonical}">
<link rel="alternate" hreflang="en" href="{english_url}">
<link rel="alternate" hreflang="ko" href="{korean_url}">
<link rel="icon" type="image/png" href="img/acme-favicon.png">
<style>
{css}
</style>
<script>
/* Runs before the body paints. Without this the page renders warm, then snaps to black once the
   footer script gets to run, which is worse than having no night mode at all. */
try{{if(localStorage.getItem('pillarNight')==='1'){{document.documentElement.className='night';}}}}catch(e){{}}
</script>
</head>
<body>
<a class="skip-link" href="#mainContent">Skip to content</a>
<header class="mbar" id="mbar">
  <button type="button" class="mbar-burger" id="navBtn" aria-label="Open navigation" aria-expanded="false" aria-controls="sideNav">
    <span></span><span></span><span></span>
  </button>
  <a class="mbar-home" href="index.html">ACM Extended</a>
  <button type="button" class="mbar-search" id="mSearch" aria-label="Search">
    <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="2"/>
      <path d="M12.8 12.8 L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  </button>
</header>
<div class="nav-scrim" id="navScrim"></div>
<div class="tb-veil" id="veil"></div>
<div class="shell">
"""

FOOT = r"""
<footer>
  ACM Extended Wiki / Source build {version} / Updated {built}
</footer>
</main>
</div>
<div id="glpop" class="glpop" role="dialog" aria-label="Medical term definition" hidden>
  <div class="glpop-in">
    <div class="glpop-t"></div>
    <div class="glpop-d"></div>
    <button type="button" class="glpop-x">Close</button>
  </div>
</div>
<script>
var ACM_MESSAGES={messages};
function wikiText(strings,...values){{
  if(typeof strings==='string'){{
    if(document.documentElement.lang==='ko' && !Object.hasOwn(ACM_MESSAGES,strings)) (window.ACM_TRANSLATION_MISSING ||= new Set()).add(strings);
    return Object.hasOwn(ACM_MESSAGES,strings) ? ACM_MESSAGES[strings] : strings;
  }}
  var key=Array.from(strings).map(function(part,i){{return part+(i<values.length?'{{'+i+'}}':'');}}).join('');
  if(document.documentElement.lang==='ko' && !Object.hasOwn(ACM_MESSAGES,key)) (window.ACM_TRANSLATION_MISSING ||= new Set()).add(key);
  var text=Object.hasOwn(ACM_MESSAGES,key) ? ACM_MESSAGES[key] : key;
  return text.replace(/\{{(\d+)\}}/g,function(_,i){{return String(values[Number(i)]);}});
}}
var TERMS={terms};
var IDX={index};
(function(){{
  var pop=document.getElementById('glpop');
  var t=pop.querySelector('.glpop-t'), d=pop.querySelector('.glpop-d');
  var closeT=null;
  function open(slug){{
    if(closeT){{ clearTimeout(closeT); closeT=null; }}
    var e=TERMS[slug]; if(!e) return;
    t.textContent=e[0]; d.textContent=e[1];
    pop.hidden=false; void pop.offsetHeight; requestAnimationFrame(function(){{pop.classList.add('on');}});
  }}
  function close(){{
    pop.classList.remove('on');
    if(closeT) clearTimeout(closeT);
    clearArm();
    closeT=setTimeout(function(){{pop.hidden=true;closeT=null;}},120);
  }}

  // HOVER TO OPEN after a deliberate pause, so passing the cursor over a term does not fire it.
  // Clicking still opens immediately. Touch devices never fire mouseenter, so they get the click path.
  var hoverT=null, armed=null;
  function clearArm(){{
    if(hoverT){{ clearTimeout(hoverT); hoverT=null; }}
    if(armed){{ armed.classList.remove('arming'); armed=null; }}
  }}
  document.addEventListener('mouseover',function(ev){{
    var b=ev.target.closest('.gl');
    if(!b || b===armed) return;
    clearArm();
    armed=b; b.classList.add('arming');
    hoverT=setTimeout(function(){{ open(b.dataset.t); clearArm(); }},1000);
  }});
  document.addEventListener('mouseout',function(ev){{
    var b=ev.target.closest('.gl');
    if(b && b===armed) clearArm();
  }});

  document.addEventListener('click',function(ev){{
    var b=ev.target.closest('.gl');
    if(b){{ ev.preventDefault(); clearArm(); open(b.dataset.t); return; }}
    if(ev.target.closest('.glpop-x') || ev.target===pop) close();
  }});
  document.addEventListener('keydown',function(ev){{ if(ev.key==='Escape') close(); }});

  var q=document.getElementById('q'), qr=document.getElementById('qr');
  function esc(s){{return s.replace(/[&<>]/g,function(c){{return {{'&':'&amp;','<':'&lt;','>':'&gt;'}}[c];}});}}
  function run(){{
    var v=q.value.trim().toLowerCase();
    if(v.length<2 && !(document.documentElement.lang==='ko' && /[가-힣]/.test(v))){{ qr.hidden=true; qr.innerHTML=''; return; }}
    var words=v.split(/\s+/), hits=[];
    for(var i=0;i<IDX.length;i++){{
      var r=IDX[i], hay=(r.h+' '+r.p+' '+r.t).toLowerCase(), sc=0, ok=true;
      for(var w=0;w<words.length;w++){{
        if(hay.indexOf(words[w])<0){{ ok=false; break; }}
        if(r.h.toLowerCase().indexOf(words[w])>=0) sc+=10;
        if(r.p.toLowerCase().indexOf(words[w])>=0) sc+=4;
        sc+=1;
      }}
      if(ok){{
        var k=r.t.toLowerCase().indexOf(words[0]);
        var sn=k<0?r.t.slice(0,120):r.t.slice(Math.max(0,k-50),k+90);
        hits.push({{r:r,s:sc,sn:sn}});
      }}
    }}
    hits.sort(function(a,b){{return b.s-a.s;}});
    if(!hits.length){{ qr.innerHTML='<div class="tb-none">'+wikiText('Nothing found')+'</div>'; qr.hidden=false; placeRes(); return; }}
    qr.innerHTML=hits.slice(0,12).map(function(h){{
      var href=h.r.f+(h.r.a?'#'+h.r.a:'');
      return '<a href="'+href+'"><span class="tb-p">'+esc(h.r.p)+'</span>'+
             '<span class="tb-h">'+esc(h.r.h)+'</span>'+
             '<span class="tb-s">'+esc(h.sn)+'</span></a>';
    }}).join('');
    qr.hidden=false;
    placeRes();
  }}
  // SECTION BAR. Tracks which section is in view, fills a progress line, and collapses to a thin strip
  // once the reader is past the top. Read-only apart from the toggle, so it cannot block the page.
  var sb=document.getElementById('secbar');
  if(sb){{
    var list=document.getElementById('sbList'), now=document.getElementById('sbNow');
    var cur=document.getElementById('sbCur'), prog=document.getElementById('sbProg');
    var links=[].slice.call(list.querySelectorAll('a'));
    var heads=links.map(function(a){{ return document.getElementById(a.dataset.a); }});
    var tick=false;
    function spy(){{
      var y=window.scrollY, best=0;
      for(var i=0;i<heads.length;i++){{ if(heads[i] && heads[i].getBoundingClientRect().top<=120) best=i; }}
      links.forEach(function(a,i){{ a.classList.toggle('on', i===best); }});
      if(cur.textContent!==links[best].textContent) cur.textContent=links[best].textContent;
      var doc=document.documentElement.scrollHeight-window.innerHeight;
      prog.style.width=(doc>0 ? Math.min(100,(y/doc)*100) : 0)+'%';
      sb.classList.toggle('thin', y>90);
      tick=false;
    }}
    window.addEventListener('scroll',function(){{
      if(!tick){{ tick=true; requestAnimationFrame(spy); }}
    }},{{passive:true}});
    now.addEventListener('click',function(){{
      var open=list.hidden;
      list.hidden=!open;
      now.setAttribute('aria-expanded', open?'true':'false');
      sb.classList.toggle('open', open);
    }});
    list.addEventListener('click',function(ev){{
      if(ev.target.tagName==='A'){{
        list.hidden=true; sb.classList.remove('open');
        now.setAttribute('aria-expanded','false');
      }}
    }});
    document.addEventListener('click',function(ev){{
      if(!ev.target.closest('.secbar') && !list.hidden){{
        list.hidden=true; sb.classList.remove('open');
        now.setAttribute('aria-expanded','false');
      }}
    }});
    // A page restored from the back/forward cache keeps the DOM as it was left, so a list
    // left open would come back open. Same reason the search box is reset on pageshow.
    function sbShut(){{
      list.hidden=true; sb.classList.remove('open');
      now.setAttribute('aria-expanded','false');
    }}
    window.addEventListener('pageshow',sbShut);
    document.addEventListener('keydown',function(ev){{
      if(ev.key==='Escape' && !list.hidden) sbShut();
    }});
    window.addEventListener('resize',spy);
    spy();
  }}

  // SIDEBAR SUBNAV. Marks which section of the current page is in view. Kept independent of the
  // section bar above, so it still works on a page with too few headings to be given one.
  var sn=document.querySelector('.subnav');
  if(sn){{
    var sLinks=[].slice.call(sn.querySelectorAll('a'));
    var sHeads=sLinks.map(function(a){{ return document.getElementById(a.dataset.s); }});
    var sTick=false;
    function sspy(){{
      var y=window.scrollY, best=0;
      for(var i=0;i<sHeads.length;i++){{ if(sHeads[i] && sHeads[i].getBoundingClientRect().top<=120) best=i; }}
      sLinks.forEach(function(a,i){{ a.classList.toggle('on', i===best); }});
      sTick=false;
    }}
    window.addEventListener('scroll',function(){{
      if(!sTick){{ sTick=true; requestAnimationFrame(sspy); }}
    }},{{passive:true}});
    window.addEventListener('resize',sspy);
    sspy();
  }}

  // NIGHT MODE. Backgrounds only. The class is already on <html> from the head script if it was
  // left on, so this just keeps the button in step and writes the choice back.
  var nb=document.getElementById('nightBtn');
  if(nb){{
    function nightSet(on){{
      document.documentElement.classList.toggle('night',on);
      nb.setAttribute('aria-pressed',on?'true':'false');
    }}
    nightSet(document.documentElement.classList.contains('night'));
    nb.addEventListener('click',function(){{
      var on=!document.documentElement.classList.contains('night');
      nightSet(on);
      // Storage can be blocked entirely by browser settings. Losing the preference between pages is
      // survivable, a thrown error that halts the rest of this script is not.
      try{{ localStorage.setItem('pillarNight',on?'1':'0'); }}catch(e){{}}
    }});
  }}

  var veil=document.getElementById('veil');
  function focusMode(on){{ veil.classList.toggle('on',on); }}
  function dismiss(){{ qr.hidden=true; focusMode(false); q.blur(); }}

  // RESET ON ARRIVAL. A page restored from the back/forward cache keeps the DOM exactly as it was left,
  // including a focused search box and a lit veil, which locked the page until a manual reload. Clearing
  // on pageshow covers both a fresh load and a restore.
  window.addEventListener('pageshow',function(){{
    qr.hidden=true; veil.classList.remove('on');
    if(document.activeElement===q) q.blur();
  }});

  // SEARCH PANEL PLACEMENT. Fixed positioning escapes the sidebar's overflow clipping, but fixed
  // coordinates are viewport relative, so the panel has to be told where the input is. The input
  // moves when the sidebar scrolls or the window resizes, hence the listeners.
  function placeRes(){{
    if(window.innerWidth < 820){{ qr.style.left=''; qr.style.top=''; return; }}
    var r=q.getBoundingClientRect();
    qr.style.left=Math.round(r.left)+'px';
    qr.style.top=Math.round(r.bottom+6)+'px';
  }}
  var sideEl=document.querySelector('.side');
  if(sideEl) sideEl.addEventListener('scroll',function(){{ if(!qr.hidden) placeRes(); }},{{passive:true}});
  window.addEventListener('resize',function(){{ if(!qr.hidden) placeRes(); }});

  q.addEventListener('input',run);
  q.addEventListener('focus',function(){{ focusMode(true); run(); }});
  q.addEventListener('blur',function(){{ setTimeout(function(){{
    if(!qr.matches(':hover')) focusMode(false);
  }},120); }});
  veil.addEventListener('click',dismiss);
  document.addEventListener('click',function(ev){{
    if(!ev.target.closest('.tb-wrap') && !ev.target.closest('.tb-veil')) {{ qr.hidden=true; focusMode(false); }}
  }});
  q.addEventListener('keydown',function(ev){{ if(ev.key==='Escape') dismiss(); }});

  }})();

/* ---- MOBILE NAV DRAWER -------------------------------------------------------------------------
   Off canvas below the breakpoint. Everything that opens it also closes it, because a drawer you can
   only dismiss one way is a trap on a phone: the hamburger toggles, the scrim closes, Escape closes,
   and following any link closes so you never land on the new page with the nav still over it. */
(function(){{
  var btn=document.getElementById('navBtn'),
      scr=document.getElementById('navScrim'),
      side=document.getElementById('sideNav'),
      msearch=document.getElementById('mSearch');
  if(!btn||!side) return;
  var lastFocus=null;
  function setOpen(on){{
    var mobile=window.innerWidth<820;
    side.inert=mobile&&!on;
    var main=document.querySelector('main');
    if(main) main.inert=mobile&&on;
    document.body.classList.toggle('nav-open',on);
    btn.setAttribute('aria-expanded',on?'true':'false');
    if(on){{
      lastFocus=document.activeElement;
      var first=side.querySelector('a,button,input');
      if(first) first.focus();
    }}
    else if(lastFocus&&lastFocus.focus){{ lastFocus.focus(); }}
  }}
  btn.addEventListener('click',function(){{ setOpen(!document.body.classList.contains('nav-open')); }});
  if(scr) scr.addEventListener('click',function(){{ setOpen(false); }});
  document.addEventListener('keydown',function(ev){{ if(ev.key==='Escape') setOpen(false); }});
  /* Any nav link closes it. Same page anchors would otherwise leave the drawer covering the section
     it just scrolled to. */
  side.addEventListener('click',function(ev){{
    if(ev.target.closest&&ev.target.closest('a')) setOpen(false);
  }});
  /* The search button opens the drawer and puts the cursor in the field, so search is one tap from
     the top bar rather than hidden behind the menu. */
  if(msearch) msearch.addEventListener('click',function(){{
    setOpen(true);
    var q=document.getElementById('q');
    if(q) setTimeout(function(){{ q.focus(); }},280);
  }});
  /* Rotating to a wide screen must not leave the body locked from a drawer that no longer exists. */
  var mq=window.matchMedia('(min-width:820px)');
  function sync(){{
    if(mq.matches) setOpen(false);
    else side.inert=!document.body.classList.contains('nav-open');
  }}
  document.addEventListener('keydown',function(ev){{
    if(ev.key!=='Tab'||mq.matches||!document.body.classList.contains('nav-open')) return;
    var items=[btn].concat([].slice.call(side.querySelectorAll('a,button,input,select,[tabindex="0"]')));
    items=items.filter(function(el){{return !el.disabled&&el.getClientRects().length;}});
    var index=items.indexOf(document.activeElement), next=index+(ev.shiftKey?-1:1);
    if(index<0||next<0||next>=items.length){{
      ev.preventDefault();
      (ev.shiftKey?items[items.length-1]:items[0]).focus();
    }}
  }});
  sync();
  if(mq.addEventListener) mq.addEventListener('change',sync); else if(mq.addListener) mq.addListener(sync);
}})();

</script>
<script>
{reference_js}
</script>
</body>
</html>
"""




def apply_terms(body):
    """{{slug}} or {{slug|shown text}} becomes a clickable term. Unknown slugs are reported rather than
    silently rendered as literal braces, because a typo would otherwise ship as visible junk."""
    missing = []

    def sub(m):
        raw = m.group(1)
        slug, _, shown = raw.partition("|")
        slug = slug.strip()
        if slug not in TERMS:
            missing.append(slug)
            return shown or slug
        label = shown.strip() if shown else TERMS[slug][0]
        return f'<button type="button" class="gl" data-t="{slug}">{label}</button>'

    return re.sub(r"\{\{([^}]+)\}\}", sub, body), missing


def add_anchors(body):
    """Give every h2 an id so search results and the sidebar can deep link to a section."""
    def sub(m):
        text = re.sub(r"<[^>]+>", "", m.group(1))
        slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
        return f'<h2 id="{slug}">{m.group(1)}</h2>'
    return re.sub(r"<h2>(.*?)</h2>", sub, body)


def group_field_labels(body):
    """Keep a caption in one layout row even when glossary terms are inserted."""
    def group(m):
        caption = m.group(2)
        if not caption.strip() or 'ref-label-text' in caption:
            return m.group(0)
        return m.group(1) + '<span class="ref-label-text">' + caption + '</span>'
    return re.sub(r'(<label\b[^>]*>)((?:(?!</label>).)*?)(?=<(?:input|select|textarea)\b)', group, body, flags=re.S)


def add_card_anchors(body):
    """Give drug cards and injury cards ids too. On a page like medications the h2 sections are only
    scaffolding and the real navigation targets are the 19 cards, so the rail needs to reach them."""
    def drug(m):
        slug = re.sub(r"[^a-z0-9]+", "-", m.group(1).lower()).strip("-")
        return f'<div class="drug" id="d-{slug}"><header><span class="dn">{m.group(1)}</span>'
    body = re.sub(r'<div class="drug">\s*<header><span class="dn">([^<]+)</span>', drug, body)

    def inj(m):
        slug = re.sub(r"[^a-z0-9]+", "-", m.group(1).lower()).strip("-")
        return f'<article class="icard" id="c-{slug}"><header><span class="iname">{m.group(1)}</span>'
    body = re.sub(r'<article class="icard">\s*<header><span class="iname">([^<]+)</span>', inj, body)
    return body


def toc(body):
    """Sticky section bar. Sits at the top of the content column, opaque so nothing shows through it,
    and collapses to a thin strip as the reader scrolls. Parent topics, marked subsections and
    named cards follow the same order as the article."""
    marks = [(position, kind, anchor, label) for position, kind, anchor, label, _ in heading_marks(body)]
    for m in re.finditer(r'id="d-([\w-]+)"><header><span class="dn">([^<]+)<', body):
        marks.append((m.start(), "sub", "d-" + m.group(1), m.group(2).strip()))
    for m in re.finditer(r'id="c-([\w-]+)"><header><span class="iname">([^<]+)<', body):
        marks.append((m.start(), "sub", "c-" + m.group(1), m.group(2).strip()))
    marks.sort()
    if len(marks) < 2:
        return ""
    out = ['<div class="secbar" id="secbar">',
           '  <div class="sb-in">',
           '    <button type="button" class="sb-now" id="sbNow" aria-expanded="false">',
           '      <span class="sb-lab">On this page</span>',
           '      <span class="sb-cur" id="sbCur"></span>',
           '      <span class="sb-caret"></span>',
           '    </button>',
           '    <div class="sb-prog"><i id="sbProg"></i></div>',
           '  </div>',
           '  <nav class="sb-list" id="sbList" hidden>']
    for _, kind, anchor, label in marks:
        cls = ' class="sub"' if kind == "sub" else ""
        out.append(f'    <a{cls} href="#{anchor}" data-a="{anchor}">{escape(label)}</a>')
    out += ["  </nav>", "</div>"]
    return "\n".join(out)


def index_page(slug, fname, title, body, translator=None):
    """One search record per section: page, heading, anchor, and the visible text under it."""
    recs = []
    marks = heading_marks(body)
    lead = plain(body[:marks[0][0]] if marks else body)
    recs.append({"p": title, "f": fname, "a": "", "h": title,
                 "t": re.sub(r"\s+", " ", lead).strip()[:900]})
    for i, (_, _, anchor, head, end) in enumerate(marks):
        next_start = marks[i + 1][0] if i + 1 < len(marks) else len(body)
        txt = plain(body[end:next_start])
        recs.append({"p": title, "f": fname, "a": anchor, "h": head,
                     "t": re.sub(r"\s+", " ", txt).strip()[:900]})
    # Index each medication card separately, including cards deep inside one h2 section.
    cards = list(re.finditer(r'<div class="drug" id="([^"]+)"><header><span class="dn">([^<]+)</span>', body))
    for i, match in enumerate(cards):
        end = cards[i + 1].start() if i + 1 < len(cards) else len(body)
        next_section = re.search(r'<h2 id="', body[match.end():end])
        if next_section:
            end = match.end() + next_section.start()
        chunk = re.sub(r"<svg\b[^>]*>.*?</svg>", " ", body[match.start():end], flags=re.S)
        text = re.sub(r"<[^>]+>", " ", chunk)
        recs.append({"p": title, "f": fname, "a": match.group(1), "h": match.group(2),
                     "t": re.sub(r"\s+", " ", text).strip()[:4000]})
    # Infusion rows remain individually searchable beyond the section excerpt.
    for match in re.finditer(r'<tr\b(?=[^>]* id="([^"]+)")(?=[^>]* data-infusion="([^"]+)")[^>]*>(.*?)</tr>', body, re.S):
        text = re.sub(r"<[^>]+>", " ", match.group(3))
        infusion_title = translator.text(match.group(2)) + " 지속 주입" if translator else match.group(2) + " infusion"
        recs.append({"p": title, "f": fname, "a": match.group(1), "h": infusion_title,
                     "t": re.sub(r"\s+", " ", text).strip()[:1500]})
    # Keep individual settings and push times discoverable beyond the section excerpt.
    for match in re.finditer(r'<details\b(?=[^>]* id="([^"]+)")(?=[^>]* data-hardcore-setting=)[^>]*>(.*?)</details>', body, re.S):
        heading = re.search(r'<span class="dd-name">(.*?)</span>', match.group(2), re.S)
        if not heading:
            continue
        text = re.sub(r"<[^>]+>", " ", match.group(2))
        recs.append({"p": title, "f": fname, "a": match.group(1),
                     "h": re.sub(r"<[^>]+>", "", heading.group(1)),
                     "t": re.sub(r"\s+", " ", text).strip()[:1800]})
    for match in re.finditer(r'<tr\b(?=[^>]* id="(slow-push-[^"]+)")(?=[^>]* data-push-default=)[^>]*>(.*?)</tr>', body, re.S):
        heading = re.search(r'<th\b[^>]*>.*?<a\b[^>]*>(.*?)</a>', match.group(2), re.S)
        if not heading:
            continue
        text = re.sub(r"<[^>]+>", " ", match.group(2))
        recs.append({"p": title, "f": fname, "a": match.group(1),
                     "h": re.sub(r"<[^>]+>", "", heading.group(1)) + (" 수동 주입 시간" if translator else " push time"),
                     "t": re.sub(r"\s+", " ", text).strip()[:1500]})
    return recs


def glossary_page():
    """Generated from TERMS so the glossary and the popups can never disagree."""
    out = ['<div class="eyebrow">PILLAR <span class="tag">//</span> REFERENCE</div>',
           "<h1>Glossary</h1>",
           '<p class="lede">Every advanced term used in this guide, in plain language. Anywhere a term appears '
           "underlined you can tap it to see this same definition without leaving the page.</p>",
           '<div class="rule"></div>',
           '<section class="sec"><div class="sec-head"><span class="sec-num">01</span><h2>All Terms</h2></div>',
           '<div class="glist">']
    for slug in sorted(TERMS, key=lambda k: TERMS[k][0].lower()):
        name, desc = TERMS[slug]
        out.append(f'  <div class="gitem" id="term-{slug}"><div class="gt">{name}</div><div class="gd">{desc}</div></div>')
    out += ["</div>", "</section>"]
    return "\n".join(out)


def page_sections(body):
    """Topic and subsection anchors. Only the page being viewed gets these in the sidebar, so the nav stays
    a list of pages rather than expanding into a full site outline."""
    return [(anchor, label, kind) for _, kind, anchor, label, _ in heading_marks(body)]


def sidebar(current, sections=(), locale='en'):
    """Sidebar nav, with the sections of the current page nested under its own link. Search sits at
    the top. Sub links are same page anchors, so following one never reloads."""
    out = ['<aside class="side" id="sideNav">',
           '  <div class="side-head">',
           '    <a class="brand-text" href="index.html"><img class="brand-logo" src="img/acme-logo.png" width="112" height="112" alt="ACM Extended logo">ACM Extended<small>Game reference</small></a>',
           f'    <div class="ver">Source build {VERSION}</div>',
           '  </div>',
           '  <div class="tb-wrap">',
           '    <input id="q" class="tb-q" type="search" placeholder="Search the wiki" aria-label="Search the wiki" autocomplete="off" spellcheck="false">',
           '    <div id="qr" class="tb-res" hidden></div>',
           '  </div>',
           f'  <form class="language-picker notranslate" data-language-picker data-edition="{locale}" data-english-url="{"../" if locale == "ko" else ""}{current}.html" data-korean-url="{"" if locale == "ko" else "ko/"}{current}.html" translate="no">',
           '    <label for="wiki-language">Language</label>',
           '    <select id="wiki-language" name="language" aria-describedby="language-note">',
           '      <option value="en-US" lang="en-US">English (US)</option>',
           '      <option value="en-GB" lang="en-GB">English (UK)</option>',
           '      <option value="ko" lang="ko">한국어</option>',
           '      <option value="de" lang="de">Deutsch</option>',
           '      <option value="fr" lang="fr">Français</option>',
           '      <option value="es" lang="es">Español</option>',
           '      <option value="ru" lang="ru">Русский</option>',
           '    </select>',
           '    <button type="submit" data-language-apply>Apply language</button>',
           '    <p id="language-note" data-language-note role="status">Choose a language, then apply.</p>',
           '    <noscript>Enable JavaScript to use language options.</noscript>',
           '  </form>',
           f'  <a class="edition-link" href="{"../" if locale == "ko" else "ko/"}{current}.html" lang="{"en" if locale == "ko" else "ko"}">{"English edition" if locale == "ko" else "한국어판"}</a>',
           '  <nav class="nav">']
    seen = []
    for slug, fname, title, group in PAGES:
        if group not in seen:
            seen.append(group)
            out.append(f'    <div class="grp">{group}</div>')
        cls = ' class="on" aria-current="page"' if slug == current else ""
        out.append(f'    <a{cls} href="{fname}">{title}</a>')
        if slug == current and sections:
            out.append('    <div class="subnav">')
            for anchor, label, kind in sections:
                nested = ' class="nested-section"' if kind == 'sub' else ''
                out.append(f'      <a{nested} href="#{anchor}" data-s="{anchor}">{escape(label)}</a>')
            out.append('    </div>')
    out += ['  </nav>',
            '  <button type="button" class="nightbtn" id="nightBtn" aria-pressed="false">',
            '    <span class="nb-lab">Night mode</span>',
            '    <span class="nb-sw"><i></i></span>',
            '  </button>',
            '</aside>', f'<main class="main page-{current}" id="mainContent" tabindex="-1">']
    return "\n".join(out)


def build(english_only=False):
    retired = os.path.join(OUT, "ov_traps.html")
    if os.path.isfile(retired):
        os.remove(retired)
    css = "\n".join(open(os.path.join(SRC, name), encoding="utf-8").read()
                    for name in ("_pillar.css", "visual-reference.css", "slideshow.css", "capnography.css", "rhythm-waveforms.css", "chest-seal.css", "languages.css", "infusion-guide.css", "infusion-explorer.css", "mixture-guide.css", "hardcore-reference.css", "route-lists.css", "mobile-layout.css", "reading-layout.css", "print-reference.css")
                    if os.path.isfile(os.path.join(SRC, name)))
    reference_js = "\n".join(open(os.path.join(SRC, name), encoding="utf-8").read()
                             for name in ("reference.js", "slideshow.js", "chart-readouts.js", "suction-guide.js", "capnography.js", "rhythm-waveforms.js", "chest-seal.js", "languages.js", "infusion-guide.js", "infusion-explorer.js", "mixture-guide.js", "print-reference.js", "reading-layout.js")
                             if os.path.isfile(os.path.join(SRC, name)))
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(os.path.join(OUT, "img"), exist_ok=True)

    # IMAGES. src/img is the source of truth and docs/img is a copy, rebuilt from it every time.
    # These used to live only in docs/img, which is build output: the documented fix for stale
    # inlined CSS is to delete docs/ wholesale, and that silently took every image with it.
    # Source and output must not share a directory.
    src_img = os.path.join(SRC, "img")
    copied = 0
    if os.path.isdir(src_img):
        for directory, _, filenames in os.walk(src_img):
            for fn in sorted(filenames):
                s = os.path.join(directory, fn)
                relative = os.path.relpath(s, src_img)
                target = os.path.join(OUT, "img", relative)
                os.makedirs(os.path.dirname(target), exist_ok=True)
                shutil.copy2(s, target)
                copied += 1
    audio_src = os.path.join(SRC, "audio")
    if os.path.isdir(audio_src):
        shutil.copytree(audio_src, os.path.join(OUT, "audio"), dirs_exist_ok=True)
    built = datetime.date.today().isoformat()

    # PASS 1: read and transform every body, and build the search index from the result.
    bodies, index, missing, badterms = {}, [], [], []
    for slug, fname, title, group in PAGES:
        if slug == "glossary":
            body = glossary_page()
        elif slug == "quick-reference":
            body = render_print_reference()
        else:
            cpath = os.path.join(SRC, "content", slug + ".html")
            if not os.path.exists(cpath):
                missing.append(slug)
                continue
            body = open(cpath, encoding="utf-8").read()
            if "<!-- INFUSION_RANGES -->" in body:
                body = body.replace("<!-- INFUSION_RANGES -->", render_infusion_guide())
                body = body.replace("<!-- INFUSION_EXPLORER -->", render_infusion_explorer())
                body = body.replace("<!-- MEDICATION_MIXTURES -->", render_mixture_guide())
                body = body.replace("<!-- SLOW_PUSH_GUIDE -->", render_slow_push_guide())
        if slug not in REVIEWED:
            body = ('<div class="article-status">This article is retained from the previous guide '
                    'and awaits review against the current fork. See the '
                    '<a href="index.html#article-revision">article revision notes</a>.</div>') + body
        body = body.replace("PILLAR", "ACM EXTENDED")
        if slug == "medications":
            body = add_push_card_notes(body)
        body = stack_route_lists(body)
        body, miss = apply_terms(body)
        badterms += [(slug, m) for m in miss]
        body = group_field_labels(body)
        body = add_anchors(body)
        body = add_card_anchors(body)
        body = group_sections(slug, body)
        if slug not in {"quick-reference", "glossary"}:
            body = fold_source_notes(body)
        body = responsive_tables(body)
        bodies[slug] = body
        index += index_page(slug, fname, title, body)

    # PASS 2: write both static editions. Indexes and definitions are inlined,
    # searches when opened from disk with no server behind it.
    idx_json = json.dumps(index, separators=(",", ":"))
    terms_json = json.dumps({k: list(v) for k, v in TERMS.items()}, separators=(",", ":"))
    for slug, fname, title, group in PAGES:
        if slug not in bodies:
            continue
        page = (HEAD.format(title=f"ACM Extended Wiki | {title}", css=css, canonical=PUBLIC_URL + fname,
                            english_url=PUBLIC_URL + fname, korean_url=PUBLIC_URL + 'ko/' + fname)
                + sidebar(slug, page_sections(bodies[slug])) + "\n" + toc(bodies[slug]) + "\n" + bodies[slug]
                + FOOT.format(version=VERSION, built=built, terms=terms_json, index=idx_json, reference_js=reference_js, messages='{}'))
        open(os.path.join(OUT, fname), "w", encoding="utf-8").write(page)

    if english_only:
        return

    korean_bodies, korean_index, translators = {}, [], {}
    for slug, fname, title, group in PAGES:
        if slug not in bodies:
            continue
        translator = translators[slug] = Korean(slug)
        body = translator.html(bodies[slug], assets=True)
        body = translate_level_data(body, translator)
        korean_bodies[slug] = body
        korean_index += index_page(slug, fname, translator.text(title), body, translator)
    glossary = Korean('glossary')
    korean_terms = {key: [glossary.text(name), glossary.text(desc)] for key, (name, desc) in TERMS.items()}
    glossary.check()
    ko_index_json = json.dumps(korean_index, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    ko_terms_json = json.dumps(korean_terms, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    messages = json.dumps(load_korean('runtime'), ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    os.makedirs(os.path.join(OUT, 'ko'), exist_ok=True)
    for slug, fname, title, group in PAGES:
        if slug not in korean_bodies:
            continue
        translator = translators[slug]
        chrome = (HEAD.format(title=f"ACM Extended Wiki | {title}", css=css, canonical=PUBLIC_URL + 'ko/' + fname,
                              english_url=PUBLIC_URL + fname, korean_url=PUBLIC_URL + 'ko/' + fname)
                  .replace('<html lang="en-US">', '<html lang="ko">')
                  + sidebar(slug, page_sections(bodies[slug]), 'ko') + '\n' + toc(bodies[slug]))
        foot = FOOT.format(version=VERSION, built=built, terms=ko_terms_json, index=ko_index_json,
                           reference_js=reference_js, messages=messages)
        page = translator.html(chrome, assets=True) + '\n' + korean_bodies[slug] + translator.html(foot, assets=True)
        translator.check()
        open(os.path.join(OUT, 'ko', fname), 'w', encoding='utf-8').write(page)

    open(os.path.join(OUT, ".nojekyll"), "w").write("")

    print(f"built {len(bodies)} English + {len(korean_bodies)} Korean pages, {len(index)} / {len(korean_index)} search records, {len(TERMS)} glossary terms per edition")
    print(f"copied {copied} image(s) from src/img to docs/img")

    # Every img/ reference must resolve, and every image should be used. A broken reference used to
    # ship as a silent 404 that only showed up on someone else's screen.
    have = {os.path.relpath(os.path.join(d, f), src_img).replace(os.sep, "/")
            for d, _, files in os.walk(src_img) for f in files}
    want = set()
    for slug, body in bodies.items():
        for m in re.finditer(r'(?:src|href)="img/([^"]+)"', body):
            want.add(m.group(1))
    for chrome in ("acme-favicon.png", "acme-logo.png"):
        want.add(chrome)
    broken = sorted(want - have)
    unused = sorted(have - want)
    if broken:
        print("BROKEN IMAGE REFERENCES (add to src/img/): " + ", ".join(broken))
    if unused:
        print("images in src/img not referenced by any page: " + ", ".join(unused))
    if not broken:
        print(f"all {len(want)} image reference(s) resolve")

    if badterms:
        print("UNKNOWN GLOSSARY TERMS (add to src/glossary_terms.py):")
        for pg, t in badterms:
            print(f"  {pg}: {{{{{t}}}}}")
    if missing:
        print("no content file yet for: " + ", ".join(missing))


if __name__ == "__main__":
    build(english_only='--english-only' in sys.argv)
