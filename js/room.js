// App del estudiante (tablet): cuarto, paciente, inventario, mini-interacciones, PAE y conexión en vivo.
import { Engine, autoRespuesta, fmt, lugarTexto, POSICIONES } from './engine.js';
import { ITEMS, ZONE_ITEMS, VENTURI, iconHTML } from '../data/items.js';
import { HOTSPOTS, REGIONS, BED_OVERLAY, VENAS } from '../data/hotspots.js';
import { CASES, getCase, guiaEstudiante, TEMAS } from '../data/cases.js';
import { HANDWASH } from '../data/handwash.js';
import { DOMINIOS, dominioOpciones, claseOpciones, NANDA, NOC, NIC, ESCALAS_LIKERT } from '../data/pae-catalog.js';
import { Link, normalizeCode } from './peer.js';
import { load, save, remove, pushHistory, getHistory } from './storage.js';
import { renderReport } from './report.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

const S = {
  session: null, engine: null, link: null,
  view: 'room', zone: null, region: null, sub: null, itemMenu: null,
  feed: [], conn: { status: 'red', detail: 'Sin conexión' },
  bubbleTimer: null, saveTimer: null,
};

// =================== Sesión y persistencia ===================
function persist() {
  clearTimeout(S.saveTimer);
  S.saveTimer = setTimeout(() => save('student-session', S.session), 150);
}

function newSession({ modo, code, caseId, durMin, config, estudiante, stationId }) {
  S.session = {
    id: 's' + Date.now().toString(36), modo, code: code || null, caseId, durMin: durMin || 15,
    config: { minijuego: 'primera', ...(config || {}) }, estudiante: estudiante || '', stationId: stationId || null,
    phase: 'guia', timer: { startAt: null, pausedTotal: 0, pausedAt: null, extraMs: 0 },
    log: [], overrides: null, finalReason: null, startedAt: null, juegos: 0, shuffleSeed: Math.floor(Math.random() * 1e6),
  };
  buildEngine();
  persist();
}

function buildEngine() {
  const caso = getCase(S.session.caseId);
  S.engine = new Engine(caso, { modo: S.session.modo });
  S.feed = [];
  for (const ev of S.session.log) {
    const fx = S.engine.apply(ev);
    fx.filter(f => f.tipo === 'msg').forEach(f => S.feed.push({ ...f, t: ev.t }));
  }
  S.feed = S.feed.slice(-40);
}

// =================== Cronómetro ===================
function elapsed() {
  const T = S.session?.timer; if (!T || !T.startAt) return 0;
  const now = Date.now();
  return now - T.startAt - T.pausedTotal - (T.pausedAt ? now - T.pausedAt : 0);
}
function remaining() {
  const T = S.session.timer;
  return S.session.durMin * 60000 + (T.extraMs || 0) - elapsed();
}

// =================== Eventos ===================
function emit(ev, opts = {}) {
  if (!S.session || !S.engine) return [];
  if (S.session.phase === 'fin' && ev.tipo !== 'sistema') return [];
  ev.t = Math.round(elapsed());
  if (!opts.noSnap) ev.estadoAntes = S.engine.snapshot();
  const fx = S.engine.apply(ev);
  S.session.log.push(ev);
  persist();
  S.link && S.link.send({ type: 'ev', ev, n: S.session.log.length });
  handleFx(fx, ev);
  render();
  return fx;
}

function handleFx(fx, ev) {
  for (const f of fx) {
    if (f.tipo === 'msg') {
      S.feed.push({ ...f, t: ev.t }); S.feed = S.feed.slice(-40);
      if (f.quien === 'paciente') bubble(f.texto);
    }
    if (f.tipo === 'contaminado') flashGlove();
    if (f.tipo === 'sv') blinkMonitor();
    if (f.tipo === 'evento') notify(f.texto);
    if (f.tipo === 'ui') openProcPanel(f.ui);
    if (f.tipo === 'sugerir_mejora' && S.session.modo === 'practica') autoMejora();
    if (f.tipo === 'anim' && f.anim === 'orina') toast('💧 Sale orina por la sonda');
  }
}

function autoMejora() {
  if (S._mejoraT) return;
  S._mejoraT = setTimeout(() => {
    S._mejoraT = null;
    const c = S.engine.caso; const sv = { ...S.engine.w.sv };
    const meta = c.id === '2A' ? 90 : 94;
    if (sv.spo2 < meta) emit({ tipo: 'evaluador', accion: 'monitor', sv: { spo2: meta, fc: Math.max(90, sv.fc - 15), fr: Math.max(20, sv.fr - 4) }, auto: true });
  }, 15000);
}

// =================== Conexión ===================
function startLink(code) {
  if (S.link) S.link.close();
  S.link = new Link('client', {
    code,
    onStatus: (s) => { S.conn = s; renderConn(); },
    onConnect: () => sendHello(),
    onMessage: onMessage,
    pingExtra: () => S.session ? { remaining: S.session.phase === 'estacion' || S.session.phase === 'entrega' ? remaining() : null, running: !!(S.session.timer.startAt && !S.session.timer.pausedAt), phase: S.session.phase, n: S.session.log.length } : null,
  });
}

function sendHello() {
  if (!S.link) return;
  const s = S.session;
  S.link.send({ type: 'hello', stationId: s?.code === S.link.code ? s.stationId : null, sessionId: s?.id, estudiante: s?.estudiante || $('#j-name')?.value || '' });
  if (s && s.code === S.link.code && s.stationId) syncAll();
}

function syncAll() {
  const s = S.session; if (!s || !S.link) return;
  S.link.send({ type: 'sync', stationId: s.stationId, sessionId: s.id, caseId: s.caseId, phase: s.phase, log: s.log, estudiante: s.estudiante, timer: { remaining: remaining(), running: !!(s.timer.startAt && !s.timer.pausedAt) }, startedAt: s.startedAt, finalReason: s.finalReason });
}

function onMessage(msg) {
  switch (msg.type) {
    case 'station': {
      const s = S.session;
      if (s && s.code === S.link.code && s.stationId === msg.stationId) { s.durMin = msg.durMin; s.config = { ...s.config, ...msg.config }; persist(); syncAll(); render(); return; }
      if (s && s.phase === 'estacion' && s.modo === 'practica') return; // no interrumpir práctica
      newSession({ modo: 'live', code: S.link.code, caseId: msg.caseId, durMin: msg.durMin, config: msg.config, estudiante: $('#j-name')?.value || s?.estudiante, stationId: msg.stationId });
      S.view = 'room'; S.zone = null; S.region = null;
      show('guide'); render();
      syncAll();
      break;
    }
    case 'voz': emit({ tipo: 'evaluador', accion: 'voz', texto: msg.texto }, { noSnap: true }); break;
    case 'monitor': emit({ tipo: 'evaluador', accion: 'monitor', sv: msg.sv }, { noSnap: true }); break;
    case 'evento': emit({ tipo: 'evaluador', accion: 'evento', id: msg.id, texto: msg.texto }, { noSnap: true }); break;
    case 'tiempo': timeCommand(msg); break;
    case 'final': if (S.session) { S.session.overrides = msg.overrides; persist(); if (S.session.phase === 'fin') showReport(); } break;
    case 'sync-request': syncAll(); break;
    case 'config': if (S.session) { S.session.config = { ...S.session.config, ...msg.config }; persist(); } break;
    default: break;
  }
}

function timeCommand(msg) {
  const s = S.session; if (!s || !s.timer.startAt) { if (msg.accion === 'terminar' && s && s.phase === 'guia') { /* nada */ } return; }
  const T = s.timer;
  if (msg.accion === 'pausar' && !T.pausedAt) { T.pausedAt = Date.now(); emit({ tipo: 'sistema', accion: 'pausa' }, { noSnap: true }); notify('⏸ La evaluadora pausó la estación'); }
  if (msg.accion === 'reanudar' && T.pausedAt) { T.pausedTotal += Date.now() - T.pausedAt; T.pausedAt = null; emit({ tipo: 'sistema', accion: 'reanuda' }, { noSnap: true }); }
  if (msg.accion === 'mas') { T.extraMs += msg.ms || 120000; toast('+2 minutos'); }
  if (msg.accion === 'terminar') endStation('evaluadora');
  persist(); renderTimer();
}

function renderConn() {
  $$('.conn').forEach(el => {
    el.className = 'conn ' + S.conn.status;
    el.title = S.conn.detail;
    const t = el.querySelector('.conn-txt'); if (t) t.textContent = S.session?.modo === 'practica' ? 'Práctica' : (S.conn.status === 'green' ? 'En vivo' : S.conn.status === 'yellow' ? 'Inestable' : 'Sin conexión');
  });
  const d = $('#join-status'); if (d) d.textContent = S.conn.detail;
}

// =================== Pantallas ===================
function show(name) {
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + name));
  document.body.dataset.screen = name;
}

function renderJoin() {
  const hist = getHistory('estudiante');
  $('#history').innerHTML = hist.length ? hist.map(x => `<div class="hist-row"><b>${esc(x.caso)}</b> ${esc(x.titulo)} <span class="muted">${new Date(x.fecha).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</span> <span class="pill ${x.aprobado ? 'ok' : 'bad'}">${String(x.nota).replace('.', ',')}</span></div>`).join('') : '<p class="muted">Aún no hay intentos.</p>';
  const sel = $('#p-case');
  if (sel && !sel.options.length) sel.innerHTML = CASES.map(c => `<option value="${c.id}">${c.id} · ${esc(c.titulo)}</option>`).join('');
}

function renderGuide() {
  const s = S.session; if (!s) return;
  const c = getCase(s.caseId);
  const g = guiaEstudiante(c, s.durMin);
  $('#guide-body').innerHTML = guideHTML(c, g, s.durMin);
  $('#btn-start').textContent = s.timer.startAt ? 'VOLVER A LA ESTACIÓN' : 'INICIAR';
}

function guideHTML(c, g, min) {
  return `
    <div class="eyebrow">Caso ${c.id} · ${esc(TEMAS[c.tema].nombre)}</div>
    <h2>En los siguientes ${min} minutos usted debe:</h2>
    <ol class="guide-list" type="a">
      <li><b>Cognitivo:</b> interprete, explique, exponga, argumente, identifique, formule. Precise el DOMINIO, la CLASE y el Diagnóstico NANDA prioritario de enfermería, (factor r) o (R/C) y (característica d) o (E/P).</li>
      <li><b>Psicomotriz:</b> adapte, administre, regule, ajuste, arregle, prepare, demuestre, ejecute. Realice mínimo <b>${c.minIntervenciones || 3}</b> intervenciones de enfermería prioritarias acordes al diagnóstico.</li>
      <li><b>Comunicativo/empático:</b> exprese, manifieste, comunique, dialogue, oriente, comprenda, alivie, relate. Realice acciones empáticas y comunicativas con el paciente y finalice entregando las actividades que realizó.</li>
    </ol>
    <h3>SITUACIÓN DE ENFERMERÍA</h3>
    <p>${esc(g.situacion)}</p>
    <p><b>Orden médica:</b> ${esc(g.orden)}</p>`;
}

function startStation() {
  const s = S.session;
  if (!s.timer.startAt) {
    s.timer.startAt = Date.now(); s.startedAt = Date.now(); s.phase = 'estacion';
    emit({ tipo: 'sistema', accion: 'inicio' }, { noSnap: true });
    S.feed.push({ quien: 'sistema', texto: 'Está en la puerta de la habitación. Toque una zona del cuarto.', t: 0 });
  }
  show('station');
  requestWakeLock();
  render();
}

function endStation(reason) {
  const s = S.session; if (!s || s.phase === 'fin') return;
  if (!S.engine.f('entrega') && s.phase !== 'entrega' && reason !== 'evaluadora-forzar') {
    // 1 minuto extra solo para la entrega
    s.phase = 'entrega';
    s.timer.extraMs = (s.timer.extraMs || 0) + Math.max(0, -remaining()) + 60000;
    s.finalReason = reason;
    persist();
    closeModal();
    openEntrega(true);
    notify('⏱ Tiempo para la ENTREGA DE ACTIVIDADES: tiene 1 minuto.');
    return;
  }
  finalize(reason);
}

function finalize(reason) {
  const s = S.session; if (s.phase === 'fin') return;
  s.finalReason = s.finalReason || reason;
  emit({ tipo: 'sistema', accion: 'fin', motivo: s.finalReason }, { noSnap: true });
  s.phase = 'fin'; s.usedMs = elapsed();
  persist();
  S.link && S.link.send({ type: 'end', log: s.log, reason: s.finalReason, usedMs: s.usedMs, stationId: s.stationId }, true);
  closeModal();
  releaseWakeLock();
  showReport();
}

function showReport() {
  const s = S.session;
  show('report');
  const d = renderReport($('#report'), S.engine, s.overrides || {}, { startedAt: s.startedAt, usedMs: s.usedMs || elapsed(), durMin: s.durMin, estudiante: s.estudiante, modo: s.modo }, {
    evaluatorGraded: !!s.overrides,
    onNew: () => { remove('student-session'); S.session = null; S.engine = null; show('join'); renderJoin(); if (S.link && s.modo === 'live') { /* sigue conectado esperando nueva estación */ } },
  });
  pushHistory('estudiante', { id: s.id, caso: s.caseId, titulo: getCase(s.caseId).titulo, fecha: s.startedAt || Date.now(), nota: d.ev.notas.final, aprobado: d.ev.aprobado });
}

// =================== Render principal ===================
function render() {
  if (!S.session) return;
  const scr = document.body.dataset.screen;
  if (scr === 'guide') renderGuide();
  if (scr !== 'station') return;
  renderTop();
  renderStage();
  renderPanel();
  renderInventory();
  renderTimer();
}

function renderTop() {
  const c = S.engine.caso, w = S.engine.w;
  $('#top-case').textContent = `Caso ${c.id} · ${c.titulo}`;
  const epp = ['gorro', 'tapabocas', 'gafas', 'bata'].map(k => `<span class="epp-ic ${w.epp[k] ? 'on' : ''}" title="${ITEMS[k].nombre}">${iconHTML(k, 'icon mini')}</span>`).join('');
  const g = w.guantes === 'manejo' ? 'manejo' : w.guantes === 'esteril' ? 'esteril' : 'sin';
  $('#top-state').innerHTML = `${epp}
    <button class="hands ${g} ${w.contaminado ? 'cont' : ''}" id="btn-hands" title="Manos">${handsSVG()}</button>
    <span class="chip-state">${w.cortina ? 'Cortina cerrada' : 'Cortina abierta'}</span>
    <span class="chip-state">${POSICIONES[w.posicion] || w.posicion}</span>`;
  $('#btn-hands').onclick = handsMenu;
}

function handsSVG() {
  return `<svg viewBox="0 0 48 32" width="44" height="30"><path class="hand" d="M6 30V16c0-2 3-2 3 0v-8c0-2 3-2 3 0v-2c0-2 3-2 3 0v2c0-2 3-2 3 0v12l2-3c1-2 4-1 3 1l-4 8c-1 2-2 4-5 4H9c-2 0-3-1-3-2z"/><path class="hand" transform="translate(48 0) scale(-1 1)" d="M6 30V16c0-2 3-2 3 0v-8c0-2 3-2 3 0v-2c0-2 3-2 3 0v2c0-2 3-2 3 0v12l2-3c1-2 4-1 3 1l-4 8c-1 2-2 4-5 4H9c-2 0-3-1-3-2z"/></svg>`;
}

function handsMenu() {
  const w = S.engine.w;
  S.zone = null; S.itemMenu = null; S.region = null;
  S.panelOverride = `<h3>Sus manos</h3>
    <p>${w.guantes ? (w.guantes === 'esteril' ? 'Tiene guantes estériles.' : 'Tiene guantes de manejo.') : 'Sin guantes.'}${w.contaminado ? ' Los guantes tocaron algo.' : ''}</p>
    ${w.guantes ? '<button class="btn big" data-do="retirar-guantes">Retirar los guantes</button>' : '<p class="muted">Tome guantes del estante de EPP o del carro y póngaselos desde la mano.</p>'}`;
  renderPanel();
}

function renderTimer() {
  const el = $('#timer'); if (!el || !S.session) return;
  const r = remaining();
  el.textContent = fmt(Math.max(0, r));
  el.className = 'timer' + (r <= 60000 ? ' red' : r <= 300000 ? ' amber' : '') + (S.session.timer.pausedAt ? ' paused' : '');
  if (S.session.phase === 'entrega') el.textContent = 'Entrega ' + fmt(Math.max(0, r));
}

// ---------- Escenario ----------
function renderStage() {
  const stage = $('#stage');
  const c = S.engine.caso;
  const pimg = c.sexo === 'F' ? 'assets/patient-f.png' : 'assets/patient-m.png';
  if (S.view === 'room') {
    if (!stage.querySelector('.room')) {
      stage.innerHTML = `<div class="room-wrap"><div class="room" id="room">
        <img class="room-bg" src="assets/room-bg.png" alt="Cuarto" draggable="false">
        <div class="bed-overlay" style="left:${BED_OVERLAY.x}%;top:${BED_OVERLAY.y}%;width:${BED_OVERLAY.w}%"><div class="pbox" id="pbox-room"><img src="${pimg}" draggable="false" alt="Paciente"><div class="dev-layer"></div><div class="bubble" id="bubble-room"></div></div></div>
        <div class="curtain-shade"></div>
        ${HOTSPOTS.map(z => `<button class="hs" data-zone="${z.id}" style="left:${z.x}%;top:${z.y}%;width:${z.w}%;height:${z.h}%" aria-label="${esc(z.nombre)}"><span>${esc(z.nombre.split('(')[0])}</span></button>`).join('')}
      </div></div>`;
      $$('.hs', stage).forEach(b => b.addEventListener('click', () => tapZone(b.dataset.zone, b)));
    }
    $$('.hs', stage).forEach(b => b.classList.toggle('sel', b.dataset.zone === S.zone));
    $('#room').classList.toggle('curtain-closed', S.engine.w.cortina);
    renderDevices($('#pbox-room'));
  } else {
    if (!stage.querySelector('.patient-stage')) {
      stage.innerHTML = `<div class="patient-stage"><button class="btn ghost back" id="btn-back">← Volver al cuarto</button>
        <div class="pbox big" id="pbox-pat"><img src="${pimg}" draggable="false" alt="Paciente">
        <div class="dev-layer"></div>
        ${REGIONS.map(r => `<button class="rg" data-region="${r.id}" style="left:${r.x}%;top:${r.y}%;width:${r.w}%;height:${r.h}%" aria-label="${esc(r.nombre)}"></button>`).join('')}
        <div class="bubble" id="bubble-pat"></div></div>
        <div class="view-tag" id="view-tag"></div></div>`;
      $('#btn-back').onclick = () => { S.view = 'room'; S.region = null; S.zone = null; render(); };
      $$('.rg', stage).forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); S.region = b.dataset.region; S.sub = null; S.itemMenu = null; S.panelOverride = null; render(); }));
    }
    $$('.rg', stage).forEach(b => b.classList.toggle('sel', b.dataset.region === S.region));
    const w = S.engine.w;
    $('#view-tag').textContent = (w.vista === 'posterior' ? 'Paciente sentado (tórax posterior accesible) · ' : '') + Object.keys(w.expuesto).filter(k => w.expuesto[k]).map(k => 'Descubierto: ' + k).join(' · ');
    renderDevices($('#pbox-pat'));
  }
}

const DEV_POS = { nariz: [50, 16.5], cabeza: [50, 17], boca: [50, 19.5], genitales: [50, 55], borde_cama: [92, 72] };
function armPos(region, sub) {
  const r = REGIONS.find(x => x.id === region); const cx = r.x + r.w / 2;
  const f = { brazo: 0.18, axila: 0.05, pliegue_codo: 0.38, antebrazo: 0.58, dorso_mano: 0.85, dedo: 0.97 }[sub] ?? 0.55;
  return [cx, r.y + r.h * f];
}
function renderDevices(box) {
  if (!box) return;
  const layer = box.querySelector('.dev-layer'); const w = S.engine.w;
  const out = [];
  const put = (x, y, html, cls = '') => out.push(`<div class="dev ${cls}" style="left:${x}%;top:${y}%">${html}</div>`);
  for (const d of w.disp) {
    if (d.tipo === 'o2') { const it = w.items[d.uid]; put(...(d.dev === 'canula' ? DEV_POS.nariz : DEV_POS.cabeza), iconHTML(it ? it.id : 'canula_nasal', 'icon dev-ic'), d.colapsa ? 'warn' : ''); }
    else if (d.tipo === 'pulsox') put(...armPos(d.region, 'dedo'), iconHTML('pulsoximetro', 'icon dev-ic'));
    else if (d.tipo === 'cateter') put(...armPos(d.region, d.sub), iconHTML('cat_20', 'icon dev-ic'));
    else if (d.tipo === 'foley') put(...DEV_POS.genitales, iconHTML('foley_16', 'icon dev-ic'));
    else if (d.tipo === 'sng') put(...(d.region === 'boca' ? DEV_POS.boca : DEV_POS.nariz), iconHTML('levin_16', 'icon dev-ic'));
    else if (d.tipo === 'bolsa') put(...DEV_POS.borde_cama, iconHTML('bolsa_colectora', 'icon dev-ic'));
  }
  if (w.iv.torniquete) { const [x, y] = armPos(w.iv.torniquete.region, w.iv.torniquete.sub); put(x, y - 7, iconHTML('torniquete', 'icon dev-ic'), 'tq'); }
  if (w.iv.previo && !w.iv.previo.retirado) put(...armPos(w.iv.previo.region, w.iv.previo.sub), iconHTML('cat_20', 'icon dev-ic'), 'old');
  if (w.campoOjo) put(50, 57, iconHTML('campo_ojo', 'icon dev-ic'));
  layer.innerHTML = out.join('');
}

// ---------- Zonas ----------
function tapZone(id, el) {
  S.itemMenu = null; S.panelOverride = null; S.region = null;
  if (id === 'cama') { S.view = 'patient'; S.zone = null; render(); return; }
  S.zone = id;
  emit({ tipo: 'zona', zona: id }, { noSnap: true });
}

function renderPanel() {
  const p = $('#panel-body');
  let html = '';
  if (S.panelOverride) html = S.panelOverride;
  else if (S.itemMenu) html = itemMenuHTML(S.itemMenu);
  else if (S.view === 'patient') html = patientPanelHTML();
  else if (S.zone) html = zonePanelHTML(S.zone);
  else html = `<h3>Habitación</h3><p class="muted">Toque cualquier zona del cuarto para ver lo que hay. Toque la cama para acercarse al paciente.</p>`;
  p.innerHTML = html;
  bindPanel(p);
  renderFeed();
}

function renderFeed() {
  const f = $('#feed');
  f.innerHTML = S.feed.slice(-12).reverse().map(m => `<div class="fm ${m.quien}"><span class="tm">${fmt(m.t)}</span> ${m.quien === 'paciente' ? '<b>Paciente:</b> ' : ''}${esc(m.texto)}</div>`).join('');
}

function itemsGrid(ids, zona) {
  return `<div class="grid-items">${ids.map(id => `<button class="item-card" data-take="${id}" data-zona="${zona}">${iconHTML(id)}<span>${esc(ITEMS[id].nombre)}</span></button>`).join('')}</div>`;
}

function zonePanelHTML(z) {
  const zone = HOTSPOTS.find(x => x.id === z);
  const w = S.engine.w;
  const title = `<h3>${esc(zone.nombre)}</h3>`;
  const handItems = [...w.mano.map(u => [u, 'mano']), ...w.bandeja.map(u => [u, 'bandeja'])].map(([u, d]) => ({ inst: w.items[u], d })).filter(x => x.inst);
  switch (z) {
    case 'computador':
      return `${title}<div class="pc-screen"><button class="btn big" data-pc="orden">Orden médica</button><button class="btn big" data-pc="historia">Historia clínica</button><button class="btn big" data-pc="notas">Notas de enfermería</button><button class="btn big" data-pc="pae">PAE</button><button class="btn big" data-pc="goteo">Calculadora de goteo</button></div>`;
    case 'monitor': {
      const m = w.medidos, sv = w.sv;
      const v = (k, txt) => m[k] ? txt : '--';
      return `${title}<div class="monitor ${S._blink ? 'blink' : ''}">
        <div class="mv"><span>PA</span><b>${v('pa', sv.pa)}</b><i>mmHg</i></div>
        <div class="mv green"><span>FC</span><b>${v('fc', sv.fc)}</b><i>lpm</i></div>
        <div class="mv cyan"><span>SpO2</span><b>${v('spo2', sv.spo2)}</b><i>%</i></div>
        <div class="mv yellow"><span>FR</span><b>${v('fr', sv.fr)}</b><i>rpm</i></div>
        <div class="mv"><span>T</span><b>${v('t', sv.t)}</b><i>°C</i></div>
        <svg class="ecg" viewBox="0 0 200 30"><polyline points="0,15 30,15 35,5 40,25 45,15 80,15 85,3 90,27 95,15 130,15 135,5 140,25 145,15 180,15 185,4 190,26 195,15 200,15" fill="none" stroke="#3ce07a" stroke-width="1.5"/></svg>
      </div>${itemsGrid(ZONE_ITEMS.monitor, z)}`;
    }
    case 'o2': {
      const o2 = w.o2;
      const liquido = handItems.find(x => x.d === 'mano' && ITEMS[x.inst.id].tipo === 'liquido');
      const dev = handItems.find(x => x.d === 'mano' && ITEMS[x.inst.id].o2);
      return `${title}
        <div class="o2-box">
          <div class="flow"><div class="flow-val"><b id="flow-val">${o2.flujo}</b> L/min</div>
            <input type="range" min="0" max="15" step="1" value="${o2.flujo}" id="flow" aria-label="Flujómetro">
            <div class="ticks">${Array.from({ length: 16 }, (_, i) => `<span>${i}</span>`).join('')}</div></div>
          <div class="humid ${o2.humid ? 'full' : ''}">Humidificador: <b>${o2.humid ? 'lleno (' + (o2.humid === 'agua_destilada' ? 'agua destilada' : o2.humid === 'ssn' ? 'SSN' : o2.humid) + ')' : 'vacío'}</b></div>
          ${liquido ? `<button class="btn" data-o2="humid" data-uid="${liquido.inst.uid}">Llenar el humidificador con: ${esc(ITEMS[liquido.inst.id].nombre)}</button>` : ''}
          ${dev ? `<button class="btn" data-o2="conectar" data-uid="${dev.inst.uid}">Conectar ${esc(ITEMS[dev.inst.id].nombre)} al humidificador/flujómetro${dev.inst.conectado ? ' ✓' : ''}</button>` : ''}
          ${dev && dev.inst.id === 'mascarilla_reservorio' ? `<button class="btn" data-itemact="llenar_reservorio" data-uid="${dev.inst.uid}">Llenar el reservorio (ocluir la válvula)</button>` : ''}
          ${dev && dev.inst.id === 'venturi' ? `<div class="venturi"><div class="muted">Válvulas Venturi (tabla impresa en cada válvula):</div>${VENTURI.map(v => `<button class="vbtn ${o2.valvula === v.fio2 ? 'sel' : ''} v-${v.color}" data-valvula="${v.fio2}" data-uid="${dev.inst.uid}">${v.fio2} %<small>${v.flujo[0] === v.flujo[1] ? v.flujo[0] : v.flujo.join('–')} L/min</small></button>`).join('')}</div>` : ''}
        </div>${itemsGrid(ZONE_ITEMS.o2, z)}`;
    }
    case 'mesa_sondas':
      return `${title}${w.campo ? '<div class="campo-on">Campo estéril armado sobre la mesa</div>' : ''}${itemsGrid(ZONE_ITEMS.mesa_sondas, z)}`;
    case 'epp': case 'carro_proc': case 'carro_canal':
      return `${title}${itemsGrid(ZONE_ITEMS[z], z)}`;
    case 'lavamanos': case 'dispensador': case 'gel':
      return `${title}<p>¿Qué método va a usar?</p><button class="btn big" data-hig="agua">Lavado con agua y jabón</button><button class="btn big" data-hig="alcohol">Higienización con alcohol glicerinado</button>`;
    case 'caneca_roja': case 'caneca_negra': case 'caneca_blanca': case 'guardian': {
      const can = z === 'guardian' ? 'guardian' : z.replace('caneca_', '');
      return `${title}${handItems.length ? `<p>Toque lo que va a desechar aquí:</p><div class="grid-items">${handItems.map(x => `<button class="item-card" data-desechar="${x.inst.uid}" data-caneca="${can}">${iconHTML(x.inst.id)}<span>${esc(ITEMS[x.inst.id].nombre)}${x.d === 'bandeja' ? ' <small>(bandeja)</small>' : ''}</span></button>`).join('')}</div>` : '<p class="muted">No tiene nada en las manos ni en la bandeja.</p>'}`;
    }
    case 'cortina':
      return `${title}<button class="btn big" data-cortina="${w.cortina ? 0 : 1}">${w.cortina ? 'Abrir la cortina' : 'Cerrar la cortina'}</button>`;
    case 'puerta':
      return `${title}<button class="btn big" data-puerta="asistencia">Llamar / solicitar asistencia médica</button><button class="btn big ghost" data-puerta="salir">Salir de la habitación</button>`;
    default: return title;
  }
}

function patientPanelHTML() {
  const e = S.engine, w = e.w;
  if (!S.region) {
    return `<h3>Paciente · cama</h3>
      <div class="ctrl-group"><div class="lbl">Barandas</div><button class="btn ${w.barandas ? 'sel' : ''}" data-cama="barandas" data-v="1">Arriba</button><button class="btn ${!w.barandas ? 'sel' : ''}" data-cama="barandas" data-v="0">Abajo</button></div>
      <div class="ctrl-group"><div class="lbl">Posición</div>${Object.entries(POSICIONES).map(([k, v]) => `<button class="btn ${w.posicion === k ? 'sel' : ''}" data-cama="posicion" data-v="${k}">${v}</button>`).join('')}</div>
      <div class="ctrl-group"><div class="lbl">Cuello</div>${[['neutro', 'Neutro'], ['extension', 'Extensión'], ['flexion', 'Flexión']].map(([k, v]) => `<button class="btn ${w.cuello === k ? 'sel' : ''}" data-cama="cuello" data-v="${k}">${v}</button>`).join('')}</div>
      <p class="muted">Toque una región del cuerpo del paciente.</p>`;
  }
  const r = REGIONS.find(x => x.id === S.region);
  const subs = r.subs || [];
  const acts = e.getActions(S.region, S.sub);
  const handTxt = w.mano.map(u => ITEMS[w.items[u].id].nombre).join(' + ') || 'manos vacías';
  return `<h3>${esc(lugarTexto(S.region, S.sub, w.vista))}</h3>
    <div class="muted small">En la mano: ${esc(handTxt)}</div>
    ${subs.length ? `<div class="subs">${subs.map(([k, v]) => `<button class="chip ${S.sub === k ? 'sel' : ''}" data-sub="${k}">${esc(v)}</button>`).join('')}</div>` : ''}
    <div class="acts">${acts.map((a, i) => `<button class="btn act ${a.id === 'nada' ? 'disabled' : ''}" data-act="${i}">${esc(a.label)}</button>`).join('')}</div>
    <button class="btn ghost small" data-close-region>Cerrar región</button>`;
}

function itemMenuHTML(uid) {
  const e = S.engine; const inst = e.w.items[uid]; if (!inst) { S.itemMenu = null; return ''; }
  const acts = e.getItemActions(uid);
  const det = [];
  if (inst.carga) det.push('Cargada: ' + inst.carga.replace('_', ' '));
  if (inst.lubricado) det.push('Lubricada');
  if (inst.probado) det.push('Balón probado');
  if (inst.marcada) det.push(`Marcada a ${inst.cm} cm`);
  if (inst.medida && inst.medida.length) det.push('Medición: ' + inst.medida.join(' → '));
  if (inst.purgado) det.push('Purgado');
  if (inst.reservorioLleno) det.push('Reservorio lleno');
  if (inst.valvula) det.push(`Válvula ${inst.valvula} %`);
  if (inst.usado) det.push('Usado');
  return `<div class="item-head">${iconHTML(inst.id, 'icon lg')}<div><h3>${esc(ITEMS[inst.id].nombre)}</h3><div class="muted small">${esc(det.join(' · '))}</div></div></div>
    <div class="acts">${acts.map((a, i) => `<button class="btn act" data-iact="${i}">${esc(a.label)}</button>`).join('')}</div>
    <button class="btn ghost small" data-close-item>Cerrar</button>`;
}

function bindPanel(p) {
  const e = S.engine;
  $$('[data-take]', p).forEach(b => b.onclick = () => takeItem(b.dataset.take, b.dataset.zona, b));
  $$('[data-pc]', p).forEach(b => b.onclick = () => openPC(b.dataset.pc));
  $$('[data-hig]', p).forEach(b => b.onclick = () => startHygiene(b.dataset.hig));
  $$('[data-desechar]', p).forEach(b => b.onclick = () => { emit({ tipo: 'desechar', uid: b.dataset.desechar, caneca: b.dataset.caneca }); });
  $$('[data-cortina]', p).forEach(b => b.onclick = () => emit({ tipo: 'cortina', cerrada: b.dataset.cortina === '1' }));
  $$('[data-puerta]', p).forEach(b => b.onclick = () => {
    if (b.dataset.puerta === 'asistencia') emit({ tipo: 'otra', texto: 'Solicita asistencia médica / llama al médico desde la puerta.' });
    else toast('Sigue en la habitación. Use «Finalizar» para terminar la estación.');
  });
  $$('[data-cama]', p).forEach(b => b.onclick = () => emit({ tipo: 'cama', accion: b.dataset.cama, valor: b.dataset.cama === 'barandas' ? b.dataset.v === '1' : b.dataset.v }));
  $$('[data-sub]', p).forEach(b => b.onclick = () => { S.sub = S.sub === b.dataset.sub ? null : b.dataset.sub; renderPanel(); });
  $('[data-close-region]', p) && ($('[data-close-region]', p).onclick = () => { S.region = null; S.sub = null; render(); });
  $('[data-close-item]', p) && ($('[data-close-item]', p).onclick = () => { S.itemMenu = null; renderPanel(); });
  $$('[data-act]', p).forEach(b => b.onclick = () => {
    const acts = e.getActions(S.region, S.sub); const a = acts[Number(b.dataset.act)]; if (!a || a.id === 'nada') return;
    const base = { tipo: 'accion', accion: a.id, region: S.region, sub: S.sub, params: { disp: a.disp, paso: a.paso }, paso: a.paso };
    if (a.ui === 'puncion') return openPuncion();
    if (a.opciones) return choose(a.label, a.opciones, (v) => emit({ ...base, params: { ...base.params, opcion: v } }));
    emit(base);
  });
  $$('[data-iact]', p).forEach(b => b.onclick = () => {
    const uid = S.itemMenu; const acts = e.getItemActions(uid); const a = acts[Number(b.dataset.iact)]; if (!a) return;
    if (a.id === 'ponerse') { emit({ tipo: 'ponerse', uid }); S.itemMenu = null; return render(); }
    if (a.id === 'a_bandeja') { emit({ tipo: 'mover', uid, a: 'bandeja' }); S.itemMenu = null; return render(); }
    if (a.id === 'a_mano') { if (e.w.mano.length >= 2) return toast('Tiene las dos manos ocupadas.'); emit({ tipo: 'mover', uid, a: 'mano' }); S.itemMenu = null; return render(); }
    if (a.id === 'devolver') { emit({ tipo: 'mover', uid, a: 'devolver' }); S.itemMenu = null; return render(); }
    if (a.opciones) return choose(a.label, a.opciones, (v) => emit({ tipo: 'item', accion: a.id, uid, params: { opcion: v } }));
    if (a.num) return askNumber(a.label, 'cm', (v) => emit({ tipo: 'item', accion: a.id, uid, params: { valor: v } }));
    emit({ tipo: 'item', accion: a.id, uid, params: {} });
  });
  const flow = $('#flow', p);
  if (flow) {
    flow.oninput = () => { $('#flow-val').textContent = flow.value; };
    flow.onchange = () => emit({ tipo: 'o2', accion: 'flujo', valor: Number(flow.value) });
  }
  $$('[data-o2]', p).forEach(b => b.onclick = () => emit({ tipo: 'o2', accion: b.dataset.o2, uid: b.dataset.uid }));
  $$('[data-itemact]', p).forEach(b => b.onclick = () => emit({ tipo: 'item', accion: b.dataset.itemact, uid: b.dataset.uid, params: {} }));
  $$('[data-valvula]', p).forEach(b => b.onclick = () => emit({ tipo: 'item', accion: 'valvula', uid: b.dataset.uid, params: { opcion: Number(b.dataset.valvula) } }));
  $$('[data-do="retirar-guantes"]', p).forEach(b => b.onclick = () => { emit({ tipo: 'retirar_guantes' }); S.panelOverride = null; render(); });
}

function takeItem(id, zona, el) {
  const w = S.engine.w;
  if (w.mano.length >= 2 && w.bandeja.length >= 12) return toast('Manos y bandeja llenas. Devuelva o deseche algo.');
  const dest = w.mano.length < 2 ? 'mano' : 'bandeja';
  fly(el.querySelector('.icon'), dest === 'mano' ? $('#hand-slots') : $('#tray-slots'));
  emit({ tipo: 'tomar', item: id, zona, dest });
}

// ---------- Inventario ----------
function renderInventory() {
  const w = S.engine.w;
  const slot = (u) => { const i = w.items[u]; return `<button class="slot full ${S.itemMenu === u ? 'sel' : ''}" data-uid="${u}">${iconHTML(i.id)}<span>${esc(ITEMS[i.id].nombre)}</span></button>`; };
  $('#hand-slots').innerHTML = [0, 1].map(k => w.mano[k] ? slot(w.mano[k]) : '<div class="slot empty">mano libre</div>').join('');
  $('#tray-slots').innerHTML = w.bandeja.map(slot).join('') + (w.bandeja.length < 12 ? `<div class="slot empty tray-empty">${w.bandeja.length}/12</div>` : '');
  $$('#inventory .slot.full').forEach(b => b.onclick = () => { S.itemMenu = b.dataset.uid; S.panelOverride = null; renderPanel(); renderInventory(); });
}

// =================== Mini-interacciones ===================
function modal(html, opts = {}) {
  const m = $('#modal');
  m.innerHTML = `<div class="modal-card ${opts.wide ? 'wide' : ''} ${opts.cls || ''}">${opts.noClose ? '' : '<button class="x" data-x aria-label="Cerrar">×</button>'}${html}</div>`;
  m.classList.add('open');
  const x = $('[data-x]', m); if (x) x.onclick = () => { closeModal(); opts.onClose && opts.onClose(); };
  return m.firstElementChild;
}
function closeModal() { const m = $('#modal'); m.classList.remove('open'); m.innerHTML = ''; }

function choose(title, opciones, cb) {
  const card = modal(`<h3>${esc(title)}</h3><div class="acts">${opciones.map(([v, l], i) => `<button class="btn act" data-i="${i}">${esc(l)}</button>`).join('')}</div>`);
  $$('[data-i]', card).forEach(b => b.onclick = () => { closeModal(); cb(opciones[Number(b.dataset.i)][0]); });
}
function askNumber(title, unit, cb) {
  const card = modal(`<h3>${esc(title)}</h3><div class="row"><input type="number" inputmode="decimal" id="num-in" class="inp big"> <span>${unit}</span></div><button class="btn primary" id="num-ok">Aceptar</button>`);
  $('#num-in').focus();
  $('#num-ok').onclick = () => { const v = Number($('#num-in').value); if (!Number.isFinite(v) || $('#num-in').value === '') return; closeModal(); cb(v); };
}

function seededShuffle(arr, seed) {
  const a = [...arr]; let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor((s / 233280) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function openPuncion() {
  const sub = S.sub || 'antebrazo';
  const venas = VENAS[sub] || VENAS.antebrazo;
  const cat = S.engine.w.mano.map(u => S.engine.w.items[u]).find(i => i.id.startsWith('cat_'));
  const card = modal(`<h3>Canalización · ${esc(lugarTexto(S.region, sub))}</h3>
    <div class="muted">${esc(ITEMS[cat.id].nombre)}</div>
    <div class="lbl">Vena</div><div class="acts row-wrap">${venas.map((v, i) => `<button class="chip" data-vena="${esc(v)}">${esc(v)}</button>`).join('')}</div>
    <div class="lbl">Ángulo de inserción: <b id="ang-v">45</b>°</div>
    <input type="range" min="5" max="60" value="45" id="ang" class="wide-range">
    <div class="lbl">Bisel</div><div class="acts row-wrap"><button class="chip" data-bisel="arriba">Bisel hacia arriba</button><button class="chip" data-bisel="abajo">Bisel hacia abajo</button></div>
    <button class="btn primary big" id="do-punc" disabled>Puncionar</button>`, { wide: true });
  let vena = null, bisel = null;
  const upd = () => { $('#do-punc').disabled = !(vena && bisel); };
  $$('[data-vena]', card).forEach(b => b.onclick = () => { vena = b.dataset.vena; $$('[data-vena]', card).forEach(x => x.classList.toggle('sel', x === b)); upd(); });
  $$('[data-bisel]', card).forEach(b => b.onclick = () => { bisel = b.dataset.bisel; $$('[data-bisel]', card).forEach(x => x.classList.toggle('sel', x === b)); upd(); });
  $('#ang').oninput = () => { $('#ang-v').textContent = $('#ang').value; };
  $('#do-punc').onclick = () => { closeModal(); emit({ tipo: 'accion', accion: 'puncionar', region: S.region, sub, params: { vena, angulo: Number($('#ang')?.value || 45), bisel } }); };
  // valor del slider se lee antes de cerrar
  const btn = $('#do-punc'); btn.onclick = () => { const ang = Number($('#ang').value); closeModal(); emit({ tipo: 'accion', accion: 'puncionar', region: S.region, sub, params: { vena, angulo: ang, bisel } }); };
}

function openProcPanel(ui) {
  const e = S.engine, w = e.w;
  const seed = S.session.shuffleSeed;
  if (ui === 'iv_pasos') {
    const cat = w.iv.cat; if (!cat) return;
    const pasos = seededShuffle([['retorno', 'Observar retorno venoso'], ['avanzar', 'Bajar el ángulo y avanzar el catéter'], ['torniquete', 'Retirar (aflojar) el torniquete'], ['presion', 'Presión digital sobre la punta del catéter'], ['aguja', 'Retirar la aguja / activar seguridad'], ['reinsertar', 'Reinsertar la aguja en el catéter'], ['fallida', 'Retirar el catéter (punción fallida)']], seed);
    const card = modal(`<h3>Canalización en curso</h3><div class="muted small">${esc(cat.vena || '')} · ${cat.angulo}° · bisel ${cat.bisel}</div>
      <div class="acts">${pasos.map(([k, l]) => `<button class="btn act" data-paso="${k}">${l}</button>`).join('')}</div>
      <div class="proc-feed" id="proc-feed"></div>
      <button class="btn ghost" data-x2>Terminar y cerrar</button>`, { wide: true });
    const refresh = () => { $('#proc-feed').innerHTML = S.feed.slice(-4).reverse().map(m => `<div class="fm ${m.quien}">${m.quien === 'paciente' ? '<b>Paciente:</b> ' : ''}${esc(m.texto)}</div>`).join(''); };
    refresh();
    $$('[data-paso]', card).forEach(b => b.onclick = () => { emitNoUI({ tipo: 'accion', accion: 'iv', region: cat.region, sub: cat.sub, params: { paso: b.dataset.paso } }); refresh(); if (!S.engine.w.iv.cat) closeModal(); });
    $('[data-x2]', card).onclick = closeModal;
  }
  if (ui === 'foley') {
    const male = e.caso.sexo === 'M';
    const pasos = seededShuffle([
      ...(male ? [['retraer', 'Retraer el prepucio'], ['traccion', 'Pene perpendicular con tracción hacia arriba (mano no dominante, gasas estériles)'], ['prepucio', 'Regresar el prepucio']] : [['labios', 'Separar los labios con la mano no dominante']]),
      ['profundizar', male ? 'Avanzar hasta la bifurcación' : 'Profundizar 5 cm más'], ['inflar', 'Inflar el balón con la jeringa cargada'], ['desinflar', 'Desinflar el balón'],
      ['tope', 'Retirar suavemente hasta el tope'], ['tos', 'Pedir al paciente que tosa'], ['asistencia', 'Detener y solicitar asistencia médica'], ['retirar', 'Retirar la sonda'],
    ], seed + 7);
    const card = modal(`<h3>Sondaje vesical</h3>
      <div class="lbl">Introducir la sonda hasta: <b id="cm-v">5</b> cm</div>
      <input type="range" min="1" max="30" value="5" id="cm" class="wide-range"><button class="btn primary" id="intro">Introducir hasta esa longitud</button>
      <div class="acts">${pasos.map(([k, l]) => `<button class="btn act" data-paso="${k}">${l}</button>`).join('')}</div>
      <div class="proc-feed" id="proc-feed"></div><button class="btn ghost" data-x2>Cerrar panel</button>`, { wide: true });
    const refresh = () => { $('#proc-feed').innerHTML = S.feed.slice(-4).reverse().map(m => `<div class="fm ${m.quien}">${m.quien === 'paciente' ? '<b>Paciente:</b> ' : ''}${esc(m.texto)}</div>`).join(''); };
    refresh();
    $('#cm').oninput = () => { $('#cm-v').textContent = $('#cm').value; };
    $('#intro').onclick = () => { emitNoUI({ tipo: 'accion', accion: 'foley', region: 'genitales', params: { paso: 'introducir', cm: Number($('#cm').value) } }); refresh(); };
    $$('[data-paso]', card).forEach(b => b.onclick = () => { emitNoUI({ tipo: 'accion', accion: 'foley', region: 'genitales', params: { paso: b.dataset.paso } }); refresh(); if (!S.engine.w.foley) closeModal(); });
    $('[data-x2]', card).onclick = closeModal;
  }
  if (ui === 'sng') {
    const s = w.sng; if (!s) return;
    const pasos = seededShuffle([['tragar', 'Pedir que trague mientras avanza'], ['pausa', 'Pausar y dejar descansar unos minutos'], ['reorientar', 'Reorientar suavemente / cambiar de narina'], ['retirar_ya', 'Retirar la sonda de inmediato']], seed + 3);
    const card = modal(`<h3>Sonda gástrica · ${s.via === 'boca' ? 'vía orogástrica' : s.via === 'narina_d' ? 'narina derecha' : 'narina izquierda'}</h3>
      <div class="lbl">Introducir hasta: <b id="cm-v">20</b> cm ${s.marca ? `<span class="muted">(marca en ${s.marca} cm)</span>` : ''}</div>
      <input type="range" min="5" max="75" value="20" id="cm" class="wide-range"><button class="btn primary" id="intro">Introducir hasta esa longitud</button>
      <div class="acts">${pasos.map(([k, l]) => `<button class="btn act" data-paso="${k}">${l}</button>`).join('')}</div>
      <div class="proc-feed" id="proc-feed"></div><button class="btn ghost" data-x2>Cerrar panel</button>`, { wide: true });
    const refresh = () => { $('#proc-feed').innerHTML = S.feed.slice(-4).reverse().map(m => `<div class="fm ${m.quien}">${m.quien === 'paciente' ? '<b>Paciente:</b> ' : ''}${esc(m.texto)}</div>`).join(''); };
    refresh();
    $('#cm').oninput = () => { $('#cm-v').textContent = $('#cm').value; };
    $('#intro').onclick = () => { emitNoUI({ tipo: 'accion', accion: 'sng', region: s.via === 'boca' ? 'boca' : 'nariz', params: { paso: 'avanzar', cm: Number($('#cm').value) } }); refresh(); };
    $$('[data-paso]', card).forEach(b => b.onclick = () => { emitNoUI({ tipo: 'accion', accion: 'sng', region: s.via === 'boca' ? 'boca' : 'nariz', params: { paso: b.dataset.paso } }); refresh(); if (!S.engine.w.sng) closeModal(); });
    $('[data-x2]', card).onclick = closeModal;
  }
}
// Emite sin reabrir el panel de procedimiento (los fx 'ui' se ignoran)
function emitNoUI(ev) {
  const save = handleFx;
  ev.t = Math.round(elapsed()); ev.estadoAntes = S.engine.snapshot();
  const fx = S.engine.apply(ev);
  S.session.log.push(ev); persist();
  S.link && S.link.send({ type: 'ev', ev, n: S.session.log.length });
  save(fx.filter(f => f.tipo !== 'ui'), ev);
  render();
}

// ---------- Higiene de manos ----------
function startHygiene(metodo) {
  const w = S.engine.w;
  if (w.guantes) return toast('Primero retire los guantes.');
  const cfg = S.session.config.minijuego || 'primera';
  const play = cfg === 'siempre' || (S.session.juegos || 0) === 0;
  if (!play) { emit({ tipo: 'higiene', metodo }); toast(metodo === 'agua' ? '🧼 Manos lavadas' : '🧴 Manos higienizadas'); return; }
  const H = HANDWASH[metodo];
  const cards = seededShuffle([...H.pasos, ...H.distractores], Date.now() % 100000);
  const chosen = [];
  const card = modal(`<h3>${H.nombre} <small class="muted">(${H.duracion})</small></h3>
    <p class="muted small">Toque los pasos en el orden en que los realiza. Toque uno de abajo para quitarlo.</p>
    <div class="hw-pool" id="hw-pool"></div>
    <div class="lbl">Su secuencia</div><ol class="hw-seq" id="hw-seq"></ol>
    <button class="btn primary big" id="hw-done">Terminar</button>`, { wide: true, noClose: true });
  const draw = () => {
    $('#hw-pool').innerHTML = cards.map((c, i) => chosen.includes(i) ? '' : `<button class="hw-card" data-i="${i}">${esc(c)}</button>`).join('');
    $('#hw-seq').innerHTML = chosen.map((i, k) => `<li><button class="hw-card in" data-k="${k}">${esc(cards[i])}</button></li>`).join('');
    $$('#hw-pool [data-i]').forEach(b => b.onclick = () => { chosen.push(Number(b.dataset.i)); draw(); });
    $$('#hw-seq [data-k]').forEach(b => b.onclick = () => { chosen.splice(Number(b.dataset.k), 1); draw(); });
  };
  draw();
  $('#hw-done').onclick = () => {
    const seq = chosen.map(i => cards[i]);
    let aciertos = 0; seq.forEach((s, k) => { if (H.pasos[k] === s) aciertos++; });
    const distractores = seq.filter(s => H.distractores.includes(s)).length;
    S.session.juegos = (S.session.juegos || 0) + 1;
    closeModal();
    emit({ tipo: 'higiene', metodo, juego: { aciertos, total: H.pasos.length, distractores, elegidos: seq.length, secuencia: seq } });
    toast(metodo === 'agua' ? '🧼 Manos lavadas' : '🧴 Manos higienizadas');
  };
}

// ---------- Computador ----------
function openPC(tab) {
  const e = S.engine, c = e.caso;
  if (tab === 'orden' || tab === 'historia') emit({ tipo: 'pc', accion: tab }, { noSnap: true });
  const tabs = [['orden', 'Orden médica'], ['historia', 'Historia clínica'], ['notas', 'Notas'], ['pae', 'PAE'], ['goteo', 'Goteo']];
  const card = modal(`<div class="pc-tabs">${tabs.map(([k, l]) => `<button class="tab ${k === tab ? 'sel' : ''}" data-tab="${k}">${l}</button>`).join('')}</div><div id="pc-body" class="pc-body"></div>`, { wide: true, cls: 'pc' });
  $$('[data-tab]', card).forEach(b => b.onclick = () => openPC(b.dataset.tab));
  const body = $('#pc-body');
  if (tab === 'orden') body.innerHTML = `<h3>Orden médica</h3><div class="paper"><p><b>Paciente:</b> ${esc(c.paciente.nombre)} · ${esc(c.paciente.doc)} · ${c.paciente.edad} años</p><p><b>Servicio:</b> ${esc(c.servicio)}</p><p>${esc(c.orden)}</p></div>`;
  if (tab === 'historia') body.innerHTML = `<h3>Historia clínica</h3><div class="paper"><p><b>${esc(c.paciente.nombre)}</b> · ${esc(c.paciente.doc)} · ${c.paciente.edad} años</p><p><b>Motivo de consulta:</b> ${esc(c.motivo)}</p>${c.historia.map(([k, v]) => `<p><b>${esc(k)}:</b> ${esc(v)}</p>`).join('')}<p><b>Signos vitales de ingreso:</b> ${esc(c.svTexto)}</p><p><b>Paraclínicos:</b> ${esc(c.reportes)}</p></div>`;
  if (tab === 'notas') {
    body.innerHTML = `<h3>Notas de enfermería</h3><textarea id="notas" class="inp ta" rows="10" placeholder="Registre lo realizado, hallazgos, reacción del paciente…">${esc(e.w.notas)}</textarea><button class="btn primary" id="save-notas">Guardar notas</button>`;
    $('#save-notas').onclick = () => { emit({ tipo: 'notas', texto: $('#notas').value }, { noSnap: true }); toast('Notas guardadas'); };
  }
  if (tab === 'goteo') {
    body.innerHTML = `<h3>Cálculo de goteo</h3><p class="muted">Escriba el resultado de su cálculo.</p><div class="row"><input type="number" id="gt" class="inp big" value="${e.w.goteo ?? ''}"> <span>gotas/min</span></div><button class="btn primary" id="save-gt">Guardar</button>`;
    $('#save-gt').onclick = () => { if ($('#gt').value === '') return; emit({ tipo: 'goteo', valor: Number($('#gt').value) }, { noSnap: true }); toast('Guardado'); };
  }
  if (tab === 'pae') renderPAE(body);
}

function renderPAE(body) {
  const e = S.engine; const c = e.caso; const X = c.minIntervenciones || 3;
  const p = e.w.pae || {}; const nic = p.nic && p.nic.length ? p.nic : Array.from({ length: X }, () => ({ nombre: '', actividades: '' }));
  body.innerHTML = `<h3>Proceso de Atención de Enfermería</h3>
  <form id="pae-form" class="pae" autocomplete="off">
    <fieldset><legend>Valoración</legend><textarea name="valoracion" class="inp ta" rows="3" placeholder="Hallazgos relevantes organizados por dominio">${esc(p.valoracion)}</textarea></fieldset>
    <fieldset><legend>Diagnóstico</legend>
      <label>DOMINIO<input name="dominio" class="inp ac" data-src="dominio" value="${esc(p.dominio)}"></label>
      <label>CLASE<input name="clase" class="inp ac" data-src="clase" value="${esc(p.clase)}"></label>
      <label>Diagnóstico NANDA<input name="nanda" class="inp ac" data-src="nanda" value="${esc(p.nanda)}"></label>
      <label>R/C (o F/R)<input name="rc" class="inp" value="${esc(p.rc)}"></label>
      <label>E/P (o C/D) <small class="muted">— en diagnósticos de riesgo, deje vacío</small><input name="ep" class="inp" value="${esc(p.ep)}"></label>
    </fieldset>
    <fieldset><legend>Planeación (NOC)</legend>
      <label>Resultado NOC<input name="noc" class="inp ac" data-src="noc" value="${esc(p.noc)}"></label>
      <label>Indicador<input name="indicador" class="inp" value="${esc(p.indicador)}"></label>
      <label>Escala<input name="escala" class="inp ac" data-src="escala" value="${esc(p.escala)}"></label>
      <div class="row"><label>Actual <select name="actual" class="inp">${['', 1, 2, 3, 4, 5].map(v => `<option ${String(p.actual) === String(v) ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <span>→</span><label>Esperado <select name="esperado" class="inp">${['', 1, 2, 3, 4, 5].map(v => `<option ${String(p.esperado) === String(v) ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>
    </fieldset>
    <fieldset><legend>Intervenciones (NIC) — mínimo ${X}</legend><div id="nic-list">${nic.map((n, i) => nicRow(n, i)).join('')}</div><button type="button" class="btn ghost small" id="add-nic">+ Agregar NIC</button></fieldset>
    <fieldset><legend>Evaluación</legend><textarea name="evaluacion" class="inp ta" rows="2" placeholder="Valor alcanzado">${esc(p.evaluacion)}</textarea></fieldset>
    <button type="button" class="btn primary big" id="save-pae">Guardar PAE</button>
  </form>`;
  const form = $('#pae-form');
  $('#add-nic').onclick = () => { const list = $('#nic-list'); list.insertAdjacentHTML('beforeend', nicRow({}, list.children.length)); bindAC(form); };
  $('#save-pae').onclick = () => {
    const fd = new FormData(form);
    const pae = Object.fromEntries(['valoracion', 'dominio', 'clase', 'nanda', 'rc', 'ep', 'noc', 'indicador', 'escala', 'actual', 'esperado', 'evaluacion'].map(k => [k, (fd.get(k) || '').toString()]));
    pae.nic = $$('.nic-row', form).map(r => ({ nombre: $('.nic-n', r).value, actividades: $('.nic-a', r).value })).filter(n => n.nombre || n.actividades);
    emit({ tipo: 'pae', pae }, { noSnap: true });
    toast('PAE guardado');
  };
  bindAC(form);
}
function nicRow(n, i) {
  return `<div class="nic-row"><input class="inp ac nic-n" data-src="nic" placeholder="NIC ${i + 1}" value="${esc(n.nombre)}"><textarea class="inp ta nic-a" rows="2" placeholder="2–3 actividades">${esc(n.actividades)}</textarea></div>`;
}
const normTxt = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function acSource(src) {
  if (src === 'dominio') return dominioOpciones();
  if (src === 'clase') return claseOpciones();
  if (src === 'nanda') return NANDA.map(x => x.label + (x.cod ? ` (${x.cod})` : ''));
  if (src === 'noc') return NOC.map(x => x.label + (x.cod ? ` (${x.cod})` : ''));
  if (src === 'nic') return NIC.map(x => x.label + (x.cod ? ` (${x.cod})` : ''));
  if (src === 'escala') return ESCALAS_LIKERT;
  return [];
}
function bindAC(form) {
  $$('.ac', form).forEach(inp => {
    if (inp._ac) return; inp._ac = true;
    const box = document.createElement('div'); box.className = 'ac-box'; inp.after(box);
    const upd = () => {
      const q = normTxt(inp.value.trim());
      if (q.length < 3) { box.innerHTML = ''; return; }
      const opts = acSource(inp.dataset.src).filter(o => normTxt(o).includes(q)).slice(0, 8);
      box.innerHTML = opts.map(o => `<button type="button" class="ac-opt">${esc(o)}</button>`).join('');
      $$('.ac-opt', box).forEach(b => b.onclick = () => { inp.value = b.textContent; box.innerHTML = ''; });
    };
    inp.addEventListener('input', upd);
    inp.addEventListener('blur', () => setTimeout(() => { box.innerHTML = ''; }, 200));
  });
}

// ---------- Hablar / Otra acción / Entrega ----------
function openTalk(kind) {
  const isTalk = kind === 'hablar';
  const card = modal(`<h3>${isTalk ? 'Hablar con el paciente' : 'Otra acción'}</h3>
    <textarea id="talk" class="inp ta" rows="4" placeholder="${isTalk ? 'Escriba lo que le dice al paciente…' : 'Describa la acción que realiza…'}"></textarea>
    <button class="btn primary big" id="talk-send">${isTalk ? 'Decir' : 'Registrar acción'}</button>`);
  const ta = $('#talk'); ta.focus();
  $('#talk-send').onclick = () => {
    const tx = ta.value.trim(); if (!tx) return;
    closeModal();
    emit({ tipo: isTalk ? 'hablar' : 'otra', texto: tx });
    S.feed.push({ quien: 'yo', texto: (isTalk ? 'Usted: ' : 'Acción: ') + tx, t: Math.round(elapsed()) }); renderFeed();
    if (isTalk && (S.session.modo === 'practica' || !S.link?.connected)) {
      const r = autoRespuesta(S.engine.caso, tx);
      if (r) setTimeout(() => emit({ tipo: 'evaluador', accion: 'voz', texto: r, auto: true }, { noSnap: true }), 900);
    }
  };
}

function openEntrega(forced) {
  const card = modal(`<h3>Entrega de actividades al evaluador</h3>
    ${forced ? '<p class="warn-txt">El tiempo terminó: tiene 1 minuto solo para la entrega.</p>' : ''}
    <p class="muted small">Relate qué valoró, qué hizo, cómo quedó el paciente y su diagnóstico prioritario.</p>
    <textarea id="entrega" class="inp ta" rows="8">${esc(S.engine.w.entrega)}</textarea>
    <button class="btn primary big" id="ent-send">Entregar al evaluador</button>`, { wide: true, noClose: forced });
  $('#entrega').focus();
  $('#ent-send').onclick = () => {
    const tx = $('#entrega').value.trim(); if (!tx) return;
    emit({ tipo: 'entrega', texto: tx }, { noSnap: true });
    closeModal(); toast('Entrega registrada');
    if (S.session.phase === 'entrega') finalize(S.session.finalReason || 'tiempo');
  };
}

function confirmFinish() {
  const card = modal(`<h3>¿Finalizar la estación?</h3><p>${S.engine.f('entrega') ? '' : 'Aún no ha hecho la entrega de actividades: tendrá 1 minuto para hacerla.'}</p>
    <div class="row"><button class="btn" data-x2>Seguir</button><button class="btn danger" id="fin-ok">Finalizar</button></div>`);
  $('[data-x2]', card).onclick = closeModal;
  $('#fin-ok').onclick = () => { closeModal(); endStation('estudiante'); };
}

// =================== Feedback visual ===================
function toast(t) {
  const el = h(`<div class="toast">${esc(t)}</div>`); $('#toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), 2200); setTimeout(() => el.remove(), 2700);
}
function notify(t) {
  const el = h(`<div class="notify"><div class="n-ic">!</div><div>${esc(t)}</div></div>`); $('#toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), 7000); setTimeout(() => el.remove(), 7600);
}
function bubble(t) {
  $$('.bubble').forEach(b => { b.textContent = t; b.classList.add('show'); });
  clearTimeout(S.bubbleTimer);
  S.bubbleTimer = setTimeout(() => $$('.bubble').forEach(b => b.classList.remove('show')), 6500);
}
function flashGlove() { const b = $('#btn-hands'); if (b) { b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash'); } }
function blinkMonitor() { S._blink = true; setTimeout(() => { S._blink = false; if (S.zone === 'monitor') renderPanel(); }, 1200); const hs = $('.hs[data-zone="monitor"]'); if (hs) { hs.classList.remove('blink'); void hs.offsetWidth; hs.classList.add('blink'); } }
function fly(fromEl, toEl) {
  try {
    if (!fromEl || !toEl) return;
    const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
    const c = fromEl.cloneNode(true); c.classList.add('flying');
    Object.assign(c.style, { left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px' });
    document.body.appendChild(c);
    requestAnimationFrame(() => { c.style.transform = `translate(${b.left + 30 - a.left}px, ${b.top + 10 - a.top}px) scale(.5)`; c.style.opacity = '0.2'; });
    setTimeout(() => c.remove(), 600);
  } catch (e) { /* */ }
}

// =================== Wake Lock / pantalla completa ===================
let wakeLock = null;
async function requestWakeLock() { try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) { /* */ } }
function releaseWakeLock() { try { wakeLock && wakeLock.release(); } catch (e) { /* */ } wakeLock = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.session?.phase === 'estacion') requestWakeLock(); });
function toggleFullscreen() {
  try { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }); else document.exitFullscreen?.(); } catch (e) { /* */ }
}

// =================== Modo calibración ===================
function calibrate() {
  document.body.classList.add('calibrating');
  show('station');
  $('#topbar').innerHTML = `<b>Modo calibración</b> <button class="btn" id="cal-mode">Zonas del cuarto</button> <button class="btn" id="cal-export">Exportar JSON</button> <a class="btn ghost" href="student.html">Salir</a>`;
  let mode = 'room';
  const draw = () => {
    const stage = $('#stage');
    const list = mode === 'room' ? HOTSPOTS : REGIONS;
    stage.innerHTML = mode === 'room'
      ? `<div class="room-wrap"><div class="room" id="room"><img class="room-bg" src="assets/room-bg.png" draggable="false"><div class="bed-overlay" style="left:${BED_OVERLAY.x}%;top:${BED_OVERLAY.y}%;width:${BED_OVERLAY.w}%"><div class="pbox"><img src="assets/patient-m.png" draggable="false"></div></div><div id="cal-layer" class="cal-layer"></div></div></div>`
      : `<div class="patient-stage"><div class="pbox big" id="room"><img src="assets/patient-m.png" draggable="false"><div id="cal-layer" class="cal-layer"></div></div></div>`;
    const layer = $('#cal-layer');
    list.forEach((z, i) => {
      const el = h(`<div class="cal-rect" style="left:${z.x}%;top:${z.y}%;width:${z.w}%;height:${z.h}%"><span>${esc(z.id)}</span><i class="cal-h"></i></div>`);
      layer.appendChild(el);
      const startDrag = (ev, resize) => {
        ev.preventDefault(); ev.stopPropagation();
        const R = layer.getBoundingClientRect(); const sx = ev.clientX, sy = ev.clientY; const o = { ...z };
        const mv = (e) => {
          const dx = (e.clientX - sx) / R.width * 100, dy = (e.clientY - sy) / R.height * 100;
          if (resize) { z.w = Math.max(1, +(o.w + dx).toFixed(1)); z.h = Math.max(1, +(o.h + dy).toFixed(1)); }
          else { z.x = +(o.x + dx).toFixed(1); z.y = +(o.y + dy).toFixed(1); }
          Object.assign(el.style, { left: z.x + '%', top: z.y + '%', width: z.w + '%', height: z.h + '%' });
        };
        const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
        window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
      };
      el.addEventListener('pointerdown', (e) => startDrag(e, false));
      el.querySelector('.cal-h').addEventListener('pointerdown', (e) => startDrag(e, true));
    });
    $('#panel-body').innerHTML = `<h3>Calibración: ${mode === 'room' ? 'zonas del cuarto (HOTSPOTS)' : 'regiones del paciente (REGIONS)'}</h3><p class="muted">Arrastre cada rectángulo; use la esquina inferior derecha para cambiar el tamaño. Luego «Exportar JSON» y pegue el resultado en data/hotspots.js.</p><textarea id="cal-out" class="inp ta" rows="16"></textarea>`;
  };
  draw();
  $('#cal-mode').onclick = () => { mode = mode === 'room' ? 'patient' : 'room'; $('#cal-mode').textContent = mode === 'room' ? 'Zonas del cuarto' : 'Regiones del paciente'; draw(); };
  $('#cal-export').onclick = () => {
    const list = mode === 'room' ? HOTSPOTS : REGIONS;
    const txt = JSON.stringify(list, null, 2);
    $('#cal-out').value = txt;
    try { navigator.clipboard && navigator.clipboard.writeText(txt); toast('Copiado al portapapeles'); } catch (e) { /* */ }
  };
}

// =================== Inicio ===================
function init() {
  const params = new URLSearchParams(location.search);
  if (params.get('calibrar')) return calibrate();

  $('#j-code').addEventListener('input', (e) => { e.target.value = normalizeCode(e.target.value); });
  $('#j-name').value = load('student-name', '');
  $('#btn-join').onclick = () => {
    const code = normalizeCode($('#j-code').value);
    if (code.length !== 6) return toast('El código tiene 6 caracteres.');
    save('student-name', $('#j-name').value.trim());
    $('#join-status').textContent = 'Conectando…';
    startLink(code);
  };
  $('#btn-practice').onclick = () => {
    save('student-name', $('#j-name').value.trim());
    if (S.link) { S.link.close(); S.link = null; }
    newSession({ modo: 'practica', caseId: $('#p-case').value, durMin: Number($('#p-dur').value), config: { minijuego: $('#p-mini').value }, estudiante: $('#j-name').value.trim() });
    S.conn = { status: 'red', detail: 'Modo práctica' };
    show('guide'); render(); renderConn();
  };
  $('#btn-start').onclick = startStation;
  $('#btn-talk').onclick = () => openTalk('hablar');
  $('#btn-other').onclick = () => openTalk('otra');
  $('#btn-deliver').onclick = () => openEntrega(false);
  $('#btn-finish').onclick = confirmFinish;
  $('#btn-guide').onclick = () => { const c = S.engine.caso; const card = modal(guideHTML(c, guiaEstudiante(c, S.session.durMin), S.session.durMin), { wide: true }); };
  $$('.btn-fs').forEach(b => b.onclick = toggleFullscreen);
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' && !$('#modal .modal-card [data-x]') === false) { /* clic fuera no cierra para evitar toques accidentales */ } });

  setInterval(() => {
    if (!S.session) return;
    if (document.body.dataset.screen === 'station') renderTimer();
    if ((S.session.phase === 'estacion') && S.session.timer.startAt && !S.session.timer.pausedAt && remaining() <= 0) endStation('tiempo');
    if (S.session.phase === 'entrega' && remaining() <= 0) finalize(S.session.finalReason || 'tiempo');
  }, 250);

  // Restaurar sesión
  const prev = load('student-session');
  if (prev && prev.caseId && getCase(prev.caseId)) {
    S.session = prev; buildEngine();
    if (prev.modo === 'live' && prev.code) startLink(prev.code);
    if (prev.phase === 'fin') showReport();
    else if (prev.timer.startAt) { show('station'); render(); }
    else { show('guide'); render(); }
  } else { show('join'); renderJoin(); }
  renderConn();
}

init();
