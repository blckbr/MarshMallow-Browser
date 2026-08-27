param([string]$Root = (Split-Path -Parent $PSScriptRoot))
$Root = ([string]$Root).Trim().Trim([char[]]'"')
$Root = [IO.Path]::GetFullPath($Root)
if ($Root.Length -gt 3) { $Root = $Root.TrimEnd([char[]]'\/') }
$ErrorActionPreference='Stop'
Set-StrictMode -Version 2.0

$Version='5.0.0'
$BaseUrl='https://marshmallow-browser-br.pages.dev'
$Installer=Join-Path $Root "release\MarshMallow-Setup-$Version.exe"
$Log=Join-Path $Root 'CONFIRMACAO_SITE_SEO_5.0.0.log'

function Log([string]$Message){
  $line=('[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'),$Message)
  Write-Host $line
  Add-Content -LiteralPath $Log -Value $line -Encoding UTF8
}
function Convert-PublishedJson([string]$Content){
  $text=[string]$Content
  if($text.Length -gt 0 -and [int][char]$text[0] -eq 0xFEFF){$text=$text.Substring(1)}
  $mojibakeBom=([string][char]0x00EF)+([string][char]0x00BB)+([string][char]0x00BF)
  if($text.StartsWith($mojibakeBom)){$text=$text.Substring(3)}
  return ($text|ConvertFrom-Json)
}
function Wait-PublishedJson([string]$Url,[scriptblock]$Validator,[int]$TimeoutSeconds=30){
  $deadline=(Get-Date).AddSeconds($TimeoutSeconds)
  $lastError='sem resposta'
  do {
    try {
      $nonce=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
      $separator=if($Url.Contains('?')){'&'}else{'?'}
      $response=Invoke-WebRequest -Uri ($Url+$separator+'t='+$nonce) -Headers @{'Cache-Control'='no-cache';'Pragma'='no-cache'} -TimeoutSec 20 -UseBasicParsing
      $json=Convert-PublishedJson ([string]$response.Content)
      if(& $Validator $json){return $json}
      $lastError='JSON recebido, mas nao corresponde ao esperado.'
    } catch {$lastError=$_.Exception.Message}
    if((Get-Date) -lt $deadline){Start-Sleep -Seconds 2}
  } while((Get-Date) -lt $deadline)
  throw "Metadados publicos nao confirmados em $Url. Ultimo retorno: $lastError"
}
function Wait-PublishedText([string]$Url,[scriptblock]$Validator,[int]$TimeoutSeconds=30){
  $deadline=(Get-Date).AddSeconds($TimeoutSeconds)
  $lastError='sem resposta'
  do {
    try {
      $nonce=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
      $separator=if($Url.Contains('?')){'&'}else{'?'}
      $response=Invoke-WebRequest -Uri ($Url+$separator+'t='+$nonce) -Headers @{'Cache-Control'='no-cache';'Pragma'='no-cache'} -TimeoutSec 20 -UseBasicParsing
      $text=[string]$response.Content
      if([int]$response.StatusCode -eq 200 -and (& $Validator $text)){return $text}
      $lastError="HTTP $($response.StatusCode), conteudo ainda nao corresponde ao esperado."
    } catch {$lastError=$_.Exception.Message}
    if((Get-Date) -lt $deadline){Start-Sleep -Seconds 2}
  } while((Get-Date) -lt $deadline)
  throw "Pagina publica nao confirmada em $Url. Ultimo retorno: $lastError"
}

Set-Content -LiteralPath $Log -Value "MarshMallow $Version - confirmacao SEO publica - SEM DEPLOY" -Encoding UTF8
try {
  $expectedHash=$null
  if(Test-Path $Installer){$expectedHash=(Get-FileHash -LiteralPath $Installer -Algorithm SHA256).Hash.ToLowerInvariant()}

  $null=Wait-PublishedJson "$BaseUrl/version.json" { param($json)
    $p=$json.PSObject.Properties['version']; $b=$json.PSObject.Properties['siteBuild']
    return ($null -ne $p -and [string]$p.Value -eq $Version -and $null -ne $b -and [string]$b.Value -eq '5.0.0-seo-google')
  }
  Log 'PASS: version.json confirma 5.0.0-seo-google.'

  $null=Wait-PublishedJson "$BaseUrl/download/release.json" { param($json)
    $a=$json.PSObject.Properties['available']; $v=$json.PSObject.Properties['version']; $s=$json.PSObject.Properties['sha256']
    $basic=($null -ne $a -and [bool]$a.Value -and $null -ne $v -and [string]$v.Value -eq $Version)
    if(-not $basic){return $false}
    if($null -ne $expectedHash){return ($null -ne $s -and [string]$s.Value -eq $expectedHash)}
    return $true
  }
  Log 'PASS: download/release.json confirma a release 5.0.0.'

  $null=Wait-PublishedText "$BaseUrl/" { param($text)
    return ($text -match '<title>MarshMallow Browser' -and $text -match 'og:site_name' -and $text -match 'BrowserApplication')
  }
  Log 'PASS: home SEO nova confirmada.'

  $null=Wait-PublishedText "$BaseUrl/robots.txt" { param($text)
    return ($text -match 'Allow:\s*/' -and $text -match 'Sitemap:\s*https://marshmallow-browser-br.pages.dev/sitemap.xml')
  }
  Log 'PASS: robots.txt confirmado.'

  $null=Wait-PublishedText "$BaseUrl/sitemap.xml" { param($text)
    return ($text -match 'https://marshmallow-browser-br.pages.dev/seguranca/' -and $text -notmatch '<priority>' -and $text -notmatch '<changefreq>')
  }
  Log 'PASS: sitemap.xml confirmado.'

  $null=Wait-PublishedText "$BaseUrl/seguranca/" { param($text)
    return ($text -match 'SHA-256' -and $text -match 'github.com/blckbr/MarshMallow-Browser')
  }
  Log 'PASS: pagina seguranca/ confirmada.'

  $null=Wait-PublishedText "$BaseUrl/googlecb101239684b3450.html" { param($text)
    return ($text -match 'google-site-verification:\s*googlecb101239684b3450.html')
  }
  Log 'PASS: arquivo de verificacao Google confirmado.'
  Log 'CONFIRMACAO SEO PASS: site ja esta publicado. Nenhum deploy foi executado.'
  exit 0
} catch {
  Log ('CONFIRMACAO SEO FAIL: '+$_.Exception.Message)
  exit 1
}
