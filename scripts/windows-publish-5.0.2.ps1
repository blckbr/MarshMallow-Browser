param([string]$Root = (Split-Path -Parent $PSScriptRoot))
$Root = ([string]$Root).Trim().Trim([char[]]'"')
$Root = [IO.Path]::GetFullPath($Root)
if ($Root.Length -gt 3) { $Root = $Root.TrimEnd([char[]]'\/') }
$ErrorActionPreference='Stop'
Set-StrictMode -Version 2.0
$Version='5.0.2'
$Repo='blckbr/MarshMallow-Browser'
$Tag="v$Version"
$Installer=Join-Path $Root "release\MarshMallow-Setup-$Version.exe"
$HashFile="$Installer.sha256.txt"
$BuildReport=Join-Path $Root 'BUILD_VALIDATION_5.0.2.json'
$SmokeReport=Join-Path $Root 'RUNTIME_SMOKE_5.0.2_PASS.json'
$Public=Join-Path $Root 'MarshMallow-GitHub-Public-5.0.2'
$Site=Join-Path $Root 'MarshMallow-Official-Website-5.0.2\site'
$ReleaseJson=Join-Path $Site 'download\release.json'
$VersionJson=Join-Path $Site 'version.json'
$Notes=Join-Path $Public '5.0.2.md'
$Log=Join-Path $Root 'PUBLICACAO_5.0.2.log'
$Gateway='https://marshmallow-gateway.marshmallow-browser-br.workers.dev'

function Log([string]$Message){$line=('[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'),$Message);Write-Host $line;Add-Content -LiteralPath $Log -Value $line -Encoding UTF8}
function Exec([string]$Label,[scriptblock]$Command){Log "INICIO: $Label";& $Command;if($LASTEXITCODE -ne 0){throw "$Label falhou com exit code $LASTEXITCODE"};Log "OK: $Label"}
function Require([string]$Name){if(-not(Get-Command $Name -ErrorAction SilentlyContinue)){throw "$Name nao foi encontrado no PATH."}}
function Convert-PublishedJson([string]$Content){
  $text=[string]$Content
  if($text.Length -gt 0 -and [int][char]$text[0] -eq 0xFEFF){$text=$text.Substring(1)}
  $mojibakeBom=([string][char]0x00EF)+([string][char]0x00BB)+([string][char]0x00BF)
  if($text.StartsWith($mojibakeBom)){$text=$text.Substring(3)}
  return ($text|ConvertFrom-Json)
}
function Get-Json([string]$Url,[int]$TimeoutSeconds=30){
  $nonce=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); $sep=if($Url.Contains('?')){'&'}else{'?'}
  $response=Invoke-WebRequest -Uri ($Url+$sep+'t='+$nonce) -Headers @{'Cache-Control'='no-cache';'Pragma'='no-cache'} -TimeoutSec $TimeoutSeconds -UseBasicParsing
  return Convert-PublishedJson ([string]$response.Content)
}
function Wait-Json([string]$Url,[scriptblock]$Validator,[int]$TimeoutSeconds=120){
  $deadline=(Get-Date).AddSeconds($TimeoutSeconds);$last='sem resposta'
  do { try {$json=Get-Json $Url;if(& $Validator $json){return $json};$last='JSON ainda nao corresponde ao esperado.'} catch {$last=$_.Exception.Message}; if((Get-Date)-lt$deadline){Start-Sleep -Seconds 3} } while((Get-Date)-lt$deadline)
  throw "Nao foi possivel confirmar $Url. Ultimo retorno: $last"
}
function Release-Exists(){ & cmd.exe /d /c "gh.exe release view $Tag --repo $Repo >nul 2>&1"; return ($LASTEXITCODE -eq 0) }
function Validate-ExistingRelease([int64]$ExpectedSize){
  $json=& gh.exe api "repos/$Repo/releases/tags/$Tag" 2>$null | ConvertFrom-Json
  $asset=@($json.assets | Where-Object {$_.name -eq "MarshMallow-Setup-$Version.exe"})
  $hashAsset=@($json.assets | Where-Object {$_.name -eq "MarshMallow-Setup-$Version.exe.sha256.txt"})
  if($asset.Count -ne 1 -or $hashAsset.Count -ne 1){throw "Release v5.0.2 ja existe, mas nao possui exatamente os dois assets esperados. Por seguranca, nada sera sobrescrito."}
  if([int64]$asset[0].size -ne $ExpectedSize){throw "Release v5.0.2 ja existe com instalador de tamanho diferente. Por seguranca, o publicador nao sobrescreve assets publicados."}
  Log 'Release v5.0.2 ja existe com os assets esperados; upload dispensado e nenhum asset sera sobrescrito.'
}

Set-Content -LiteralPath $Log -Value "MarshMallow $Version - publicacao oficial" -Encoding UTF8
Set-Location $Root
$temp=$null
try{
  foreach($p in @($Installer,$HashFile,$BuildReport,$SmokeReport,$Public,$Site,$ReleaseJson,$VersionJson,$Notes)){if(-not(Test-Path $p)){throw "Arquivo/pasta obrigatorio ausente: $p"}}
  $build=Get-Content -Raw -LiteralPath $BuildReport|ConvertFrom-Json
  $smoke=Get-Content -Raw -LiteralPath $SmokeReport|ConvertFrom-Json
  $hash=(Get-FileHash -LiteralPath $Installer -Algorithm SHA256).Hash.ToLowerInvariant()
  $size=[int64](Get-Item $Installer).Length
  if(-not $build.buildPassed -or [string]$build.sha256 -ne $hash -or [int64]$build.size -ne $size){throw 'Build report nao corresponde ao instalador atual.'}
  if(-not $smoke.pass -or [string]$smoke.sha256 -ne $hash -or [int64]$smoke.size -ne $size){throw 'Smoke report nao corresponde ao instalador atual.'}
  Log "GATE PASS: build + smoke confirmam SHA256=$hash / bytes=$size"

  Require 'git.exe'; Require 'gh.exe'; Require 'npx.cmd'; Require 'npm.cmd'
  Exec 'GitHub autenticacao' { & gh.exe auth status }
  Exec 'GitHub configurar Git' { & gh.exe auth setup-git }
  Exec 'Consultar repositorio oficial' { & gh.exe repo view $Repo }

  $temp=Join-Path $env:TEMP ("MarshMallow-5.0.2-publish-"+[Guid]::NewGuid().ToString('N'))
  Exec 'Clonar repositorio oficial' { & gh.exe repo clone $Repo $temp }
  Get-ChildItem -LiteralPath $temp -Force | Where-Object {$_.Name -ne '.git'} | Remove-Item -Recurse -Force
  Get-ChildItem -LiteralPath $Public -Force | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $temp -Recurse -Force }
  Push-Location $temp
  try{
    & git.exe config user.name 'Deivison Santos'
    & git.exe config user.email 'devsaex@users.noreply.github.com'
    Exec 'Git add' { & git.exe add -A }
    & git.exe diff --cached --quiet
    if($LASTEXITCODE -ne 0){
      Exec 'Commit registro publico 5.0.2' { & git.exe commit -m 'MarshMallow 5.0.2 public release record' }
      Exec 'Push main' { & git.exe push origin HEAD:main }
    } else { Log 'Repositorio publico ja estava sincronizado.' }
  } finally { Pop-Location }

  if(Release-Exists){ Validate-ExistingRelease $size }
  else {
    Log 'Criando nova Release v5.0.2 sem alterar Releases anteriores.'
    Exec 'Criar GitHub Release 5.0.2' { & gh.exe release create $Tag $Installer $HashFile --repo $Repo --title "MarshMallow $Version" --notes-file $Notes }
  }
  Exec 'Verificar GitHub Release 5.0.2' { & gh.exe release view $Tag --repo $Repo --json tagName,url,assets }

  Log 'Publicando Cloudflare Gateway 3.4.1 com contador persistente.'
  Push-Location (Join-Path $Root 'backend')
  try { Exec 'Cloudflare Gateway wrangler deploy' { & npx.cmd wrangler deploy } } finally { Pop-Location }
  $health=Wait-Json "$Gateway/health" { param($json) $json.ok -eq $true -and [string]$json.backendVersion -eq '3.4.1' -and $json.downloadCounterConfigured -eq $true }
  Log 'Gateway 3.4.1 e binding DOWNLOAD_COUNTER confirmados.'

  $publishedAt=(Get-Date).ToUniversalTime().ToString('o')
  $directUrl="https://github.com/blckbr/MarshMallow-Browser/releases/download/$Tag/MarshMallow-Setup-$Version.exe"
  $release=[ordered]@{
    available=$true; version=$Version; fileName="MarshMallow-Setup-$Version.exe";
    url=$directUrl; trackedUrl="$Gateway/download/windows";
    releaseUrl="https://github.com/blckbr/MarshMallow-Browser/releases/tag/$Tag";
    mode='tracked-direct'; size=$size; sizeBytes=$size; sizeHuman=('{0:N2} MB' -f ($size/1MB)); sha256=$hash; publishedAt=$publishedAt
  }
  $Utf8NoBom=New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($ReleaseJson,($release|ConvertTo-Json -Depth 4),$Utf8NoBom)
  [System.IO.File]::WriteAllText($VersionJson,(([ordered]@{version=$Version;siteBuild='5.0.2-trusted-popups-persistent-download-counter';publishedAt=$publishedAt}|ConvertTo-Json -Depth 3)),$Utf8NoBom)
  Log 'Metadados 5.0.2 ativados depois da Release confirmada.'

  Exec 'Cloudflare Pages deploy' { & npx.cmd wrangler pages deploy $Site --project-name marshmallow-browser-br --commit-message MarshMallow-5.0.2 }
  $v=Wait-Json 'https://marshmallow-browser-br.pages.dev/version.json' { param($json) [string]$json.version -eq $Version }
  $r=Wait-Json 'https://marshmallow-browser-br.pages.dev/download/release.json' { param($json) $json.available -eq $true -and [string]$json.version -eq $Version -and [string]$json.sha256 -eq $hash -and [string]$json.mode -eq 'tracked-direct' }
  $counter=Wait-Json "$Gateway/api/downloads/count" { param($json) $json.ok -eq $true -and [double]$json.total -ge 0 }
  Log ("Contador persistente confirmado. Total inicial/atual="+[string]$counter.total+"; baseline GitHub="+[string]$counter.legacyBaseline)
  Log 'PUBLICACAO PASS: GitHub main, Release nova, Gateway e Pages confirmados.'
  Log "Release: https://github.com/blckbr/MarshMallow-Browser/releases/tag/$Tag"
  Log 'Site: https://marshmallow-browser-br.pages.dev/'
  exit 0
}catch{
  Log ("PUBLICACAO FAIL/BLOQUEADA: "+$_.Exception.Message)
  Write-Host ''
  Write-Host 'Nenhum passo posterior sera marcado como concluido. Consulte PUBLICACAO_5.0.2.log.' -ForegroundColor Yellow
  exit 1
}finally{
  if($temp -and (Test-Path $temp)){Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue}
}
