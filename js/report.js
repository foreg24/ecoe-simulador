// Reporte final (estudiante y evaluadora).
import { fmt } from './engine.js';
import { REFERENCIAS } from '../data/items.js';
import { TEMAS } from '../data/cases.js';
import { MOMENTOS } from '../data/handwash.js';
import { downloadJSON } from './storage.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nota = (x) => (Math.round(x * 10) / 10).toFixed(1).replace('.', ',');
const ESTADO = { ok: ['✓', 'Cumplido', 'ok'], orden: ['↕', 'Fuera de orden (½)', 'orden'], omitido: ['✗', 'Omitido', 'bad'], error: ['✗', 'Error', 'bad'], pendiente: ['·', 'Pendiente', 'pend'] };
const COMP = { cognitivo: 'Cognitivo (saber)', psicomotriz: 'Psicomotriz (hacer)', comunicativo: 'Comunicativo / empático (ser)' };
const FILAS = [
  'DOMINIO, CLASE, Diagnóstico NANDA, R/C (o F/R) y E/P (o C/D) correctos y coherentes',
  'Interpreta / explica / expone los hallazgos (signos vitales y hallazgos en el PAE o la entrega)',
  'Argumenta / identifica / formula: NOC con indicador y escala (actual → esperado) y NIC justificadas',
];

export function reportData(engine, overrides = {}, meta = {}) {
  const ev = engine.evaluate(overrides, true);
  const C = engine.caso;
  const errores = [];
  engine.alerts.forEach(a => errores.push({ t: a.t, tipo: a.tipo, texto: a.texto, correcto: a.correcto, critico: !!a.critico }));
  Object.values(ev.items).forEach(r => {
    if (r.estado === 'omitido' || r.estado === 'error') errores.push({ t: r.t ?? 1e12, tipo: r.estado === 'error' ? 'error' : 'omitido', texto: (r.estado === 'error' ? 'Error: ' : 'Omitido: ') + r.item.texto, correcto: r.item.correcto, critico: !!r.item.critico && r.estado === 'error' });
    if (r.estado === 'orden') errores.push({ t: r.t, tipo: 'orden', texto: 'Fuera de orden: ' + r.item.texto, correcto: r.item.correcto });
  });
  errores.sort((a, b) => a.t - b.t);
  const complicaciones = engine.eventosEval.map(x => {
    const resp = (x.respuesta || []).filter(k => engine.last(k) != null && engine.last(k) > x.t);
    return { ...x, respondio: resp.length > 0, evidencias: resp };
  });
  return { ev, errores, complicaciones, caso: C, meta, overrides, pae: engine.w.pae, entrega: engine.w.entrega, notas: engine.w.notas, log: engine.log, goteo: engine.w.goteo };
}

export function renderReport(el, engine, overrides = {}, meta = {}, opts = {}) {
  const d = reportData(engine, overrides, meta);
  const { ev, caso: C } = d;
  const fecha = new Date(meta.startedAt || Date.now());
  const pae = d.pae || {};
  const acc = C.pae || {};
  const refs = (TEMAS[C.tema]?.ref || []).map(k => REFERENCIAS[k]).filter(Boolean);
  if (C.tema === 'valoracion' && C.o2) refs.push(REFERENCIAS.oxigeno);

  const momentoTxt = (v) => v === null ? '<span class="pill pend">No aplica</span>' : v ? '<span class="pill ok">Cumplido</span>' : '<span class="pill bad">No cumplido</span>';
  const byComp = { cognitivo: [], psicomotriz: [], comunicativo: [] };
  ev.lista.forEach(it => byComp[it.competencia]?.push(ev.items[it.id]));

  el.innerHTML = `
  <div class="report">
    <div class="report-head">
      <div>
        <div class="eyebrow">ECOE · Principios del cuidado de enfermería · UAN</div>
        <h1>Caso ${esc(C.id)} — ${esc(C.titulo)}</h1>
        <div class="muted">${fecha.toLocaleDateString('es-CO')} · ${fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} · Duración usada ${fmt(meta.usedMs || 0)} de ${meta.durMin || '—'} min${meta.estudiante ? ' · Estudiante: ' + esc(meta.estudiante) : ''}${meta.modo === 'practica' ? ' · <b>Modo práctica</b>' : ''}</div>
      </div>
      <div class="report-actions no-print">
        <button class="btn" data-act="print">Imprimir / Guardar PDF</button>
        <button class="btn ghost" data-act="json">Descargar JSON</button>
        ${opts.onNew ? '<button class="btn primary" data-act="new">Nueva estación</button>' : ''}
      </div>
    </div>

    <div class="scores">
      ${['cognitivo', 'psicomotriz', 'comunicativo'].map(k => `<div class="score-card"><div class="label">${COMP[k]}</div><div class="big">${nota(ev.notas[k])}</div><div class="muted">/ 5,0</div></div>`).join('')}
      <div class="score-card final ${ev.aprobado ? 'pass' : 'fail'}"><div class="label">Nota final (promedio)</div><div class="big">${nota(ev.notas.final)}</div><div class="verdict">${ev.aprobado ? 'APROBADO' : 'NO APROBADO'}</div><div class="muted">Umbral ${nota(ev.umbral)}</div></div>
    </div>
    ${ev.fallaCritica ? `<div class="critical">⚠ FALLA CRÍTICA — la nota psicomotriz queda en máximo 2,5:<ul>${ev.fallas.map(f => `<li><b>${fmt(f.t)}</b> ${esc(f.texto)} — <i>Lo correcto era:</i> ${esc(f.correcto)}</li>`).join('')}</ul></div>` : ''}
    ${!opts.evaluatorGraded ? `<div class="note-info no-print">Notas calculadas automáticamente. ${meta.modo === 'practica' ? 'En modo práctica no hay ajuste de la evaluadora.' : 'La evaluadora puede ajustarlas; el reporte se actualiza al recibir su calificación.'}</div>` : '<div class="note-ok no-print">✓ Incluye la calificación de la evaluadora.</div>'}

    <section>
      <h2>Rúbrica cognitiva</h2>
      <table class="tbl"><thead><tr><th>Criterio</th><th>Sugerida</th><th>Nota</th></tr></thead><tbody>
      ${FILAS.map((f, i) => `<tr><td>${i + 1}. ${f}</td><td>${nota(ev.sugerenciaCognitivo[i])}</td><td><b>${nota(ev.filasCognitivo[i])}</b></td></tr>`).join('')}
      <tr><td colspan="2"><b>Puntaje sumado y dividido</b> (${nota(ev.filasCognitivo.reduce((a, b) => a + b, 0))})/3</td><td><b>${nota(ev.notas.cognitivo)}</b></td></tr>
      </tbody></table>
    </section>

    <section>
      <h2>Intervenciones prioritarias</h2>
      <p>Realizó <b>${ev.intervenciones.hechas.length}</b> de mínimo <b>${ev.intervenciones.minimo}</b>: ${ev.intervenciones.hechas.map(esc).join(' · ') || '—'}</p>
    </section>

    <section>
      <h2>Lista de chequeo</h2>
      ${['psicomotriz', 'comunicativo', 'cognitivo'].map(k => `
        <h3>${COMP[k]} — ${nota(ev.notas[k])}</h3>
        <table class="tbl check"><tbody>
        ${byComp[k].map(r => { const e = ESTADO[r.estado] || ESTADO.pendiente; return `<tr class="${e[2]}"><td class="st">${e[0]}</td><td>${esc(r.item.texto)}${r.item.critico ? ' <span class="pill bad sm">crítico</span>' : ''}${r.manual !== undefined ? ' <span class="pill sm">ajuste evaluadora</span>' : ''}</td><td class="tm">${r.t != null && r.t < 1e11 ? fmt(r.t) : '—'}</td><td class="lb">${e[1]}</td></tr>`; }).join('')}
        </tbody></table>`).join('')}
    </section>

    <section>
      <h2>Errores y omisiones (orden cronológico)</h2>
      ${d.errores.length ? `<ol class="errs">${d.errores.map(e => `<li class="${e.critico ? 'crit' : ''}"><span class="tm">${e.t < 1e11 ? fmt(e.t) : 'final'}</span> <b>${esc(e.texto)}</b>${e.correcto ? `<div class="ok-was">Lo correcto era: ${esc(e.correcto)}</div>` : ''}</li>`).join('')}</ol>` : '<p>Sin errores registrados. ¡Excelente!</p>'}
    </section>

    <section>
      <h2>Higiene de manos</h2>
      <table class="tbl"><tbody>
      ${MOMENTOS.map(m => `<tr><td>${m.texto}</td><td>${momentoTxt(ev.momentos[m.id])}</td></tr>`).join('')}
      ${C.tema === 'valoracion' ? `<tr><td>Antes de la exploración física (UAN)</td><td>${momentoTxt(ev.momentos.exploracionAntes)}</td></tr><tr><td>Después de la exploración física (UAN)</td><td>${momentoTxt(ev.momentos.exploracionDespues)}</td></tr>` : ''}
      </tbody></table>
      <p class="muted">Higienes realizadas: ${ev.momentos.total}. ${ev.momentos.juegos.map(j => `Minijuego (${j.metodo === 'agua' ? 'agua y jabón' : 'alcohol'}, ${fmt(j.t)}): ${j.aciertos ?? '?'} de ${j.total ?? '?'} pasos en orden${j.distractores ? `, ${j.distractores} distractor(es) elegidos` : ''}.`).join(' ')}</p>
    </section>

    <section>
      <h2>PAE: escrito vs. aceptado</h2>
      <table class="tbl pae"><thead><tr><th></th><th>Escribió</th><th>Aceptado (guía UAN)</th></tr></thead><tbody>
        <tr><td>Dominio</td><td>${esc(pae.dominio)}</td><td>${(acc.dominios || []).map(n => 'Dominio ' + n).join(' / ')}</td></tr>
        <tr><td>Clase</td><td>${esc(pae.clase)}</td><td>${esc((acc.clases || []).join(' / '))}</td></tr>
        <tr><td>NANDA</td><td>${esc(pae.nanda)}</td><td>${esc((acc.nanda || []).join(' / '))}</td></tr>
        <tr><td>R/C</td><td>${esc(pae.rc)}</td><td>${esc((acc.rc || []).join('; '))}</td></tr>
        <tr><td>E/P</td><td>${esc(pae.ep)}</td><td>${esc((acc.ep || []).join('; ') || '— (diagnóstico de riesgo)')}</td></tr>
        <tr><td>NOC</td><td>${esc(pae.noc)}${pae.indicador ? ` · Indicador: ${esc(pae.indicador)}` : ''}${pae.escala ? ` · Escala: ${esc(pae.escala)}` : ''}${pae.actual ? ` · ${esc(pae.actual)} → ${esc(pae.esperado)}` : ''}</td><td>${esc((acc.noc || []).join(' / '))}</td></tr>
        <tr><td>NIC</td><td>${(pae.nic || []).filter(n => n.nombre).map(n => `<b>${esc(n.nombre)}</b>: ${esc(n.actividades)}`).join('<br>')}</td><td>${esc((acc.nic || []).join(' / '))}</td></tr>
        <tr><td>Valoración</td><td colspan="2">${esc(pae.valoracion)}</td></tr>
        <tr><td>Evaluación</td><td colspan="2">${esc(pae.evaluacion)}</td></tr>
      </tbody></table>
      <p class="ref-text"><b>Referencia UAN:</b> ${esc(acc.texto)}</p>
    </section>

    ${d.complicaciones.length ? `<section><h2>Complicaciones / eventos</h2><table class="tbl"><thead><tr><th>Min</th><th>Evento</th><th>Respuesta esperada</th><th>¿Respondió?</th></tr></thead><tbody>
      ${d.complicaciones.map(c => `<tr><td>${fmt(c.t)}</td><td>${esc(c.nombre)}</td><td>${esc(c.esperado)}</td><td>${c.respondio ? '<span class="pill ok">Sí</span>' : '<span class="pill bad">No se evidenció</span>'}</td></tr>`).join('')}
    </tbody></table></section>` : ''}

    <section>
      <h2>Entrega de actividades</h2>
      <div class="boxed">${esc(d.entrega) || '<i>No realizó la entrega.</i>'}</div>
      <h2>Notas de enfermería</h2>
      <div class="boxed">${esc(d.notas) || '<i>Sin notas.</i>'}</div>
      ${C.tema === 'iv' && C.id === '3A' ? `<p>Cálculo de goteo escrito: <b>${d.goteo ?? '—'}</b> gotas/min (esperado ≈ 167).</p>` : ''}
      <h2>Observaciones del evaluador</h2>
      <div class="boxed">${esc(overrides.observaciones) || '<i>—</i>'}</div>
    </section>

    <section>
      <h2>Línea de tiempo</h2>
      <div class="timeline-print">${d.log.filter(e => ['hablar', 'otra', 'entrega', 'evaluador'].includes(e.tipo)).map(e => `<div><span class="tm">${fmt(e.t)}</span> ${e.tipo === 'hablar' ? '🗨 ' : e.tipo === 'otra' ? '✱ ' : e.tipo === 'evaluador' ? '⚑ ' : '📋 '}${esc(e.texto || (e.accion === 'evento' ? 'Evento: ' + e.id : e.accion === 'monitor' ? 'Monitor actualizado' : ''))}</div>`).join('') || '<i>—</i>'}</div>
    </section>

    ${refs.length ? `<section><h2>Datos de referencia del tema</h2>${refs.map(r => `<h3>${esc(r.titulo)}</h3><table class="tbl"><tbody>${r.filas.map(f => `<tr>${f.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table><p class="muted">${esc(r.notas)}</p>`).join('')}</section>` : ''}
  </div>`;

  el.querySelector('[data-act="print"]')?.addEventListener('click', () => window.print());
  el.querySelector('[data-act="json"]')?.addEventListener('click', () => downloadJSON({ caso: C.id, meta, overrides, notas: ev.notas, aprobado: ev.aprobado, fallaCritica: ev.fallaCritica, errores: d.errores, pae: d.pae, entrega: d.entrega, notasEnfermeria: d.notas, log: d.log }, `ecoe-${C.id}-${fecha.toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`));
  el.querySelector('[data-act="new"]')?.addEventListener('click', () => opts.onNew && opts.onNew());
  return d;
}
