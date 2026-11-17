import io
import os
import tempfile
import unittest
from pathlib import Path

from openpyxl import Workbook

import db


def excel(filas, encabezado=("Producto", "Marca", "Tipo", "Ingrediente activo", "Formulación", "Densidad")):
    wb = Workbook()
    ws = wb.active
    ws.append(list(encabezado))
    for f in filas:
        ws.append(list(f))
    b = io.BytesIO()
    wb.save(b)
    return b.getvalue()


class Pruebas(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        db.DB_PATH = Path(self.tmp.name) / "t.db"

    def tearDown(self):
        self.tmp.cleanup()

    def test_importar_fusionar_y_convertir(self):
        r = db.importar_excel(excel([
            ("Amistar Top", "Syngenta", "Fungicida", "Azoxistrobina", "SC", "1,12"),
            ("Roundup", "Bayer", "Herbicida", "Glifosato", "SL", 1.17),
            ("Malo", "X", "Y", "", "", "abc"),
        ]))
        self.assertEqual((r["nuevos"], r["actualizados"], len(r["errores"])), (2, 0, 1))
        r = db.importar_excel(excel([("AMISTAR top", "syngenta", "Fungicida", "", "", 1.2),
                                     ("Nuevo", "Z", "Fungicida", "", "", 1.0)]))
        self.assertEqual((r["nuevos"], r["actualizados"], r["total"]), (1, 1, 3))
        p = db.buscar("amistar")[0]
        self.assertEqual(p["densidad"], 1.2)
        v = db.convertir(p["id"], 6, "kg")
        self.assertAlmostEqual(v["cm3"], 5000)
        self.assertAlmostEqual(v["litros"], 5)

    def test_reemplazar_y_busqueda_sin_tildes(self):
        db.importar_excel(excel([("Fungicída A", "M", "Fungicida", "", "", 1)]))
        self.assertEqual(len(db.buscar("fungicida a")), 1)
        r = db.importar_excel(excel([("B", "M", "Herbicida", "", "", 1)]), reemplazar=True)
        self.assertEqual(r["total"], 1)

    def test_columnas_faltantes(self):
        with self.assertRaises(ValueError):
            db.importar_excel(excel([("A", 1)], encabezado=("Producto", "Marca")))
        with self.assertRaises(ValueError):
            db.importar_excel(b"no es un excel")

    def test_plantilla_se_importa(self):
        r = db.importar_excel(db.plantilla_excel())
        self.assertEqual((r["nuevos"], r["errores"]), (2, []))


if __name__ == "__main__":
    unittest.main()
