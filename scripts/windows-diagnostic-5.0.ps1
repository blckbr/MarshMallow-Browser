param([string]$Root = (Split-Path -Parent $PSScriptRoot))
$Root = ([string]$Root).Trim().Trim([char[]]'"')
$Root = [IO.Path]::GetFullPath($Root)
if ($Root.Length -gt 3) { $Root = $Root.TrimEnd([char[]]'\/') }
$ErrorActionPreference='Continue'
$Version='5.0.0';$Repo='blckbr/MarshMallow-Browser';$Tag="v$Version"
$Installer=Join-Path $Root "release\MarshMallow-Setup-$Version.exe"
Write-Host 'MARSHMALLOW 5.0.0 - DIAGNOSTICO SOMENTE LEITURA' -ForegroundColor Cyan
if(Test-Path $Installer){$i=Get-Item $Installer;$h=(Get-FileHash $Installer -Algorithm SHA256).Hash.ToLowerInvariant();Write-Host "[LOCAL] EXE OK - $($i.Length) bytes - $h"}else{Write-Host '[LOCAL] EXE AUSENTE'}
foreach($f in @('BUILD_VALIDATION_5.0.0.json','RUNTIME_SMOKE_5.0.0_PASS.json','PUBLICACAO_5.0.0.log')){if(Test-Path (Join-Path $Root $f)){Write-Host "[LOCAL] $f OK"}else{Write-Host "[LOCAL] $f AUSENTE"}}
if(Get-Command gh.exe -ErrorAction SilentlyContinue){& gh.exe auth status; & gh.exe release view $Tag --repo $Repo --json tagName,url,assets}else{Write-Host '[GITHUB] gh.exe ausente'}
try{$v=Invoke-RestMethod -Uri ("https://marshmallow-browser-br.pages.dev/version.json?t="+[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) -Headers @{'Cache-Control'='no-cache'} -TimeoutSec 15;Write-Host ("[SITE] version="+$v.version+" siteBuild="+$v.siteBuild)}catch{Write-Host ("[SITE] version.json falhou: "+$_.Exception.Message)}
try{$r=Invoke-RestMethod -Uri ("https://marshmallow-browser-br.pages.dev/download/release.json?t="+[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) -Headers @{'Cache-Control'='no-cache'} -TimeoutSec 15;Write-Host ("[SITE] release version="+$r.version+" available="+$r.available+" sha256="+$r.sha256)}catch{Write-Host ("[SITE] release.json falhou: "+$_.Exception.Message)}
