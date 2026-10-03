# Textos que ve el paciente — Centro ProSalud (asistente SALUD)

> Documento **generado automáticamente** ejecutando el asistente real (128 mensajes). Si se cambia algún texto, se vuelve a generar con `npm run textos:prosalud`.

## Cómo revisarlo

1. Lea cada escenario como si fuera el paciente. Las líneas **Paciente:** son lo que escribe; las citas con `>` son lo que responde el asistente, **tal como llegará por WhatsApp**.
2. En WhatsApp, `*texto*` se ve en **negrita** y `_texto_` en _cursiva_; aquí se muestran con los asteriscos para que sea el texto exacto.
3. Anote correcciones en **Observaciones del revisor** (tono, datos incorrectos, cosas que falta decir o que sobran).
4. Marque con ✅ lo aprobado y con ✏️ lo que se debe cambiar.

## Datos de ejemplo (NO son reales)

Este documento usa una base temporal. Estos datos son **ficticios** y no deben revisarse: médicos («Dra. Ejemplo Uno»…), sus horarios, precios de Medicina General ($20) y Pediatría ($25), horario de recepción (lunes a viernes 8:00–18:00 y sábados 8:00–13:00), nombre de la persona de guardia, enlace de mapa y los números de WhatsApp de las áreas (los enlaces `wa.me/593000000000`). Las **fechas de las citas** corresponden al día en que se generó el documento.

## Dónde se cambia cada texto

| Texto | Dónde se cambia |
|---|---|
| Nombre del asistente (SALUD), respuesta sobre resultados, número de emergencias, horario, guardia | Panel → Configuración |
| Mensaje de Laboratorio, Rayos X, Odontología y Procedimientos; WhatsApp de cada área; emoji y palabras clave | Panel → Especialidades y servicios |
| Dirección | Panel → Configuración |
| El resto (saludo, menú, consentimiento, flujos de cita, mensajes de seguridad) | Código del asistente: envíe sus correcciones y se aplican |

**Pregunta de estilo para quien revise:** el asistente tutea al paciente («tú», «tu cita»). ¿Prefieren tratar de «usted»? Es un cambio simple en todo el documento.

**Frases que conviene validar con especial cuidado:** el aviso de consentimiento (A/C/D), los mensajes de emergencia y salud mental (I1, I2), la respuesta de «no puedo dar diagnósticos» (I3) y la información de laboratorio y resultados (G3, H1).

## A. Inicio y mensajes que no entiende

### A1. Saludo y menú principal

_El nombre «SALUD» y el nombre del centro salen de Configuración._

**Paciente:** Hola

> ¡Hola! 👋 Soy *SALUD*, el asistente virtual de *Centro ProSalud*. Atiendo por WhatsApp las 24 horas.
>
> ¿En qué puedo ayudarte?
>
> *1.* Agendar una cita
> *2.* Reagendar una cita
> *3.* Cancelar una cita
> *4.* Ver disponibilidad
> *5.* Especialidades y servicios
> *6.* Horarios, precios y ubicación
> *7.* Hablar con recepción
>
> Responde con el número o escríbeme tu consulta.

**Observaciones del revisor:** ______________________________________________

---

### A2. Mensaje que no entiende (una vez y tres veces seguidas)

**Paciente:** asdf qwer

> No estoy seguro de haber entendido 🤔. Estas son las opciones disponibles:

> *1.* Agendar una cita
> *2.* Reagendar una cita
> *3.* Cancelar una cita
> *4.* Ver disponibilidad
> *5.* Especialidades y servicios
> *6.* Horarios, precios y ubicación
> *7.* Hablar con recepción
>
> Responde con el número o escríbeme tu consulta.

**Paciente:** zzzz

> No estoy seguro de haber entendido 🤔. Estas son las opciones disponibles:

> *1.* Agendar una cita
> *2.* Reagendar una cita
> *3.* Cancelar una cita
> *4.* Ver disponibilidad
> *5.* Especialidades y servicios
> *6.* Horarios, precios y ubicación
> *7.* Hablar con recepción
>
> Responde con el número o escríbeme tu consulta.

**Paciente:** xxxx

> Parece que no logro entenderte 😅. Si prefieres, escribe *recepción* y una persona te atenderá.

**Observaciones del revisor:** ______________________________________________

---

### A3. Agradecimiento

**Paciente:** muchas gracias

> ¡Con gusto! 😊 Si necesitas algo más, escribe *menú*.

**Observaciones del revisor:** ______________________________________________

---


## B. Información general

### B1. Especialidades y servicios (opción 5 del menú)

_Se arma con la lista de «Especialidades y servicios» del panel._

**Paciente:** hola

> ¡Hola! 👋 Soy *SALUD*, el asistente virtual de *Centro ProSalud*. Atiendo por WhatsApp las 24 horas.
>
> ¿En qué puedo ayudarte?
>
> *1.* Agendar una cita
> *2.* Reagendar una cita
> *3.* Cancelar una cita
> *4.* Ver disponibilidad
> *5.* Especialidades y servicios
> *6.* Horarios, precios y ubicación
> *7.* Hablar con recepción
>
> Responde con el número o escríbeme tu consulta.

**Paciente:** 5

> *Especialidades y servicios de Centro ProSalud*
>
> • ❤️ Cardiología
> • 🧴 Dermatología
> • 🌸 Ginecología
> • 🩻 Imágenes y Rayos X — _atención directa con el área_
> • 🧪 Laboratorio Clínico — _atención directa con el área_
> • 🩺 Medicina General — $20
> • 🦷 Odontología — _atención directa con el área_
> • 👓 Optometría
> • 👶 Pediatría — $25
> • 💉 Procedimientos Clínicos — _atención directa con el área_
> • 🧠 Psicología
> • 🦴 Traumatología
>
> Para reservar escribe *agendar*; para ver los médicos escribe *médicos*.

**Observaciones del revisor:** ______________________________________________

---

### B2. Médicos y sus horarios

_[EJEMPLO] Los médicos mostrados son ficticios._

**Paciente:** ¿qué médicos tienen?

> *Nuestros profesionales*
>
> • *Dr. Ejemplo Dos* — Medicina General ($20)
>   🕒 lun 14:00–17:00 · mié 14:00–17:00 · vie 14:00–17:00
> • *Dra. Ejemplo Tres* — Pediatría ($25)
>   🕒 mar 09:00–13:00 · jue 09:00–13:00
> • *Dra. Ejemplo Uno* — Medicina General ($20)
>   🕒 lun 08:00–12:00 · mar 08:00–12:00 · mié 08:00–12:00 · jue 08:00–12:00 · vie 08:00–12:00
>
> Para reservar escribe *agendar*.

**Observaciones del revisor:** ______________________________________________

---

### B3. Horario de recepción

_[EJEMPLO] Horario ficticio._

**Paciente:** ¿cuál es el horario?

> *Horario de atención de recepción*
> • Lunes: 08:00–18:00
> • Martes: 08:00–18:00
> • Miércoles: 08:00–18:00
> • Jueves: 08:00–18:00
> • Viernes: 08:00–18:00
> • Sábado: 08:00–13:00
> • Domingo: cerrado
>
> Este asistente responde las 24 horas. Ahora mismo recepción está *abierta* ✅.

**Observaciones del revisor:** ______________________________________________

---

### B4. Horario consultado fuera de horario

**Paciente:** ¿a qué hora atienden?

> *Horario de atención de recepción*
> • Lunes: 08:00–18:00
> • Martes: 08:00–18:00
> • Miércoles: 08:00–18:00
> • Jueves: 08:00–18:00
> • Viernes: 08:00–18:00
> • Sábado: 08:00–13:00
> • Domingo: cerrado
>
> Este asistente responde las 24 horas. Ahora mismo recepción está *cerrada* 🌙, pero puedo agendar tu cita.

**Observaciones del revisor:** ______________________________________________

---

### B5. Valores de la consulta

_[EJEMPLO] Solo Medicina General y Pediatría tienen precio de ejemplo; los demás servicios dicen «consulta los valores con el área»._

**Paciente:** ¿cuánto cuesta la consulta?

> *Valor de la consulta*
> • 🩺 Medicina General: $20
> • 👶 Pediatría: $25
>
> Los valores pueden variar según el profesional y no incluyen exámenes o procedimientos.
> Para 🩻 Imágenes y Rayos X, 🧪 Laboratorio Clínico, 🦷 Odontología, 💉 Procedimientos Clínicos consulta los valores con el área.

**Observaciones del revisor:** ______________________________________________

---

### B6. Ubicación

**Paciente:** ¿dónde están ubicados?

> 📍 *Centro ProSalud*
> Cdla. Orquídeas, Mz. 1043, Solar 37 (frente a Créditos Económicos), Guayaquil
> 🗺️ https://maps.google.com/?q=[ENLACE-EJEMPLO]
>
> Te recomendamos llegar 10 minutos antes de tu cita.

**Observaciones del revisor:** ______________________________________________

---

### B7. Horarios, precios y ubicación juntos (opción 6)

**Paciente:** hola

> ¡Hola! 👋 Soy *SALUD*, el asistente virtual de *Centro ProSalud*. Atiendo por WhatsApp las 24 horas.
>
> ¿En qué puedo ayudarte?
>
> *1.* Agendar una cita
> *2.* Reagendar una cita
> *3.* Cancelar una cita
> *4.* Ver disponibilidad
> *5.* Especialidades y servicios
> *6.* Horarios, precios y ubicación
> *7.* Hablar con recepción
>
> Responde con el número o escríbeme tu consulta.

**Paciente:** 6

> *Horario de atención de recepción*
> • Lunes: 08:00–18:00
> • Martes: 08:00–18:00
> • Miércoles: 08:00–18:00
> • Jueves: 08:00–18:00
> • Viernes: 08:00–18:00
> • Sábado: 08:00–13:00
> • Domingo: cerrado
>
> Este asistente responde las 24 horas. Ahora mismo recepción está *abierta* ✅.

> *Valor de la consulta*
> • 🩺 Medicina General: $20
> • 👶 Pediatría: $25
>
> Los valores pueden variar según el profesional y no incluyen exámenes o procedimientos.
> Para 🩻 Imágenes y Rayos X, 🧪 Laboratorio Clínico, 🦷 Odontología, 💉 Procedimientos Clínicos consulta los valores con el área.

> 📍 *Centro ProSalud*
> Cdla. Orquídeas, Mz. 1043, Solar 37 (frente a Créditos Económicos), Guayaquil
> 🗺️ https://maps.google.com/?q=[ENLACE-EJEMPLO]
>
> Te recomendamos llegar 10 minutos antes de tu cita.

**Observaciones del revisor:** ______________________________________________

---


## C. Agendar una cita

### C1. Primera cita de un paciente nuevo (consentimiento, nombre, especialidad, médico, horario)

_Las fechas dependen del día en que se generó este documento. [EJEMPLO] Médicos y horarios ficticios._

**Paciente:** Hola

> ¡Hola! 👋 Soy *SALUD*, el asistente virtual de *Centro ProSalud*. Atiendo por WhatsApp las 24 horas.
>
> ¿En qué puedo ayudarte?
>
> *1.* Agendar una cita
> *2.* Reagendar una cita
> *3.* Cancelar una cita
> *4.* Ver disponibilidad
> *5.* Especialidades y servicios
> *6.* Horarios, precios y ubicación
> *7.* Hablar con recepción
>
> Responde con el número o escríbeme tu consulta.

**Paciente:** 1

> Para continuar necesito registrar tus datos (tu nombre y tu número de WhatsApp) con el único fin de gestionar tus citas en *Centro ProSalud*.
>
> 🔒 Se tratan conforme a la Ley Orgánica de Protección de Datos Personales de Ecuador (LOPDP), no se comparten con terceros no autorizados y puedes pedir acceso, rectificación o eliminación cuando quieras escribiendo *recepción*. *No te pediré información médica por este chat.*
>
> ¿Aceptas? Responde *SI* o *NO*.

**Paciente:** si

> Gracias, tu autorización quedó registrada ✅.

> ¿Para quién es la cita?
>
> *1.* Para mí
> *2.* Para otra persona (un familiar)

**Paciente:** 1

> Perfecto. ¿Cuál es tu *nombre y apellido*?

**Paciente:** maria fernanda zambrano

> ¿Con qué especialidad o servicio deseas tu cita?
>
> *1.* 🩻 Imágenes y Rayos X
> *2.* 🧪 Laboratorio Clínico
> *3.* 🩺 Medicina General — $20
> *4.* 🦷 Odontología
> *5.* 👶 Pediatría — $25
> *6.* 💉 Procedimientos Clínicos
>
> Responde con el número o el nombre. (Escribe *menú* para salir)

**Paciente:** medicina general

> ¿Con qué profesional?
>
> *1.* Dr. Ejemplo Dos — $20
> *2.* Dra. Ejemplo Uno — $20
> *3.* Cualquiera (el primer horario disponible)

**Paciente:** 1

> Estos son los próximos horarios disponibles con Dr. Ejemplo Dos:
>
> *1.* lunes 5 de octubre, 14:00
> *2.* lunes 5 de octubre, 14:20
> *3.* lunes 5 de octubre, 14:40
> *4.* miércoles 7 de octubre, 14:00
> *5.* miércoles 7 de octubre, 14:20
> *6.* miércoles 7 de octubre, 14:40
>
> Responde con el *número* de tu elección o *MÁS* para ver otros horarios.

**Paciente:** 1

> Por favor confirma los datos:
>
> 👤 Maria Fernanda Zambrano
> 🩺 Dr. Ejemplo Dos (Medicina General)
> 📅 lunes 5 de octubre, 14:00
> 💵 $20
>
> ¿Confirmas? Responde *SI* o *NO*.

**Paciente:** si

> ✅ *Cita confirmada*
>
> 🩺 Dr. Ejemplo Dos (Medicina General)
> 📅 lunes 5 de octubre, 14:00
> 📍 Cdla. Orquídeas, Mz. 1043, Solar 37 (frente a Créditos Económicos), Guayaquil
> 💵 $20
>
> Te enviaré un recordatorio 24 horas antes. Para reagendar o cancelar, escríbeme por aquí. Llega 10 minutos antes. 😊

**Observaciones del revisor:** ______________________________________________

---

### C2. El paciente NO acepta el consentimiento

**Paciente:** quiero agendar una cita

> Para continuar necesito registrar tus datos (tu nombre y tu número de WhatsApp) con el único fin de gestionar tus citas en *Centro ProSalud*.
>
> 🔒 Se tratan conforme a la Ley Orgánica de Protección de Datos Personales de Ecuador (LOPDP), no se comparten con terceros no autorizados y puedes pedir acceso, rectificación o eliminación cuando quieras escribiendo *recepción*. *No te pediré información médica por este chat.*
>
> ¿Aceptas? Responde *SI* o *NO*.

**Paciente:** no

> Entendido. Sin tu autorización no puedo registrar datos ni agendar por este medio. Puedo darte información general (escribe *menú*) o puedes escribir *recepción* para que una persona te ayude.

**Observaciones del revisor:** ______________________________________________

---

### C3. Respuesta inválida en el consentimiento

**Paciente:** quiero agendar una cita

> Para continuar necesito registrar tus datos (tu nombre y tu número de WhatsApp) con el único fin de gestionar tus citas en *Centro ProSalud*.
>
> 🔒 Se tratan conforme a la Ley Orgánica de Protección de Datos Personales de Ecuador (LOPDP), no se comparten con terceros no autorizados y puedes pedir acceso, rectificación o eliminación cuando quieras escribiendo *recepción*. *No te pediré información médica por este chat.*
>
> ¿Aceptas? Responde *SI* o *NO*.

**Paciente:** quizás

> Necesito que respondas *SI* o *NO*: ¿aceptas que registremos tu nombre y tu número de WhatsApp para gestionar tus citas?

**Paciente:** tal vez

> Necesito que respondas *SI* o *NO*: ¿aceptas que registremos tu nombre y tu número de WhatsApp para gestionar tus citas?

**Observaciones del revisor:** ______________________________________________

---

### C4. Nombre inválido, pedir más horarios y elegir otro horario

**Paciente:** agendar

> Para continuar necesito registrar tus datos (tu nombre y tu número de WhatsApp) con el único fin de gestionar tus citas en *Centro ProSalud*.
>
> 🔒 Se tratan conforme a la Ley Orgánica de Protección de Datos Personales de Ecuador (LOPDP), no se comparten con terceros no autorizados y puedes pedir acceso, rectificación o eliminación cuando quieras escribiendo *recepción*. *No te pediré información médica por este chat.*
>
> ¿Aceptas? Responde *SI* o *NO*.

**Paciente:** si

> Gracias, tu autorización quedó registrada ✅.

> ¿Para quién es la cita?
>
> *1.* Para mí
> *2.* Para otra persona (un familiar)

**Paciente:** 1

> Perfecto. ¿Cuál es tu *nombre y apellido*?

**Paciente:** 12345

> Escribe el *nombre y apellido*, por favor (solo letras, sin números).

**Paciente:** Luis Pérez Mora

> ¿Con qué especialidad o servicio deseas tu cita?
>
> *1.* 🩻 Imágenes y Rayos X
> *2.* 🧪 Laboratorio Clínico
> *3.* 🩺 Medicina General — $20
> *4.* 🦷 Odontología
> *5.* 👶 Pediatría — $25
> *6.* 💉 Procedimientos Clínicos
>
> Responde con el número o el nombre. (Escribe *menú* para salir)

**Paciente:** pediatria

> Estos son los próximos horarios disponibles con Dra. Ejemplo Tres:
>
> *1.* martes 6 de octubre, 09:00
> *2.* martes 6 de octubre, 09:20
> *3.* martes 6 de octubre, 09:40
> *4.* jueves 8 de octubre, 09:00
> *5.* jueves 8 de octubre, 09:20
> *6.* jueves 8 de octubre, 09:40
>
> Responde con el *número* de tu elección o *MÁS* para ver otros horarios.

**Paciente:** más

> Estos son los próximos horarios disponibles con Dra. Ejemplo Tres:
>
> *1.* martes 13 de octubre, 09:00
> *2.* martes 13 de octubre, 09:20
> *3.* martes 13 de octubre, 09:40
> *4.* jueves 15 de octubre, 09:00
> *5.* jueves 15 de octubre, 09:20
> *6.* jueves 15 de octubre, 09:40
>
> Responde con el *número* de tu elección o *MÁS* para ver otros horarios.

**Paciente:** 1

> Por favor confirma los datos:
>
> 👤 Luis Pérez Mora
> 🩺 Dra. Ejemplo Tres (Pediatría)
> 📅 martes 13 de octubre, 09:00
> 💵 $25
>
> ¿Confirmas? Responde *SI* o *NO*.

**Paciente:** no

> Sin problema, busquemos otro horario.

> Estos son los próximos horarios disponibles con Dra. Ejemplo Tres:
>
> *1.* martes 13 de octubre, 09:00
> *2.* martes 13 de octubre, 09:20
> *3.* martes 13 de octubre, 09:40
> *4.* jueves 15 de octubre, 09:00
> *5.* jueves 15 de octubre, 09:20
> *6.* jueves 15 de octubre, 09:40
>
> Responde con el *número* de tu elección o *MÁS* para ver otros horarios.

**Paciente:** 1

> Por favor confirma los datos:
>
> 👤 Luis Pérez Mora
> 🩺 Dra. Ejemplo Tres (Pediatría)
> 📅 martes 13 de octubre, 09:00
> 💵 $25
>
> ¿Confirmas? Responde *SI* o *NO*.

**Paciente:** si

> ✅ *Cita confirmada*
>
> 🩺 Dra. Ejemplo Tres (Pediatría)
> 📅 martes 13 de octubre, 09:00
> 📍 Cdla. Orquídeas, Mz. 1043, Solar 37 (frente a Créditos Económicos), Guayaquil
> 💵 $25
>
> Te enviaré un recordatorio 24 horas antes. Para reagendar o cancelar, escríbeme por aquí. Llega 10 minutos antes. 😊

**Observaciones del revisor:** ______________________________________________

---

### C5. Servicio escrito en el mensaje inicial (el asistente lo recuerda y se salta la pregunta de especialidad)

**Paciente:** quiero una cita con el pediatra

> Para continuar necesito registrar tus datos (tu nombre y tu número de WhatsApp) con el único fin de gestionar tus citas en *Centro ProSalud*.
>
> 🔒 Se tratan conforme a la Ley Orgánica de Protección de Datos Personales de Ecuador (LOPDP), no se comparten con terceros no autorizados y puedes pedir acceso, rectificación o eliminación cuando quieras escribiendo *recepción*. *No te pediré información médica por este chat.*
>
> ¿Aceptas? Responde *SI* o *NO*.

**Paciente:** si

> Gracias, tu autorización quedó registrada ✅.

> ¿Para quién es la cita?
>
> *1.* Para mí
> *2.* Para otra persona (un familiar)

**Paciente:** 1

> Perfecto. ¿Cuál es tu *nombre y apellido*?

**Paciente:** Pedro Gil Mora

> Estos son los próximos horarios disponibles con Dra. Ejemplo Tres:
>
> *1.* martes 6 de octubre, 09:00
> *2.* martes 6 de octubre, 09:20
> *3.* martes 6 de octubre, 09:40
> *4.* jueves 8 de octubre, 09:00
> *5.* jueves 8 de octubre, 09:20
> *6.* jueves 8 de octubre, 09:40
>
> Responde con el *número* de tu elección o *MÁS* para ver otros horarios.

**Observaciones del revisor:** ______________________________________________

---


## D. Familiares bajo un mismo número

### D1. El titular agenda para sí mismo

**Paciente:** Hola

> ¡Hola! 👋 Soy *SALUD*, el asistente virtual de *Centro ProSalud*. Atiendo por WhatsApp las 24 horas.
>
> ¿En qué puedo ayudarte?
>
> *1.* Agendar una cita
> *2.* Reagendar una cita
> *3.* Cancelar una cita
> *4.* Ver disponibilidad
> *5.* Especialidades y servicios
> *6.* Horarios, precios y ubicación
> *7.* Hablar con recepción
>
> Responde con el número o escríbeme tu consulta.

**Paciente:** 1

> Para continuar necesito registrar tus datos (tu nombre y tu número de WhatsApp) con el único fin de gestionar tus citas en *Centro ProSalud*.
>
> 🔒 Se tratan conforme a la Ley Orgánica de Protección de Datos Personales de Ecuador (LOPDP), no se comparten con terceros no autorizados y puedes pedir acceso, rectificación o eliminación cuando quieras escribiendo *recepción*. *No te pediré información médica por este chat.*
>
> ¿Aceptas? Responde *SI* o *NO*.

**Paciente:** si

> Gracias, tu autorización quedó registrada ✅.

> ¿Para quién es la cita?
>
> *1.* Para mí
> *2.* Para otra persona (un familiar)

**Paciente:** 1

> Perfecto. ¿Cuál es tu *nombre y apellido*?

**Paciente:** Carla Rivera Soto

> ¿Con qué especialidad o servicio deseas tu cita?
>
> *1.* 🩻 Imágenes y Rayos X
> *2.* 🧪 Laboratorio Clínico
> *3.* 🩺 Medicina General — $20
> *4.* 🦷 Odontología
> *5.* 👶 Pediatría — $25
> *6.* 💉 Procedimientos Clínicos
>
> Responde con el número o el nombre. (Escribe *menú* para salir)

**Paciente:** medicina general

> ¿Con qué profesional?
>
> *1.* Dr. Ejemplo Dos — $20
> *2.* Dra. Ejemplo Uno — $20
> *3.* Cualquiera (el primer horario disponible)

**Paciente:** 1

> Estos son los próximos horarios disponibles con Dr. Ejemplo Dos:
>
> *1.* lunes 5 de octubre, 14:20
> *2.* lunes 5 de octubre, 14:40
> *3.* lunes 5 de octubre, 15:00
> *4.* miércoles 7 de octubre, 14:00
> *5.* miércoles 7 de octubre, 14:20
> *6.* miércoles 7 de octubre, 14:40
>
> Responde con el *número* de tu elección o *MÁS* para ver otros horarios.

**Paciente:** 1

> Por favor confirma los datos:
>
> 👤 Carla Rivera Soto
> 🩺 Dr. Ejemplo Dos (Medicina General)
> 📅 lunes 5 de octubre, 14:20
> 💵 $20
>
> ¿Confirmas? Responde *SI* o *NO*.

**Paciente:** si

> ✅ *Cita confirmada*
>
> 🩺 Dr. Ejemplo Dos (Medicina General)
> 📅 lunes 5 de octubre, 14:20
> 📍 Cdla. Orquídeas, Mz. 1043, Solar 37 (frente a Créditos Económicos), Guayaquil
> 💵 $20
>
> Te enviaré un recordatorio 24 horas antes. Para reagendar o cancelar, escríbeme por aquí. Llega 10 minutos antes. 😊

**Observaciones del revisor:** ______________________________________________

---

### D2. Luego agenda para un hijo (declaración de representante)

**Paciente:** agendar

> ¿Para quién es la cita?
>
> *1.* Para mí (Carla Rivera Soto)
> *2.* Para otra persona (un familiar)

**Paciente:** 2

> Perfecto. ¿Cuál es el *nombre y apellido* de la persona que será atendida?

**Paciente:** Mateo Rivera Soto

> ¿Con qué especialidad o servicio deseas tu cita?
>
> *1.* 🩻 Imágenes y Rayos X
> *2.* 🧪 Laboratorio Clínico
> *3.* 🩺 Medicina General — $20
> *4.* 🦷 Odontología
> *5.* 👶 Pediatría — $25
> *6.* 💉 Procedimientos Clínicos
>
> Responde con el número o el nombre. (Escribe *menú* para salir)

**Paciente:** pediatria

> Estos son los próximos horarios disponibles con Dra. Ejemplo Tres:
>
> *1.* martes 6 de octubre, 09:00
> *2.* martes 6 de octubre, 09:20
> *3.* martes 6 de octubre, 09:40
> *4.* jueves 8 de octubre, 09:00
> *5.* jueves 8 de octubre, 09:20
> *6.* jueves 8 de octubre, 09:40
>
> Responde con el *número* de tu elección o *MÁS* para ver otros horarios.

**Paciente:** 1

> Por favor confirma los datos:
>
> 👤 Mateo Rivera Soto
> 🩺 Dra. Ejemplo Tres (Pediatría)
> 📅 martes 6 de octubre, 09:00
> 💵 $25
>
> 👪 Registraré a esta persona como paciente bajo tu número. Al confirmar declaras ser su representante o contar con su autorización para tratar sus datos para gestionar sus citas.
>
> ¿Confirmas? Responde *SI* o *NO*.

**Paciente:** si

> ✅ *Cita confirmada*
>
> 🩺 Dra. Ejemplo Tres (Pediatría)
> 📅 martes 6 de octubre, 09:00
> 📍 Cdla. Orquídeas, Mz. 1043, Solar 37 (frente a Créditos Económicos), Guayaquil
> 💵 $25
>
> Te enviaré un recordatorio 24 horas antes. Para reagendar o cancelar, escríbeme por aquí. Llega 10 minutos antes. 😊

**Observaciones del revisor:** ______________________________________________

---

### D3. Ver todas las citas del número (aparecen por persona)

**Paciente:** mis citas

> *Tus próximas citas*
>
> • Carla Rivera Soto: lunes 5 de octubre, 14:20 — Dr. Ejemplo Dos (Medicina General)
> • Mateo Rivera Soto: martes 6 de octubre, 09:00 — Dra. Ejemplo Tres (Pediatría)
>
> Puedo *reagendar* o *cancelar* si lo necesitas.

**Observaciones del revisor:** ______________________________________________

---

### D4. Cancelar la cita de una de las personas

**Paciente:** cancelar mi cita

> ¿Cuál cita deseas cancelar?
>
> *1.* Carla Rivera Soto: lunes 5 de octubre, 14:20 — Dr. Ejemplo Dos (Medicina General)
> *2.* Mateo Rivera Soto: martes 6 de octubre, 09:00 — Dra. Ejemplo Tres (Pediatría)

**Paciente:** 2

> ¿Confirmas que deseas *cancelar* esta cita?
>
> • Mateo Rivera Soto: martes 6 de octubre, 09:00 — Dra. Ejemplo Tres (Pediatría)
>
> Responde *SI* para cancelar o *NO* para conservarla.

**Paciente:** si

> Tu cita fue *cancelada* ✅. Cuando quieras reservar otra, escribe *agendar*.

**Observaciones del revisor:** ______________________________________________

---


## E. Reagendar, cancelar y confirmar

### E1. Preparación: una cita nueva

**Paciente:** Hola

> ¡Hola! 👋 Soy *SALUD*, el asistente virtual de *Centro ProSalud*. Atiendo por WhatsApp las 24 horas.
>
> ¿En qué puedo ayudarte?
>
> *1.* Agendar una cita
> *2.* Reagendar una cita
> *3.* Cancelar una cita
> *4.* Ver disponibilidad
> *5.* Especialidades y servicios
> *6.* Horarios, precios y ubicación
> *7.* Hablar con recepción
>
> Responde con el número o escríbeme tu consulta.

**Paciente:** 1

> Para continuar necesito registrar tus datos (tu nombre y tu número de WhatsApp) con el único fin de gestionar tus citas en *Centro ProSalud*.
>
> 🔒 Se tratan conforme a la Ley Orgánica de Protección de Datos Personales de Ecuador (LOPDP), no se comparten con terceros no autorizados y puedes pedir acceso, rectificación o eliminación cuando quieras escribiendo *recepción*. *No te pediré información médica por este chat.*
>
> ¿Aceptas? Responde *SI* o *NO*.

**Paciente:** si

> Gracias, tu autorización quedó registrada ✅.

> ¿Para quién es la cita?
>
> *1.* Para mí
> *2.* Para otra persona (un familiar)

**Paciente:** 1

> Perfecto. ¿Cuál es tu *nombre y apellido*?

**Paciente:** Rosa Vera Ruiz

> ¿Con qué especialidad o servicio deseas tu cita?
>
> *1.* 🩻 Imágenes y Rayos X
> *2.* 🧪 Laboratorio Clínico
> *3.* 🩺 Medicina General — $20
> *4.* 🦷 Odontología
> *5.* 👶 Pediatría — $25
> *6.* 💉 Procedimientos Clínicos
>
> Responde con el número o el nombre. (Escribe *menú* para salir)

**Paciente:** medicina general

> ¿Con qué profesional?
>
> *1.* Dr. Ejemplo Dos — $20
> *2.* Dra. Ejemplo Uno — $20
> *3.* Cualquiera (el primer horario disponible)

**Paciente:** 1

> Estos son los próximos horarios disponibles con Dr. Ejemplo Dos:
>
> *1.* lunes 5 de octubre, 14:40
> *2.* lunes 5 de octubre, 15:00
> *3.* lunes 5 de octubre, 15:20
> *4.* miércoles 7 de octubre, 14:00
> *5.* miércoles 7 de octubre, 14:20
> *6.* miércoles 7 de octubre, 14:40
>
> Responde con el *número* de tu elección o *MÁS* para ver otros horarios.

**Paciente:** 1

> Por favor confirma los datos:
>
> 👤 Rosa Vera Ruiz
> 🩺 Dr. Ejemplo Dos (Medicina General)
> 📅 lunes 5 de octubre, 14:40
> 💵 $20
>
> ¿Confirmas? Responde *SI* o *NO*.

**Paciente:** si

> ✅ *Cita confirmada*
>
> 🩺 Dr. Ejemplo Dos (Medicina General)
> 📅 lunes 5 de octubre, 14:40
> 📍 Cdla. Orquídeas, Mz. 1043, Solar 37 (frente a Créditos Económicos), Guayaquil
> 💵 $20
>
> Te enviaré un recordatorio 24 horas antes. Para reagendar o cancelar, escríbeme por aquí. Llega 10 minutos antes. 😊

**Observaciones del revisor:** ______________________________________________

---

### E2. Reagendar

**Paciente:** necesito reagendar mi cita

> Vamos a cambiar tu cita del *lunes 5 de octubre, 14:40*.

> Estos son los próximos horarios disponibles con Dr. Ejemplo Dos:
>
> *1.* lunes 5 de octubre, 14:40
> *2.* lunes 5 de octubre, 15:00
> *3.* lunes 5 de octubre, 15:20
> *4.* miércoles 7 de octubre, 14:00
> *5.* miércoles 7 de octubre, 14:20
> *6.* miércoles 7 de octubre, 14:40
>
> Responde con el *número* de tu elección o *MÁS* para ver otros horarios.

**Paciente:** 2

> Por favor confirma los datos:
>
> 🔁 *Reagendar cita*
> 👤 Rosa Vera Ruiz
> 🩺 Dr. Ejemplo Dos (Medicina General)
> 📅 lunes 5 de octubre, 15:00
> 💵 $20
>
> ¿Confirmas? Responde *SI* o *NO*.

**Paciente:** si

> ✅ *Cita reagendada*
>
> 🩺 Dr. Ejemplo Dos (Medicina General)
> 📅 lunes 5 de octubre, 15:00
> 📍 Cdla. Orquídeas, Mz. 1043, Solar 37 (frente a Créditos Económicos), Guayaquil
> 💵 $20
>
> Te enviaré un recordatorio 24 horas antes. Para reagendar o cancelar, escríbeme por aquí. Llega 10 minutos antes. 😊

**Observaciones del revisor:** ______________________________________________

---

### E3. Cancelar (primero se responde NO, luego SI)

**Paciente:** quiero cancelar mi cita

> ¿Confirmas que deseas *cancelar* esta cita?
>
> • lunes 5 de octubre, 15:00 — Dr. Ejemplo Dos (Medicina General)
>
> Responde *SI* para cancelar o *NO* para conservarla.

**Paciente:** no

> Perfecto, tu cita se mantiene. 😊

**Paciente:** cancelar mi cita

> ¿Confirmas que deseas *cancelar* esta cita?
>
> • lunes 5 de octubre, 15:00 — Dr. Ejemplo Dos (Medicina General)
>
> Responde *SI* para cancelar o *NO* para conservarla.

**Paciente:** si

> Tu cita fue *cancelada* ✅. Cuando quieras reservar otra, escribe *agendar*.

**Observaciones del revisor:** ______________________________________________

---

### E4. Consultar citas sin tener ninguna

**Paciente:** mis citas

> No encuentro citas próximas asociadas a este número. Escribe *agendar* para reservar una.

**Observaciones del revisor:** ______________________________________________

---

### E5. Reagendar o cancelar sin citas

**Paciente:** reagendar

> No encuentro citas próximas asociadas a este número. Escribe *agendar* para reservar una nueva.

**Paciente:** cancelar

> No encuentro citas próximas asociadas a este número.

**Observaciones del revisor:** ______________________________________________

---


## F. Disponibilidad

### F1. Disponibilidad por especialidad

**Paciente:** ¿hay turno con pediatría?

> 📅 *Próximos horarios disponibles*
>
> *Dra. Ejemplo Tres* (Pediatría)
>   • martes 6 de octubre, 09:00
>   • martes 6 de octubre, 09:20
>   • jueves 8 de octubre, 09:00
>
> Para reservar escribe *1* o *agendar*.

**Observaciones del revisor:** ______________________________________________

---

### F2. Disponibilidad sin decir la especialidad

**Paciente:** ver disponibilidad

> ¿De qué especialidad quieres ver la disponibilidad?
>
> *1.* 🩺 Medicina General
> *2.* 👶 Pediatría

**Paciente:** 1

> 📅 *Próximos horarios disponibles*
>
> *Dr. Ejemplo Dos* (Medicina General)
>   • lunes 5 de octubre, 14:40
>   • lunes 5 de octubre, 15:00
>   • miércoles 7 de octubre, 14:00
>
> *Dra. Ejemplo Uno* (Medicina General)
>   • lunes 5 de octubre, 08:00
>   • lunes 5 de octubre, 08:20
>   • martes 6 de octubre, 08:00
>
> Para reservar escribe *1* o *agendar*.

**Observaciones del revisor:** ______________________________________________

---


## G. Servicios de atención directa con el área (Odontología, Laboratorio, Rayos X, Procedimientos)

### G1. Odontología: se deriva al WhatsApp del área

_[EJEMPLO] El número del enlace es ficticio; se carga en el panel._

**Paciente:** quiero una cita con el dentista

> Para información, disponibilidad y citas de 🦷 Odontología, puedo comunicarte directamente con el área correspondiente.
>
> *1.* Continuar con 🦷 Odontología
> *2.* Volver al menú

**Paciente:** 1

> Perfecto 🙌 Para continuar con *🦷 Odontología*, escríbele directamente al área por WhatsApp:
> 👉 https://wa.me/593000000000?text=Hola%2C%20vengo%20del%20asistente%20SALUD%20de%20Centro%20ProSalud.%20Quisiera%20informaci%C3%B3n%20de%20Odontolog%C3%ADa.
>
> Si prefieres que te ayude una persona de recepción de Centro ProSalud, escribe *recepción*. Para volver al inicio escribe *menú*.

**Observaciones del revisor:** ______________________________________________

---

### G2. Odontología: el paciente prefiere volver al menú

**Paciente:** odontología

> Para información, disponibilidad y citas de 🦷 Odontología, puedo comunicarte directamente con el área correspondiente.
>
> *1.* Continuar con 🦷 Odontología
> *2.* Volver al menú

**Paciente:** 2

> *1.* Agendar una cita
> *2.* Reagendar una cita
> *3.* Cancelar una cita
> *4.* Ver disponibilidad
> *5.* Especialidades y servicios
> *6.* Horarios, precios y ubicación
> *7.* Hablar con recepción
>
> Responde con el número o escríbeme tu consulta.

**Observaciones del revisor:** ______________________________________________

---

### G3. Laboratorio Clínico

_Horario según lo indicado: 7:00 a. m.–2:00 p. m., recepción de pruebas hasta las 10:00 a. m._

**Paciente:** ¿atienden en el laboratorio?

> 🧪 *Laboratorio Clínico*
> Atención *sin cita*, de lunes a sábado, de 7:00 a. m. a 2:00 p. m. (incluye el retiro de exámenes). La *recepción de pruebas* es hasta las 10:00 a. m.
>
> Para tu consulta, la recepcionista del laboratorio te atiende directamente por WhatsApp.
>
> *1.* Continuar con 🧪 Laboratorio Clínico
> *2.* Volver al menú

**Paciente:** 1

> Perfecto 🙌 Para continuar con *🧪 Laboratorio Clínico*, escríbele directamente al área por WhatsApp:
> 👉 https://wa.me/593000000000?text=Hola%2C%20vengo%20del%20asistente%20SALUD%20de%20Centro%20ProSalud.%20Quisiera%20informaci%C3%B3n%20de%20Laboratorio%20Cl%C3%ADnico.
>
> Si prefieres que te ayude una persona de recepción de Centro ProSalud, escribe *recepción*. Para volver al inicio escribe *menú*.

**Observaciones del revisor:** ______________________________________________

---

### G4. Imágenes y Rayos X

**Paciente:** necesito una radiografía

> 🩻 *Imágenes y Rayos X*
> Este servicio se atiende *sin cita*. El horario y los estudios disponibles los confirma la recepción del área; puedo comunicarte con ella por WhatsApp.
>
> *1.* Continuar con 🩻 Imágenes y Rayos X
> *2.* Volver al menú

**Paciente:** 1

> Perfecto 🙌 Para continuar con *🩻 Imágenes y Rayos X*, escríbele directamente al área por WhatsApp:
> 👉 https://wa.me/593000000000?text=Hola%2C%20vengo%20del%20asistente%20SALUD%20de%20Centro%20ProSalud.%20Quisiera%20informaci%C3%B3n%20de%20Im%C3%A1genes%20y%20Rayos%20X.
>
> Si prefieres que te ayude una persona de recepción de Centro ProSalud, escribe *recepción*. Para volver al inicio escribe *menú*.

**Observaciones del revisor:** ______________________________________________

---

### G5. Procedimientos Clínicos (aún sin WhatsApp propio: pasa a una persona de ProSalud)

**Paciente:** necesito un procedimiento clínico

> Para información, disponibilidad y citas de 💉 Procedimientos Clínicos, puedo comunicarte directamente con el área correspondiente.
>
> *1.* Continuar con 💉 Procedimientos Clínicos
> *2.* Volver al menú

**Paciente:** 1

> Perfecto 🙌 Te comunico con el área de *Procedimientos Clínicos*. Una persona te escribirá en este mismo chat en unos minutos.

**Paciente:** hola?

_(el asistente no responde: la conversación la atiende una persona)_

**Observaciones del revisor:** ______________________________________________

---

### G6. Servicio de área elegido desde la lista de agendar

**Paciente:** agendar

> Para continuar necesito registrar tus datos (tu nombre y tu número de WhatsApp) con el único fin de gestionar tus citas en *Centro ProSalud*.
>
> 🔒 Se tratan conforme a la Ley Orgánica de Protección de Datos Personales de Ecuador (LOPDP), no se comparten con terceros no autorizados y puedes pedir acceso, rectificación o eliminación cuando quieras escribiendo *recepción*. *No te pediré información médica por este chat.*
>
> ¿Aceptas? Responde *SI* o *NO*.

**Paciente:** si

> Gracias, tu autorización quedó registrada ✅.

> ¿Para quién es la cita?
>
> *1.* Para mí
> *2.* Para otra persona (un familiar)

**Paciente:** 1

> Perfecto. ¿Cuál es tu *nombre y apellido*?

**Paciente:** Mario Paz León

> ¿Con qué especialidad o servicio deseas tu cita?
>
> *1.* 🩻 Imágenes y Rayos X
> *2.* 🧪 Laboratorio Clínico
> *3.* 🩺 Medicina General — $20
> *4.* 🦷 Odontología
> *5.* 👶 Pediatría — $25
> *6.* 💉 Procedimientos Clínicos
>
> Responde con el número o el nombre. (Escribe *menú* para salir)

**Paciente:** odontologia

> Para información, disponibilidad y citas de 🦷 Odontología, puedo comunicarte directamente con el área correspondiente.
>
> *1.* Continuar con 🦷 Odontología
> *2.* Volver al menú

**Observaciones del revisor:** ______________________________________________

---

### G7. Respuesta que no entiende dentro de un servicio de área

**Paciente:** laboratorio

> 🧪 *Laboratorio Clínico*
> Atención *sin cita*, de lunes a sábado, de 7:00 a. m. a 2:00 p. m. (incluye el retiro de exámenes). La *recepción de pruebas* es hasta las 10:00 a. m.
>
> Para tu consulta, la recepcionista del laboratorio te atiende directamente por WhatsApp.
>
> *1.* Continuar con 🧪 Laboratorio Clínico
> *2.* Volver al menú

**Paciente:** quizás

> Responde *1* para continuar o *2* para volver al menú.

> 🧪 *Laboratorio Clínico*
> Atención *sin cita*, de lunes a sábado, de 7:00 a. m. a 2:00 p. m. (incluye el retiro de exámenes). La *recepción de pruebas* es hasta las 10:00 a. m.
>
> Para tu consulta, la recepcionista del laboratorio te atiende directamente por WhatsApp.
>
> *1.* Continuar con 🧪 Laboratorio Clínico
> *2.* Volver al menú

**Paciente:** no sé

> *1.* Agendar una cita
> *2.* Reagendar una cita
> *3.* Cancelar una cita
> *4.* Ver disponibilidad
> *5.* Especialidades y servicios
> *6.* Horarios, precios y ubicación
> *7.* Hablar con recepción
>
> Responde con el número o escríbeme tu consulta.

**Observaciones del revisor:** ______________________________________________

---


## H. Resultados de exámenes

### H1. Pedir resultados por WhatsApp

**Paciente:** ¿me pueden mandar mis resultados por whatsapp?

> 🔒 Por tu privacidad *no enviamos resultados por WhatsApp* sin validar tu identidad.
> Puedes retirarlos presentando tu *cédula*, o recibirlos en el correo registrado.
>
> El tiempo de entrega depende del examen; la recepcionista del laboratorio te lo confirma.
>
> Si quieres que una persona te ayude, escribe *recepción*.

**Observaciones del revisor:** ______________________________________________

---

### H2. Pedir que se interpreten resultados

**Paciente:** ¿me interpretas mis resultados? ¿es normal?

> Entiendo tu preocupación 💙, pero *no puedo dar diagnósticos, interpretar síntomas ni recomendar medicamentos*. Eso solo lo puede hacer un médico evaluándote en consulta. No necesitas darme detalles clínicos por aquí.
>
> Si lo deseas, puedo agendarte una cita (escribe *1*). Si sientes que empeora o es grave, llama al *911* (ECU 911).

**Observaciones del revisor:** ______________________________________________

---


## I. Seguridad: emergencias, salud mental y diagnósticos

### I1. Posible emergencia médica

_El número 911 sale de Configuración. Además crea una alerta urgente para el personal._

**Paciente:** Mi papá tiene dolor fuerte en el pecho y no puede respirar

> 🚨 *Lo que describes puede ser una emergencia médica.*
>
> Por favor *llama de inmediato al 911 (ECU 911)* o acude ahora al servicio de emergencias más cercano. No esperes una respuesta por este chat.
>
> Este asistente no puede evaluar urgencias ni dar indicaciones médicas. He avisado al personal de la clínica.

**Observaciones del revisor:** ______________________________________________

---

### I2. Posible riesgo para la vida (salud mental)

**Paciente:** ya no quiero vivir

> Lamento mucho que estés pasando por esto. Tu seguridad es lo más importante y no tienes que enfrentarlo en soledad.
>
> 🚨 *Llama ahora al 911 (ECU 911)* o pide a alguien cercano que te acompañe y acude al servicio de emergencias más próximo.
>
> He avisado al personal de la clínica para que pueda contactarte por este chat.

**Observaciones del revisor:** ______________________________________________

---

### I3. Pide diagnóstico o medicamento

**Paciente:** Me duele la cabeza hace días, ¿qué medicamento puedo tomar?

> Entiendo tu preocupación 💙, pero *no puedo dar diagnósticos, interpretar síntomas ni recomendar medicamentos*. Eso solo lo puede hacer un médico evaluándote en consulta. No necesitas darme detalles clínicos por aquí.
>
> Si lo deseas, puedo agendarte una cita (escribe *1*). Si sientes que empeora o es grave, llama al *911* (ECU 911).

**Observaciones del revisor:** ______________________________________________

---

### I4. Cuenta un síntoma pero quiere agendar

**Paciente:** Quiero agendar una cita, tengo fiebre

> Claro, te ayudo a agendar. No necesito detalles clínicos por aquí: el médico los revisará en tu consulta. 💙

> Para continuar necesito registrar tus datos (tu nombre y tu número de WhatsApp) con el único fin de gestionar tus citas en *Centro ProSalud*.
>
> 🔒 Se tratan conforme a la Ley Orgánica de Protección de Datos Personales de Ecuador (LOPDP), no se comparten con terceros no autorizados y puedes pedir acceso, rectificación o eliminación cuando quieras escribiendo *recepción*. *No te pediré información médica por este chat.*
>
> ¿Aceptas? Responde *SI* o *NO*.

**Observaciones del revisor:** ______________________________________________

---


## J. Hablar con una persona

### J1. Dentro del horario de recepción

**Paciente:** quiero hablar con una persona

> Claro 🙋 Te comunico con el equipo de recepción. Un recepcionista te escribirá en este mismo chat en unos minutos.

**Paciente:** hola?

_(el asistente no responde: la conversación la atiende una persona)_

**Paciente:** gracias

_(el asistente no responde: la conversación la atiende una persona)_

**Observaciones del revisor:** ______________________________________________

---

### J2. Fuera del horario (se avisa al personal de guardia)

_[EJEMPLO] Con el WhatsApp de guardia cargado se le envía un aviso (en esta versión el aviso queda registrado en el panel)._

**Paciente:** recepcionista por favor

> En este momento estamos fuera de nuestro horario de atención 🌙. Ya avisé al personal de guardia y te responderán por este chat lo antes posible.
>
> Si se trata de una emergencia, llama al *911* (ECU 911).

**Observaciones del revisor:** ______________________________________________

---

### J3. Emergencia mientras lo atiende una persona

_La alerta de emergencia siempre se envía, aunque el asistente esté en silencio._

**Paciente:** recepción

> Claro 🙋 Te comunico con el equipo de recepción. Un recepcionista te escribirá en este mismo chat en unos minutos.

**Paciente:** ahora mismo no puede respirar

> 🚨 *Lo que describes puede ser una emergencia médica.*
>
> Por favor *llama de inmediato al 911 (ECU 911)* o acude ahora al servicio de emergencias más cercano. No esperes una respuesta por este chat.
>
> Este asistente no puede evaluar urgencias ni dar indicaciones médicas. He avisado al personal de la clínica.

**Observaciones del revisor:** ______________________________________________

---


## K. Recordatorio de cita

### K1. Recordatorio automático

_Se envía antes de la cita según «Recordatorio (horas antes)» de Configuración. En WhatsApp real debe enviarse con una plantilla aprobada por Meta, cuyo texto se revisará aparte._

> 🔔 *Recordatorio de cita* — Centro ProSalud
> Hola Elena, te recordamos tu cita con Dr. Ejemplo Dos: *sábado 3 de octubre, 13:00*.
> Responde *CONFIRMO* para confirmar, *REAGENDAR* para cambiarla o *CANCELAR* para anularla.

**Observaciones del revisor:** ______________________________________________

---

### K2. El paciente responde CONFIRMO

**Paciente:** CONFIRMO

> ¡Gracias! ✔ Asistencia confirmada:
>
> • sábado 3 de octubre, 13:00 — Dr. Ejemplo Dos (Medicina General)

**Observaciones del revisor:** ______________________________________________

---

