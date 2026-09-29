#Requires -RunAsAdministrator
<#
  Desinstala Game Time Guard Agent. Requiere permisos de Administrador,
  es decir, la clave de administrador de Windows (que el nieto no deberia tener).
#>

$ErrorActionPreference = 'Stop'

$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host "Este script tiene que correr como Administrador." -ForegroundColor Red
  exit 1
}

$ServiceName = "GameTimeGuardAgent"
$InstallDir = "$Env:ProgramFiles\GameTimeGuard"
$DataDir = "$Env:ProgramData\GameTimeGuard"

$confirm = Read-Host "Esto va a desinstalar el control de tiempo de juego de esta PC. Escribi SI para confirmar"
if ($confirm -ne "SI") {
  Write-Host "Cancelado."
  exit 0
}

$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
  Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
  & sc.exe delete $ServiceName | Out-Null
}

if (Test-Path $InstallDir) { Remove-Item -Recurse -Force $InstallDir }
if (Test-Path $DataDir) { Remove-Item -Recurse -Force $DataDir }

Write-Host "Limpiando el archivo hosts..." -ForegroundColor Cyan
$hostsPath = "$Env:SystemRoot\System32\drivers\etc\hosts"
if (Test-Path $hostsPath) {
  $lines = Get-Content $hostsPath
  $beginIdx = ($lines | Select-String -Pattern '^# BEGIN GameTimeGuard' -SimpleMatch:$false).LineNumber
  $endIdx = ($lines | Select-String -Pattern '^# END GameTimeGuard' -SimpleMatch:$false).LineNumber
  if ($beginIdx -and $endIdx) {
    $newLines = $lines[0..($beginIdx - 2)] + $lines[$endIdx..($lines.Count - 1)]
    Set-Content -Path $hostsPath -Value $newLines -Encoding ASCII
  }
}

Write-Host "Game Time Guard Agent desinstalado." -ForegroundColor Green
