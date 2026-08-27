param([string]$Root = (Split-Path -Parent $PSScriptRoot))
$Root = ([string]$Root).Trim().Trim([char[]]'"')
$Root = [IO.Path]::GetFullPath($Root)
if ($Root.Length -gt 3) { $Root = $Root.TrimEnd([char[]]'\/') }
$ErrorActionPreference='Stop'
Set-StrictMode -Version 2.0
$Version='5.0.0'
$Repo='blckbr/MarshMallow-Browser'
$Tag="v$Version"
$Installer=Join-Path $Root "release\MarshMallow-Setup-$Version.exe"
$HashFile="$Installer.sha256.txt"
$BuildReport=Join-Path $Root 'BUILD_VALIDATION_5.0.0.json'
$SmokeReport=Join-Path $Root 'RUNTIME_SMOKE_5.0.0_PASS.json'
$Log=Join-Path $Root 'VERIFICACAO_PUBLICACAO_5.0.0.log'

function Log([string]$Message){
  $line=('[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'),$Message)
  Write-Host $line
  Add-Content -LiteralPath $Log -Value $line -Encoding UTF8
}

function Require([string]$Name){
  if(-not(Get-Command $Name -ErrorAction SilentlyContinue)){throw "$Name nao foi encontrado no PATH."}
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

Set-Content -LiteralPath $Log -Value "MarshMallow $Version - verificacao somente leitura" -Encoding UTF8
Set-Location $Root
try {
  foreach($p in @($Installer,$HashFile,$BuildReport,$SmokeReport)){
    if(-not(Test-Path $p)){throw "Arquivo obrigatorio ausente: $p"}
  }

  $build=Get-Content -Raw -LiteralPath $BuildReport|ConvertFrom-Json
  $smoke=Get-Content -Raw -LiteralPath $SmokeReport|ConvertFrom-Json
  $hash=(Get-FileHash -LiteralPath $Installer -Algorithm SHA256).Hash.ToLowerInvariant()
  $size=[int64](Get-Item $Installer).Length
  if(-not $build.buildPassed -or [string]$build.sha256 -ne $hash -or [int64]$build.size -ne $size){throw 'Build report nao corresponde ao instalador atual.'}
  if(-not $smoke.pass -or [string]$smoke.sha256 -ne $hash -or [int64]$smoke.size -ne $size){throw 'Smoke report nao corresponde ao instalador atual.'}
  Log "LOCAL PASS: instalador confirmado SHA256=$hash / bytes=$size"

  Require 'gh.exe'
  & gh.exe auth status
  if($LASTEXITCODE -ne 0){throw "GitHub autenticacao falhou com exit code $LASTEXITCODE"}

  $releaseRaw=(& gh.exe release view $Tag --repo $Repo --json tagName,url,assets | Out-String)
  if($LASTEXITCODE -ne 0){throw "GitHub Release $Tag nao foi encontrada."}
  $release=$releaseRaw|ConvertFrom-Json
  $tagProperty=$release.PSObject.Properties['tagName']
  $assetsProperty=$release.PSObject.Properties['assets']
  if($null -eq $tagProperty -or [string]$tagProperty.Value -ne $Tag){throw 'GitHub Release retornou tag inesperada.'}
  if($null -eq $assetsProperty){throw 'GitHub Release nao retornou assets.'}

  $installerName="MarshMallow-Setup-$Version.exe"
  $hashName="$installerName.sha256.txt"
  $installerAsset=@($assetsProperty.Value|Where-Object { [string]$_.name -eq $installerName })|Select-Object -First 1
  $hashAsset=@($assetsProperty.Value|Where-Object { [string]$_.name -eq $hashName })|Select-Object -First 1
  if($null -eq $installerAsset){throw "Asset ausente no GitHub: $installerName"}
  if($null -eq $hashAsset){throw "Asset ausente no GitHub: $hashName"}
  $digestProperty=$installerAsset.PSObject.Properties['digest']
  $sizeProperty=$installerAsset.PSObject.Properties['size']
  if($null -eq $digestProperty -or [string]$digestProperty.Value -ne "sha256:$hash"){throw 'SHA-256 do instalador no GitHub nao corresponde ao instalador local.'}
  if($null -eq $sizeProperty -or [int64]$sizeProperty.Value -ne $size){throw 'Tamanho do instalador no GitHub nao corresponde ao instalador local.'}
  Log 'GITHUB PASS: Release v5.0.0 e assets confirmados.'

  $null=Wait-PublishedJson 'https://marshmallow-browser-br.pages.dev/version.json' { param($json)
    $versionProperty=$json.PSObject.Properties['version']
    return ($null -ne $versionProperty -and [string]$versionProperty.Value -eq $Version)
  }
  $null=Wait-PublishedJson 'https://marshmallow-browser-br.pages.dev/download/release.json' { param($json)
    $availableProperty=$json.PSObject.Properties['available']
    $versionProperty=$json.PSObject.Properties['version']
    $shaProperty=$json.PSObject.Properties['sha256']
    return (
      $null -ne $availableProperty -and [bool]$availableProperty.Value -and
      $null -ne $versionProperty -and [string]$versionProperty.Value -eq $Version -and
      $null -ne $shaProperty -and [string]$shaProperty.Value -eq $hash
    )
  }
  Log 'SITE PASS: version.json e release.json publicos confirmados.'
  Log 'VERIFICACAO PASS: GitHub + Cloudflare Pages estao publicados corretamente.'
  exit 0
} catch {
  Log ('VERIFICACAO FAIL: '+$_.Exception.Message)
  exit 1
}
