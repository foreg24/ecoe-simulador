// Casos ECOE (guías de laboratorio UAN — Principios del cuidado de enfermería).
// Cada ítem de chequeo: { id, texto, competencia, peso, critico?, cuando, antesDe?, despuesDe?, falloSi?, correcto }
//  - cuando: nombre de un "hecho" del motor, lista (cualquiera), {todos:[...]}, o función (e) => tiempo|null
//  - antesDe / despuesDe: ids de otros ítems, o 'f:<hecho>' para comparar contra un hecho
// Editable sin tocar la lógica.

// ---------- helpers ----------
const P = 'psicomotriz', CO = 'comunicativo', CG = 'cognitivo';
const it = (id, texto, competencia, peso, cuando, extra = {}) => ({ id, texto, competencia, peso, cuando, ...extra });
const higieneDespuesDe = (e, t) => (t == null ? null : (e.higienes.find(h => h > t) ?? null));
const ultimo = (arr) => (arr.length ? arr[arr.length - 1] : null);
const nIntervenciones = (e) => {
  const grupos = e.caso.intervenciones || [];
  const ts = grupos.map(g => e.tiempoDe(g.cuando)).filter(x => x != null).sort((a, b) => a - b);
  const min = e.caso.minIntervenciones || 3;
  return ts.length >= min ? ts[min - 1] : null;
};
const despuesDeHecho = (hecho, otro) => (e) => { const a = e.f(otro); const b = e.last(hecho); return a != null && b != null && b > a ? b : null; };

// ---------- Protocolo común (todos los casos, en este orden) ----------
export const PROTOCOLO_COMUN = [
  it('p_orden', 'Revisa la orden médica y la historia clínica (alergias, antecedentes, contraindicaciones)', P, 1.5, { todos: ['leyo_orden', 'leyo_historia'] }, { fase: 'pre', antesDe: ['f:inicio_procedimiento'], correcto: 'Antes de todo: revisar la orden médica y la historia (alergias, antecedentes, contraindicaciones).' }),
  it('p_higiene', 'Higiene de manos antes del contacto con el paciente', P, 1.5, 'higiene', { fase: 'pre', antesDe: ['f:primer_contacto'], correcto: 'Higiene de manos antes de tocar al paciente (momento 1 de la OMS).' }),
  it('p_epp', 'EPP completo: gorro, tapabocas, gafas y bata', P, 1, 'epp_completo', { fase: 'pre', antesDe: ['f:inicio_procedimiento'], correcto: 'Colocarse gorro, tapabocas, gafas y bata antes del procedimiento (guantes según el procedimiento).' }),
  it('p_material', 'Alista el material completo en la bandeja antes de iniciar', P, 1, 'material', { fase: 'pre', antesDe: ['f:inicio_procedimiento'], correcto: 'Alistar todo el material en la bandeja/riñonera antes de empezar.' }),
  it('c_saludo', 'Saluda al paciente', CO, 0.5, 'com_saludo', { fase: 'pre', antesDe: ['f:primer_contacto'], correcto: 'Saludar al entrar.' }),
  it('c_presenta', 'Se presenta (nombre y rol)', CO, 0.5, 'com_presenta', { fase: 'pre', correcto: 'Presentarse: "Soy ___, estudiante de enfermería".' }),
  it('c_identifica', 'Pregunta nombre y apellidos', CO, 1, 'com_identifica', { fase: 'pre', antesDe: ['f:inicio_procedimiento'], correcto: 'Preguntar nombre y apellidos completos (identificación verbal).' }),
  it('p_manilla', 'Verifica la manilla de identificación', P, 1, 'manilla', { fase: 'pre', antesDe: ['f:inicio_procedimiento'], correcto: 'Verificar la manilla y compararla con lo que dice el paciente y la orden.' }),
  it('c_explica', 'Explica el procedimiento', CO, 1, 'com_explica', { fase: 'pre', antesDe: ['f:inicio_procedimiento'], correcto: 'Explicar el procedimiento en lenguaje sencillo antes de iniciarlo.' }),
  it('c_beneficios', 'Explica beneficios y riesgos', CO, 0.5, 'com_beneficio', { fase: 'pre', correcto: 'Explicar para qué sirve y qué molestias o riesgos puede tener.' }),
  it('c_dudas', 'Aclara dudas', CO, 0.5, 'com_dudas', { fase: 'pre', correcto: 'Preguntar si tiene dudas y aclararlas.' }),
  it('c_consentimiento', 'Obtiene el consentimiento', CO, 1, 'com_consentimiento', { fase: 'pre', antesDe: ['f:inicio_procedimiento'], correcto: 'Pedir autorización ("¿Está de acuerdo?") antes de iniciar.' }),
  it('c_privacidad', 'Privacidad: cierra la cortina', CO, 1, 'cortina_cerrada', { fase: 'pre', antesDe: ['f:inicio_procedimiento'], correcto: 'Cerrar la cortina y exponer solo la zona necesaria.' }),
  it('c_trato', 'Trato humanizado: pregunta cómo se siente / tranquiliza / alivia', CO, 1, 'com_trato', { fase: 'pre', correcto: 'Preguntar cómo se siente, tranquilizar y aliviar.' }),
  // ---- [procedimiento del caso] ----
  it('p_intervenciones', 'Realiza el mínimo de intervenciones de enfermería prioritarias', P, 2, nIntervenciones, { fase: 'post', correcto: 'Realizar mínimo X intervenciones prioritarias acordes al diagnóstico.' }),
  it('p_comodo', 'Deja cómodo al paciente: barandas arriba y timbre al alcance', P, 1, (e) => (e.w.barandas && e.f('timbre') != null ? Math.max(e.last('timbre'), e.last('barandas_arriba') || 0) : null), { fase: 'post', correcto: 'Al terminar: barandas arriba, timbre al alcance y paciente cómodo.' }),
  it('p_residuos', 'Desecha residuos en la caneca correcta (roja, guardián, negra, blanca)', P, 1, (e) => (e.f('desecho') != null ? e.f('desecho') : null), { fase: 'post', falloSi: 'residuo_error', correcto: 'Roja: biológico; guardián: cortopunzantes; negra: ordinario; blanca: aprovechable.' }),
  it('p_retira_guantes', 'Retira los guantes al terminar', P, 0.5, (e) => (e.f('guantes') == null ? null : e.last('retiro_guantes')), { fase: 'post', correcto: 'Retirar los guantes sin contaminarse y desecharlos en la roja.' }),
  it('p_higiene_final', 'Higiene de manos al finalizar', P, 1.5, (e) => higieneDespuesDe(e, ultimo(e.contactos)), { fase: 'post', correcto: 'Higiene de manos después del contacto con el paciente (momento 4) y con su entorno (momento 5).' }),
  it('p_notas', 'Registra notas de enfermería', P, 1, 'notas', { fase: 'post', correcto: 'Registrar lo realizado, hallazgos y reacción del paciente.' }),
  it('g_pae', 'Elabora el PAE en el computador', CG, 1, 'pae', { fase: 'post', correcto: 'Diligenciar el PAE: dominio, clase, NANDA (R/C, E/P), NOC y NIC.' }),
  it('c_educa', 'Educa al paciente', CO, 1, 'com_educa', { fase: 'post', correcto: 'Dar educación sobre el cuidado del dispositivo, signos de alarma y uso del timbre.' }),
  it('c_entrega', 'Entrega de actividades al evaluador', CO, 1.5, 'entrega', { fase: 'post', correcto: 'Al finalizar, relatar qué valoró, qué hizo, cómo quedó el paciente y el diagnóstico prioritario.' }),
];

// ---------- Eventos que puede lanzar la evaluadora ----------
export const EVENTOS_COMUNES = [
  { id: 'se_niega', nombre: 'Se niega al procedimiento', mensaje: 'El paciente dice: «No quiero que me hagan eso».', esperado: 'Escuchar, explicar de nuevo beneficios y riesgos, respetar la decisión; si persiste, informar y registrar.', respuesta: ['com_explica', 'com_beneficio', 'com_trato'] },
  { id: 'pregunta_porque', nombre: 'Pregunta por qué', mensaje: 'El paciente pregunta: «¿Y eso para qué me lo hacen?»', esperado: 'Explicar el objetivo en lenguaje sencillo y verificar que entendió.', respuesta: ['com_explica', 'com_beneficio'] },
  { id: 'nauseas', nombre: 'Náuseas / vómito', mensaje: 'El paciente presenta náuseas y vomita.', esperado: 'Suspender un momento, incorporar o lateralizar, riñonera, higiene oral, valorar y registrar.', respuesta: ['pos:fowler', 'pos:fowler_alto', 'pos:lateral', 'pausa_sng', 'acomoda', 'com_trato'] },
  { id: 'familiar', nombre: 'Entra un familiar', mensaje: 'Entra un familiar preocupado: «¿Qué le están haciendo?»', esperado: 'Saludar, explicar con respeto, mantener la privacidad (pedir que espere afuera si es necesario) y la confidencialidad.', respuesta: ['com_explica', 'com_trato', 'com_privacidad'] },
  { id: 'alergia_latex', nombre: 'Alergia revelada: látex', mensaje: 'El paciente recuerda: «Ah, se me olvidaba: soy alérgico al látex».', esperado: 'Usar guantes y material libres de látex; registrar la alergia.', respuesta: ['com_alergias', 'otra_accion'] },
  { id: 'alergia_chx', nombre: 'Alergia revelada: clorhexidina', mensaje: 'El paciente dice: «A mí la clorhexidina me brota la piel».', esperado: 'No usar clorhexidina; usar alcohol; registrar la alergia.', respuesta: ['com_alergias', 'otra_accion', 'antisepsia'] },
  { id: 'alergia_lido', nombre: 'Alergia revelada: lidocaína', mensaje: 'El paciente dice: «Soy alérgico a la lidocaína».', esperado: 'No usar lidocaína; usar lubricante hidrosoluble estéril; registrar la alergia.', respuesta: ['com_alergias', 'otra_accion'] },
  { id: 'dolor', nombre: 'Refiere dolor intenso', mensaje: 'El paciente se queja: «¡Me duele mucho aquí!»', esperado: 'Valorar el dolor (EVA, localización), tranquilizar, informar y aplicar medidas según orden.', respuesta: ['com_trato', 'com_eva'] },
  { id: 'empeora', nombre: 'Empeora (desaturación)', mensaje: 'El paciente se ve más dificultad para respirar.', esperado: 'Revalorar signos vitales y SpO2, posición Fowler, verificar el dispositivo y avisar al médico.', respuesta: ['sv_spo2', 'pos:fowler', 'pos:fowler_alto', 'solicita_asistencia'], sv: { spo2: 84, fr: 30, fc: 124 } },
];

// ---------- Temas ----------
export const TEMAS = {
  valoracion: {
    nombre: 'Técnicas de valoración física', ref: ['valoracion'],
    onEvent(e) {
      if (e.f('explora') != null && e.f('inicio_procedimiento') == null) { e.fact('inicio_procedimiento'); e._checkInicioProcedimiento(); }
    },
  },
  o2: {
    nombre: 'Oxigenoterapia', ref: ['oxigeno'],
    onEvent(e, ev) {
      if (e.f('o2_colocado') != null && e.f('inicio_procedimiento') == null) { e.fact('inicio_procedimiento'); e._checkInicioProcedimiento(); }
      if (ev.tipo === 'evaluador' && ev.accion === 'evento' && ev.id === 'retira_o2') {
        const d = e.w.disp.find(x => x.tipo === 'o2');
        if (d) { e.w.disp = e.w.disp.filter(x => x !== d); if (d.uid && e.w.bandeja.length < 12) e.w.bandeja.push(d.uid); }
      }
    },
  },
  iv: { nombre: 'Cateterismo venoso periférico', ref: ['goteo'] },
  vesical: { nombre: 'Cateterismo vesical', ref: ['vesical'] },
  sng: { nombre: 'Sonda gástrica', ref: ['sng'] },
};

// ---------- Bloques reutilizables por tema ----------
const ivChecklist = (o) => [
  it('iv_dominante', 'Pregunta la mano dominante', CO, 0.5, 'com_dominante', { correcto: 'Preguntar la mano dominante y explorar primero el brazo no dominante.' }),
  it('iv_alergias', 'Pregunta alergias (antisépticos, látex, medicamentos)', CO, 0.5, 'com_alergias', { correcto: 'Preguntar alergias antes del procedimiento.' }),
  it('iv_capital', `Valora el capital venoso de distal a proximal en el brazo ${o.brazoTexto}`, P, 1, `capital:${o.brazo}`, { antesDe: ['iv_torniquete'], correcto: `Explorar primero el brazo ${o.brazoTexto}, de distal a proximal; preferir antebrazo o brazo.` }),
  it('iv_extendido', 'Brazo extendido, apoyado y cómodo', P, 0.5, 'brazo_extendido', { antesDe: ['iv_puncion'], correcto: 'Brazo extendido y cómodo.' }),
  it('iv_torniquete', 'Torniquete ≈10 cm por encima del sitio de punción', P, 1, 'torniquete:10cm', { antesDe: ['iv_puncion'], correcto: 'Torniquete ~10 cm por encima del sitio.' }),
  it('iv_antisepsia', 'Antisepsia circular del centro a la periferia (o en rejilla) sin volver a palpar', P, 1.5, 'antisepsia_ok', { antesDe: ['iv_puncion'], correcto: 'Antisepsia circular centro → periferia (o en rejilla) con alcohol o clorhexidina, sin volver a palpar.' }),
  it('iv_guantes', 'Se coloca guantes antes de puncionar', P, 1, 'guantes', { antesDe: ['iv_puncion'], correcto: 'Guantes antes de puncionar.' }),
  it('iv_integridad', 'Verifica la integridad del catéter y gira el cilindro 360°', P, 0.5, 'integridad_cateter', { antesDe: ['iv_puncion'], correcto: 'Verificar el catéter y girar el cilindro 360° antes de puncionar.' }),
  it('iv_calibre', `Elige un calibre adecuado (${o.calibres})`, P, 1, 'calibre_ok', { correcto: `Calibre ${o.calibres}.` }),
  it('iv_puncion', 'Punción con bisel hacia arriba a 15–30°', P, 1.5, ['angulo_ok', 'angulo_aceptable'], { correcto: 'Bisel hacia arriba, ángulo 15–30° (hasta 45° aceptable).' }),
  it('iv_retorno', 'Observa el retorno venoso', P, 1, 'retorno', { antesDe: ['iv_avanza'], correcto: 'Ver el retorno en la cámara antes de avanzar.' }),
  it('iv_avanza', 'Baja el ángulo y avanza el catéter manteniendo la tracción de la piel', P, 1, 'avanza', { antesDe: ['iv_retira_aguja'], correcto: 'Bajar el ángulo casi paralelo, avanzar un poco el conjunto y luego solo el catéter.' }),
  it('iv_retira_torniquete', 'Retira (afloja) el torniquete antes de retirar la aguja', P, 2, 'retira_torniquete', { antesDe: ['iv_retira_aguja'], critico: true, correcto: 'Retirar el torniquete antes de retirar la aguja y de permeabilizar.' }),
  it('iv_presion', 'Presión digital sobre la punta del catéter', P, 1, 'presion_digital', { antesDe: ['iv_retira_aguja'], correcto: 'Presión digital sobre la vena en la punta del catéter al retirar la aguja.' }),
  it('iv_retira_aguja', 'Retira la aguja / activa la seguridad', P, 1, 'retira_aguja', { correcto: 'Retirar la aguja activando el mecanismo de seguridad.' }),
  it('iv_guardian', 'Aguja directo al guardián (nunca reinsertarla)', P, 2, 'aguja_guardian', { critico: true, falloSi: (e) => e.alerts.find(a => a.id === 'aguja_fuera' || a.id === 'reinserta_aguja')?.t ?? null, correcto: 'La aguja va directo al guardián; nunca se reinserta en el catéter.' }),
  it('iv_permeabiliza', 'Permeabiliza con jeringa de SSN 0,9 % (sin dolor ni edema)', P, 1, 'permeabiliza', { correcto: 'Conectar la jeringa con SSN y permeabilizar; si infiltra, retirar.' }),
  it('iv_conecta', 'Conecta el conector o el equipo purgado', P, 1, 'conecta', { correcto: 'Conectar el conector clave o el equipo de infusión purgado.' }),
  it('iv_fija', 'Fija con apósito transparente', P, 1, 'fija_aposito', { correcto: 'Fijar con apósito transparente.' }),
  it('iv_rotula', 'Rotula (fecha, hora, calibre, responsable)', P, 0.5, 'rotula_cat', { correcto: 'Rotular el sitio de inserción.' }),
  it('iv_no_contra', 'No punciona un miembro contraindicado', P, 1, (e) => (e.f('puncion') != null ? e.f('puncion') : null), { falloSi: (e) => e.alerts.find(a => a.id === 'brazo_contraindicado')?.t ?? null, critico: true, correcto: 'Revisar contraindicaciones: mastectomía con vaciamiento, fístula AV, hemiparesia, celulitis, edema, quemaduras.' }),
];

const vesicalChecklist = (o) => [
  it('v_posicion', o.male ? 'Posición decúbito supino' : 'Posición decúbito supino con piernas separadas', P, 1, o.male ? ['pos:supino', 'pos:supino_piernas'] : 'pos:supino_piernas', { antesDe: ['v_inserta'], correcto: o.male ? 'Hombre: decúbito supino.' : 'Mujer: decúbito supino con piernas flexionadas y separadas.' }),
  it('v_expone', 'Descubre solo la zona genital (con la cortina cerrada)', CO, 1, 'descubre_genitales', { falloSi: (e) => e.alerts.find(a => a.id === 'genitales_sin_cortina')?.t ?? null, correcto: 'Cortina cerrada y exponer solo los genitales.' }),
  it('v_guantes_manejo', 'Guantes de manejo para la higiene genital', P, 0.5, 'guantes_manejo', { antesDe: ['v_higiene_genital'], correcto: 'Guantes de manejo para la higiene genital.' }),
  it('v_higiene_genital', o.male ? 'Higiene genital: glande, pene y escroto con solución jabonosa; secar primero el glande' : 'Higiene genital: separar labios y limpiar en sentido descendente (pubis → ano)', P, 1.5, 'higiene_genital_ok', { antesDe: ['v_esteriles'], correcto: o.male ? 'Gasa con solución jabonosa y abundante agua sobre glande, pene y escroto; secar primero el glande.' : 'Separar los labios y limpiar de arriba hacia abajo (pubis → ano); secar igual.' }),
  it('v_cambio_guantes', 'Retira los guantes de manejo y se lava las manos (agua y jabón)', P, 1, (e) => { const r = e.f('retiro_guantes'); return r != null ? (e.higienes.find(h => h > r) ?? null) : null; }, { antesDe: ['v_esteriles'], correcto: 'Retirar los guantes de manejo, lavado de manos con agua y jabón antes del procedimiento estéril.' }),
  it('v_campo', 'Arma el campo estéril', P, 1, 'campo_esteril', { antesDe: ['v_inserta'], correcto: 'Abrir el campo estéril y disponer el material.' }),
  it('v_esteriles', 'Se coloca guantes estériles nuevos', P, 1.5, 'guantes_esteriles', { antesDe: ['v_inserta'], correcto: 'Guantes estériles nuevos tras la higiene genital.' }),
  it('v_calibre', 'Elige sonda Foley adulto 14–18 Fr', P, 1, 'foley_calibre_ok', { correcto: 'Adulto 14–18 Fr (12 Fr solo excepcional).' }),
  it('v_prueba', 'Pre-infla el balón para comprobarlo', P, 1, 'prueba_balon', { antesDe: ['v_inserta'], correcto: 'En la UAN se pre-infla el balón para comprobarlo antes de insertar.' }),
  ...(o.male ? [
    it('v_prepucio', 'Retrae el prepucio', P, 0.5, 'retrae_prepucio', { antesDe: ['v_inserta'], correcto: 'Retraer el prepucio.' }),
    it('v_lidocaina', 'Lidocaína intrauretral y espera 3–5 min con la uretra cerrada', P, 1, 'lidocaina_espera', { antesDe: ['v_inserta'], correcto: 'Lidocaína intrauretral, esperar 3–5 min manteniendo la uretra cerrada.' }),
    it('v_traccion', 'Pene perpendicular con tracción hacia arriba', P, 1, 'traccion_pene', { antesDe: ['v_inserta'], correcto: 'Con gasas estériles y la mano no dominante, pene perpendicular con tracción hacia arriba.' }),
  ] : [
    it('v_lidocaina', 'Lidocaína jalea en una porción amplia de la sonda', P, 1, 'lubrica_amplia', { antesDe: ['v_inserta'], correcto: 'Lubricar con lidocaína jalea una porción amplia de la sonda.' }),
    it('v_labios', 'Separa los labios con la mano no dominante', P, 1, 'separa_labios', { correcto: 'Separar los labios con la mano no dominante y mantenerlos separados.' }),
  ]),
  it('v_inserta', 'Inserta la sonda con técnica estéril', P, 1.5, 'inserta_sonda', { falloSi: (e) => e.alerts.find(a => a.id === 'contamina_continua' || a.id === 'foley_sin_esteriles')?.t ?? null, critico: true, correcto: 'Si se contamina el campo, los guantes o la sonda: desechar y reiniciar.' }),
  it('v_profundiza', o.male ? 'Inserta hasta la bifurcación' : 'Al fluir la orina, profundiza 5 cm más', P, 1, 'profundiza', { antesDe: ['v_infla'], correcto: o.male ? 'Insertar hasta la bifurcación.' : 'Introducir hasta que fluya la orina y profundizar 5 cm más.' }),
  it('v_infla', 'Infla el balón SOLO cuando fluye la orina, con 10 ml de agua destilada estéril', P, 2, 'infla_agua', { critico: true, falloSi: (e) => e.alerts.find(a => a.id === 'balon_sin_orina' || a.id === 'balon_ssn')?.t ?? null, correcto: 'Inflar solo al ver orina, con 10 ml de agua destilada estéril (nunca SSN).' }),
  it('v_conecta', 'Conecta a la bolsa colectora (sistema cerrado)', P, 1, 'conecta_bolsa', { correcto: 'Conectar a la bolsa colectora, sistema cerrado sin acodaduras.' }),
  it('v_tope', 'Retira suavemente hasta el tope', P, 1, 'retira_hasta_tope', { correcto: 'Traccionar suavemente hasta sentir el tope del balón.' }),
  ...(o.male ? [it('v_regresa', 'Regresa el prepucio', P, 2, (e) => { const r = e.f('retrae_prepucio'); const g = e.last('regresa_prepucio'); return r != null && g != null && g > r ? g : null; }, { critico: true, correcto: 'Regresar SIEMPRE el prepucio (riesgo de parafimosis).' })] : []),
  it('v_limpia', 'Limpia la zona', P, 0.5, 'limpia_zona', { correcto: 'Limpiar y secar la zona.' }),
  it('v_fija', 'Fija la sonda a la piel', P, 1, 'fija_sonda', { correcto: 'Fijar a la cara interna del muslo (mujer) o abdomen/muslo (hombre).' }),
  it('v_bolsa_bajo', 'Bolsa por debajo del nivel de la vejiga', P, 1, 'bolsa_bajo', { correcto: 'Colgar la bolsa por debajo del nivel de la vejiga, sin tocar el piso.' }),
  it('v_registro', 'Registra cantidad y características de la orina', P, 1, (e) => (/(ml|cc|orina|diuresis|clara|amarill)/i.test(e.w.notas) ? e.f('notas') : null), { correcto: 'Registrar cantidad y características de la orina en las notas.' }),
];

const sngChecklist = (o) => [
  it('s_senal', 'Acuerda una señal no verbal para parar (ej.: levantar la mano)', CO, 1, 'com_senal', { antesDe: ['s_inserta'], correcto: 'Acordar una señal no verbal para detenerse.' }),
  it('s_posicion', 'Semi-Fowler o Fowler', P, 1, ['pos:semifowler', 'pos:fowler', 'pos:fowler_alto'], { antesDe: ['s_inserta'], correcto: 'Semi-Fowler o Fowler.' }),
  it('s_cuello', 'Cuello en posición neutra durante la inserción', P, 0.5, (e) => (e.f('inicio_sng') != null && e.w.cuello === 'neutro' ? e.f('inicio_sng') : null), { correcto: 'Cuello NEUTRO: evitar extensión o flexión.' }),
  it('s_guantes', 'Guantes de manejo (técnica limpia)', P, 1, 'guantes_manejo', { antesDe: ['s_inserta'], correcto: 'Guantes de manejo.' }),
  it('s_calibre', 'Sonda Levin 14–18 Fr', P, 0.5, 'sng_calibre_ok', { correcto: 'Levin 14, 16 o 18 Fr en adultos.' }),
  it('s_mide', 'Mide nariz → lóbulo de la oreja → apéndice xifoides', P, 1.5, 'medicion_sng', { antesDe: ['s_inserta'], correcto: 'Medir nariz → lóbulo de la oreja → xifoides sin contaminar la sonda.' }),
  it('s_marca', 'Marca la medida en la sonda', P, 0.5, 'marca_sng', { antesDe: ['s_inserta'], correcto: 'Marcar los cm en la sonda.' }),
  it('s_lubrica', 'Lubrica el extremo distal (hidrosoluble o lidocaína)', P, 1, 'lubrica_sng', { antesDe: ['s_inserta'], falloSi: 'lubrica_vaselina', correcto: 'Lubricante hidrosoluble o lidocaína, nunca vaselina.' }),
  ...(o.orogastrica ? [
    it('s_via', 'Detecta la contraindicación nasal y pasa la sonda por vía orogástrica', P, 3, 'orogastrica', { critico: true, falloSi: (e) => e.alerts.find(a => a.id === 'sng_contraindicada')?.t ?? null, correcto: `Con ${o.contra}: vía orogástrica (o avisar y no pasarla por la nariz).` }),
  ] : [
    it('s_permeabilidad', 'Verifica la permeabilidad y elige la narina de mayor diámetro', P, 1, 'permeabilidad_nasal', { antesDe: ['s_inserta'], correcto: 'Verificar permeabilidad y elegir la narina de mayor diámetro.' }),
  ]),
  it('s_inserta', 'Introduce suavemente hasta la marca', P, 1, 'sng_insertada', { correcto: 'Introducir suavemente hasta la marca; si no avanza, reorientar o cambiar de narina.' }),
  it('s_tragar', 'Pide que trague mientras avanza', CO, 0.5, 'pide_tragar', { correcto: 'Pedir que trague para facilitar el paso al esófago.' }),
  it('s_ausc', 'Verifica: ausculta el epigastrio mientras insufla 10–20 ml de aire', P, 1.5, 'verif_auscultacion', { antesDe: ['s_fija'], correcto: 'Auscultar el epigastrio insuflando 10–20 ml de aire.' }),
  it('s_aspira', 'Verifica: aspira contenido gástrico', P, 1.5, 'verif_aspirado', { antesDe: ['s_fija'], correcto: 'Aspirar contenido gástrico con la jeringa.' }),
  it('s_fija', 'Solo con plena seguridad: fija a la narina sin presionar la piel', P, 1, ['fija_sng'], { critico: true, falloSi: (e) => e.alerts.find(a => a.id === 'fijar_sin_verificar' || a.id === 'usar_sin_verificar')?.t ?? null, correcto: 'Fijar SOLO después de verificar con ambos métodos.' }),
  it('s_rotula', 'Etiqueta con fecha y hora; registra la profundidad (cm)', P, 1, 'rotula_sng', { correcto: 'Etiquetar fecha y hora y registrar la profundidad.' }),
  it('s_distres', 'Ante tos excesiva o cianosis retira la sonda de inmediato (si ocurre)', P, 1, (e) => (e.eventosEval.some(x => x.id === 'tos_cianosis') ? e.f('retira_distres') : (e.f('sng_insertada') ?? null)), { falloSi: (e) => e.alerts.find(a => a.id === 'continua_distres')?.t ?? null, critico: true, correcto: 'Si hay distrés, tos excesiva o cianosis: retirar de inmediato.' }),
];

const EV_SNG = [
  { id: 'tos_cianosis', nombre: 'Tos y cianosis al pasar la SNG', mensaje: 'Al avanzar la sonda el paciente presenta tos intensa y cianosis peribucal.', esperado: 'Retirar la sonda de inmediato, valorar SpO2, dejar recuperar y reintentar.', respuesta: ['retira_distres'], sv: { spo2: 86, fc: 118 } },
];
const EV_O2 = [
  { id: 'retira_o2', nombre: 'Se retira la cánula / mascarilla', mensaje: 'El paciente se retira el dispositivo de oxígeno: «Me molesta mucho esto».', esperado: 'Explicar la importancia, recolocar, verificar flujo, proteger puntos de presión y revalorar SpO2.', respuesta: ['o2_colocado', 'proteger_presion', 'com_educa'] },
];
const EV_IV = [
  { id: 'infiltracion', nombre: 'Infiltración del acceso', mensaje: 'Alrededor del catéter aparece edema frío y pálido; el paciente refiere dolor y ardor.', esperado: 'Suspender la infusión, retirar el catéter, elevar el miembro, registrar y canalizar en otro sitio.', respuesta: ['retira_cateter', 'elevar_miembro'] },
];
const EV_VES = [
  { id: 'resistencia', nombre: 'Resistencia al paso de la sonda', mensaje: 'Al avanzar la sonda siente resistencia.', esperado: 'No forzar; pedir que tosa; si persiste, hay sangrado o molestia: detener y solicitar asistencia médica.', respuesta: ['resistencia_tos', 'pide_toser', 'solicita_asistencia'] },
];

const sv = (pa, fc, fr, t, spo2) => ({ pa, fc, fr, t, spo2 });

// ---------- CASOS ----------
export const CASES = [
  // ===================== TEMA 1 =====================
  {
    id: '1A', tema: 'valoracion', titulo: 'Valoración física: dolor abdominal', sexo: 'F', edad: 34, servicio: 'medicina interna',
    paciente: { nombre: 'Laura Marcela Rincón Pérez', doc: 'CC 1.023.456.789', edad: 34 },
    motivo: 'dolor abdominal en fosa ilíaca derecha de 12 horas de evolución, acompañado de náuseas',
    antecedentes: 'apendicitis negada; G1P1; sin alergias conocidas; sin cirugías previas',
    dice: 'Señorita, me duele mucho aquí abajo a la derecha… y tengo ganas de vomitar.',
    svTexto: 'PA 118/76 mmHg, FC 98 lpm, FR 20 rpm, T 38,1 °C, SpO2 97 %. EVA 7/10.',
    reportes: 'Hemograma: leucocitos 14.800/mm³ con neutrofilia. Parcial de orina normal. Ecografía pendiente.',
    orden: 'Realizar valoración física céfalo-caudal con énfasis en abdomen y reportar hallazgos. Control de signos vitales. Nada vía oral. Analgesia según orden médica.',
    historia: [
      ['Alergias', 'Ninguna conocida.'], ['Antecedentes', 'G1P1. Sin cirugías previas. Sin enfermedades crónicas.'],
      ['Medicamentos', 'Ninguno.'], ['Enfermedad actual', 'Dolor periumbilical que migró a fosa ilíaca derecha hace 12 h; náuseas; un vómito.'],
    ],
    sv: sv('118/76', 98, 20, 38.1, 97), posicionInicial: 'lateral',
    dolorEn: ['abdomen:FID'],
    hallazgos: {
      'inspeccionar:abdomen': 'Abdomen plano, sin cicatrices ni distensión. La paciente mantiene las piernas flexionadas (posición antiálgica).',
      'inspeccionar:cabeza': 'Facies de dolor, mucosa oral semiseca.',
      'auscultar:abdomen': 'Ruidos intestinales disminuidos (2 en 1 minuto).',
      'percutir:abdomen': 'Timpanismo generalizado.',
      'percutir:abdomen:FID': 'Timpanismo; la paciente refiere dolor a la percusión.',
      'palpar_sup:abdomen': 'Abdomen blando, depresible; defensa voluntaria leve.',
      'palpar_sup:abdomen:FID': 'Dolor a la palpación superficial en FID.',
      'palpar_prof:abdomen': 'Sin masas palpables en esta zona.',
      'palpar_prof:abdomen:FID': 'Dolor intenso en FID. Signo de rebote (Blumberg) POSITIVO.',
      'inspeccionar:torax': 'Tórax simétrico, expansión normal.',
      'auscultar:torax': 'Murmullo vesicular conservado, sin agregados.',
      'auscultar:precordio': 'Ruidos cardíacos rítmicos, taquicárdicos, sin soplos.',
      'capital:brazo_d': 'Buen capital venoso.', 'capital:brazo_i': 'Buen capital venoso.',
    },
    respuestas: { nombre: 'Laura Marcela Rincón Pérez, cédula 1.023.456.789.', dolor: 'Me duele mucho, como un 7 de 10, aquí abajo a la derecha.', sintoma: 'Me duele la barriga y tengo náuseas.', dominante: 'Soy diestra.', alergias: 'No, a nada.' },
    minIntervenciones: 3,
    intervenciones: [
      { nombre: 'Valoración del dolor (EVA)', cuando: 'com_eva' },
      { nombre: 'Monitorización de signos vitales', cuando: 'sv_completos' },
      { nombre: 'Valoración abdominal completa (insp, ausc, perc, palp)', cuando: { todos: ['inspeccionar:abdomen', 'auscultar:abdomen', 'percutir:abdomen', 'palpar:abdomen'] } },
      { nombre: 'Medidas de confort / posición', cuando: ['acomoda', 'pos:semifowler'] },
      { nombre: 'Informa al médico / gestiona analgesia según orden', cuando: ['solicita_asistencia', 'otra_accion'] },
    ],
    material: ['fonendoscopio', 'tensiometro', 'termometro', 'pulsoximetro'],
    checklist: [
      it('a_entrevista', 'Entrevista antes de la exploración (síntomas, inicio, características)', CO, 1, 'hablo', { antesDe: ['f:explora'], correcto: 'La exploración va DESPUÉS de la entrevista.' }),
      it('a_eva', 'Valora la intensidad del dolor (EVA)', CO, 1, 'com_eva', { correcto: 'Preguntar la intensidad del dolor con la escala EVA 0–10.' }),
      it('a_sv', 'Toma los 5 signos vitales ANTES de la exploración corporal', P, 2, 'sv_completos', { antesDe: ['f:explora'], correcto: 'Los signos vitales se toman ANTES de la exploración corporal.' }),
      it('a_higiene_antes', 'Higiene de manos antes de la exploración', P, 1, (e) => { const x = e.f('explora'); return x == null ? null : (e.higienes.filter(h => h < x).pop() ?? null); }, { correcto: 'Higiene de manos antes y después de la exploración física.' }),
      it('a_posicion', 'Coloca en decúbito supino para la exploración abdominal', P, 1, 'pos:supino', { antesDe: ['a_palp_sup'], correcto: 'Decúbito supino, brazos a los lados, rodillas ligeramente flexionadas.' }),
      it('a_expone', 'Descubre solo el abdomen', CO, 0.5, 'descubre:abdomen', { correcto: 'Exponer solo la zona a explorar.' }),
      it('a_insp', 'Abdomen: 1.º inspección', P, 1, 'inspeccionar:abdomen', { antesDe: ['a_ausc', 'a_perc', 'a_palp_sup', 'a_palp_prof'], correcto: 'Abdomen: inspección → auscultación → percusión → palpación.' }),
      it('a_ausc', 'Abdomen: 2.º auscultación', P, 1, 'auscultar:abdomen', { antesDe: ['a_perc', 'a_palp_sup', 'a_palp_prof'], correcto: 'En abdomen se ausculta ANTES de percutir y palpar.' }),
      it('a_perc', 'Abdomen: 3.º percusión', P, 1, 'percutir:abdomen', { antesDe: ['a_palp_sup', 'a_palp_prof'], correcto: 'Percutir antes de palpar.' }),
      it('a_palp_sup', 'Abdomen: 4.º palpación superficial antes que profunda', P, 1, 'palpar_sup:abdomen', { antesDe: ['a_palp_prof'], correcto: 'Palpación superficial antes que profunda.' }),
      it('a_palp_prof', 'Palpación profunda y búsqueda de rebote', P, 1, 'palpar_prof:abdomen', { correcto: 'Palpación profunda; signo de rebote en FID.' }),
      it('a_dolor_final', 'Palpa la zona dolorosa (FID) al final', P, 1, 'palpar:abdomen:FID', { falloSi: 'palpa_despues_de_dolorosa', correcto: 'La zona dolorosa se palpa al final.' }),
      it('a_higiene_despues', 'Higiene de manos después de la exploración', P, 1, (e) => { const ks = Object.keys(e.FL).filter(k => /^(inspeccionar|palpar|percutir|auscultar):/.test(k)); if (!ks.length) return null; const l = Math.max(...ks.map(k => e.FL[k])); return e.higienes.find(h => h > l) ?? null; }, { correcto: 'Higiene de manos después de la exploración física.' }),
    ],
    eventos: [],
    pae: {
      dominios: [12], clases: ['Confort físico'], nanda: ['Dolor agudo'],
      rc: ['agentes lesivos biológicos', 'agente biológico lesivo', 'proceso inflamatorio'],
      ep: ['expresión facial de dolor', 'autoinforme de intensidad EVA 7/10', 'conducta de protección', 'posición antiálgica'],
      noc: ['Nivel del dolor', 'Control del dolor'],
      nic: ['Manejo del dolor', 'Monitorización de signos vitales', 'Administración de analgésicos'],
      texto: 'Dominio 12 Confort · Clase 1 Confort físico · Dolor agudo (00132) R/C agentes lesivos biológicos E/P expresión facial de dolor, autoinforme de intensidad (EVA 7/10), conducta de protección. NOC: Nivel del dolor / Control del dolor. NIC: Manejo del dolor, Monitorización de signos vitales, Administración de analgésicos (según orden).',
    },
    interpretacion: ['fiebre|febril|38', 'taquicard|98', 'rebote|blumberg', 'fid|fosa il[ií]aca', 'ruidos.*disminu|hipoperist', 'eva|7/10|dolor', 'timpan', 'antialg'],
  },
  {
    id: '1B', tema: 'valoracion', titulo: 'Valoración física: tórax', sexo: 'M', edad: 67, servicio: 'medicina interna',
    paciente: { nombre: 'Jorge Enrique Castañeda Ruiz', doc: 'CC 19.345.678', edad: 67 },
    motivo: 'disnea y tos productiva con expectoración amarillenta de 3 días de evolución',
    antecedentes: 'tabaquismo activo (40 paquetes/año), hipertensión arterial controlada',
    dice: 'Me falta el aire, enfermera… y esta tos no me deja.',
    svTexto: 'PA 136/84 mmHg, FC 104 lpm, FR 26 rpm, T 38,4 °C, SpO2 90 %.',
    reportes: 'Rx de tórax: opacidad en base derecha. Leucocitos 16.200/mm³.',
    orden: 'Valoración física de tórax y reporte de hallazgos. Control de signos vitales c/4 h. Oxígeno por cánula nasal a 2 L/min si SpO2 < 92 %.',
    historia: [
      ['Alergias', 'Ninguna conocida.'], ['Antecedentes', 'Tabaquismo 40 paquetes/año. HTA en manejo con losartán.'],
      ['Medicamentos', 'Losartán 50 mg c/12 h.'], ['Enfermedad actual', 'Disnea progresiva, tos productiva, fiebre de 3 días.'],
    ],
    sv: sv('136/84', 104, 26, 38.4, 90), posicionInicial: 'supino',
    hallazgos: {
      'inspeccionar:torax': 'Tiraje intercostal y uso de músculos accesorios. Taquipnea. Expansión disminuida en hemitórax derecho.',
      'inspeccionar:torax_post': 'Uso de músculos accesorios; expansión disminuida en la base derecha.',
      'palpar_sup:torax': 'Expansión torácica asimétrica, menor a la derecha.',
      'palpar_sup:torax_post': 'Expansión asimétrica; menor en la base derecha.',
      'fremito': 'Frémito vocal AUMENTADO en la base derecha.',
      'percutir:torax:inf_d': 'Matidez en la base derecha.', 'percutir:torax_post:inf_d': 'Matidez en la base derecha.',
      'percutir:torax': 'Resonancia normal.', 'percutir:torax_post': 'Resonancia normal.',
      'auscultar:torax:inf_d': 'Estertores crepitantes en la base derecha. Roncus que cambian con la tos.',
      'auscultar:torax_post:inf_d': 'Estertores crepitantes en la base derecha. Roncus que cambian con la tos.',
      'auscultar:torax': 'Roncus dispersos que cambian con la tos.', 'auscultar:torax_post': 'Roncus dispersos que cambian con la tos.',
      'auscultar:precordio': 'Ruidos cardíacos rítmicos, taquicárdicos.',
      'inspeccionar:cabeza': 'Leve cianosis peribucal. Aleteo nasal ausente.',
      'llenado:brazo_d': 'Llenado capilar 2 s.', 'llenado:brazo_i': 'Llenado capilar 2 s.',
    },
    respuestas: { nombre: 'Jorge Enrique Castañeda Ruiz, cédula 19.345.678.', sintoma: 'Me ahogo y toso mucho, con flema amarilla.', dominante: 'Soy diestro.', alergias: 'No, a nada.' },
    minIntervenciones: 3,
    intervenciones: [
      { nombre: 'Monitorización de signos vitales y SpO2', cuando: 'sv_completos' },
      { nombre: 'Posición Fowler / semi-Fowler', cuando: ['pos:fowler', 'pos:semifowler', 'pos:fowler_alto'] },
      { nombre: 'Valoración respiratoria completa (insp, palp, perc, ausc)', cuando: { todos: ['inspeccionar:torax', 'percutir:torax', 'auscultar:torax'] } },
      { nombre: 'Oxigenoterapia según orden (SpO2 < 92 %)', cuando: 'o2_colocado' },
      { nombre: 'Educación: tos efectiva / respiración', cuando: 'com_educa' },
    ],
    material: ['fonendoscopio', 'tensiometro', 'termometro', 'pulsoximetro'],
    checklist: [
      it('t_entrevista', 'Entrevista antes de la exploración', CO, 1, 'hablo', { antesDe: ['f:explora'], correcto: 'La exploración va DESPUÉS de la entrevista.' }),
      it('t_sv', 'Toma los 5 signos vitales ANTES de la exploración corporal', P, 2, 'sv_completos', { antesDe: ['f:explora'], correcto: 'Los signos vitales se toman ANTES de la exploración corporal.' }),
      it('t_higiene_antes', 'Higiene de manos antes de la exploración', P, 1, (e) => { const x = e.f('explora'); return x == null ? null : (e.higienes.filter(h => h < x).pop() ?? null); }, { correcto: 'Higiene de manos antes y después de la exploración.' }),
      it('t_posicion', 'Posición Fowler / sentado para valorar el tórax', P, 1, ['pos:fowler', 'pos:fowler_alto', 'pos:semifowler', 'girar'], { correcto: 'Sentado o Fowler para valorar el tórax.' }),
      it('t_expone', 'Descubre solo el tórax', CO, 0.5, 'descubre:torax', { correcto: 'Exponer solo la zona a explorar.' }),
      it('t_insp', 'Tórax: 1.º inspección', P, 1, ['inspeccionar:torax', 'inspeccionar:torax_post'], { antesDe: ['t_palp', 't_perc', 't_ausc'], correcto: 'Tórax: inspección → palpación → percusión → auscultación.' }),
      it('t_palp', 'Tórax: 2.º palpación (expansión, frémito)', P, 1, ['palpar:torax', 'palpar:torax_post', 'fremito'], { antesDe: ['t_perc', 't_ausc'], correcto: 'Palpar expansión y frémito antes de percutir.' }),
      it('t_perc', 'Tórax: 3.º percusión', P, 1, ['percutir:torax', 'percutir:torax_post'], { antesDe: ['t_ausc'], correcto: 'Percutir antes de auscultar.' }),
      it('t_ausc', 'Tórax: 4.º auscultación', P, 1, ['auscultar:torax', 'auscultar:torax_post'], { correcto: 'Auscultar al final.' }),
      it('t_comparativa', 'Ausculta comparando ambos lados', P, 1, (e) => { const d = ['auscultar:torax:sup_d', 'auscultar:torax:inf_d', 'auscultar:torax_post:sup_d', 'auscultar:torax_post:inf_d'].map(k => e.f(k)).filter(x => x != null); const i = ['auscultar:torax:sup_i', 'auscultar:torax:inf_i', 'auscultar:torax_post:sup_i', 'auscultar:torax_post:inf_i'].map(k => e.f(k)).filter(x => x != null); return d.length && i.length ? Math.max(Math.min(...d), Math.min(...i)) : null; }, { correcto: 'Auscultar comparando hemitórax derecho e izquierdo.' }),
      it('t_posterior', 'Valora el tórax posterior', P, 1, ['auscultar:torax_post', 'percutir:torax_post', 'palpar:torax_post'], { correcto: 'Sentar al paciente y valorar también el tórax posterior.' }),
      it('t_higiene_despues', 'Higiene de manos después de la exploración', P, 1, (e) => { const ks = Object.keys(e.FL).filter(k => /^(inspeccionar|palpar|percutir|auscultar):/.test(k)); if (!ks.length) return null; const l = Math.max(...ks.map(k => e.FL[k])); return e.higienes.find(h => h > l) ?? null; }, { correcto: 'Higiene de manos después de la exploración física.' }),
    ],
    o2: { dispositivo: 'canula', flujo: [1, 3] },
    eventos: [...EV_O2],
    pae: {
      dominios: [4, 11], clases: ['Respuestas cardiovasculares/pulmonares', 'Lesión física'], nanda: ['Patrón respiratorio ineficaz', 'Limpieza ineficaz de las vías aéreas'],
      rc: ['fatiga de los músculos respiratorios', 'retención de secreciones', 'secreciones bronquiales', 'tabaquismo'],
      ep: ['taquipnea', 'uso de músculos accesorios', 'sonidos respiratorios adventicios', 'tos', 'estertores'],
      noc: ['Estado respiratorio: ventilación', 'Estado respiratorio: permeabilidad de las vías respiratorias', 'Estado respiratorio'],
      nic: ['Monitorización respiratoria', 'Ayuda a la ventilación', 'Oxigenoterapia', 'Manejo de la vía aérea'],
      texto: 'Dominio 4 Actividad/reposo · Clase 4 Respuestas cardiovasculares/pulmonares · Patrón respiratorio ineficaz (00032) R/C fatiga de los músculos respiratorios E/P taquipnea, uso de músculos accesorios. Alternativa: Dominio 11 · Limpieza ineficaz de las vías aéreas (00031) E/P sonidos respiratorios adventicios, tos. NOC: Estado respiratorio: ventilación. NIC: Monitorización respiratoria, Ayuda a la ventilación, Oxigenoterapia (si la ordenan).',
    },
    interpretacion: ['taquipn|26', 'taquicard|104', 'fiebre|38', 'satur|spo2|90', 'tiraje|m[uú]sculos accesorios', 'fr[eé]mito', 'matidez', 'crepit|estertor', 'roncus', 'base derecha'],
  },

  // ===================== TEMA 2 =====================
  {
    id: '2A', tema: 'o2', titulo: 'Oxigenoterapia: EPOC', sexo: 'M', edad: 63, servicio: 'urgencias – observación adultos',
    paciente: { nombre: 'Luis Alberto Moreno Díaz', doc: 'CC 17.654.321', edad: 63 },
    motivo: 'aumento de la disnea y de la tos con expectoración desde hace 2 días',
    antecedentes: 'EPOC diagnosticado hace 8 años, tabaquismo activo (1 paquete/día), dos hospitalizaciones previas por exacerbación',
    dice: 'No puedo respirar bien… me canso con solo hablar.',
    svTexto: 'PA 140/88 mmHg, FC 121 lpm, FR 26 rpm, T 37,2 °C, SpO2 78 % al aire ambiente. Llenado capilar > 2 s.',
    reportes: 'Gases arteriales: pH 7,33, PaCO2 52 mmHg, PaO2 48 mmHg (hipoxemia con hipercapnia).',
    orden: 'Oxígeno por cánula nasal; meta de SpO2 88–92 %. Posición semi-Fowler. Control de SpO2 continua.',
    historia: [
      ['Alergias', 'Ninguna conocida.'], ['Antecedentes', 'EPOC GOLD 3. Tabaquismo activo. Hipercapnia crónica documentada.'],
      ['Medicamentos', 'Salbutamol + bromuro de ipratropio inhalados.'], ['Examen físico', 'Diaforesis, palidez, uso de músculos accesorios, cianosis peribucal, aleteo nasal.'],
    ],
    sv: sv('140/88', 121, 26, 37.2, 78), posicionInicial: 'supino',
    hallazgos: {
      'inspeccionar:cabeza': 'Cianosis peribucal, aleteo nasal, diaforesis, palidez.',
      'inspeccionar:torax': 'Uso de músculos accesorios, tiraje intercostal, tórax en tonel.',
      'auscultar:torax': 'Murmullo vesicular disminuido globalmente, sibilancias espiratorias.',
      'llenado:brazo_d': 'Llenado capilar > 2 s.', 'llenado:brazo_i': 'Llenado capilar > 2 s.',
      'permeabilidad': 'Ambas narinas permeables, sin secreciones.',
      'inspeccionar:nariz': 'Narinas permeables; aleteo nasal.',
    },
    respuestas: { nombre: 'Luis Alberto Moreno Díaz… 17.654.321.', sintoma: 'Me ahogo… me canso.', dominante: 'Diestro.', alergias: 'No.' },
    minIntervenciones: 3,
    intervenciones: [
      { nombre: 'Posición semi-Fowler / Fowler', cuando: ['pos:semifowler', 'pos:fowler', 'pos:fowler_alto'] },
      { nombre: 'Oxigenoterapia por cánula a 1–3 L/min', cuando: 'canula_1_3' },
      { nombre: 'Monitorización de SpO2 continua', cuando: 'pulsox_continuo' },
      { nombre: 'Humidificación con agua destilada', cuando: 'humid_agua_destilada' },
      { nombre: 'Protección de puntos de presión', cuando: 'proteger_presion' },
      { nombre: 'Educación (no fumar, no retirar la cánula, no vaselina)', cuando: 'com_educa' },
    ],
    material: ['canula_nasal', 'agua_destilada', 'pulsoximetro', 'gasas', 'fonendoscopio'],
    o2: { dispositivo: 'canula', flujo: [1, 3] },
    onEvent(e, ev) {
      if (e.f('o2_dispositivo:reservorio') != null) e.falla('reservorio_epoc', 'Colocó mascarilla con reservorio a un paciente EPOC con hipercapnia', 'EPOC con hipercapnia: cánula nasal a 1–3 L/min (meta SpO2 88–92 %). El reservorio está contraindicado en hipercapnia.');
      if (e.f('canula_4') != null && !e.alerts.some(a => a.id === 'c4')) e.alerta('info', 'Cánula a 4 L/min en paciente EPOC', 'En EPOC: 1–3 L/min; la UAN recomienda no superar FiO2 32 % (≈3 L/min).', { id: 'c4' });
      if (e.f('canula_mas_4') != null) e.penaliza('c5', 'Cánula a más de 4 L/min', 'Cánula nasal: máximo 4 L/min; en EPOC 1–3 L/min.');
      if (e.f('o2_dispositivo:simple') != null) e.penaliza('simple_sin_ind', 'Mascarilla simple sin indicación', 'La orden es cánula nasal (meta 88–92 %).');
    },
    checklist: [
      it('o_valora', 'Valora patrón respiratorio y SpO2 ANTES de colocar el oxígeno', P, 1.5, ['sv_spo2', 'sv_fr', 'inspeccionar:torax'], { antesDe: ['f:o2_colocado'], correcto: 'Valorar FR, patrón respiratorio y SpO2 antes de iniciar el oxígeno.' }),
      it('o_posicion', 'Posición semi-Fowler / Fowler', P, 1, ['pos:semifowler', 'pos:fowler', 'pos:fowler_alto'], { antesDe: ['f:o2_colocado'], correcto: 'Semi-Fowler o Fowler para mejorar la ventilación.' }),
      it('o_permeab', 'Verifica la permeabilidad nasal', P, 1, 'permeabilidad_nasal', { antesDe: ['f:o2_colocado'], correcto: 'Verificar permeabilidad de las narinas antes de la cánula.' }),
      it('o_humid', 'Llena el humidificador con agua destilada', P, 1, 'humid_agua_destilada', { antesDe: ['f:o2_colocado'], correcto: 'Humidificador con agua destilada estéril.' }),
      it('o_dispositivo', 'Elige la cánula nasal', P, 2, 'o2_dispositivo:canula', { critico: true, falloSi: (e) => e.f('o2_dispositivo:reservorio'), correcto: 'Cánula nasal (EPOC con hipercapnia: nunca reservorio).' }),
      it('o_flujo', 'Cánula a 1–3 L/min', P, 2, 'canula_1_3', { falloSi: 'canula_mas_4', correcto: 'Cánula a 1–3 L/min (4 L = alerta; > 4 L = error).' }),
      it('o_conecta', 'Conecta el dispositivo al humidificador/flujómetro', P, 1, 'o2_conectado', { correcto: 'Conectar al humidificador y al flujómetro y verificar que sale flujo.' }),
      it('o_orejas', 'Puntas en las narinas y tubo por detrás de las orejas', P, 1, 'tubo_orejas', { correcto: 'Pasar el tubo por detrás de las orejas y ajustar bajo el mentón.' }),
      it('o_presion', 'Protege los puntos de presión (orejas) con gasa', P, 1, 'proteger_presion', { correcto: 'Proteger orejas y puente nasal con gasa.' }),
      it('o_reevalua', 'Revalora la SpO2 y la respuesta después de iniciar el oxígeno', P, 1.5, (e) => { const c = e.f('o2_colocado'); if (c == null) return null; const t = [e.last('sv_spo2'), e.last('sv_fr')].filter(x => x != null && x > c); return e.f('pulsox_continuo') != null ? Math.max(c, e.f('pulsox_continuo')) : (t.length ? Math.min(...t) : null); }, { correcto: 'Volver a medir la SpO2 (pulsioxímetro continuo) y valorar la respuesta.' }),
      it('o_no_vaselina', 'Hidrata mucosas solo con soluciones acuosas (no vaselina)', P, 0.5, (e) => e.f('hidrata_mucosas') ?? (e.f('fin') != null && e.f('vaselina_mucosas') == null ? e.f('fin') : null), { falloSi: 'vaselina_mucosas', correcto: 'Hidratar mucosas solo con soluciones acuosas; nunca vaselina ni aceite.' }),
    ],
    eventos: [...EV_O2],
    pae: {
      dominios: [3, 4], clases: ['Función respiratoria', 'Respuestas cardiovasculares/pulmonares'], nanda: ['Deterioro del intercambio de gases', 'Patrón respiratorio ineficaz'],
      rc: ['desequilibrio ventilación-perfusión', 'patrón respiratorio ineficaz'],
      ep: ['hipoxemia', 'taquipnea', 'taquicardia', 'diaforesis', 'cianosis', 'aleteo nasal', 'uso de músculos accesorios'],
      noc: ['Estado respiratorio', 'Estado respiratorio: intercambio gaseoso', 'Perfusión tisular', 'Estado respiratorio: ventilación'],
      nic: ['Oxigenoterapia', 'Ayuda a la ventilación', 'Monitorización respiratoria'],
      texto: 'Dominio 3 Eliminación e intercambio · Clase 4 Función respiratoria · Deterioro del intercambio de gases (00030) R/C desequilibrio ventilación-perfusión E/P hipoxemia, taquipnea, taquicardia, diaforesis, cianosis. NOC: Estado respiratorio (FR, SpO2: actual 3/5 → esperado 5/5), Perfusión tisular. NIC: Oxigenoterapia, Ayuda a la ventilación, Monitorización respiratoria.',
    },
    interpretacion: ['hipox|78|desatur', 'taquicard|121', 'taquipn|26', 'hipercap|paco2|52', 'cianosis', 'diafore', 'm[uú]sculos accesorios', 'aleteo', 'llenado'],
  },
  {
    id: '2B', tema: 'o2', titulo: 'Oxigenoterapia: neumonía con hipoxemia grave', sexo: 'F', edad: 45, servicio: 'hospitalización adultos',
    paciente: { nombre: 'Gloria Inés Vargas Mora', doc: 'CC 52.789.012', edad: 45 },
    motivo: 'fiebre, tos y dificultad respiratoria progresiva de 4 días',
    antecedentes: 'sin EPOC ni enfermedad pulmonar previa; no fuma; hipotiroidismo',
    dice: 'Siento que me ahogo… no me entra el aire.',
    svTexto: 'PA 124/78 mmHg, FC 118 lpm, FR 30 rpm, T 38,7 °C, SpO2 84 % al aire ambiente.',
    reportes: 'Rx de tórax: consolidación multilobar derecha. Gases: PaO2 52 mmHg, PaCO2 34 mmHg.',
    orden: 'Oxígeno por mascarilla de no reinhalación a 10–15 L/min. Fowler alto. SpO2 continua.',
    historia: [
      ['Alergias', 'Ninguna conocida.'], ['Antecedentes', 'Hipotiroidismo en tratamiento. No EPOC. No fuma.'],
      ['Medicamentos', 'Levotiroxina 50 mcg.'], ['Enfermedad actual', 'Neumonía adquirida en la comunidad.'],
    ],
    sv: sv('124/78', 118, 30, 38.7, 84), posicionInicial: 'supino',
    hallazgos: {
      'inspeccionar:cabeza': 'Facies de angustia, diaforesis, cianosis peribucal leve.',
      'inspeccionar:torax': 'Taquipnea, tiraje intercostal.',
      'auscultar:torax:inf_d': 'Estertores crepitantes en base derecha.', 'auscultar:torax': 'Crepitantes en hemitórax derecho.',
      'permeabilidad': 'Narinas permeables.',
    },
    respuestas: { nombre: 'Gloria Inés Vargas Mora, 52.789.012.', sintoma: 'Me ahogo mucho.', dominante: 'Diestra.', alergias: 'No.' },
    minIntervenciones: 3,
    intervenciones: [
      { nombre: 'Fowler alto', cuando: ['pos:fowler_alto', 'pos:fowler'] },
      { nombre: 'Oxigenoterapia con reservorio a 10–15 L/min', cuando: 'reservorio_flujo_ok' },
      { nombre: 'Monitorización de SpO2 continua', cuando: 'pulsox_continuo' },
      { nombre: 'Vigilancia de fugas y del reservorio', cuando: 'revisa_fugas' },
      { nombre: 'Educación', cuando: 'com_educa' },
    ],
    material: ['mascarilla_reservorio', 'agua_destilada', 'pulsoximetro'],
    o2: { dispositivo: 'reservorio', flujo: [10, 15] },
    onEvent(e) {
      if (e.f('reservorio_sin_llenar') != null) e.penaliza('res_vacio', 'Colocó la mascarilla sin llenar el reservorio', 'Llenar el reservorio ANTES de colocar la mascarilla.');
      if (e.f('reservorio_colapsa') != null) e.penaliza('res_colapsa', 'Flujo insuficiente: el reservorio colapsa', 'Reservorio: 10–15 L/min; el reservorio no debe colapsar en la inspiración.');
    },
    checklist: [
      it('r_valora', 'Valora patrón respiratorio y SpO2 antes', P, 1, ['sv_spo2', 'sv_fr'], { antesDe: ['f:o2_colocado'], correcto: 'Valorar FR y SpO2 antes de iniciar.' }),
      it('r_posicion', 'Fowler alto', P, 1, ['pos:fowler_alto', 'pos:fowler'], { correcto: 'Fowler alto.' }),
      it('r_dispositivo', 'Elige la mascarilla con reservorio', P, 2, 'o2_dispositivo:reservorio', { correcto: 'Mascarilla de no reinhalación (con reservorio).' }),
      it('r_humid', 'Humidificador con agua destilada (flujo alto)', P, 1, 'humid_agua_destilada', { correcto: 'Con flujos altos es muy recomendable humidificar con agua destilada.' }),
      it('r_conecta', 'Conecta la mascarilla a la fuente', P, 1, 'o2_conectado', { correcto: 'Conectar al flujómetro.' }),
      it('r_llena', 'Llena el reservorio ANTES de colocarla', P, 2, 'reservorio_lleno', { antesDe: ['f:o2_colocado'], falloSi: 'reservorio_sin_llenar', correcto: 'Ocluir la válvula y llenar el reservorio antes de colocarla.' }),
      it('r_flujo', 'Flujo de 10–15 L/min', P, 2, 'reservorio_flujo_ok', { falloSi: 'reservorio_colapsa', correcto: 'Reservorio: 10–15 L/min (< 10 = el reservorio colapsa).' }),
      it('r_ajusta', 'Ajusta la barra nasal y el elástico', P, 1, 'ajusta_mascarilla', { correcto: 'Ajustar la barra nasal y el elástico para evitar fugas.' }),
      it('r_fugas', 'Vigila fugas (ojos) y que el reservorio no colapse', P, 1, 'revisa_fugas', { correcto: 'Vigilar fugas hacia los ojos y el reservorio.' }),
      it('r_reevalua', 'Revalora la SpO2', P, 1.5, (e) => { const c = e.f('o2_colocado'); if (c == null) return null; return e.f('pulsox_continuo') != null ? Math.max(c, e.f('pulsox_continuo')) : (e.last('sv_spo2') > c ? e.last('sv_spo2') : null); }, { correcto: 'Volver a medir la SpO2.' }),
      it('r_venturi', 'Ante la nueva orden: Venturi al 35 % con el flujo de la válvula', P, 1.5, (e) => (e.eventosEval.some(x => x.id === 'orden_venturi') ? (e.f('venturi_flujo_ok:35') ?? null) : (e.f('o2_colocado') ?? null)), { correcto: 'Venturi 35 % (válvula roja) a 8 L/min según la tabla de la válvula.' }),
    ],
    eventos: [
      { id: 'orden_venturi', nombre: 'Médico ordena Venturi al 35 %', mensaje: 'Nueva orden médica: la paciente mejoró. Cambiar a mascarilla Venturi al 35 %.', esperado: 'Retirar el reservorio, elegir la válvula del 35 % y ajustar el flujo según la tabla (8 L/min).', respuesta: ['venturi_valvula:35', 'venturi_flujo_ok:35'], nuevaOrdenVenturi: 35, sv: { spo2: 93, fr: 22, fc: 100 } },
      ...EV_O2,
    ],
    pae: {
      dominios: [3, 4], clases: ['Función respiratoria', 'Respuestas cardiovasculares/pulmonares'], nanda: ['Deterioro del intercambio de gases', 'Patrón respiratorio ineficaz'],
      rc: ['desequilibrio ventilación-perfusión', 'cambios de la membrana alveolo-capilar', 'fatiga de los músculos respiratorios'],
      ep: ['hipoxemia', 'taquipnea', 'taquicardia', 'diaforesis', 'cianosis'],
      noc: ['Estado respiratorio', 'Estado respiratorio: intercambio gaseoso', 'Perfusión tisular', 'Estado respiratorio: ventilación'],
      nic: ['Oxigenoterapia', 'Ayuda a la ventilación', 'Monitorización respiratoria'],
      texto: 'Igual que 2A: Dominio 3 · Clase 4 · Deterioro del intercambio de gases R/C desequilibrio ventilación-perfusión E/P hipoxemia, taquipnea, taquicardia. También válido: Patrón respiratorio ineficaz. NOC: Estado respiratorio. NIC: Oxigenoterapia, Ayuda a la ventilación, Monitorización respiratoria.',
    },
    interpretacion: ['hipox|84|desatur', 'taquipn|30', 'taquicard|118', 'fiebre|38', 'crepit|estertor', 'consolidaci', 'cianosis'],
  },

  // ===================== TEMA 3 =====================
  {
    id: '3A', tema: 'iv', titulo: 'Canalización: deshidratación', sexo: 'M', edad: 28, servicio: 'urgencias',
    paciente: { nombre: 'Andrés Felipe Gómez Salazar', doc: 'CC 1.020.987.654', edad: 28 },
    motivo: 'diarrea líquida (8 deposiciones/día) y vómito de 2 días; gastroenteritis aguda',
    antecedentes: 'ver historia clínica en el computador',
    dice: 'Estoy muy débil, enfermero… tengo mucha sed.',
    svTexto: 'PA 100/60 mmHg, FC 112 lpm, FR 20 rpm, T 37,6 °C, SpO2 97 %.',
    reportes: 'Na 133 mEq/L, K 3,4 mEq/L, BUN 24 mg/dL.',
    orden: 'Canalizar vena periférica y pasar SSN 0,9 % 500 ml en 1 hora (macrogoteo). Control de líquidos administrados y eliminados.',
    historia: [
      ['Alergias', 'Ninguna conocida.'],
      ['Antecedentes', 'Trauma por arma cortopunzante en el brazo izquierdo a los 22 años con FÍSTULA ARTERIOVENOSA IZQUIERDA residual, en seguimiento por cirugía vascular. NO puncionar ni tomar presión arterial en el brazo izquierdo.'],
      ['Medicamentos', 'Ninguno.'], ['Enfermedad actual', 'Gastroenteritis aguda con deshidratación moderada.'],
    ],
    sv: sv('100/60', 112, 20, 37.6, 97),
    ivContraindicado: { region: 'brazo_i', motivo: 'fístula arteriovenosa en el brazo izquierdo' },
    calibres: [18, 20],
    hallazgos: {
      'inspeccionar:boca': 'Mucosa oral seca.', 'inspeccionar:cabeza': 'Ojos hundidos, mucosas secas.',
      'capital:brazo_d': 'Brazo derecho: venas del antebrazo visibles y palpables (cefálica antebraquial adecuada).',
      'capital:brazo_i': 'Brazo izquierdo: se palpa un FRÉMITO (vibración) y se ausculta un soplo continuo en el antebrazo.',
      'inspeccionar:brazo_i': 'Cicatriz antigua en el antebrazo izquierdo; vena dilatada y pulsátil.',
      'palpar_sup:brazo_i': 'Frémito palpable (fístula AV).',
      'llenado:brazo_d': 'Llenado capilar 3 s.',
    },
    respuestas: { nombre: 'Andrés Felipe Gómez Salazar, cédula 1.020.987.654.', dominante: 'Soy diestro.', alergias: 'No, que yo sepa.', sintoma: 'Me siento muy débil y mareado.', explicacion: '¿Me va a doler?' },
    minIntervenciones: 3,
    intervenciones: [
      { nombre: 'Punción intravenosa exitosa', cuando: 'permeabiliza' },
      { nombre: 'Terapia IV: equipo purgado y conectado', cuando: 'conecta_equipo' },
      { nombre: 'Cálculo de goteo', cuando: (e) => (e.w.goteo != null && Math.abs(e.w.goteo - 167) <= 2 ? e.f('goteo_calculado') : null) },
      { nombre: 'Monitorización de signos vitales', cuando: ['sv_pa', 'sv_fc'] },
      { nombre: 'Manejo de líquidos (control de ingresos y egresos / educación)', cuando: ['com_educa'] },
    ],
    material: [['cat_18', 'cat_20'], 'torniquete', ['alcohol', 'clorhexidina'], 'torundas', 'jeringa_ssn', 'equipo_macro', 'bolsa_ssn', 'aposito', 'marcador'],
    onEvent(e, ev) {
      if (ev.tipo === 'accion' && ev.accion === 'pa' && ev.region === 'brazo_i') e.alerta('info', 'Tomó la presión arterial en el brazo con fístula AV', 'No tomar PA ni puncionar el brazo con fístula AV.', { id: 'pa_fistula' });
    },
    checklist: [
      ...ivChecklist({ brazo: 'brazo_d', brazoTexto: 'derecho (izquierdo con fístula AV)', calibres: '18G o 20G' }),
      it('iv_purga', 'Purga el equipo de venoclisis antes de conectar', P, 1, 'purga_equipo', { antesDe: ['iv_conecta'], correcto: 'Purgar el equipo conectado a la bolsa antes de conectarlo al catéter.' }),
      it('iv_goteo', 'Calcula el goteo: 500 × 20 / 60 ≈ 167 gotas/min', CG, 1, (e) => (e.w.goteo != null && Math.abs(e.w.goteo - 167) <= 2 ? e.f('goteo_calculado') : null), { correcto: 'Macrogoteo: 500 ml × 20 gt/ml ÷ 60 min ≈ 167 gotas/min.' }),
    ],
    eventos: [...EV_IV],
    pae: {
      dominios: [2, 11], clases: ['Hidratación', 'Lesión física'], nanda: ['Déficit de volumen de líquidos', 'Riesgo de infección'],
      rc: ['pérdida activa de líquidos', 'diarrea', 'vómito', 'procedimiento invasivo'],
      ep: ['mucosas secas', 'taquicardia', 'hipotensión', 'sed', 'debilidad'],
      noc: ['Equilibrio hídrico', 'Hidratación'],
      nic: ['Punción intravenosa (I.V.)', 'Terapia intravenosa (I.V.)', 'Manejo de líquidos'],
      texto: 'Dominio 2 Nutrición · Clase 5 Hidratación · Déficit de volumen de líquidos (00027) R/C pérdida activa de líquidos E/P mucosas secas, taquicardia, hipotensión. Alternativa: Dominio 11, Clase 2 · Riesgo de infección. NOC: Equilibrio hídrico / Hidratación. NIC: Punción intravenosa (I.V.), Terapia intravenosa (I.V.), Manejo de líquidos.',
    },
    interpretacion: ['mucosas? secas', 'taquicard|112', 'hipotens|100/60', 'deshidrat', 'f[ií]stula', '167|goteo', 'p[eé]rdida'],
  },
  {
    id: '3B', tema: 'iv', titulo: 'Flebitis y recanalización', sexo: 'M', edad: 45, servicio: 'ortopedia',
    paciente: { nombre: 'Carlos Arturo Medina Rojas', doc: 'CC 79.456.123', edad: 45 },
    motivo: 'infección del sitio quirúrgico tras reemplazo total de cadera derecha',
    antecedentes: 'diabetes mellitus tipo II; día 3/7 de piperacilina/tazobactam 4,5 g IV c/8 h',
    dice: 'Me duele mucho donde tengo puesto el catéter… está rojo y caliente.',
    svTexto: 'PA 128/80 mmHg, FC 92 lpm, FR 18 rpm, T 37,8 °C, SpO2 96 %.',
    reportes: 'Glucometría 168 mg/dL. PCR elevada.',
    orden: 'Continuar piperacilina/tazobactam 4,5 g IV c/8 h (día 3/7). Valorar sitio de inserción del catéter; si hay flebitis, retirar y canalizar nueva vena.',
    historia: [
      ['Alergias', 'Ninguna conocida.'], ['Antecedentes', 'DM II en manejo con insulina. Reemplazo total de cadera derecha hace 10 días.'],
      ['Medicamentos', 'Piperacilina/tazobactam 4,5 g IV c/8 h (día 3/7). Insulina glargina.'],
      ['Accesos venosos', 'Capital venoso pobre: múltiples punciones previas en antebrazos y brazos. Catéter actual en antebrazo derecho (72 h).'],
    ],
    sv: sv('128/80', 92, 18, 37.8, 96),
    ivPrevio: { region: 'brazo_d', sub: 'antebrazo' },
    calibres: [22, 20], dorsoManoAceptable: true,
    hallazgos: {
      'inspeccionar:brazo_d:antebrazo': 'Sitio del catéter: eritema, edema y cordón venoso palpable de ~3 cm; dolor. Compatible con Maddox 2–3.',
      'inspeccionar:brazo_d': 'Catéter en antebrazo derecho: eritema alrededor del sitio.',
      'palpar_sup:brazo_d:antebrazo': 'Calor local, dolor y cordón venoso.',
      'capital:brazo_d': 'Antebrazo y brazo con múltiples puntos de punción y venas esclerosadas. En el dorso de la mano derecha se observa una vena metacarpiana recta y palpable.',
      'capital:brazo_i': 'Venas del antebrazo y brazo izquierdos esclerosadas y frágiles por múltiples punciones previas.',
    },
    respuestas: { nombre: 'Carlos Arturo Medina Rojas, 79.456.123.', dominante: 'Soy zurdo.', alergias: 'No.', sintoma: 'Me duele el brazo donde está el catéter.' },
    minIntervenciones: 3,
    intervenciones: [
      { nombre: 'Valoración del sitio con escala de Maddox', cuando: 'maddox' },
      { nombre: 'Retiro del catéter con flebitis', cuando: 'retira_cateter_ant' },
      { nombre: 'Nueva punción intravenosa', cuando: 'permeabiliza' },
      { nombre: 'Administración de medicación IV (vigilancia de flebitis/infiltración)', cuando: ['conecta', 'com_educa'] },
      { nombre: 'Educación sobre signos de flebitis', cuando: 'com_educa' },
    ],
    material: [['cat_22', 'cat_20'], 'torniquete', ['alcohol', 'clorhexidina'], 'torundas', 'gasas', 'jeringa_ssn', 'conector', 'aposito', 'marcador'],
    checklist: [
      it('f_maddox', 'Valora el sitio actual con la escala de Maddox (= 2)', P, 1.5, (e) => (e.FV.maddox != null && e.FV.maddox >= 2 && e.FV.maddox <= 3 ? e.f('maddox') : null), { correcto: 'Maddox 2 (dolor, eritema y/o edema) → retirar el catéter y canalizar otra vena.' }),
      it('f_retira', 'Retira el catéter anterior con guantes, presión con gasa y lo desecha', P, 1.5, 'retira_cateter_ant', { antesDe: ['iv_puncion'], correcto: 'Retirar con guantes, presión con gasa, desechar en la roja.' }),
      ...ivChecklist({ brazo: 'brazo_d', brazoTexto: 'derecho (no dominante; acepta metacarpiana justificada)', calibres: '22G (20G aceptable)' }),
      it('f_justifica', 'Justifica el sitio elegido por el capital venoso pobre', CO, 0.5, (e) => (/(capital|metacarp|dorso|mano)/i.test(e.w.notas + ' ' + e.w.entrega + ' ' + e.log.filter(x => x.tipo === 'hablar' || x.tipo === 'otra').map(x => x.texto).join(' ')) ? (e.f('notas') ?? e.f('entrega') ?? e.f('otra_accion') ?? e.f('hablo')) : null), { correcto: 'Justificar la metacarpiana por el capital venoso pobre.' }),
    ],
    eventos: [...EV_IV],
    pae: {
      dominios: [11], clases: ['Lesión física'], nanda: ['Riesgo de deterioro de la integridad cutánea', 'Riesgo de traumatismo vascular'], riesgo: true,
      rc: ['dispositivos médicos', 'múltiples punciones', 'sitio de inserción disponible inadecuado', 'solución irritante'],
      ep: [],
      noc: ['Control del riesgo', 'Detección del riesgo'],
      nic: ['Punción intravenosa (I.V.)', 'Administración de medicación: intravenosa (I.V.)'],
      texto: 'Dominio 11 Seguridad y protección · Clase 2 Lesión física · Riesgo de deterioro de la integridad cutánea R/C dispositivos médicos, múltiples punciones; o Riesgo de traumatismo vascular R/C sitio de inserción disponible inadecuado, solución irritante. NOC: Control del riesgo ("identifica los factores de riesgo" 1–5) / Detección del riesgo. NIC: Punción intravenosa (I.V.), Administración de medicación: intravenosa (I.V.).',
    },
    interpretacion: ['flebitis', 'maddox', 'eritema|rubor', 'edema', 'cordón', 'capital venoso', 'metacarp', 'piperacilina|irritante'],
  },

  // ===================== TEMA 4 =====================
  {
    id: '4A', tema: 'vesical', titulo: 'Sonda vesical: mujer, control de diuresis', sexo: 'F', edad: 55, servicio: 'cirugía general (posoperatorio)',
    paciente: { nombre: 'Martha Lucía Herrera Gil', doc: 'CC 41.678.234', edad: 55 },
    motivo: 'posoperatorio inmediato de laparotomía exploratoria por perforación intestinal; paciente hemodinámicamente inestable',
    antecedentes: 'hipertensión arterial; sin alergias conocidas',
    dice: 'Estoy muy cansada… ¿me van a poner otra cosa?',
    svTexto: 'PA 96/58 mmHg, FC 108 lpm, FR 22 rpm, T 37,4 °C, SpO2 95 %.',
    reportes: 'Hb 10,2 g/dL. Lactato 2,8 mmol/L.',
    orden: 'Sonda vesical permanente para control estricto de diuresis horaria.',
    historia: [
      ['Alergias', 'Ninguna conocida.'], ['Antecedentes', 'HTA. G3P3. Sin cirugías urológicas.'],
      ['Medicamentos', 'Enalapril (suspendido). Cristaloides según orden.'], ['Enfermedad actual', 'POP inmediato de laparotomía; requiere control estricto de líquidos.'],
    ],
    sv: sv('96/58', 108, 22, 37.4, 95),
    hallazgos: { 'inspeccionar:genitales': 'Genitales sin lesiones; meato uretral visible al separar los labios.', 'inspeccionar:abdomen': 'Herida quirúrgica cubierta con apósito limpio.' },
    respuestas: { nombre: 'Martha Lucía Herrera Gil, 41.678.234.', alergias: 'No, a nada.', sintoma: 'Cansada, me duele la herida.' },
    minIntervenciones: 3,
    intervenciones: [
      { nombre: 'Sondaje vesical con técnica estéril', cuando: 'infla_agua' },
      { nombre: 'Cuidados del catéter urinario (fijación, bolsa abajo, sistema cerrado)', cuando: { todos: ['fija_sonda', 'bolsa_bajo'] } },
      { nombre: 'Control de infecciones (higiene genital, asepsia)', cuando: 'higiene_genital_ok' },
      { nombre: 'Registro de diuresis', cuando: (e) => (/(ml|cc|diuresis|orina)/i.test(e.w.notas) ? e.f('notas') : null) },
      { nombre: 'Educación', cuando: 'com_educa' },
    ],
    material: [['foley_14', 'foley_16'], 'jeringa_10', 'agua_destilada', 'lidocaina', 'gasas_esteriles', 'jabon_quirurgico', 'campo_esteril', 'campo_ojo', 'bolsa_colectora', 'esparadrapo', 'guantes_esteriles'],
    checklist: vesicalChecklist({ male: false }),
    eventos: [...EV_VES],
    pae: {
      dominios: [11], clases: ['Infección'], nanda: ['Riesgo de infección'], riesgo: true,
      rc: ['procedimiento invasivo', 'dispositivo invasivo', 'catéter urinario'], ep: [],
      noc: ['Control del riesgo: proceso infeccioso', 'Eliminación urinaria'],
      nic: ['Sondaje vesical', 'Cuidados del catéter urinario', 'Control de infecciones'],
      texto: 'Dominio 11 Seguridad y protección · Clase 1 Infección · Riesgo de infección (00004) R/C procedimiento invasivo. NOC: Control del riesgo: proceso infeccioso / Eliminación urinaria. NIC: Sondaje vesical, Cuidados del catéter urinario, Control de infecciones.',
    },
    interpretacion: ['hipotens|96/58', 'taquicard|108', 'inestable', 'diuresis', 'invasiv', 'infecci', 'orina'],
  },
  {
    id: '4B', tema: 'vesical', titulo: 'Sonda vesical: hombre con retención urinaria', sexo: 'M', edad: 68, servicio: 'urgencias',
    paciente: { nombre: 'Pedro Antonio Suárez León', doc: 'CC 17.234.567', edad: 68 },
    motivo: 'no orina desde hace 10 horas; dolor en hipogastrio',
    antecedentes: 'hiperplasia prostática benigna; HTA',
    dice: '¡Ay, enfermero, no he podido orinar en toda la noche y me duele mucho aquí abajo!',
    svTexto: 'PA 152/90 mmHg, FC 96 lpm, FR 20 rpm, T 36,8 °C, SpO2 96 %. EVA 8/10.',
    reportes: 'Ecografía: vejiga distendida, volumen estimado 900 ml. Próstata aumentada de tamaño.',
    orden: 'Sonda vesical permanente. Cuantificar diuresis.',
    historia: [
      ['Alergias', 'Ninguna conocida.'], ['Antecedentes', 'Hiperplasia prostática benigna (tamsulosina). HTA.'],
      ['Medicamentos', 'Tamsulosina 0,4 mg/día. Losartán.'], ['Enfermedad actual', 'Retención urinaria aguda.'],
    ],
    sv: sv('152/90', 96, 20, 36.8, 96),
    dolorEn: ['abdomen:hipogastrio'],
    hallazgos: {
      'inspeccionar:abdomen': 'Abombamiento en hipogastrio (globo vesical).',
      'inspeccionar:abdomen:hipogastrio': 'Abombamiento suprapúbico visible.',
      'palpar_sup:abdomen:hipogastrio': 'Masa suprapúbica redondeada, tensa y dolorosa: globo vesical.',
      'palpar_prof:abdomen:hipogastrio': 'Globo vesical doloroso; el paciente siente urgencia.',
      'percutir:abdomen:hipogastrio': 'MATIDEZ suprapúbica (vejiga distendida).',
      'inspeccionar:genitales': 'Genitales sin lesiones; prepucio retráctil.',
    },
    respuestas: { nombre: 'Pedro Antonio Suárez León, 17.234.567.', alergias: 'No.', sintoma: 'Me duele mucho la vejiga, no puedo orinar.', dolor: 'Como un 8 de 10.' },
    minIntervenciones: 3,
    intervenciones: [
      { nombre: 'Valoración del globo vesical (insp, palp, perc del hipogastrio)', cuando: { todos: ['inspeccionar:abdomen', 'palpar:abdomen:hipogastrio', 'percutir:abdomen:hipogastrio'] } },
      { nombre: 'Sondaje vesical', cuando: 'infla_agua' },
      { nombre: 'Cuidados del catéter urinario', cuando: { todos: ['fija_sonda', 'bolsa_bajo'] } },
      { nombre: 'Registro de la diuresis', cuando: (e) => (/(ml|cc|diuresis|orina)/i.test(e.w.notas) ? e.f('notas') : null) },
      { nombre: 'Enseñanza individual', cuando: 'com_educa' },
    ],
    material: [['foley_16', 'foley_18', 'foley_14'], 'jeringa_10', 'agua_destilada', 'lidocaina', 'gasas_esteriles', 'jabon_quirurgico', 'campo_esteril', 'campo_ojo', 'bolsa_colectora', 'esparadrapo', 'guantes_esteriles'],
    checklist: [
      it('b_valora', 'Valora el hipogastrio: inspección, palpación y percusión (globo vesical)', P, 1.5, { todos: ['inspeccionar:abdomen', 'palpar:abdomen:hipogastrio', 'percutir:abdomen:hipogastrio'] }, { antesDe: ['v_inserta'], correcto: 'Antes del sondaje: inspeccionar, palpar y percutir el hipogastrio (matidez suprapúbica).' }),
      ...vesicalChecklist({ male: true }),
      it('b_resistencia', 'Ante resistencia: pide que tosa; si persiste, detiene y solicita asistencia', P, 1, (e) => (e.eventosEval.some(x => x.id === 'resistencia') ? (e.f('resistencia_tos') ?? e.f('solicita_asistencia')) : (e.f('inserta_sonda') ?? null)), { correcto: 'No forzar: pedir que tosa; si persiste, hay sangrado o molestia, detener y solicitar asistencia médica.' }),
    ],
    eventos: [...EV_VES],
    pae: {
      dominios: [3], clases: ['Función urinaria'], nanda: ['Retención urinaria'],
      rc: ['obstrucción', 'hiperplasia prostática', 'relajación inadecuada del suelo pélvico'],
      ep: ['ausencia de diuresis', 'distensión vesical', 'dolor', 'globo vesical'],
      noc: ['Eliminación urinaria', 'Continencia urinaria'],
      nic: ['Cuidados de la retención urinaria', 'Cuidados del catéter urinario', 'Enseñanza: individual', 'Sondaje vesical'],
      texto: 'Dominio 3 Eliminación e intercambio · Clase 1 Función urinaria · Retención urinaria (00023) R/C obstrucción (o relajación inadecuada del suelo pélvico) E/P ausencia de diuresis, distensión vesical, dolor. NOC: Eliminación urinaria (patrón de eliminación 1–5) / Continencia urinaria. NIC: Cuidados de la retención urinaria, Cuidados del catéter urinario, Enseñanza: individual, Sondaje vesical.',
    },
    interpretacion: ['globo vesical|distensi', 'matidez', 'retenci', '10 h|10 horas|no orina', 'dolor|eva|8/10', 'pr[oó]stat', 'hipertens|152'],
  },

  // ===================== TEMA 5 =====================
  {
    id: '5A', tema: 'sng', titulo: 'SNG: obstrucción intestinal', sexo: 'M', edad: 47, servicio: 'cirugía general',
    paciente: { nombre: 'Ricardo José Peña Ortiz', doc: 'CC 80.123.456', edad: 47 },
    motivo: 'náuseas, vómito bilioso, distensión abdominal y dolor tipo cólico de 24 horas',
    antecedentes: 'vólvulo intestinal hace 2 años',
    dice: 'Tengo la barriga muy inflada y no paro de vomitar.',
    svTexto: 'PA 118/74 mmHg, FC 104 lpm, FR 22 rpm, T 37,3 °C, SpO2 95 %.',
    reportes: 'Rx de abdomen: niveles hidroaéreos, asas dilatadas.',
    orden: 'Nada vía oral. Pasar sonda nasogástrica a drenaje libre. Cuantificar drenaje.',
    historia: [
      ['Alergias', 'Ninguna conocida.'], ['Antecedentes', 'Vólvulo de sigmoides hace 2 años (manejo quirúrgico).'],
      ['Contraindicaciones SNG', 'No hay estenosis esofágica, várices, trauma facial ni taponamiento nasal.'],
      ['Medicamentos', 'Ninguno.'],
    ],
    sv: sv('118/74', 104, 22, 37.3, 95), sngCm: 55, narinaMayor: 'narina_d', aspirado: 'Obtiene contenido gástrico verde-bilioso.', ph: 4,
    hallazgos: {
      'inspeccionar:abdomen': 'Abdomen distendido, timpánico a la vista.', 'auscultar:abdomen': 'Ruidos intestinales aumentados de tono (metálicos).',
      'percutir:abdomen': 'Timpanismo generalizado.', 'palpar_sup:abdomen': 'Abdomen tenso, doloroso de forma difusa.',
      'permeabilidad': 'Ambas narinas permeables; la DERECHA es de mayor diámetro.',
    },
    respuestas: { nombre: 'Ricardo José Peña Ortiz, 80.123.456.', alergias: 'No.', sintoma: 'Náuseas, vómito y la barriga hinchada.' },
    minIntervenciones: 3,
    intervenciones: [
      { nombre: 'Sondaje gastrointestinal verificado', cuando: { todos: ['verif_auscultacion', 'verif_aspirado'] } },
      { nombre: 'Cuidados del drenaje (conexión, bolsa abajo, rotular)', cuando: { todos: ['conecta_drenaje', 'drenaje_bajo'] } },
      { nombre: 'Manejo de las náuseas / del vómito (posición, riñonera)', cuando: ['pos:semifowler', 'pos:fowler', 'pos:fowler_alto'] },
      { nombre: 'Registro de la profundidad y del drenaje', cuando: 'rotula_sng' },
      { nombre: 'Educación para evitar el retiro accidental', cuando: 'com_educa' },
    ],
    material: [['levin_14', 'levin_16', 'levin_18'], 'lubricante', 'jeringa_50', 'fonendoscopio', 'esparadrapo', 'marcador', 'gasas', 'bolsa_drenaje', 'guantes_manejo'],
    checklist: [
      ...sngChecklist({}),
      it('s_drenaje', 'Conecta a la bolsa recolectora por debajo de la cintura', P, 1, { todos: ['conecta_drenaje', 'drenaje_bajo'] }, { correcto: 'Conectar a la bolsa recolectora por debajo de la cintura.' }),
    ],
    eventos: [...EV_SNG],
    pae: {
      dominios: [3], clases: ['Función gastrointestinal'], nanda: ['Motilidad gastrointestinal disfuncional'],
      rc: ['malnutrición', 'intolerancia alimentaria', 'obstrucción intestinal', 'vólvulo'],
      ep: ['cólico abdominal', 'residuo gástrico bilioso', 'abdomen distendido', 'vómito'],
      noc: ['Eliminación intestinal', 'Severidad de las náuseas y los vómitos'],
      nic: ['Manejo de las náuseas', 'Cuidados del drenaje', 'Manejo del vómito', 'Sondaje gastrointestinal'],
      texto: 'Dominio 3 Eliminación e intercambio · Clase 2 Función gastrointestinal · Motilidad gastrointestinal disfuncional (00196) R/C malnutrición, intolerancia alimentaria E/P cólico abdominal, residuo gástrico bilioso, abdomen distendido, vómito. NOC: Eliminación intestinal (ruidos abdominales 3/5 → 4/5), Severidad de las náuseas y los vómitos. NIC: Manejo de las náuseas, Cuidados del drenaje, Manejo del vómito.',
    },
    interpretacion: ['distensi|distendid', 'v[oó]mito', 'bilios', 'c[oó]lico', 'ruidos', 'timpan', 'v[oó]lvulo|obstrucci', 'taquicard|104'],
  },
  {
    id: '5B', tema: 'sng', titulo: 'Sonda gástrica para nutrición enteral', sexo: 'F', edad: 74, servicio: 'neurología',
    paciente: { nombre: 'Rosa Elena Quintero de Ávila', doc: 'CC 20.345.876', edad: 74 },
    motivo: 'ACV isquémico hace 5 días con disfagia; alerta, orientada',
    antecedentes: 'ver historia clínica en el computador',
    dice: 'Mija… cada vez que trato de tomar agua me ahogo.',
    svTexto: 'PA 146/86 mmHg, FC 84 lpm, FR 18 rpm, T 36,6 °C, SpO2 95 %.',
    reportes: 'Prueba de deglución: disfagia orofaríngea con tos y atragantamiento al deglutir.',
    orden: 'Pasar sonda nasogástrica para nutrición enteral. Cabecera elevada a 30–45°. Lavar la sonda con 60 cc de agua cada 6 horas.',
    historia: [
      ['Alergias', 'Ninguna conocida.'], ['Antecedentes', 'HTA, fibrilación auricular. ACV isquémico hace 5 días.'],
      ['Evolución (hace 2 días)', 'Epistaxis posterior severa: otorrinolaringología colocó TAPONAMIENTO NASAL POSTERIOR. Pendiente retiro.'],
      ['Medicamentos', 'Enoxaparina profiláctica (suspendida por epistaxis). Atorvastatina.'],
    ],
    sv: sv('146/86', 84, 18, 36.6, 95), sngCm: 52, aspirado: 'Obtiene contenido gástrico claro.', ph: 4,
    sngContraNasal: 'taponamiento nasal posterior',
    trampa: { regex: 'tapona|epistax|orog[aá]str|por la boca|v[ií]a oral' },
    hallazgos: {
      'inspeccionar:nariz': 'Se observa material de taponamiento en ambas fosas nasales.',
      'permeabilidad': 'Narinas OCLUIDAS por el taponamiento nasal posterior.',
      'inspeccionar:boca': 'Cavidad oral sin lesiones; leve desviación de la comisura.',
    },
    respuestas: { nombre: 'Rosa Elena Quintero de Ávila, 20.345.876.', alergias: 'No, mija.', sintoma: 'Me ahogo cuando trago.' },
    minIntervenciones: 3,
    intervenciones: [
      { nombre: 'Sondaje gastrointestinal (vía orogástrica) verificado', cuando: { todos: ['orogastrica', 'verif_aspirado'] } },
      { nombre: 'Precauciones para evitar la aspiración (cabecera elevada)', cuando: ['pos:semifowler', 'pos:fowler', 'pos:fowler_alto'] },
      { nombre: 'Alimentación enteral: lavado de la sonda con 60 cc', cuando: 'lavado_sonda' },
      { nombre: 'Detección de la contraindicación nasal', cuando: ['detecto_trampa', 'orogastrica'] },
      { nombre: 'Educación', cuando: 'com_educa' },
    ],
    material: [['levin_14', 'levin_16'], 'lubricante', 'jeringa_50', 'fonendoscopio', 'esparadrapo', 'marcador', 'gasas', 'guantes_manejo'],
    checklist: [
      it('n_trampa', 'Lee la historia y detecta el taponamiento nasal posterior', CG, 2, ['detecto_trampa', 'orogastrica'], { correcto: 'Con taponamiento nasal: vía orogástrica (o avisar y no pasarla por la nariz).' }),
      ...sngChecklist({ orogastrica: true, contra: 'taponamiento nasal posterior' }),
      it('n_cabecera', 'Cabecera elevada (30–45°) para la nutrición', P, 1, ['pos:semifowler', 'pos:fowler'], { correcto: 'Cabecera elevada para prevenir la aspiración.' }),
      it('n_lavado', 'Lava la sonda con 60 cc de agua', P, 1, 'lavado_sonda', { correcto: 'Lavar la sonda con 60 cc de agua cada 6 h.' }),
    ],
    eventos: [...EV_SNG],
    pae: {
      dominios: [2, 11], clases: ['Ingestión', 'Lesión física'], nanda: ['Deterioro de la deglución', 'Riesgo de aspiración'],
      rc: ['deterioro neuromuscular', 'accidente cerebrovascular', 'disfagia'],
      ep: ['tos al deglutir', 'atragantamiento', 'atragantamiento al deglutir'],
      noc: ['Estado de deglución', 'Estado nutricional', 'Prevención de la aspiración'],
      nic: ['Alimentación enteral por sonda', 'Precauciones para evitar la aspiración', 'Sondaje gastrointestinal'],
      texto: 'Dominio 2 Nutrición · Clase 1 Ingestión · Deterioro de la deglución (00103) R/C deterioro neuromuscular E/P tos o atragantamiento al deglutir. Alternativa: Dominio 11 · Riesgo de aspiración. NOC: Estado de deglución / Estado nutricional / Prevención de la aspiración. NIC: Alimentación enteral por sonda, Precauciones para evitar la aspiración, Sondaje gastrointestinal.',
    },
    interpretacion: ['disfagia|degluci', 'atragant|tos', 'acv|cerebrovascular', 'tapona', 'orog[aá]str', 'aspiraci'],
  },
];

export function getCase(id) { return CASES.find(c => c.id === id); }

export function eventosDelCaso(caso) {
  const propios = caso.eventos || [];
  const ids = new Set(propios.map(e => e.id));
  return [...propios, ...EVENTOS_COMUNES.filter(e => !ids.has(e.id))];
}

export function guiaEstudiante(caso, minutos) {
  const sexo = caso.sexo === 'M' ? 'de sexo masculino' : 'de sexo femenino';
  return {
    minutos,
    situacion: `Persona ${sexo} de ${caso.edad} años se encuentra hospitalizada en el servicio de ${caso.servicio}. El motivo de consulta es ${caso.motivo}. Tiene antecedentes de ${caso.antecedentes}. Al ingresar usted a la habitación, el paciente manifiesta: "${caso.dice}". Signos vitales: ${caso.svTexto} Reportes de medios diagnósticos: ${caso.reportes}`,
    orden: caso.orden,
  };
}
