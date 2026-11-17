# Conversor peso → volumen (agroquímicos)

Digite el producto y su peso; la app devuelve el volumen en cm³ y litros usando la densidad guardada.

    cm³ = gramos / densidad (g/mL)      litros = cm³ / 1000

## Uso

    pip install -r requirements.txt
    python app.py            # abrir http://localhost:8000 (PORT=9000 para otro puerto)

1. **Carga masiva**: descargue la plantilla (`/plantilla.xlsx`), llénela y súbala. Columnas:
   Producto, Marca, Tipo, Ingrediente activo, Formulación, Densidad (g/mL). Solo Producto y Densidad son obligatorias;
   los encabezados aceptan variantes y la densidad puede escribirse con coma (1,12).
2. Cada carga **fusiona**: agrega los nuevos y actualiza los existentes (mismo nombre + marca). Marque
   "Reemplazar toda la base" para empezar de cero. Las filas con error se informan sin detener la carga.
3. **Calcular**: escriba el nombre (o marca/tipo/ingrediente), elija el producto, digite el peso en kg o g.

Los datos quedan en `productos.db` (SQLite). Pruebas: `python -m unittest`.
