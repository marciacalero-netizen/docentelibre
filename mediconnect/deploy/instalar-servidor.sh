#!/usr/bin/env bash
# Instala MediConnect en un servidor Ubuntu limpio (probado para Ubuntu 24.04/26.04 LTS).
# Uso (como root, en la terminal del servidor):
#   curl -fsSL https://raw.githubusercontent.com/marciacalero-netizen/docentelibre/ccr-1b313d42-v6zt81/mediconnect/deploy/instalar-servidor.sh -o instalar.sh
#   bash instalar.sh correo@del.administrador "Nombre del administrador"
# Es seguro volver a ejecutarlo: no borra la base de datos existente.
# NO activa WhatsApp: eso se hace aparte, con autorización (docs/WHATSAPP.md).
set -euo pipefail

EMAIL="${1:-}"; NOMBRE="${2:-}"
REPO="https://github.com/marciacalero-netizen/docentelibre.git"
RAMA="${MEDICONNECT_BRANCH:-ccr-1b313d42-v6zt81}"
APP=/opt/mediconnect; DATA=/var/lib/mediconnect; ETC=/etc/mediconnect

[ "$(id -u)" = 0 ] || { echo "Ejecute como root."; exit 1; }
[ -n "$EMAIL" ] && [ -n "$NOMBRE" ] || { echo 'Uso: bash instalar.sh correo@admin "Nombre del administrador"'; exit 1; }
paso() { echo; echo "==> $*"; }

paso "1/7 Actualizando el sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get -y -q upgrade
apt-get -y -q install git curl ca-certificates xz-utils ufw fail2ban unattended-upgrades caddy sqlite3

paso "2/7 Seguridad: actualizaciones automáticas, firewall y bloqueo de intentos de acceso"
echo 'APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";' > /etc/apt/apt.conf.d/20auto-upgrades
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
systemctl enable --now fail2ban >/dev/null

paso "3/7 Instalando Node.js 22 (oficial, con verificación de integridad)"
NEED_NODE=1
if command -v node >/dev/null; then
  V=$(node -p 'process.versions.node'); M=${V%%.*}; R=$(echo "$V" | cut -d. -f2)
  if [ "$M" -gt 22 ] || { [ "$M" = 22 ] && [ "$R" -ge 18 ]; }; then NEED_NODE=0; fi
fi
if [ "$NEED_NODE" = 1 ]; then
  case "$(uname -m)" in x86_64) ARCH=x64;; aarch64) ARCH=arm64;; *) echo "Arquitectura no soportada"; exit 1;; esac
  BASE=https://nodejs.org/dist/latest-v22.x
  TMP=$(mktemp -d)
  curl -fsSL "$BASE/SHASUMS256.txt" -o "$TMP/SHASUMS256.txt"
  FILE=$(grep -o "node-v[0-9.]*-linux-$ARCH.tar.xz" "$TMP/SHASUMS256.txt" | head -1)
  curl -fsSL "$BASE/$FILE" -o "$TMP/$FILE"
  (cd "$TMP" && grep " $FILE\$" SHASUMS256.txt | sha256sum -c -)
  rm -rf /usr/local/lib/nodejs && mkdir -p /usr/local/lib/nodejs
  tar -xJf "$TMP/$FILE" -C /usr/local/lib/nodejs --strip-components=1
  ln -sf /usr/local/lib/nodejs/bin/node /usr/local/bin/node
  ln -sf /usr/local/lib/nodejs/bin/npm /usr/local/bin/npm
  rm -rf "$TMP"
fi
node -v

paso "4/7 Descargando MediConnect"
id mediconnect >/dev/null 2>&1 || useradd --system --home "$DATA" --shell /usr/sbin/nologin mediconnect
mkdir -p "$DATA/backups" "$ETC"
if [ -d "$APP/.git" ]; then git -C "$APP" fetch -q origin "$RAMA" && git -C "$APP" reset -q --hard "origin/$RAMA"
else rm -rf "$APP"; git clone -q --depth 1 --branch "$RAMA" "$REPO" "$APP"; fi
chown -R root:root "$APP"
chown -R mediconnect:mediconnect "$DATA"
chmod 750 "$DATA"
[ -f "$ETC/mediconnect.env" ] || printf '# Variables de MediConnect (WhatsApp va aquí, ver docs/WHATSAPP.md). Solo root puede leer este archivo.\n' > "$ETC/mediconnect.env"
chmod 600 "$ETC/mediconnect.env"

paso "5/7 Creando la base de datos del piloto"
cd "$APP/mediconnect"
if [ -s "$DATA/prosalud.db" ]; then
  echo "Ya existe una base de datos: se conserva sin cambios."
else
  runuser -u mediconnect -- node --disable-warning=ExperimentalWarning src/setup-prosalud.ts "$EMAIL" "$NOMBRE" --db="$DATA/prosalud.db"
  echo ">>> ANOTE la contraseña temporal de arriba en el cuaderno. No se vuelve a mostrar."
fi

paso "6/7 Servicio que arranca solo (también tras un reinicio)"
cat > /etc/systemd/system/mediconnect.service <<UNIT
[Unit]
Description=MediConnect
After=network-online.target
Wants=network-online.target

[Service]
User=mediconnect
WorkingDirectory=$APP/mediconnect
Environment=NODE_ENV=production HOST=127.0.0.1 PORT=3000 TRUST_PROXY=1 TZ=America/Guayaquil
Environment=GOOGLE_SERVICE_ACCOUNT_FILE=$ETC/google-service-account.json
EnvironmentFile=$ETC/mediconnect.env
ExecStart=/usr/local/bin/node --disable-warning=ExperimentalWarning src/server.ts --db=$DATA/prosalud.db
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
systemctl enable mediconnect >/dev/null
systemctl restart mediconnect

paso "7/7 Copia de seguridad diaria (03:30, se guardan 30 días)"
cat > /etc/cron.d/mediconnect-backup <<CRON
30 3 * * * mediconnect cd $APP/mediconnect && /usr/local/bin/node --disable-warning=ExperimentalWarning src/backup-cli.ts --db=$DATA/prosalud.db --out=$DATA/backups >/dev/null 2>&1 && find $DATA/backups -name 'prosalud-*.db' -mtime +30 -delete
CRON

sleep 3
if curl -fsS -o /dev/null http://127.0.0.1:3000/api/public; then
  echo; echo "LISTO: MediConnect está funcionando en el servidor (solo accesible internamente hasta activar HTTPS)."
  echo "Siguiente paso: cuando bot.centroprosalud.com apunte a este servidor, ejecute:"
  echo "  bash $APP/mediconnect/deploy/activar-https.sh bot.centroprosalud.com"
else
  echo "MediConnect no respondió. Revise con: journalctl -u mediconnect -n 50"; exit 1
fi
