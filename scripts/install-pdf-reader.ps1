param(
  [Parameter(Mandatory=$true)][string]$SourceRoot,
  [Parameter(Mandatory=$true)][string]$TargetRoot
)

$ErrorActionPreference = 'Stop'
$SourceRoot = [System.IO.Path]::GetFullPath($SourceRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar))
$TargetRoot = [System.IO.Path]::GetFullPath($TargetRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar))

function Write-Step([string]$Text) { Write-Host "`n=== $Text ===" -ForegroundColor Cyan }
function Invoke-Checked([string]$Name, [string]$Command, [string[]]$Arguments) {
  Write-Host "[RUN] $Name" -ForegroundColor Cyan
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Name falhou com exit code $LASTEXITCODE" }
  Write-Host "[OK] $Name" -ForegroundColor Green
}

if (-not (Test-Path (Join-Path $TargetRoot 'package.json'))) { throw "Projeto MarshMallow nao encontrado em $TargetRoot" }
$package = Get-Content (Join-Path $TargetRoot 'package.json') -Raw | ConvertFrom-Json
if ($package.name -ne 'marshmallow-browser') { throw 'O diretorio alvo nao parece ser o MarshMallow Browser.' }
if ($package.version -ne '5.0.0') { throw "Este patch foi validado para MarshMallow 5.0.0. Versao encontrada: $($package.version)" }

Write-Step 'Verificar processos que podem bloquear os arquivos'
$blocking = Get-CimInstance Win32_Process | Where-Object {
  ($_.Name -match 'node|electron|MarshMallow') -and (
    ($_.ExecutablePath -and $_.ExecutablePath.StartsWith($TargetRoot, [System.StringComparison]::OrdinalIgnoreCase)) -or
    ($_.CommandLine -and $_.CommandLine.IndexOf($TargetRoot, [System.StringComparison]::OrdinalIgnoreCase) -ge 0)
  )
}
if ($blocking) {
  $blocking | Select-Object ProcessId,Name,ExecutablePath,CommandLine | Format-Table -AutoSize
  throw 'Feche o MarshMallow/npm run dev desse projeto antes de aplicar o PDF Reader.'
}
Write-Host '[OK] Nenhum processo do projeto esta aberto.' -ForegroundColor Green

$files = @(
  'package.json',
  'electron/main.mjs',
  'electron/preload.cjs',
  'electron/lib/pdf-routing.mjs',
  'src/types.ts',
  'src/App.tsx',
  'src/styles.css',
  'src/pdf/pdf-engine.ts',
  'src/pdf/PdfReaderPage.tsx',
  'tests/pdf-reader.test.mjs',
  'tests/pdf-reader-installer.test.mjs',
  'scripts/install-pdf-reader.ps1',
  'THIRD_PARTY_PDF_LICENSES.md',
  'LEIA-ME-PDF-READER.txt'
)

$removeFiles = @(
  'src/pdf/PdfEditorPage.tsx',
  'tests/pdf-reader-editor.test.mjs',
  'tests/pdf-installer-script.test.mjs',
  'scripts/install-pdf-reader-editor.ps1',
  'LEIA-ME-PDF-READER-EDITOR.txt',
  'docs/superpowers/specs/2026-08-25-pdf-reader-editor-design.md',
  'docs/superpowers/plans/2026-08-25-pdf-reader-editor.md'
)

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupRoot = Join-Path $TargetRoot ".backup-pdf-reader-$stamp"
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
$newFiles = New-Object System.Collections.Generic.List[string]

$lockPath = Join-Path $TargetRoot 'package-lock.json'
if (Test-Path $lockPath) {
  $lockBackup = Join-Path $backupRoot 'package-lock.json'
  Copy-Item $lockPath $lockBackup -Force
}

function Backup-Target([string]$Relative) {
  $target = Join-Path $TargetRoot $Relative
  if (Test-Path $target) {
    $backup = Join-Path $backupRoot $Relative
    New-Item -ItemType Directory -Force -Path (Split-Path $backup -Parent) | Out-Null
    Copy-Item $target $backup -Force
    return $true
  }
  return $false
}

try {
  Write-Step 'Criar backup e aplicar o PDF Reader'
  foreach ($relative in $files) {
    $source = Join-Path $SourceRoot $relative
    if (-not (Test-Path $source)) { throw "Arquivo do pacote ausente: $relative" }
    $target = Join-Path $TargetRoot $relative
    if (-not (Backup-Target $relative)) { $newFiles.Add($relative) }
    New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent) | Out-Null
    Copy-Item $source $target -Force
    Write-Host "[OK] $relative" -ForegroundColor Green
  }

  foreach ($relative in $removeFiles) {
    $target = Join-Path $TargetRoot $relative
    if (Test-Path $target) {
      [void](Backup-Target $relative)
      Remove-Item $target -Force
      Write-Host "[REMOVIDO] $relative" -ForegroundColor DarkGray
    }
  }

  Push-Location $TargetRoot
  try {
    Write-Step 'Manter somente a dependencia gratuita do leitor'
    Invoke-Checked 'npm install pdfjs-dist' 'npm.cmd' @('install','pdfjs-dist@4.10.38','--save-exact','--no-audit','--no-fund')
    Invoke-Checked 'npm uninstall pdf-lib' 'npm.cmd' @('uninstall','pdf-lib','--no-audit','--no-fund')

    Write-Step 'Validar sintaxe Electron'
    Invoke-Checked 'node --check electron/main.mjs' 'node.exe' @('--check','electron/main.mjs')
    Invoke-Checked 'node --check electron/preload.cjs' 'node.exe' @('--check','electron/preload.cjs')

    Write-Step 'Executar testes automatizados'
    Invoke-Checked 'npm run test:unit' 'npm.cmd' @('run','test:unit')

    Write-Step 'Executar TypeScript'
    Invoke-Checked 'npm run typecheck' 'npm.cmd' @('run','typecheck')

    Write-Step 'Compilar interface web'
    Invoke-Checked 'npm run build' 'npm.cmd' @('run','build')
  }
  finally { Pop-Location }

  Write-Host "`n==============================================================" -ForegroundColor Green
  Write-Host ' PDF READER INSTALADO E VALIDADO' -ForegroundColor Green
  Write-Host " Backup: $backupRoot" -ForegroundColor DarkGray
  Write-Host ' O editor e o pdf-lib foram removidos.' -ForegroundColor Green
  Write-Host ' Agora execute npm run dev para o smoke test.' -ForegroundColor Green
  Write-Host '==============================================================' -ForegroundColor Green
  exit 0
}
catch {
  Write-Host "`n[FALHA] $($_.Exception.Message)" -ForegroundColor Red
  Write-Host '[ROLLBACK] Restaurando os arquivos anteriores...' -ForegroundColor Yellow

  foreach ($relative in ($files + $removeFiles | Select-Object -Unique)) {
    $target = Join-Path $TargetRoot $relative
    $backup = Join-Path $backupRoot $relative
    if (Test-Path $backup) {
      New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent) | Out-Null
      Copy-Item $backup $target -Force
    } elseif ($newFiles.Contains($relative) -and (Test-Path $target)) {
      Remove-Item $target -Force
    }
  }
  if (Test-Path (Join-Path $backupRoot 'package-lock.json')) {
    Copy-Item (Join-Path $backupRoot 'package-lock.json') $lockPath -Force
  }

  Write-Host '[ROLLBACK] Codigo-fonte restaurado. Tentando restaurar dependencias...' -ForegroundColor Yellow
  Push-Location $TargetRoot
  try {
    & npm.cmd install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { Write-Host '[AVISO] npm install do rollback falhou; execute npm install manualmente.' -ForegroundColor Yellow }
  } catch {
    Write-Host '[AVISO] Nao foi possivel restaurar node_modules automaticamente.' -ForegroundColor Yellow
  } finally { Pop-Location }

  Write-Host '[ROLLBACK] Backup preservado.' -ForegroundColor Yellow
  exit 1
}
