param([string]$Root = (Split-Path -Parent $PSScriptRoot))

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

$Root = ([string]$Root).Trim().Trim([char[]]'"')
$Root = [IO.Path]::GetFullPath($Root)
if ($Root.Length -gt 3) { $Root = $Root.TrimEnd([char[]]'\/') }

$Version = '5.0.2'
$Repo = 'blckbr/MarshMallow-Browser'
$BranchPrefix = 'linux-rpm-5.0.2-ci-'
$WorkflowName = 'Build MarshMallow Linux RPM and AppImage'
$ArtifactName = 'MarshMallow-Browser-5.0.2-Linux-x86_64'
$RpmName = 'MarshMallow-Browser-5.0.2-x86_64.rpm'
$AppImageName = 'MarshMallow-Browser-5.0.2-x86_64.AppImage'
$SourceZipName = 'MarshMallow-Browser-5.0.2-Linux-Source.zip'
$HashName = 'SHA256SUMS.txt'
$ReportName = 'RELATORIO-VALIDACAO-LINUX.txt'
$Desktop = [Environment]::GetFolderPath('Desktop')
if ([string]::IsNullOrWhiteSpace($Desktop)) { throw 'Nao foi possivel localizar o Desktop do usuario.' }
$DownloadDir = Join-Path $Desktop 'MarshMallow-Linux-5.0.2'
$TempRoot = $null

function Log([string]$Message) {
  Write-Host ('[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message)
}

function Require([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name nao foi encontrado no PATH."
  }
}

function Exec([string]$Label, [scriptblock]$Command) {
  Log "INICIO: $Label"
  & $Command
  if ($LASTEXITCODE -ne 0) { throw "$Label falhou com exit code $LASTEXITCODE" }
  Log "OK: $Label"
}

function Copy-CanonicalSource([string]$SourceRoot, [string]$DestinationRoot) {
  $excluded = @('.git', 'node_modules', 'release', 'release-linux', '.worktrees')

  Get-ChildItem -LiteralPath $DestinationRoot -Force |
    Where-Object { $_.Name -ne '.git' } |
    Remove-Item -Recurse -Force

  Get-ChildItem -LiteralPath $SourceRoot -Force |
    Where-Object { $excluded -notcontains $_.Name } |
    ForEach-Object {
      Copy-Item -LiteralPath $_.FullName -Destination $DestinationRoot -Recurse -Force
    }
}

function Get-WorkflowRun([string]$Branch, [int]$WaitSeconds = 180) {
  $deadline = (Get-Date).AddSeconds($WaitSeconds)
  do {
    $json = & gh.exe run list --repo $Repo --branch $Branch --event push --limit 10 --json databaseId,status,conclusion,headBranch,url,name 2>$null
    if ($LASTEXITCODE -eq 0 -and $json) {
      $runs = @($json | ConvertFrom-Json)
      foreach ($candidate in $runs) {
        if ([string]$candidate.headBranch -eq $Branch -and [string]$candidate.name -eq $WorkflowName) { return $candidate }
      }
    }
    Start-Sleep -Seconds 3
  } while ((Get-Date) -lt $deadline)
  throw "O GitHub Actions nao apareceu para a branch $Branch dentro de $WaitSeconds segundos."
}

function Confirm-Hash([string]$Directory, [string]$FileName, [string[]]$HashLines) {
  $escaped = [regex]::Escape($FileName)
  $line = @($HashLines | Where-Object { $_ -match "^([0-9a-fA-F]{64})\s+\*?$escaped$" })
  if ($line.Count -ne 1) { throw "SHA-256 esperado nao encontrado para $FileName." }
  $expected = ([regex]::Match($line[0], '^([0-9a-fA-F]{64})')).Groups[1].Value.ToLowerInvariant()
  $actual = (Get-FileHash -LiteralPath (Join-Path $Directory $FileName) -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $expected) { throw "SHA-256 divergente para $FileName." }
  Log "SHA-256 confirmado: $FileName = $actual"
}

try {
  foreach ($required in @(
    'package.json',
    'package-lock.json',
    '.github\workflows\build-linux.yml',
    'scripts\linux\verify-linux.sh',
    'scripts\linux\build-rpm.sh',
    'scripts\linux\build-appimage.sh',
    'scripts\linux\smoke-linux.sh'
  )) {
    $full = Join-Path $Root $required
    if (-not (Test-Path -LiteralPath $full)) { throw "Fonte Linux incompleta. Ausente: $full" }
  }

  Require 'git.exe'
  Require 'gh.exe'
  Require 'node.exe'

  Exec 'GitHub autenticacao' { & gh.exe auth status }
  Exec 'GitHub configurar credenciais Git' { & gh.exe auth setup-git }
  Exec 'Consultar repositorio oficial' { & gh.exe repo view $Repo }

  Log 'Validando testes de contrato local antes do envio.'
  Push-Location $Root
  try {
    & node.exe --test tests/*.test.mjs
    if ($LASTEXITCODE -ne 0) { throw "Testes locais falharam com exit code $LASTEXITCODE." }
  } finally { Pop-Location }

  $defaultBranch = (& gh.exe repo view $Repo --json defaultBranchRef --jq '.defaultBranchRef.name').Trim()
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($defaultBranch)) { throw 'Nao foi possivel descobrir a branch principal do repositorio.' }
  Log "Branch principal detectada: $defaultBranch"

  $branch = $BranchPrefix + (Get-Date -Format 'yyyyMMdd-HHmmss')
  $TempRoot = Join-Path $env:TEMP ('MarshMallow-Linux-CI-' + [Guid]::NewGuid().ToString('N'))
  $repoDir = Join-Path $TempRoot 'repo'
  New-Item -ItemType Directory -Path $TempRoot -Force | Out-Null

  Exec 'Clonar repositorio oficial' { & gh.exe repo clone $Repo $repoDir }

  Push-Location $repoDir
  try {
    Exec 'Atualizar referencias Git' { & git.exe fetch origin $defaultBranch }
    Exec 'Criar branch Linux isolada' { & git.exe checkout -b $branch "origin/$defaultBranch" }

    Log 'Copiando fonte Linux canonica para a branch isolada.'
    Copy-CanonicalSource -SourceRoot $Root -DestinationRoot $repoDir

    & git.exe config user.name 'Deivison Santos'
    & git.exe config user.email 'devsaex@users.noreply.github.com'
    Exec 'Git add' { & git.exe add -A }

    & git.exe diff --cached --quiet
    if ($LASTEXITCODE -eq 0) { throw 'Nenhuma diferenca foi encontrada para enviar ao GitHub.' }

    Exec 'Commit Linux CI' { & git.exe commit -m "MarshMallow $Version Linux RPM/AppImage CI" }

    Log "Enviando somente a branch isolada: $branch"
    & git.exe push -u origin $branch
    if ($LASTEXITCODE -ne 0) {
      Write-Host ''
      Write-Host '[INFO] O GitHub pode exigir o escopo workflow para enviar .github/workflows.' -ForegroundColor Yellow
      Write-Host '[INFO] Tentando autorizar esse escopo pelo GitHub CLI...' -ForegroundColor Yellow
      & gh.exe auth refresh -h github.com -s workflow
      if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel autorizar o escopo workflow no GitHub CLI.' }
      Exec 'Repetir push da branch Linux' { & git.exe push -u origin $branch }
    }
  } finally { Pop-Location }

  Log 'Aguardando o GitHub Actions reconhecer a branch.'
  $run = Get-WorkflowRun -Branch $branch
  $runId = [string]$run.databaseId
  Log "Workflow detectado: $($run.url)"

  & gh.exe run watch $runId --repo $Repo --exit-status
  if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host '[FALHA] GitHub Actions terminou com erro. Logs das etapas que falharam:' -ForegroundColor Red
    & gh.exe run view $runId --repo $Repo --log-failed
    throw "Build Linux no GitHub Actions falhou. Run ID: $runId"
  }

  if (Test-Path -LiteralPath $DownloadDir) { Remove-Item -LiteralPath $DownloadDir -Recurse -Force }
  New-Item -ItemType Directory -Path $DownloadDir -Force | Out-Null

  Exec 'Baixar artefatos Linux' {
    & gh.exe run download $runId --repo $Repo --name $ArtifactName --dir $DownloadDir
  }

  foreach ($name in @($RpmName, $AppImageName, $SourceZipName, $HashName, $ReportName)) {
    $path = Join-Path $DownloadDir $name
    if (-not (Test-Path -LiteralPath $path)) { throw "Artefato esperado ausente: $path" }
    if ((Get-Item -LiteralPath $path).Length -le 0) { throw "Artefato vazio: $path" }
  }

  $hashLines = Get-Content -LiteralPath (Join-Path $DownloadDir $HashName)
  Confirm-Hash -Directory $DownloadDir -FileName $RpmName -HashLines $hashLines
  Confirm-Hash -Directory $DownloadDir -FileName $AppImageName -HashLines $hashLines
  Confirm-Hash -Directory $DownloadDir -FileName $SourceZipName -HashLines $hashLines

  Write-Host ''
  Write-Host '==============================================================' -ForegroundColor Green
  Write-Host ' MARSHMALLOW LINUX 5.0.2 - BUILD CONCLUIDA' -ForegroundColor Green
  Write-Host '==============================================================' -ForegroundColor Green
  Write-Host "Branch CI: $branch"
  Write-Host "GitHub Actions: $($run.url)"
  Write-Host "Arquivos: $DownloadDir"
  Write-Host "RPM: $(Join-Path $DownloadDir $RpmName)"
  Write-Host "AppImage: $(Join-Path $DownloadDir $AppImageName)"
  Write-Host ''
  Write-Host 'A branch principal NAO foi alterada e nenhuma Release foi criada.' -ForegroundColor Cyan
  exit 0
}
catch {
  Write-Host ''
  Write-Host ('[FALHA] ' + $_.Exception.Message) -ForegroundColor Red
  Write-Host 'A branch principal do repositorio nao foi alterada por este processo.' -ForegroundColor Yellow
  exit 1
}
finally {
  if ($TempRoot -and (Test-Path -LiteralPath $TempRoot)) {
    Remove-Item -LiteralPath $TempRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}
