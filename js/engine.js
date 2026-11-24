// Motor de reglas del simulador ECOE.
// - Estado del mundo + log de eventos. apply(ev) actualiza el estado y devuelve efectos (fx) para la UI.
// - Determinista: la evaluadora reconstruye todo reproduciendo el mismo log.
// - "Hechos" (facts) con su tiempo -> la lista de chequeo (data/cases.js) se evalúa contra ellos.
import { ITEMS, VENTURI } from '../data/items.js';
import { REGIONS, VENAS } from '../data/hotspots.js';
import { PROTOCOLO_COMUN, TEMAS, eventosDelCaso } from '../data/cases.js';

export const CONFIG = {
  aprobar: 3.0,
  penalizacion: 0.2,      // puntos (0–5) que resta cada penalización automática de la psicomotriz
  penalizacionMax: 1.5,
  topeFallaCritica: 2.5,
};

export const fmt = (ms) => {
  const s = Math.max(0, Math.round((ms || 0) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

const RE = {
  saludo: /\b(hola|buen[oa]s?\s*(d[ií]as|tardes|noches)|mucho gusto|buenas)\b/i,
  presenta: /(mi nombre es|me llamo|soy (el |la )?(enfermer|estudiante)|estudiante de enfermer|soy \w+[, ]+(el |la )?(enfermer|estudiante)|voy a ser (su|el|la) )/i,
  identifica: /(nombre completo|nombres? y apellidos?|c[oó]mo se llama|cu[aá]l es su nombre|su nombre|me (dice|confirma|regala|indica) su nombre|documento|c[eé]dula|fecha de nacimiento|identificaci[oó]n)/i,
  explica: /(voy a (realizar|hacer|colocar|pasar|tomar|canalizar|poner|examinar|valorar|auscultar|revisar|insertar|introducir|medir)|procedimiento|consiste en|le explico|vamos a (realizar|hacer|colocar|pasar|tomar|canalizar|poner|valorar|examinar)|le (voy|vamos) a)/i,
  beneficio: /(beneficio|riesgo|complicaci|sirve para|para que (usted|pueda|mejore|respire|salga|drene)|le va a ayudar|ayudar[aá]|molestia|puede (sentir|doler|arder))/i,
  consentimiento: /(est[aá] de acuerdo|me (permite|autoriza|deja)|autoriza|acepta|consentimiento|puedo (proceder|empezar|comenzar|realizar|continuar)|le parece( bien)?|tengo su permiso|da su permiso)/i,
  dudas: /(tiene (alguna |algunas )?(duda|pregunta)|alguna (duda|pregunta)|qued[oó] claro)/i,
  trato: /(c[oó]mo se siente|c[oó]mo (est[aá]|amaneci[oó]|le va)|tranquil|no se preocupe|cualquier (cosa|molestia)|av[ií]seme|me avisa|si le duele|lo siento|entiendo|con cuidado|despacio|est[aá] c[oó]mod)/i,
  senal: /(levant(e|a) (la|el|su) (mano|brazo)|se[nñ]al|si (quiere|desea) que (pare|me detenga)|para (que me detenga|detener)|me hace una se[nñ]al)/i,
  alergias: /(al[eé]rgic|alergia)/i,
  dominante: /(diestr|zurd|mano dominante|con qu[eé] mano (escribe|come)|qu[eé] mano usa)/i,
  educa: /(recomend|no (se )?(retire|quite|toque|fume|jale|hale|manipule|doble|levante)|evite|es importante|debe (mantener|avisar|llamar|tomar)|timbre|ll[aá]me(me|nos)?|cuidados|no use vaselina|no fumar|mantenga|deje (la|el) )/i,
  tragar: /(trague|degluta|pase (la )?saliva|tragar)/i,
  tos: /(tosa|toser)/i,
  privacidad: /(cortina|privacidad|intimidad|solo (vamos a |voy a )?(descubrir|destapar))/i,
  eva: /(escala|del (1|uno|0|cero) al (10|diez)|de (0|cero) a (10|diez)|eva|qu[eé] tan (fuerte|intenso)|cu[aá]nto le duele|intensidad)/i,
};

function regionDef(id) { return REGIONS.find(r => r.id === id); }
function subName(region, sub) {
  const r = regionDef(region);
  const s = r && r.subs && r.subs.find(x => x[0] === sub);
  return s ? s[1] : '';
}
export function lugarTexto(region, sub, vista) {
  const r = regionDef(region);
  let n = r ? r.nombre : region;
  if (region === 'torax') n = vista === 'posterior' ? 'Tórax posterior' : 'Tórax anterior';
  const s = subName(region, sub);
  return s ? `${n} · ${s}` : n;
}

const POSICIONES = {
  supino: 'Decúbito supino', semifowler: 'Semi-Fowler (30–45°)', fowler: 'Fowler (45–60°)', fowler_alto: 'Fowler alto (90°)',
  lateral: 'Decúbito lateral', supino_piernas: 'Supino con piernas separadas',
};
export { POSICIONES };

export class Engine {
  constructor(caso, opts = {}) {
    this.caso = caso;
    this.tema = TEMAS[caso.tema];
    this.opts = opts;
    this.log = [];
    this.F = {}; this.FL = {}; this.FV = {}; this.FC = {};
    this.alerts = [];
    this.uid = 0;
    this.higienes = []; this.contactos = []; this.contactosManos = []; this.entorno = []; this.fluidos = []; this.asepticas = [];
    this.retirosGuantes = []; this.minijuegos = [];
    this.eventosEval = [];
    this.w = {
      mano: [], bandeja: [], items: {},
      guantes: null, contaminado: false, epp: { gorro: false, tapabocas: false, gafas: false, bata: false },
      cortina: false, barandas: true, posicion: caso.posicionInicial || 'supino', cuello: 'neutro', vista: 'anterior',
      expuesto: {}, timbre: false,
      o2: { flujo: 0, humid: null, valvula: null, conectado: null, reservorioLleno: false },
      disp: [], // dispositivos sobre el paciente
      iv: { torniquete: null, antisepsia: null, palpoTrasAntisepsia: false, cat: null, previo: caso.ivPrevio ? { ...caso.ivPrevio, retirado: false } : null },
      foley: null, sng: null, campo: false, campoOjo: false,
      sv: { ...caso.sv }, medidos: {},
      pae: null, notas: '', entrega: '', goteo: null,
      flags: {}, terminado: false,
    };
  }

  // ---------- helpers de hechos ----------
  fact(key, val, t = this.t) {
    if (this.F[key] == null) this.F[key] = t;
    this.FL[key] = t; this.FC[key] = (this.FC[key] || 0) + 1;
    if (val !== undefined) this.FV[key] = val;
  }
  f(key) { return this.F[key] ?? null; }
  last(key) { return this.FL[key] ?? null; }
  alerta(tipo, texto, correcto, extra = {}) {
    const a = { t: this.t, tipo, texto, correcto, ...extra };
    this.alerts.push(a);
    return a;
  }
  penaliza(id, texto, correcto) {
    if (this.alerts.some(a => a.id === id)) return;
    this.alerta('penalizacion', texto, correcto, { id });
  }
  falla(id, texto, correcto) {
    if (this.alerts.some(a => a.id === id)) return;
    this.alerta('falla', texto, correcto, { id, critico: true });
    this.fact('falla_critica');
  }
  info(texto, correcto) { this.alerta('info', texto, correcto); }
  ordenAlerta(texto, correcto) { this.alerta('orden', texto, correcto); }

  newInst(id, extra = {}) {
    const inst = { uid: 'u' + (++this.uid), id, ...extra };
    this.w.items[inst.uid] = inst;
    return inst;
  }
  inst(uid) { return this.w.items[uid]; }
  enMano(pred) { return this.w.mano.map(u => this.inst(u)).filter(i => i && pred(i)); }
  enManoId(...ids) { return this.enMano(i => ids.includes(i.id))[0] || null; }
  disponible(pred) { // mano o bandeja
    return [...this.w.mano, ...this.w.bandeja].map(u => this.inst(u)).filter(i => i && pred(i));
  }
  quitarDeInventario(uid) {
    this.w.mano = this.w.mano.filter(u => u !== uid);
    this.w.bandeja = this.w.bandeja.filter(u => u !== uid);
  }
  aMano(inst) {
    if (this.w.mano.length < 2) this.w.mano.push(inst.uid);
    else if (this.w.bandeja.length < 12) this.w.bandeja.push(inst.uid);
  }
  dispEn(region, tipo) { return this.w.disp.find(d => d.region === region && (!tipo || d.tipo === tipo)); }
  manosSinHigieneDesde(t) { return !this.higienes.some(h => h > t); }

  // ---------- acciones disponibles (para la UI) ----------
  // Devuelve [{id, label, opciones?:[[valor,label]], ui?, num?}]
  getActions(region, sub) {
    const w = this.w;
    const A = [];
    const add = (id, label, extra = {}) => A.push({ id, label, ...extra });
    const mano = w.mano.map(u => this.inst(u)).filter(Boolean);
    const ids = mano.map(i => i.id);
    const has = (...xs) => xs.some(x => ids.includes(x));
    const hasPref = (p) => ids.find(x => x.startsWith(p));
    const isBrazo = region === 'brazo_d' || region === 'brazo_i';
    const reg = region === 'torax' && w.vista === 'posterior' ? 'torax_post' : region;
    const male = this.caso.sexo === 'M';

    if (region === 'borde_cama') {
      if (has('bolsa_colectora') && w.foley && w.foley.conectada) add('colgar_bolsa', 'Colgar la bolsa colectora en el lateral de la cama (por debajo de la vejiga)');
      if (has('bolsa_drenaje') && w.sng && w.sng.drenaje) add('colgar_drenaje', 'Colgar la bolsa de drenaje por debajo de la cintura');
      add('timbre', 'Dejar el timbre al alcance del paciente');
      add('acomodar', 'Ayudar a acomodarse / arreglar la ropa de cama');
      return A;
    }

    if (mano.length === 0) {
      add('inspeccionar', 'Inspeccionar');
      if (!['boca', 'nariz'].includes(region)) {
        add('palpar_sup', 'Palpar (superficial)');
        if (['abdomen', 'torax', 'cuello', 'precordio', 'piernas', 'genitales'].includes(region) || isBrazo) add('palpar_prof', 'Palpar (profunda)');
      }
      if (['torax', 'abdomen'].includes(region)) add('percutir', 'Percutir');
      if (region === 'torax') {
        add('contar_fr', 'Contar la frecuencia respiratoria (1 min)');
        add('girar', w.vista === 'posterior' ? 'Volver al paciente a la posición anterior' : 'Sentar / girar al paciente para valorar el tórax posterior');
        add('fremito', 'Valorar frémito (pedir que diga "treinta y tres")');
      }
      if (isBrazo) {
        add('pulso', 'Tomar pulso radial (1 min)');
        add('manilla', 'Verificar la manilla de identificación');
        add('llenado', 'Valorar llenado capilar');
        add('capital', 'Valorar el capital venoso (distal → proximal)');
        add('extender', 'Acomodar el brazo extendido y apoyado');
        add('elevar', 'Elevar el miembro');
        if (this.caso.tema === 'iv' && this.caso.ivPrevio && !w.iv.previo.retirado && region === w.iv.previo.region) add('maddox', 'Valorar el sitio del catéter (escala de Maddox)', { opciones: [[0, '0'], [1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']] });
        const cat = w.iv.cat;
        if (cat && cat.region === region && cat.fase === 'sinAguja' && !cat.retirado) {
          add('presion_sitio', 'Presión sobre el sitio de inserción');
        }
      }
      if (region === 'cuello') { add('pulso_carotideo', 'Palpar pulso carotídeo'); add('pedir_tragar', 'Pedir que trague saliva'); }
      if (region === 'nariz') add('permeabilidad', 'Verificar permeabilidad nasal (ocluir una narina y pedir que respire)');
      if (region === 'boca') { add('pedir_tragar', 'Pedir que trague'); add('pedir_toser', 'Pedir que tosa'); }
      if (['torax', 'abdomen', 'genitales', 'piernas'].includes(region) || isBrazo) {
        const k = region;
        add(w.expuesto[k] ? 'cubrir' : 'descubrir', w.expuesto[k] ? 'Cubrir la zona' : (region === 'genitales' ? 'Descubrir solo la zona genital' : 'Descubrir solo esta zona'));
      }
      if (region === 'genitales') {
        if (male) {
          add('retraer_prepucio', 'Retraer el prepucio');
          add('regresar_prepucio', 'Regresar el prepucio a su posición');
        } else add('separar_labios', 'Separar los labios con la mano no dominante');
      }
      if (region === 'cabeza') {
        const o2 = w.disp.find(d => d.tipo === 'o2');
        if (o2) {
          add('tubo_orejas', 'Pasar el tubo por detrás de las orejas y ajustar bajo el mentón');
          add('ajustar_mascarilla', 'Ajustar barra nasal y elástico');
          add('revisar_fugas', 'Revisar fugas (sobre todo hacia los ojos)');
        }
      }
      if (region === 'piernas') add('separar_piernas', 'Ayudar a flexionar y separar las piernas');
      // Retirar dispositivos
      w.disp.filter(d => d.region === region || (region === 'cabeza' && d.region === 'nariz')).forEach(d => add('retirar_disp', `Retirar: ${d.nombre}`, { disp: d.key }));
      if (isBrazo && w.iv.previo && !w.iv.previo.retirado && w.iv.previo.region === region) add('retirar_previo', 'Retirar el catéter anterior (presión con gasa)');
      add('acomodar', 'Ayudar a acomodarse');
      return A;
    }

    // ----- con ítems en la mano -----
    if (has('fonendoscopio')) {
      if (['torax', 'precordio', 'abdomen', 'cuello'].includes(region)) add('auscultar', 'Auscultar');
      if (region === 'abdomen' && has('jeringa_50') && w.sng && w.sng.insertada) add('verif_auscultacion', 'Auscultar el epigastrio mientras insufla 10–20 ml de aire');
      if (isBrazo && has('tensiometro')) add('pa', 'Tomar la presión arterial');
    }
    if (has('tensiometro') && isBrazo) add('pa', 'Tomar la presión arterial (con fonendoscopio en el pliegue)');
    if (has('pulsoximetro') && (isBrazo)) add('pulsox', 'Colocar el pulsioxímetro en el dedo');
    if (has('termometro') && (isBrazo || region === 'boca')) add('temp', 'Medir la temperatura');
    if (has('linterna') && ['nariz', 'boca', 'cabeza'].includes(region)) add('inspeccionar_linterna', 'Inspeccionar con linterna');

    // Oxigenoterapia
    const o2dev = mano.find(i => ITEMS[i.id].o2);
    if (o2dev) {
      const tipo = ITEMS[o2dev.id].o2;
      if (tipo === 'canula' && region === 'nariz') add('colocar_o2', 'Colocar las puntas en las narinas');
      if (tipo !== 'canula' && ['cabeza', 'nariz', 'boca'].includes(region)) add('colocar_o2', 'Colocar la mascarilla sobre nariz y boca');
    }
    if (has('gasas') && region === 'cabeza') add('proteger_presion', 'Proteger puntos de apoyo (orejas, puente nasal) con gasa');
    if ((has('ssn_10') || has('agua_destilada')) && ['nariz', 'boca'].includes(region)) add('hidratar_mucosas', 'Hidratar mucosas / higiene nasal y bucal');
    if (has('vaselina') && ['nariz', 'boca'].includes(region)) add('vaselina', 'Aplicar vaselina en mucosas');

    // Canalización
    if (has('torniquete') && isBrazo) {
      if (w.iv.torniquete && w.iv.torniquete.region === region) add('retirar_torniquete', 'Retirar (aflojar) el torniquete');
      else add('torniquete', 'Colocar el torniquete', { opciones: [['10cm', '≈10 cm por encima del sitio de punción'], ['2cm', 'Justo encima del sitio (2–3 cm)'], ['lejos', 'En la raíz del brazo (> 20 cm)']] });
    }
    if ((has('alcohol') || has('clorhexidina')) && isBrazo) add('antisepsia', 'Antisepsia de la piel', { opciones: [['circular', 'Circular del centro a la periferia'], ['rejilla', 'En rejilla'], ['vaiven', 'Vaivén sin dirección'], ['periferia', 'De la periferia al centro']] });
    if (has('alcohol', 'clorhexidina', 'jabon_quirurgico') && region === 'genitales' && has('gasas', 'gasas_esteriles', 'torundas')) add('higiene_genital', 'Higiene genital', { opciones: male ? [['correcta_m', 'Glande, pene y escroto con solución jabonosa y abundante agua; secar primero el glande'], ['rapida', 'Pasar una gasa húmeda rápida']] : [['descendente', 'Separar labios y limpiar en sentido descendente (pubis → ano)'], ['ascendente', 'Limpiar en sentido ascendente (ano → pubis)'], ['circular', 'Movimientos circulares']] });
    const cat = hasPref('cat_');
    if (cat && isBrazo) add('puncionar', 'Puncionar (abrir panel de canalización)', { ui: 'puncion' });
    if (isBrazo && w.iv.cat && w.iv.cat.region === region && w.iv.cat.fase === 'sinAguja' && !w.iv.cat.retirado) {
      if (has('jeringa_ssn')) add('permeabilizar', 'Conectar la jeringa con SSN y permeabilizar');
      if (has('conector')) add('conectar_conector', 'Conectar el conector libre de aguja');
      if (has('equipo_macro', 'equipo_micro')) add('conectar_equipo', 'Conectar el equipo de venoclisis');
      if (has('aposito')) add('fijar_aposito', 'Fijar con apósito transparente');
      if (has('esparadrapo')) add('fijar_esparadrapo', 'Fijar con esparadrapo');
      if (has('marcador')) add('rotular_cat', 'Rotular (fecha, hora, calibre, responsable)');
      if (has('gasas')) add('retirar_cateter', 'Retirar el catéter y hacer presión con gasa');
    }
    if (has('gasas') && isBrazo && w.iv.previo && !w.iv.previo.retirado && w.iv.previo.region === region) add('retirar_previo', 'Retirar el catéter anterior y hacer presión con gasa');

    // Sonda vesical
    const foley = hasPref('foley_');
    if (region === 'genitales') {
      if (has('lidocaina')) add('lidocaina_uretral', male ? 'Lidocaína intrauretral y esperar 3–5 min manteniendo la uretra cerrada' : 'Aplicar lidocaína jalea en el meato');
      if (has('campo_ojo')) add('campo_ojo', 'Colocar campo de ojo (fenestrado)');
      if (foley) add('insertar_foley', 'Insertar la sonda (abrir panel de sondaje)', { ui: 'foley' });
      if (has('bolsa_colectora') && w.foley && w.foley.insertada && !w.foley.conectada) add('conectar_bolsa', 'Conectar la sonda a la bolsa colectora');
      if (has('gasas', 'gasas_esteriles') && w.foley && w.foley.insertada) add('limpiar_zona', 'Limpiar y secar la zona');
    }
    if (region === 'piernas' && has('esparadrapo') && w.foley && w.foley.insertada) add('fijar_foley', 'Fijar la sonda a la piel (cara interna del muslo)');
    if (region === 'abdomen' && has('esparadrapo') && w.foley && w.foley.insertada) add('fijar_foley', 'Fijar la sonda a la piel (abdomen)');

    // Sonda gástrica
    const levin = hasPref('levin_');
    if (levin) {
      const m = this.inst(this.w.mano.find(u => this.inst(u).id === levin));
      const step = (m.medida || []).length;
      if (region === 'nariz') add('medir_sng', 'Medición: punta de la sonda en la nariz', { paso: 'nariz' });
      if (region === 'cabeza') add('medir_sng', 'Medición: llevar al lóbulo de la oreja', { paso: 'oreja' });
      if (region === 'torax' || region === 'abdomen') add('medir_sng', 'Medición: llevar al apéndice xifoides', { paso: 'xifoides' });
      if (region === 'nariz' || region === 'boca') add('insertar_sng', region === 'boca' ? 'Introducir por la boca (vía orogástrica) — abrir panel' : 'Introducir por la narina — abrir panel', { ui: 'sng' });
    }
    if (w.sng && w.sng.insertada && (region === 'nariz' || region === 'boca')) {
      if (has('jeringa_50') && !has('fonendoscopio')) add('aspirar', 'Aspirar contenido gástrico con la jeringa');
      if (has('jeringa_50')) add('lavar_sonda', 'Irrigar / lavar la sonda con agua');
      if (has('tiras_ph') && w.sng.aspirado) add('ph', 'Medir el pH del aspirado');
      if (has('esparadrapo')) add('fijar_sng', 'Fijar la sonda a la nariz sin presionar la piel');
      if (has('bolsa_drenaje')) add('conectar_drenaje', 'Conectar a la bolsa recolectora');
      if (has('marcador')) add('rotular_sng', 'Etiquetar con fecha y hora; registrar la profundidad (cm)');
    }
    if (has('marcador') && w.foley && w.foley.insertada && region === 'piernas') add('rotular_foley', 'Rotular la sonda (fecha, hora, calibre)');

    if (A.length === 0) add('nada', 'No hay acciones posibles con lo que tiene en la mano aquí');
    return A;
  }

  // Acciones al tocar un ítem en el inventario
  getItemActions(uid) {
    const i = this.inst(uid); if (!i) return [];
    const def = ITEMS[i.id];
    const A = [];
    const add = (id, label, extra = {}) => A.push({ id, label, ...extra });
    const enMano = this.w.mano.includes(uid);
    const otros = this.w.mano.filter(u => u !== uid).map(u => this.inst(u)).filter(Boolean);
    const otro = (...ids) => otros.find(o => ids.includes(o.id));
    if (def.tipo === 'epp') add('ponerse', 'Ponérselo');
    if (def.tipo === 'guantes') add('ponerse', 'Ponerse los guantes');
    if (i.id === 'jeringa_10') {
      add('cargar', 'Cargar la jeringa', { opciones: [['agua_destilada', '10 ml de agua destilada estéril'], ['ssn', '10 ml de SSN 0,9 %'], ['aire', '10 ml de aire']] });
    }
    if (i.id === 'jeringa_50') add('cargar50', 'Cargar la jeringa', { opciones: [['aire', '20 ml de aire'], ['agua', '60 ml de agua'], ['vaciar', 'Vaciar']] });
    if (i.id.startsWith('foley_')) {
      add('probar_balon', 'Pre-inflar el balón para probarlo (con jeringa cargada)');
      if (otro('lidocaina', 'lubricante')) add('lubricar_foley', 'Lubricar la sonda', { opciones: [['amplia', 'En una porción amplia de la sonda'], ['punta', 'Solo la punta']] });
    }
    if (i.id.startsWith('levin_')) {
      if (otro('lubricante', 'lidocaina', 'vaselina')) add('lubricar_sng', 'Lubricar el extremo distal');
      if (otro('marcador') || (i.medida && i.medida.length >= 3)) add('marcar_sng', 'Marcar la medida en la sonda (cm)', { num: true });
    }
    if (i.id === 'campo_esteril') add('abrir_campo', 'Abrir el campo estéril sobre la mesa');
    if (i.id === 'equipo_macro' || i.id === 'equipo_micro') if (otro('bolsa_ssn')) add('purgar', 'Conectar a la bolsa SSN y purgar el equipo');
    if (i.id.startsWith('cat_')) add('verificar_cat', 'Verificar integridad y girar el cilindro 360°');
    if (i.id === 'mascarilla_reservorio') add('llenar_reservorio', 'Llenar el reservorio antes de colocar (ocluir la válvula)');
    if (i.id === 'venturi') add('valvula', 'Elegir la válvula', { opciones: VENTURI.map(v => [v.fio2, `${v.fio2} % (${v.color}) — ${v.flujo[0] === v.flujo[1] ? v.flujo[0] : v.flujo.join('–')} L/min`]) });
    if (enMano) add('a_bandeja', 'Pasar a la bandeja'); else add('a_mano', 'Tomar en la mano');
    if (!def.generado) add('devolver', 'Devolver a su lugar');
    return A;
  }

  // ---------- aplicar evento ----------
  apply(ev) {
    this.log.push(ev);
    this.t = ev.t || 0;
    const fx = [];
    try { this._apply(ev, fx); } catch (e) { console.error('engine', e, ev); }
    return fx;
  }

  _contactoPaciente(fx, conItem) {
    const w = this.w;
    if (!this.contactos.length && !this.higienes.length) {
      this.penaliza('contacto_sin_higiene', 'Tocó al paciente sin higiene de manos previa', 'Higiene de manos ANTES del contacto con el paciente (momento 1 OMS).');
    }
    this.contactos.push(this.t);
    if (!w.guantes) this.contactosManos.push(this.t);
    if (!this.f('primer_contacto')) this.fact('primer_contacto');
    if (w.guantes === 'esteril' && !conItem) { /* contacto directo con estériles */ }
  }

  _contaminarSiEsteril(motivo, fx) {
    if (this.w.guantes === 'esteril' && !this.w.contaminado) {
      this.w.contaminado = true; this.fact('contamino_esteril');
      this.info(`Guantes estériles contaminados: ${motivo}`, 'Con guantes estériles solo se toca material estéril y el campo.');
      fx.push({ tipo: 'contaminado' });
    } else if (this.w.guantes === 'manejo' && this.f('primer_contacto') && !this.w.contaminado) {
      this.w.contaminado = true; fx.push({ tipo: 'contaminado' });
    }
  }

  _hallazgo(tec, region, sub) {
    const H = this.caso.hallazgos || {};
    const reg = region === 'torax' && this.w.vista === 'posterior' ? 'torax_post' : region;
    const keys = [`${tec}:${reg}:${sub}`, `${tec}:${reg}`, `${tec}:${region}`, `*:${reg}:${sub}`, `*:${reg}`];
    for (const k of keys) if (H[k]) return H[k];
    if (H[tec]) return H[tec];
    const def = {
      inspeccionar: 'Sin alteraciones visibles en la zona.', palpar_sup: 'Sin dolor ni masas a la palpación superficial.',
      palpar_prof: 'Sin masas ni dolor a la palpación profunda.', percutir: 'Sonido normal a la percusión.',
      llenado: 'Llenado capilar < 2 s.', capital: 'Venas visibles y palpables en antebrazo y brazo.', permeabilidad: 'Ambas narinas permeables.', fremito: 'Frémito vocal simétrico.', auscultar: reg.startsWith('torax') ? 'Murmullo vesicular conservado.' : reg === 'abdomen' ? 'Ruidos intestinales presentes.' : reg === 'precordio' ? 'Ruidos cardíacos rítmicos.' : 'Sin hallazgos.',
    };
    return def[tec] || 'Sin hallazgos relevantes.';
  }

  _apply(ev, fx) {
    const w = this.w, C = this.caso;
    const say = (texto, quien = 'hallazgo') => fx.push({ tipo: 'msg', quien, texto });
    switch (ev.tipo) {
      case 'sistema': {
        if (ev.accion === 'inicio') this.fact('inicio');
        if (ev.accion === 'fin') { w.terminado = true; this.fact('fin'); }
        break;
      }
      case 'pc': {
        if (ev.accion === 'orden') this.fact('leyo_orden');
        if (ev.accion === 'historia') {
          this.fact('leyo_historia');
          if (this.f('leyo_orden')) this.fact('reviso_orden_historia');
        }
        if (ev.accion === 'orden' && this.f('leyo_historia')) this.fact('reviso_orden_historia');
        this.entorno.push(this.t);
        this._contaminarSiEsteril('tocó el computador', fx);
        break;
      }
      case 'notas': w.notas = ev.texto || ''; if (w.notas.trim().length > 10) this.fact('notas'); break;
      case 'pae': w.pae = ev.pae; if (ev.pae && (ev.pae.nanda || ev.pae.dominio)) this.fact('pae'); break;
      case 'goteo': w.goteo = Number(ev.valor); this.fact('goteo_calculado', w.goteo); break;
      case 'entrega': {
        w.entrega = ev.texto || ''; this.fact('entrega');
        this._comunicacion(ev.texto || '', true);
        break;
      }
      case 'hablar': this._comunicacion(ev.texto || '', false, fx); break;
      case 'otra': {
        this.fact('otra_accion');
        const tx = (ev.texto || '').toLowerCase();
        if (C.trampa && C.trampa.regex && new RegExp(C.trampa.regex, 'i').test(tx)) this.fact('detecto_trampa');
        if (/asistencia|m[eé]dico|llamar/.test(tx)) this.fact('solicita_asistencia');
        break;
      }
      case 'zona': {
        if (['cortina'].includes(ev.zona)) this.entorno.push(this.t);
        if (ev.zona === 'mesa_sondas' && w.campo) break;
        if (!['lavamanos', 'dispensador', 'gel'].includes(ev.zona)) this._contaminarSiEsteril('tocó ' + ev.zona, fx);
        break;
      }
      case 'tomar': {
        const def = ITEMS[ev.item]; if (!def) break;
        if (w.mano.length >= 2 && w.bandeja.length >= 12) { say('Tiene las manos y la bandeja llenas.', 'sistema'); break; }
        const inst = this.newInst(ev.item);
        if (ev.dest === 'bandeja' && w.bandeja.length < 12) w.bandeja.push(inst.uid); else this.aMano(inst);
        if (w.guantes === 'esteril' && !def.esteril && !(ev.zona === 'mesa_sondas' && w.campo)) this._contaminarSiEsteril('tomó material no estéril', fx);
        this._material();
        break;
      }
      case 'mover': {
        const i = this.inst(ev.uid); if (!i) break;
        if (ev.a === 'mano') { if (w.mano.length < 2) { w.bandeja = w.bandeja.filter(u => u !== ev.uid); w.mano.push(ev.uid); } }
        else if (ev.a === 'bandeja') { if (w.bandeja.length < 12) { w.mano = w.mano.filter(u => u !== ev.uid); w.bandeja.push(ev.uid); } }
        else if (ev.a === 'devolver') { this.quitarDeInventario(ev.uid); }
        break;
      }
      case 'desechar': this._desechar(ev, fx); break;
      case 'ponerse': {
        const i = this.inst(ev.uid); if (!i) break;
        const def = ITEMS[i.id];
        if (def.tipo === 'epp') {
          w.epp[i.id] = true; this.fact('epp_' + i.id); this.quitarDeInventario(ev.uid);
          if (w.epp.gorro && w.epp.tapabocas && w.epp.gafas && w.epp.bata) this.fact('epp_completo');
          if (this.f('primer_contacto') == null || true) { /* orden evaluado por chequeo */ }
        } else if (def.tipo === 'guantes') {
          if (w.guantes) { say('Ya tiene guantes puestos. Retírelos primero.', 'sistema'); break; }
          w.guantes = i.id === 'guantes_esteriles' ? 'esteril' : 'manejo'; w.contaminado = false;
          this.quitarDeInventario(ev.uid);
          this.fact(w.guantes === 'esteril' ? 'guantes_esteriles' : 'guantes_manejo');
          this.fact('guantes');
          if (this.f('alergia_latex') != null) this.info('Paciente con alergia al látex: verifique que los guantes sean libres de látex.', 'Usar guantes de nitrilo / libres de látex.');
        }
        fx.push({ tipo: 'estado' });
        break;
      }
      case 'retirar_guantes': {
        if (!w.guantes) break;
        const g = this.newInst('guantes_usados', { usado: true });
        this.aMano(g);
        this.fact('retiro_guantes'); this.retirosGuantes.push(this.t);
        if (w.guantes === 'esteril') this.fact('retiro_esteriles');
        w.guantes = null; w.contaminado = false;
        fx.push({ tipo: 'estado' });
        break;
      }
      case 'higiene': {
        if (w.guantes) { say('Primero retire los guantes.', 'sistema'); break; }
        this.higienes.push(this.t);
        this.fact('higiene'); this.fact('higiene_' + ev.metodo);
        if (ev.juego) this.minijuegos.push({ t: this.t, metodo: ev.metodo, ...ev.juego });
        if (ev.metodo === 'alcohol' && this.fluidos.length && this.fluidos[this.fluidos.length - 1] > (this.higienes[this.higienes.length - 2] ?? -1)) {
          this.info('Higiene con alcohol tras contacto con fluidos', 'Si hubo contacto con fluidos o manos visiblemente sucias: lavado con agua y jabón.');
          this.fact('higiene_metodo_incorrecto');
        }
        if (C.tema === 'vesical' && ev.metodo === 'alcohol' && !this.f('inserta_sonda') && this.f('higiene_genital') && !this.f('guantes_esteriles')) {
          this.info('Higiene con alcohol antes del procedimiento estéril', 'Antes de un procedimiento estéril (sonda vesical): lavado con agua y jabón.');
        }
        fx.push({ tipo: 'estado' });
        break;
      }
      case 'cortina': w.cortina = !!ev.cerrada; if (w.cortina) this.fact('cortina_cerrada'); else this.fact('cortina_abierta'); this.entorno.push(this.t); this._contaminarSiEsteril('tocó la cortina', fx); fx.push({ tipo: 'estado' }); break;
      case 'cama': {
        this.entorno.push(this.t);
        this._contaminarSiEsteril('tocó la cama', fx);
        if (ev.accion === 'barandas') { w.barandas = !!ev.valor; this.fact(w.barandas ? 'barandas_arriba' : 'barandas_abajo'); }
        if (ev.accion === 'posicion') {
          w.posicion = ev.valor; this.fact('pos:' + ev.valor); this.fact('posiciono');
          if (w.sng && w.sng.insertando && !['semifowler', 'fowler', 'fowler_alto'].includes(ev.valor)) { /* */ }
        }
        if (ev.accion === 'cuello') { w.cuello = ev.valor; this.fact('cuello:' + ev.valor); }
        if (ev.accion === 'timbre') { w.timbre = true; this.fact('timbre'); }
        fx.push({ tipo: 'estado' });
        break;
      }
      case 'o2': this._o2(ev, fx); break;
      case 'item': this._itemAccion(ev, fx); break;
      case 'accion': this._accion(ev, fx); break;
      case 'evaluador': this._evaluador(ev, fx); break;
      default: break;
    }
    if (TEMAS[C.tema] && TEMAS[C.tema].onEvent) TEMAS[C.tema].onEvent(this, ev, fx);
    if (C.onEvent) C.onEvent(this, ev, fx);
  }

  _material() {
    if (this.f('material')) return;
    const req = this.caso.material || [];
    if (!req.length) return;
    const tengo = new Set([...this.w.mano, ...this.w.bandeja].map(u => this.inst(u)?.id));
    const ok = req.filter(grp => (Array.isArray(grp) ? grp : [grp]).some(id => tengo.has(id) || [...tengo].some(t => t && t.startsWith(id)))).length;
    if (ok / req.length >= 0.7) this.fact('material');
  }

  _comunicacion(texto, esEntrega, fx = []) {
    const tx = texto || '';
    const hit = (k) => RE[k].test(tx);
    if (hit('saludo')) this.fact('com_saludo');
    if (hit('presenta')) this.fact('com_presenta');
    if (hit('identifica')) this.fact('com_identifica');
    if (hit('explica')) this.fact('com_explica');
    if (hit('beneficio')) this.fact('com_beneficio');
    if (hit('consentimiento')) this.fact('com_consentimiento');
    if (hit('dudas')) this.fact('com_dudas');
    if (hit('trato')) this.fact('com_trato');
    if (hit('senal')) this.fact('com_senal');
    if (hit('alergias')) this.fact('com_alergias');
    if (hit('dominante')) this.fact('com_dominante');
    if (hit('educa') && (this.f('primer_contacto') != null || esEntrega)) this.fact('com_educa');
    if (hit('privacidad')) this.fact('com_privacidad');
    if (hit('eva')) this.fact('com_eva');
    if (hit('tragar')) { this.fact('pide_tragar'); if (this.w.sng && this.w.sng.insertando) this.w.sng.trago = true; }
    if (hit('tos')) { this.fact('pide_toser'); if (this.w.foley && this.w.flags.resistencia) { this.w.flags.resistenciaTos = true; } }
    if (/(asistencia|llamar al m[eé]dico|avisar al m[eé]dico|m[eé]dico de turno)/i.test(tx)) this.fact('solicita_asistencia');
    const C = this.caso;
    if (C.trampa && C.trampa.regex && new RegExp(C.trampa.regex, 'i').test(tx)) this.fact('detecto_trampa');
    if (!esEntrega) this.fact('hablo');
  }

  _desechar(ev, fx) {
    const w = this.w;
    const i = this.inst(ev.uid); if (!i) return;
    const def = ITEMS[i.id];
    const caneca = ev.caneca; // roja | negra | blanca | guardian
    const usado = i.usado || def.generado;
    const correcta = usado ? def.residuo : (def.residuo === 'guardian' ? 'guardian' : null);
    this.quitarDeInventario(ev.uid);
    this.fact('desecho');
    if (i.id === 'aguja') {
      if (caneca === 'guardian') this.fact('aguja_guardian');
      else this.falla('aguja_fuera', `Aguja desechada en la caneca ${caneca}`, 'La aguja va directo al guardián, nunca a otra caneca ni se reinserta.');
    }
    if (correcta && caneca !== correcta) {
      this.fact('residuo_error');
      this.penaliza('residuo_' + ev.uid, `Residuo en caneca equivocada: ${def.nombre} → ${caneca}`, `${def.nombre}: caneca ${correcta === 'guardian' ? 'guardián' : correcta} (roja: biológico; guardián: cortopunzantes; negra: ordinario; blanca: aprovechable).`);
    } else if (correcta) this.fact('residuo_ok');
    if (!usado && def.residuo === null) this.info(`Desechó equipo reutilizable (${def.nombre})`, 'El equipo reutilizable se limpia y se devuelve.');
    fx.push({ tipo: 'estado' });
  }

  _o2(ev, fx) {
    const w = this.w, o2 = w.o2;
    this.entorno.push(this.t);
    if (ev.accion === 'flujo') {
      o2.flujo = Number(ev.valor); this.fact('o2_flujo', o2.flujo);
      const d = w.disp.find(x => x.tipo === 'o2');
      if (d) this._evaluarO2(fx);
    }
    if (ev.accion === 'humid') {
      const liq = this.inst(ev.uid); if (!liq) return;
      o2.humid = ITEMS[liq.id].liquido || liq.id;
      this.fact('humid_lleno', o2.humid);
      if (o2.humid === 'agua_destilada') this.fact('humid_agua_destilada');
      else this.info(`Humidificador llenado con ${ITEMS[liq.id].nombre}`, 'El humidificador se llena con agua destilada estéril.');
    }
    if (ev.accion === 'conectar') {
      const dev = this.inst(ev.uid); if (!dev) return;
      dev.conectado = true; o2.conectado = dev.id;
      this.fact('o2_conectado');
      if (!o2.humid) this.fact('o2_sin_humid');
    }
    if (ev.accion === 'valvula') { o2.valvula = Number(ev.valor); this.fact('venturi_valvula', o2.valvula); this.fact('venturi_valvula:' + o2.valvula); }
    fx.push({ tipo: 'estado' });
  }

  _evaluarO2(fx) {
    const w = this.w, o2 = w.o2;
    const d = w.disp.find(x => x.tipo === 'o2'); if (!d) return;
    const f = o2.flujo;
    if (d.dev === 'reservorio') {
      if (f < 10) { d.colapsa = true; fx.push({ tipo: 'msg', quien: 'hallazgo', texto: 'El reservorio se colapsa en cada inspiración.' }); this.fact('reservorio_colapsa'); }
      else d.colapsa = false;
    }
    if (d.dev === 'simple' && f > 0 && f < 5) this.fact('simple_bajo_5');
    if (d.dev === 'canula' && f > 4) this.fact('canula_mas_4');
    if (d.dev === 'canula' && f > 0 && f <= 3) this.fact('canula_1_3');
    if (d.dev === 'canula' && f === 4) this.fact('canula_4');
    if (d.dev === 'venturi' && o2.valvula) {
      const v = VENTURI.find(x => x.fio2 === o2.valvula);
      if (v && f >= v.flujo[0] && f <= v.flujo[1]) this.fact('venturi_flujo_ok:' + o2.valvula);
    }
    if (d.dev === 'reservorio' && f >= 10 && f <= 15) this.fact('reservorio_flujo_ok');
    if (d.dev === 'simple' && f >= 5 && f <= 10) this.fact('simple_flujo_ok');
    // Efecto clínico (solo sugerencia; la evaluadora decide)
    const C = this.caso;
    if (C.o2 && this._o2Correcto()) { this.fact('o2_tratamiento_correcto'); fx.push({ tipo: 'sugerir_mejora' }); }
  }

  _o2Correcto() {
    const C = this.caso, w = this.w;
    const d = w.disp.find(x => x.tipo === 'o2'); if (!d || !C.o2) return false;
    const want = C.o2;
    const dev = w.flags.nuevaOrdenVenturi ? 'venturi' : want.dispositivo;
    if (d.dev !== dev) return false;
    if (!d.conectado) return false;
    const f = w.o2.flujo;
    if (dev === 'venturi') {
      const v = VENTURI.find(x => x.fio2 === (w.flags.nuevaOrdenVenturi || want.fio2));
      return w.o2.valvula === v.fio2 && f >= v.flujo[0] && f <= v.flujo[1];
    }
    return f >= want.flujo[0] && f <= want.flujo[1] && (dev !== 'reservorio' || d.reservorioLleno);
  }

  _itemAccion(ev, fx) {
    const w = this.w;
    const i = this.inst(ev.uid); if (!i) return;
    const say = (texto, quien = 'hallazgo') => fx.push({ tipo: 'msg', quien, texto });
    const otros = w.mano.filter(u => u !== ev.uid).map(u => this.inst(u)).filter(Boolean);
    const otro = (...ids) => otros.find(o => ids.includes(o.id));
    switch (ev.accion) {
      case 'cargar': i.carga = ev.params.opcion; i.vol = 10; this.fact('jeringa_cargada:' + i.carga); say(`Jeringa cargada con ${ev.params.opcion === 'agua_destilada' ? 'agua destilada estéril' : ev.params.opcion === 'ssn' ? 'SSN 0,9 %' : 'aire'} (10 ml).`, 'sistema'); break;
      case 'cargar50': i.carga = ev.params.opcion === 'vaciar' ? null : ev.params.opcion; break;
      case 'probar_balon': {
        const j = this.disponible(x => x.id === 'jeringa_10' && x.carga)[0];
        if (!j) { say('Necesita una jeringa de 10 ml cargada.', 'sistema'); break; }
        i.probado = true; this.fact('prueba_balon');
        say('El balón se infla de forma simétrica, sin fugas. Lo desinfla.', 'hallazgo');
        break;
      }
      case 'lubricar_foley': i.lubricado = ev.params.opcion; this.fact('lubrica_sonda', ev.params.opcion); if (ev.params.opcion === 'amplia') this.fact('lubrica_amplia'); break;
      case 'lubricar_sng': {
        const l = otro('lubricante', 'lidocaina', 'vaselina');
        i.lubricado = l ? l.id : true; this.fact('lubrica_sng');
        if (l && l.id === 'vaselina') { this.fact('lubrica_vaselina'); this.info('Lubricó la SNG con vaselina', 'Usar lubricante hidrosoluble o lidocaína jalea.'); }
        break;
      }
      case 'marcar_sng': {
        i.cm = Number(ev.params.valor); i.marcada = true; this.fact('marca_sng', i.cm);
        if (!(i.medida && i.medida.length >= 3)) this.fact('marca_sin_medir');
        break;
      }
      case 'abrir_campo': w.campo = true; this.quitarDeInventario(ev.uid); this.fact('campo_esteril'); this.newEnv(); fx.push({ tipo: 'estado' }); break;
      case 'purgar': i.purgado = true; this.fact('purga_equipo'); say('Equipo purgado, sin burbujas de aire.', 'sistema'); break;
      case 'verificar_cat': i.verificado = true; this.fact('integridad_cateter'); break;
      case 'llenar_reservorio': {
        if (this.w.o2.conectado !== 'mascarilla_reservorio' && !i.conectado) { say('El reservorio no se llena: la mascarilla no está conectada a la fuente de oxígeno.', 'hallazgo'); break; }
        if (this.w.o2.flujo < 10) { say('Con ese flujo el reservorio se llena muy lentamente y queda flácido.', 'hallazgo'); i.reservorioLleno = false; break; }
        i.reservorioLleno = true; this.fact('reservorio_lleno'); say('El reservorio queda completamente inflado.', 'hallazgo');
        break;
      }
      case 'valvula': i.valvula = Number(ev.params.opcion); this.w.o2.valvula = i.valvula; this.fact('venturi_valvula', i.valvula); this.fact('venturi_valvula:' + i.valvula); break;
      default: break;
    }
    fx.push({ tipo: 'estado' });
  }
  newEnv() { /* empaques generados */ const e = this.newInst('envolturas', { usado: true }); if (this.w.bandeja.length < 12) this.w.bandeja.push(e.uid); }

  _evaluador(ev, fx) {
    const w = this.w;
    const C = this.caso;
    if (ev.accion === 'monitor') { Object.assign(w.sv, ev.sv || {}); fx.push({ tipo: 'sv' }); }
    if (ev.accion === 'evento') {
      const def = eventosDelCaso(C).find(e => e.id === ev.id) || {};
      this.eventosEval.push({ t: this.t, id: ev.id, nombre: def.nombre || ev.id, esperado: def.esperado, respuesta: def.respuesta || [] });
      const fl = def.flag || ev.id;
      w.flags[fl] = def.valor ?? true;
      this.fact(ev.id); this.fact('evento:' + ev.id);
      if (def.nuevaOrdenVenturi) w.flags.nuevaOrdenVenturi = def.nuevaOrdenVenturi;
      if (def.sv) { Object.assign(w.sv, def.sv); fx.push({ tipo: 'sv' }); }
      fx.push({ tipo: 'evento', texto: def.mensaje || ev.texto || 'Evento' });
    }
    if (ev.accion === 'voz') fx.push({ tipo: 'msg', quien: 'paciente', texto: ev.texto });
  }

  _accion(ev, fx) {
    const w = this.w, C = this.caso;
    const say = (texto, quien = 'hallazgo') => fx.push({ tipo: 'msg', quien, texto });
    const { accion, region, sub } = ev;
    const p = ev.params || {};
    const reg = region === 'torax' && w.vista === 'posterior' ? 'torax_post' : region;
    const isBrazo = region === 'brazo_d' || region === 'brazo_i';
    const mano = w.mano.map(u => this.inst(u)).filter(Boolean);
    const get = (...ids) => mano.find(i => ids.includes(i.id) || ids.some(x => x.endsWith('_') && i.id.startsWith(x)));
    const male = C.sexo === 'M';

    if (region !== 'borde_cama' && accion !== 'nada') {
      this._contactoPaciente(fx, mano.length > 0);
      if (w.guantes === 'esteril' && !['genitales'].includes(region) && !accion.startsWith('foley_') && accion !== 'fijar_foley') this._contaminarSiEsteril('tocó ' + lugarTexto(region, sub, w.vista), fx);
    } else if (region === 'borde_cama') this.entorno.push(this.t);

    const exploratorias = ['inspeccionar', 'palpar_sup', 'palpar_prof', 'percutir', 'auscultar', 'fremito', 'inspeccionar_linterna'];
    if (exploratorias.includes(accion)) {
      const tec = accion === 'fremito' ? 'palpar_sup' : accion === 'inspeccionar_linterna' ? 'inspeccionar' : accion;
      this.fact('explora'); this.fact(`${tec}:${reg}`); if (sub) this.fact(`${tec}:${reg}:${sub}`);
      if (tec.startsWith('palpar')) { this.fact(`palpar:${reg}`); if (sub) this.fact(`palpar:${reg}:${sub}`); }
      if (accion === 'fremito') this.fact('fremito');
      // expuesta?
      if (['torax', 'abdomen'].includes(region) && !w.expuesto[region] && tec !== 'inspeccionar') this.fact('explora_sin_descubrir');
      if (accion === 'inspeccionar' && ['torax', 'abdomen'].includes(region) && !w.expuesto[region]) { say('La zona está cubierta por la ropa/sábana.', 'hallazgo'); return; }
      const key = accion === 'fremito' ? 'fremito' : tec;
      say(this._hallazgo(key, region, sub));
      if (C.dolorEn && accion.startsWith('palpar') && C.dolorEn.includes(`${reg}:${sub}`)) {
        this.fact('palpa_zona_dolorosa');
        fx.push({ tipo: 'msg', quien: 'paciente', texto: accion === 'palpar_prof' ? '¡Ay! ¡Ahí me duele mucho, sobre todo cuando suelta!' : '¡Ay, ahí me duele!' });
      }
      if (region === 'abdomen' && accion.startsWith('palpar')) {
        // registrar zona dolorosa al final
        if (C.dolorEn && !C.dolorEn.includes(`${reg}:${sub}`) && this.f('palpa_zona_dolorosa')) this.fact('palpa_despues_de_dolorosa');
      }
      return;
    }

    switch (accion) {
      case 'contar_fr': w.medidos.fr = true; this.fact('sv_fr'); say(`Frecuencia respiratoria: ${w.sv.fr} rpm.`); this._svCompletos(); break;
      case 'pulso': w.medidos.fc = true; this.fact('sv_fc'); say(`Pulso radial: ${w.sv.fc} lpm, ${w.sv.fc > 100 ? 'taquicárdico' : 'rítmico'}.`); this._svCompletos(); break;
      case 'pulso_carotideo': say(`Pulso carotídeo presente, ${w.sv.fc} lpm.`); break;
      case 'pa': {
        if (!get('tensiometro')) break;
        w.medidos.pa = true; this.fact('sv_pa'); say(`Presión arterial: ${w.sv.pa} mmHg.`); this._svCompletos(); break;
      }
      case 'pulsox': {
        const it = get('pulsoximetro'); if (!it) break;
        this.quitarDeInventario(it.uid);
        w.disp.push({ key: it.uid, tipo: 'pulsox', region, sub: 'dedo', nombre: 'Pulsioxímetro', uid: it.uid });
        w.medidos.spo2 = true; w.medidos.fc = true; this.fact('sv_spo2'); this.fact('sv_fc'); this.fact('pulsox_continuo');
        say(`SpO2 ${w.sv.spo2} % · FC ${w.sv.fc} lpm (en el monitor).`); this._svCompletos();
        fx.push({ tipo: 'sv' });
        break;
      }
      case 'temp': w.medidos.t = true; this.fact('sv_t'); say(`Temperatura: ${w.sv.t} °C.`); this._svCompletos(); break;
      case 'girar': w.vista = w.vista === 'posterior' ? 'anterior' : 'posterior'; this.fact('girar'); fx.push({ tipo: 'estado' }); say(w.vista === 'posterior' ? 'El paciente se sienta: ahora puede valorar el tórax posterior.' : 'El paciente vuelve a recostarse.', 'sistema'); break;
      case 'manilla': this.fact('manilla'); say(`Manilla: ${C.paciente.nombre} · ${C.paciente.doc} · ${C.paciente.edad} años.${C.paciente.alergiasManilla ? ' ' + C.paciente.alergiasManilla : ''}`); break;
      case 'llenado': say(this._hallazgo('llenado', region, sub) || 'Llenado capilar < 2 s.'); this.fact('llenado_capilar'); break;
      case 'capital': {
        this.fact('capital_venoso'); this.fact('capital:' + region);
        if (!this.f('primer_brazo_explorado')) this.fact('primer_brazo_explorado', region);
        say(this._hallazgo('capital', region, sub));
        break;
      }
      case 'extender': this.fact('brazo_extendido'); break;
      case 'elevar': this.fact('elevar_miembro'); break;
      case 'maddox': {
        this.fact('maddox', Number(p.opcion));
        say(`Registra Maddox ${p.opcion}.`, 'sistema');
        break;
      }
      case 'permeabilidad': this.fact('permeabilidad_nasal'); say(this._hallazgo('permeabilidad', region, sub) || 'Ambas narinas permeables; la derecha parece de mayor diámetro.'); break;
      case 'pedir_tragar': this.fact('pide_tragar'); if (w.sng && w.sng.insertando) w.sng.trago = true; say('El paciente traga.', 'paciente'); break;
      case 'pedir_toser': this.fact('pide_toser'); say('*tose*', 'paciente'); break;
      case 'descubrir': case 'cubrir': {
        w.expuesto[region] = accion === 'descubrir';
        if (accion === 'descubrir') {
          this.fact('descubre:' + region); this.fact('expone_zona');
          if (region === 'genitales') {
            this.fact('descubre_genitales');
            if (!w.cortina) this.penaliza('genitales_sin_cortina', 'Expuso los genitales sin cerrar la cortina', 'Cerrar la cortina y exponer solo la zona genital (intimidad).');
          }
          const otras = Object.keys(w.expuesto).filter(k => w.expuesto[k]);
          if (otras.length >= 3) this.info('Varias zonas descubiertas al mismo tiempo', 'Exponer solo la zona a valorar o intervenir.');
        } else this.fact('cubre:' + region);
        fx.push({ tipo: 'estado' });
        break;
      }
      case 'retraer_prepucio': if (w.foley) w.foley.prepucio = 'retraido'; else w.flags.prepucio = 'retraido'; this.fact('retrae_prepucio'); break;
      case 'regresar_prepucio': if (w.foley) w.foley.prepucio = 'normal'; w.flags.prepucio = 'normal'; this.fact('regresa_prepucio'); break;
      case 'separar_labios': this.fact('separa_labios'); break;
      case 'separar_piernas': this.fact('pos:supino_piernas'); w.posicion = 'supino_piernas'; fx.push({ tipo: 'estado' }); break;
      case 'tubo_orejas': this.fact('tubo_orejas'); break;
      case 'ajustar_mascarilla': this.fact('ajusta_mascarilla'); break;
      case 'revisar_fugas': this.fact('revisa_fugas'); say('Sin fugas de aire hacia los ojos.'); break;
      case 'acomodar': this.fact('acomoda'); say('El paciente queda cómodo.', 'sistema'); break;
      case 'timbre': w.timbre = true; this.fact('timbre'); break;
      case 'retirar_disp': {
        const d = w.disp.find(x => x.key === p.disp || x.key === ev.disp); if (!d) break;
        w.disp = w.disp.filter(x => x !== d);
        this.fact('retira_disp:' + d.tipo);
        if (d.uid && this.inst(d.uid)) { const inst = this.inst(d.uid); inst.usado = d.tipo !== 'pulsox'; this.aMano(inst); }
        if (d.tipo === 'o2') say('Retira el dispositivo de oxígeno.', 'sistema');
        fx.push({ tipo: 'estado' });
        break;
      }
      case 'colocar_o2': {
        const dev = mano.find(i => ITEMS[i.id].o2); if (!dev) break;
        const tipo = ITEMS[dev.id].o2;
        const prev = w.disp.find(x => x.tipo === 'o2'); if (prev) { say('Ya hay un dispositivo de oxígeno puesto. Retírelo primero.', 'sistema'); break; }
        this.quitarDeInventario(dev.uid);
        const d = { key: dev.uid, uid: dev.uid, tipo: 'o2', dev: tipo, region: tipo === 'canula' ? 'nariz' : 'cabeza', nombre: ITEMS[dev.id].nombre, conectado: !!dev.conectado, reservorioLleno: !!dev.reservorioLleno };
        w.disp.push(d);
        this.fact('o2_colocado'); this.fact('o2_dispositivo:' + tipo, tipo);
        if (!this.f('sv_spo2') && !this.f('valora_resp_antes')) this.fact('o2_sin_valorar');
        if (tipo === 'reservorio' && !dev.reservorioLleno) { this.fact('reservorio_sin_llenar'); }
        if (!dev.conectado) say('El paciente no siente flujo de aire por el dispositivo.', 'hallazgo');
        this._evaluarO2(fx);
        fx.push({ tipo: 'estado' });
        break;
      }
      case 'proteger_presion': this.fact('proteger_presion'); break;
      case 'hidratar_mucosas': this.fact('hidrata_mucosas'); break;
      case 'vaselina': this.fact('vaselina_mucosas'); this.info('Aplicó vaselina en mucosas con oxígeno', 'Hidratar mucosas solo con soluciones acuosas; nunca vaselina ni aceite.'); break;
      case 'torniquete': {
        w.iv.torniquete = { region, sub, distancia: p.opcion, t: this.t };
        this.fact('torniquete'); this.fact('torniquete:' + p.opcion);
        if (w.iv.antisepsia && w.iv.antisepsia.region === region) this.fact('torniquete_tras_antisepsia');
        fx.push({ tipo: 'estado' });
        break;
      }
      case 'retirar_torniquete': {
        w.iv.torniquete = null; this.fact('retira_torniquete');
        if (w.iv.cat && w.iv.cat.fase !== 'pre') w.iv.cat.torniqueteRetirado = true;
        fx.push({ tipo: 'estado' });
        break;
      }
      case 'antisepsia': {
        const ag = get('clorhexidina', 'alcohol');
        w.iv.antisepsia = { region, sub, tecnica: p.opcion, agente: ag && ag.id, t: this.t }; w.iv.palpoTrasAntisepsia = false;
        this.fact('antisepsia'); this.fact('antisepsia:' + p.opcion);
        if (['circular', 'rejilla'].includes(p.opcion)) this.fact('antisepsia_ok');
        if (this.f('alergia_chx') != null && ag && ag.id === 'clorhexidina') this.falla('chx_alergia', 'Usó clorhexidina en paciente alérgico', 'Ante alergia revelada, cambiar a otro antiséptico (alcohol).');
        this.newGasaUsada();
        break;
      }
      case 'higiene_genital': {
        this.fact('higiene_genital', p.opcion);
        if (['correcta_m', 'descendente'].includes(p.opcion)) this.fact('higiene_genital_ok');
        this.fluidos.push(this.t); this.newGasaUsada();
        if (!w.guantes) this.penaliza('sin_guantes_genital', 'Higiene genital sin guantes', 'Usar guantes de manejo para la higiene genital.');
        if (w.contaminado === false && w.guantes) { w.contaminado = true; fx.push({ tipo: 'contaminado' }); }
        break;
      }
      case 'campo_ojo': { const it = get('campo_ojo'); if (it) this.quitarDeInventario(it.uid); w.campoOjo = true; this.fact('campo_ojo'); fx.push({ tipo: 'estado' }); break; }
      case 'lidocaina_uretral': this.fact('lidocaina_uretral'); if (male) this.fact('lidocaina_espera'); if (this.f('alergia_lido') != null) this.falla('lido_alergia', 'Usó lidocaína en paciente alérgico', 'Ante alergia a la lidocaína, usar lubricante hidrosoluble estéril sin anestésico.'); break;
      case 'presion_sitio': this.fact('presion_sitio'); break;
      case 'retirar_previo': {
        w.iv.previo.retirado = true; this.fact('retira_cateter_ant'); this.fluidos.push(this.t);
        if (!w.guantes) this.penaliza('retiro_sin_guantes', 'Retiró el catéter sin guantes', 'Retirar el catéter con guantes, hacer presión con gasa y desechar en la roja.');
        const c = this.newInst('cateter_retirado', { usado: true }); this.aMano(c);
        say('Retira el catéter: punta íntegra. Hace presión con gasa; sin sangrado.', 'hallazgo');
        fx.push({ tipo: 'estado' });
        break;
      }
      case 'puncionar': this._puncion(ev, fx); break;
      case 'iv': this._ivPaso(ev, fx); break;
      case 'permeabilizar': {
        const cat = w.iv.cat; const j = get('jeringa_ssn'); if (!cat || !j) break;
        this.quitarDeInventario(j.uid); j.usado = true; this.aMano(j);
        if (w.iv.torniquete) { say('¡Me arde! Se está hinchando…', 'paciente'); this.fact('permeabiliza_con_torniquete'); cat.infiltrado = true; break; }
        if (w.flags.infiltracion) { say('Me duele y se está hinchando alrededor del catéter.', 'paciente'); cat.infiltrado = true; this.fact('detecta_infiltracion'); break; }
        cat.permeable = true; this.fact('permeabiliza');
        say('La solución avanza sin resistencia; sin dolor ni edema.');
        break;
      }
      case 'conectar_conector': { const it = get('conector'); this.quitarDeInventario(it.uid); w.iv.cat.conectado = 'conector'; this.fact('conecta'); break; }
      case 'conectar_equipo': {
        const it = get('equipo_macro', 'equipo_micro'); this.quitarDeInventario(it.uid);
        w.iv.cat.conectado = it.id; this.fact('conecta'); this.fact('conecta_equipo');
        if (!it.purgado) { this.fact('equipo_sin_purgar'); this.falla('sin_purgar', 'Conectó un equipo sin purgar', 'Purgar el equipo antes de conectarlo (evitar embolismo aéreo).'); }
        say('Infusión pasando.', 'sistema');
        break;
      }
      case 'fijar_aposito': { const it = get('aposito'); this.quitarDeInventario(it.uid); w.iv.cat.fijado = true; this.fact('fija_aposito'); this.newEnv(); fx.push({ tipo: 'estado' }); break; }
      case 'fijar_esparadrapo': {
        const it = get('esparadrapo');
        if (w.iv.cat && region.startsWith('brazo')) { w.iv.cat.fijado = 'esparadrapo'; this.fact('fija_esparadrapo_cat'); }
        break;
      }
      case 'rotular_cat': w.iv.cat.rotulado = true; this.fact('rotula_cat'); break;
      case 'retirar_cateter': {
        const cat = w.iv.cat; cat.retirado = true; this.fact('retira_cateter'); this.fluidos.push(this.t);
        w.disp = w.disp.filter(d => d.tipo !== 'cateter');
        const c = this.newInst('cateter_retirado', { usado: true }); this.aMano(c);
        if (w.flags.infiltracion) this.fact('retira_por_infiltracion');
        say('Retira el catéter y hace presión con gasa.', 'sistema');
        fx.push({ tipo: 'estado' });
        break;
      }
      case 'insertar_foley': case 'foley': this._foley(ev, fx); break;
      case 'conectar_bolsa': { const it = get('bolsa_colectora'); w.foley.conectada = true; this.fact('conecta_bolsa'); w.foley.bolsaUid = it.uid; if (w.foley.balon && this.f('orina_fluye')) say('La orina drena a la bolsa: clara, amarilla.', 'hallazgo'); break; }
      case 'colgar_bolsa': { const it = get('bolsa_colectora'); this.quitarDeInventario(it.uid); w.disp.push({ key: it.uid, tipo: 'bolsa', region: 'borde_cama', nombre: 'Bolsa colectora' }); this.fact('bolsa_bajo'); fx.push({ tipo: 'estado' }); break; }
      case 'limpiar_zona': this.fact('limpia_zona'); this.newGasaUsada(); break;
      case 'fijar_foley': this.fact('fija_sonda'); break;
      case 'rotular_foley': this.fact('rotula_foley'); break;
      case 'medir_sng': {
        const s = get('levin_'); if (!s) break;
        s.medida = s.medida || [];
        const orden = ['nariz', 'oreja', 'xifoides'];
        const paso = ev.paso || p.paso;
        if (paso === 'nariz') s.medida = ['nariz'];
        else if (s.medida.length && orden[s.medida.length] === paso) s.medida.push(paso);
        else { s.medida = []; say('La medición se reinicia (orden: nariz → lóbulo de la oreja → apéndice xifoides).', 'sistema'); }
        if (s.medida.length === 3) { this.fact('medicion_sng'); say(`Medición completa: ${C.sngCm || 50} cm. Marque la sonda.`, 'sistema'); }
        if (w.guantes !== 'manejo' && w.guantes !== 'esteril') this.fact('sng_sin_guantes');
        break;
      }
      case 'insertar_sng': case 'sng': this._sng(ev, fx); break;
      case 'aspirar': {
        if (!w.sng || !w.sng.insertada) break;
        this.fact('verif_aspirado'); w.sng.aspirado = true; this.fluidos.push(this.t);
        say(w.sng.enVia === 'respiratoria' ? 'No obtiene contenido; el paciente tose.' : (C.aspirado || 'Obtiene contenido gástrico verde-bilioso.'));
        break;
      }
      case 'verif_auscultacion': {
        this.fact('verif_auscultacion');
        say(w.sng && w.sng.enVia === 'respiratoria' ? 'No se escucha el burbujeo en epigastrio.' : 'Se escucha un burbujeo (gorgoteo) en el epigastrio al insuflar el aire.');
        break;
      }
      case 'ph': this.fact('verif_ph'); say(`Tira de pH: ${C.ph || 4}.`); break;
      case 'lavar_sonda': this.fact('lavado_sonda'); say('La sonda queda permeable.'); break;
      case 'fijar_sng': w.sng.fijada = true; this.fact('fija_sng'); if (!(this.f('verif_aspirado') && this.f('verif_auscultacion'))) this.falla('fijar_sin_verificar', 'Fijó la SNG sin verificar la posición (auscultación + aspirado)', 'Verificar ubicación gástrica con ambos métodos antes de fijar o usar la sonda.'); fx.push({ tipo: 'estado' }); break;
      case 'conectar_drenaje': { const it = get('bolsa_drenaje'); w.sng.drenaje = true; this.fact('conecta_drenaje'); if (!(this.f('verif_aspirado') && this.f('verif_auscultacion'))) this.falla('usar_sin_verificar', 'Conectó/usó la SNG sin verificar la posición', 'Verificar ubicación gástrica (auscultación + aspirado) antes de usar la sonda.'); break; }
      case 'colgar_drenaje': { const it = get('bolsa_drenaje'); this.quitarDeInventario(it.uid); this.fact('drenaje_bajo'); w.disp.push({ key: it.uid, tipo: 'bolsa', region: 'borde_cama', nombre: 'Bolsa de drenaje' }); fx.push({ tipo: 'estado' }); break; }
      case 'rotular_sng': this.fact('rotula_sng'); break;
      case 'colgar': break;
      default: break;
    }
  }

  newGasaUsada() {
    if (this.w.mano.some(u => this.inst(u)?.id === 'gasas_usadas') || this.w.bandeja.some(u => this.inst(u)?.id === 'gasas_usadas')) return;
    const g = this.newInst('gasas_usadas', { usado: true });
    if (this.w.bandeja.length < 12) this.w.bandeja.push(g.uid);
  }

  _svCompletos() {
    const m = this.w.medidos;
    if (m.pa && m.fc && m.fr && m.t && m.spo2) this.fact('sv_completos');
    if (m.fr || m.spo2) this.fact('valora_resp_antes');
  }

  // ---------- Canalización ----------
  _puncion(ev, fx) {
    const w = this.w, C = this.caso, p = ev.params || {};
    const say = (texto, quien = 'hallazgo') => fx.push({ tipo: 'msg', quien, texto });
    const catInst = this.w.mano.map(u => this.inst(u)).find(i => i && i.id.startsWith('cat_'));
    if (!catInst) return;
    const region = ev.region, sub = ev.sub;
    this.fact('puncion'); this.asepticas.push(this.t); this.fluidos.push(this.t);
    this.fact('inicio_procedimiento');
    this._checkInicioProcedimiento();
    if (!w.guantes) this.penaliza('puncion_sin_guantes', 'Punción sin guantes', 'Colocarse guantes antes de puncionar.');
    if (C.ivContraindicado && C.ivContraindicado.region === region) this.falla('brazo_contraindicado', `Punción en brazo contraindicado (${C.ivContraindicado.motivo})`, `No puncionar el ${region === 'brazo_i' ? 'brazo izquierdo' : 'brazo derecho'}: ${C.ivContraindicado.motivo}.`);
    if (['pliegue_codo'].includes(sub)) this.info('Punción en zona de flexión', 'Preferir venas del antebrazo o el brazo; evitar zonas de flexión.');
    if (sub === 'dorso_mano' && !(C.dorsoManoAceptable)) this.info('Punción en el dorso de la mano como primera opción', 'El dorso de la mano no es la primera opción (más flebitis); preferir antebrazo o brazo.');
    const ang = Number(p.angulo);
    if (ang > 45) this.info(`Ángulo de punción ${ang}°`, 'Bisel hacia arriba, ángulo de 15–30° (hasta 45° aceptable).');
    if (p.bisel !== 'arriba') this.info('Bisel hacia abajo', 'Bisel hacia arriba.');
    if (!w.iv.antisepsia || w.iv.antisepsia.region !== region) this.info('Punción sin antisepsia del sitio', 'Antisepsia circular del centro a la periferia (o en rejilla) sin volver a palpar.');
    if (w.iv.palpoTrasAntisepsia) this.info('Palpó el sitio después de la antisepsia', 'No volver a palpar después de la antisepsia.');
    if (!catInst.verificado) this.fact('cat_sin_verificar');
    this.quitarDeInventario(catInst.uid);
    w.iv.cat = { uid: catInst.uid, id: catInst.id, calibre: ITEMS[catInst.id].calibre, region, sub, vena: p.vena, angulo: ang, bisel: p.bisel, fase: 'puncion', torniquete: !!w.iv.torniquete, presion: false };
    w.disp = w.disp.filter(d => d.tipo !== 'cateter');
    w.disp.push({ key: 'cat', tipo: 'cateter', region, sub, nombre: `Catéter ${ITEMS[catInst.id].calibre}G (${lugarTexto(region, sub)})` });
    this.fact('angulo', ang); this.fact('calibre', ITEMS[catInst.id].calibre);
    if (ang >= 15 && ang <= 30 && p.bisel === 'arriba') this.fact('angulo_ok');
    else if (ang > 30 && ang <= 45 && p.bisel === 'arriba') this.fact('angulo_aceptable');
    const okCal = (C.calibres || []).includes(ITEMS[catInst.id].calibre);
    if (okCal) this.fact('calibre_ok');
    say('Punciona la piel.', 'sistema');
    if (!w.iv.torniquete) say('La vena no se distiende bien.', 'hallazgo');
    fx.push({ tipo: 'estado' });
    fx.push({ tipo: 'ui', ui: 'iv_pasos' });
  }

  _ivPaso(ev, fx) {
    const w = this.w, cat = w.iv.cat; if (!cat) return;
    const say = (texto, quien = 'hallazgo') => fx.push({ tipo: 'msg', quien, texto });
    const paso = (ev.params || {}).paso;
    switch (paso) {
      case 'retorno':
        if (cat.angulo > 50 || !cat.torniquete) { say('No se observa retorno venoso en la cámara.'); cat.sinRetorno = true; }
        else { say('Se observa retorno venoso en la cámara de flujo.'); cat.fase = 'retorno'; this.fact('retorno'); }
        break;
      case 'avanzar':
        if (cat.fase !== 'retorno') { say('El catéter no progresa bien.'); this.fact('avanza_sin_retorno'); break; }
        cat.fase = 'avanzado'; this.fact('avanza'); say('Baja el ángulo casi paralelo a la piel y avanza el catéter manteniendo la tracción de la piel.', 'sistema');
        break;
      case 'torniquete':
        if (w.iv.torniquete) { w.iv.torniquete = null; this.fact('retira_torniquete'); cat.torniqueteRetirado = true; if (cat.fase === 'sinAguja') this.fact('torniquete_tarde'); }
        break;
      case 'presion': cat.presion = true; this.fact('presion_digital'); break;
      case 'aguja': {
        if (cat.fase === 'sinAguja') break;
        if (!cat.presion) { say('Sale un poco de sangre por el catéter y mancha la sábana.', 'hallazgo'); this.fact('sangrado'); }
        if (w.iv.torniquete) { say('Sale sangre a presión por el catéter.', 'hallazgo'); this.fact('sangrado'); }
        cat.fase = 'sinAguja'; this.fact('retira_aguja');
        const ag = this.newInst('aguja', { usado: true }); this.aMano(ag);
        if (w.mano.indexOf(ag.uid) < 0 && w.bandeja.indexOf(ag.uid) >= 0) this.info('Aguja dejada en la bandeja', 'Aguja directo al guardián.');
        break;
      }
      case 'reinsertar':
        this.falla('reinserta_aguja', 'Reinsertó la aguja en el catéter', 'Nunca reinsertar la aguja en el catéter (riesgo de cortar el catéter y embolia).');
        break;
      case 'fallida':
        this.fact('puncion_fallida'); cat.retirado = true; w.disp = w.disp.filter(d => d.tipo !== 'cateter');
        if (cat.fase !== 'sinAguja') { const ag = this.newInst('aguja', { usado: true }); this.aMano(ag); }
        say('Retira el catéter y hace presión con gasa.', 'sistema');
        w.iv.cat = null;
        break;
      default: break;
    }
    fx.push({ tipo: 'estado' });
  }

  _checkInicioProcedimiento() {
    if (this._inicioChecked) return; this._inicioChecked = true;
    if (!this.f('com_identifica') || !this.f('manilla')) this.penaliza('proc_sin_identificar', 'Inició el procedimiento sin identificar al paciente (nombre y apellidos + manilla)', 'Preguntar nombre y apellidos y verificar la manilla antes del procedimiento.');
    if (!this.f('com_explica')) this.penaliza('proc_sin_explicar', 'Inició el procedimiento sin explicarlo', 'Explicar el procedimiento, beneficios y riesgos, y obtener el consentimiento.');
    this._material();
  }

  // ---------- Sonda vesical ----------
  _foley(ev, fx) {
    const w = this.w, C = this.caso, p = ev.params || {};
    const say = (texto, quien = 'hallazgo') => fx.push({ tipo: 'msg', quien, texto });
    const male = C.sexo === 'M';
    if (ev.accion === 'insertar_foley') {
      if (!w.foley) {
        const s = w.mano.map(u => this.inst(u)).find(i => i && i.id.startsWith('foley_'));
        if (!s) return;
        w.foley = { uid: s.uid, id: s.id, fr: ITEMS[s.id].fr, probado: !!s.probado, lubricado: s.lubricado, insertada: false, cm: 0, orina: false, balon: null, conectada: false, prepucio: w.flags.prepucio || 'normal' };
        this.quitarDeInventario(s.uid);
        w.disp.push({ key: 'foley', tipo: 'foley', region: 'genitales', nombre: `Sonda Foley ${w.foley.fr} Fr` });
        this.fact('foley_fr', w.foley.fr);
        if (w.foley.fr >= 14 && w.foley.fr <= 18) this.fact('foley_calibre_ok');
      }
      fx.push({ tipo: 'ui', ui: 'foley' });
      fx.push({ tipo: 'estado' });
      return;
    }
    const f = w.foley; if (!f) return;
    const paso = p.paso;
    const limite = male ? 18 : 6; // cm a los que fluye la orina
    const ok = (k) => this.fact(k);
    switch (paso) {
      case 'traccion': f.traccion = true; ok('traccion_pene'); break;
      case 'introducir': {
        const cm = Number(p.cm || 0);
        if (!f.insertada) {
          this.fact('inserta_sonda'); this.asepticas.push(this.t); this.fact('inicio_procedimiento'); this._checkInicioProcedimiento();
          if (w.contaminado) this.falla('contamina_continua', 'Contaminó los guantes/la sonda y continuó con la inserción', 'Si se contamina el campo, los guantes o la sonda: detenerse, desechar y reiniciar con material estéril.');
          if (w.guantes !== 'esteril') this.falla('foley_sin_esteriles', 'Insertó la sonda vesical sin guantes estériles', 'Técnica estéril: guantes estériles nuevos tras la higiene genital.');
          if (!w.cortina) this.penaliza('genitales_sin_cortina', 'Procedimiento en genitales sin cortina', 'Cerrar la cortina y exponer solo la zona genital.');
          if (!f.lubricado && !this.f('lidocaina_uretral')) { say('¡Ay, me arde mucho!', 'paciente'); }
          if (male && f.prepucio !== 'retraido') this.info('Inserción sin retraer el prepucio', 'Retraer el prepucio antes de la limpieza y la inserción.');
          if (male && !f.traccion) this.info('Inserción sin colocar el pene perpendicular con tracción hacia arriba', 'Pene perpendicular al cuerpo con tracción suave hacia arriba.');
        }
        f.insertada = true;
        if (w.flags.resistencia && !w.flags.resistenciaTos && cm >= 14 && male) { f.cm = 14; say('Siente resistencia al paso de la sonda (esfínter).'); this.fact('resistencia_encontrada'); break; }
        f.cm = Math.max(f.cm, cm);
        if (f.cm >= limite && !f.orina) { f.orina = true; ok('orina_fluye'); this.fluidos.push(this.t); say('Empieza a fluir orina por la sonda.', 'hallazgo'); fx.push({ tipo: 'anim', anim: 'orina' }); }
        else if (!f.orina) say(`Sonda introducida ${f.cm} cm. No hay salida de orina aún.`, 'sistema');
        else say(`Sonda introducida ${f.cm} cm.`, 'sistema');
        if (f.orina && f.cm >= limite + (male ? 4 : 5)) ok('profundiza');
        break;
      }
      case 'profundizar': if (f.orina) { f.cm += male ? 4 : 5; ok('profundiza'); say(male ? 'Avanza hasta la bifurcación.' : 'Profundiza 5 cm más.', 'sistema'); } else say('Aún no fluye orina.', 'sistema'); break;
      case 'tos': ok('pide_toser'); if (w.flags.resistencia) { w.flags.resistenciaTos = true; ok('resistencia_tos'); say('*tose* … la sonda pasa el esfínter.', 'hallazgo'); } else say('*tose*', 'paciente'); break;
      case 'asistencia': ok('solicita_asistencia'); say('Detiene el procedimiento y solicita asistencia médica.', 'sistema'); break;
      case 'inflar': {
        const j = this.disponible(x => x.id === 'jeringa_10' && x.carga)[0];
        if (!j) { say('Necesita una jeringa de 10 ml cargada.', 'sistema'); break; }
        f.balon = j.carga; j.carga = null; j.usado = true;
        ok('infla_balon');
        if (!f.orina) { this.falla('balon_sin_orina', 'Infló el balón antes de ver salir orina', 'Inflar el balón solo cuando fluye la orina (balón en la vejiga).'); say('¡AY! ¡Me duele mucho!', 'paciente'); f.dolorBalon = true; break; }
        if (f.balon === 'ssn') this.falla('balon_ssn', 'Infló el balón con SSN', 'Inflar con 10 ml de agua destilada estéril (nunca SSN: cristaliza y no desinfla).');
        else if (f.balon === 'aire') this.info('Infló el balón con aire', 'Inflar con 10 ml de agua destilada estéril.');
        else ok('infla_agua');
        if (!this.f('profundiza')) { say('Me molesta un poco al inflar…', 'paciente'); f.dolorBalon = true; }
        break;
      }
      case 'desinflar': f.balon = null; f.dolorBalon = false; ok('desinfla'); say('Desinfla el balón.', 'sistema'); break;
      case 'tope': if (f.balon) { ok('retira_hasta_tope'); say('Tracciona suavemente hasta sentir el tope.', 'sistema'); } else say('La sonda sale sin resistencia: el balón no está inflado.', 'hallazgo'); break;
      case 'prepucio': f.prepucio = 'normal'; w.flags.prepucio = 'normal'; ok('regresa_prepucio'); break;
      case 'retraer': f.prepucio = 'retraido'; ok('retrae_prepucio'); break;
      case 'labios': ok('separa_labios'); break;
      case 'retirar': {
        ok('retira_sonda'); w.disp = w.disp.filter(d => d.tipo !== 'foley'); const s = this.inst(f.uid); s.usado = true; this.aMano(s); w.foley = null; say('Retira la sonda.', 'sistema'); break;
      }
      default: break;
    }
    fx.push({ tipo: 'estado' });
  }

  // ---------- Sonda gástrica ----------
  _sng(ev, fx) {
    const w = this.w, C = this.caso, p = ev.params || {};
    const say = (texto, quien = 'hallazgo') => fx.push({ tipo: 'msg', quien, texto });
    if (ev.accion === 'insertar_sng') {
      if (!w.sng) {
        const s = w.mano.map(u => this.inst(u)).find(i => i && i.id.startsWith('levin_'));
        if (!s) return;
        const via = ev.region === 'boca' ? 'boca' : (ev.sub || 'narina_d');
        w.sng = { uid: s.uid, id: s.id, fr: ITEMS[s.id].fr, via, cm: 0, marca: s.cm || null, medida: (s.medida || []).length >= 3, lubricada: !!s.lubricado, insertando: true, insertada: false, trago: false, enVia: 'digestiva' };
        this.quitarDeInventario(s.uid);
        w.disp.push({ key: 'sng', tipo: 'sng', region: via === 'boca' ? 'boca' : 'nariz', nombre: `Sonda Levin ${w.sng.fr} Fr (${via === 'boca' ? 'orogástrica' : via === 'narina_d' ? 'narina derecha' : 'narina izquierda'})` });
        this.fact('inicio_sng'); this.fact('inicio_procedimiento'); this.asepticas.push(this.t); this._checkInicioProcedimiento();
        this.fact('sng_via', via);
        if (via === 'boca') this.fact('orogastrica'); else this.fact('nasogastrica');
        if (C.sngContraNasal && via !== 'boca') this.falla('sng_contraindicada', `Pasó la sonda por vía nasal con contraindicación (${C.sngContraNasal})`, `Con ${C.sngContraNasal}: pasar la sonda por vía orogástrica (o avisar y no pasarla por la nariz).`);
        if (!w.guantes) this.penaliza('sng_sin_guantes', 'SNG sin guantes', 'Guantes de manejo (técnica limpia).');
        if (!s.lubricado) this.fact('sng_sin_lubricar');
        if (!['semifowler', 'fowler', 'fowler_alto'].includes(w.posicion)) this.info('SNG sin posición semi-Fowler/Fowler', 'Semi-Fowler o Fowler con el cuello en posición neutra.');
        if (w.cuello !== 'neutro') this.info(`Cuello en ${w.cuello} durante la inserción`, 'Cuello en posición NEUTRA (evitar extensión o flexión).');
        if (via !== 'boca' && C.narinaMayor && via !== C.narinaMayor && this.f('permeabilidad_nasal')) this.info('Eligió la narina de menor diámetro', 'Elegir la narina de mayor diámetro / más permeable.');
        if (via === C.narinaMayor) this.fact('narina_ok');
        if (fr(w.sng.fr)) this.fact('sng_calibre_ok');
      }
      fx.push({ tipo: 'ui', ui: 'sng' }); fx.push({ tipo: 'estado' });
      return;
      function fr(n) { return n >= 14 && n <= 18; }
    }
    const s = w.sng; if (!s) return;
    switch (p.paso) {
      case 'avanzar': {
        if (w.flags.tos_cianosis && !s.retiradaPorDistres) {
          this.falla('continua_distres', 'Continuó introduciendo la sonda a pesar de tos/cianosis', 'Si hay distrés, tos excesiva o cianosis: retirar la sonda de inmediato.');
        }
        const target = s.marca || C.sngCm || 50;
        const cm = Number(p.cm || target);
        s.cm = cm;
        if (!s.trago && cm > 15 && !this.f('pide_tragar')) { say('*tos y náusea* ¡Me da asco!', 'paciente'); }
        if (cm >= target - 2) { s.insertada = true; s.insertando = false; this.fact('sng_insertada'); say(`Sonda introducida hasta ${cm} cm.`, 'sistema'); }
        else say(`Sonda introducida ${cm} cm.`, 'sistema');
        if (!s.marca) this.fact('sng_sin_marca');
        break;
      }
      case 'tragar': s.trago = true; this.fact('pide_tragar'); say('El paciente traga mientras avanza la sonda.', 'paciente'); break;
      case 'retirar_ya': {
        s.retiradaPorDistres = true; this.fact('retira_distres'); w.flags.tos_cianosis = false;
        w.disp = w.disp.filter(d => d.tipo !== 'sng'); const inst = this.inst(s.uid); inst.usado = true; this.aMano(inst); w.sng = null;
        say('Retira la sonda de inmediato. El paciente se recupera.', 'hallazgo'); break;
      }
      case 'pausa': this.fact('pausa_sng'); say('Deja descansar al paciente unos minutos.', 'sistema'); break;
      case 'reorientar': this.fact('reorienta_sng'); break;
      default: break;
    }
    fx.push({ tipo: 'estado' });
  }

  // ---------- Evaluación ----------
  checklist() {
    const C = this.caso;
    const items = [...(C.checklistPre || []), ...PROTOCOLO_COMUN.filter(i => !(C.omitirProtocolo || []).includes(i.id)), ...(C.checklist || [])];
    // Ordenar: protocolo común primero en su orden, con los del caso insertados en el lugar 'procedimiento'
    const pre = PROTOCOLO_COMUN.filter(i => i.fase === 'pre' && !(C.omitirProtocolo || []).includes(i.id));
    const post = PROTOCOLO_COMUN.filter(i => i.fase === 'post' && !(C.omitirProtocolo || []).includes(i.id));
    const lista = [...pre, ...(C.checklist || []), ...post];
    return lista;
  }

  tiempoDe(cuando) {
    if (cuando == null) return null;
    if (typeof cuando === 'function') return cuando(this);
    if (typeof cuando === 'string') return this.f(cuando);
    if (Array.isArray(cuando)) { const ts = cuando.map(c => this.tiempoDe(c)).filter(x => x != null); return ts.length ? Math.min(...ts) : null; }
    if (cuando.todos) { const ts = cuando.todos.map(c => this.tiempoDe(c)); return ts.every(x => x != null) ? Math.max(...ts) : null; }
    return null;
  }

  evaluate(overrides = {}, final = false) {
    final = final || this.w.terminado;
    const lista = this.checklist();
    const res = {};
    for (const it of lista) {
      let t = this.tiempoDe(it.cuando);
      let estado = t != null ? 'ok' : (final ? 'omitido' : 'pendiente');
      if (it.falloSi && this.tiempoDe(it.falloSi) != null) { estado = 'error'; t = this.tiempoDe(it.falloSi); }
      res[it.id] = { id: it.id, t, estado, item: it };
    }
    // Orden
    for (const it of lista) {
      const r = res[it.id]; if (r.estado !== 'ok') continue;
      const tOf = (id) => id.startsWith('f:') ? this.f(id.slice(2)) : (res[id] && ['ok', 'orden'].includes(res[id].estado) ? res[id].t : null);
      const tarde = (it.antesDe || []).some(id => { const x = tOf(id); return x != null && x < r.t; });
      const temprano = (it.despuesDe || []).some(id => { const x = tOf(id); return x != null && x > r.t; });
      r.ordenAntes = tarde;
      if (tarde || temprano) r.estado = 'orden';
    }
    // Ajustes manuales de la evaluadora
    for (const [id, v] of Object.entries(overrides.items || {})) {
      if (!res[id]) continue;
      res[id].manual = v; res[id].estadoAuto = res[id].estado;
      res[id].estado = v === true ? 'ok' : v === 'orden' ? 'orden' : 'omitido';
    }
    // Puntajes
    const comp = { psicomotriz: [0, 0], comunicativo: [0, 0], cognitivo: [0, 0] };
    for (const r of Object.values(res)) {
      const c = r.item.competencia; const w = r.item.peso || 1;
      if (!comp[c]) continue;
      comp[c][1] += w;
      comp[c][0] += r.estado === 'ok' ? w : r.estado === 'orden' ? w / 2 : 0;
    }
    const pct = (c) => comp[c][1] ? comp[c][0] / comp[c][1] : 0;
    const penal = this.alerts.filter(a => a.tipo === 'penalizacion').length;
    const fallas = this.alerts.filter(a => a.tipo === 'falla');
    let psico = pct('psicomotriz') * 5 - Math.min(CONFIG.penalizacionMax, penal * CONFIG.penalizacion);
    const fallaCritica = fallas.length > 0 && !(overrides.anularFalla);
    if (fallaCritica) psico = Math.min(psico, CONFIG.topeFallaCritica);
    psico = clamp(psico);
    const psicoAuto = psico;
    if (overrides.psicomotriz != null) psico = clamp(overrides.psicomotriz);
    let comu = clamp(pct('comunicativo') * 5);
    const comuAuto = comu;
    if (overrides.comunicativo != null) comu = clamp(overrides.comunicativo);
    const sug = this.sugerenciaCognitiva();
    const filas = [0, 1, 2].map(i => (overrides.cognitivo && overrides.cognitivo[i] != null) ? overrides.cognitivo[i] : sug[i]);
    const cogn = clamp(filas.reduce((a, b) => a + b, 0) / 3);
    const notaFinal = round1((psico + comu + cogn) / 3);
    const aprobar = overrides.umbral ?? CONFIG.aprobar;
    return {
      items: res, lista,
      notas: { cognitivo: round1(cogn), psicomotriz: round1(psico), comunicativo: round1(comu), final: notaFinal },
      auto: { psicomotriz: round1(psicoAuto), comunicativo: round1(comuAuto), cognitivo: sug },
      filasCognitivo: filas, sugerenciaCognitivo: sug,
      fallaCritica, fallas, penalizaciones: penal,
      aprobado: notaFinal >= aprobar && true, umbral: aprobar,
      momentos: this.momentos(),
      intervenciones: this.intervenciones(),
    };
  }

  intervenciones() {
    const C = this.caso;
    const grupos = C.intervenciones || [];
    const hechas = grupos.filter(g => this.tiempoDe(g.cuando) != null).map(g => g.nombre);
    return { hechas, minimo: C.minIntervenciones || 3, total: grupos.length };
  }

  momentos() {
    const H = this.higienes;
    const hayEntre = (a, b) => H.some(h => h > a && h < b);
    const first = (arr) => arr.length ? arr[0] : null;
    const last = (arr) => arr.length ? arr[arr.length - 1] : null;
    const c1 = first(this.contactos);
    const m1 = c1 == null ? null : H.some(h => h < c1);
    let m2 = null;
    const tA = first(this.asepticas);
    if (tA != null) {
      const prev = [...this.contactosManos.filter(c => c < tA), ...this.retirosGuantes.filter(r => r < tA)];
      const ultimo = prev.length ? Math.max(...prev) : -1;
      m2 = hayEntre(ultimo, tA);
    }
    const tF = first(this.fluidos);
    const m3 = tF == null ? null : H.some(h => h > tF);
    const cl = last(this.contactos);
    const m4 = cl == null ? null : H.some(h => h > cl);
    const el = last(this.entorno);
    const m5 = el == null ? null : H.some(h => h > el);
    // Exploración física (UAN): antes y después
    const exps = Object.keys(this.F).filter(k => /^(inspeccionar|palpar|percutir|auscultar)/.test(k));
    const expFirst = exps.length ? Math.min(...exps.map(k => this.F[k])) : null;
    const expLast = exps.length ? Math.max(...exps.map(k => this.FL[k])) : null;
    return {
      m1, m2, m3, m4, m5,
      exploracionAntes: expFirst == null ? null : H.some(h => h < expFirst),
      exploracionDespues: expLast == null ? null : H.some(h => h > expLast),
      total: H.length, juegos: this.minijuegos,
    };
  }

  sugerenciaCognitiva() {
    const C = this.caso, pae = this.w.pae || {};
    const acc = C.pae || {};
    const norm = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const contiene = (txt, opciones) => (opciones || []).some(o => { const a = norm(o); const b = norm(txt); return a && b && (b.includes(a) || a.includes(b) && b.length > 8); });
    const words = (s) => norm(s).split(' ').filter(w => w.length > 4);
    const overlap = (txt, opciones) => { const w = new Set(words(txt)); let best = 0; (opciones || []).forEach(o => { const ow = words(o); if (!ow.length) return; const k = ow.filter(x => w.has(x)).length / ow.length; best = Math.max(best, k); }); return best; };
    // Fila 1: dominio, clase, NANDA, R/C, E/P
    let f1 = 0;
    const doms = (acc.dominios || []).map(String);
    const dn = ((pae.dominio || '').match(/\d+/) || [])[0];
    if (dn && doms.includes(dn)) f1 += 1;
    if (contiene(pae.clase, acc.clases || [acc.clase])) f1 += 1;
    if (contiene(pae.nanda, acc.nanda)) f1 += 1.5;
    if (overlap(pae.rc, acc.rc) >= 0.4) f1 += 0.75;
    if (overlap(pae.ep, acc.ep) >= 0.3 || (acc.riesgo && contiene(pae.nanda, acc.nanda))) f1 += 0.75;
    // Fila 2: interpretación de hallazgos (valoración escrita + entrega)
    const texto = [pae.valoracion, this.w.entrega, this.w.notas].join(' ');
    const claves = C.interpretacion || [];
    const hits = claves.filter(k => new RegExp(k, 'i').test(texto)).length;
    let f2 = claves.length ? Math.min(5, (hits / Math.max(3, Math.ceil(claves.length * 0.6))) * 5) : 0;
    if (!texto.trim()) f2 = 0;
    // Fila 3: NOC con indicador y escala + NIC
    let f3 = 0;
    if (contiene(pae.noc, acc.noc)) f3 += 1.5;
    if ((pae.indicador || '').trim().length > 3) f3 += 0.5;
    if (pae.actual && pae.esperado && Number(pae.esperado) > Number(pae.actual)) f3 += 0.5;
    const nics = (pae.nic || []).filter(n => n && n.nombre);
    const nicOk = nics.filter(n => contiene(n.nombre, acc.nic)).length;
    f3 += Math.min(1.8, nicOk * 0.6);
    const conAct = nics.filter(n => (n.actividades || '').trim().length > 15).length;
    f3 += Math.min(0.7, conAct * 0.25);
    return [round1(clamp(f1)), round1(clamp(f2)), round1(clamp(f3))];
  }

  // Resumen compacto del estado para el log
  snapshot() {
    const w = this.w;
    return { guantes: w.guantes, cont: w.contaminado, cortina: w.cortina, pos: w.posicion, mano: w.mano.map(u => this.inst(u)?.id) };
  }
}

function clamp(x) { return Math.max(0, Math.min(5, Number.isFinite(x) ? x : 0)); }
function round1(x) { return Math.round(x * 10) / 10; }

// Respuesta automática del paciente (solo en modo práctica sin evaluadora)
export function autoRespuesta(caso, texto) {
  const t = (texto || '').toLowerCase();
  const R = caso.respuestas || {};
  if (RE.identifica.test(t)) return R.nombre;
  if (RE.dominante.test(t)) return R.dominante || 'Soy diestro.';
  if (RE.alergias.test(t)) return R.alergias || 'No, que yo sepa no soy alérgico a nada.';
  if (RE.consentimiento.test(t)) return R.consentimiento || 'Sí, está bien, hágale.';
  if (RE.dudas.test(t)) return '¿Me va a doler?';
  if (/(c[oó]mo se siente|c[oó]mo est[aá]|qu[eé] le pasa|qu[eé] siente)/.test(t)) return R.sintoma || caso.dice;
  if (/(dolor|duele)/.test(t)) return R.dolor || 'Un poco, sí.';
  if (RE.saludo.test(t)) return R.saludo || 'Buenas…';
  if (RE.explica.test(t)) return R.explicacion || 'Ah, bueno. ¿Y eso para qué es?';
  if (RE.tragar.test(t)) return '*traga*';
  if (RE.tos.test(t)) return '*tose*';
  return R.generico || 'Mmm… sí, entiendo.';
}
