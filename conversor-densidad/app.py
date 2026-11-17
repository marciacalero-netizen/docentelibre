"""Conversor peso -> volumen para agroquímicos. Solo requiere openpyxl.

Uso:  python app.py   y abrir http://localhost:8000
"""
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import db

STATIC = Path(__file__).with_name("static")
MAX_BYTES = 20 * 1024 * 1024
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


class Handler(BaseHTTPRequestHandler):
    def _enviar(self, codigo, cuerpo, tipo="application/json", extra=None):
        if isinstance(cuerpo, (dict, list)):
            cuerpo = json.dumps(cuerpo, ensure_ascii=False).encode()
        self.send_response(codigo)
        self.send_header("Content-Type", tipo + ("; charset=utf-8" if tipo.startswith("text") or tipo == "application/json" else ""))
        self.send_header("Content-Length", str(len(cuerpo)))
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(cuerpo)

    def do_GET(self):
        url = urlparse(self.path)
        q = parse_qs(url.query)
        if url.path == "/":
            self._enviar(200, (STATIC / "index.html").read_bytes(), "text/html")
        elif url.path == "/api/buscar":
            self._enviar(200, db.buscar(q.get("q", [""])[0]))
        elif url.path == "/api/convertir":
            try:
                peso = float(q.get("peso", [""])[0].replace(",", "."))
                unidad = q.get("unidad", ["kg"])[0]
                if peso < 0 or unidad not in ("g", "kg"):
                    raise ValueError
                self._enviar(200, db.convertir(int(q.get("id", [""])[0]), peso, unidad))
            except LookupError as e:
                self._enviar(404, {"error": str(e)})
            except ValueError:
                self._enviar(400, {"error": "Peso, unidad o producto inválido"})
        elif url.path == "/plantilla.xlsx":
            self._enviar(200, db.plantilla_excel(), XLSX,
                         {"Content-Disposition": 'attachment; filename="plantilla_productos.xlsx"'})
        else:
            self._enviar(404, {"error": "No encontrado"})

    def do_POST(self):
        url = urlparse(self.path)
        if url.path != "/api/importar":
            return self._enviar(404, {"error": "No encontrado"})
        largo = int(self.headers.get("Content-Length") or 0)
        if not 0 < largo <= MAX_BYTES:
            return self._enviar(400, {"error": "Archivo vacío o mayor a 20 MB"})
        reemplazar = parse_qs(url.query).get("modo", ["fusionar"])[0] == "reemplazar"
        try:
            self._enviar(200, db.importar_excel(self.rfile.read(largo), reemplazar))
        except ValueError as e:
            self._enviar(400, {"error": str(e)})

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    db.conectar().close()
    puerto = int(os.environ.get("PORT", 8000))
    print(f"Conversor listo en http://localhost:{puerto}  (Ctrl+C para salir)")
    ThreadingHTTPServer(("0.0.0.0", puerto), Handler).serve_forever()
