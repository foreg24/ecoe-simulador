// Catálogo para el autocompletado del PAE (NANDA-I / NOC / NIC en español).
// Los códigos se incluyen solo cuando son conocidos con seguridad.

export const DOMINIOS = [
  { n: 1, nombre: 'Promoción de la salud', clases: ['Toma de conciencia de la salud', 'Gestión de la salud'] },
  { n: 2, nombre: 'Nutrición', clases: ['Ingestión', 'Digestión', 'Absorción', 'Metabolismo', 'Hidratación'] },
  { n: 3, nombre: 'Eliminación e intercambio', clases: ['Función urinaria', 'Función gastrointestinal', 'Función tegumentaria', 'Función respiratoria'] },
  { n: 4, nombre: 'Actividad/reposo', clases: ['Sueño/reposo', 'Actividad/ejercicio', 'Equilibrio de la energía', 'Respuestas cardiovasculares/pulmonares', 'Autocuidado'] },
  { n: 5, nombre: 'Percepción/cognición', clases: ['Atención', 'Orientación', 'Sensación/percepción', 'Cognición', 'Comunicación'] },
  { n: 6, nombre: 'Autopercepción', clases: ['Autoconcepto', 'Autoestima', 'Imagen corporal'] },
  { n: 7, nombre: 'Rol/relaciones', clases: ['Roles de cuidador', 'Relaciones familiares', 'Desempeño del rol'] },
  { n: 8, nombre: 'Sexualidad', clases: ['Identidad sexual', 'Función sexual', 'Reproducción'] },
  { n: 9, nombre: 'Afrontamiento/tolerancia al estrés', clases: ['Respuestas postraumáticas', 'Respuestas de afrontamiento', 'Estrés neurocomportamental'] },
  { n: 10, nombre: 'Principios vitales', clases: ['Valores', 'Creencias', 'Congruencia entre valores/creencias/acciones'] },
  { n: 11, nombre: 'Seguridad/protección', clases: ['Infección', 'Lesión física', 'Violencia', 'Peligros del entorno', 'Procesos defensivos', 'Termorregulación'] },
  { n: 12, nombre: 'Confort', clases: ['Confort físico', 'Confort del entorno', 'Confort social'] },
  { n: 13, nombre: 'Crecimiento/desarrollo', clases: ['Crecimiento', 'Desarrollo'] },
];

export function dominioOpciones() {
  return DOMINIOS.map(d => `Dominio ${d.n}: ${d.nombre}`);
}
export function claseOpciones() {
  const out = [];
  DOMINIOS.forEach(d => d.clases.forEach((c, i) => out.push(`Clase ${i + 1}: ${c} (D${d.n})`)));
  return out;
}

export const NANDA = [
  ['Dolor agudo', '00132'], ['Dolor crónico', '00133'],
  ['Patrón respiratorio ineficaz', '00032'], ['Limpieza ineficaz de las vías aéreas', '00031'],
  ['Deterioro del intercambio de gases', '00030'], ['Deterioro de la ventilación espontánea', '00033'],
  ['Déficit de volumen de líquidos', '00027'], ['Exceso de volumen de líquidos', '00026'],
  ['Riesgo de desequilibrio de volumen de líquidos', '00025'], ['Riesgo de déficit de volumen de líquidos', '00028'],
  ['Riesgo de infección', '00004'], ['Riesgo de deterioro de la integridad cutánea', '00047'],
  ['Deterioro de la integridad cutánea', '00046'], ['Deterioro de la integridad tisular', '00044'],
  ['Riesgo de traumatismo vascular', '00213'], ['Retención urinaria', '00023'],
  ['Deterioro de la eliminación urinaria', '00016'], ['Incontinencia urinaria funcional', '00020'],
  ['Motilidad gastrointestinal disfuncional', '00196'], ['Riesgo de motilidad gastrointestinal disfuncional', '00197'],
  ['Náuseas', '00134'], ['Deterioro de la deglución', '00103'], ['Riesgo de aspiración', '00039'],
  ['Desequilibrio nutricional: inferior a las necesidades corporales', '00002'],
  ['Hipertermia', '00007'], ['Hipotermia', '00006'], ['Ansiedad', '00146'], ['Temor', '00148'],
  ['Intolerancia a la actividad', '00092'], ['Fatiga', '00093'], ['Deterioro de la movilidad física', '00085'],
  ['Riesgo de caídas', '00155'], ['Estreñimiento', '00011'], ['Diarrea', '00013'], ['Riesgo de estreñimiento', '00015'],
  ['Riesgo de sangrado', '00206'], ['Disminución del gasto cardíaco', '00029'],
  ['Perfusión tisular periférica ineficaz', '00204'], ['Riesgo de perfusión tisular periférica ineficaz', '00228'],
  ['Conocimientos deficientes', '00126'], ['Déficit de autocuidado: baño', '00108'],
  ['Trastorno del patrón de sueño', '00198'], ['Insomnio', '00095'], ['Riesgo de lesión', '00035'],
  ['Deterioro de la mucosa oral', '00045'], ['Deterioro de la comunicación verbal', '00051'],
  ['Riesgo de shock', '00205'], ['Riesgo de desequilibrio electrolítico', '00195'],
  ['Riesgo de lesión por presión', ''], ['Riesgo de sangrado gastrointestinal', ''],
  ['Disposición para mejorar la gestión de la salud', ''], ['Gestión ineficaz de la salud', ''],
].map(([label, cod]) => ({ label, cod }));

export const NOC = [
  ['Nivel del dolor', '2102'], ['Control del dolor', '1605'],
  ['Estado respiratorio', '0415'], ['Estado respiratorio: ventilación', '0403'],
  ['Estado respiratorio: intercambio gaseoso', '0402'], ['Estado respiratorio: permeabilidad de las vías respiratorias', '0410'],
  ['Perfusión tisular', ''], ['Perfusión tisular: periférica', '0407'],
  ['Equilibrio hídrico', '0601'], ['Hidratación', '0602'],
  ['Control del riesgo', '1902'], ['Detección del riesgo', '1908'],
  ['Control del riesgo: proceso infeccioso', '1924'], ['Severidad de la infección', '0703'],
  ['Eliminación urinaria', '0503'], ['Continencia urinaria', '0502'], ['Eliminación intestinal', '0501'],
  ['Severidad de las náuseas y los vómitos', '2107'], ['Estado de deglución', '1010'],
  ['Estado nutricional', '1004'], ['Prevención de la aspiración', '1918'],
  ['Integridad tisular: piel y membranas mucosas', '1101'], ['Signos vitales', '0802'],
  ['Termorregulación', '0800'], ['Nivel de ansiedad', '1211'], ['Autocontrol del miedo', '1404'],
  ['Conocimiento: régimen terapéutico', '1813'], ['Conocimiento: manejo del dolor', ''],
  ['Tolerancia a la actividad', '0005'], ['Nivel de fatiga', '0007'], ['Movilidad', '0208'],
  ['Estado circulatorio', '0401'], ['Severidad de la pérdida de sangre', '0413'],
  ['Estado de comodidad', '2008'], ['Control de síntomas', '1608'], ['Descanso', '0003'], ['Sueño', '0004'],
  ['Función gastrointestinal', '1015'], ['Estado nutricional: ingestión alimentaria y de líquidos', '1008'],
  ['Equilibrio electrolítico y ácido-base', '0600'], ['Curación de la herida: por primera intención', '1102'],
  ['Conducta de seguridad: prevención de caídas', '1909'], ['Integridad del acceso venoso', ''],
  ['Estado neurológico', '0909'], ['Satisfacción del paciente/usuario: cuidados', ''],
].map(([label, cod]) => ({ label, cod }));

export const NIC = [
  ['Manejo del dolor', '1400'], ['Monitorización de signos vitales', '6680'], ['Administración de analgésicos', '2210'],
  ['Monitorización respiratoria', '3350'], ['Ayuda a la ventilación', '3390'], ['Oxigenoterapia', '3320'],
  ['Manejo de la vía aérea', '3140'], ['Aspiración de las vías aéreas', '3160'], ['Fisioterapia torácica', '3230'],
  ['Punción intravenosa (I.V.)', '4190'], ['Terapia intravenosa (I.V.)', '4200'], ['Manejo de líquidos', '4120'],
  ['Monitorización de líquidos', '4130'], ['Manejo de la hipovolemia', '4180'],
  ['Administración de medicación: intravenosa (I.V.)', '2314'], ['Administración de medicación', '2300'],
  ['Mantenimiento de dispositivos de acceso venoso (DAV)', '2440'],
  ['Sondaje vesical', '0580'], ['Cuidados del catéter urinario', '1876'], ['Cuidados de la retención urinaria', '0620'],
  ['Manejo de la eliminación urinaria', '0590'], ['Control de infecciones', '6540'], ['Protección contra las infecciones', '6550'],
  ['Enseñanza: individual', '5606'], ['Enseñanza: procedimiento/tratamiento', '5618'], ['Educación para la salud', '5510'],
  ['Manejo de las náuseas', '1450'], ['Manejo del vómito', '1570'], ['Cuidados del drenaje', '1870'],
  ['Alimentación enteral por sonda', '1056'], ['Precauciones para evitar la aspiración', '3200'],
  ['Sondaje gastrointestinal', '1080'], ['Terapia de deglución', '1860'], ['Manejo de la nutrición', '1100'],
  ['Vigilancia de la piel', '3590'], ['Cuidados del sitio de incisión', '3440'], ['Prevención de úlceras por presión', '3540'],
  ['Disminución de la ansiedad', '5820'], ['Apoyo emocional', '5270'], ['Escucha activa', '4920'],
  ['Cambio de posición', '0840'], ['Regulación de la temperatura', '3900'], ['Tratamiento de la fiebre', '3740'],
  ['Prevención de caídas', '6490'], ['Identificación de riesgos', '6610'], ['Vigilancia', '6650'],
  ['Manejo intestinal', '0430'], ['Precauciones circulatorias', '4070'], ['Ayuda al autocuidado', '1800'],
  ['Manejo del shock: volumen', '4258'], ['Flebotomía: muestra de sangre venosa', '4238'],
].map(([label, cod]) => ({ label, cod }));

export const ESCALAS_LIKERT = [
  '1 Grave · 2 Sustancial · 3 Moderado · 4 Leve · 5 Ninguno',
  '1 Desviación grave del rango normal · 2 Sustancial · 3 Moderada · 4 Leve · 5 Sin desviación del rango normal',
  '1 Gravemente comprometido · 2 Sustancialmente · 3 Moderadamente · 4 Levemente · 5 No comprometido',
  '1 Nunca demostrado · 2 Raramente · 3 A veces · 4 Frecuentemente · 5 Siempre demostrado',
  '1 Ningún conocimiento · 2 Escaso · 3 Moderado · 4 Sustancial · 5 Extenso',
];
