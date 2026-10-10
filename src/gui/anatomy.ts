import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import './style.css';
import './anatomy.css';

interface Source { id: string; title: string; url: string }
interface Muscle { id: string; name: string; group: string; origin: string; insertion: string; function: string; model_actuators: string[]; source_ids: string[]; notes?: string }
interface Actuator { id: string; name: string; group: string; function: string; mapping_status: string; notes?: string; source_ids: string[] }
interface Excluded { id: string; name: string; origin: string; insertion: string; reason: string; source_ids: string[] }
interface Bone { id: string; name: string; group: string; function: string }
interface Anatomy {
  scope: { handedness: string; boundary: string; counting_rules: string[]; variations: string[]; model_limits: string[]; conventions: Record<string, string>; excluded_muscles?: Excluded[] };
  counts: Record<string, number>;
  sources: Source[];
  bones: Bone[];
  muscles: Muscle[];
  actuators: Actuator[];
}

const GROUPS: [string, string, string][] = [
  ['forearm_anterior', 'Forearm, anterior', 'Wrist and finger flexors, plus the two pronators.'],
  ['forearm_posterior', 'Forearm, posterior', 'Wrist, finger, and thumb extensors, abductor pollicis longus, and supinator.'],
  ['intrinsic_thumb', 'Thenar (thumb)', 'Short thumb muscles at the base of the thumb.'],
  ['intrinsic_hypothenar', 'Hypothenar (little finger)', 'Short little-finger muscles at the ulnar edge of the palm.'],
  ['intrinsic_superficial', 'Superficial palm', 'Palmaris brevis is often listed with the hypothenar group.'],
  ['intrinsic_interosseous', 'Interossei', 'Between the metacarpals. Dorsal interossei abduct the fingers; palmar interossei adduct them.'],
  ['intrinsic_lumbrical', 'Lumbricals', 'Arise from the FDP tendons. They flex the MCP joints and extend the PIP and DIP joints.'],
];

// The model's RI, LU_RB, and UI_UB channels on digits 2-5 stand in for these groups as a whole.
const BUNDLED_GROUPS = new Set(['intrinsic_interosseous', 'intrinsic_lumbrical']);
type Status = 'simulated' | 'approximated' | 'absent';
const status = (muscle: Muscle): Status => muscle.model_actuators.length ? 'simulated' : BUNDLED_GROUPS.has(muscle.group) ? 'approximated' : 'absent';
const STATUS_TEXT: Record<Status, string> = { simulated: 'Simulated', approximated: 'Approximated', absent: 'Not in model' };

const app = document.querySelector<HTMLDivElement>('#app')!;
const escape = (text: unknown) => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function render(data: Anatomy) {
  const sourceNumber = new Map(data.sources.map((source, index) => [source.id, index + 1]));
  const cite = (ids: string[]) => ids.map(id => `<a class="cite" href="#source-${escape(id)}" title="${escape(data.sources[sourceNumber.get(id)! - 1]?.title)}">${sourceNumber.get(id) ?? '?'}</a>`).join('');
  const tally = (wanted: Status) => data.muscles.filter(muscle => status(muscle) === wanted).length;
  const [simulated, approximated, absent] = [tally('simulated'), tally('approximated'), tally('absent')];
  const bundles = data.actuators.filter(actuator => actuator.mapping_status !== 'named_muscle');
  const excluded = data.scope.excluded_muscles ?? [];

  const muscleRow = (muscle: Muscle) => `
    <tr data-muscle="${escape(muscle.id)}" data-status="${status(muscle)}" data-search="${escape(`${muscle.name} ${muscle.id} ${muscle.model_actuators.join(' ')}`.toLowerCase())}">
      <th scope="row"><span class="name">${escape(muscle.name)}</span><code>${escape(muscle.id)}</code></th>
      <td data-label="Origin">${escape(muscle.origin)}</td>
      <td data-label="Insertion">${escape(muscle.insertion)}</td>
      <td data-label="Function">${escape(muscle.function)}</td>
      <td data-label="In simulation"><span class="status ${status(muscle)}">${STATUS_TEXT[status(muscle)]}</span>${
        status(muscle) === 'simulated' ? `<span class="codes">${muscle.model_actuators.map(id => `<code>${escape(id)}</code>`).join(' ')}</span>`
        : status(muscle) === 'approximated' ? '<span class="status-note">By <a href="#channels">combined channels</a>, not one-to-one</span>'
        : '<span class="status-note">No model channel</span>'}</td>
      <td data-label="Sources" class="sources">${cite(muscle.source_ids)}</td>
    </tr>`;

  const groupSection = ([key, title, description]: [string, string, string]) => {
    const muscles = data.muscles.filter(muscle => muscle.group === key);
    if (!muscles.length) return '';
    return `
      <section class="muscle-group" data-group="${key}" aria-labelledby="group-${key}">
        <div class="group-heading"><h3 id="group-${key}">${title}</h3><span class="group-count" data-count-for="${key}">${muscles.length} ${muscles.length === 1 ? 'muscle' : 'muscles'}</span></div>
        <p class="group-description">${description}</p>
        <table class="muscle-table">
          <thead><tr><th scope="col">Muscle</th><th scope="col">Origin</th><th scope="col">Insertion</th><th scope="col">Function</th><th scope="col">In simulation</th><th scope="col">Sources</th></tr></thead>
          <tbody>${muscles.map(muscleRow).join('')}</tbody>
        </table>
      </section>`;
  };
  const known = new Set(GROUPS.map(([key]) => key));
  const extraGroups = [...new Set(data.muscles.map(muscle => muscle.group))].filter(group => !known.has(group)).map(group => [group, group.replaceAll('_', ' '), ''] as [string, string, string]);

  app.innerHTML = `
    <header class="app-header">
      <div class="brand"><h1>Clonehand</h1><span class="brand-description">Anatomy inventory</span></div>
      <a class="back-link" href="./">Back to simulation</a>
    </header>
    <main class="reference">
      <div class="reference-intro">
        <h2>Right hand and wrist</h2>
        <p>The ${data.counts.anatomical_muscles_total} muscles that move the hand, wrist, and forearm rotation: every muscle with at least one end on the hand or a finger, plus the three forearm rotators. ${data.counts.forearm_muscles} have their bellies in the forearm and ${data.counts.intrinsic_hand_muscles} lie inside the hand. The ${data.counts.bones_total} bones are the hand plus the radius and ulna. The simulation drives ${simulated} of these muscles with their own model channels. The ${approximated} interossei and lumbricals are approximated together by ${bundles.length} combined channels, without a one-to-one match. The other ${absent} are not in the model.</p>
        <dl class="totals">
          <div><dt>Muscles</dt><dd>${data.counts.anatomical_muscles_total}</dd></div>
          <div><dt>Simulated</dt><dd>${simulated}</dd></div>
          <div><dt>Approximated</dt><dd>${approximated}</dd></div>
          <div><dt>Not in model</dt><dd>${absent}</dd></div>
          <div><dt>Model channels</dt><dd>${data.counts.model_actuators}</dd></div>
        </dl>
        <nav class="toc" aria-label="On this page"><a href="#muscles">Muscles</a><a href="#excluded">Out of scope</a><a href="#channels">Combined model channels</a><a href="#bones">Bones</a><a href="#rules">Counting rules</a><a href="#sources">Sources</a></nav>
      </div>

      <section id="muscles" aria-labelledby="muscles-title">
        <div class="section-heading"><h2 id="muscles-title">Muscles</h2></div>
        <div class="toolbar">
          <div class="search-field"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input type="search" id="filter-text" placeholder="Find a muscle or model ID" aria-label="Find a muscle or model ID" /></div>
          <div class="button-group" role="group" aria-label="Show muscles">
            <button data-show="all" aria-pressed="true">All</button><button data-show="simulated" aria-pressed="false">Simulated</button><button data-show="approximated" aria-pressed="false">Approximated</button><button data-show="absent" aria-pressed="false">Not in model</button>
          </div>
          <output id="filter-count" aria-live="polite">${data.muscles.length} of ${data.muscles.length}</output>
        </div>
        <p class="empty-note" id="filter-empty" hidden>No muscles match. Clear the search or choose All.</p>
        <p class="section-note">Five muscles (abductor and flexor pollicis brevis, adductor pollicis, abductor and flexor digiti minimi) come from the MUSIC model (<a href="#source-music">Xu et al. 2026</a>), which has no license; they are used locally and not redistributed. Of the ${absent} marked Not in model, opponens digiti minimi moves the fifth carpometacarpal joint, which the model lacks; palmaris brevis moves only skin; and supinator is in neither MyoHand nor MUSIC, so forearm rotation has only the two pronators.</p>
        ${[...GROUPS, ...extraGroups].map(groupSection).join('')}
      </section>

      <section id="excluded" aria-labelledby="excluded-title">
        <div class="section-heading"><h2 id="excluded-title">Out of scope</h2><span class="group-count">${excluded.length} muscles, not counted</span></div>
        <p class="section-note">These muscles attach only to the arm and forearm bones and act mainly at the elbow, so the scope rule leaves them out.</p>
        <table class="compact-table excluded-table">
          <thead><tr><th scope="col">Muscle</th><th scope="col">Attachments</th><th scope="col">Reason</th><th scope="col">Sources</th></tr></thead>
          <tbody>${excluded.map(muscle => `<tr data-excluded="${escape(muscle.id)}"><th scope="row">${escape(muscle.name)}</th><td>${escape(muscle.origin)} → ${escape(muscle.insertion)}</td><td>${escape(muscle.reason)}</td><td class="sources">${cite(muscle.source_ids)}</td></tr>`).join('')}</tbody>
        </table>
      </section>

      <section id="channels" aria-labelledby="channels-title">
        <div class="section-heading"><h2 id="channels-title">Combined model channels</h2></div>
        <p class="section-note">MyoHand drives the finger interossei and lumbricals through 3 channels per finger for digits 2 to 5. RI is the radial interosseous, LU_RB the lumbrical with the radial band, and UI_UB the ulnar interosseous with the ulnar band. Which anatomical muscles each channel represents has not been established, so none of them counts as a muscle.</p>
        <table class="compact-table">
          <thead><tr><th scope="col">Channel</th><th scope="col">Description</th><th scope="col">Sources</th></tr></thead>
          <tbody>${bundles.map(actuator => `<tr><th scope="row"><code>${escape(actuator.id)}</code></th><td>${escape(actuator.name)}</td><td class="sources">${cite(actuator.source_ids)}</td></tr>`).join('')}</tbody>
        </table>
      </section>

      <section id="bones" aria-labelledby="bones-title">
        <div class="section-heading"><h2 id="bones-title">Bones</h2><span class="group-count">${data.bones.length} bones</span></div>
        <table class="compact-table">
          <thead><tr><th scope="col">Bone</th><th scope="col">Group</th><th scope="col">Function</th></tr></thead>
          <tbody>${data.bones.map(bone => `<tr><th scope="row">${escape(bone.name)}</th><td>${escape(bone.group)}</td><td>${escape(bone.function)}</td></tr>`).join('')}</tbody>
        </table>
      </section>

      <section id="rules" aria-labelledby="rules-title">
        <div class="section-heading"><h2 id="rules-title">Counting rules</h2></div>
        <p class="section-note">${escape(data.scope.boundary)} Handedness: ${escape(data.scope.handedness)}.</p>
        <ul class="prose-list">${data.scope.counting_rules.map(rule => `<li>${escape(rule)}</li>`).join('')}</ul>
        <h3>Anatomical variation</h3>
        <ul class="prose-list">${data.scope.variations.map(rule => `<li>${escape(rule)}</li>`).join('')}</ul>
        <h3>Model limits</h3>
        <ul class="prose-list">${data.scope.model_limits.map(rule => `<li>${escape(rule)}</li>`).join('')}</ul>
        <h3>Abbreviations</h3>
        <dl class="conventions">${Object.entries(data.scope.conventions).map(([key, value]) => `<div><dt>${escape(key.replaceAll('_', ' '))}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>
      </section>

      <section id="sources" aria-labelledby="sources-title">
        <div class="section-heading"><h2 id="sources-title">Sources</h2></div>
        <ol class="source-list">${data.sources.map(source => `<li id="source-${escape(source.id)}"><a href="${escape(source.url)}" target="_blank" rel="noopener">${escape(source.title)}</a></li>`).join('')}</ol>
        <p class="section-note">Machine-readable version: <a href="/api/anatomy">/api/anatomy</a> (JSON).</p>
      </section>
    </main>`;

  const rows = [...document.querySelectorAll<HTMLTableRowElement>('[data-muscle]')];
  let show = 'all';
  const apply = () => {
    const text = (document.getElementById('filter-text') as HTMLInputElement).value.toLowerCase().trim();
    let visible = 0;
    for (const row of rows) {
      row.hidden = !(row.dataset.search!.includes(text) && (show === 'all' || row.dataset.status === show));
      if (!row.hidden) visible++;
    }
    document.querySelectorAll<HTMLElement>('.muscle-group').forEach(section => {
      const count = section.querySelectorAll('[data-muscle]:not([hidden])').length;
      section.hidden = count === 0;
      section.querySelector('.group-count')!.textContent = `${count} ${count === 1 ? 'muscle' : 'muscles'}`;
    });
    document.getElementById('filter-count')!.textContent = `${visible} of ${rows.length}`;
    document.getElementById('filter-empty')!.hidden = visible > 0;
  };
  document.getElementById('filter-text')!.addEventListener('input', apply);
  document.querySelectorAll<HTMLButtonElement>('[data-show]').forEach(button => button.addEventListener('click', () => {
    show = button.dataset.show!;
    document.querySelectorAll('[data-show]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    apply();
  }));
}

async function start() {
  try {
    const response = await fetch('/api/anatomy');
    if (!response.ok) throw new Error(`Inventory request failed (${response.status}).`);
    render(await response.json() as Anatomy);
  } catch (cause) {
    app.innerHTML = `<div class="error-banner" role="alert"><span>${escape(cause instanceof Error ? cause.message : 'Could not load the inventory.')} Start the Python service, then reload.</span><button onclick="location.reload()">Reload</button></div>`;
  }
}

void start();
