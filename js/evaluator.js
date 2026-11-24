// Panel de la evaluadora: crea la estación, sigue en vivo, controla al paciente y califica.
import { Engine, fmt, lugarTexto, POSICIONES } from './engine.js';
import { ITEMS } from '../data/items.js';
import { CASES, getCase, eventosDelCaso, TEMAS, guiaEstudiante } from '../data/cases.js';
import { Link, newCode } from './peer.js';
import { load, save, remove, pushHistory, getHistory } from './storage.js';
import { renderReport } from './report.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nota = (x) => (Math.round((x ?? 0) * 10) / 10).toFixed(1).replace('.', ',');

const E = { st: null, engine: null, link: null, conn: { status: 'red', detail: '' }, tab: 'psicomotriz', ctab: 'voz', filter: 'todo', lastAlerts: 0, sound: load('eval-sound', true), hb: null, view: 'live' };
const FILAS = ['DOMINIO, CLASE, NANDA, R/C y E/P', 'Interpreta / explica / expone hallazgos', 'Argumenta: NOC (indicador, escala) y NIC'];

function persist() { if (E.st) save('eval-station', E.st); }
function emptyOverrides() { return { items: {}, cognitivo: [null, null, null], psicomotriz: null, comunicativo: null, observaciones: '', umbral: 3.0 }; }

// =================== Setup ===================
function renderSetup() {
  show('setup');
  const byTema = {};
  CASES.forEach(c => (byTema[c.tema] = byTema[c.tema] || []).push(c));
  const sel = load('eval-last-case', '2A');
  $('#case-list').innerHTML = Object.entries(byTema).map(([t, cs]) => `<div class="tema"><div class="lbl">${esc(TEMAS[t].nombre)}</div>${cs.map(c => `<label class="case-opt"><input type="radio" name="case" value="${c.id}" ${c.id === sel ? 'checked' : ''}><span><b>${c.id}</b> ${esc(c.titulo)} <small class="muted">· ${c.sexo === 'M' ? 'Hombre' : 'Mujer'} ${c.edad} a</small></span></label>`).join('')}</div>`).join('');
  const hist = getHistory('evaluador');
  $('#eval-history').innerHTML = hist.length ? hist.map((x, i) => `<button class="hist-row btn-row" data-h="${i}"><b>${esc(x.caso)}</b> ${esc(x.titulo)} <span class="muted">${esc(x.estudiante || '')} · ${new Date(x.fecha).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</span> <span class="pill ${x.aprobado ? 'ok' : 'bad'}">${nota(x.nota)}</span></button>`).join('') : '<p class="muted">Sin estaciones previas.</p>';
  $$('[data-h]').forEach(b => b.onclick = () => openHistory(hist[Number(b.dataset.h)]));
}

function createStation() {
  const caseId = ($('input[name=case]:checked') || {}).value; if (!caseId) return;
  save('eval-last-case', caseId);
  const durMin = Number($('#dur').value);
  E.st = {
    id: 'st' + Date.now().toString(36), code: newCode(), caseId, durMin, createdAt: Date.now(),
    config: { minijuego: $('#mini').value }, log: [], overrides: { ...emptyOverrides(), umbral: Number($('#umbral').value) || 3 },
    phase: 'esperando', remaining: durMin * 60000, running: false, rxAt: Date.now(), estudiante: '', ended: false, usedMs: 0, startedAt: null,
  };
  persist();
  startStationView();
}

function startStationView() {
  rebuild();
  show('live');
  if (E.link) E.link.close();
  E.link = new Link('host', {
    code: E.st.code,
    onStatus: (s) => { E.conn = s; renderHeader(); },
    onConnect: () => { sendStation(); },
    onMessage,
  });
  renderAll();
}

function sendStation() {
  E.link && E.link.send({ type: 'station', stationId: E.st.id, caseId: E.st.caseId, durMin: E.st.durMin, config: E.st.config });
  if (E.st.ended) sendFinal();
}

// =================== Mensajes ===================
function onMessage(msg) {
  const st = E.st; if (!st) return;
  switch (msg.type) {
    case 'hello':
      if (msg.estudiante) st.estudiante = msg.estudiante;
      if (msg.stationId !== st.id) sendStation();
      persist(); renderHeader();
      break;
    case 'sync':
      if (msg.stationId !== st.id) { sendStation(); return; }
      st.log = msg.log || []; st.estudiante = msg.estudiante || st.estudiante; st.phase = msg.phase; st.startedAt = msg.startedAt || st.startedAt;
      if (msg.timer) { st.remaining = msg.timer.remaining; st.running = msg.timer.running; st.rxAt = Date.now(); }
      if (msg.phase === 'fin' && !st.ended) { st.ended = true; }
      rebuild(); persist(); renderAll();
      if (st.ended) sendFinal();
      break;
    case 'ev': {
      if (msg.n === st.log.length + 1) {
        st.log.push(msg.ev); E.engine.apply(msg.ev);
        if (msg.ev.tipo === 'sistema' && msg.ev.accion === 'inicio') { st.phase = 'estacion'; st.startedAt = Date.now() - (msg.ev.t || 0); }
        persist(); renderAll(msg.ev);
      } else if (msg.n > st.log.length + 1) E.link.send({ type: 'sync-request' });
      break;
    }
    case 'heartbeat':
      if (msg.remaining != null) { st.remaining = msg.remaining; st.rxAt = Date.now(); }
      st.running = !!msg.running; if (msg.phase) st.phase = msg.phase;
      if (msg.n != null && msg.n > st.log.length) E.link.send({ type: 'sync-request' });
      break;
    case 'end':
      st.log = msg.log || st.log; st.ended = true; st.phase = 'fin'; st.usedMs = msg.usedMs || 0; st.reason = msg.reason;
      rebuild(); persist(); renderAll();
      sendFinal();
      beep(660); beep(880, 0.25);
      break;
    default: break;
  }
}

function rebuild() {
  const c = getCase(E.st.caseId);
  E.engine = new Engine(c, { modo: 'evaluador' });
  for (const ev of E.st.log) E.engine.apply(ev);
}

function sendCmd(msg) { if (E.link) E.link.send(msg, true); }
function sendFinal() { if (E.st && E.st.ended) sendCmd({ type: 'final', overrides: E.st.overrides }); }

// =================== Render ===================
function show(name) { $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + name)); document.body.dataset.screen = name; }

function renderAll(newEv) {
  renderHeader(); renderLists(); renderAlerts(); renderTimeline(); renderControls();
  if (E.st.ended && E.view === 'report') renderEvalReport();
}

function renderHeader() {
  const st = E.st; if (!st) return;
  const c = getCase(st.caseId);
  $('#h-case').textContent = `Caso ${c.id} · ${c.titulo}`;
  $('#h-code').textContent = st.code;
  $('#h-student').textContent = st.estudiante ? 'Estudiante: ' + st.estudiante : '';
  const conn = $('#h-conn'); conn.className = 'conn ' + E.conn.status; conn.querySelector('.conn-txt').textContent = E.conn.status === 'green' ? 'Estudiante conectado' : (E.conn.detail || 'Sin conexión');
  $('#h-phase').textContent = { esperando: 'Esperando al estudiante', guia: 'Leyendo la guía', estacion: 'Estación en curso', entrega: 'Minuto de entrega', fin: 'Estación terminada' }[st.phase] || st.phase;
  $('#btn-report').disabled = false;
  renderTimer();
}

function renderTimer() {
  const st = E.st; if (!st) return;
  let r = st.remaining ?? st.durMin * 60000;
  if (st.running && st.rxAt) r -= Date.now() - st.rxAt;
  const el = $('#h-timer');
  el.textContent = st.ended ? fmt(st.usedMs) : fmt(Math.max(0, r));
  el.className = 'timer' + (st.ended ? ' done' : r <= 60000 ? ' red' : r <= 300000 ? ' amber' : '') + (!st.running && !st.ended && st.phase === 'estacion' ? ' paused' : '');
}

function liveEval() { return E.engine.evaluate(E.st.overrides, E.st.ended); }

function renderLists() {
  const ev = liveEval();
  const by = { cognitivo: [], psicomotriz: [], comunicativo: [] };
  ev.lista.forEach(it => by[it.competencia]?.push(ev.items[it.id]));
  const ov = E.st.overrides;
  const row = (r) => {
    const st = r.estado;
    return `<button class="ck ${st}" data-item="${r.id}"><span class="ck-dot"></span><span class="ck-txt">${esc(r.item.texto)}${r.item.critico ? ' <b class="crit-tag">crítico</b>' : ''}${r.manual !== undefined ? ' <i class="adj">ajustado</i>' : ''}</span><span class="ck-t">${r.t != null ? fmt(r.t) : ''}</span></button>`;
  };
  const adj = (k) => {
    const auto = ev.auto[k];
    const cur = ov[k];
    const vals = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
    return `<div class="adj-row"><span class="muted small">Automática ${nota(auto)} · Ajuste:</span> <button class="chip sm ${cur == null ? 'sel' : ''}" data-adj="${k}" data-v="auto">auto</button>${vals.map(v => `<button class="chip sm ${cur === v ? 'sel' : ''}" data-adj="${k}" data-v="${v}">${nota(v)}</button>`).join('')}</div>`;
  };
  const pae = E.engine.w.pae;
  const colHTML = {
    cognitivo: `<div class="col-head"><h3>Cognitivo</h3><div class="col-score">${nota(ev.notas.cognitivo)}</div></div>
      <div class="rubric">${FILAS.map((f, i) => `<div class="rub-row"><div class="rub-t">${i + 1}. ${f} <span class="muted small">(sugerida ${nota(ev.sugerenciaCognitivo[i])})</span></div><div class="rub-b">${[0, 1, 2, 3, 4, 5].map(v => `<button class="chip ${ov.cognitivo[i] === v ? 'sel' : ''} ${ov.cognitivo[i] == null && Math.round(ev.sugerenciaCognitivo[i]) === v ? 'sug' : ''}" data-rub="${i}" data-v="${v}">${v}</button>`).join('')}</div></div>`).join('')}
      <div class="muted small">Puntaje sumado y dividido (${nota(ev.filasCognitivo.reduce((a, b) => a + b, 0))})/3 = <b>${nota(ev.notas.cognitivo)}</b></div></div>
      <details class="pae-live" ${pae ? 'open' : ''}><summary>PAE del estudiante ${pae ? '' : '(aún no lo guarda)'}</summary>${pae ? `<div class="small"><b>Dominio:</b> ${esc(pae.dominio)}<br><b>Clase:</b> ${esc(pae.clase)}<br><b>NANDA:</b> ${esc(pae.nanda)}<br><b>R/C:</b> ${esc(pae.rc)}<br><b>E/P:</b> ${esc(pae.ep)}<br><b>NOC:</b> ${esc(pae.noc)} · ${esc(pae.indicador)} · ${esc(pae.actual)}→${esc(pae.esperado)}<br><b>NIC:</b> ${(pae.nic || []).map(n => esc(n.nombre)).join(' · ')}<br><b>Valoración:</b> ${esc(pae.valoracion)}</div>` : ''}
      <div class="small acc"><b>Aceptado:</b> ${esc(getCase(E.st.caseId).pae.texto)}</div></details>
      ${by.cognitivo.map(row).join('')}`,
    psicomotriz: `<div class="col-head"><h3>Psicomotriz</h3><div class="col-score ${ev.fallaCritica ? 'crit' : ''}">${nota(ev.notas.psicomotriz)}</div></div>${ev.fallaCritica ? '<div class="crit-banner">FALLA CRÍTICA (máx. 2,5)</div>' : ''}${adj('psicomotriz')}<div class="muted small">Intervenciones: ${ev.intervenciones.hechas.length}/${ev.intervenciones.minimo} · Penalizaciones: ${ev.penalizaciones}</div>${by.psicomotriz.map(row).join('')}`,
    comunicativo: `<div class="col-head"><h3>Comunicativo</h3><div class="col-score">${nota(ev.notas.comunicativo)}</div></div>${adj('comunicativo')}${by.comunicativo.map(row).join('')}`,
  };
  $('#cols').innerHTML = ['cognitivo', 'psicomotriz', 'comunicativo'].map(k => `<section class="col ${E.tab === k ? 'active' : ''}" data-col="${k}">${colHTML[k]}</section>`).join('');
  $$('#col-tabs [data-tab]').forEach(b => { b.classList.toggle('sel', b.dataset.tab === E.tab); const k = b.dataset.tab; b.querySelector('b').textContent = nota(ev.notas[k]); });
  $('#final-score').innerHTML = `Final <b>${nota(ev.notas.final)}</b> <span class="pill ${ev.aprobado ? 'ok' : 'bad'}">${ev.aprobado ? 'Aprueba' : 'No aprueba'}</span>`;
  // handlers
  $$('[data-item]').forEach(b => b.onclick = () => cycleItem(b.dataset.item, ev.items[b.dataset.item]));
  $$('[data-rub]').forEach(b => b.onclick = () => { const i = Number(b.dataset.rub), v = Number(b.dataset.v); ov.cognitivo[i] = ov.cognitivo[i] === v ? null : v; changed(); });
  $$('[data-adj]').forEach(b => b.onclick = () => { ov[b.dataset.adj] = b.dataset.v === 'auto' ? null : Number(b.dataset.v); changed(); });
}

function cycleItem(id, r) {
  const ov = E.st.overrides.items;
  // ciclo: automático → cumplido → fuera de orden → no cumplido → automático
  const cur = ov[id];
  if (cur === undefined) ov[id] = true; else if (cur === true) ov[id] = 'orden'; else if (cur === 'orden') ov[id] = false; else delete ov[id];
  changed();
}

function changed() { persist(); renderLists(); if (E.st.ended) { sendFinal(); if (E.view === 'report') renderEvalReport(); } }

const ALERT_LBL = { penalizacion: 'Penalización', falla: 'FALLA CRÍTICA', info: 'Alerta', orden: 'Orden' };
function renderAlerts() {
  const al = E.engine.alerts;
  if (al.length > E.lastAlerts && E.lastAlerts > 0 || (al.length && E.lastAlerts === 0 && E._alertsInit)) beep(al[al.length - 1].tipo === 'falla' ? 300 : 520);
  E.lastAlerts = al.length; E._alertsInit = true;
  const ev = liveEval();
  const orden = Object.values(ev.items).filter(r => r.estado === 'orden').map(r => ({ t: r.t, tipo: 'orden', texto: 'Fuera de orden: ' + r.item.texto, correcto: r.item.correcto }));
  const all = [...al, ...orden].sort((a, b) => b.t - a.t);
  $('#alerts').innerHTML = all.length ? all.map(a => `<div class="alert ${a.tipo}"><div class="a-h"><span class="tm">${fmt(a.t)}</span> <b>${ALERT_LBL[a.tipo] || a.tipo}</b></div><div>${esc(a.texto)}</div>${a.correcto ? `<div class="ok-was">Lo correcto era: ${esc(a.correcto)}</div>` : ''}</div>`).join('') : '<p class="muted small">Sin alertas.</p>';
}

function describe(ev) {
  const nm = (id) => ITEMS[id]?.nombre || id;
  const inst = (uid) => E.engine.w.items[uid];
  const lug = (e) => e.region ? lugarTexto(e.region, e.sub) : '';
  switch (ev.tipo) {
    case 'sistema': return { k: 'sis', t: { inicio: 'Inicia la estación', fin: 'Fin de la estación (' + (ev.motivo || '') + ')', pausa: 'Pausa', reanuda: 'Reanuda' }[ev.accion] || ev.accion };
    case 'zona': return { k: 'acc', t: 'Abre zona: ' + ev.zona };
    case 'tomar': return { k: 'acc', t: 'Toma: ' + nm(ev.item) + (ev.dest === 'bandeja' ? ' (a la bandeja)' : '') };
    case 'mover': return { k: 'acc', t: (ev.a === 'devolver' ? 'Devuelve ' : 'Mueve a ' + ev.a + ': ') + nm(inst(ev.uid)?.id) };
    case 'desechar': return { k: 'acc', t: `Desecha ${nm(inst(ev.uid)?.id)} en ${ev.caneca}` };
    case 'ponerse': return { k: 'acc', t: 'Se pone: ' + nm(inst(ev.uid)?.id) };
    case 'retirar_guantes': return { k: 'acc', t: 'Se retira los guantes' };
    case 'higiene': return { k: 'acc', t: 'Higiene de manos: ' + (ev.metodo === 'agua' ? 'agua y jabón' : 'alcohol glicerinado') + (ev.juego ? ` (minijuego ${ev.juego.aciertos}/${ev.juego.total}${ev.juego.distractores ? ', ' + ev.juego.distractores + ' distractor' : ''})` : '') };
    case 'cortina': return { k: 'acc', t: ev.cerrada ? 'Cierra la cortina' : 'Abre la cortina' };
    case 'cama': return { k: 'acc', t: ev.accion === 'posicion' ? 'Posición: ' + (POSICIONES[ev.valor] || ev.valor) : ev.accion === 'barandas' ? 'Barandas ' + (ev.valor ? 'arriba' : 'abajo') : ev.accion === 'cuello' ? 'Cuello: ' + ev.valor : 'Timbre al alcance' };
    case 'o2': return { k: 'acc', t: ev.accion === 'flujo' ? `Flujómetro a ${ev.valor} L/min` : ev.accion === 'humid' ? 'Llena el humidificador con ' + nm(inst(ev.uid)?.id) : ev.accion === 'conectar' ? 'Conecta ' + nm(inst(ev.uid)?.id) + ' al O2' : 'O2: ' + ev.accion };
    case 'item': return { k: 'acc', t: `${nm(inst(ev.uid)?.id)}: ${ev.accion}${ev.params?.opcion != null ? ' (' + ev.params.opcion + ')' : ''}${ev.params?.valor != null ? ' (' + ev.params.valor + ')' : ''}` };
    case 'accion': {
      const p = ev.params || {};
      let extra = '';
      if (ev.accion === 'puncionar') extra = ` · ${p.vena || ''} · ${p.angulo}° · bisel ${p.bisel}`;
      if (p.opcion != null) extra += ` (${p.opcion})`;
      if (p.paso) extra += ` · ${p.paso}${p.cm ? ' ' + p.cm + ' cm' : ''}`;
      return { k: 'acc', t: `${ev.accion.replace(/_/g, ' ')} — ${lug(ev)}${extra}` };
    }
    case 'pc': return { k: 'acc', t: 'Computador: ' + ev.accion };
    case 'notas': return { k: 'doc', t: 'Notas: ' + (ev.texto || '').slice(0, 160) };
    case 'pae': return { k: 'doc', t: 'Guarda PAE: ' + (ev.pae?.nanda || '') };
    case 'goteo': return { k: 'doc', t: 'Goteo: ' + ev.valor + ' gotas/min' };
    case 'hablar': return { k: 'talk', t: '🗨 ' + ev.texto };
    case 'otra': return { k: 'talk', t: '✱ Otra acción: ' + ev.texto };
    case 'entrega': return { k: 'talk', t: '📋 ENTREGA: ' + ev.texto };
    case 'evaluador': return { k: 'eval', t: ev.accion === 'voz' ? `Paciente${ev.auto ? ' (auto)' : ''}: ${ev.texto}` : ev.accion === 'monitor' ? 'Monitor: ' + Object.entries(ev.sv || {}).map(([k, v]) => k.toUpperCase() + ' ' + v).join(', ') : 'Evento: ' + ev.id };
    default: return { k: 'acc', t: ev.tipo };
  }
}

function renderTimeline() {
  const f = E.filter;
  const rows = E.st.log.map(ev => ({ ev, d: describe(ev) })).filter(x => f === 'todo' || (f === 'talk' && x.d.k === 'talk') || (f === 'acc' && x.d.k === 'acc') || (f === 'eval' && x.d.k === 'eval') || (f === 'doc' && x.d.k === 'doc'));
  $('#timeline').innerHTML = rows.reverse().slice(0, 300).map(x => `<div class="tl ${x.d.k}"><span class="tm">${fmt(x.ev.t)}</span> ${esc(x.d.t)}</div>`).join('') || '<p class="muted small">Sin eventos todavía.</p>';
  $$('#tl-filter [data-f]').forEach(b => b.classList.toggle('sel', b.dataset.f === f));
}

function renderControls(force) {
  const c = getCase(E.st.caseId), w = E.engine.w;
  $$('#ctrl-tabs [data-ct]').forEach(b => b.classList.toggle('sel', b.dataset.ct === E.ctab));
  const body = $('#ctrl-body');
  // No re-renderizar mientras escribe (evita perder el texto); el monitor se refresca si no está editando
  if (!force && body.dataset.tab === E.ctab && (E.ctab !== 'monitor' || body.contains(document.activeElement))) return;
  body.dataset.tab = E.ctab;
  if (E.ctab === 'voz') {
    const R = c.respuestas || {};
    const quick = [R.nombre, '¿Me va a doler?', 'No quiero que me pongan eso.', 'Me duele mucho aquí.', R.dominante || 'Soy diestro.', R.alergias || 'No soy alérgico a nada.', 'Sí, está bien.', '¿Y eso para qué es?', 'Me siento un poco mejor.'].filter(Boolean);
    body.innerHTML = `<div class="row"><input id="voz-in" class="inp" placeholder="Respuesta del paciente…"><button class="btn primary" id="voz-send">Enviar</button></div>
      <div class="quick">${quick.map((q, i) => `<button class="chip" data-q="${i}">${esc(q)}</button>`).join('')}</div>`;
    const send = (t) => { if (!t) return; sendCmd({ type: 'voz', texto: t }); $('#voz-in').value = ''; };
    $('#voz-send').onclick = () => send($('#voz-in').value.trim());
    $('#voz-in').onkeydown = (e) => { if (e.key === 'Enter') send($('#voz-in').value.trim()); };
    $$('[data-q]', body).forEach(b => b.onclick = () => send(quick[Number(b.dataset.q)]));
  }
  if (E.ctab === 'monitor') {
    const sv = w.sv; const sug = E.engine.f('o2_tratamiento_correcto') != null;
    body.innerHTML = `<div class="sv-grid">${[['pa', 'PA'], ['fc', 'FC'], ['fr', 'FR'], ['t', 'T °C'], ['spo2', 'SpO2 %']].map(([k, l]) => `<label>${l}<input class="inp" data-sv="${k}" value="${esc(sv[k])}"></label>`).join('')}</div>
      <div class="row"><button class="btn primary" id="sv-send">Enviar al monitor</button></div>
      <div class="row"><button class="btn ${sug ? 'sug' : ''}" data-preset="mejora">Mejora${sug ? ' (sugerido: tratamiento correcto aplicado)' : ''}</button><button class="btn" data-preset="empeora">Empeora</button><button class="btn ghost" data-preset="inicial">Valores iniciales</button></div>
      <p class="muted small">Medidos por el estudiante: ${Object.keys(w.medidos).filter(k => w.medidos[k]).join(', ') || 'ninguno'}.</p>`;
    $('#sv-send').onclick = () => { const sv2 = {}; $$('[data-sv]', body).forEach(i => { const v = i.value.trim(); sv2[i.dataset.sv] = i.dataset.sv === 'pa' ? v : Number(v.replace(',', '.')); }); sendCmd({ type: 'monitor', sv: sv2 }); };
    $$('[data-preset]', body).forEach(b => b.onclick = () => {
      const s = { ...w.sv }; const ini = c.sv;
      if (b.dataset.preset === 'inicial') return sendCmd({ type: 'monitor', sv: { ...ini } });
      const up = b.dataset.preset === 'mejora';
      const meta = c.id === '2A' ? 90 : 95;
      const sv2 = up ? { spo2: Math.max(s.spo2, Math.min(meta, s.spo2 + 8)), fc: Math.max(80, s.fc - 12), fr: Math.max(18, s.fr - 4) } : { spo2: Math.max(70, s.spo2 - 6), fc: s.fc + 12, fr: s.fr + 4 };
      sendCmd({ type: 'monitor', sv: sv2 });
    });
  }
  if (E.ctab === 'eventos') {
    const evs = eventosDelCaso(c);
    body.innerHTML = `<div class="ev-list">${evs.map((e, i) => `<button class="ev-btn" data-ev="${i}"><b>${esc(e.nombre)}</b><small>${esc(e.esperado)}</small></button>`).join('')}</div>`;
    $$('[data-ev]', body).forEach(b => b.onclick = () => { const e = evs[Number(b.dataset.ev)]; sendCmd({ type: 'evento', id: e.id, texto: e.mensaje }); b.classList.add('sent'); });
  }
  if (E.ctab === 'tiempo') {
    body.innerHTML = `<div class="row wrap"><button class="btn" data-t="pausar">⏸ Pausar</button><button class="btn" data-t="reanudar">▶ Reanudar</button><button class="btn" data-t="mas">+2 min</button><button class="btn danger" data-t="terminar">Terminar estación</button></div>`;
    $$('[data-t]', body).forEach(b => b.onclick = () => {
      if (b.dataset.t === 'terminar' && !confirm('¿Terminar la estación ahora? (Si no hizo la entrega, el estudiante tendrá 1 minuto para hacerla.)')) return;
      sendCmd({ type: 'tiempo', accion: b.dataset.t, ms: 120000 });
    });
  }
  if (E.ctab === 'calif') {
    const ov = E.st.overrides; const ev = liveEval();
    body.innerHTML = `<p>Notas: Cognitivo <b>${nota(ev.notas.cognitivo)}</b> · Psicomotriz <b>${nota(ev.notas.psicomotriz)}</b> · Comunicativo <b>${nota(ev.notas.comunicativo)}</b> → Final <b>${nota(ev.notas.final)}</b></p>
      <p class="muted small">Toque un ítem de las listas para ajustarlo (cumplido → fuera de orden → no cumplido → automático). Las filas cognitivas se califican con los botones 0–5.</p>
      <label class="lbl">Umbral de aprobación <input class="inp sm" id="umbral2" type="number" step="0.1" value="${ov.umbral ?? 3}"></label>
      <label class="lbl"><input type="checkbox" id="anular" ${ov.anularFalla ? 'checked' : ''}> Anular el tope por falla crítica</label>
      <label class="lbl">Observaciones del evaluador</label><textarea id="obs" class="inp ta" rows="5">${esc(ov.observaciones)}</textarea>
      <button class="btn primary" id="obs-save">Guardar${E.st.ended ? ' y enviar al estudiante' : ''}</button>`;
    $('#obs-save').onclick = () => { ov.observaciones = $('#obs').value; ov.umbral = Number($('#umbral2').value) || 3; ov.anularFalla = $('#anular').checked; changed(); toast('Guardado'); };
  }
}

function renderEvalReport() {
  const st = E.st;
  renderReport($('#eval-report'), E.engine, st.overrides, { startedAt: st.startedAt || st.createdAt, usedMs: st.usedMs, durMin: st.durMin, estudiante: st.estudiante, modo: 'live' }, { evaluatorGraded: true, onNew: newStation });
}

function openReportView() {
  E.view = E.view === 'report' ? 'live' : 'report';
  document.body.classList.toggle('show-report', E.view === 'report');
  $('#btn-report').textContent = E.view === 'report' ? 'Volver al panel' : 'Ver reporte';
  if (E.view === 'report') renderEvalReport();
}

function newStation() {
  if (E.st && (E.st.log.length || E.st.ended)) archive();
  if (E.link) { E.link.close(); E.link = null; }
  remove('eval-station'); E.st = null; E.view = 'live'; document.body.classList.remove('show-report');
  renderSetup();
}

function archive() {
  const st = E.st; const ev = E.engine.evaluate(st.overrides, true);
  const c = getCase(st.caseId);
  pushHistory('evaluador', { id: st.id, caso: c.id, titulo: c.titulo, fecha: st.startedAt || st.createdAt, estudiante: st.estudiante, nota: ev.notas.final, aprobado: ev.aprobado, log: st.log.map(({ estadoAntes, ...x }) => x), overrides: st.overrides, durMin: st.durMin, usedMs: st.usedMs });
  const h = getHistory('evaluador'); if (h.length > 20) save('historial-evaluador', h.slice(0, 20));
}

function openHistory(x) {
  const eng = new Engine(getCase(x.caso)); x.log.forEach(ev => eng.apply(ev));
  show('hist');
  renderReport($('#hist-report'), eng, x.overrides || {}, { startedAt: x.fecha, usedMs: x.usedMs, durMin: x.durMin, estudiante: x.estudiante, modo: 'live' }, { evaluatorGraded: true, onNew: () => renderSetup() });
}

// =================== Utilidades ===================
let actx = null;
function beep(freq = 520, delay = 0) {
  if (!E.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.frequency.value = freq; o.type = 'sine';
    g.gain.setValueAtTime(0.0001, actx.currentTime + delay);
    g.gain.exponentialRampToValueAtTime(0.12, actx.currentTime + delay + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + delay + 0.35);
    o.connect(g); g.connect(actx.destination); o.start(actx.currentTime + delay); o.stop(actx.currentTime + delay + 0.4);
  } catch (e) { /* */ }
}
function toast(t) { const el = document.createElement('div'); el.className = 'toast'; el.textContent = t; $('#toasts').appendChild(el); setTimeout(() => el.classList.add('out'), 1800); setTimeout(() => el.remove(), 2300); }

// =================== Inicio ===================
function init() {
  $('#btn-create').onclick = createStation;
  $('#btn-copy').onclick = () => { try { navigator.clipboard.writeText(E.st.code); toast('Código copiado'); } catch (e) { toast(E.st.code); } };
  $('#btn-report').onclick = openReportView;
  $('#btn-new').onclick = () => { if (confirm('¿Cerrar esta estación y crear una nueva? Se guardará en el historial.')) newStation(); };
  $('#btn-sound').onclick = () => { E.sound = !E.sound; save('eval-sound', E.sound); $('#btn-sound').textContent = E.sound ? '🔔' : '🔕'; if (E.sound) beep(600); };
  $('#btn-sound').textContent = E.sound ? '🔔' : '🔕';
  $('#btn-guide-ev').onclick = () => { const c = getCase(E.st.caseId); const g = guiaEstudiante(c, E.st.durMin); alertBox(`<h3>Situación (lo que ve el estudiante)</h3><p>${esc(g.situacion)}</p><p><b>Orden:</b> ${esc(g.orden)}</p><h3>Historia clínica</h3>${c.historia.map(([k, v]) => `<p><b>${esc(k)}:</b> ${esc(v)}</p>`).join('')}`); };
  $$('#col-tabs [data-tab]').forEach(b => b.onclick = () => { E.tab = b.dataset.tab; renderLists(); });
  $$('#ctrl-tabs [data-ct]').forEach(b => b.onclick = () => { E.ctab = b.dataset.ct; renderControls(true); });
  $$('#tl-filter [data-f]').forEach(b => b.onclick = () => { E.filter = b.dataset.f; renderTimeline(); });
  $('#hist-back').onclick = renderSetup;
  setInterval(() => { if (E.st && document.body.dataset.screen === 'live') renderTimer(); }, 500);
  // refresco suave del monitor/calificación sin perder lo escrito
  const prev = load('eval-station');
  if (prev && prev.caseId && getCase(prev.caseId)) { E.st = prev; E.st.overrides = { ...emptyOverrides(), ...prev.overrides }; startStationView(); }
  else renderSetup();
}

function alertBox(html) {
  const m = $('#modal');
  m.innerHTML = `<div class="modal-card wide"><button class="x" data-x>×</button>${html}</div>`; m.classList.add('open');
  $('[data-x]', m).onclick = () => { m.classList.remove('open'); m.innerHTML = ''; };
}

init();
