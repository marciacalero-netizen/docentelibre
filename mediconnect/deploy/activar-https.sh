#!/usr/bin/env bash
# Publica MediConnect con HTTPS (certificado gratuito automático) en el dominio indicado.
# Requisito: el dominio ya debe apuntar a la IP de este servidor (registro DNS tipo A).
# Uso (como root): bash activar-https.sh bot.centroprosalud.com
set -euo pipefail
DOM="${1:-}"
[ "$(id -u)" = 0 ] || { echo "Ejecute como root."; exit 1; }
[[ "$DOM" =~ ^[a-z0-9.-]+\.[a-z]{2,}$ ]] || { echo "Uso: bash activar-https.sh bot.centroprosalud.com"; exit 1; }
IP=$(curl -fsS https://api.ipify.org || true)
DNS=$(getent ahostsv4 "$DOM" | awk '{print $1; exit}' || true)
if [ -z "$DNS" ] || [ "$DNS" != "$IP" ]; then
  echo "El dominio $DOM todavía no apunta a este servidor (DNS: ${DNS:-ninguno}, servidor: $IP). Espere a que Netlife cree el registro y vuelva a intentarlo."; exit 1
fi
cat > /etc/caddy/Caddyfile <<CADDY
$DOM {
	encode gzip
	reverse_proxy 127.0.0.1:3000
	header Strict-Transport-Security "max-age=31536000"
}
CADDY
caddy validate --config /etc/caddy/Caddyfile >/dev/null
systemctl reload caddy || systemctl restart caddy
sleep 8
if curl -fsS -o /dev/null "https://$DOM/api/public"; then echo "LISTO: https://$DOM funciona con certificado válido."
else echo "Caddy está obteniendo el certificado; pruebe en un minuto: https://$DOM  (detalle: journalctl -u caddy -n 30)"; fi
