# Vincular MediConnect con Google Calendar (opcional)

**Qué hace:** cada cita que se crea, se reagenda, se confirma o se cancela en MediConnect (por WhatsApp o desde el panel) se refleja sola en un calendario de Google, para que los médicos la vean en su celular. Es de **un solo sentido**: MediConnect → Google. Lo que se cambie en Google Calendar **no** vuelve a MediConnect (reagende y cancele siempre desde MediConnect o por WhatsApp).

**Estado:** desactivado por defecto. Está probado contra un servidor de Google simulado; **todavía no se ha probado con una cuenta real de Google**, por eso conviene hacer primero una prueba con un calendario de ensayo.

## Qué datos salen hacia Google
Por cada cita: nombre del paciente (o solo iniciales, ajustable), especialidad, nombre del médico, fecha/hora y la dirección del centro. **Nunca** el teléfono ni datos clínicos. Si un paciente pide la supresión de sus datos, sus eventos se borran de Google. Es un traspaso de datos personales a un proveedor en el extranjero: inclúyalo en el aviso de privacidad y confírmelo en la revisión legal de la LOPDP. Con la opción **«Solo iniciales»** el calendario no muestra nombres.

## Pasos (una sola vez, unos 15 minutos)
Los hace una persona del centro con una cuenta de Google (puede ser Gmail normal o Google Workspace). No requiere pagar nada.

1. **Crear un proyecto:** entre a <https://console.cloud.google.com> → arriba, «Seleccionar proyecto» → «Proyecto nuevo» → nombre «MediConnect ProSalud».
2. **Activar la API:** menú «APIs y servicios» → «Biblioteca» → busque **Google Calendar API** → «Habilitar».
3. **Crear la cuenta de servicio** (es un «usuario robot» que escribe en los calendarios): «APIs y servicios» → «Credenciales» → «Crear credenciales» → «Cuenta de servicio» → nombre «mediconnect» → «Listo». Copie el correo que le asigna (termina en `…iam.gserviceaccount.com`).
4. **Descargar la clave:** entre a esa cuenta de servicio → pestaña «Claves» → «Agregar clave» → «Crear clave nueva» → **JSON**. Guarde el archivo con este nombre exacto en el computador donde corre MediConnect:
   `mediconnect/config/google-service-account.json`
   *(Es una contraseña: no la envíe por WhatsApp ni la suba a ningún sitio. Git ya la ignora.)*
5. **Crear los calendarios** en <https://calendar.google.com>: «Otros calendarios» → «+» → «Crear calendario nuevo». Recomendado: **uno por médico** (p. ej. «Dra. Taquez – ProSalud») y, si desea, uno general.
6. **Compartir cada calendario con la cuenta de servicio:** en la lista de calendarios → los tres puntos del calendario → «Configuración y uso compartido» → «Compartir con personas o grupos específicos» → agregue el correo del paso 3 con el permiso **«Hacer cambios en los eventos»**. Aproveche para compartirlo también con el médico correspondiente (con su correo) para que lo vea en su celular.
7. **Copiar el ID del calendario:** en esa misma pantalla, sección «Integrar el calendario» → «ID de calendario» (se parece a `abc123@group.calendar.google.com`; el calendario principal de una cuenta es su correo).
8. **Cargar los IDs en MediConnect** (panel, como administrador):
   - **Médicos** → editar al médico → «ID de Google Calendar de este médico».
   - **Configuración** → «Google Calendar» → «ID del calendario predeterminado» (se usa para los médicos que no tienen uno propio).
9. **Activar:** Configuración → marque «Sincronizar las citas con Google Calendar» → «Guardar cambios». En la tarjeta «Estado de Google Calendar» pulse **«Probar el calendario predeterminado»**: debe decir «Conexión correcta».
10. Cree una cita de prueba y pulse **«Sincronizar ahora»**: debe aparecer en el calendario del médico (la sincronización también corre sola cada minuto).

## Qué pasa si algo falla
- Si Google no responde o falta un permiso, la cita **no se pierde**: queda en una cola y se reintenta cada minuto (hasta 8 veces). El panel muestra el último error en claro («comparta el calendario con la cuenta de servicio…»).
- Pasados 8 intentos deja de insistir; corrija la causa y use **«Reintentar los fallidos»**.
- Si alguien borra un evento a mano en Google, MediConnect lo vuelve a crear la próxima vez que la cita cambie.
- Si se cambia el calendario de un médico, los eventos se mueven al nuevo en la siguiente actualización de cada cita.

## Lo que todavía no hace
- No lee Google Calendar: un feriado, una reunión o una ausencia anotados allí **no** bloquean horarios en el asistente (eso sería una segunda etapa, leyendo «ocupado/libre»).
- No sincroniza citas anteriores a la activación: solo las nuevas o modificadas desde entonces.
- No cambia el evento al marcar «atendida» o «no asistió».
