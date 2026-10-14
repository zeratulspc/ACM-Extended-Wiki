# ACM Extended Wiki

Latest package: September 15, 2026. See [DEPLOY.md](DEPLOY.md) for deployment commands, changes and the current validation scope. Earlier browser results below belong to their recorded updates.

Static reference site for ACM Extended. The existing Python builder produces self-contained HTML pages in `docs/`, with offline search, inline styles and inline browser scripts.

## Calcium and blood transfusion update

The Fluids & blood volume article now explains calcium timing around the first and fourth units, controlled chloride/gluconate delivery, the separate 50 mL HR and 1 L additional-deficit thresholds, burden clearance and remaining credit. Both medication cards, infusion guides and the bleeding summary link to it. The full 3 g gluconate / 120 s Hardcore rate hazard is explicit. The current review distinguishes main `5416332` from dev `a9ae90c`; see [CALCIUM-REVIEW.md](CALCIUM-REVIEW.md) for sources and validation. The dark palette and reading layout are retained.

## Dark palette and title correction

The palette uses the earlier charcoal background (`#090E13`) and navy surfaces (`#111B26`, `#111D29`, `#162637`), with cream body text (`#F2E8D2`) and the original yellow titles (`#F1BD59`). Secondary text uses a muted cream. The new information blocks and link highlights share the dark surface colors, and the selected subsection uses yellow. The grouped layout, article content, graph markers and blue links are retained. Screen palette variables are defined together in `src/_pillar.css`; print colors remain separate.

## Reading layout update

Eight longer articles now use 25 parent topics with indented subsections and a subtle left rule: IV access, airway, ventilator, TBI, bleeding, oxygen, blast and flight. The 21 Hardcore settings are organized under five subgroup headings. Both page navigation menus reflect the hierarchy, and the original section anchors remain valid.

There are 71 short labels above existing explanations. Related plain explanations can share columns on wide screens; caution and in-game notes use quiet, labeled callouts. Prose has a shorter reading width, while tables, figures and interactive references retain their available space. The subsection indent shrinks on phones.

Forty-four standalone source notes now use optional disclosures. Treatment information and slideshow instructions stay visible, and the build does not add disclosures inside existing disclosures. Section headings gain a copy-link button with a selectable-text fallback if clipboard access fails. Existing search, glossary, print and reference controls remain included.

The full article-content comparison preserved the original text, 899 article anchors, links, 161 tables and 137 controls. The build and structural/link checks pass. A fresh browser preview was blocked by the available browser security policy, so visual, mobile and clipboard verification remains outstanding. [SOURCE-REVIEW.md](SOURCE-REVIEW.md) inventories the existing source pins and the remaining source-review work. This layout update does not change game values or claim a new mod review.

## Edit and build

- `src/content/*.html`: article bodies
- `src/_pillar.css`: base palette and layout
- `src/visual-reference.css`: quiet glossary terms, visual cards, calculations and procedure layouts
- `src/page-groups.json` and `src/reading_layout.py`: parent topics, subsection hierarchy and optional source notes
- `src/reading-layout.css` and `src/reading-layout.js`: prose layout, subsection rails and copy-section links
- `src/infusion-ranges.json`: dose, rate and risk explanations for all 18 infusion agents
- `src/infusion_guide.py`: static infusion guide renderer
- `src/infusion-guide.js` and `src/infusion-guide.css`: filtering and shared heading styling
- `src/reference.js`: calculators, medication curves, automatic glossary links and printing
- `src/chart-readouts.js`: access-capacity, fluid-conversion and waveform inspection
- `src/slideshow.js`: fading IV stages, grouped insertion frames and manual controls
- `src/suction-guide.js`: repeating suction sweep and motion controls
- `src/capnography.js` and `src/capnography.css`: interactive waveform examples
- `src/languages.js` and `src/languages.css`: language picker and English spelling preferences
- `src/rhythm-waveforms.js` and `src/rhythm-waveforms.css`: monitor traces and inspection
- `src/chest-seal.js` and `src/chest-seal.css`: chest seal burping demonstration
- `src/audio/`: original mod sound previews
- `src/glossary_terms.py`: glossary definitions
- `src/reference-data.json`: source snapshot used for the reference refresh
- `build.py`: navigation, layout, glossary expansion and search index
- `docs/`: output served by the existing GitHub Pages configuration

Run:

```sh
python3 build.py
python3 scripts/check_wiki.py
node --check src/reference.js
```

The checker compares docs with an independent build and validates local links, IDs, article element nesting and source disclosure nesting. It works in a ZIP copy without Git. The builder uses Python's standard library. Windows users can double-click BUILD-WIKI.cmd.

For a grouped article, keep the existing source sections and their h2 IDs. Assign each section exactly once in `src/page-groups.json`; the build derives the h2 parent topics and h3 subsections while preserving the old IDs. New labels use `reading-block` or `reference-note`, with `reading-label` for the short title. Only adjacent plain blocks belong in a `reading-grid`. Keep actual instructions out of `source-note`, or add `guide-note` when an existing source-note paragraph must stay visible.

Add a page to `PAGES` in `build.py` and create its body in `src/content/`. Put images in `src/img/` and sound clips in `src/audio/`; the builder copies these into the matching `docs/` directories.

## Earlier baseline reference review

The medication, rhythm, settings and medical-menu references were updated against ACM Extended commit `eabd2f2e88fba4754d81bda8543b81303a72964d`:

- 33 medication cards, each with the same nine clinical game-reference fields
- 39 effect graphs with 0%, 50% and 100% marks, onset markers, peak and duration labels
- 13 rhythm presentations, entry patterns, transition timing, causes and treatment responses
- Visible Addon Options labels in place of internal-code instructions
- Stable disclosure spacing; removed Known traps page and navigation

The build workflow runs Chromium checks at desktop and mobile widths for disclosure position, section menus, medication fields, graph labels and interaction search.

Earlier reference review:

Checked against ACM Extended commit `5bce47c26e70924ec5832eac792b19988e86e22c`:

- 33 medication/product cards and 39 native effect-envelope graphs
- 14G, 16G, 18G, 20G, EJ and IO reference
- Roller-clamp formula and requested-flow calculator
- Admitted fluid, leakage, volume compartments and gradual conversion
- Examination thresholds and 38 shared descriptor pairs

Source links are attached to the corresponding articles. Medication effect references, stock concentrations and infusion registry targets are labeled separately. The card graphs use the route-specific native function, without claiming to predict separate ACME drug systems.

The other system articles remain available with a review notice. Remove an article from that notice only after checking it against the current fork, then add its slug to `REVIEWED` in `build.py`.

## Latest reference controls

- All 47 quantitative charts support pointer/touch inspection with dots and readouts: 39 medication curves, five physiology curves, access capacity, fluid conversion and the capnography explorer. The unscaled ventilator waveform has a phase cursor without invented pressure values.
- Medication readouts show seconds, delivered reference dose and relative game effect. They do not claim measured serum concentration.
- Route-specific peak values are listed vertically. Matching medication fields share row sizing across adjacent desktop cards.
- The glossary provides 324 definitions, with automatic links in article text and support for common abbreviations, inflections and spelling variants.
- Example prepared-bag concentrations round upward to two decimals with explicit units; unrounded calculations remain available for arithmetic.
- The sidebar branding is centered; Ventilator Settings and Pulse labels are explicit.
- The cardiology table distinguishes direct volume/resistance calculations, indirect calcium and acid-base effects, and physiology not independently simulated. This check uses ACM Extended commit `302b811ba90b4e2347b5614b8c74fb41b5442245`.

## September 14 update

- Shared medication-card palette across headings, panels, tables, navigation and links
- Cream page and section titles, quiet metric labels, spaced paragraphs and `>` disclosure markers
- New obtundation and blast-overpressure references with code-backed thresholds and treatment nuances
- Ketamine nystagmus conditions and fracture-pressure awakening added with cross-links
- Head injury, airway, ventilator and accessibility articles rewritten for quick reference
- Corrected pressure-limited volume delivery, CPAP backup, recovery floors and Zeus reset wording
- Screenshot placeholders removed; prior section links preserved
- 28 built pages, 324 glossary entries, 33 medication cards and 39 medication curves
- Publishing and future-edit instructions in PUBLISH-WITH-GITHUB-DESKTOP.md

The new system references use ACM Extended source 4848f63b200a45362eb576dcef469484202b6a80. Existing medication, circulation and other references keep their stated earlier snapshots; this update does not claim to audit every later change to the entire mod.

Build, local-link, anchor, asset and reproducibility checks are provided in `scripts/check_wiki.py`. The six Chromium suites in `scripts/` cover the complete site and the updated visual controls; the GitHub workflow repeats them after updates.

## Hosting

Preserve the existing GitHub Pages source: the `main` branch, `/docs` directory. Copy this ZIP’s extracted contents into the existing repository and commit the rebuilt `docs/` with the source changes.

No external font request is required. Each HTML page contains the shared search index, glossary definitions, styling and reference controls.

## Texture conversion

The existing `paa2png.py` supports the DXT5 workflow documented in its source and uses `python-lzo` or `lzokay` for compressed textures. Converted figures belong in `src/img/` so rebuilding `docs/` preserves them.

## Visual update and IV guide

The shared palette uses charcoal backgrounds, navy panels, cream headings, blue links and cream labels. Glossary terms inherit their surrounding text color and use subtle rectangular outlines, a filling underline and a short popup fade. Pages expand to the available browser width; wide tables scroll within their own container on small screens.

The medication page includes 21 original vial images. The access page presents the 15 original IV frames in six fading scenes, each held for seven seconds. Frames 01–06 play as one advancing motion and frames 07–11 play as one threading motion. Both use brief crossfades; a thin progress line shows the remaining scene time. Previous/next buttons, keyboard navigation, a stage selector, pause and show-all remain available. Reduced-motion starts paused; without JavaScript all scenes are visible. The unused LINE instruction is omitted. Slideshow controls belong to the website; game inputs appear in the captions and controls table.

The access decision guide explains urgency, vesicants, intact anatomy, gauge tradeoffs and early IO for critical game casualties. It preserves the prepared-set rule: one running bag or Y set per access site, including the Y set’s clamped saline reserve. IO priority is a gameplay recommendation, not a claim that the engine mandates IO for every critical patient.

Six ventilator cards restore at-a-glance settings for healthy lungs, edema, blast/ARDS, pneumothorax, hemothorax and CPR. Named inputs and worked steps simplify the pressure, volume, perfusion and infusion examples.

Trauma sections use original mod equipment icons. The suction guide repeats a short S sweep from bottom to top with more horizontal turns, a pause at the top and a fade before resetting. Three original sound clips have manual playback controls. The motion pauses offscreen, in a hidden tab and for reduced-motion preferences.

Assets and IV controls were checked against ACM Extended commit `abf6253d4876b4a7a5563f84a3b060de53a0290d`. See `MOD-ASSET-SOURCES.md` for provenance. The access decision rules and suction controls/assets were separately checked at `21f86948b8a03507146297742ea84983987d5be1`. Ventilator references and other content retain their stated review revisions.

## Languages and the latest reference additions

The sidebar offers US English, UK English, Korean, German, French, Spanish and Russian. US/UK change common English spellings locally and retain the preference. Korean opens the authored static edition in `docs/ko/`, retaining the current article and section. German, French, Spanish and Russian open the current published page in Google’s website translator in a new tab; they require internet access and are automatic translations. English and Korean are available offline. Language changes require pressing the apply/open button; pages do not redirect on load. A direct edition link also works without JavaScript.

### Maintaining the Korean edition

`python3 build.py` generates 28 English pages and 28 Korean pages. Both editions use the same article structure, anchors, figures, medication models and shared image/audio files. Each edition embeds its own search index and 324 glossary definitions. Korean search accepts a single Hangul syllable. The existing English sources remain the source of truth.

The authored translations live in `src/locales/ko/`: one source-keyed JSON catalog per page, `shared.json` for common text, `data.json` for concentration-explorer descriptions, and `runtime.json` for interactive messages. English keys identify the exact normalized source text. Values are reviewed Korean text; original game option names, acronyms, code identifiers and units may deliberately remain in English. An explicit empty string omits an English-only grammatical fragment; `null` means unfinished translation and fails the build. Runtime messages preserve numbered placeholders such as `{0}`.

After changing English content, run `python3 scripts/extract_korean_catalog.py` to rebuild the English source and refresh catalogs while preserving existing translations. Translate new `null` values, review surrounding inline links and any changed game conditions, then rebuild both editions. Descriptive JSON fields are translated separately from numerical model inputs; new interactive messages need a `wikiText` call and a matching runtime entry.

Run `python3 scripts/check_wiki.py`, `python3 scripts/check_korean.py`, and the browser suites in `.github/workflows/wiki-check.yml`. The Korean checks cover source numbers, placeholders, identical structural/model attributes, desktop/mobile reading, language switching (including leaving a Google proxy), section anchors, Korean search, glossary popups, calculations, interactive labels and no-JavaScript reading. Commit regenerated `docs/` together with source/catalog changes. GitHub Pages still serves `main` / `docs`.

`PUBLIC_URL` in `build.py` is the conventional GitHub Pages URL for this repository. Update it if the site moves to a custom domain. Local file and localhost previews retain the English modes and explain that live translation becomes available on the published site. Code and key labels retain their original text. [Google’s website translation instructions](https://support.google.com/translate/answer/2534559?hl=en&co=GENIE.Platform%3DDesktop).

The Airway & Breathing article now includes selectable capnography patterns with time/CO₂ inspection. The oxygen article distinguishes underlying oxygen state from player pulse-oximeter readings, and the blast article explains Breacher’s syndrome with separate game-model limits. The Zeus article documents available modules and fridge settings; the new Debug menu article explains the supplied screenshot field by field. Source links identify the reviewed implementation and medical background.

## Chest seal and rhythm update

Airway & Breathing includes an eased chest seal demonstration using both original corner sequences, with pause, replay and manual inspection. It explains the full-lift mouse wheel action, why a blocked outlet matters, and how leak healing, drainage, pressure relief and residual collapse differ in the mod.

All 13 cardiac rhythm blocks include bright green, six-second monitor examples with pointer, touch and keyboard inspection. The traces use the mod’s native/custom waveform formulas; vertical values are relative monitor deflection, not calibrated millivolts. They remain visible without JavaScript. MV now opens the minute-ventilation definition, including the distinction between L/min and the game’s MV adequacy ratio. Unnecessary hyphens have been removed from article prose while preserving links and code identifiers.

The chest seal mechanics, pneumothorax recovery and ECG generation were checked against commit `dd50edf34497588d473ffe3c70797f2eaa52f6f8`. Other references retain their stated review revisions. `scripts/check_chest_rhythms.mjs` checks these additions, and the existing suites cover the retained site controls.

## Infusion dose and medication presentation update

The access article has 18 searchable infusion guides linked from all 19 preparation rows (the two epinephrine stocks share a guide). Each compares its game reference, increasing exposure and implemented hazards, with timing and reassessment notes. Rate effects, active drug burden and accumulation proxies are distinguished; display-only debug bands are not presented as safety limits. Undefined toxicity cutoffs remain explicitly undefined. All numeric risk bands use the current initialized defaults, not fallback constants.

Medication illustrations now cover all 33 cards. Hyaluronidase and phentolamine use the shared icon configured by the mod, with clear captions identifying the mismatch in the printed vial label. Dimercaprol has a prominent owner-requested unavailable notice; its legacy artwork and curve remain labeled as legacy data.

Ventilator Settings & Tips now contains the complete ketamine nystagmus explanation. Old incoming links remain usable. The ketamine IM induction example uses the current 4.375 mg/kg calibration, and the norepinephrine dilution includes the injected volume (4 mg in 254 mL, about 15.75 mcg/mL). Small headings, medication fields, table headers and popup titles share the cream title color.

These changes were reviewed at `488a5e54efd10e5289245bcb2f7db7a40bbabcb0`; other content retains its individual source review dates. The new browser suite checks filtering, dose links, original images, heading colors, moved guidance and the static fallback.


## Mobile tables and printable charts

Every article table now receives column labels during the build. At phone widths, and inside narrow table containers, rows become vertical records with their labels directly above the values. Desktop minimum widths no longer force mobile tables to scroll. This also works without JavaScript. Graphs fit their available width and retain their touch/keyboard readouts.

**Printable charts** in the sidebar contains seven landscape sheets: three medication sheets covering all 33 medication entries, one ventilator sheet, one IV/IO sheet, one sheet with all 13 rhythm examples and one TBI sheet. Medication cards, Ventilator Settings & Tips, IV access and Cardiac rhythms and Traumatic brain injury link directly to the corresponding print preview. Each print button prints only its own chart; Print all charts prints the full set. Use A4 or US Letter, or Save as PDF. Color backgrounds are optional and no remote printing service is used.

| Change | Source |
| --- | --- |
| Mobile table column labels | `src/responsive_tables.py` |
| Responsive table/list/graph styles | `src/mobile-layout.css` |
| Compact medication rows | `src/print-medications.json` |
| Other charts and print page markup | `src/print_reference.py` |
| Print styles and buttons | `src/print-reference.css`, `src/print-reference.js` |

Keep compact medication rows aligned with the full medication cards and source reviews when updating dose information. The charts distinguish stock content, game reference doses, infusion rates and fixed product actions. Dimercaprol remains explicitly unavailable. These are ACM Extended game references.

Run `node scripts/check_mobile_print.mjs` with the other browser checks. It opens disclosures and checks internal table overflow at 320, 390, 768, 1024 and 1905 pixels, enlarged root text, print selection/cancellation and JavaScript-disabled fallbacks. Set `WIKI_PRINT_QA_DIR` to a temporary directory to export A4/Letter PDFs and phone screenshots for visual review.


## TBI B119 reference update

Writing style: use `>` or `<` for directional markers and occasional `->` for event sequences. Use en dashes for numeric ranges, such as `65–75`. Do not use Unicode arrows or em dashes in articles, charts, controls or supporting notes. In HTML text, encode angle brackets as `&gt;` and `&lt;` where needed.

The TBI guide, connected hemorrhage and oxygen references, Zeus setup/reset explanation, debug definitions and glossary follow dev revision `98d18bb3f60dc9be8cdaf4a43419bb57483c3a3f` (14 September 2026). At review, `main` was still `5416332cf899f11f5170c9bcb9768edabb8827e5`; this documentation does not imply that B119 is already released on main. Other systems retain their article-specific source pins.

Structural injury history, reversible acute burden, severity-dependent recovery pressure gates, cerebral autoregulation and systemic autonomic tone are now explained separately. The printable TBI chart summarizes the new rules. The debug reference retains the earlier supplied screenshot and distinguishes it from the current two-page layout. See `TBI-UPDATE-NOTES.md` for source details, important display differences and the outstanding in-engine staging scenarios.

## Interactive infusion and mixture reference

The infusion explorer covers all 18 entries. It separates configured debug bands from the concentration and rate thresholds that actually drive hazards. Change actual admitted delivery, inspect the curve with a pointer, touch or keyboard, stop delivery to examine washout, and change the patient weight for lidocaine or esmolol. Lidocaine also exposes its coded clearance modifiers. Every disclosure shows its game concentration reference before opening. Propofol and osmotherapy retain their native effect explanations instead of an invented serum target.

`src/infusion-levels.json` holds the reviewed units, bands, source paths and accumulation models. `src/infusion_explorer.py`, `src/infusion-explorer.js` and `src/infusion-explorer.css` render the explorer. The estimate starts at zero and uses constant admitted delivery and one second integration steps. Calcium and amiodarone include their 15-second rise and 35-second fall input smoothing. Calcium's shared excess accumulator and magnesium's display-scale mismatch are identified explicitly. Keep this data aligned with `src/infusion-ranges.json` when game code changes.

The mixture workbench demonstrates five preparations using the original layered syringe images: Ketofol, cardiac-vial diluted epinephrine, norepinephrine and epinephrine bags, and a shared pressor bag. Its manual steps remain readable without JavaScript. Syringe volume controls show component amounts; bag flow controls show each component's rate. Preparation totals include added medication solution volume. Ketofol uses 5 mL ketamine 50 mg/mL plus 5 mL propofol 10 mg/mL, which is a 5:1 mass ratio. A shared bag has one clamp for both components. The guide also explains coded sedation interactions and why compromised perfusion can change the response.

The sources for this update are pinned to ACM Extended dev `98d18bb3f60dc9be8cdaf4a43419bb57483c3a3f`; this is a game reference, not a claim that a debug reference band guarantees a safe dose. `src/mixture_guide.py` contains the preparation descriptions, source links and recipes. `src/mixture-guide.js` and `src/mixture-guide.css` provide interaction and layout. Original syringe provenance is recorded in `MOD-ASSET-SOURCES.md`.

`src/route_lists.py` and `src/route-lists.css` stack IV and IO separately in medication route facts, vertical peak lists, timing rows and printable medication Route columns. Shared qualifications are preserved. Run `node scripts/check_infusion_workbench.mjs` with the existing checks. It verifies model reference values, units, stop behavior, measured quantities, shared flow, all 18 selections, manual steps, no-JavaScript content and reflow at narrow widths with enlarged text.


## Version 1.2.1 and Hardcore medication pushes

The shared site version is 1.2.1. The settings reference separates 21 Hardcore switches, with defaults, setting scope and source-reviewed on/off comparisons. It distinguishes active changes from inherited controls that have limited or no additional effect in the current Extended runtime. These additions follow ACM Extended dev `bc90fc7661fa6612cef5f4382f3b181fd5868f11`. Other article sections retain their stated review pins.

`src/hardcore_medications.py` supplies the 14 suggested IV/IO push times, a linked note on each affected medication card and the full slow-push guide in IV access. The guide covers current target volume, 1–300 second selection, compound defaults, incremental Stop Push, 0.01 mL retention, continuous flow with menus closed, the corner syringe, restart behavior, distance/vehicle constraints and flush consolidation. `src/hardcore-reference.css` uses the existing dark/cream hierarchy and responsive cards.

The current code keeps actual infusion-rate effects and concentration accumulation active with Hardcore Medications off. The switch changes manual bolus timing, enables persistent incremental IV/IO pushing and adds rapid-push loads. Normal-mode custom bolus windows are separate from the visible timer and the listed Hardcore defaults. The infusion JSON records this newer mode review without changing the validated concentration equations or older baseline review. IM retains its original administration path.

Defaults are not no-risk limits: they apply to the current target volume, so medication mass and concentration still matter. For example, 150 mg amiodarone over its 300-second default delivers 30 mg/min, above the unchanged 25 mg/min fast-rate threshold. The website documents this source behavior; it does not change the mod runtime.


## September 15 readability and graph update

* Cream page titles, section headings, medication fields, infusion headings, Hardcore notes and sidebar branding
* Underlined links have a subtle blue background, a stronger hover state and a visible keyboard focus outline
* Graph inspection markers keep an 11 px screen diameter on scaled charts, with a cream outline
* Medication and physiology charts preserve touch selections when the finger leaves the screen
* Multi-curve markers remain above their readout boxes; access/fluid readouts choose the opposite side near the plot edge
* Focusing an empty medication/physiology time field retains its validation message
* The full source and rebuilt 28-page site are included; the public version remains 1.2.1

This update starts from the September 14 website ZIP (revision 12). Game equations, doses and article source revisions are unchanged. See DEPLOY.md for the PowerShell publishing steps and this handoff's validation scope. The existing GitHub Pages source remains main, /docs.
