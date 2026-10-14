/* Preparation arithmetic only; this does not simulate serum or patient response. */
(() => {
  'use strict';
  const amountAt = (amount, totalMl, selectedMl) => amount * selectedMl / totalMl;
  const rateAt = (amount, totalMl, mlPerHour) => amount * mlPerHour / totalMl / 60;
  const format = value => Number(value.toFixed(3)).toLocaleString('en-US', { maximumFractionDigits: 3 });
  const guides = document.querySelectorAll('[data-mixture-guide]');
  for (const guide of guides) {
    const picker = guide.querySelector('[data-mixture-picker]');
    const recipes = [...guide.querySelectorAll('[data-mixture-recipe]')];
    if (!picker || !recipes.length) continue;
    for (const recipe of recipes) {
      const steps = [...recipe.querySelectorAll('.mixture-step')];
      const buttons = [...recipe.querySelectorAll('[data-mixture-go]')];
      const previous = recipe.querySelector('[data-mixture-previous]');
      const next = recipe.querySelector('[data-mixture-next]');
      let current = 0;
      function showStep(index) {
        current = Math.max(0, Math.min(steps.length - 1, index));
        steps.forEach((step, i) => { step.hidden = i !== current; });
        buttons.forEach((button, i) => {
          if (i === current) button.setAttribute('aria-current', 'step');
          else button.removeAttribute('aria-current');
        });
        const step = steps[current];
        recipe.querySelector('.mixture-syringe-canvas').style.setProperty('--mixture-fill', Number(step.dataset.mixtureFill) / 10);
        recipe.querySelector('[data-mixture-drawing]').textContent = step.dataset.mixtureContents;
        recipe.querySelector('[data-mixture-step-count]').textContent = wikiText`Step ${current + 1} of ${steps.length}`;
        previous.disabled = current === 0;
        next.disabled = current === steps.length - 1;
      }
      buttons.forEach(button => button.addEventListener('click', () => showStep(Number(button.dataset.mixtureGo))));
      previous.addEventListener('click', () => showStep(current - 1));
      next.addEventListener('click', () => showStep(current + 1));
      recipe.querySelector('.mixture-step-picker').hidden = false;
      recipe.querySelector('.mixture-step-controls').hidden = false;
      const quantity = recipe.querySelector('[data-mixture-quantity]');
      const range = recipe.querySelector('[data-mixture-range]');
      const output = recipe.querySelector('[data-mixture-output]');
      const components = JSON.parse(recipe.dataset.mixtureComponents);
      const totalMl = Number(recipe.dataset.mixtureTotal);
      const isBag = recipe.dataset.mixtureKind === 'bag';
      const error = recipe.querySelector('[data-mixture-error]');
      function updatePreview() {
        const value = quantity.valueAsNumber;
        const valid = Number.isFinite(value) && value >= Number(quantity.min) && value <= Number(quantity.max);
        quantity.setAttribute('aria-invalid', String(!valid));
        error.hidden = valid;
        output.replaceChildren();
        if (!valid) {
          const message = document.createElement('p');
          message.textContent = wikiText('No result until a valid volume or rate is entered.');
          output.append(message);
          return;
        }
        if (range) range.value = value;
        for (const component of components) {
          const card = document.createElement('div');
          const name = document.createElement('span');
          const result = document.createElement('strong');
          const detail = document.createElement('small');
          name.textContent = component.name;
          const measured = isBag ? rateAt(component.amount, totalMl, value) : amountAt(component.amount, totalMl, value);
          result.textContent = `${format(measured)} ${component.unit}${isBag ? '/min' : ''}`;
          detail.textContent = isBag
            ? `${format(component.amount / totalMl)} ${component.unit}/mL × ${format(value / 60)} mL/min`
            : wikiText`In ${format(value)} mL of the prepared syringe`;
          card.append(name, result, detail);
          output.append(card);
        }
      }
      quantity.addEventListener('input', updatePreview);
      if (range) range.addEventListener('input', () => { quantity.value = range.value; updatePreview(); });
      recipe.querySelector('.mixture-interactive').hidden = false;
      showStep(0);
      updatePreview();
    }
    const selectRecipe = () => {
      for (const recipe of recipes) recipe.hidden = recipe.dataset.mixtureRecipe !== picker.value;
    };
    picker.addEventListener('change', selectRecipe);
    guide.querySelector('.mixture-picker').hidden = false;
    const hashRecipe = recipes.find(recipe => `#${recipe.id}` === location.hash);
    if (hashRecipe) picker.value = hashRecipe.dataset.mixtureRecipe;
    selectRecipe();
    window.addEventListener('hashchange', () => {
      const match = recipes.find(recipe => `#${recipe.id}` === location.hash);
      if (match) {
        picker.value = match.dataset.mixtureRecipe;
        selectRecipe();
        match.scrollIntoView({ block: 'start' });
      }
    });
  }
  // Pure arithmetic is exposed for validation without coupling checks to the DOM.
  window.ACMMixtureMath = Object.freeze({ amountAt, rateAt });
})();
