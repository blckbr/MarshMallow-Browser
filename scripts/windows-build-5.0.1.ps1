param(
  [string]$Root = (Split-Path -Parent $PSScriptRoot)
)
$Root = ([string]$Root).Trim().Trim([char[]]'"')
$Root = [IO.Path]::GetFullPath($Root)
if ($Root.Length -gt 3) { $Root = $Root.TrimEnd([char[]]'\/') }
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
$Version = '5.0.1'
$Log = Join-Path $Root 'BUILD_VALIDATION_5.0.1.log'
$Report = Join-Path $Root 'BUILD_VALIDATION_5.0.1.json'
$ReleaseDir = Join-Path $Root 'release'
$Installer = Join-Path $ReleaseDir "MarshMallow-Setup-$Version.exe"
$HashFile = "$Installer.sha256.txt"

function Log([string]$Message) {
  $line = ('[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message)
  Write-Host $line
  Add-Content -LiteralPath $Log -Value $line -Encoding UTF8
}
function Run([string]$Label, [scriptblock]$Command) {
  Log "INICIO: $Label"
  & $Command
  if ($LASTEXITCODE -ne 0) { throw "$Label falhou com exit code $LASTEXITCODE" }
  Log "OK: $Label"
}

Set-Content -LiteralPath $Log -Value "MarshMallow $Version - validacao e compilacao Windows" -Encoding UTF8
Set-Location $Root
try {
  if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) { throw 'Node.js nao foi encontrado no PATH.' }
  if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'npm.cmd nao foi encontrado no PATH.' }
  Log ("Node: " + (& node.exe --version))
  Log ("npm: " + (& npm.cmd --version))

  if (-not (Test-Path (Join-Path $Root 'package.json'))) { throw 'package.json nao encontrado.' }
  Run 'npm install' { & npm.cmd install --no-audit --no-fund }
  Run 'verificacao de fonte e testes unitarios' { & npm.cmd run verify:source }
  Run 'TypeScript typecheck real' { & npm.cmd run typecheck }
  Run 'Vite production build' { & npm.cmd run build:web }
  Run 'electron-builder NSIS' { & npm.cmd run dist }

  if (-not (Test-Path $Installer)) { throw "Instalador nao foi criado: $Installer" }
  $item = Get-Item $Installer
  if ($item.Length -lt 30000000) { throw "Instalador parece incompleto: $($item.Length) bytes" }
  $first = Get-Content -LiteralPath $Installer -Encoding Byte -TotalCount 2
  if ($first.Count -ne 2 -or $first[0] -ne 0x4d -or $first[1] -ne 0x5a) { throw 'Instalador nao possui cabecalho MZ de executavel Windows.' }
  $hash = (Get-FileHash -LiteralPath $Installer -Algorithm SHA256).Hash.ToLowerInvariant()
  Set-Content -LiteralPath $HashFile -Value ("{0}  {1}" -f $hash, [IO.Path]::GetFileName($Installer)) -Encoding ASCII

  $reportObject = [ordered]@{
    version = $Version
    buildPassed = $true
    sourceVerificationPassed = $true
    typecheckPassed = $true
    webBuildPassed = $true
    nsisBuildPassed = $true
    installer = [IO.Path]::GetFileName($Installer)
    size = [int64]$item.Length
    sha256 = $hash
    builtAt = (Get-Date).ToUniversalTime().ToString('o')
  }
  $reportObject | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $Report -Encoding UTF8
  Log "INSTALADOR: $Installer"
  Log "BYTES: $($item.Length)"
  Log "SHA256: $hash"
  Log 'RESULTADO: PASS - build automatizado concluido. Execute REGISTRAR_SMOKE_5.0.1.bat antes de publicar.'
  exit 0
} catch {
  Log ("RESULTADO: FAIL - " + $_.Exception.Message)
  if (Test-Path $Report) { Remove-Item -LiteralPath $Report -Force -ErrorAction SilentlyContinue }
  Write-Host ''
  Write-Host 'A publicacao permanece bloqueada.' -ForegroundColor Yellow
  exit 1
}
