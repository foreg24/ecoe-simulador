# Simulador ECOE de Enfermería — UAN

Simulador web de ECOE para **Principios del cuidado de enfermería (3.er semestre, Universidad Antonio Nariño)**. El estudiante lo usa en una **tablet horizontal** y la evaluadora lo sigue **en vivo** desde otro dispositivo.

**Sitio publicado:** https://foreg24.github.io/ecoe-simulador/

## Uso rápido
1. **Evaluadora:** abre `evaluator.html`, elige el caso y la duración (15/18/20 min) y pulsa **Crear estación**. Aparece un código de 6 letras.
2. **Estudiante:** abre `student.html` en la tablet, escribe el código y pulsa **Conectar**. Lee la guía y pulsa **INICIAR**.
3. Durante la estación la evaluadora ve la lista de chequeo, las alertas y la línea de tiempo; responde como el paciente, cambia el monitor y lanza eventos.
4. Al terminar (tiempo, "Finalizar" o la evaluadora), los dos ven el **reporte**. La evaluadora ajusta las notas y el estudiante recibe la calificación final.
5. Sin evaluadora: en `student.html` → **Practicar sin evaluadora** (funciona sin internet; el paciente responde solo).

## Estructura
```
index.html  student.html  evaluator.html
css/styles.css
js/peer.js (PeerJS, heartbeat, reconexión)   js/engine.js (motor de reglas y calificación)
js/room.js (app del estudiante)              js/evaluator.js (panel de la evaluadora)
js/report.js (reporte)                       js/storage.js (localStorage seguro)
data/items.js  data/cases.js  data/pae-catalog.js  data/handwash.js  data/hotspots.js
assets/room-bg.png  assets/patient-m.png  assets/patient-f.png  assets/items/*.png
tools/slice_items.py (recorta íconos y limpia fondos)   tools/test-engine.mjs (prueba del motor)
```
Los casos, listas de chequeo, ítems, zonas y el catálogo NANDA/NOC/NIC están en `data/*.js` y se editan sin tocar la lógica.

## Despliegue
**GitHub Pages (actual):** repositorio `ecoe-simulador`, rama `main`, carpeta raíz. Cada `git push` actualiza el sitio en 1–2 minutos.
```
git add -A && git commit -m "cambios" && git push
```
**Alternativa — Netlify Drop:** entrar a https://app.netlify.com/drop y arrastrar la carpeta del proyecto. No necesita build.

## Herramientas
- `python tools/slice_items.py` — recorta `assets/src/items-sheet.png` (detecta las cajas sobre el fondo y las agrupa en la cuadrícula 6×5) y limpia el fondo de los pacientes.
- `node tools/test-engine.mjs` — simula una estación completa del caso 3A y muestra las notas.
- `student.html?calibrar=1` — modo calibración: arrastrar/redimensionar las zonas del cuarto o las regiones del paciente y exportar el JSON para `data/hotspots.js`.

## Decisiones tomadas
- **Conexión:** PeerJS 1.5.4 con su servidor público. La evaluadora es el host (`ecoe-uan-<CÓDIGO>`). El **log del estudiante es la única fuente de verdad**: la evaluadora reconstruye estado y notas reproduciéndolo. Al reconectar, la tablet reenvía el log completo. Si no hay conexión, la tablet sigue funcionando y guardando; el reporte se genera igual.
- **Cronómetro:** lo lleva la tablet (funciona sin conexión) y le envía el tiempo restante a la evaluadora en cada latido (5 s). Cambia de color a los 5 min y a 1 min. Si se acaba el tiempo sin "Entrega de actividades", da 1 minuto extra solo para eso.
- **Calificación (0–5):** Psicomotriz = lista ponderada (protocolo común + caso) × 5; un ítem fuera de orden vale la mitad; cada penalización automática resta 0,2 (máx. 1,5); **falla crítica → tope 2,5**. Comunicativo = ítems comunicativos × 5 (palabras clave en "Hablar"). Cognitivo = promedio de las 3 filas de la rúbrica (sugerencia automática; la evaluadora pone la nota con botones 0–5). Nota final = promedio de las tres; aprueba con ≥ 3,0 (configurable).
- **Ajustes de la evaluadora:** tocar un ítem cicla *cumplido → fuera de orden → no cumplido → automático*; también puede fijar la nota psicomotriz/comunicativa o anular el tope por falla crítica.
- **Imagen femenina disponible:** se usaron `patient-f.png` para los casos 1A, 2B, 4A y 5B (no hizo falta convertir casos).
- **Higiene de manos:** el minijuego aparece en la primera higiene (o siempre, si la evaluadora lo configura). No da retroalimentación durante la estación; el resultado sale en el reporte.
- **Sin retroalimentación de puntos durante la estación**: solo consecuencias (monitor, quejas, sangrado, reservorio que colapsa, orina, etc.).
- **Contenido clínico:** tomado de las guías de laboratorio UAN tal como venían en la especificación (p. ej. pre-inflar el balón; verificar la SNG con auscultación + aspirado; la nota sobre pH/radiografía aparece solo en el reporte y no penaliza).
- **Respuestas automáticas del paciente:** solo en modo práctica o si se pierde la conexión.
- **Wake Lock y pantalla completa** en la tablet; mensaje "Gira la tablet" en vertical.
