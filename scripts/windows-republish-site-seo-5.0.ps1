param([string]$Root = (Split-Path -Parent $PSScriptRoot))
$Root = ([string]$Root).Trim().Trim([char[]]'"')
$Root = [IO.Path]::GetFullPath($Root)
if ($Root.Length -gt 3) { $Root = $Root.TrimEnd([char[]]'\/') }
$ErrorActionPreference='Stop'
Set-StrictMode -Version 2.0

$Version='5.0.0'
$Repo='blckbr/MarshMallow-Browser'
$Tag="v$Version"
$BaseUrl='https://marshmallow-browser-br.pages.dev'
$Installer=Join-Path $Root "release\MarshMallow-Setup-$Version.exe"
$BuildReport=Join-Path $Root 'BUILD_VALIDATION_5.0.0.json'
$SmokeReport=Join-Path $Root 'RUNTIME_SMOKE_5.0.0_PASS.json'
$Site=Join-Path $Root 'MarshMallow-Official-Website-5.0.0\site'
$ReleaseJson=Join-Path $Site 'download\release.json'
$VersionJson=Join-Path $Site 'version.json'
$SeoTest=Join-Path $Root 'tests\site-seo.test.mjs'
$VerificationFile=Join-Path $Site 'googlecb101239684b3450.html'
$Log=Join-Path $Root 'REPUBLICACAO_SITE_SEO_5.0.0.log'

function Log([string]$Message){
  $line=('[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'),$Message)
  Write-Host $line
  Add-Content -LiteralPath $Log -Value $line -Encoding UTF8
}
function Require([string]$Name){if(-not(Get-Command $Name -ErrorAction SilentlyContinue)){throw "$Name nao foi encontrado no PATH."}}
function Exec([string]$Label,[scriptblock]$Command){
  Log "INICIO: $Label"
  & $Command
  if($LASTEXITCODE -ne 0){throw "$Label falhou com exit code $LASTEXITCODE"}
  Log "OK: $Label"
}
function Convert-PublishedJson([string]$Content){
  $text=[string]$Content
  if($text.Length -gt 0 -and [int][char]$text[0] -eq 0xFEFF){$text=$text.Substring(1)}
  $mojibakeBom=([string][char]0x00EF)+([string][char]0x00BB)+([string][char]0x00BF)
  if($text.StartsWith($mojibakeBom)){$text=$text.Substring(3)}
  return ($text|ConvertFrom-Json)
}
function Wait-PublishedJson([string]$Url,[scriptblock]$Validator,[int]$TimeoutSeconds=120){
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
    } catch {$lastError=$_.Exception.Message}
    if((Get-Date) -lt $deadline){Start-Sleep -Seconds 3}
  } while((Get-Date) -lt $deadline)
  throw "Metadados publicos nao confirmados em $Url apos $TimeoutSeconds s. Ultimo retorno: $lastError"
}
function Wait-PublishedText([string]$Url,[scriptblock]$Validator,[int]$TimeoutSeconds=120){
  $deadline=(Get-Date).AddSeconds($TimeoutSeconds)
  $lastError='sem resposta'
  do {
    try {
      $nonce=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
      $separator=if($Url.Contains('?')){'&'}else{'?'}
      $response=Invoke-WebRequest -Uri ($Url+$separator+'t='+$nonce) -Headers @{'Cache-Control'='no-cache';'Pragma'='no-cache'} -TimeoutSec 30 -UseBasicParsing
      $text=[string]$response.Content
      if([int]$response.StatusCode -eq 200 -and (& $Validator $text)){return $text}
      $lastError="HTTP $($response.StatusCode), conteudo ainda nao corresponde ao esperado."
    } catch {$lastError=$_.Exception.Message}
    if((Get-Date) -lt $deadline){Start-Sleep -Seconds 3}
  } while((Get-Date) -lt $deadline)
  throw "Pagina publica nao confirmada em $Url apos $TimeoutSeconds s. Ultimo retorno: $lastError"
}

Set-Content -LiteralPath $Log -Value "MarshMallow $Version - SEO Google - republicacao SOMENTE do site" -Encoding UTF8
Set-Location $Root
try {
  foreach($p in @($Installer,$BuildReport,$SmokeReport,$Site,$ReleaseJson,$VersionJson,$SeoTest,$VerificationFile)){
    if(-not(Test-Path $p)){throw "Arquivo/pasta obrigatorio ausente: $p"}
  }

  Require 'node.exe'
  Require 'gh.exe'
  Require 'npx.cmd'

  Exec 'Testes SEO locais' { & node.exe --test (Join-Path $Root 'tests\site-seo.test.mjs') }

  $build=Get-Content -Raw -LiteralPath $BuildReport|ConvertFrom-Json
  $smoke=Get-Content -Raw -LiteralPath $SmokeReport|ConvertFrom-Json
  $hash=(Get-FileHash -LiteralPath $Installer -Algorithm SHA256).Hash.ToLowerInvariant()
  $size=[int64](Get-Item $Installer).Length
  if(-not $build.buildPassed -or [string]$build.sha256 -ne $hash -or [int64]$build.size -ne $size){throw 'Build report nao corresponde ao instalador atual.'}
  if(-not $smoke.pass -or [string]$smoke.sha256 -ne $hash -or [int64]$smoke.size -ne $size){throw 'Smoke report nao corresponde ao instalador atual.'}
  Log "LOCAL PASS: instalador confirmado SHA256=$hash / bytes=$size"

  Exec 'GitHub autenticacao (somente leitura)' { & gh.exe auth status }
  $releaseRaw=(& gh.exe release view $Tag --repo $Repo --json tagName,url,assets | Out-String)
  if($LASTEXITCODE -ne 0){throw "GitHub Release $Tag nao foi encontrada."}
  $ghRelease=$releaseRaw|ConvertFrom-Json
  $installerName="MarshMallow-Setup-$Version.exe"
  $asset=@($ghRelease.assets|Where-Object { [string]$_.name -eq $installerName })|Select-Object -First 1
  if($null -eq $asset){throw "Asset ausente no GitHub: $installerName"}
  if([string]$asset.digest -ne "sha256:$hash"){throw 'SHA-256 do instalador no GitHub nao corresponde ao instalador local.'}
  if([int64]$asset.size -ne $size){throw 'Tamanho do instalador no GitHub nao corresponde ao instalador local.'}
  Log 'GITHUB PASS: Release existente foi apenas conferida. Nenhum push, Release ou upload sera feito.'

  $publishedAt=(Get-Date).ToUniversalTime().ToString('o')
  $release=[ordered]@{
    available=$true; version=$Version; fileName=$installerName;
    url="https://github.com/blckbr/MarshMallow-Browser/releases/download/$Tag/$installerName";
    releaseUrl="https://github.com/blckbr/MarshMallow-Browser/releases/tag/$Tag";
    mode='direct'; size=$size; sizeBytes=$size; sizeHuman=('{0:N2} MB' -f ($size/1MB)); sha256=$hash; publishedAt=$publishedAt
  }
  $Utf8NoBom=New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($ReleaseJson,($release|ConvertTo-Json -Depth 4),$Utf8NoBom)
  [System.IO.File]::WriteAllText($VersionJson,(([ordered]@{version=$Version;siteBuild='5.0.0-seo-google';publishedAt=$publishedAt}|ConvertTo-Json -Depth 3)),$Utf8NoBom)
  foreach($jsonPath in @($ReleaseJson,$VersionJson)){
    $bytes=[System.IO.File]::ReadAllBytes($jsonPath)
    if($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF){throw "BOM UTF-8 ainda presente em $jsonPath"}
  }
  Log 'METADADOS PASS: version.json e release.json gravados em UTF-8 sem BOM.'

  Exec 'Cloudflare Pages deploy SOMENTE do site SEO' { & npx.cmd wrangler pages deploy $Site --project-name marshmallow-browser-br --commit-message MarshMallow-5.0.0-seo-google }

  $null=Wait-PublishedJson "$BaseUrl/version.json" { param($json)
    $p=$json.PSObject.Properties['version']; $b=$json.PSObject.Properties['siteBuild']
    return ($null -ne $p -and [string]$p.Value -eq $Version -and $null -ne $b -and [string]$b.Value -eq '5.0.0-seo-google')
  }
  $null=Wait-PublishedJson "$BaseUrl/download/release.json" { param($json)
    $a=$json.PSObject.Properties['available']; $v=$json.PSObject.Properties['version']; $s=$json.PSObject.Properties['sha256']
    return ($null -ne $a -and [bool]$a.Value -and $null -ne $v -and [string]$v.Value -eq $Version -and $null -ne $s -and [string]$s.Value -eq $hash)
  }

  $null=Wait-PublishedText "$BaseUrl/" { param($text)
    return ($text -match '<title>MarshMallow Browser' -and $text -match 'og:site_name' -and $text -match 'BrowserApplication')
  }
  $null=Wait-PublishedText "$BaseUrl/robots.txt" { param($text)
    return ($text -match 'Allow:\s*/' -and $text -match 'Sitemap:\s*https://marshmallow-browser-br.pages.dev/sitemap.xml')
  }
  $null=Wait-PublishedText "$BaseUrl/sitemap.xml" { param($text)
    return ($text -match 'https://marshmallow-browser-br.pages.dev/seguranca/' -and $text -notmatch '<priority>' -and $text -notmatch '<changefreq>')
  }
  $null=Wait-PublishedText "$BaseUrl/seguranca/" { param($text)
    return ($text -match 'SHA-256' -and $text -match 'github.com/blckbr/MarshMallow-Browser')
  }
  $null=Wait-PublishedText "$BaseUrl/googlecb101239684b3450.html" { param($text)
    return ($text -match 'google-site-verification:\s*googlecb101239684b3450.html')
  }

  Log 'SEO GOOGLE PASS: home, robots.txt, sitemap.xml, seguranca/ e arquivo de verificacao estao publicos.'
  Log 'REPUBLICACAO SITE PASS: somente Cloudflare Pages foi alterado.'
  exit 0
} catch {
  Log ('REPUBLICACAO SITE SEO FAIL: '+$_.Exception.Message)
  exit 1
}
