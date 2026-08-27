param(
  [Parameter(Mandatory=$true)][string]$TargetRoot,
  [Parameter(Mandatory=$true)][string]$SourceRoot
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version 2.0
function Normalize-Root([string]$Value){$v=([string]$Value).Trim().Trim([char[]]'"');$v=[IO.Path]::GetFullPath($v);if($v.Length-gt 3){$v=$v.TrimEnd([char[]]'\/')};return $v}
$TargetRoot=Normalize-Root $TargetRoot
$SourceRoot=Normalize-Root $SourceRoot
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$backup=Join-Path $TargetRoot ("backups\pre-5.0.2-"+$stamp)
$files=@(
  'package.json','package-lock.json',
  'electron\main.mjs','electron\preload.cjs',
  'src\App.tsx','src\styles.css','src\types.ts',
  'backend\src\index.js','backend\src\download-counter.js','backend\wrangler.jsonc',
  'tests\chrome-navigation-ui.test.mjs','tests\download-counter-5.0.2.test.mjs','tests\regression-invariants.test.mjs','tests\release-5.0.1-site-counter.test.mjs','tests\launcher-root-5.0.2.test.mjs',
  'scripts\verify-5.0.2.mjs','scripts\windows-build-5.0.2.ps1','scripts\windows-smoke-5.0.2.ps1','scripts\windows-publish-5.0.2.ps1','scripts\windows-apply-5.0.2.ps1',
  'VALIDAR_E_COMPILAR_MARSHMALLOW_5.0.2.bat','REGISTRAR_SMOKE_5.0.2.bat','PUBLICAR_MARSHMALLOW_5.0.2.bat'
)
$dirs=@('MarshMallow-Official-Website-5.0.2','MarshMallow-GitHub-Public-5.0.2')
$applied=$false
function Copy-One([string]$Relative){
  $src=Join-Path $SourceRoot $Relative
  if(-not(Test-Path $src)){throw "Pacote 5.0.2 incompleto: $Relative"}
  $dst=Join-Path $TargetRoot $Relative
  $parent=Split-Path -Parent $dst
  if($parent -and -not(Test-Path $parent)){New-Item -ItemType Directory -Path $parent -Force|Out-Null}
  Copy-Item -LiteralPath $src -Destination $dst -Force
}
function Restore-Backup{
  Write-Host '[ROLLBACK] Restaurando arquivos anteriores...' -ForegroundColor Yellow
  foreach($relative in $files){$dst=Join-Path $TargetRoot $relative;if(Test-Path $dst){Remove-Item -LiteralPath $dst -Force -ErrorAction SilentlyContinue}}
  foreach($relative in $dirs){$dst=Join-Path $TargetRoot $relative;if(Test-Path $dst){Remove-Item -LiteralPath $dst -Recurse -Force -ErrorAction SilentlyContinue}}
  if(Test-Path $backup){Get-ChildItem -LiteralPath $backup -Force|ForEach-Object{Copy-Item -LiteralPath $_.FullName -Destination $TargetRoot -Recurse -Force}}
  Write-Host "[ROLLBACK] Restaurado. Backup: $backup" -ForegroundColor Yellow
}
try{
  $targetPkgPath=Join-Path $TargetRoot 'package.json';if(-not(Test-Path $targetPkgPath)){throw "Projeto MarshMallow nao encontrado em $TargetRoot"}
  $targetPkg=Get-Content -Raw -LiteralPath $targetPkgPath|ConvertFrom-Json
  if([string]$targetPkg.version -notin @('5.0.1','5.0.2')){throw "Este pacote aceita fonte 5.0.1/5.0.2. Encontrado: $($targetPkg.version)"}
  $busy=Get-CimInstance Win32_Process -ErrorAction SilentlyContinue|Where-Object{$_.Name -match '^(node|electron)(\.exe)?$' -and [string]$_.CommandLine -like "*$TargetRoot*"}
  if($busy){$busy|Select-Object ProcessId,Name,CommandLine|Format-List;throw 'Feche npm/electron do MarshMallow antes de aplicar a atualizacao.'}
  New-Item -ItemType Directory -Path $backup -Force|Out-Null
  foreach($relative in $files+$dirs){
    $src=Join-Path $TargetRoot $relative
    if(Test-Path $src){$dst=Join-Path $backup $relative;$parent=Split-Path -Parent $dst;if($parent -and -not(Test-Path $parent)){New-Item -ItemType Directory -Path $parent -Force|Out-Null};Copy-Item -LiteralPath $src -Destination $dst -Recurse -Force}
  }
  Write-Host "[OK] Backup criado: $backup" -ForegroundColor Green
  foreach($relative in $files){Copy-One $relative}
  foreach($relative in $dirs){$src=Join-Path $SourceRoot $relative;$dst=Join-Path $TargetRoot $relative;if(Test-Path $dst){Remove-Item -LiteralPath $dst -Recurse -Force};Copy-Item -LiteralPath $src -Destination $dst -Recurse -Force}
  $applied=$true
  Set-Location $TargetRoot
  if(-not(Get-Command npm.cmd -ErrorAction SilentlyContinue)){throw 'npm.cmd nao encontrado no PATH.'}
  Write-Host '';Write-Host '=== npm install ===' -ForegroundColor Cyan;& npm.cmd install --no-audit --no-fund;if($LASTEXITCODE-ne 0){throw "npm install falhou: $LASTEXITCODE"}
  Write-Host '';Write-Host '=== testes unitarios ===' -ForegroundColor Cyan;& npm.cmd run test:unit;if($LASTEXITCODE-ne 0){throw "test:unit falhou: $LASTEXITCODE"}
  Write-Host '';Write-Host '=== TypeScript ===' -ForegroundColor Cyan;& npm.cmd run typecheck;if($LASTEXITCODE-ne 0){throw "typecheck falhou: $LASTEXITCODE"}
  Write-Host '';Write-Host '=== build web ===' -ForegroundColor Cyan;& npm.cmd run build;if($LASTEXITCODE-ne 0){throw "build web falhou: $LASTEXITCODE"}
  Write-Host '';Write-Host 'MARSHMALLOW 5.0.2 APLICADO E VALIDADO' -ForegroundColor Green
  Write-Host 'Agora execute VALIDAR_E_COMPILAR_MARSHMALLOW_5.0.2.bat para gerar o instalador.' -ForegroundColor Green
  exit 0
}catch{
  Write-Host '';Write-Host ('[FALHA] '+$_.Exception.Message) -ForegroundColor Red
  if($applied){Restore-Backup}
  exit 1
}
