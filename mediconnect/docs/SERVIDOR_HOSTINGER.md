# Mi servidor (Hostinger VPS) — datos para instalar otra aplicación

Resumen para compartir con quien prepare una nueva aplicación. **No contiene contraseñas, tokens ni claves.**

## El servidor

| Qué | Dato |
|---|---|
| Proveedor | Hostinger, **VPS** (servidor virtual privado; no es hosting compartido). Plan: ver hPanel → VPS |
| Nombre | `srv2050025` |
| IP pública | `179.236.68.241` |
| Sistema | Ubuntu (Linux), acceso **root** por SSH: `ssh root@179.236.68.241` (contraseña; la tiene la dueña) |
| Panel de Hostinger | hpanel.hostinger.com → VPS (también tiene «Terminal del navegador») |
| Firewall | Solo abiertos los puertos **22** (SSH), **80** y **443** (web). fail2ban activo. Actualizaciones automáticas de seguridad |
| Node.js | **v22** instalado en `/usr/local/bin/node` (con npm) |
| Servidor web / HTTPS | **Caddy** (certificados gratuitos automáticos). Configuración principal `/etc/caddy/Caddyfile` |
| Base de datos | No hay motor de base de datos instalado (MySQL/PostgreSQL). Las apps usan **SQLite** (archivos) |
| No instalado | PHP, WordPress, CloudPanel, Docker |
| Dominio | `mediconnectec.com`, DNS en **Cloudflare** (registros A con **nube gris / «Solo DNS»**) |

## Lo que ya corre ahí (no tocar)

| Aplicación | Dirección | Puerto interno | Servicio | Carpeta / datos |
|---|---|---|---|---|
| MediConnect (Gia, panel y web de ProSalud) | prosalud.mediconnectec.com | **3000** | `mediconnect` | `/opt/mediconnect`, `/var/lib/mediconnect` |
| Game Time Guard | gametimeguard.mediconnectec.com | **3100** | `timeguard` | `/opt/timeguard`, `/var/lib/timeguard` |

Cada aplicación tiene su **propio usuario del sistema**, carpeta, datos y servicio `systemd`, y escucha solo en `127.0.0.1`.
Caddy las publica con HTTPS.

## Cómo agregar una aplicación nueva sin romper las anteriores

1. **Dirección:** en Cloudflare, registro **A** con un nombre nuevo (p. ej. `miapp`) → `179.236.68.241`, **nube gris**.
2. **Puerto interno libre:** usar **3200** u otro que no sea 3000 ni 3100; escuchar solo en `127.0.0.1`.
3. **Usuario y carpetas propios:** p. ej. usuario `miapp`, código en `/opt/miapp`, datos en `/var/lib/miapp`.
4. **Servicio systemd propio** (p. ej. `/etc/systemd/system/miapp.service`), con `Restart=always`.
5. **Caddy:** **no reemplazar** `/etc/caddy/Caddyfile`. Crear un archivo nuevo en `/etc/caddy/sitios/` (el Caddyfile ya
   los importa con `import /etc/caddy/sitios/*.caddy`), por ejemplo `/etc/caddy/sitios/miapp.caddy`:
   ```
   miapp.mediconnectec.com {
   	encode gzip
   	reverse_proxy 127.0.0.1:3200
   }
   ```
   Luego `caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy`.
6. Si la app necesita claves o tokens: guardarlos en un archivo solo de root (p. ej. `/etc/miapp/miapp.env`, permisos 600),
   nunca en el repositorio ni en el chat.

Ejemplo de referencia completo: `mediconnect/deploy/instalar-timeguard.sh` en el repositorio
`marciacalero-netizen/docentelibre` (rama `ccr-1b313d42-v6zt81`).
