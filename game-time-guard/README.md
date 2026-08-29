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

## 1. Desplegar el servidor (backend) en Google Cloud Run

El backend guarda todo en **Firestore** (base de datos de Google Cloud) y
corre en **Cloud Run**. Con el nivel de uso de esto (una sola PC, una sola
familia) queda **gratis** todo el tiempo dentro de la capa gratuita de
Google Cloud, tiene HTTPS automático, y los datos nunca se pierden aunque
se vuelva a desplegar el código.

Necesitás una cuenta de Google Cloud (podés crear una gratis en
[cloud.google.com](https://cloud.google.com); Google suele pedir una
tarjeta para verificar identidad, pero no te cobra nada mientras te
quedes dentro de la capa gratuita).

### 1.1. Crear el proyecto y habilitar Firestore

1. Entrá a [console.cloud.google.com](https://console.cloud.google.com).
2. Arriba a la izquierda, `Seleccionar proyecto` → `Proyecto nuevo`. Dale
   un nombre (ej. "game-time-guard") y creálo.
3. Con ese proyecto seleccionado, andá al buscador de arriba y escribí
   **"Firestore"** → entrá a `Firestore` → `Crear base de datos`.
4. Elegí **Modo Nativo** ("Native mode"), una ubicación (cualquiera
   cercana, ej. `us-central1`), y confirmá. Esto crea la base de datos
   donde se guarda toda la configuración.

### 1.2. Desplegar el servicio en Cloud Run

1. En el buscador de la consola, escribí **"Cloud Run"** → entrá →
   `Crear servicio` (Create service).
2. Elegí **"Implementar continuamente desde un repositorio"**
   ("Continuously deploy from a repository") → `Configurar con Cloud
   Build`.
3. Conectá tu cuenta de GitHub y seleccioná este repositorio
   (`docentelibre`). Autorizá el acceso si te lo pide.
4. Rama (branch): `claude/game-time-control-app-bo67yo` (o `main` si ya
   se fusionó ahí).
5. Tipo de build: **Dockerfile**. Ubicación del Dockerfile:
   `/game-time-guard/Dockerfile`. Directorio de contexto de build (build
   context): `/game-time-guard`.
6. Nombre del servicio: por ejemplo `game-time-guard`.
7. Región: la misma que elegiste para Firestore.
8. Autenticación: **"Permitir invocaciones no autenticadas"** (allow
   unauthenticated) — es necesario para que el panel y el agente puedan
   conectarse (la seguridad la da la clave de adulto y el token, no el
   login de Google).
9. En "Variables y secretos" → variables de entorno, agregá (opcional
   pero recomendado):
   - `ADMIN_INITIAL_PASSWORD` = elegí vos una clave de adulto fuerte.
     Si no la definís, el servidor genera una sola y la muestra una
     única vez en los "Registros" (Logs) del servicio.
10. Creá el servicio y esperá el primer build/deploy (unos minutos). Al
    terminar te da una URL tipo
    `https://game-time-guard-xxxxx-uc.a.run.app` — **esa es la URL que
    vas a usar** para el panel y para configurar el agente.

> Nota: por defecto Cloud Run "apaga" el servicio cuando nadie lo usa
> por un rato, y tarda uno o dos segundos en despertar con el primer
> pedido. Es normal, no es un error.

### 1.3. Dar permisos de Firestore al servicio

Por defecto, Cloud Run necesita permiso explícito para leer y escribir en
Firestore:

1. En Cloud Run, entrá al servicio → pestaña `Seguridad` (Security) →
   anotá qué "cuenta de servicio" (service account) usa (por defecto es
   la "Compute Engine default service account").
2. Andá a `IAM y administración` → `IAM` en el buscador de la consola.
3. Buscá esa cuenta de servicio en la lista → editá sus permisos (lápiz)
   → `Agregar otro rol` → buscá y elegí **"Usuario de Cloud Datastore"**
   ("Cloud Datastore User") → Guardar.
4. Puede tardar uno o dos minutos en aplicarse. Si el panel te da error
   "Error interno del servidor" al entrar, esperá un poco y volvé a
   probar.

### Alternativa: correrlo vos misma en tu computadora (para probar)

```bash
gcloud auth application-default login
gcloud config set project TU_PROYECTO
cd game-time-guard/backend
npm install
cp .env.example .env    # y editá ADMIN_INITIAL_PASSWORD
npm start
```

## 2. Entrar al panel web y configurar

1. Abrí en el navegador (celular o PC) la URL que te dio Cloud Run.
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

4. Te va a pedir la URL del servidor (la de Cloud Run) y el token de
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
.github/workflows/build-agent.yml    Compila el agente de Windows automaticamente
game-time-guard/
  Dockerfile   Imagen para desplegar el backend en Google Cloud Run
  backend/     API en Node.js + Express + Firestore
  web/         Panel web (HTML/CSS/JS, sin build, instalable como PWA)
  agent/       Agente de Windows (.NET, servicio del sistema)
```
