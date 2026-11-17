"""Base de datos SQLite y carga masiva desde Excel."""
import io
import re
import sqlite3
import unicodedata
from pathlib import Path

from openpyxl import Workbook, load_workbook

DB_PATH = Path(__file__).with_name("productos.db")

# Nombre canónico -> alias aceptados en el encabezado del Excel (sin tildes, minúsculas)
ALIASES = {
    "producto": {"producto", "nombre", "nombre producto", "nombre del producto"},
    "marca": {"marca", "fabricante"},
    "tipo": {"tipo", "categoria", "clase"},
    "ingrediente_activo": {"ingrediente activo", "ingrediente", "activo", "i.a.", "ia"},
    "formulacion": {"formulacion", "formulado"},
    "densidad": {"densidad", "densidad g/ml", "densidad (g/ml)", "densidad g/cm3", "densidad (g/cm3)"},
}
REQUERIDAS = ("producto", "densidad")
ENCABEZADOS_PLANTILLA = ["Producto", "Marca", "Tipo", "Ingrediente activo", "Formulación", "Densidad (g/mL)"]


def norm(texto):
    """Minúsculas, sin tildes y con espacios simples: para comparar y buscar."""
    t = unicodedata.normalize("NFKD", str(texto or ""))
    t = "".join(c for c in t if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", t).strip().lower()


def conectar():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute(
        """CREATE TABLE IF NOT EXISTS productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            producto TEXT NOT NULL,
            marca TEXT NOT NULL DEFAULT '',
            tipo TEXT NOT NULL DEFAULT '',
            ingrediente_activo TEXT NOT NULL DEFAULT '',
            formulacion TEXT NOT NULL DEFAULT '',
            densidad REAL NOT NULL CHECK (densidad > 0),
            clave TEXT NOT NULL UNIQUE
        )"""
    )
    return con


def _clave(producto, marca):
    return f"{norm(producto)}|{norm(marca)}"


def _numero(valor):
    """Acepta 1.12, '1,12' o '1.12 g/mL'. Devuelve float o None."""
    if isinstance(valor, (int, float)):
        return float(valor)
    m = re.search(r"\d+(?:[.,]\d+)?", str(valor or ""))
    return float(m.group().replace(",", ".")) if m else None


def importar_excel(contenido, reemplazar=False):
    """Fusiona el Excel (bytes) en la base. Devuelve un resumen con errores por fila."""
    try:
        ws = load_workbook(io.BytesIO(contenido), read_only=True, data_only=True).active
    except Exception as exc:  # archivo corrupto o no es xlsx
        raise ValueError("No se pudo leer el archivo. Debe ser un Excel .xlsx.") from exc

    filas = ws.iter_rows(values_only=True)
    encabezado = next(filas, None)
    if not encabezado:
        raise ValueError("El Excel está vacío.")

    columnas = {}
    for i, celda in enumerate(encabezado):
        for canon, alias in ALIASES.items():
            if norm(celda) in alias and canon not in columnas:
                columnas[canon] = i
    faltan = [c for c in REQUERIDAS if c not in columnas]
    if faltan:
        raise ValueError("Faltan columnas obligatorias: " + ", ".join(faltan))

    def dato(fila, canon):
        i = columnas.get(canon)
        v = fila[i] if i is not None and i < len(fila) else None
        return "" if v is None else str(v).strip()

    nuevos = actualizados = 0
    errores = []
    con = conectar()
    with con:
        if reemplazar:
            con.execute("DELETE FROM productos")
        for n, fila in enumerate(filas, start=2):
            if not any(c not in (None, "") for c in fila):
                continue
            nombre = dato(fila, "producto")
            dens = _numero(fila[columnas["densidad"]] if columnas["densidad"] < len(fila) else None)
            if not nombre:
                errores.append(f"Fila {n}: falta el nombre del producto")
            elif dens is None or dens <= 0:
                errores.append(f"Fila {n} ({nombre}): densidad inválida")
            else:
                valores = (nombre, dato(fila, "marca"), dato(fila, "tipo"),
                           dato(fila, "ingrediente_activo"), dato(fila, "formulacion"), dens)
                clave = _clave(nombre, valores[1])
                existe = con.execute("SELECT 1 FROM productos WHERE clave=?", (clave,)).fetchone()
                con.execute(
                    """INSERT INTO productos (producto, marca, tipo, ingrediente_activo, formulacion, densidad, clave)
                       VALUES (?,?,?,?,?,?,?)
                       ON CONFLICT(clave) DO UPDATE SET producto=excluded.producto, marca=excluded.marca,
                         tipo=excluded.tipo, ingrediente_activo=excluded.ingrediente_activo,
                         formulacion=excluded.formulacion, densidad=excluded.densidad""",
                    valores + (clave,),
                )
                if existe:
                    actualizados += 1
                else:
                    nuevos += 1
    total = con.execute("SELECT COUNT(*) FROM productos").fetchone()[0]
    con.close()
    return {"nuevos": nuevos, "actualizados": actualizados, "errores": errores, "total": total}


def buscar(q, limite=15):
    """Busca por nombre, marca, tipo o ingrediente activo (sin tildes ni mayúsculas)."""
    con = conectar()
    filas = [dict(f) for f in con.execute("SELECT * FROM productos ORDER BY producto, marca")]
    con.close()
    palabras = norm(q).split()
    if not palabras:
        return []
    def texto(f):
        return norm(" ".join((f["producto"], f["marca"], f["tipo"], f["ingrediente_activo"])))
    hallados = [f for f in filas if all(p in texto(f) for p in palabras)]
    hallados.sort(key=lambda f: not norm(f["producto"]).startswith(palabras[0]))
    return hallados[:limite]


def convertir(producto_id, peso, unidad):
    """Peso -> volumen. Devuelve dict con cm3, mL y litros."""
    gramos = {"g": 1.0, "kg": 1000.0}[unidad] * peso
    con = conectar()
    fila = con.execute("SELECT * FROM productos WHERE id=?", (producto_id,)).fetchone()
    con.close()
    if fila is None:
        raise LookupError("Producto no encontrado")
    cm3 = gramos / fila["densidad"]  # 1 g/mL = 1 g/cm³
    return {"producto": dict(fila), "cm3": cm3, "litros": cm3 / 1000}


def plantilla_excel():
    wb = Workbook()
    ws = wb.active
    ws.title = "Productos"
    ws.append(ENCABEZADOS_PLANTILLA)
    ws.append(["Ejemplo Fungicida 250 EC", "AgroEjemplo", "Fungicida", "Tebuconazol", "EC", 0.97])
    ws.append(["Ejemplo Herbicida SL", "AgroEjemplo", "Herbicida", "Glifosato", "SL", 1.17])
    for col, ancho in zip("ABCDEF", (30, 18, 16, 22, 14, 16)):
        ws.column_dimensions[col].width = ancho
    salida = io.BytesIO()
    wb.save(salida)
    return salida.getvalue()
