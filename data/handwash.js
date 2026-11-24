// Pasos de higiene de manos (OMS) para el minijuego de ordenar tarjetas.
const FROTE = [
  'Frotar palma con palma',
  'Palma derecha sobre dorso izquierdo con dedos entrelazados, y viceversa',
  'Palma con palma con los dedos entrelazados',
  'Dorso de los dedos contra la palma opuesta, agarrándose los dedos',
  'Rotación del pulgar izquierdo atrapado en la palma derecha, y viceversa',
  'Rotación de las yemas de los dedos contra la palma opuesta',
];

export const HANDWASH = {
  agua: {
    nombre: 'Lavado con agua y jabón',
    duracion: '40–60 s',
    pasos: ['Mojar las manos con agua', 'Aplicar jabón suficiente para cubrir las manos', ...FROTE,
      'Enjuagar las manos con agua', 'Secar con una toalla desechable', 'Cerrar el grifo con la toalla'],
    distractores: ['Secar con toalla de tela', 'Sacudir las manos para secarlas', 'Cerrar el grifo con la mano limpia'],
  },
  alcohol: {
    nombre: 'Higienización con alcohol glicerinado',
    duracion: '20–30 s',
    pasos: ['Aplicar una dosis de producto en la palma de la mano', ...FROTE, 'Dejar secar las manos al aire'],
    distractores: ['Secar con toalla de tela', 'Sacudir las manos para secarlas', 'Enjuagar con agua al terminar'],
  },
};

// Los 5 momentos de la OMS (textos para el reporte)
export const MOMENTOS = [
  { id: 'm1', texto: 'Antes del contacto con el paciente' },
  { id: 'm2', texto: 'Antes de realizar una tarea aséptica' },
  { id: 'm3', texto: 'Después del riesgo de exposición a fluidos corporales' },
  { id: 'm4', texto: 'Después del contacto con el paciente' },
  { id: 'm5', texto: 'Después del contacto con el entorno del paciente' },
];
