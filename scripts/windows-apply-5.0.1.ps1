param(
  [Parameter(Mandatory=$true)][string]$TargetRoot,
  [Parameter(Mandatory=$true)][string]$SourceRoot
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

function Normalize-Root([string]$Value) {
  $value2 = ([string]$Value).Trim().Trim([char[]]'"')
  $value2 = [IO.Path]::GetFullPath($value2)
  if ($value2.Length -gt 3) { $value2 = $value2.TrimEnd([char[]]'\/') }
  return $value2
}

$TargetRoot = Normalize-Root $TargetRoot
$SourceRoot = Normalize-Root $SourceRoot
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $TargetRoot ("backups\pre-5.0.1-" + $stamp)
$replaceDirs = @('electron','src','tests','scripts','docs')
$replaceFiles = @('package.json','package-lock.json')
$newDirs = @('MarshMallow-Official-Website-5.0.1','MarshMallow-GitHub-Public-5.0.1')
$newFiles = @(
  'ATUALIZAR_MARSHMALLOW_5.0.1.bat',
  'VALIDAR_E_COMPILAR_MARSHMALLOW_5.0.1.bat',
  'REGISTRAR_SMOKE_5.0.1.bat',
  'PUBLICAR_MARSHMALLOW_5.0.1.bat'
)
$backupItems = @($replaceDirs + $replaceFiles + @('dist'))
$applied = $false

function Copy-ItemSafe([string]$Relative, [string]$DestinationRoot) {
  $src = Join-Path $SourceRoot $Relative
  if (-not (Test-Path $src)) { throw "Arquivo/pasta ausente no pacote 5.0.1: $Relative" }
  $dst = Join-Path $DestinationRoot $Relative
  $parent = Split-Path -Parent $dst
  if ($parent -and -not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
  Copy-Item -LiteralPath $src -Destination $dst -Recurse -Force
}

function Restore-Backup {
  Write-Host '[ROLLBACK] Restaurando o codigo anterior...' -ForegroundColor Yellow
  foreach ($relative in $replaceDirs) {
    $dst = Join-Path $TargetRoot $relative
    if (Test-Path $dst) { Remove-Item -LiteralPath $dst -Recurse -Force -ErrorAction SilentlyContinue }
  }
  foreach ($relative in $replaceFiles) {
    $dst = Join-Path $TargetRoot $relative
    if (Test-Path $dst) { Remove-Item -LiteralPath $dst -Force -ErrorAction SilentlyContinue }
  }
  $dist = Join-Path $TargetRoot 'dist'
  if (Test-Path $dist) { Remove-Item -LiteralPath $dist -Recurse -Force -ErrorAction SilentlyContinue }
  foreach ($relative in $newDirs) {
    $dst = Join-Path $TargetRoot $relative
    if (Test-Path $dst) { Remove-Item -LiteralPath $dst -Recurse -Force -ErrorAction SilentlyContinue }
  }
  foreach ($relative in $newFiles) {
    $dst = Join-Path $TargetRoot $relative
    if (Test-Path $dst) { Remove-Item -LiteralPath $dst -Force -ErrorAction SilentlyContinue }
  }
  if (Test-Path $backup) {
    Get-ChildItem -LiteralPath $backup -Force | ForEach-Object {
      Copy-Item -LiteralPath $_.FullName -Destination $TargetRoot -Recurse -Force
    }
  }
  Write-Host "[ROLLBACK] Restaurado. Backup preservado em: $backup" -ForegroundColor Yellow
}

try {
  $targetPackagePath = Join-Path $TargetRoot 'package.json'
  $sourcePackagePath = Join-Path $SourceRoot 'package.json'
  if (-not (Test-Path $targetPackagePath)) { throw "Projeto MarshMallow nao encontrado em $TargetRoot" }
  if (-not (Test-Path $sourcePackagePath)) { throw 'package.json 5.0.1 ausente no pacote extraido.' }
  $targetPackage = Get-Content -Raw -LiteralPath $targetPackagePath | ConvertFrom-Json
  $sourcePackage = Get-Content -Raw -LiteralPath $sourcePackagePath | ConvertFrom-Json
  if ([string]$sourcePackage.version -ne '5.0.1') { throw "Pacote de origem nao e 5.0.1: $($sourcePackage.version)" }
  if ([string]$targetPackage.version -notin @('5.0.0','5.0.1')) { throw "Este atualizador aceita MarshMallow 5.0.0/5.0.1. Encontrado: $($targetPackage.version)" }

  $busy = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -match '^(node|electron)(\.exe)?$' -and [string]$_.CommandLine -like "*$TargetRoot*"
  }
  if ($busy) {
    Write-Host '[BLOQUEADO] Feche npm run dev / Electron do MarshMallow antes de atualizar.' -ForegroundColor Red
    $busy | Select-Object ProcessId,Name,CommandLine | Format-List
    throw 'Processos de desenvolvimento do MarshMallow ainda estao ativos.'
  }

  New-Item -ItemType Directory -Path $backup -Force | Out-Null
  foreach ($relative in $backupItems) {
    $src = Join-Path $TargetRoot $relative
    if (Test-Path $src) {
      $dst = Join-Path $backup $relative
      $parent = Split-Path -Parent $dst
      if ($parent -and -not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
      Copy-Item -LiteralPath $src -Destination $dst -Recurse -Force
    }
  }
  Write-Host "[OK] Backup criado: $backup" -ForegroundColor Green

  foreach ($relative in $replaceDirs) {
    $dst = Join-Path $TargetRoot $relative
    if (Test-Path $dst) { Remove-Item -LiteralPath $dst -Recurse -Force }
    Copy-ItemSafe $relative $TargetRoot
  }
  foreach ($relative in $replaceFiles) {
    $dst = Join-Path $TargetRoot $relative
    if (Test-Path $dst) { Remove-Item -LiteralPath $dst -Force }
    if (Test-Path (Join-Path $SourceRoot $relative)) { Copy-ItemSafe $relative $TargetRoot }
  }
  foreach ($relative in $newDirs) {
    $dst = Join-Path $TargetRoot $relative
    if (Test-Path $dst) { Remove-Item -LiteralPath $dst -Recurse -Force }
    Copy-ItemSafe $relative $TargetRoot
  }
  foreach ($relative in $newFiles) {
    $dst = Join-Path $TargetRoot $relative
    if (Test-Path $dst) { Remove-Item -LiteralPath $dst -Force }
    Copy-ItemSafe $relative $TargetRoot
  }
  $applied = $true

  Set-Location $TargetRoot
  if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'npm.cmd nao encontrado no PATH.' }

  Write-Host ''
  Write-Host '=== npm install ===' -ForegroundColor Cyan
  & npm.cmd install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw "npm install falhou com exit code $LASTEXITCODE" }

  Write-Host ''
  Write-Host '=== testes ===' -ForegroundColor Cyan
  & npm.cmd run test:unit
  if ($LASTEXITCODE -ne 0) { throw "npm run test:unit falhou com exit code $LASTEXITCODE" }

  Write-Host ''
  Write-Host '=== TypeScript ===' -ForegroundColor Cyan
  & npm.cmd run typecheck
  if ($LASTEXITCODE -ne 0) { throw "npm run typecheck falhou com exit code $LASTEXITCODE" }

  Write-Host ''
  Write-Host '=== build web ===' -ForegroundColor Cyan
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw "npm run build falhou com exit code $LASTEXITCODE" }

  Write-Host ''
  Write-Host '==============================================================' -ForegroundColor Green
  Write-Host ' MARSHMALLOW 5.0.1 PREPARADO E VALIDADO' -ForegroundColor Green
  Write-Host '==============================================================' -ForegroundColor Green
  Write-Host 'Proximo passo: VALIDAR_E_COMPILAR_MARSHMALLOW_5.0.1.bat'
  exit 0
} catch {
  Write-Host ''
  Write-Host ('[FALHA] ' + $_.Exception.Message) -ForegroundColor Red
  if ($applied) { Restore-Backup }
  exit 1
}
