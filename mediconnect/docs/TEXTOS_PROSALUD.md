# Textos que ve el paciente — Centro ProSalud (asistente MediConnect)

> Documento **generado automáticamente** ejecutando el asistente real (126 mensajes). Si se cambia algún texto, se vuelve a generar con `npm run textos:prosalud`.

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
| Nombre del asistente (MediConnect), respuesta sobre resultados, número de emergencias, horario, guardia | Panel → Configuración |
| Mensaje de Laboratorio, Rayos X, Odontología y Procedimientos; WhatsApp de cada área; emoji y palabras clave | Panel → Especialidades y servicios |
| Dirección | Panel → Configuración |
| El resto (saludo, menú, consentimiento, flujos de cita, mensajes de seguridad) | Código del asistente: envíe sus correcciones y se aplican |

El asistente trata al paciente de **usted**.

**Frases que conviene validar con especial cuidado:** el aviso de consentimiento (A/C/D), los mensajes de emergencia y salud mental (I1, I2), la respuesta de «no puedo dar diagnósticos» (I3) y la información de laboratorio y resultados (G3, H1).

## A. Inicio y mensajes que no entiende

### A1. Saludo y menú principal

_El nombre «MediConnect» y el nombre del centro salen de Configuración._

**Paciente:** Hola

> ¡Hola! 👋 Soy *MediConnect*, el asistente virtual de *Centro ProSalud*. Atiendo por WhatsApp las 24 horas.
>
> ¿En qué puedo ayudarle?
>
> *1.* Especialidades y servicios
> *2.* Horarios, precios y ubicación
> *3.* Ver disponibilidad
> *4.* Agendar una cita
> *5.* Reagendar una cita
> *6.* Cancelar una cita
> *7.* Hablar con recepción
>
> Responda con el número o escríbame su consulta.

**Observaciones del revisor:** ______________________________________________

---

### A2. Mensaje que no entiende (se muestran las opciones una sola vez; si vuelve a no entender, se ofrece recepción)

**Paciente:** asdf qwer

> No estoy seguro de haber entendido 🤔. Estas son las opciones disponibles:

> *1.* Especialidades y servicios
> *2.* Horarios, precios y ubicación
> *3.* Ver disponibilidad
> *4.* Agendar una cita
> *5.* Reagendar una cita
> *6.* Cancelar una cita
> *7.* Hablar con recepción
>
> Responda con el número o escríbame su consulta.

**Paciente:** zzzz

> Parece que no logro entenderle 😅. Si prefiere, escriba *recepción* y una persona le atenderá.

**Observaciones del revisor:** ______________________________________________

---

### A3. Agradecimiento

**Paciente:** muchas gracias

> ¡Con gusto! 😊 Si necesita algo más, escriba *menú*.

**Observaciones del revisor:** ______________________________________________

---


## B. Información general

### B1. Especialidades y servicios (opción 1 del menú)

_Se arma con la lista de «Especialidades y servicios» del panel._

**Paciente:** hola

> ¡Hola! 👋 Soy *MediConnect*, el asistente virtual de *Centro ProSalud*. Atiendo por WhatsApp las 24 horas.
>
> ¿En qué puedo ayudarle?
>
> *1.* Especialidades y servicios
> *2.* Horarios, precios y ubicación
> *3.* Ver disponibilidad
> *4.* Agendar una cita
> *5.* Reagendar una cita
> *6.* Cancelar una cita
> *7.* Hablar con recepción
>
> Responda con el número o escríbame su consulta.

**Paciente:** 1

> *Especialidades y servicios de Centro ProSalud*
>
> *Citas médicas*
> • ❤️ Cardiología
> • 🧴 Dermatología
> • 🌸 Ginecología
> • 🩺 Medicina General — $20
> • 👓 Optometría
> • 👶 Pediatría — $25
> • 🧠 Psicología
> • 🦴 Traumatología
>
> *Otros servicios* (le comunico con el área)
> • 🩻 Imágenes y Rayos X
> • 🧪 Laboratorio Clínico
> • 🦷 Odontología
> • 💉 Procedimientos Clínicos
>
> Para reservar escriba *agendar*; para ver los médicos escriba *médicos*.

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
> Para reservar escriba *agendar*.

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
> Este asistente responde las 24 horas. Ahora mismo recepción está *cerrada* 🌙, pero puedo agendar su cita.

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
> Para 🩻 Imágenes y Rayos X, 🧪 Laboratorio Clínico, 🦷 Odontología, 💉 Procedimientos Clínicos consulte los valores con el área.

**Observaciones del revisor:** ______________________________________________

---

### B6. Ubicación

**Paciente:** ¿dónde están ubicados?

> 📍 *Centro ProSalud*
> Cdla. Orquídeas, Mz. 1043, Solar 37 (frente a Taurus Gym), Guayaquil
> 🗺️ https://maps.google.com/?q=[ENLACE-EJEMPLO]
>
> Le recomendamos llegar 10 minutos antes de su cita.

**Observaciones del revisor:** ______________________________________________

---

### B7. Horarios, precios y ubicación juntos (opción 2)

**Paciente:** hola

> ¡Hola! 👋 Soy *MediConnect*, el asistente virtual de *Centro ProSalud*. Atiendo por WhatsApp las 24 horas.
>
> ¿En qué puedo ayudarle?
>
> *1.* Especialidades y servicios
> *2.* Horarios, precios y ubicación
> *3.* Ver disponibilidad
> *4.* Agendar una cita
> *5.* Reagendar una cita
> *6.* Cancelar una cita
> *7.* Hablar con recepción
>
> Responda con el número o escríbame su consulta.

**Paciente:** 2

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
> Para 🩻 Imágenes y Rayos X, 🧪 Laboratorio Clínico, 🦷 Odontología, 💉 Procedimientos Clínicos consulte los valores con el área.

> 📍 *Centro ProSalud*
> Cdla. Orquídeas, Mz. 1043, Solar 37 (frente a Taurus Gym), Guayaquil
> 🗺️ https://maps.google.com/?q=[ENLACE-EJEMPLO]
>
> Le recomendamos llegar 10 minutos antes de su cita.

**Observaciones del revisor:** ______________________________________________

---


## C. Agendar una cita

### C1. Primera cita de un paciente nuevo (consentimiento, nombre, especialidad, médico, horario)

_Las fechas dependen del día en que se generó este documento. [EJEMPLO] Médicos y horarios ficticios._

**Paciente:** Hola

> ¡Hola! 👋 Soy *MediConnect*, el asistente virtual de *Centro ProSalud*. Atiendo por WhatsApp las 24 horas.
>
> ¿En qué puedo ayudarle?
>
> *1.* Especialidades y servicios
> *2.* Horarios, precios y ubicación
> *3.* Ver disponibilidad
> *4.* Agendar una cita
> *5.* Reagendar una cita
> *6.* Cancelar una cita
> *7.* Hablar con recepción
>
> Responda con el número o escríbame su consulta.

**Paciente:** 4

> Para continuar necesito registrar sus datos (su nombre y su número de WhatsApp) con el único fin de gestionar sus citas en *Centro ProSalud*.
>
> 🔒 Se tratan conforme a la Ley Orgánica de Protección de Datos Personales de Ecuador (LOPDP), no se comparten con terceros no autorizados y puede pedir acceso, rectificación o eliminación cuando lo desee escribiendo *recepción*. *No le pediré información médica por este chat.*
>
> ¿Acepta? Responda *SI* o *NO*.

**Paciente:** si

> Gracias, su autorización quedó registrada ✅.

> ¿Para quién es la cita?
>
> *1.* Para mí
> *2.* Para otra persona (un familiar)

**Paciente:** 1

> Perfecto. ¿Cuál es su *nombre y apellido*?

**Paciente:** maria fernanda zambrano

> ¿Con qué especialidad o servicio desea su cita?
>
> *Citas médicas*
> *1.* 🩺 Medicina General — $20
> *2.* 👶 Pediatría — $25
>
> *Otros servicios* (le comunico con el área)
> *3.* 🩻 Imágenes y Rayos X
> *4.* 🧪 Laboratorio Clínico
> *5.* 🦷 Odontología
> *6.* 💉 Procedimientos Clínicos
>
> Responda con el número o el nombre. (Escriba *menú* para salir)

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
> Responda con el *número* de su elección o *MÁS* para ver otros horarios.

**Paciente:** 1

> Por favor confirme los datos:
>
> 👤 Maria Fernanda Zambrano
> 🩺 Dr. Ejemplo Dos (Medicina General)
> 📅 lunes 5 de octubre, 14:00
> 💵 $20
>
> ¿Confirma? Responda *SI* o *NO*.

**Paciente:** si

> ✅ *Cita confirmada*
>
> 🩺 Dr. Ejemplo Dos (Medicina General)
> 📅 lunes 5 de octubre, 14:00
> 📍 Cdla. Orquídeas, Mz. 1043, Solar 37 (frente a Taurus Gym), Guayaquil
> 💵 $20
>
> Le enviaré un recordatorio 24 horas antes. Para reagendar o cancelar, escríbame por aquí. Llegue 10 minutos antes. 😊

**Observaciones del revisor:** ______________________________________________

---

### C2. El paciente NO acepta el consentimiento

**Paciente:** quiero agendar una cita

> Para continuar necesito registrar sus datos (su nombre y su número de WhatsApp) con el único fin de gestionar sus citas en *Centro ProSalud*.
>
> 🔒 Se tratan conforme a la Ley Orgánica de Protección de Datos Personales de Ecuador (LOPDP), no se comparten con terceros no autorizados y puede pedir acceso, rectificación o eliminación cuando lo desee escribiendo *recepción*. *No le pediré información médica por este chat.*
>
> ¿Acepta? Responda *SI* o *NO*.

**Paciente:** no

> Entendido. Sin su autorización no puedo registrar datos ni agendar por este medio. Puedo darle información general (escriba *menú*) o puede escribir *recepción* para que una persona le ayude.

**Observaciones del revisor:** ______________________________________________

---

### C3. Respuesta inválida en el consentimiento

**Paciente:** quiero agendar una cita

> Para continuar necesito registrar sus datos (su nombre y su número de WhatsApp) con el único fin de gestionar sus citas en *Centro ProSalud*.
>
> 🔒 Se tratan conforme a la Ley Orgánica de Protección de Datos Personales de Ecuador (LOPDP), no se comparten con terceros no autorizados y puede pedir acceso, rectificación o eliminación cuando lo desee escribiendo *recepción*. *No le pediré información médica por este chat.*
>
> ¿Acepta? Responda *SI* o *NO*.

**Paciente:** quizás

> Necesito que responda *SI* o *NO*: ¿acepta que registremos su nombre y su número de WhatsApp para gestionar sus citas?

**Paciente:** tal vez

> Necesito que responda *SI* o *NO*: ¿acepta que registremos su nombre y su número de WhatsApp para gestionar sus citas?

**Observaciones del revisor:** ______________________________________________

---

### C4. Nombre inválido, pedir más horarios y elegir otro horario

**Paciente:** agendar

> Para continuar necesito registrar sus datos (su nombre y su número de WhatsApp) con el único fin de gestionar sus citas en *Centro ProSalud*.
>
> 🔒 Se tratan conforme a la Ley Orgánica de Protección de Datos Personales de Ecuador (LOPDP), no se comparten con terceros no autorizados y puede pedir acceso, rectificación o eliminación cuando lo desee escribiendo *recepción*. *No le pediré información médica por este chat.*
>
> ¿Acepta? Responda *SI* o *NO*.

**Paciente:** si

> Gracias, su autorización quedó registrada ✅.

> ¿Para quién es la cita?
>
> *1.* Para mí
> *2.* Para otra persona (un familiar)

**Paciente:** 1

> Perfecto. ¿Cuál es su *nombre y apellido*?

**Paciente:** 12345

> Escriba el *nombre y apellido*, por favor (solo letras, sin números).

**Paciente:** Luis Pérez Mora

> ¿Con qué especialidad o servicio desea su cita?
>
> *Citas médicas*
> *1.* 🩺 Medicina General — $20
> *2.* 👶 Pediatría — $25
>
> *Otros servicios* (le comunico con el área)
> *3.* 🩻 Imágenes y Rayos X
> *4.* 🧪 Laboratorio Clínico
> *5.* 🦷 Odontología
> *6.* 💉 Procedimientos Clínicos
>
> Responda con el número o el nombre. (Escriba *menú* para salir)

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
> Responda con el *número* de su elección o *MÁS* para ver otros horarios.

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
> Responda con el *número* de su elección o *MÁS* para ver otros horarios.

**Paciente:** 1

> Por favor confirme los datos:
>
> 👤 Luis Pérez Mora
> 🩺 Dra. Ejemplo Tres (Pediatría)
> 📅 martes 13 de octubre, 09:00
> 💵 $25
>
> ¿Confirma? Responda *SI* o *NO*.

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
> Responda con el *número* de su elección o *MÁS* para ver otros horarios.

**Paciente:** 1

> Por favor confirme los datos:
>
> 👤 Luis Pérez Mora
> 🩺 Dra. Ejemplo Tres (Pediatría)
> 📅 martes 13 de octubre, 09:00
> 💵 $25
>
> ¿Confirma? Responda *SI* o *NO*.

**Paciente:** si

> ✅ *Cita confirmada*
>
> 🩺 Dra. Ejemplo Tres (Pediatría)
> 📅 martes 13 de octubre, 09:00
> 📍 Cdla. Orquídeas, Mz. 1043, Solar 37 (frente a Taurus Gym), Guayaquil
> 💵 $25
>
> Le enviaré un recordatorio 24 horas antes. Para reagendar o cancelar, escríbame por aquí. Llegue 10 minutos antes. 😊

**Observaciones del revisor:** ______________________________________________

---

### C5. Servicio escrito en el mensaje inicial (el asistente lo recuerda y se salta la pregunta de especialidad)

**Paciente:** quiero una cita con el pediatra

> Para continuar necesito registrar sus datos (su nombre y su número de WhatsApp) con el único fin de gestionar sus citas en *Centro ProSalud*.
>
> 🔒 Se tratan conforme a la Ley Orgánica de Protección de Datos Personales de Ecuador (LOPDP), no se comparten con terceros no autorizados y puede pedir acceso, rectificación o eliminación cuando lo desee escribiendo *recepción*. *No le pediré información médica por este chat.*
>
> ¿Acepta? Responda *SI* o *NO*.

**Paciente:** si

> Gracias, su autorización quedó registrada ✅.

> ¿Para quién es la cita?
>
> *1.* Para mí
> *2.* Para otra persona (un familiar)

**Paciente:** 1

> Perfecto. ¿Cuál es su *nombre y apellido*?

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
> Responda con el *número* de su elección o *MÁS* para ver otros horarios.

**Observaciones del revisor:** ______________________________________________

---


## D. Familiares bajo un mismo número

### D1. El titular agenda para sí mismo

**Paciente:** Hola

> ¡Hola! 👋 Soy *MediConnect*, el asistente virtual de *Centro ProSalud*. Atiendo por WhatsApp las 24 horas.
>
> ¿En qué puedo ayudarle?
>
> *1.* Especialidades y servicios
> *2.* Horarios, precios y ubicación
> *3.* Ver disponibilidad
> *4.* Agendar una cita
> *5.* Reagendar una cita
> *6.* Cancelar una cita
> *7.* Hablar con recepción
>
> Responda con el número o escríbame su consulta.

**Paciente:** 4

> Para continuar necesito registrar sus datos (su nombre y su número de WhatsApp) con el único fin de gestionar sus citas en *Centro ProSalud*.
>
> 🔒 Se tratan conforme a la Ley Orgánica de Protección de Datos Personales de Ecuador (LOPDP), no se comparten con terceros no autorizados y puede pedir acceso, rectificación o eliminación cuando lo desee escribiendo *recepción*. *No le pediré información médica por este chat.*
>
> ¿Acepta? Responda *SI* o *NO*.

**Paciente:** si

> Gracias, su autorización quedó registrada ✅.

> ¿Para quién es la cita?
>
> *1.* Para mí
> *2.* Para otra persona (un familiar)

**Paciente:** 1

> Perfecto. ¿Cuál es su *nombre y apellido*?

**Paciente:** Carla Rivera Soto

> ¿Con qué especialidad o servicio desea su cita?
>
> *Citas médicas*
> *1.* 🩺 Medicina General — $20
> *2.* 👶 Pediatría — $25
>
> *Otros servicios* (le comunico con el área)
> *3.* 🩻 Imágenes y Rayos X
> *4.* 🧪 Laboratorio Clínico
> *5.* 🦷 Odontología
> *6.* 💉 Procedimientos Clínicos
>
> Responda con el número o el nombre. (Escriba *menú* para salir)

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
> Responda con el *número* de su elección o *MÁS* para ver otros horarios.

**Paciente:** 1

> Por favor confirme los datos:
>
> 👤 Carla Rivera Soto
> 🩺 Dr. Ejemplo Dos (Medicina General)
> 📅 lunes 5 de octubre, 14:20
> 💵 $20
>
> ¿Confirma? Responda *SI* o *NO*.

**Paciente:** si

> ✅ *Cita confirmada*
>
> 🩺 Dr. Ejemplo Dos (Medicina General)
> 📅 lunes 5 de octubre, 14:20
> 📍 Cdla. Orquídeas, Mz. 1043, Solar 37 (frente a Taurus Gym), Guayaquil
> 💵 $20
>
> Le enviaré un recordatorio 24 horas antes. Para reagendar o cancelar, escríbame por aquí. Llegue 10 minutos antes. 😊

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

> ¿Con qué especialidad o servicio desea su cita?
>
> *Citas médicas*
> *1.* 🩺 Medicina General — $20
> *2.* 👶 Pediatría — $25
>
> *Otros servicios* (le comunico con el área)
> *3.* 🩻 Imágenes y Rayos X
> *4.* 🧪 Laboratorio Clínico
> *5.* 🦷 Odontología
> *6.* 💉 Procedimientos Clínicos
>
> Responda con el número o el nombre. (Escriba *menú* para salir)

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
> Responda con el *número* de su elección o *MÁS* para ver otros horarios.

**Paciente:** 1

> Por favor confirme los datos:
>
> 👤 Mateo Rivera Soto
> 🩺 Dra. Ejemplo Tres (Pediatría)
> 📅 martes 6 de octubre, 09:00
> 💵 $25
>
> 👪 Registraré a esta persona como paciente bajo su número. Al confirmar declara ser su representante o contar con su autorización para tratar sus datos para gestionar sus citas.
>
> ¿Confirma? Responda *SI* o *NO*.

**Paciente:** si

> ✅ *Cita confirmada*
>
> 🩺 Dra. Ejemplo Tres (Pediatría)
> 📅 martes 6 de octubre, 09:00
> 📍 Cdla. Orquídeas, Mz. 1043, Solar 37 (frente a Taurus Gym), Guayaquil
> 💵 $25
>
> Le enviaré un recordatorio 24 horas antes. Para reagendar o cancelar, escríbame por aquí. Llegue 10 minutos antes. 😊

**Observaciones del revisor:** ______________________________________________

---

### D3. Ver todas las citas del número (aparecen por persona)

**Paciente:** mis citas

> *Sus próximas citas*
>
> • Carla Rivera Soto: lunes 5 de octubre, 14:20 — Dr. Ejemplo Dos (Medicina General)
> • Mateo Rivera Soto: martes 6 de octubre, 09:00 — Dra. Ejemplo Tres (Pediatría)
>
> Puedo *reagendar* o *cancelar* si lo necesita.

**Observaciones del revisor:** ______________________________________________

---

### D4. Cancelar la cita de una de las personas

**Paciente:** cancelar mi cita

> ¿Cuál cita desea cancelar?
>
> *1.* Carla Rivera Soto: lunes 5 de octubre, 14:20 — Dr. Ejemplo Dos (Medicina General)
> *2.* Mateo Rivera Soto: martes 6 de octubre, 09:00 — Dra. Ejemplo Tres (Pediatría)

**Paciente:** 2

> ¿Confirma que desea *cancelar* esta cita?
>
> • Mateo Rivera Soto: martes 6 de octubre, 09:00 — Dra. Ejemplo Tres (Pediatría)
>
> Responda *SI* para cancelar o *NO* para conservarla.

**Paciente:** si

> Su cita fue *cancelada* ✅. Cuando desee reservar otra, escriba *agendar*.

**Observaciones del revisor:** ______________________________________________

---


## E. Reagendar, cancelar y confirmar

### E1. Preparación: una cita nueva

**Paciente:** Hola

> ¡Hola! 👋 Soy *MediConnect*, el asistente virtual de *Centro ProSalud*. Atiendo por WhatsApp las 24 horas.
>
> ¿En qué puedo ayudarle?
>
> *1.* Especialidades y servicios
> *2.* Horarios, precios y ubicación
> *3.* Ver disponibilidad
> *4.* Agendar una cita
> *5.* Reagendar una cita
> *6.* Cancelar una cita
> *7.* Hablar con recepción
>
> Responda con el número o escríbame su consulta.

**Paciente:** 4

> Para continuar necesito registrar sus datos (su nombre y su número de WhatsApp) con el único fin de gestionar sus citas en *Centro ProSalud*.
>
> 🔒 Se tratan conforme a la Ley Orgánica de Protección de Datos Personales de Ecuador (LOPDP), no se comparten con terceros no autorizados y puede pedir acceso, rectificación o eliminación cuando lo desee escribiendo *recepción*. *No le pediré información médica por este chat.*
>
> ¿Acepta? Responda *SI* o *NO*.

**Paciente:** si

> Gracias, su autorización quedó registrada ✅.

> ¿Para quién es la cita?
>
> *1.* Para mí
> *2.* Para otra persona (un familiar)

**Paciente:** 1

> Perfecto. ¿Cuál es su *nombre y apellido*?

**Paciente:** Rosa Vera Ruiz

> ¿Con qué especialidad o servicio desea su cita?
>
> *Citas médicas*
> *1.* 🩺 Medicina General — $20
> *2.* 👶 Pediatría — $25
>
> *Otros servicios* (le comunico con el área)
> *3.* 🩻 Imágenes y Rayos X
> *4.* 🧪 Laboratorio Clínico
> *5.* 🦷 Odontología
> *6.* 💉 Procedimientos Clínicos
>
> Responda con el número o el nombre. (Escriba *menú* para salir)

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
> Responda con el *número* de su elección o *MÁS* para ver otros horarios.

**Paciente:** 1

> Por favor confirme los datos:
>
> 👤 Rosa Vera Ruiz
> 🩺 Dr. Ejemplo Dos (Medicina General)
> 📅 lunes 5 de octubre, 14:40
> 💵 $20
>
> ¿Confirma? Responda *SI* o *NO*.

**Paciente:** si

> ✅ *Cita confirmada*
>
> 🩺 Dr. Ejemplo Dos (Medicina General)
> 📅 lunes 5 de octubre, 14:40
> 📍 Cdla. Orquídeas, Mz. 1043, Solar 37 (frente a Taurus Gym), Guayaquil
> 💵 $20
>
> Le enviaré un recordatorio 24 horas antes. Para reagendar o cancelar, escríbame por aquí. Llegue 10 minutos antes. 😊

**Observaciones del revisor:** ______________________________________________

---

### E2. Reagendar

**Paciente:** necesito reagendar mi cita

> Vamos a cambiar su cita del *lunes 5 de octubre, 14:40*.

> Estos son los próximos horarios disponibles con Dr. Ejemplo Dos:
>
> *1.* lunes 5 de octubre, 14:40
> *2.* lunes 5 de octubre, 15:00
> *3.* lunes 5 de octubre, 15:20
> *4.* miércoles 7 de octubre, 14:00
> *5.* miércoles 7 de octubre, 14:20
> *6.* miércoles 7 de octubre, 14:40
>
> Responda con el *número* de su elección o *MÁS* para ver otros horarios.

**Paciente:** 2

> Por favor confirme los datos:
>
> 🔁 *Reagendar cita*
> 👤 Rosa Vera Ruiz
> 🩺 Dr. Ejemplo Dos (Medicina General)
> 📅 lunes 5 de octubre, 15:00
> 💵 $20
>
> ¿Confirma? Responda *SI* o *NO*.

**Paciente:** si

> ✅ *Cita reagendada*
>
> 🩺 Dr. Ejemplo Dos (Medicina General)
> 📅 lunes 5 de octubre, 15:00
> 📍 Cdla. Orquídeas, Mz. 1043, Solar 37 (frente a Taurus Gym), Guayaquil
> 💵 $20
>
> Le enviaré un recordatorio 24 horas antes. Para reagendar o cancelar, escríbame por aquí. Llegue 10 minutos antes. 😊

**Observaciones del revisor:** ______________________________________________

---

### E3. Cancelar (primero se responde NO, luego SI)

**Paciente:** quiero cancelar mi cita

> ¿Confirma que desea *cancelar* esta cita?
>
> • lunes 5 de octubre, 15:00 — Dr. Ejemplo Dos (Medicina General)
>
> Responda *SI* para cancelar o *NO* para conservarla.

**Paciente:** no

> Perfecto, su cita se mantiene. 😊

**Paciente:** cancelar mi cita

> ¿Confirma que desea *cancelar* esta cita?
>
> • lunes 5 de octubre, 15:00 — Dr. Ejemplo Dos (Medicina General)
>
> Responda *SI* para cancelar o *NO* para conservarla.

**Paciente:** si

> Su cita fue *cancelada* ✅. Cuando desee reservar otra, escriba *agendar*.

**Observaciones del revisor:** ______________________________________________

---

### E4. Consultar citas sin tener ninguna

**Paciente:** mis citas

> No encuentro citas próximas asociadas a este número. Escriba *agendar* para reservar una.

**Observaciones del revisor:** ______________________________________________

---

### E5. Reagendar o cancelar sin citas

**Paciente:** reagendar

> No encuentro citas próximas asociadas a este número. Escriba *agendar* para reservar una nueva.

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
> Para reservar escriba *agendar*.

**Observaciones del revisor:** ______________________________________________

---

### F2. Disponibilidad sin decir la especialidad

**Paciente:** ver disponibilidad

> ¿De qué especialidad desea ver la disponibilidad?
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
> Para reservar escriba *agendar*.

**Observaciones del revisor:** ______________________________________________

---


## G. Servicios de atención directa con el área (Odontología, Laboratorio, Rayos X, Procedimientos)

### G1. Odontología: se deriva al WhatsApp del área

_[EJEMPLO] El número del enlace es ficticio; se carga en el panel._

**Paciente:** quiero una cita con el dentista

> Para información, disponibilidad y citas de 🦷 Odontología, puedo comunicarle directamente con el área correspondiente.
>
> *1.* Continuar con 🦷 Odontología
> *2.* Volver al menú

**Paciente:** 1

> Perfecto 🙌 Para continuar con *🦷 Odontología*, escríbale directamente al área por WhatsApp:
> 👉 https://wa.me/593000000000?text=Hola%2C%20vengo%20del%20asistente%20MediConnect%20de%20Centro%20ProSalud.%20Quisiera%20informaci%C3%B3n%20de%20Odontolog%C3%ADa.
>
> Si prefiere que le ayude una persona de recepción de Centro ProSalud, escriba *recepción*. Para volver al inicio escriba *menú*.

**Observaciones del revisor:** ______________________________________________

---

### G2. Odontología: el paciente prefiere volver al menú

**Paciente:** odontología

> Para información, disponibilidad y citas de 🦷 Odontología, puedo comunicarle directamente con el área correspondiente.
>
> *1.* Continuar con 🦷 Odontología
> *2.* Volver al menú

**Paciente:** 2

> *1.* Especialidades y servicios
> *2.* Horarios, precios y ubicación
> *3.* Ver disponibilidad
> *4.* Agendar una cita
> *5.* Reagendar una cita
> *6.* Cancelar una cita
> *7.* Hablar con recepción
>
> Responda con el número o escríbame su consulta.

**Observaciones del revisor:** ______________________________________________

---

### G3. Laboratorio Clínico

_Horario según lo indicado: 7:00 a. m.–2:00 p. m., recepción de pruebas hasta las 10:00 a. m._

**Paciente:** ¿atienden en el laboratorio?

> 🧪 *Laboratorio Clínico*
> Atención *sin cita*, de lunes a sábado, de 7:00 a. m. a 2:00 p. m. (incluye el retiro de exámenes). La *recepción de pruebas* es hasta las 10:00 a. m.
>
> Para su consulta, la recepcionista del laboratorio le atiende directamente por WhatsApp.
>
> *1.* Continuar con 🧪 Laboratorio Clínico
> *2.* Volver al menú

**Paciente:** 1

> Perfecto 🙌 Para continuar con *🧪 Laboratorio Clínico*, escríbale directamente al área por WhatsApp:
> 👉 https://wa.me/593000000000?text=Hola%2C%20vengo%20del%20asistente%20MediConnect%20de%20Centro%20ProSalud.%20Quisiera%20informaci%C3%B3n%20de%20Laboratorio%20Cl%C3%ADnico.
>
> Si prefiere que le ayude una persona de recepción de Centro ProSalud, escriba *recepción*. Para volver al inicio escriba *menú*.

**Observaciones del revisor:** ______________________________________________

---

### G4. Imágenes y Rayos X

**Paciente:** necesito una radiografía

> 🩻 *Imágenes y Rayos X*
> Este servicio se atiende *sin cita*. El horario y los estudios disponibles los confirma la recepción del área; puedo comunicarle con ella por WhatsApp.
>
> *1.* Continuar con 🩻 Imágenes y Rayos X
> *2.* Volver al menú

**Paciente:** 1

> Perfecto 🙌 Para continuar con *🩻 Imágenes y Rayos X*, escríbale directamente al área por WhatsApp:
> 👉 https://wa.me/593000000000?text=Hola%2C%20vengo%20del%20asistente%20MediConnect%20de%20Centro%20ProSalud.%20Quisiera%20informaci%C3%B3n%20de%20Im%C3%A1genes%20y%20Rayos%20X.
>
> Si prefiere que le ayude una persona de recepción de Centro ProSalud, escriba *recepción*. Para volver al inicio escriba *menú*.

**Observaciones del revisor:** ______________________________________________

---

### G5. Procedimientos Clínicos (aún sin WhatsApp propio: pasa a una persona de ProSalud)

**Paciente:** necesito un procedimiento clínico

> Para información, disponibilidad y citas de 💉 Procedimientos Clínicos, puedo comunicarle directamente con el área correspondiente.
>
> *1.* Continuar con 💉 Procedimientos Clínicos
> *2.* Volver al menú

**Paciente:** 1

> Perfecto 🙌 Le comunico con el área de *Procedimientos Clínicos*. Una persona le escribirá en este mismo chat en unos minutos.

**Paciente:** hola?

_(el asistente no responde: la conversación la atiende una persona)_

**Observaciones del revisor:** ______________________________________________

---

### G6. Servicio de área elegido desde la lista de agendar

**Paciente:** agendar

> Para continuar necesito registrar sus datos (su nombre y su número de WhatsApp) con el único fin de gestionar sus citas en *Centro ProSalud*.
>
> 🔒 Se tratan conforme a la Ley Orgánica de Protección de Datos Personales de Ecuador (LOPDP), no se comparten con terceros no autorizados y puede pedir acceso, rectificación o eliminación cuando lo desee escribiendo *recepción*. *No le pediré información médica por este chat.*
>
> ¿Acepta? Responda *SI* o *NO*.

**Paciente:** si

> Gracias, su autorización quedó registrada ✅.

> ¿Para quién es la cita?
>
> *1.* Para mí
> *2.* Para otra persona (un familiar)

**Paciente:** 1

> Perfecto. ¿Cuál es su *nombre y apellido*?

**Paciente:** Mario Paz León

> ¿Con qué especialidad o servicio desea su cita?
>
> *Citas médicas*
> *1.* 🩺 Medicina General — $20
> *2.* 👶 Pediatría — $25
>
> *Otros servicios* (le comunico con el área)
> *3.* 🩻 Imágenes y Rayos X
> *4.* 🧪 Laboratorio Clínico
> *5.* 🦷 Odontología
> *6.* 💉 Procedimientos Clínicos
>
> Responda con el número o el nombre. (Escriba *menú* para salir)

**Paciente:** odontologia

> Para información, disponibilidad y citas de 🦷 Odontología, puedo comunicarle directamente con el área correspondiente.
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
> Para su consulta, la recepcionista del laboratorio le atiende directamente por WhatsApp.
>
> *1.* Continuar con 🧪 Laboratorio Clínico
> *2.* Volver al menú

**Paciente:** quizás

> Responda *1* para continuar o *2* para volver al menú.

> 🧪 *Laboratorio Clínico*
> Atención *sin cita*, de lunes a sábado, de 7:00 a. m. a 2:00 p. m. (incluye el retiro de exámenes). La *recepción de pruebas* es hasta las 10:00 a. m.
>
> Para su consulta, la recepcionista del laboratorio le atiende directamente por WhatsApp.
>
> *1.* Continuar con 🧪 Laboratorio Clínico
> *2.* Volver al menú

**Paciente:** no sé

> *1.* Especialidades y servicios
> *2.* Horarios, precios y ubicación
> *3.* Ver disponibilidad
> *4.* Agendar una cita
> *5.* Reagendar una cita
> *6.* Cancelar una cita
> *7.* Hablar con recepción
>
> Responda con el número o escríbame su consulta.

**Observaciones del revisor:** ______________________________________________

---


## H. Resultados de exámenes

### H1. Pedir resultados por WhatsApp

**Paciente:** ¿me pueden mandar mis resultados por whatsapp?

> 🔒 Por su privacidad *no enviamos resultados por WhatsApp* sin validar su identidad.
> Puede retirarlos presentando su *cédula*, o recibirlos en el correo registrado.
>
> El tiempo de entrega depende del examen; la recepcionista del laboratorio se lo confirma.
>
> Si desea que una persona le ayude, escriba *recepción*.

**Observaciones del revisor:** ______________________________________________

---

### H2. Pedir que se interpreten resultados

**Paciente:** ¿me interpretas mis resultados? ¿es normal?

> Entiendo su preocupación 💙, pero *no puedo dar diagnósticos, interpretar síntomas ni recomendar medicamentos*. Eso solo lo puede hacer un médico en una consulta. No necesita darme detalles clínicos por aquí.
>
> Si lo desea, puedo agendarle una cita (escriba *agendar*). Si siente que empeora o es grave, llame al *911* (ECU 911).

**Observaciones del revisor:** ______________________________________________

---


## I. Seguridad: emergencias, salud mental y diagnósticos

### I1. Posible emergencia médica

_El número 911 sale de Configuración. Además crea una alerta urgente para el personal._

**Paciente:** Mi papá tiene dolor fuerte en el pecho y no puede respirar

> 🚨 *Lo que describe puede ser una emergencia médica.*
>
> Por favor *llame de inmediato al 911 (ECU 911)* o acuda ahora al servicio de emergencias más cercano. No espere una respuesta por este chat.
>
> Este asistente no puede evaluar urgencias ni dar indicaciones médicas. He avisado al personal de la clínica.

**Observaciones del revisor:** ______________________________________________

---

### I2. Posible riesgo para la vida (salud mental)

**Paciente:** ya no quiero vivir

> Lamento mucho que esté pasando por esto. Su seguridad es lo más importante y no tiene que enfrentarlo en soledad.
>
> 🚨 *Llame ahora al 911 (ECU 911)* o pida a alguien cercano que le acompañe y acuda al servicio de emergencias más próximo.
>
> He avisado al personal de la clínica para que pueda contactarle por este chat.

**Observaciones del revisor:** ______________________________________________

---

### I3. Pide diagnóstico o medicamento

**Paciente:** Me duele la cabeza hace días, ¿qué medicamento puedo tomar?

> Entiendo su preocupación 💙, pero *no puedo dar diagnósticos, interpretar síntomas ni recomendar medicamentos*. Eso solo lo puede hacer un médico en una consulta. No necesita darme detalles clínicos por aquí.
>
> Si lo desea, puedo agendarle una cita (escriba *agendar*). Si siente que empeora o es grave, llame al *911* (ECU 911).

**Observaciones del revisor:** ______________________________________________

---

### I4. Cuenta un síntoma pero quiere agendar

**Paciente:** Quiero agendar una cita, tengo fiebre

> Claro, le ayudo a agendar. No necesito detalles clínicos por aquí: el médico los revisará en su consulta. 💙

> Para continuar necesito registrar sus datos (su nombre y su número de WhatsApp) con el único fin de gestionar sus citas en *Centro ProSalud*.
>
> 🔒 Se tratan conforme a la Ley Orgánica de Protección de Datos Personales de Ecuador (LOPDP), no se comparten con terceros no autorizados y puede pedir acceso, rectificación o eliminación cuando lo desee escribiendo *recepción*. *No le pediré información médica por este chat.*
>
> ¿Acepta? Responda *SI* o *NO*.

**Observaciones del revisor:** ______________________________________________

---


## J. Hablar con una persona

### J1. Dentro del horario de recepción

**Paciente:** quiero hablar con una persona

> Claro 🙋 Le comunico con el equipo de recepción. Un recepcionista le escribirá en este mismo chat en unos minutos.

**Paciente:** hola?

_(el asistente no responde: la conversación la atiende una persona)_

**Paciente:** gracias

_(el asistente no responde: la conversación la atiende una persona)_

**Observaciones del revisor:** ______________________________________________

---

### J2. Fuera del horario (se avisa al personal de guardia)

_[EJEMPLO] Con el WhatsApp de guardia cargado se le envía un aviso (en esta versión el aviso queda registrado en el panel)._

**Paciente:** recepcionista por favor

> En este momento estamos fuera de nuestro horario de atención 🌙. Ya avisé al personal de guardia y le responderán por este chat lo antes posible.
>
> Si se trata de una emergencia, llame al *911* (ECU 911).

**Observaciones del revisor:** ______________________________________________

---

### J3. Emergencia mientras lo atiende una persona

_La alerta de emergencia siempre se envía, aunque el asistente esté en silencio._

**Paciente:** recepción

> Claro 🙋 Le comunico con el equipo de recepción. Un recepcionista le escribirá en este mismo chat en unos minutos.

**Paciente:** ahora mismo no puede respirar

> 🚨 *Lo que describe puede ser una emergencia médica.*
>
> Por favor *llame de inmediato al 911 (ECU 911)* o acuda ahora al servicio de emergencias más cercano. No espere una respuesta por este chat.
>
> Este asistente no puede evaluar urgencias ni dar indicaciones médicas. He avisado al personal de la clínica.

**Observaciones del revisor:** ______________________________________________

---


## K. Recordatorio de cita

### K1. Recordatorio automático

_Se envía antes de la cita según «Recordatorio (horas antes)» de Configuración. En WhatsApp real debe enviarse con una plantilla aprobada por Meta, cuyo texto se revisará aparte._

> 🔔 *Recordatorio de cita* — Centro ProSalud
> Hola Elena, le recordamos su cita con Dr. Ejemplo Dos: *sábado 3 de octubre, 18:10*.
> Responda *CONFIRMO* para confirmar, *REAGENDAR* para cambiarla o *CANCELAR* para anularla.

**Observaciones del revisor:** ______________________________________________

---

### K2. El paciente responde CONFIRMO

**Paciente:** CONFIRMO

> ¡Gracias! ✔ Asistencia confirmada:
>
> • sábado 3 de octubre, 18:10 — Dr. Ejemplo Dos (Medicina General)

**Observaciones del revisor:** ______________________________________________

---

