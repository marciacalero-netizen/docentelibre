# Conexión de MediConnect con WhatsApp (Cloud API de Meta)

Estado: **programada y probada con mensajes simulados. No está conectada a ningún servicio real**: no se usó ninguna cuenta, número, token ni servidor. Se enciende solo con `WHATSAPP_ENABLED=true`.

## Qué hace

| Situación | Comportamiento |
|---|---|
| Un paciente escribe | El agente responde por WhatsApp. El `phone_number_id` del mensaje decide a qué clínica pertenece. |
| Meta reenvía un webhook | Cada mensaje se procesa una sola vez (`wa_processed`). |
| Llega audio, imagen, ubicación… | Se pide que escriba en texto y se recuerda el 911. No se guarda el archivo. |
| Una persona del centro responde **desde la app WhatsApp Business** (modo coexistencia) | El bot se pausa en esa conversación. Vuelve solo tras `staff_pause_hours` (8 h por defecto, configurable en Configuración → Citas). |
| Una persona responde **desde el panel** | El mensaje sale por WhatsApp; si no sale (p. ej. ventana de 24 h vencida) el panel lo avisa y no lo registra como enviado. |
| Derivación a una persona (pidió recepción, área…) | El bot se calla hasta que el personal pulse *Devolver al agente*. Esa pausa **no** se levanta sola. |
| Emergencia / riesgo de vida | Se responde **siempre**, aunque atienda una persona. |
| WhatsApp rechaza un envío | Alerta urgente en el panel («No se pudo enviar…»). El token nunca aparece en mensajes ni registros. |

## Lo que NO hace todavía

- **Recordatorios de citas y avisos a la guardia por WhatsApp.** Salen fuera de la ventana de 24 h, y WhatsApp solo permite ahí **plantillas aprobadas por Meta**. Hoy quedan registrados en el panel. Falta crear y aprobar las plantillas.
- Mensajes con botones o listas (se leen como texto si el paciente los usa).
- Cola de salida persistente: ante un fallo se reintenta 2 veces y luego se avisa en el panel.
- Varias clínicas con token propio: hoy hay un solo `WHATSAPP_TOKEN` (suficiente para el piloto).

## Variables de entorno (secretos: nunca en Git ni en chats)

Ver `config/whatsapp.env.example`. Si `WHATSAPP_ENABLED=true` y falta alguna, el servidor **no arranca** y dice cuál.

## Puesta en marcha (requiere autorización explícita antes de cada paso externo)

1. **Meta**: en el portafolio del centro, una app de tipo *Empresa* con el producto *WhatsApp*; copiar la *Clave secreta de la app*.
2. **Token permanente**: crear un *usuario del sistema* en el portafolio, asignarle la cuenta de WhatsApp con control total y generar el token (permisos `whatsapp_business_messaging` y `whatsapp_business_management`). Guardarlo solo en el servidor.
3. **Servidor con HTTPS** (Meta exige una dirección segura): un VPS con un proxy inverso que entregue `https://<dominio>/webhook/whatsapp` a `127.0.0.1:3000`. El dominio puede ser de cualquier titular, pero el centro debe controlar su DNS o tener un dominio propio.
4. **Webhook en Meta**: URL `https://<dominio>/webhook/whatsapp`, token de verificación = `WHATSAPP_VERIFY_TOKEN`; suscribir los campos `messages` y, si el número está en coexistencia, `smb_message_echoes`. *(Verificar nombres y requisitos en la documentación vigente de Meta al conectar.)*
5. **Asociar el número a la clínica**: `npm run whatsapp:phone -- <phone_number_id>` (el ID está en WhatsApp Manager → Números de teléfono).
6. Arrancar con las variables cargadas y probar **solo con el personal** (número del chip nuevo).

## Piloto por etapas

1. Chip nuevo, **cuenta de WhatsApp vacía del portafolio**, solo con el personal.
2. Revisión legal (LOPDP) y médica de los textos de emergencia.
3. Recién después, pasar el número principal del centro. Antes de conectarlo hay que confirmar si **Meta ofrece coexistencia** para ese número: si no la ofrece, conectar la plataforma **apaga la app WhatsApp Business** del celular de recepción.
4. En el número principal, el enlace de «hablar con una persona» debe apuntar a **otro** número (el de Roxana), no al mismo.

## Instalación en el servidor (VPS)

1. En hPanel → VPS → **Terminal del navegador** (entrar como `root`).
2. Pegar:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/marciacalero-netizen/docentelibre/ccr-1b313d42-v6zt81/mediconnect/deploy/instalar-servidor.sh -o instalar.sh
   bash instalar.sh correo@admin "Nombre del administrador"
   ```
   Instala actualizaciones automáticas, firewall (solo SSH, 80 y 443), fail2ban, Node.js 22 verificado, el servicio `mediconnect` (escucha solo en 127.0.0.1) y una copia diaria de la base (`/var/lib/mediconnect/backups`, 30 días).
3. Cuando el DNS de `bot.centroprosalud.com` apunte a la IP del servidor: `bash /opt/mediconnect/mediconnect/deploy/activar-https.sh bot.centroprosalud.com` (Caddy, certificado automático).
4. Las variables de WhatsApp van en `/etc/mediconnect/mediconnect.env` (solo root), y luego `systemctl restart mediconnect`.
