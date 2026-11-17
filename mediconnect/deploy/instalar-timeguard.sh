#!/usr/bin/env bash
# Instala Game Time Guard (panel + API del control de tiempo de juego) en este servidor, separado de MediConnect:
# su propio usuario del sistema, carpeta (/opt/timeguard), datos (/var/lib/timeguard), servicio (timeguard) y puerto
# interno 3100. Caddy lo publica con HTTPS en el dominio indicado, sin tocar el sitio de MediConnect.
# Se puede volver a ejecutar para actualizar el programa: los datos no se borran.
# Requisito: el dominio debe apuntar a la IP de este servidor (registro DNS tipo A, nube gris en Cloudflare).
# Uso (como root):  bash /opt/mediconnect/mediconnect/deploy/instalar-timeguard.sh timeguard.mediconnectec.com
set -euo pipefail
DOM="${1:-}"
[ "$(id -u)" = 0 ] || { echo "Ejecute como root."; exit 1; }
[[ "$DOM" =~ ^[a-z0-9.-]+\.[a-z]{2,}$ ]] || { echo "Uso: bash deploy/instalar-timeguard.sh timeguard.mediconnectec.com"; exit 1; }
REPO="https://github.com/marciacalero-netizen/docentelibre.git"
RAMA="${TIMEGUARD_BRANCH:-claude/game-time-control-app-bo67yo}"
APP=/opt/timeguard
DATA=/var/lib/timeguard
PORT=3100
NODE=/usr/local/bin/node
paso() { echo; echo "== $1"; }

paso "1/5 Comprobando el dominio"
IP=$(curl -fsS https://api.ipify.org || true)
DNS=$(getent ahostsv4 "$DOM" | awk '{print $1; exit}' || true)
if [ -z "$DNS" ] || [ "$DNS" != "$IP" ]; then
  echo "El dominio $DOM todavía no apunta a este servidor (DNS: ${DNS:-ninguno}, servidor: $IP)."
  echo "En Cloudflare cree un registro A «${DOM%%.*}» → $IP con la nube GRIS (Solo DNS) y vuelva a intentarlo en unos minutos."
  exit 1
fi
[ -x "$NODE" ] || { echo "No se encontró Node.js en $NODE. Instale primero MediConnect (deploy/instalar-servidor.sh)."; exit 1; }
echo "   ✓ $DOM apunta a este servidor."

paso "2/5 Descargando Game Time Guard"
id timeguard >/dev/null 2>&1 || useradd --system --home "$DATA" --shell /usr/sbin/nologin timeguard
mkdir -p "$DATA"; chown timeguard:timeguard "$DATA"; chmod 750 "$DATA"
if [ -d "$APP/.git" ]; then
  git -C "$APP" fetch -q --depth 1 origin "$RAMA" && git -C "$APP" reset -q --hard FETCH_HEAD
else
  rm -rf "$APP"
  git clone -q --depth 1 --branch "$RAMA" --filter=blob:none --sparse "$REPO" "$APP"
  git -C "$APP" sparse-checkout set game-time-guard
fi
chown -R root:root "$APP"
cd "$APP/game-time-guard/backend"
paso "3/5 Instalando dependencias (puede tardar un minuto)"
npm ci --omit=dev --no-audit --no-fund --loglevel=error

paso "4/5 Creando el servicio"
cat > /etc/systemd/system/timeguard.service <<UNIT
[Unit]
Description=Game Time Guard
After=network-online.target
Wants=network-online.target

[Service]
User=timeguard
WorkingDirectory=$APP/game-time-guard/backend
Environment=NODE_ENV=production PORT=$PORT DATA_DIR=$DATA
ExecStart=$NODE src/server.js
Restart=always
RestartSec=5
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=$DATA

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable timeguard >/dev/null
systemctl restart timeguard
sleep 3
systemctl is-active --quiet timeguard || { echo "Game Time Guard no arrancó. Revise: journalctl -u timeguard -n 30"; exit 1; }
curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null || { echo "El servicio arrancó pero no responde. Revise: journalctl -u timeguard -n 30"; exit 1; }
echo "   ✓ Servicio funcionando."

paso "5/5 Publicando con HTTPS"
# Cada sitio extra va en su propio archivo; el Caddyfile principal (MediConnect) solo los importa.
mkdir -p /etc/caddy/sitios
cat > /etc/caddy/sitios/timeguard.caddy <<CADDY
$DOM {
	encode gzip
	reverse_proxy 127.0.0.1:$PORT
	header Strict-Transport-Security "max-age=31536000"
}
CADDY
grep -q '^import /etc/caddy/sitios/\*.caddy' /etc/caddy/Caddyfile || printf '\nimport /etc/caddy/sitios/*.caddy\n' >> /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile >/dev/null
systemctl reload caddy || systemctl restart caddy
sleep 8
echo
if curl -fsS -o /dev/null "https://$DOM/api/health"; then echo "LISTO: https://$DOM funciona."
else echo "Caddy está obteniendo el certificado; pruebe en un minuto: https://$DOM  (detalle: journalctl -u caddy -n 30)"; fi
if [ ! -s "$DATA/game-time-guard.sqlite3" ] || journalctl -u timeguard --since "-2 min" --no-pager | grep -q "Clave de adulto generada"; then
  echo
  echo "Siguiente paso: copiar los datos desde Render con:"
  echo "  bash $(dirname "$0")/importar-timeguard.sh"
fi
