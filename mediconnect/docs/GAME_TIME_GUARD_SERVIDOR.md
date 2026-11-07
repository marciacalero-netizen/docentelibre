# Game Time Guard en el servidor propio

Control del tiempo de juego de la PC de Mathias. Desde noviembre de 2026 funciona en el servidor de Hostinger,
**separado** de MediConnect (Gia y la web de ProSalud): tiene su propio usuario, carpeta, datos y servicio.

## Datos clave

| Qué | Dónde |
|---|---|
| Panel (celular o computadora) | https://gametimeguard.mediconnectec.com |
| Servidor | VPS de Hostinger, IP 179.236.68.241 (`ssh root@179.236.68.241`) |
| Programa | `/opt/timeguard` (código de la rama `claude/game-time-control-app-bo67yo` del repositorio docentelibre) |
| Datos (base SQLite) | `/var/lib/timeguard/game-time-guard.sqlite3` |
| Servicio | `timeguard` (puerto interno 3100) |
| Dirección en Cloudflare | Registro A `gametimeguard` → 179.236.68.241, nube gris («Solo DNS») |
| PC de Mathias | DESKTOP-32GG6JF, servicio de Windows `GameTimeGuardAgent` |
| Configuración del agente | `C:\ProgramData\GameTimeGuard\agent-config.json` (dirección del servidor y token) |
| Render (anterior) | Servicio `game-time-guard` **suspendido**. Borrarlo (con su disco) si todo sigue bien. |

**Nunca** fotografiar ni enviar por chat el token del agente, la clave de adulto ni la contraseña del servidor.

## Comandos útiles (en el servidor)

Entrar: `ssh root@179.236.68.241` y la contraseña. Cada línea empieza con `root@srv2050025`;
si empieza con `PS C:\…` está en Windows y hay que entrar primero con `ssh`.

| Para | Comando |
|---|---|
| Ver si funciona | `systemctl status timeguard` |
| Ver errores | `journalctl -u timeguard -n 30 --no-pager` |
| Reiniciar el programa | `systemctl restart timeguard` |
| Actualizar el programa (los datos no se borran) | `cd /opt/mediconnect/mediconnect && git pull -q && bash deploy/instalar-timeguard.sh gametimeguard.mediconnectec.com` |
| Generar un token nuevo del agente | `cd /opt/mediconnect/mediconnect && bash deploy/nuevo-token-timeguard.sh` |
| Copia de la base de datos | `cp /var/lib/timeguard/game-time-guard.sqlite3 /root/timeguard-copia-$(date +%F).sqlite3` |

## Poner un token nuevo en la PC de Mathias

PowerShell **como administrador** en la PC (clic derecho → «Ejecutar como administrador»), una línea a la vez:

```
$f = "C:\ProgramData\GameTimeGuard\agent-config.json"
$t = Read-Host "Pegue el token nuevo"
$c = Get-Content $f -Raw | ConvertFrom-Json; $c.DeviceToken = $t.Trim(); $c | ConvertTo-Json | Set-Content $f -Encoding UTF8
Restart-Service GameTimeGuardAgent
```

En un minuto el panel debe decir **conectado**.

## Si la PC aparece desconectada

1. En la PC (PowerShell de administrador): `Get-Service GameTimeGuardAgent` → debe decir **Running**.
   Si no: `Restart-Service GameTimeGuardAgent`.
2. Revisar que la PC tenga internet.
3. En el servidor: `systemctl status timeguard` y `journalctl -u timeguard -n 30 --no-pager`.
4. Si se cambió el token en el servidor, hay que ponerlo también en la PC (sección anterior).

Aunque la PC pierda internet, el agente sigue bloqueando con la última configuración conocida.

## Volver atrás (solo si algo fallara gravemente)

Render está suspendido, no borrado: en Render → game-time-guard → **Resume**. En la PC, restaurar la configuración anterior:

```
$f = "C:\ProgramData\GameTimeGuard\agent-config.json"
Copy-Item "$f.respaldo" $f -Force; Restart-Service GameTimeGuardAgent
```

## Cómo se hizo el traslado (referencia)

1. Cloudflare: registro A `gametimeguard` → IP del servidor, nube gris.
2. Servidor: `bash deploy/instalar-timeguard.sh gametimeguard.mediconnectec.com`.
3. Datos: `bash deploy/importar-timeguard.sh` (copia la base desde el disco de Render por SSH; la llave del servidor
   quedó agregada en Render → Account Settings → SSH Public Keys como «servidor mediconnect»; se puede quitar
   al borrar el servicio de Render).
4. PC: se cambió `ApiBaseUrl` en `agent-config.json` a la dirección nueva (copia en `agent-config.json.respaldo`).
5. Render: servicio suspendido.

## Pendientes

- [ ] Una semana después, borrar el servicio y el disco en Render; revisar Billing.
- [ ] Quitar la llave SSH «servidor mediconnect» de Render cuando se borre el servicio.
- [ ] Borrar las fotos donde se vio el token o la contraseña anterior del servidor.
