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
| Derivación a una persona (pidió recepción, área…) | El bot se calla hasta que el personal pulse *Devolver al agente*. Si hay WhatsApp de recepción, además se entrega su enlace y la pausa se levanta sola tras `staff_pause_hours` sin respuesta del personal. |
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
4. En el número principal, el enlace de «hablar con una persona» debe apuntar a **otro** número, no al mismo.
5. Decidido: al migrar, el **chip piloto** pasa a ser el **WhatsApp de recepción** del centro (hoy se usa el número personal de Roxana). Pasos: eliminar el número piloto de la cuenta de WhatsApp en WhatsApp Manager, instalar WhatsApp Business con ese chip en el celular de recepción y cambiar «WhatsApp de recepción» en el panel.

## Instalación en el servidor (VPS)

1. En hPanel → VPS → **Terminal del navegador** (entrar como `root`).
2. Pegar:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/marciacalero-netizen/docentelibre/ccr-1b313d42-v6zt81/mediconnect/deploy/instalar-servidor.sh -o instalar.sh
   bash instalar.sh correo@admin "Nombre del administrador"
   ```
   Instala actualizaciones automáticas, firewall (solo SSH, 80 y 443), fail2ban, Node.js 22 verificado, el servicio `mediconnect` (escucha solo en 127.0.0.1) y una copia diaria de la base (`/var/lib/mediconnect/backups`, 30 días).
3. Cuando el DNS del dominio del bot (piloto: `prosalud.mediconnectec.com`, registro A con nube gris en Cloudflare) apunte a la IP del servidor: `bash /opt/mediconnect/mediconnect/deploy/activar-https.sh prosalud.mediconnectec.com` (Caddy, certificado automático).
4. Las variables de WhatsApp van en `/etc/mediconnect/mediconnect.env` (solo root). La forma recomendada es `bash /opt/mediconnect/mediconnect/deploy/configurar-whatsapp.sh` (pide los secretos sin mostrarlos, busca con el token los números de la cuenta de WhatsApp —basta el identificador de la cuenta (WABA)—, genera el token de verificación, asocia el número y reinicia). Como la terminal del navegador de Hostinger puede no permitir pegar, conviene conectarse por SSH desde PowerShell: `ssh root@<IP del servidor>`.
5. Registro del número: `bash /opt/mediconnect/mediconnect/deploy/registrar-numero.sh <WABA>`. Muestra el estado del número en Meta, pide un PIN de 6 dígitos sin mostrarlo (no se guarda), registra el número en la Cloud API y suscribe la app a la cuenta de WhatsApp para que los mensajes lleguen al webhook. Puede intentarse aunque el nombre visible siga «En revisión»; si Meta no lo permite, el script muestra su mensaje y no cambia nada.

## Política de privacidad (requisito para publicar la app)

El servidor publica `https://<dominio>/privacidad` (y `/eliminacion-datos`, que lleva a la sección de eliminación). Toma el nombre y la dirección de la clínica desde la base. En Meta → app → Configuración de la app → Básica, cargar esas dos direcciones en «URL de la política de privacidad» y «URL de instrucciones para la eliminación de datos». **Es un borrador**: debe revisarlo el asesor legal del centro (copia en `docs/Politica_de_privacidad_ProSalud_BORRADOR.docx`; el texto vive en `src/privacy.ts`).
