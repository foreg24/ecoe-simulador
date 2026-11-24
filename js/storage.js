// Persistencia segura en localStorage (todo envuelto en try/catch).
const PREFIX = 'ecoe-uan:';

export function load(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch (e) { return fallback; }
}

export function save(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; }
  catch (e) { return false; }
}

export function remove(key) {
  try { localStorage.removeItem(PREFIX + key); } catch (e) { /* nada */ }
}

// Historial de intentos/estaciones (máx. 40 por lado)
export function pushHistory(side, entry) {
  const key = 'historial-' + side;
  const list = load(key, []);
  const idx = list.findIndex(x => x.id === entry.id);
  if (idx >= 0) list[idx] = entry; else list.unshift(entry);
  save(key, list.slice(0, 40));
}

export function getHistory(side) { return load('historial-' + side, []); }

export function downloadJSON(obj, filename) {
  try {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  } catch (e) { console.warn(e); }
}
