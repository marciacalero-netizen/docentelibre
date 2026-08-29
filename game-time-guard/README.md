# Game Time Guard

Sistema para controlar el tiempo de juego en la computadora de tu nieto,
con panel de control desde el celular (o cualquier navegador) protegido
por una clave de adulto.

Tiene tres partes:

- **`agent/`** — programa que corre en la PC de Windows como servicio del
  sistema. Detecta y cierra los juegos bloqueados fuera de horario o cuando
  se acabó el tiempo permitido.
- **`backend/`** — servidor (API + base de datos) que guarda la
  configuración y el uso diario, para que puedas verlo/editarlo desde
  cualquier lugar.
- **`web/`** — panel web mobile-friendly (se puede "instalar" en la
  pantalla de inicio del celular) donde controlás todo con tu clave de
  adulto.

## ⚠️ Paso 0 (el más importante de todos)

Ningún programa de control parental es 100% infranqueable si el chico
tiene una cuenta con permisos de **administrador** en Windows. Con
permisos de admin se puede desinstalar cualquier programa, entrar en
Modo Seguro, etc.

Antes de instalar nada, asegurate de que tu nieto use una **cuenta
estándar** y que solo vos tengas la contraseña de una cuenta de
administrador:

1. Windows: `Configuración` → `Cuentas` → `Familia y otros usuarios`.
2. Si la cuenta de tu nieto dice "Administrador" debajo del nombre,
   hacé clic en ella → `Cambiar tipo de cuenta` → elegí **Estándar**.
3. Asegurate de tener vos misma una cuenta de Administrador con
   contraseña que él no conozca.
4. (Recomendado, opcional) Poné una contraseña de arranque/BIOS o UEFI
   para que no pueda bootear en Modo Seguro y sortear el servicio. Esto
   se configura fuera de Windows, entrando a la BIOS al prender la PC
   (la tecla depende de la marca: Del, F2, F10, etc.).

Con cuenta estándar, tu nieto **no puede** detener el servicio, borrar la
carpeta del programa, ni desinstalarlo — Windows le va a pedir la
contraseña de administrador que no tiene.

## Cómo funciona

- Vos definís, desde el panel web, qué juegos están bloqueados y bajo qué
  reglas: una **bolsa de minutos por día** (ej. 180 min = 3 horas, a
  cualquier hora), una **franja horaria fija** (ej. solo de 16 a 19hs), o
  **ambas** combinadas.
- El agente en la PC revisa cada pocos segundos si hay algún juego
  bloqueado corriendo. Si no está permitido jugar en ese momento, lo
  cierra automáticamente — por más que tu nieto lo vuelva a abrir, se
  vuelve a cerrar.
- El agente sincroniza con el servidor cada ~20 segundos: manda cuánto
  tiempo se jugó y recibe la configuración actualizada. Si se corta
  internet, sigue bloqueando con la última configuración conocida (no se
  puede "desconectar el WiFi" para saltarse el control).
- Desde el panel web (celular o cualquier navegador) ves en vivo si está
  jugando, cuánto tiempo usó hoy, y podés cambiar la configuración, dar
  minutos de regalo, o cambiar la clave de adulto.

## 1. Desplegar el servidor (backend)

Necesitás un lugar en internet donde viva el servidor, para que el panel
funcione desde cualquier lado (no solo en tu casa). La forma más simple y
gratuita es [Render](https://render.com):

1. Creá una cuenta gratuita en render.com (podés entrar con tu cuenta de
   GitHub).
2. En el dashboard de Render: `New` → `Web Service`.
3. Conectá el repositorio de GitHub donde subiste este proyecto.
4. Render va a detectar el archivo `render.yaml` de la raíz del repo y
   proponer la configuración automáticamente (carpeta `game-time-guard/backend`,
   plan gratuito, disco persistente para no perder los datos). Confirmá.
5. Esperá a que termine el deploy (unos minutos). Te va a dar una URL
   tipo `https://game-time-guard-xxxx.onrender.com` — **esa es la URL
   que vas a usar** para entrar al panel y para configurar el agente.
6. Para ver la clave de adulto inicial: en Render, andá a tu servicio →
   pestaña `Environment` → variable `ADMIN_INITIAL_PASSWORD`. Podés
   cambiarla ahí, o cambiarla después desde el panel web (sección
   "Seguridad").

> Nota: el plan gratuito de Render "duerme" el servicio si no se usa
> por un rato y tarda unos segundos en despertar con el primer pedido.
> Es normal, no es un error.

### Alternativa: correrlo vos misma en un servidor/VPS propio

Si preferís no usar Render:

```bash
cd game-time-guard/backend
npm install
cp .env.example .env    # y editá ADMIN_INITIAL_PASSWORD
npm start
```

El servidor queda escuchando en el puerto 3000 (configurable con `PORT`)
y sirve tanto la API como el panel web en la misma URL.

## 2. Entrar al panel web y configurar

1. Abrí en el navegador (celular o PC) la URL que te dio Render.
2. Ingresá con la clave de adulto.
3. En "Modo y límites" elegí bolsa de horas / franja / ambas, y guardá.
4. En "Juegos bloqueados" agregá cada juego que querés controlar. Para
   saber el "nombre del programa": en la PC de tu nieto, abrí el juego,
   abrí el **Administrador de tareas** (Ctrl+Shift+Esc), pestaña
   **Detalles**, y buscá el proceso del juego — el nombre termina en
   `.exe` (ej. `RobloxPlayerBeta.exe`, `steam.exe`, `Minecraft.exe`).
5. En "Vincular la PC" apretá "Mostrar token de dispositivo" y copiá ese
   token — lo vas a necesitar en el paso siguiente.
6. (Opcional pero recomendado) En el celular, desde el navegador, usá la
   opción "Agregar a pantalla de inicio" / "Instalar app" para tener un
   ícono directo al panel.

## 3. Instalar el agente en la PC de tu nieto

1. En este repositorio de GitHub, andá a la pestaña **Actions** →
   workflow **"Build Windows Agent"** → la corrida más reciente → bajá
   hasta "Artifacts" y descargá `GameTimeGuardAgent-windows` (es un
   .zip). Esto se genera automáticamente, no hace falta instalar nada
   para compilarlo.
2. Copiá el .zip a la PC de tu nieto (con la cuenta de **administrador**
   que solo vos usás) y descomprimilo.
3. Click derecho sobre PowerShell → **"Ejecutar como administrador"**,
   navegá a la carpeta descomprimida y ejecutá:

   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   .\install.ps1
   ```

4. Te va a pedir la URL del servidor (la de Render) y el token de
   dispositivo (el que copiaste del panel en el paso 2.5). Pegalos y
   confirmá.
5. Listo — el servicio queda instalado, corriendo, y se va a volver a
   iniciar solo si la PC se reinicia.
6. Volvé al panel web: en unos segundos debería aparecer "conectado" con
   el nombre de la PC.

### Desinstalar / cambiar de PC

Con permisos de administrador, corré `uninstall.ps1` de la misma manera
(PowerShell como administrador).

## Qué NO hace (limitaciones honestas)

- Si tu nieto tiene o consigue una cuenta de **administrador**, puede
  desinstalar cualquier software, este incluido. El Paso 0 es la defensa
  real, no el software.
- Bloquea **programas** (juegos instalados). Si un juego se juega desde
  el navegador (Roblox web, Poki, etc.), hoy no lo detecta — se puede
  agregar más adelante bloqueo de sitios web si lo necesitás.
- No impide entrar en Modo Seguro de Windows (ahí los servicios no
  arrancan) — por eso se recomienda una contraseña de BIOS/UEFI como
  medida extra.
- Si renombra el archivo `.exe` del juego, deja de coincidir con el
  nombre configurado. Se puede agregar un filtro extra por carpeta
  (campo `pathContains`) para hacerlo más difícil de esquivar.

## Estructura del proyecto

```
render.yaml                          Config de despliegue en Render (raiz del repo)
.github/workflows/build-agent.yml    Compila el agente de Windows automaticamente
game-time-guard/
  backend/     API en Node.js + Express + SQLite
  web/         Panel web (HTML/CSS/JS, sin build, instalable como PWA)
  agent/       Agente de Windows (.NET, servicio del sistema)
```
