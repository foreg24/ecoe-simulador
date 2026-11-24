// Zonas clicables sobre el fondo del cuarto (porcentajes del ancho/alto de room-bg.png).
// Usa student.html?calibrar=1 para arrastrarlas y exportar un JSON nuevo para pegar aquí.
export const HOTSPOTS = [
  { id: 'epp', nombre: 'Estante de EPP', x: 5.8, y: 8.4, w: 18.4, h: 11 },
  { id: 'computador', nombre: 'Computador de enfermería', x: 6, y: 24, w: 15, h: 21 },
  { id: 'monitor', nombre: 'Monitor de signos vitales', x: 25.8, y: 15.5, w: 10.6, h: 21.5 },
  { id: 'mesa_sondas', nombre: 'Mesa de sondas (mesa de noche)', x: 28.8, y: 39.8, w: 9.4, h: 14 },
  { id: 'cama', nombre: 'Cama / paciente', x: 39.5, y: 19, w: 22, h: 45 },
  { id: 'o2', nombre: 'Mesa de oxigenoterapia (toma, flujómetro, humidificador)', x: 48.2, y: 6.8, w: 7.4, h: 11.4 },
  { id: 'cortina', nombre: 'Cortina', x: 68.6, y: 3, w: 6.2, h: 65 },
  { id: 'carro_proc', nombre: 'Carro de procedimientos', x: 78, y: 16.8, w: 15, h: 17 },
  { id: 'carro_canal', nombre: 'Carro de canalización', x: 78, y: 36.5, w: 13, h: 24.5 },
  { id: 'lavamanos', nombre: 'Lavamanos (agua y jabón)', x: 78, y: 72, w: 12.5, h: 18 },
  { id: 'dispensador', nombre: 'Dispensador junto al lavamanos', x: 90.6, y: 74.6, w: 4.8, h: 8.4 },
  { id: 'gel', nombre: 'Alcohol glicerinado (junto a la puerta)', x: 65.2, y: 81.8, w: 3.8, h: 7.2 },
  { id: 'caneca_roja', nombre: 'Caneca roja (biológico)', x: 6.2, y: 78, w: 7, h: 12 },
  { id: 'caneca_negra', nombre: 'Caneca negra (ordinario)', x: 13.5, y: 78, w: 7, h: 12 },
  { id: 'caneca_blanca', nombre: 'Caneca blanca (aprovechable)', x: 21, y: 78, w: 7, h: 12 },
  { id: 'guardian', nombre: 'Guardián (cortopunzantes)', x: 30, y: 80.4, w: 6, h: 8.4 },
  { id: 'puerta', nombre: 'Puerta (salir / llamar)', x: 44, y: 85, w: 18, h: 15 },
];

// Dónde se dibuja la imagen del paciente (con su cama) sobre la cama vacía del fondo (%).
export const BED_OVERLAY = { x: 39.6, y: 17.6, w: 22.2 };

// Regiones del paciente sobre la imagen del paciente (% del ancho/alto de patient-*.png).
// Si dos regiones se superponen, gana la más pequeña.
export const REGIONS = [
  { id: 'cabeza', nombre: 'Cabeza / cara', x: 36, y: 5.5, w: 28, h: 11, subs: [['cara', 'Cara'], ['orejas', 'Orejas'], ['ojos', 'Ojos']] },
  { id: 'nariz', nombre: 'Nariz', x: 45.5, y: 14.6, w: 9, h: 3.4, subs: [['narina_d', 'Narina derecha'], ['narina_i', 'Narina izquierda']] },
  { id: 'boca', nombre: 'Boca', x: 45, y: 18, w: 10, h: 3 },
  { id: 'cuello', nombre: 'Cuello', x: 41, y: 21.2, w: 18, h: 3 },
  { id: 'torax', nombre: 'Tórax', x: 32, y: 24.2, w: 36, h: 13.3, subs: [['sup_d', 'Hemitórax der. superior'], ['sup_i', 'Hemitórax izq. superior'], ['inf_d', 'Hemitórax der. inferior (base)'], ['inf_i', 'Hemitórax izq. inferior (base)'], ['xifoides', 'Apéndice xifoides']] },
  { id: 'precordio', nombre: 'Precordio', x: 51, y: 28, w: 9, h: 6.5 },
  { id: 'abdomen', nombre: 'Abdomen', x: 34, y: 37.6, w: 32, h: 14, subs: [['epigastrio', 'Epigastrio'], ['FSD', 'Cuadrante sup. derecho'], ['FSI', 'Cuadrante sup. izquierdo'], ['FID', 'Cuadrante inf. derecho (FID)'], ['FII', 'Cuadrante inf. izquierdo (FII)'], ['hipogastrio', 'Hipogastrio']] },
  { id: 'genitales', nombre: 'Zona genital', x: 40, y: 51.8, w: 20, h: 8 },
  { id: 'piernas', nombre: 'Piernas', x: 29, y: 60, w: 42, h: 30, subs: [['muslo_d', 'Muslo derecho'], ['muslo_i', 'Muslo izquierdo'], ['pierna_d', 'Pierna derecha'], ['pierna_i', 'Pierna izquierda']] },
  { id: 'brazo_d', nombre: 'Brazo derecho', x: 15, y: 24.5, w: 17, h: 34, subs: [['brazo', 'Brazo'], ['pliegue_codo', 'Pliegue del codo'], ['antebrazo', 'Antebrazo'], ['dorso_mano', 'Dorso de la mano'], ['dedo', 'Dedo'], ['axila', 'Axila']] },
  { id: 'brazo_i', nombre: 'Brazo izquierdo', x: 68, y: 24.5, w: 17, h: 34, subs: [['brazo', 'Brazo'], ['pliegue_codo', 'Pliegue del codo'], ['antebrazo', 'Antebrazo'], ['dorso_mano', 'Dorso de la mano'], ['dedo', 'Dedo'], ['axila', 'Axila']] },
  { id: 'borde_cama', nombre: 'Lateral de la cama (bajo el nivel del paciente)', x: 84, y: 62, w: 15, h: 28 },
];

export const VENAS = {
  brazo: ['Vena cefálica (brazo)', 'Vena basílica (brazo)'],
  pliegue_codo: ['Vena mediana cubital', 'Vena cefálica del codo', 'Vena basílica del codo'],
  antebrazo: ['Vena cefálica antebraquial', 'Vena basílica antebraquial', 'Vena mediana antebraquial'],
  dorso_mano: ['Venas metacarpianas dorsales', 'Arco venoso dorsal'],
  dedo: ['Venas digitales'],
  axila: ['Vena axilar'],
};
