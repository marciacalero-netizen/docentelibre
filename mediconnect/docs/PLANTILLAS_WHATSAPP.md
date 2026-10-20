# Plantillas de WhatsApp (recordatorios y encuesta)

WhatsApp solo permite que el centro escriba **libremente** a un paciente dentro de las **24 horas** desde el último
mensaje del paciente. Fuera de ese plazo, todo mensaje que inicie el centro debe usar una **plantilla aprobada por Meta**.
Meta cobra cada mensaje enviado con plantilla (tarifa por país y categoría; ver la sección de precios de WhatsApp Manager).

MediConnect usa dos plantillas:

| Uso | Nombre sugerido | Categoría | Idioma |
|---|---|---|---|
| Recordatorio de cita (24 h antes) | `recordatorio_cita` | Utilidad | Español (`es`) |
| Encuesta de satisfacción (2 h después de marcar la cita «Atendida») | `encuesta_atencion` | Utilidad | Español (`es`) |

## Crear las plantillas

1. WhatsApp Manager → **Administrar plantillas** → **Crear plantilla**.
2. Categoría **Utilidad**, nombre y idioma de la tabla. Sin encabezado, sin pie y sin botones.
3. Copie el **cuerpo** exactamente como está abajo (las variables `{{1}}`, `{{2}}`… las llena MediConnect).
4. Meta pide un **ejemplo** para cada variable: use los de abajo.
5. Envíe a revisión. Cuando diga **Aprobada**, escriba el nombre en el panel: **Configuración → Mensajes automáticos**.

### recordatorio_cita

```
Hola, le recordamos la cita de {{1}} ({{2}}) en {{3}} el {{4}}. Responda CONFIRMO para confirmar, REAGENDAR para cambiarla o CANCELAR para anularla.
```

Ejemplos: `{{1}}` María Pérez · `{{2}}` Ginecología · `{{3}}` Centro ProSalud · `{{4}}` martes 15 de octubre, 09:00

### encuesta_atencion

```
Hola, gracias por visitarnos en {{1}}. ¿Cómo calificaría la atención recibida en su cita de {{2}}? Responda con un número del 1 (muy mala) al 5 (excelente).
```

Ejemplos: `{{1}}` Centro ProSalud · `{{2}}` Ginecología

## Cómo se comporta

- Si el paciente escribió en las últimas 24 h, el mensaje sale como texto normal (sin plantilla y sin costo de plantilla).
- Si no, sale con la plantilla. Si falta la plantilla o Meta la rechaza:
  - **Recordatorio:** aparece una alerta en el panel para contactar al paciente por otra vía.
  - **Encuesta:** simplemente no se envía.
- La encuesta se pide como máximo **una vez cada 7 días** por número, solo entre las 09:00 y las 20:00, y nunca si
  recepción está atendiendo ese chat. Una calificación de 1 o 2 pide un comentario. Los resultados están en
  **Estadísticas → Satisfacción de los pacientes**.
- Meta puede cambiar la categoría de la encuesta a **Marketing** (tarifa distinta). Si eso pasa, se puede aceptar o
  desactivar la encuesta en Configuración.
