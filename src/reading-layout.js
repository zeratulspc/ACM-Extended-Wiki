/* Section sharing is optional; headings and the full outline work without JS. */
(() => {
  'use strict';
  const main = document.querySelector('main');
  if (!main || main.classList.contains('page-quick-reference')) return;
  let status, statusTimer;
  function announce(message) {
    if (!status) {
      status = document.createElement('div');
      status.className = 'copy-link-status';
      status.setAttribute('role', 'status');
      document.body.append(status);
    }
    clearTimeout(statusTimer);
    status.textContent = message;
    statusTimer = setTimeout(() => { status.textContent = ''; }, 2500);
  }
  main.querySelectorAll('h2[id], h3[data-wiki-nav="sub"][id]').forEach(heading => {
    const title = heading.textContent.trim();
    let row = heading.parentElement;
    if (!row.matches('.sec-head, .topic-head, .heading-row')) {
      row = document.createElement('div');
      row.className = 'heading-row';
      heading.before(row);
      row.append(heading);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy-section-link';
    button.textContent = '#';
    button.title = wikiText('Copy link to ') + title;
    button.setAttribute('aria-label', button.title);
    heading.after(button);
    button.addEventListener('click', async () => {
      // Local previews share the published URL, never the reader's file path.
      const canonical = document.querySelector('link[rel="canonical"]');
      const url = new URL(canonical ? canonical.href : location.href);
      url.hash = heading.id;
      try {
        if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(url.href);
        row.querySelector('.copy-link-fallback')?.remove();
        announce(wikiText('Section link copied'));
      } catch (_) {
        let fallback = row.querySelector('.copy-link-fallback');
        if (!fallback) {
          fallback = document.createElement('label');
          fallback.className = 'copy-link-fallback';
          fallback.textContent = wikiText('Section link: select and copy');
          const input = document.createElement('input');
          input.type = 'text';
          input.readOnly = true;
          input.setAttribute('aria-label', wikiText('Link to ') + title);
          fallback.append(input);
          row.append(fallback);
        }
        const input = fallback.querySelector('input');
        input.value = url.href;
        input.focus();
        input.select();
        announce(wikiText('Select and copy the section link'));
      }
    });
  });
})();
