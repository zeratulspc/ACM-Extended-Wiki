/* Filtering supplements native details elements; all guidance is present without JS. */
(() => {
  const guide = document.querySelector('[data-infusion-guide]');
  if (!guide) return;
  const input = guide.querySelector('[data-infusion-filter]');
  const cards = [...guide.querySelectorAll('.infusion-guide')];
  const count = guide.querySelector('[data-infusion-count]');
  const expand = guide.querySelector('[data-infusion-expand]');
  const empty = guide.querySelector('[data-infusion-empty]');
  guide.querySelector('[data-infusion-controls]').hidden = false;
  const filter = () => {
    const query = input.value.trim().toLocaleLowerCase();
    cards.forEach(card => { card.hidden = !card.textContent.toLocaleLowerCase().includes(query); });
    const visible = cards.filter(card => !card.hidden);
    count.textContent = wikiText`${visible.length} of ${cards.length} infusions`;
    empty.hidden = visible.length > 0;
    expand.disabled = visible.length === 0;
    expand.textContent = visible.length && visible.every(card => card.open) ? wikiText('Collapse visible') : wikiText('Expand visible');
  };
  input.addEventListener('input', filter);
  expand.addEventListener('click', () => {
    const visible = cards.filter(card => !card.hidden);
    const open = !visible.every(card => card.open);
    visible.forEach(card => { card.open = open; });
    filter();
  });
  cards.forEach(card => card.addEventListener('toggle', filter));
  const revealHash = () => {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const card = cards.find(item => item.id === id);
    if (!card) return;
    input.value = '';
    filter();
    card.open = true;
    requestAnimationFrame(() => card.scrollIntoView({ block: 'start' }));
  };
  window.addEventListener('hashchange', revealHash);
  filter();
  revealHash();
})();
