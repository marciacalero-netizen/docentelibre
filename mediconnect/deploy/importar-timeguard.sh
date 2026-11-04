#!/usr/bin/env bash
# Copia la base de datos de Game Time Guard desde Render a este servidor (clave de adulto, juegos y sitios bloqueados,
# minutos usados y el token del agente de Windows, que así sigue funcionando sin reinstalarlo).
# Usa el SSH de Render: la primera vez crea una llave en este servidor y le pide agregarla en Render.
# No borra nada en Render. Guarda una copia de los datos que hubiera aquí antes de reemplazarlos.
# Uso (como root):  bash /opt/mediconnect/mediconnect/deploy/importar-timeguard.sh
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Ejecute como root."; exit 1; }
DATA=/var/lib/timeguard
DB=game-time-guard.sqlite3
APP=/opt/timeguard/game-time-guard/backend
RAPP=/opt/render/project/src/game-time-guard/backend
KEY=/root/.ssh/render_timeguard
[ -d "$APP/node_modules" ] || { echo "Primero instale Game Time Guard: bash deploy/instalar-timeguard.sh <dominio>"; exit 1; }

if [ ! -f "$KEY" ]; then
  mkdir -p /root/.ssh; chmod 700 /root/.ssh
  ssh-keygen -q -t ed25519 -N '' -C "timeguard-$(hostname)" -f "$KEY"
fi
echo "Llave pública de este servidor (no es secreta):"
echo
cat "$KEY.pub"
echo
echo "1) Cópiela en Render: foto de perfil → Account Settings → SSH Public Keys → Add SSH Public Key."
echo "2) En Render abra el servicio game-time-guard → botón «Connect» → pestaña «SSH» y copie la dirección"
echo "   (tiene la forma srv-xxxxxxxx@ssh.virginia.render.com)."
read -rp "Pegue esa dirección y pulse Enter: " DEST
DEST=$(printf '%s' "$DEST" | tr -d '[:space:]' | sed 's/^ssh//')
[[ "$DEST" =~ ^srv-[a-z0-9]+@ssh\.[a-z0-9-]+\.render\.com$ ]] || { echo "Esa dirección no tiene la forma srv-xxxx@ssh.region.render.com."; exit 1; }
SSH=(ssh -q -i "$KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 -o LogLevel=ERROR "$DEST")

echo "Conectando con Render…"
"${SSH[@]}" true || { echo "No se pudo entrar a Render por SSH: revise que la llave esté agregada en Render y la dirección sea correcta."; exit 1; }
# Busca la base: primero en DATA_DIR del servicio, luego en el disco del render.yaml y en la carpeta por defecto del programa.
RPATH=$("${SSH[@]}" 'for d in "$DATA_DIR" /opt/render/project/src/data /opt/render/project/src/game-time-guard/backend/data /var/data /data; do [ -n "$d" ] && [ -f "$d/game-time-guard.sqlite3" ] && { echo "$d"; exit 0; }; done; f=$(find /opt /var /data /mnt /srv /home -name game-time-guard.sqlite3 2>/dev/null | head -1); [ -n "$f" ] && dirname "$f"' | tr -d '\r' | tail -1 || true)
if [ -z "$RPATH" ]; then
  echo "Se entró a Render, pero no se encontró la base de datos (game-time-guard.sqlite3). Datos del servicio para revisar:"
  "${SSH[@]}" 'echo "DATA_DIR=${DATA_DIR:-(vacío)}"; df -h 2>/dev/null | grep -v -E "tmpfs|overlay|shm" ; ls -la /opt/render/project/src 2>/dev/null | head -20' || true
  echo "Envíeme una foto de esta pantalla."; exit 1
fi
RDATA="$RPATH"
echo "   ✓ Base encontrada en Render: $RDATA/$DB"
# Junta en el archivo principal los cambios pendientes del modo WAL, para copiar un solo archivo completo.
"${SSH[@]}" "cd $RAPP && node -e \"const D=require('better-sqlite3');const d=new D('$RDATA/$DB');d.pragma('wal_checkpoint(TRUNCATE)');d.close()\"" \
  || echo "   (aviso: no se pudo consolidar el WAL; se copia igual)"
TMP=$(mktemp -d)
"${SSH[@]}" "cat $RDATA/$DB" > "$TMP/$DB"
[ -s "$TMP/$DB" ] || { echo "La copia llegó vacía. No se cambió nada."; rm -rf "$TMP"; exit 1; }
# Si quedaron cambios en el archivo -wal (no se pudo consolidar en Render), también se copia y se consolida aquí.
if "${SSH[@]}" "test -s $RDATA/$DB-wal" 2>/dev/null; then
  "${SSH[@]}" "cat $RDATA/$DB-wal" > "$TMP/$DB-wal" 2>/dev/null || rm -f "$TMP/$DB-wal"
  (cd "$APP" && /usr/local/bin/node -e "const D=require('better-sqlite3');const d=new D(process.argv[1]);d.pragma('wal_checkpoint(TRUNCATE)');d.close()" "$TMP/$DB") \
    && echo "   ✓ Cambios recientes (WAL) incluidos." || echo "   (aviso: no se pudieron incluir los cambios del WAL)"
  rm -f "$TMP/$DB-wal" "$TMP/$DB-shm"
fi

echo "Comprobando la copia…"
cd "$APP"
RES=$("/usr/local/bin/node" -e "
const D=require('better-sqlite3');const d=new D(process.argv[1],{readonly:true});
const ok=d.pragma('integrity_check',{simple:true});
const s=d.prepare('SELECT COUNT(*) n FROM settings').get().n;
const g=d.prepare('SELECT COUNT(*) n FROM blocked_games').get().n;
const w=d.prepare('SELECT COUNT(*) n FROM blocked_domains').get().n;
const u=d.prepare('SELECT COUNT(*) n FROM usage_daily').get().n;
console.log([ok,s,g,w,u].join('|'));" "$TMP/$DB") || { echo "El archivo copiado no es una base válida. No se cambió nada."; rm -rf "$TMP"; exit 1; }
IFS='|' read -r OK S G W U <<< "$RES"
[ "$OK" = "ok" ] && [ "$S" = "1" ] || { echo "La base copiada no está completa (integridad: $OK). No se cambió nada."; rm -rf "$TMP"; exit 1; }
echo "   ✓ Base válida: $G juego(s) y $W sitio(s) bloqueados, $U día(s) de uso registrados."

systemctl stop timeguard
if [ -f "$DATA/$DB" ]; then mv "$DATA/$DB" "$DATA/$DB.antes-$(date +%Y%m%d-%H%M)"; fi
rm -f "$DATA/$DB-wal" "$DATA/$DB-shm"
install -m 600 -o timeguard -g timeguard "$TMP/$DB" "$DATA/$DB"
rm -rf "$TMP"
systemctl start timeguard
sleep 3
systemctl is-active --quiet timeguard || { echo "Game Time Guard no arrancó con los datos copiados. Revise: journalctl -u timeguard -n 30"; exit 1; }
echo
echo "LISTO: los datos de Render ya están en este servidor. Entre al panel nuevo con su misma clave de adulto."
echo "Render sigue funcionando: no lo apague hasta cambiar la dirección del agente en la PC y comprobar que todo anda."
