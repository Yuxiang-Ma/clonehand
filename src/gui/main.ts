import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import './style.css';
import type { Joint, Model, State } from './types';
import { splitMuscle } from './muscle-geometry';
import { HandViewer, type CameraView, type MuscleView } from './viewer';
import { MODEL_URL, STANDALONE, openLink, type SimulationLink } from './link';

const app = document.querySelector<HTMLDivElement>('#app')!;
const icons = {
  play: '<path d="m7 4 10 8-10 8Z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  reset: '<path d="M4 10a8 8 0 1 1 1 7M4 4v6h6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
};
const icon = (name: keyof typeof icons) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const escape = (text: unknown) => String(text ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const groupName = (group: string) => ({ forearm_anterior: 'Forearm · anterior', forearm_posterior: 'Forearm · posterior', intrinsic_thumb: 'Hand · thumb', intrinsic_hypothenar: 'Hand · little finger', intrinsic_bundle: 'Hand · intrinsic' })[group] ?? group.replaceAll('_', ' ');
/** "1.02 N·m/rad", or "0.55 toward flexion, 1.02 toward extension (N·m/rad)" when the sides differ. */
const stiffnessText = (joint: Joint) => {
  const [positive, negative] = joint.passive_stiffness_nm_per_rad;
  if (positive === negative) return `${positive.toFixed(2)} N·m/rad`;
  return `${positive.toFixed(2)} toward ${joint.positive.toLowerCase()}, ${negative.toFixed(2)} toward ${joint.negative.toLowerCase()} (N·m/rad)`;
};
// [view, button label, tooltip, view tag]
const CAMERA_VIEWS: [CameraView, string, string, string][] = [
  ['palm', 'Palm', 'Look at the palm', 'Palm view'],
  ['dorsal', 'Dorsal', 'Look at the back of the hand', 'Dorsal view'],
  ['radial', 'Radial', 'Thumb side', 'Radial view (thumb side)'],
  ['ulnar', 'Ulnar', 'Little-finger side', 'Ulnar view (little-finger side)'],
];
const CAPTIONS: Record<MuscleView, string> = {
  anatomical: '<span>Muscle bellies and tendons</span><p>Belly volume and rest length per muscle; the inspector names the source. Shortening happens only in the belly.</p>',
  paths: '<span>Muscle–tendon paths</span><p>Paths show force transmission, not muscle belly volume.</p>',
};
const percent = (value: number) => `${Math.round(value * 100)}%`;
const degrees = (radians: number) => `${(radians * 180 / Math.PI).toFixed(1)}°`;

app.innerHTML = `
  <header class="app-header">
    <div class="brand"><h1>Clonehand</h1><span class="brand-description">Muscle & movement</span></div>
    <div class="model-label">Right hand <span aria-hidden="true">/</span> MyoHand</div>
    <div class="connection" id="connection" role="status"><span class="status-dot"></span><span id="connection-text">Loading model</span></div>
  </header>
  <div id="error" class="error-banner" role="alert" hidden><span id="error-text"></span><button id="retry">${STANDALONE ? 'Restart' : 'Reconnect'}</button></div>
  <main class="workspace" data-pane="muscles" aria-label="Hand simulation">
    <aside class="muscle-panel" aria-labelledby="muscles-title">
      <div class="panel-heading"><h2 id="muscles-title">Muscles</h2><span id="muscle-count" class="subtle">Loading</span></div>
      <div class="search-field">${icon('search')}<input type="search" id="search" placeholder="Find a muscle" aria-label="Find a muscle" /></div>
      <label class="filter-label" for="group">Muscle group</label>
      <select id="group"><option value="all">All muscle groups</option></select>
      <p class="list-help">Select a muscle to inspect its action. Sliders set excitation from 0 to 1.</p>
      <div id="muscle-list" class="muscle-list"><div class="loading-placeholder">Loading muscle controls…</div></div>
      <div class="list-footer"><span><span class="active-dot"></span><strong id="active-count">0</strong> active</span><button id="relax" disabled>Relax all</button></div>
    </aside>
    <section class="specimen-panel" aria-labelledby="specimen-title">
      <div class="specimen-heading"><div><h2 id="specimen-title">Right hand & wrist</h2><p id="model-counts">Loading model geometry</p></div><span class="view-tag" id="view-tag">Palm view</span></div>
      <div id="viewer" class="viewer">
        <div class="viewer-loading" id="viewer-loading"><span class="loading-bar"></span><p>Loading hand geometry…</p></div>
        <div class="viewer-caption" id="view-caption">${CAPTIONS.anatomical}</div>
        <div class="viewer-legend" id="legend-paths" aria-label="Path colors" hidden><span><i class="legend-line selected"></i>Selected</span><span><i class="legend-line active"></i>Active</span><span><i class="legend-line resting"></i>Resting</span></div>
        <div class="viewer-legend" id="legend-anatomical" aria-label="Muscle colors"><span><i class="legend-swatch selected"></i><span>Selected<span class="legend-long"> (outlined)</span></span></span><span><i class="legend-swatch belly"></i><span>Active belly<span class="legend-long">, low to high</span></span></span><span><i class="legend-line tendon"></i>Tendon</span><span><i class="legend-swatch context"></i><span><span class="legend-long">Other muscles, relaxed</span><span class="legend-short">Relaxed</span></span></span></div>
      </div>
      <div class="view-controls">
        <div class="button-group" role="group" aria-label="Muscle display"><button data-muscle-view="anatomical" aria-pressed="true">Belly &amp; tendon</button><button data-muscle-view="paths" aria-pressed="false">Paths</button></div>
        <div class="button-group" role="group" aria-label="Camera view">${CAMERA_VIEWS.map(([view, label, title]) => `<button data-view="${view}" aria-pressed="${view === 'palm'}" title="${title}">${label}</button>`).join('')}<button data-view="reset" aria-label="Reset camera to the palm view" title="Reset camera">${icon('reset')}</button></div>
        <label class="check-control"><input type="checkbox" id="all-paths" checked />All paths</label>
        <label class="check-control"><input type="checkbox" id="bones" checked />Bones</label>
        <span class="orbit-hint">Drag to orbit · Scroll to zoom</span>
      </div>
      <div class="transport">
        <button class="primary" id="play" disabled>${icon('play')}<span>Run simulation</span></button>
        <button id="reset" disabled>${icon('reset')}<span>Reset</span></button>
        <div class="clock"><span id="run-state">Paused</span><output id="time">0.00 s</output></div>
      </div>
      <p class="transport-help" id="transport-help">Set a muscle’s excitation, then run the simulation to see it contract.</p>
    </section>
    <nav class="phone-tabs" aria-label="Panel">
      <button data-pane="muscles" aria-pressed="true">Muscles <span class="tab-detail" id="tab-muscles">0 active</span></button>
      <button data-pane="inspector" aria-pressed="false">Selected <span class="tab-detail" id="tab-selected">–</span></button>
    </nav>
    <aside class="inspector" aria-labelledby="selected-title">
      <div class="inspector-heading"><h2>Selected muscle</h2><span id="selected-id" class="anatomical-id"></span></div>
      <h3 id="selected-title">Loading anatomy…</h3><p id="selected-name-zh" class="name-zh" lang="zh-Hans"></p><p id="selected-group" class="subtle"></p>
      <p id="selected-function" class="muscle-function"></p>
      <div class="excitation-heading"><label for="excitation">Excitation</label><output id="excitation-output" for="excitation">0.00</output></div>
      <input id="excitation" type="range" min="0" max="1" step="0.01" value="0" aria-label="Selected muscle excitation" disabled />
      <div class="range-labels"><span>0 · Relax</span><span>1 · Full excitation</span></div>
      <dl class="muscle-readings"><div><dt>Measured activation</dt><dd id="activation">0%</dd></div><div><dt>Muscle force</dt><dd id="force">0.0 N</dd></div></dl>
      <p class="caption">Excitation is your command. Activation follows the model’s muscle dynamics while running.</p>
      <dl class="muscle-readings belly-readings"><div><dt>Belly length</dt><dd id="belly-length">–</dd></div><div><dt>Tendon length</dt><dd id="tendon-length">–</dd></div></dl>
      <p class="caption" id="belly-basis"></p>
      <section class="influence-section" aria-labelledby="influence-title"><h4 id="influence-title">Joint influence</h4><p class="caption">Current moment arms show the direction this muscle can pull. Influence changes with posture.</p><div id="influences"><p class="empty-note">Waiting for simulation state.</p></div></section>
      <section class="angles-section" aria-labelledby="angles-title"><h4 id="angles-title">Measured joint angles</h4><p class="caption">Motion results from all muscle forces, passive joint stiffness, and joint limits.</p><div id="angles"></div></section>
      <details class="anatomy-details"><summary>Attachments & model notes</summary><dl><dt>Origin</dt><dd id="origin"></dd><dt>Insertion</dt><dd id="insertion"></dd></dl><p id="muscle-notes" class="caption"></p></details>
      <details class="model-details"><summary>Model scope & limitations</summary><ul id="limitations"></ul><a href="anatomy.html" target="_blank" rel="noopener">Open anatomy inventory</a></details>
    </aside>
  </main>
  <footer class="app-footer"><span>${STANDALONE ? 'MuJoCo physics running in this browser · MyoHand model' : 'MuJoCo physics · MyoHand model'}</span><span>Exploratory simulation · See model scope for omissions</span></footer>`;

const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
let model: Model;
let viewer: HandViewer;
let link: SimulationLink | undefined;
let selected = 0;
let state: State | undefined;
let currentControls: number[] = [];
let renderedInfluenceKey = '';
let connectionReady = false;
let lastState: State | undefined;
let lastRender = 0;
const rowControls: { row: HTMLElement; input: HTMLInputElement; output: HTMLOutputElement; indicator: HTMLElement }[] = [];

function setConnected(connected: boolean) {
  connectionReady = connected;
  element('connection').classList.toggle('connected', connected);
  element('connection-text').textContent = connected ? (STANDALONE ? 'Running locally' : 'Connected') : (STANDALONE ? 'Stopped' : 'Disconnected');
  for (const id of ['play', 'reset', 'relax', 'excitation']) (element(id) as HTMLButtonElement).disabled = !connected;
  for (const control of rowControls) control.input.disabled = !connected;
}

function error(message: string) {
  element('error-text').textContent = message;
  element('error').hidden = false;
}

function send(message: unknown) {
  link?.send(message);
}

function setExcitation(index: number, value: number) {
  currentControls[index] = value;
  send({ type: 'controls', values: { [model.actuators[index].id]: value } });
  syncControls();
}

function syncControls() {
  rowControls.forEach((control, index) => {
    control.input.value = String(currentControls[index] ?? 0);
    control.output.value = (currentControls[index] ?? 0).toFixed(2);
  });
  element<HTMLInputElement>('excitation').value = String(currentControls[selected] ?? 0);
  element<HTMLOutputElement>('excitation-output').value = (currentControls[selected] ?? 0).toFixed(2);
}

function selectMuscle(index: number) {
  selected = index;
  const muscle = model.actuators[index];
  element('selected-title').textContent = muscle.name;
  element('tab-selected').textContent = muscle.id;
  element('selected-name-zh').textContent = muscle.name_zh ?? '';
  element('selected-id').textContent = muscle.id;
  element('selected-group').textContent = groupName(muscle.group);
  element('selected-function').textContent = muscle.function;
  element('origin').textContent = muscle.origin;
  element('insertion').textContent = muscle.insertion;
  element('muscle-notes').textContent = Array.isArray(muscle.notes) ? muscle.notes.join(' ') : muscle.notes;
  rowControls.forEach((control, rowIndex) => {
    const active = rowIndex === index;
    control.row.classList.toggle('selected', active);
    control.row.querySelector('button')!.setAttribute('aria-pressed', String(active));
  });
  renderedInfluenceKey = '';
  syncControls();
  viewer?.select(index);
  if (state) renderReadings(state);
}

function renderList() {
  element('muscle-list').innerHTML = model.actuators.map((muscle, index) => `
    <div class="muscle-row" data-index="${index}">
      <button class="muscle-select" aria-pressed="false" data-select="${index}"><span class="muscle-name">${escape(muscle.name)}</span>${muscle.name_zh ? `<span class="muscle-name-zh" lang="zh-Hans">${escape(muscle.name_zh)}</span>` : ''}<span class="muscle-code">${escape(muscle.id)}<span class="activation-indicator" aria-label="Resting"></span></span></button>
      <div class="row-slider"><input type="range" min="0" max="1" step="0.01" value="0" aria-label="${escape(muscle.name)} excitation" data-slider="${index}" disabled /><output>0.00</output></div>
    </div>`).join('') + '<p class="empty-note" id="search-empty" hidden>No matching muscles. Try a name or model ID.</p>';
  model.actuators.forEach((_, index) => {
    const row = document.querySelector<HTMLElement>(`[data-index="${index}"]`)!;
    const input = row.querySelector('input')!;
    rowControls.push({ row, input, output: row.querySelector('output')!, indicator: row.querySelector('.activation-indicator')! });
    row.querySelector('button')!.addEventListener('click', () => selectMuscle(index));
    input.addEventListener('input', () => setExcitation(index, Number(input.value)));
  });
  const groups = [...new Set(model.actuators.map(muscle => muscle.group))];
  element('group').insertAdjacentHTML('beforeend', groups.map(group => `<option value="${escape(group)}">${escape(groupName(group))}</option>`).join(''));
}

function filterList() {
  const search = element<HTMLInputElement>('search').value.toLowerCase().trim();
  const group = element<HTMLSelectElement>('group').value;
  let visible = 0;
  model.actuators.forEach((muscle, index) => {
    const show = `${muscle.name} ${muscle.name_zh ?? ''} ${muscle.id}`.toLowerCase().includes(search) && (group === 'all' || group === muscle.group);
    rowControls[index].row.hidden = !show;
    if (show) visible++;
  });
  element('muscle-count').textContent = `${visible} / ${model.actuators.length}`;
  element('search-empty').hidden = visible > 0;
}

function renderBelly(next: State) {
  const rendering = model.rendering[selected];
  const split = splitMuscle(rendering, next.mtu_length[selected]);
  const change = (split.ratio - 1) * 100;
  element('belly-length').textContent = `${(split.belly * 100).toFixed(1)} cm`;
  element('belly-length').title = `${change >= 0 ? '+' : ''}${change.toFixed(0)}% from rest`;
  element('tendon-length').textContent = `${(split.tendon * 100).toFixed(1)} cm`;
  const belly = rendering.belly_basis.startsWith('measured') ? `rest belly length ${rendering.belly_basis} (${rendering.belly_source})` : 'rest belly length assumed (no measurement found)';
  const volume = rendering.volume_basis === 'estimated from Fmax' ? 'volume estimated from maximum force (no measurement found)' : rendering.volume_basis === 'measured' ? `volume measured (${rendering.volume_source})` : `volume from ${rendering.volume_basis} (${rendering.volume_source})`;
  element('belly-basis').textContent = `Belly ${change >= 0 ? '+' : ''}${change.toFixed(0)}% from rest. The simulated tendon does not stretch, so all shortening is in the belly. Sizes: ${belly}; ${volume}.`;
}

function renderReadings(next: State) {
  renderBelly(next);
  element('activation').textContent = percent(next.activation[selected]);
  element('force').textContent = `${next.force[selected].toFixed(1)} N`;
  const influences = model.joints.map((joint, index) => ({ joint, index, arm: next.moment_arms[selected][index] })).filter(item => Math.abs(item.arm) >= 0.1);
  const key = influences.map(item => `${item.index}:${Math.sign(item.arm)}`).join(',');
  if (key !== renderedInfluenceKey || !element('influences').querySelector('table')) {
    renderedInfluenceKey = key;
    element('influences').innerHTML = influences.length ? `<table><caption class="sr-only">Selected muscle mechanical influence</caption><thead><tr><th scope="col">Joint / action</th><th scope="col">Arm</th></tr></thead><tbody>${influences.map(({ joint, index, arm }) => `<tr><td>${escape(joint.name)}<span class="action-direction">${escape(arm > 0 ? joint.positive : joint.negative)}</span></td><td data-arm="${index}"></td></tr>`).join('')}</tbody></table>` : '<p class="empty-note">No moment arm above 0.1 mm at this posture.</p>';
    element('angles').innerHTML = influences.length ? `<dl class="angle-list">${influences.map(({ joint, index }) => `<div><dt>${escape(joint.name)}<span>Limits ${joint.range[0].toFixed(0)}° to ${joint.range[1].toFixed(0)}°</span><span>Passive stiffness ${stiffnessText(joint)}, ${joint.passive_stiffness_basis}</span></dt><dd><span data-angle="${index}"></span><span class="limit-flag" data-limit="${index}" hidden>At limit</span></dd></div>`).join('')}</dl>` : '<p class="empty-note">No influenced joints at this posture.</p>';
  }
  influences.forEach(({ index, arm }) => {
    element('influences').querySelector(`[data-arm="${index}"]`)!.textContent = `${Math.abs(arm).toFixed(1)} mm`;
    element('angles').querySelector(`[data-angle="${index}"]`)!.textContent = degrees(next.qpos[index]);
    const [low, high] = model.joints[index].range;
    const angle = next.qpos[index] * 180 / Math.PI;
    const flag = element('angles').querySelector(`[data-limit="${index}"]`) as HTMLElement;
    const joint = model.joints[index];
    flag.hidden = angle > low + 0.5 && angle < high - 0.5;
    if (!flag.hidden) flag.textContent = `At ${(angle >= high - 0.5 ? joint.positive : joint.negative).toLowerCase()} limit`;
  });
}

function renderState(next: State) {
  const wasPaused = state?.paused;
  state = next;
  viewer.update(next);
  if (wasPaused !== next.paused) {
    element('play').innerHTML = `${icon(next.paused ? 'play' : 'pause')}<span>${next.paused ? 'Run simulation' : 'Pause'}</span>`;
    element('run-state').textContent = next.paused ? 'Paused' : 'Running';
    element('transport-help').textContent = next.paused ? 'Set excitation, then run. Pausing holds the current posture.' : 'Combine muscle excitations to explore movement. Relax all lets activation decay.';
  }
  element('time').textContent = `${next.time.toFixed(2)} s`;
  const activeCount = next.activation.filter(value => value > 0.025).length;
  element('active-count').textContent = String(activeCount);
  element('tab-muscles').textContent = `${activeCount} active`;
  rowControls.forEach((control, index) => {
    const active = next.activation[index] > 0.025;
    control.indicator.classList.toggle('is-active', active);
    control.indicator.setAttribute('aria-label', active ? `${percent(next.activation[index])} activation` : 'Resting');
  });
  renderReadings(next);
}

async function connect() {
  link?.close();
  element('connection-text').textContent = STANDALONE ? 'Starting physics' : 'Connecting';
  let initial = true;
  link = await openLink({
    onMessage(message) {
      if (message.type === 'error') { error(message.message); return; }
      if (initial) {
        initial = false;
        currentControls = [...message.excitation];
        syncControls();
        setConnected(true);
        element('error').hidden = true;
        element('viewer-loading').hidden = true;
        renderState(message);
      }
      lastState = message;
    },
    onClose(message, retryable) {
      setConnected(false);
      lastState = undefined;
      element('retry').hidden = !retryable && !STANDALONE;
      error(message);
    },
  });
}

// Phone layout: the tabs pick which pane fills the space under the hand.
document.querySelectorAll<HTMLButtonElement>('.phone-tabs [data-pane]').forEach(button => button.addEventListener('click', () => {
  app.querySelector<HTMLElement>('.workspace')!.dataset.pane = button.dataset.pane;
  document.querySelectorAll('.phone-tabs [data-pane]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
}));
element('search').addEventListener('input', filterList);
element('group').addEventListener('change', filterList);
element('excitation').addEventListener('input', event => setExcitation(selected, Number((event.target as HTMLInputElement).value)));
element('play').addEventListener('click', () => send({ type: 'pause', paused: !state?.paused }));
element('reset').addEventListener('click', () => { currentControls.fill(0); syncControls(); send({ type: 'reset' }); });
element('relax').addEventListener('click', () => { currentControls.fill(0); syncControls(); send({ type: 'relax' }); });
element('retry').addEventListener('click', () => model && !STANDALONE ? void connect() : location.reload());
document.querySelectorAll<HTMLButtonElement>('[data-muscle-view]').forEach(button => button.addEventListener('click', () => {
  const view = button.dataset.muscleView as MuscleView;
  viewer?.setView(view);
  document.querySelectorAll('[data-muscle-view]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  const anatomical = view === 'anatomical';
  element('legend-paths').hidden = anatomical;
  element('legend-anatomical').hidden = !anatomical;
  element('view-caption').innerHTML = CAPTIONS[view];
}));
element('all-paths').addEventListener('change', event => viewer?.showAll((event.target as HTMLInputElement).checked));
element('bones').addEventListener('change', event => viewer?.showBones((event.target as HTMLInputElement).checked));
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => button.addEventListener('click', () => {
  const chosen = button.dataset.view === 'reset' ? 'palm' : button.dataset.view as CameraView;
  viewer?.frame(chosen);
  document.querySelectorAll('[data-view]').forEach(item => item.setAttribute('aria-pressed', String((item as HTMLElement).dataset.view === chosen)));
  element('view-tag').textContent = CAMERA_VIEWS.find(([view]) => view === chosen)![3];
}));

async function start() {
  try {
    const response = await fetch(MODEL_URL);
    if (!response.ok) throw new Error(`Model request failed (${response.status}).`);
    model = await response.json() as Model;
    currentControls = model.actuators.map(() => 0);
    renderList();
    element('model-counts').textContent = `${model.counts.bones} bone meshes · ${model.counts.dofs} DOFs · ${model.counts.actuators} muscle actuators`;
    element('muscle-count').textContent = String(model.actuators.length);
    element('limitations').innerHTML = model.limitations.map(limitation => `<li>${escape(limitation)}</li>`).join('');
    viewer = new HandViewer(element('viewer'), model, selectMuscle);
    // Read-only hook for tests/browser: compares the drawn scene with simulation state.
    (window as unknown as { clonehand: unknown }).clonehand = { scene: () => viewer.describe() };
    selectMuscle(Math.max(0, model.actuators.findIndex(muscle => muscle.id === 'FDS2_r')));
    void connect();
    function update(now: number) {
      if (connectionReady && lastState && now - lastRender > 50) {
        renderState(lastState);
        lastRender = now;
      }
      requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  } catch (cause) {
    setConnected(false);
    element('viewer-loading').innerHTML = `<p>Hand model unavailable</p><p class="caption">${STANDALONE ? 'Reload the page to try again.' : 'Check the service connection and reconnect.'}</p>`;
    const hint = STANDALONE ? 'Reload the page to try again.' : 'Start the Python service and reconnect.';
    error(`${cause instanceof Error ? cause.message : 'Could not load the model.'} ${hint} WebGL is required for the 3D view.`);
  }
}

void start();
