#Requires -RunAsAdministrator
<#
  Instala Game Time Guard Agent como servicio de Windows.
  Tiene que ejecutarse como Administrador (click derecho > "Ejecutar como administrador"
  sobre PowerShell, o sobre este archivo si tenes la asociacion configurada).

  Uso:
    .\install.ps1 -ApiBaseUrl "https://tu-servidor.onrender.com" -DeviceToken "el-token-del-panel"

  Si no pasas los parametros, el script los va a pedir interactivamente.
#>

param(
  [string]$ApiBaseUrl,
  [string]$DeviceToken
)

$ErrorActionPreference = 'Stop'

function Fail($msg) {
  Write-Host $msg -ForegroundColor Red
  exit 1
}

$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Fail "Este instalador tiene que correr como Administrador. Cerra esta ventana y volve a abrirla con 'Ejecutar como administrador'."
}

if (-not $ApiBaseUrl) {
  $ApiBaseUrl = Read-Host "Pega la URL del servidor (la que te dieron al desplegar el backend, ej. https://xxxx.onrender.com)"
}
if (-not $DeviceToken) {
  $DeviceToken = Read-Host "Pega el token de dispositivo (lo ves en el panel web, seccion 'Vincular la PC')"
}
if (-not $ApiBaseUrl -or -not $DeviceToken) {
  Fail "Faltan datos. Volve a correr el instalador con la URL y el token."
}

$ServiceName = "GameTimeGuardAgent"
$InstallDir = "$Env:ProgramFiles\GameTimeGuard"
$DataDir = "$Env:ProgramData\GameTimeGuard"
$ExeSourceName = "GameTimeGuardAgent.exe"
$ExeSourcePath = Join-Path $PSScriptRoot $ExeSourceName

if (-not (Test-Path $ExeSourcePath)) {
  Fail "No se encontro $ExeSourceName junto a este script. Descarga el paquete completo (release) y volve a intentar."
}

Write-Host "Deteniendo instalacion previa (si existe)..." -ForegroundColor Cyan
$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
  Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
  & sc.exe delete $ServiceName | Out-Null
  Start-Sleep -Seconds 2
}

Write-Host "Copiando el programa a $InstallDir ..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Copy-Item -Path $ExeSourcePath -Destination (Join-Path $InstallDir $ExeSourceName) -Force

Write-Host "Guardando configuracion en $DataDir ..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

$configObj = [PSCustomObject]@{
  ApiBaseUrl  = $ApiBaseUrl
  DeviceToken = $DeviceToken
}
$configObj | ConvertTo-Json | Set-Content -Path (Join-Path $DataDir "agent-config.json") -Encoding UTF8

Write-Host "Restringiendo permisos de la carpeta de configuracion (solo Administradores)..." -ForegroundColor Cyan
# Quita la herencia y deja acceso total solo a SYSTEM y Administradores.
& icacls $DataDir /inheritance:r | Out-Null
& icacls $DataDir /grant:r "SYSTEM:(OI)(CI)F" | Out-Null
& icacls $DataDir /grant:r "*S-1-5-32-544:(OI)(CI)F" | Out-Null   # Administradores (SID bien conocido, funciona en cualquier idioma de Windows)

Write-Host "Restringiendo permisos de la carpeta del programa..." -ForegroundColor Cyan
& icacls $InstallDir /inheritance:r | Out-Null
& icacls $InstallDir /grant:r "SYSTEM:(OI)(CI)F" | Out-Null
& icacls $InstallDir /grant:r "*S-1-5-32-544:(OI)(CI)F" | Out-Null
& icacls $InstallDir /grant:r "*S-1-5-11:(OI)(CI)RX" | Out-Null   # Usuarios autenticados: solo leer/ejecutar

Write-Host "Creando el servicio de Windows..." -ForegroundColor Cyan
$exePath = Join-Path $InstallDir $ExeSourceName
& sc.exe create $ServiceName binPath= "`"$exePath`"" start= auto DisplayName= "Game Time Guard Agent" | Out-Null
& sc.exe description $ServiceName "Controla el tiempo de juego en esta PC. No cerrar ni desinstalar sin la clave de adulto." | Out-Null

# Si el servicio se cae (crash, kill, etc.) Windows lo vuelve a levantar solo.
& sc.exe failure $ServiceName reset= 86400 actions= restart/5000/restart/5000/restart/5000 | Out-Null
& sc.exe failureflag $ServiceName 1 | Out-Null

Write-Host "Iniciando el servicio..." -ForegroundColor Cyan
Start-Service -Name $ServiceName
Start-Sleep -Seconds 2
$svc = Get-Service -Name $ServiceName
Write-Host ""
Write-Host "Listo. Estado del servicio: $($svc.Status)" -ForegroundColor Green
Write-Host "Los cambios de configuracion (juegos, horarios, tiempo) los haces desde el panel web, no en esta PC."
Write-Host ""
Write-Host "IMPORTANTE: para que esto sea realmente efectivo, la cuenta de Windows de tu nieto" -ForegroundColor Yellow
Write-Host "tiene que ser una cuenta ESTANDAR (sin permisos de administrador). Si todavia no lo es," -ForegroundColor Yellow
Write-Host "revisa el README (seccion 'Paso 0') antes de darle la PC de vuelta." -ForegroundColor Yellow
