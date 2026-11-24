// Catálogo de ítems del cuarto. Editable sin tocar la lógica.
// icon: 'png:<archivo en assets/items>' o 'svg:<clave en SVG_ICONS>'; badge = texto pequeño sobre el ícono.
// residuo: caneca correcta cuando el ítem está USADO ('roja' biológico, 'guardian' cortopunzante,
//          'negra' ordinario, 'blanca' aprovechable). null = equipo reutilizable (se devuelve).
// tipo: 'epp' (se pone), 'guantes', 'equipo' (reutilizable), 'consumible', 'liquido'.

export const ITEMS = {
  // --- EPP ---
  gorro:            { nombre: 'Gorro', icon: 'svg:gorro', tipo: 'epp', residuo: 'roja' },
  tapabocas:        { nombre: 'Tapabocas', icon: 'png:tapabocas', tipo: 'epp', residuo: 'roja' },
  gafas:            { nombre: 'Gafas protectoras', icon: 'svg:gafas', tipo: 'epp', residuo: null },
  bata:             { nombre: 'Bata', icon: 'svg:bata', tipo: 'epp', residuo: 'roja' },
  guantes_manejo:   { nombre: 'Guantes de manejo (nitrilo)', icon: 'png:guantes_manejo', tipo: 'guantes', residuo: 'roja' },
  guantes_esteriles:{ nombre: 'Guantes estériles', icon: 'png:guantes_esteriles', tipo: 'guantes', esteril: true, residuo: 'roja' },

  // --- Valoración ---
  fonendoscopio:    { nombre: 'Fonendoscopio', icon: 'png:fonendoscopio', tipo: 'equipo', residuo: null },
  tensiometro:      { nombre: 'Tensiómetro', icon: 'png:tensiometro', tipo: 'equipo', residuo: null },
  termometro:       { nombre: 'Termómetro digital', icon: 'png:termometro', tipo: 'equipo', residuo: null },
  pulsoximetro:     { nombre: 'Pulsioxímetro', icon: 'png:pulsoximetro', tipo: 'equipo', residuo: null },
  linterna:         { nombre: 'Linterna', icon: 'svg:linterna', tipo: 'equipo', residuo: null },

  // --- Oxigenoterapia ---
  canula_nasal:     { nombre: 'Cánula nasal', icon: 'png:canula_nasal', tipo: 'consumible', o2: 'canula', residuo: 'roja' },
  mascarilla_simple:{ nombre: 'Mascarilla simple', icon: 'png:mascarilla_simple', tipo: 'consumible', o2: 'simple', residuo: 'roja' },
  venturi:          { nombre: 'Mascarilla Venturi (válvulas de colores)', icon: 'png:venturi', tipo: 'consumible', o2: 'venturi', residuo: 'roja' },
  mascarilla_reservorio: { nombre: 'Mascarilla con reservorio (no reinhalación)', icon: 'png:mascarilla_reservorio', tipo: 'consumible', o2: 'reservorio', residuo: 'roja' },
  agua_destilada:   { nombre: 'Agua destilada estéril', icon: 'svg:agua', tipo: 'liquido', liquido: 'agua_destilada', esteril: true, residuo: 'blanca' },
  ssn_10:           { nombre: 'SSN 0,9 % (ampolla 10 ml)', icon: 'svg:ampolla', tipo: 'liquido', liquido: 'ssn', esteril: true, residuo: 'blanca' },
  vaselina:         { nombre: 'Vaselina', icon: 'svg:vaselina', tipo: 'consumible', residuo: 'negra' },

  // --- Canalización ---
  cat_18:           { nombre: 'Catéter IV 18G (verde)', icon: 'png:cateter_iv', badge: '18G', tipo: 'consumible', calibre: 18, residuo: 'guardian' },
  cat_20:           { nombre: 'Catéter IV 20G (rosado)', icon: 'png:cateter_iv', badge: '20G', tipo: 'consumible', calibre: 20, residuo: 'guardian' },
  cat_22:           { nombre: 'Catéter IV 22G (azul)', icon: 'png:cateter_iv', badge: '22G', tipo: 'consumible', calibre: 22, residuo: 'guardian' },
  cat_24:           { nombre: 'Catéter IV 24G (amarillo)', icon: 'png:cateter_iv', badge: '24G', tipo: 'consumible', calibre: 24, residuo: 'guardian' },
  torniquete:       { nombre: 'Torniquete', icon: 'png:torniquete', tipo: 'equipo', residuo: null },
  bolsa_ssn:        { nombre: 'Bolsa SSN 0,9 % 500 ml', icon: 'png:bolsa_ssn', tipo: 'consumible', residuo: 'blanca' },
  equipo_macro:     { nombre: 'Equipo de venoclisis macrogoteo (20 gt/ml)', icon: 'png:equipo_venoclisis', badge: 'macro', tipo: 'consumible', residuo: 'roja' },
  equipo_micro:     { nombre: 'Equipo de venoclisis microgoteo (60 gt/ml)', icon: 'png:equipo_venoclisis', badge: 'micro', tipo: 'consumible', residuo: 'roja' },
  conector:         { nombre: 'Conector libre de aguja (clave)', icon: 'svg:conector', tipo: 'consumible', residuo: 'roja' },
  jeringa_ssn:      { nombre: 'Jeringa 10 cc con SSN 0,9 %', icon: 'png:jeringa_50', badge: '10 SSN', tipo: 'consumible', esteril: true, residuo: 'roja' },
  aposito:          { nombre: 'Apósito transparente', icon: 'png:aposito', tipo: 'consumible', residuo: 'roja' },
  alcohol:          { nombre: 'Alcohol antiséptico', icon: 'png:antiseptico', badge: 'OH', tipo: 'liquido', residuo: 'blanca' },
  clorhexidina:     { nombre: 'Clorhexidina', icon: 'png:antiseptico', badge: 'CHX', tipo: 'liquido', residuo: 'blanca' },
  torundas:         { nombre: 'Torundas de algodón', icon: 'svg:torundas', tipo: 'consumible', residuo: 'roja' },
  marcador:         { nombre: 'Marcador / rótulo', icon: 'svg:marcador', tipo: 'equipo', residuo: null },

  // --- Sondas ---
  foley_12:         { nombre: 'Sonda Foley 12 Fr', icon: 'png:sonda_foley', badge: '12', tipo: 'consumible', esteril: true, fr: 12, residuo: 'roja' },
  foley_14:         { nombre: 'Sonda Foley 14 Fr', icon: 'png:sonda_foley', badge: '14', tipo: 'consumible', esteril: true, fr: 14, residuo: 'roja' },
  foley_16:         { nombre: 'Sonda Foley 16 Fr', icon: 'png:sonda_foley', badge: '16', tipo: 'consumible', esteril: true, fr: 16, residuo: 'roja' },
  foley_18:         { nombre: 'Sonda Foley 18 Fr', icon: 'png:sonda_foley', badge: '18', tipo: 'consumible', esteril: true, fr: 18, residuo: 'roja' },
  levin_12:         { nombre: 'Sonda Levin 12 Fr', icon: 'png:sng', badge: '12', tipo: 'consumible', fr: 12, residuo: 'roja' },
  levin_14:         { nombre: 'Sonda Levin 14 Fr', icon: 'png:sng', badge: '14', tipo: 'consumible', fr: 14, residuo: 'roja' },
  levin_16:         { nombre: 'Sonda Levin 16 Fr', icon: 'png:sng', badge: '16', tipo: 'consumible', fr: 16, residuo: 'roja' },
  levin_18:         { nombre: 'Sonda Levin 18 Fr', icon: 'png:sng', badge: '18', tipo: 'consumible', fr: 18, residuo: 'roja' },
  bolsa_colectora:  { nombre: 'Bolsa colectora de orina (cistoflo)', icon: 'png:bolsa_colectora', tipo: 'consumible', esteril: true, residuo: 'roja' },
  bolsa_drenaje:    { nombre: 'Bolsa recolectora (drenaje gástrico)', icon: 'png:bolsa_colectora', badge: 'SNG', tipo: 'consumible', residuo: 'roja' },
  jeringa_10:       { nombre: 'Jeringa 10 ml', icon: 'png:jeringa_50', badge: '10', tipo: 'consumible', esteril: true, residuo: 'roja' },
  jeringa_50:       { nombre: 'Jeringa 50 ml', icon: 'png:jeringa_50', badge: '50', tipo: 'consumible', residuo: 'roja' },
  lidocaina:        { nombre: 'Lidocaína jalea 2 %', icon: 'svg:tubo', tipo: 'consumible', esteril: true, residuo: 'roja' },
  lubricante:       { nombre: 'Lubricante hidrosoluble (sachet)', icon: 'png:lubricante', tipo: 'consumible', residuo: 'roja' },
  campo_esteril:    { nombre: 'Campo estéril', icon: 'png:campo_esteril', tipo: 'consumible', esteril: true, residuo: 'roja' },
  campo_ojo:        { nombre: 'Campo de ojo (fenestrado)', icon: 'png:campo_esteril', badge: 'ojo', tipo: 'consumible', esteril: true, residuo: 'roja' },
  gasas:            { nombre: 'Gasas', icon: 'png:gasas', tipo: 'consumible', residuo: 'roja' },
  gasas_esteriles:  { nombre: 'Gasas estériles', icon: 'png:gasas', badge: 'est.', tipo: 'consumible', esteril: true, residuo: 'roja' },
  jabon_quirurgico: { nombre: 'Jabón quirúrgico', icon: 'svg:jabon', tipo: 'liquido', residuo: 'blanca' },
  tiras_ph:         { nombre: 'Tiras de pH', icon: 'png:tiras_ph', tipo: 'consumible', residuo: 'roja' },
  esparadrapo:      { nombre: 'Esparadrapo / fixomull', icon: 'png:esparadrapo', tipo: 'consumible', residuo: 'roja' },
  rinonera:         { nombre: 'Riñonera', icon: 'svg:rinonera', tipo: 'equipo', residuo: null },

  // --- Generados durante la estación (no están en ninguna zona) ---
  aguja:            { nombre: 'Aguja (estilete) del catéter', icon: 'svg:aguja', tipo: 'consumible', residuo: 'guardian', generado: true },
  guantes_usados:   { nombre: 'Guantes usados', icon: 'png:guantes_manejo', badge: 'usados', tipo: 'consumible', residuo: 'roja', generado: true },
  cateter_retirado: { nombre: 'Catéter retirado', icon: 'png:cateter_iv', badge: 'usado', tipo: 'consumible', residuo: 'roja', generado: true },
  gasas_usadas:     { nombre: 'Gasas/torundas usadas', icon: 'png:gasas', badge: 'usadas', tipo: 'consumible', residuo: 'roja', generado: true },
  envolturas:       { nombre: 'Envolturas y empaques', icon: 'svg:envoltura', tipo: 'consumible', residuo: 'negra', generado: true },
};

// Contenido de cada zona (TODOS los casos ven todo; muchos son distractores)
export const ZONE_ITEMS = {
  epp: ['gorro', 'tapabocas', 'gafas', 'bata', 'guantes_manejo', 'guantes_esteriles'],
  monitor: ['fonendoscopio', 'tensiometro', 'termometro', 'pulsoximetro', 'linterna'],
  mesa_sondas: ['foley_12', 'foley_14', 'foley_16', 'foley_18', 'levin_12', 'levin_14', 'levin_16', 'levin_18',
    'bolsa_colectora', 'bolsa_drenaje', 'jeringa_10', 'jeringa_50', 'agua_destilada', 'ssn_10', 'lidocaina',
    'lubricante', 'vaselina', 'campo_esteril', 'campo_ojo', 'gasas_esteriles', 'jabon_quirurgico', 'tiras_ph',
    'esparadrapo', 'marcador', 'rinonera'],
  o2: ['canula_nasal', 'mascarilla_simple', 'venturi', 'mascarilla_reservorio', 'agua_destilada', 'ssn_10', 'vaselina', 'gasas'],
  carro_proc: ['gasas', 'gasas_esteriles', 'torundas', 'alcohol', 'clorhexidina', 'jabon_quirurgico', 'esparadrapo', 'rinonera', 'jeringa_10', 'jeringa_50', 'marcador', 'tiras_ph'],
  carro_canal: ['cat_18', 'cat_20', 'cat_22', 'cat_24', 'torniquete', 'bolsa_ssn', 'equipo_macro', 'equipo_micro', 'conector',
    'jeringa_ssn', 'aposito', 'alcohol', 'clorhexidina', 'torundas', 'gasas', 'esparadrapo', 'marcador', 'guantes_manejo'],
};

// Datos de referencia (visibles SOLO en el reporte)
export const REFERENCIAS = {
  oxigeno: {
    titulo: 'Oxigenoterapia (guía UAN)',
    filas: [
      ['Cánula nasal', '1–4 L/min', '1 L = 24 %, 2 L = 28 %, 3 L = 32 %, 4 L = 36 % (+4 % por litro). UAN: no superar FiO2 32 % (≈3 L/min) por epistaxis e irritación.'],
      ['Mascarilla simple', '5–10 L/min', '5–6 L = 40 %, 7–8 L = 50 %, 9–10 L = 60 %. Menos de 5 L/min = reinhalación de CO2.'],
      ['Mascarilla con reservorio', '10–15 L/min', 'Reinhalación parcial 60–80 %; no reinhalación 90–100 %. Reservorio lleno. Contraindicada en hipercapnia. No más de 4 h.'],
      ['Venturi', 'según válvula', 'FiO2 24, 28, 31, 35, 40, 50 %. 24–40 % con 4–8 L/min; 40–50 % con 10–12 L/min. Al estabilizar, pasar a cánula.'],
      ['Humidificador', '—', 'Con agua destilada; muy recomendado con flujos altos.'],
    ],
    notas: 'Cuidados: verificar que el flujo prescrito coincida con el suministrado; buscar fugas (sobre todo a los ojos); proteger orejas y puente nasal con gasa; hidratar mucosas solo con soluciones acuosas (nunca vaselina ni aceite); higiene nasal y bucal; control y registro de SpO2; revisar conexiones.',
  },
  goteo: {
    titulo: 'Cálculo de goteo',
    filas: [
      ['Macrogoteo (20 gt/ml)', 'gotas/min = volumen (ml) × 20 / tiempo (min)', 'Ej.: 500 × 20 / 60 ≈ 167 gotas/min'],
      ['Microgoteo (60 gt/ml)', 'microgotas/min = ml/h', 'Ej.: 500 ml en 1 h = 500 microgotas/min'],
    ],
    notas: 'Calibre recomendado: 18–20G para reposición rápida de volumen; 22G con capital venoso pobre.',
  },
  vesical: {
    titulo: 'Cateterismo vesical (guía UAN)',
    filas: [
      ['Calibre adulto', '14–18 Fr', '12 Fr solo excepcional.'],
      ['Balón', '10 ml de agua destilada estéril', 'Nunca SSN. Inflar solo cuando fluye la orina. En la UAN se pre-infla para probarlo.'],
      ['Mujer', 'Introducir hasta que fluya orina + 5 cm', 'Lidocaína en porción amplia de la sonda; limpieza descendente pubis → ano.'],
      ['Hombre', 'Hasta la bifurcación', 'Lidocaína intrauretral, esperar 3–5 min; pene perpendicular con tracción hacia arriba; si hay resistencia, pedir que tosa; regresar el prepucio.'],
    ],
    notas: 'Bolsa por debajo del nivel de la vejiga, sistema cerrado, sin acodaduras. Registrar cantidad y características de la orina.',
  },
  sng: {
    titulo: 'Sonda gástrica (guía UAN)',
    filas: [
      ['Calibre adulto', 'Levin 14–18 Fr', ''],
      ['Medición', 'Nariz → lóbulo de la oreja → apéndice xifoides', 'Marcar sin contaminar la sonda.'],
      ['Posición', 'Semi-Fowler / Fowler, cuello neutro', 'Evitar extensión o flexión.'],
      ['Verificación UAN', 'Auscultar epigastrio insuflando 10–20 ml de aire Y aspirar contenido gástrico', ''],
    ],
    notas: 'Nota (no penaliza): en la práctica clínica actual, la radiografía y el pH ≤ 5,5 del aspirado son los métodos más confiables; la auscultación sola no se recomienda.',
  },
  valoracion: {
    titulo: 'Técnicas de valoración física (guía UAN)',
    filas: [
      ['Tórax', 'Inspección → palpación → percusión → auscultación', 'Comparar ambos lados, anterior y posterior.'],
      ['Abdomen', 'Inspección → auscultación → percusión → palpación', 'Superficial antes que profunda; la zona dolorosa al final.'],
      ['Signos vitales', 'ANTES de la exploración corporal', 'La exploración va después de la entrevista.'],
    ],
    notas: 'Higiene de manos antes y después; privacidad; explicar lo que va a sentir; exponer solo la zona; manos tibias.',
  },
};

// Tabla de la válvula Venturi (FiO2 -> flujo L/min recomendado)
export const VENTURI = [
  { fio2: 24, color: 'azul', flujo: [4, 4] },
  { fio2: 28, color: 'amarillo', flujo: [4, 6] },
  { fio2: 31, color: 'blanco', flujo: [6, 8] },
  { fio2: 35, color: 'rojo', flujo: [8, 8] },
  { fio2: 40, color: 'rosado', flujo: [8, 10] },
  { fio2: 50, color: 'verde', flujo: [10, 12] },
];

// Íconos SVG simples (trazo suave, paleta teal y blanco)
const S = (inner) => `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#0f6b6b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
export const SVG_ICONS = {
  gorro: S('<path d="M10 40c0-14 10-24 22-24s22 10 22 24" fill="#bfe8e4"/><path d="M8 40h48v6H8z" fill="#e8f7f5"/>'),
  gafas: S('<circle cx="20" cy="34" r="10" fill="#e8f7f5"/><circle cx="44" cy="34" r="10" fill="#e8f7f5"/><path d="M30 33h4M10 30l-4-6M54 30l4-6"/>'),
  bata: S('<path d="M22 10h20l12 14-8 6v26H18V30l-8-6z" fill="#bfe8e4"/><path d="M32 12v44"/>'),
  linterna: S('<rect x="12" y="26" width="30" height="12" rx="3" fill="#e8f7f5"/><path d="M42 24l10-6v28l-10-6z" fill="#bfe8e4"/><path d="M56 26l4-2M56 32h5M56 38l4 2"/>'),
  agua: S('<path d="M24 10h16v8l6 6v30H18V24l6-6z" fill="#e8f7f5"/><path d="M18 34h28" /><path d="M32 40c-3 4-3 8 0 8s3-4 0-8z" fill="#7fd0e6"/>'),
  ampolla: S('<path d="M26 8h12v10l4 6v30H22V24l4-6z" fill="#e8f7f5"/><path d="M22 36h20"/>'),
  vaselina: S('<rect x="14" y="22" width="36" height="30" rx="5" fill="#fff4d6"/><rect x="12" y="14" width="40" height="10" rx="3" fill="#ffd98a"/>'),
  conector: S('<rect x="22" y="14" width="20" height="36" rx="6" fill="#e8f7f5"/><path d="M28 14V8h8v6M32 50v6"/><circle cx="32" cy="24" r="4" fill="#7fd0e6"/>'),
  torundas: S('<circle cx="22" cy="36" r="9" fill="#fff"/><circle cx="38" cy="30" r="9" fill="#fff"/><circle cx="40" cy="44" r="8" fill="#fff"/>'),
  marcador: S('<path d="M14 50l6-6 26-26 6 6-26 26z" fill="#e8f7f5"/><path d="M14 50l-4 4M40 24l6 6" /><path d="M46 18l6 6" stroke="#0a4f4f"/>'),
  tubo: S('<path d="M18 14h28l-4 34H22z" fill="#e8f7f5"/><rect x="26" y="48" width="12" height="8" rx="2" fill="#bfe8e4"/><path d="M22 26h20"/>'),
  jabon: S('<rect x="18" y="22" width="28" height="34" rx="6" fill="#d8f0ff"/><path d="M28 22v-8h10l6 4" /><circle cx="32" cy="40" r="5" fill="#fff"/>'),
  rinonera: S('<path d="M8 30c0 12 10 18 24 18s24-6 24-18c-8 4-12-6-24-6S16 34 8 30z" fill="#dfe7ea"/>'),
  aguja: S('<path d="M10 54L42 22" stroke-width="2"/><rect x="40" y="12" width="12" height="12" rx="2" transform="rotate(45 46 18)" fill="#ffd6e0"/>'),
  envoltura: S('<path d="M12 18l20-6 20 6v28l-20 6-20-6z" fill="#f2f2f2"/><path d="M12 18l20 6 20-6M32 24v28"/>'),
  generic: S('<rect x="14" y="14" width="36" height="36" rx="8" fill="#e8f7f5"/>'),
};

export function iconHTML(itemId, cls = 'icon') {
  const it = ITEMS[itemId];
  if (!it) return `<span class="${cls}">${SVG_ICONS.generic}</span>`;
  const [kind, key] = it.icon.split(':');
  const img = kind === 'png'
    ? `<img src="assets/items/${key}.png" alt="" draggable="false">`
    : (SVG_ICONS[key] || SVG_ICONS.generic);
  const badge = it.badge ? `<b class="badge">${it.badge}</b>` : '';
  return `<span class="${cls}">${img}${badge}</span>`;
}
