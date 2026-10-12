#!/usr/bin/env bash
# Carga las credenciales de WhatsApp (Cloud API) en el servidor y enciende el canal.
# Pide los secretos sin mostrarlos en pantalla y los guarda SOLO en /etc/mediconnect/mediconnect.env (solo root).
# Genera el token de verificación del webhook y lo muestra para copiarlo en Meta.
# Uso (como root):  bash /opt/mediconnect/mediconnect/deploy/configurar-whatsapp.sh
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Ejecute como root."; exit 1; }
ENV=/etc/mediconnect/mediconnect.env
APP=/opt/mediconnect/mediconnect
DB=/var/lib/mediconnect/prosalud.db
[ -f "$ENV" ] || { echo "No existe $ENV. Instale primero MediConnect."; exit 1; }

echo "Pegue cada dato y pulse Enter. Por seguridad, la clave y el token NO se verán al pegarlos."
read -rp  "1/3  Identificador del número de teléfono (phone_number_id, solo dígitos): " PHONE_ID
[[ "$PHONE_ID" =~ ^[0-9]{5,20}$ ]] || { echo "El identificador debe tener solo dígitos."; exit 1; }
read -rsp "2/3  Clave secreta de la app (App Secret): " SECRET; echo
[[ "$SECRET" =~ ^[A-Za-z0-9]{16,}$ ]] || { echo "La clave secreta no tiene el formato esperado (letras y números)."; exit 1; }
read -rsp "3/3  Token permanente del usuario del sistema: " TOKEN; echo
[[ "$TOKEN" =~ ^[A-Za-z0-9_-]{50,}$ ]] || { echo "El token no tiene el formato esperado (parece incompleto)."; exit 1; }

VERIFY=$(grep -E '^WHATSAPP_VERIFY_TOKEN=.+' "$ENV" | cut -d= -f2- || true)
[ -n "$VERIFY" ] || VERIFY="mc-$(head -c 18 /dev/urandom | od -An -tx1 | tr -d ' \n')"

TMP=$(mktemp)
grep -vE '^(WHATSAPP_ENABLED|WHATSAPP_VERIFY_TOKEN|WHATSAPP_APP_SECRET|WHATSAPP_TOKEN)=' "$ENV" > "$TMP" || true
{ echo "WHATSAPP_ENABLED=true"; echo "WHATSAPP_VERIFY_TOKEN=$VERIFY"; echo "WHATSAPP_APP_SECRET=$SECRET"; echo "WHATSAPP_TOKEN=$TOKEN"; } >> "$TMP"
install -m 600 -o root -g root "$TMP" "$ENV"; rm -f "$TMP"
unset SECRET TOKEN

cd "$APP"
runuser -u mediconnect -- node --disable-warning=ExperimentalWarning src/whatsapp-cli.ts "$PHONE_ID" --db="$DB"
systemctl restart mediconnect
sleep 3
systemctl is-active --quiet mediconnect || { echo "MediConnect no arrancó. Revise: journalctl -u mediconnect -n 30"; exit 1; }

DOM=$(grep -oE '^[a-z0-9.-]+\.[a-z]{2,}' /etc/caddy/Caddyfile | head -1 || true)
echo
echo "LISTO: WhatsApp quedó encendido en el servidor."
echo "Ahora, en Meta → WhatsApp → Configuración → Webhook, escriba:"
echo "  URL de devolución de llamada:  https://${DOM:-<su-dominio>}/webhook/whatsapp"
echo "  Token de verificación:          $VERIFY"
echo "y suscriba el campo «messages»."
echo
echo "Para apagar WhatsApp: cambie WHATSAPP_ENABLED=true por false en $ENV y ejecute: systemctl restart mediconnect"
