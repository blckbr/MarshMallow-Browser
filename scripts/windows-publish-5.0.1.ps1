param([string]$Root = (Split-Path -Parent $PSScriptRoot))
$Root = ([string]$Root).Trim().Trim([char[]]'"')
$Root = [IO.Path]::GetFullPath($Root)
if ($Root.Length -gt 3) { $Root = $Root.TrimEnd([char[]]'\/') }
$ErrorActionPreference='Stop'
Set-StrictMode -Version 2.0
$Version='5.0.1'
$Repo='blckbr/MarshMallow-Browser'
$Tag="v$Version"
$Installer=Join-Path $Root "release\MarshMallow-Setup-$Version.exe"
$HashFile="$Installer.sha256.txt"
$BuildReport=Join-Path $Root 'BUILD_VALIDATION_5.0.1.json'
$SmokeReport=Join-Path $Root 'RUNTIME_SMOKE_5.0.1_PASS.json'
$Public=Join-Path $Root 'MarshMallow-GitHub-Public-5.0.1'
$Site=Join-Path $Root 'MarshMallow-Official-Website-5.0.1\site'
$ReleaseJson=Join-Path $Site 'download\release.json'
$VersionJson=Join-Path $Site 'version.json'
$Notes=Join-Path $Public '5.0.1.md'
$Log=Join-Path $Root 'PUBLICACAO_5.0.1.log'

function Log([string]$Message){$line=('[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'),$Message);Write-Host $line;Add-Content -LiteralPath $Log -Value $line -Encoding UTF8}
function Exec([string]$Label,[scriptblock]$Command){Log "INICIO: $Label";& $Command;if($LASTEXITCODE -ne 0){throw "$Label falhou com exit code $LASTEXITCODE"};Log "OK: $Label"}
function Require([string]$Name){if(-not(Get-Command $Name -ErrorAction SilentlyContinue)){throw "$Name nao foi encontrado no PATH."}}

function Test-GitHubReleaseExists([string]$ReleaseTag,[string]$Repository){
  # Use cmd.exe for the existence probe so gh's expected stderr ("release not found")
  # is not promoted to a terminating PowerShell error while ErrorActionPreference=Stop.
  & cmd.exe /d /c "gh.exe release view $ReleaseTag --repo $Repository >nul 2>&1"
  return ($LASTEXITCODE -eq 0)
}

function Convert-PublishedJson([string]$Content){
  $text=[string]$Content
  if($text.Length -gt 0 -and [int][char]$text[0] -eq 0xFEFF){$text=$text.Substring(1)}
  $mojibakeBom=([string][char]0x00EF)+([string][char]0x00BB)+([string][char]0x00BF)
  if($text.StartsWith($mojibakeBom)){$text=$text.Substring(3)}
  return ($text|ConvertFrom-Json)
}

function Wait-PublishedJson([string]$Url,[scriptblock]$Validator,[int]$TimeoutSeconds=90){
  $deadline=(Get-Date).AddSeconds($TimeoutSeconds)
  $lastError='sem resposta'
  do {
    try {
      $nonce=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
      $separator=if($Url.Contains('?')){'&'}else{'?'}
      $response=Invoke-WebRequest -Uri ($Url+$separator+'t='+$nonce) -Headers @{'Cache-Control'='no-cache';'Pragma'='no-cache'} -TimeoutSec 30 -UseBasicParsing
      $json=Convert-PublishedJson ([string]$response.Content)
      if(& $Validator $json){return $json}
      $lastError='JSON recebido, mas ainda nao corresponde ao release atual.'
    } catch {
      $lastError=$_.Exception.Message
    }
    if((Get-Date) -lt $deadline){Start-Sleep -Seconds 3}
  } while((Get-Date) -lt $deadline)
  throw "Metadados publicos nao confirmados em $Url apos $TimeoutSeconds s. Ultimo retorno: $lastError"
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

  Require 'git.exe'; Require 'gh.exe'; Require 'npx.cmd'
  Exec 'GitHub autenticacao' { & gh.exe auth status }
  Exec 'GitHub configurar Git' { & gh.exe auth setup-git }
  Exec 'Consultar repositorio oficial' { & gh.exe repo view $Repo }

  $temp=Join-Path $env:TEMP ("MarshMallow-5.0.1-publish-"+[Guid]::NewGuid().ToString('N'))
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
      Exec 'Commit registro publico 5.0.1' { & git.exe commit -m 'MarshMallow 5.0.1 public release record' }
      Exec 'Push main' { & git.exe push origin HEAD:main }
    } else { Log 'Repositorio publico ja estava sincronizado.' }
  } finally { Pop-Location }

  if(-not (Test-GitHubReleaseExists $Tag $Repo)){
    Log "GitHub Release $Tag ainda nao existe; ela sera criada agora."
    Exec 'Criar GitHub Release 5.0.1' { & gh.exe release create $Tag $Installer $HashFile --repo $Repo --title "MarshMallow $Version" --notes-file $Notes }
  } else {
    Exec 'Atualizar assets GitHub Release 5.0.1' { & gh.exe release upload $Tag $Installer $HashFile --repo $Repo --clobber }
  }
  Exec 'Verificar GitHub Release' { & gh.exe release view $Tag --repo $Repo --json tagName,url,assets }

  $publishedAt=(Get-Date).ToUniversalTime().ToString('o')
  $release=[ordered]@{
    available=$true; version=$Version; fileName="MarshMallow-Setup-$Version.exe";
    url="https://github.com/blckbr/MarshMallow-Browser/releases/download/$Tag/MarshMallow-Setup-$Version.exe";
    releaseUrl="https://github.com/blckbr/MarshMallow-Browser/releases/tag/$Tag";
    mode='direct'; size=$size; sizeBytes=$size; sizeHuman=('{0:N2} MB' -f ($size/1MB)); sha256=$hash; publishedAt=$publishedAt
  }
  $Utf8NoBom=New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($ReleaseJson,($release|ConvertTo-Json -Depth 4),$Utf8NoBom)
  [System.IO.File]::WriteAllText($VersionJson,(([ordered]@{version=$Version;siteBuild='5.0.1-pdf-reader-download-counter';publishedAt=$publishedAt}|ConvertTo-Json -Depth 3)),$Utf8NoBom)
  Log 'Metadados do site ativados SOMENTE depois da Release/asset confirmados.'

  Exec 'Cloudflare Pages deploy' { & npx.cmd wrangler pages deploy $Site --project-name marshmallow-browser-br --commit-message MarshMallow-5.0.1 }
  $v=Wait-PublishedJson 'https://marshmallow-browser-br.pages.dev/version.json' { param($json)
    $versionProperty=$json.PSObject.Properties['version']
    return ($null -ne $versionProperty -and [string]$versionProperty.Value -eq $Version)
  }
  $r=Wait-PublishedJson 'https://marshmallow-browser-br.pages.dev/download/release.json' { param($json)
    $availableProperty=$json.PSObject.Properties['available']
    $versionProperty=$json.PSObject.Properties['version']
    $shaProperty=$json.PSObject.Properties['sha256']
    return (
      $null -ne $availableProperty -and [bool]$availableProperty.Value -and
      $null -ne $versionProperty -and [string]$versionProperty.Value -eq $Version -and
      $null -ne $shaProperty -and [string]$shaProperty.Value -eq $hash
    )
  }
  Log 'PUBLICACAO PASS: GitHub main, Release/assets e Cloudflare Pages confirmados.'
  Log "Release: https://github.com/blckbr/MarshMallow-Browser/releases/tag/$Tag"
  Log 'Site: https://marshmallow-browser-br.pages.dev/'
  exit 0
}catch{
  Log ("PUBLICACAO FAIL/BLOQUEADA: "+$_.Exception.Message)
  Write-Host ''
  Write-Host 'Nenhum passo posterior sera executado. Consulte PUBLICACAO_5.0.1.log.' -ForegroundColor Yellow
  exit 1
}finally{
  if($temp -and (Test-Path $temp)){Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue}
}
