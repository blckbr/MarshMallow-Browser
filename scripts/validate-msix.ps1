$ErrorActionPreference='Stop'
$Root=Split-Path -Parent $PSScriptRoot
$Msix=Join-Path $Root 'output\MarshMallow-Browser-5.0.0-x64.msix'
if(-not(Test-Path $Msix)){Write-Host '[ERRO] Gere o MSIX primeiro.' -ForegroundColor Red; exit 1}
$expected=@{Name='Devsaex.MarshMallowBrowser';Publisher='CN=523D70FB-BE15-4C20-AF5F-12A81A65BD6F';Version='5.0.0.0';ProcessorArchitecture='x64'}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=[IO.Compression.ZipFile]::OpenRead($Msix)
try{$e=$zip.GetEntry('AppxManifest.xml');if(!$e){throw 'AppxManifest.xml ausente.'};$r=New-Object IO.StreamReader($e.Open());try{$t=$r.ReadToEnd()}finally{$r.Dispose()}}finally{$zip.Dispose()}
[xml]$x=$t;$ns=New-Object Xml.XmlNamespaceManager($x.NameTable);$ns.AddNamespace('f','http://schemas.microsoft.com/appx/manifest/foundation/windows10');$id=$x.SelectSingleNode('/f:Package/f:Identity',$ns);if(!$id){throw 'Identity ausente.'}
$ok=$true
foreach($k in $expected.Keys){$v=[string]$id.GetAttribute($k);if($v -ne $expected[$k]){Write-Host "[ERRO] $k=$v (esperado $($expected[$k]))" -ForegroundColor Red;$ok=$false}else{Write-Host "[OK] $k=$v" -ForegroundColor Green}}
$h=(Get-FileHash $Msix -Algorithm SHA256).Hash.ToLowerInvariant();Write-Host "SHA-256: $h";Write-Host "Bytes: $((Get-Item $Msix).Length)"
if(!$ok){exit 1};exit 0
