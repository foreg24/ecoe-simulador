"""
Recorta la hoja de íconos (assets/src/items-sheet.png) y limpia las imágenes del paciente.

- Detecta los objetos por bounding boxes sobre el fondo (blanco o transparente),
  agrupa los componentes por celda de una cuadrícula 6x5 (para conservar el orden)
  y guarda cada ícono en assets/items/<id>.png (256x256, centrado, fondo transparente).
- Quita el fondo blanco de patient-*.png con antialias suave.

Uso:  python tools/slice_items.py
Requiere: Pillow, numpy
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "src"
OUT = ROOT / "assets" / "items"

IDS = [
    ["canula_nasal", "mascarilla_simple", "venturi", "mascarilla_reservorio", "flujometro", "humidificador"],
    ["cateter_iv", "torniquete", "bolsa_ssn", "equipo_venoclisis", "aposito", "sonda_foley"],
    ["bolsa_colectora", "sng", "jeringa_50", "guantes_esteriles", "guantes_manejo", "tapabocas"],
    ["campo_esteril", "antiseptico", "lubricante", "tiras_ph", "fonendoscopio", "tensiometro"],
    ["termometro", "pulsoximetro", "guardian", "gasas", "esparadrapo"],
]
COLS, ROWS = 6, 5


def foreground_mask(img: Image.Image) -> np.ndarray:
    """True donde hay objeto. Usa alfa si existe; si no, 'no blanco'."""
    a = np.asarray(img.convert("RGBA")).astype(np.int16)
    alpha = a[..., 3]
    if (alpha < 250).mean() > 0.05:  # tiene transparencia real
        return alpha > 110
    rgb = a[..., :3]
    return (rgb.min(-1) < 235) | (np.abs(rgb.max(-1) - rgb.min(-1)) > 18)


def label_components(mask: np.ndarray, step: int = 4):
    """Etiquetado de componentes conexos sobre una versión reducida (union-find simple)."""
    h, w = mask.shape
    small = mask[: h - h % step, : w - w % step].reshape(h // step, step, w // step, step).mean((1, 3)) > 0.15
    sh, sw = small.shape
    labels = np.zeros((sh, sw), np.int32)
    parent = [0]

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    nxt = 1
    for y in range(sh):
        for x in range(sw):
            if not small[y, x]:
                continue
            ns = []
            if x > 0 and labels[y, x - 1]:
                ns.append(labels[y, x - 1])
            if y > 0 and labels[y - 1, x]:
                ns.append(labels[y - 1, x])
            if y > 0 and x > 0 and labels[y - 1, x - 1]:
                ns.append(labels[y - 1, x - 1])
            if y > 0 and x < sw - 1 and labels[y - 1, x + 1]:
                ns.append(labels[y - 1, x + 1])
            if not ns:
                parent.append(nxt)
                labels[y, x] = nxt
                nxt += 1
            else:
                m = min(find(n) for n in ns)
                labels[y, x] = m
                for n in ns:
                    parent[find(n)] = m
    comps = {}
    for y in range(sh):
        for x in range(sw):
            l = labels[y, x]
            if l:
                r = find(l)
                c = comps.setdefault(r, [x, y, x, y, 0])
                c[0] = min(c[0], x); c[1] = min(c[1], y)
                c[2] = max(c[2], x); c[3] = max(c[3], y); c[4] += 1
    return [(c[0] * step, c[1] * step, (c[2] + 1) * step, (c[3] + 1) * step, c[4] * step * step) for c in comps.values()]


def clean_alpha(img: Image.Image) -> Image.Image:
    """Quita fondo blanco/halos y suaviza el borde (antialias)."""
    a = np.asarray(img.convert("RGBA")).astype(np.float32)
    rgb, alpha = a[..., :3], a[..., 3]
    whiteness = rgb.min(-1)
    if (alpha < 250).mean() > 0.05:
        al = np.clip((alpha - 90) / (200 - 90), 0, 1)
    else:
        al = np.clip((250 - whiteness) / 25, 0, 1)
    m = Image.fromarray((al * 255).astype(np.uint8), "L").filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    out = np.dstack([rgb, np.asarray(m).astype(np.float32)]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def keep_largest(img: Image.Image) -> Image.Image:
    """Elimina restos de otros íconos que quedaron dentro de la caja."""
    mask = np.asarray(img)[..., 3] > 40
    comps = label_components(mask, step=2)
    if len(comps) <= 1:
        return img
    big = max(c[4] for c in comps)
    keep = np.zeros_like(mask)
    for x0, y0, x1, y1, area in comps:
        if area >= big * 0.08:
            keep[y0:y1, x0:x1] = True
    a = np.asarray(img).copy()
    a[..., 3] = np.where(keep, a[..., 3], 0)
    return Image.fromarray(a, "RGBA")


def slice_sheet():
    sheet = Image.open(SRC / "items-sheet.png").convert("RGBA")
    W, H = sheet.size
    mask = foreground_mask(sheet)
    comps = [c for c in label_components(mask) if c[4] > 600]
    cw, ch = W / COLS, H / ROWS
    cells = {}
    for x0, y0, x1, y1, area in comps:
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        row = int(cy // ch)
        if row >= ROWS:
            continue
        col = int(cx // (W / len(IDS[row])))  # filas incompletas se reparten en todo el ancho
        if col >= len(IDS[row]):
            continue
        box = cells.get((row, col))
        cells[(row, col)] = [x0, y0, x1, y1] if not box else [min(box[0], x0), min(box[1], y0), max(box[2], x1), max(box[3], y1)]
    OUT.mkdir(parents=True, exist_ok=True)
    for r, row in enumerate(IDS):
        for c, item_id in enumerate(row):
            box = cells.get((r, c))
            if not box:
                print("SIN DETECTAR:", item_id)
                continue
            pad = 6
            x0, y0, x1, y1 = max(0, box[0] - pad), max(0, box[1] - pad), min(W, box[2] + pad), min(H, box[3] + pad)
            crop = keep_largest(clean_alpha(sheet.crop((x0, y0, x1, y1))))
            bbox = crop.getbbox() or (0, 0, crop.width, crop.height)
            crop = crop.crop(bbox)
            scale = 232 / max(crop.size)
            crop = crop.resize((max(1, round(crop.width * scale)), max(1, round(crop.height * scale))), Image.LANCZOS)
            canvas = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
            canvas.paste(crop, ((256 - crop.width) // 2, (256 - crop.height) // 2), crop)
            canvas.save(OUT / f"{item_id}.png", optimize=True)
            print("ok", item_id, (x0, y0, x1, y1))


def clean_patient(name):
    src = SRC / f"{name}-src.png"
    if not src.exists():
        print("no existe", src)
        return
    img = clean_alpha(Image.open(src))
    img = img.crop(img.getbbox())
    # Reducimos a un tamaño razonable para la web
    target_h = 1100
    img = img.resize((round(img.width * target_h / img.height), target_h), Image.LANCZOS)
    img.save(ROOT / "assets" / f"{name}.png", optimize=True)
    print("ok", name, img.size)


if __name__ == "__main__":
    slice_sheet()
    clean_patient("patient-m")
    clean_patient("patient-f")
