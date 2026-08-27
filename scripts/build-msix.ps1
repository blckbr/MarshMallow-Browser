$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Root = Split-Path -Parent $PSScriptRoot
$Work = Join-Path $Root 'work'
$Payload = Join-Path $Work 'payload-x64'
$Assets = Join-Path $Payload 'Assets'
$OutDir = Join-Path $Root 'output'
$ManifestTemplate = Join-Path $Root 'Package.appxmanifest.template'
$Manifest = Join-Path $Payload 'Package.appxmanifest'
$Msix = Join-Path $OutDir 'MarshMallow-Browser-5.0.0-x64.msix'
$HashFile = "$Msix.sha256.txt"

$ExpectedName = 'Devsaex.MarshMallowBrowser'
$ExpectedPublisher = 'CN=523D70FB-BE15-4C20-AF5F-12A81A65BD6F'
$ExpectedVersion = '5.0.0.0'
$ExpectedArch = 'x64'

function Step([string]$text) {
    Write-Host "`n==============================================================" -ForegroundColor DarkGray
    Write-Host " $text" -ForegroundColor Cyan
    Write-Host "==============================================================" -ForegroundColor DarkGray
}
function Fail([string]$text) {
    Write-Host "`n[ERRO] $text" -ForegroundColor Red
    exit 1
}
function Ok([string]$text) { Write-Host "[OK] $text" -ForegroundColor Green }

function Get-PeArchitecture([string]$Path) {
    $fs = [System.IO.File]::Open($Path, 'Open', 'Read', 'ReadWrite')
    try {
        $br = New-Object System.IO.BinaryReader($fs)
        $fs.Seek(0x3C, [System.IO.SeekOrigin]::Begin) | Out-Null
        $pe = $br.ReadInt32()
        $fs.Seek($pe + 4, [System.IO.SeekOrigin]::Begin) | Out-Null
        $machine = $br.ReadUInt16()
        switch ($machine) {
            0x8664 { return 'x64' }
            0x014c { return 'x86' }
            0xAA64 { return 'arm64' }
            default { return ('unknown-0x{0:X4}' -f $machine) }
        }
    } finally { $fs.Dispose() }
}

function Find-MarshMallowExe {
    $found = New-Object System.Collections.Generic.List[string]

    # 1) Registry uninstall entries (fast and reliable for installed desktop apps)
    $regRoots = @(
      'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
      'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
      'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
    )
    foreach ($reg in $regRoots) {
        # Com StrictMode, acessar diretamente uma propriedade que nao existe
        # acessar uma propriedade ausente gera PropertyNotFoundException. Entradas do
        # registro de desinstalacao nao possuem um schema uniforme, portanto
        # lemos cada propriedade de forma defensiva pelo PSObject.
        $entries = @(Get-ItemProperty $reg -ErrorAction SilentlyContinue)
        foreach ($entry in $entries) {
            $displayNameProp = $entry.PSObject.Properties['DisplayName']
            $displayName = if ($null -ne $displayNameProp) { [string]$displayNameProp.Value } else { '' }
            if ($displayName -notlike '*MarshMallow*') { continue }

            $installLocationProp = $entry.PSObject.Properties['InstallLocation']
            $installLocation = if ($null -ne $installLocationProp) { [string]$installLocationProp.Value } else { '' }
            if (-not [string]::IsNullOrWhiteSpace($installLocation)) {
                $candidate = Join-Path $installLocation 'MarshMallow.exe'
                if (Test-Path $candidate -PathType Leaf) { $found.Add((Resolve-Path $candidate).Path) }
            }

            $displayIconProp = $entry.PSObject.Properties['DisplayIcon']
            $displayIcon = if ($null -ne $displayIconProp) { [string]$displayIconProp.Value } else { '' }
            if (-not [string]::IsNullOrWhiteSpace($displayIcon)) {
                $iconPath = ($displayIcon -replace ',\d+$','').Trim('"')
                if ((Test-Path $iconPath -PathType Leaf) -and ([IO.Path]::GetFileName($iconPath) -ieq 'MarshMallow.exe')) {
                    $found.Add((Resolve-Path $iconPath).Path)
                }
            }
        }
    }

    # 2) Known install/build paths, incluindo o projeto em que este builder
    # foi extraido. O MarshMallow 5.0 e Tauri, portanto priorizamos target\release.
    $candidates = @(
        (Join-Path $Root 'src-tauri\target\release\MarshMallow.exe'),
        (Join-Path $Root 'src-tauri\target\release\marshmallow.exe'),
        (Join-Path $Root 'target\release\MarshMallow.exe'),
        (Join-Path $Root 'target\release\marshmallow.exe'),
        (Join-Path $Root 'dist\win-unpacked\MarshMallow.exe'),
        (Join-Path $Root 'release\win-unpacked\MarshMallow.exe'),
        "$env:LOCALAPPDATA\Programs\MarshMallow\MarshMallow.exe",
        "$env:LOCALAPPDATA\Programs\MarshMallow Browser\MarshMallow.exe",
        "$env:LOCALAPPDATA\MarshMallow\MarshMallow.exe",
        "$env:ProgramFiles\MarshMallow\MarshMallow.exe",
        "$env:ProgramFiles\MarshMallow Browser\MarshMallow.exe",
        'C:\MarshMallow-5.0.0-Source\src-tauri\target\release\MarshMallow.exe',
        'C:\MarshMallow-5.0.0-Source\src-tauri\target\release\marshmallow.exe',
        'C:\MarshMallow-5.0.0-Source\target\release\MarshMallow.exe',
        'C:\MarshMallow-5.0.0-Source\dist\win-unpacked\MarshMallow.exe',
        'C:\MarshMallow\dist\win-unpacked\MarshMallow.exe',
        'C:\MarshMallow-Browser\dist\win-unpacked\MarshMallow.exe',
        'C:\MarshMallow\release\win-unpacked\MarshMallow.exe',
        'C:\MarshMallow-Browser\release\win-unpacked\MarshMallow.exe',
        'C:\release_5.0.0\win-unpacked\MarshMallow.exe'
    )
    foreach ($c in $candidates) { if (Test-Path $c) { $found.Add((Resolve-Path $c).Path) } }

    $unique = @($found | Select-Object -Unique)
    if ($unique.Count -gt 0) {
        Write-Host 'Instalacoes/builds detectados:' -ForegroundColor Yellow
        for ($i=0; $i -lt $unique.Count; $i++) { Write-Host ("  [{0}] {1}" -f ($i+1), $unique[$i]) }
        if ($unique.Count -eq 1) {
            $choice = Read-Host 'Usar este MarshMallow.exe? [S/n]'
            if ([string]::IsNullOrWhiteSpace($choice) -or $choice -match '^[sSyY]') { return $unique[0] }
        } else {
            $raw = Read-Host "Digite o numero desejado ou ENTER para informar manualmente"
            if ($raw -match '^\d+$') {
                $n = [int]$raw
                if ($n -ge 1 -and $n -le $unique.Count) { return $unique[$n-1] }
            }
        }
    }

    while ($true) {
        $manual = Read-Host 'Cole o caminho completo para MarshMallow.exe'
        $manual = $manual.Trim().Trim('"')
        if (Test-Path $manual -PathType Leaf) { return (Resolve-Path $manual).Path }
        Write-Host '[AVISO] Arquivo nao encontrado.' -ForegroundColor Yellow
    }
}

function Save-Logo([System.Drawing.Bitmap]$Source, [string]$Path, [int]$Width, [int]$Height) {
    $canvas = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($canvas)
    try {
        $g.Clear([System.Drawing.Color]::Transparent)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $margin = [Math]::Max(2, [int]([Math]::Min($Width,$Height) * 0.08))
        $maxW = $Width - 2*$margin; $maxH = $Height - 2*$margin
        $scale = [Math]::Min($maxW / $Source.Width, $maxH / $Source.Height)
        $w = [int]($Source.Width * $scale); $h = [int]($Source.Height * $scale)
        $x = [int](($Width-$w)/2); $y = [int](($Height-$h)/2)
        $g.DrawImage($Source, $x, $y, $w, $h)
        $canvas.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $g.Dispose(); $canvas.Dispose() }
}

Step '1/7 - Localizar e validar MarshMallow x64'
$ExePath = Find-MarshMallowExe
$SourceDir = Split-Path -Parent $ExePath
$arch = Get-PeArchitecture $ExePath
Write-Host "Executavel: $ExePath"
Write-Host "Arquitetura PE: $arch"
if ($arch -ne 'x64') { Fail "Este envio foi preparado para x64, mas o executavel detectado e $arch." }
$info = [Diagnostics.FileVersionInfo]::GetVersionInfo($ExePath)
Write-Host "Produto: $($info.ProductName)"
Write-Host "Versao do arquivo: $($info.FileVersion)"
Ok 'Executavel x64 confirmado.'

Step '2/7 - Preparar payload MSIX'
if (Test-Path $Work) { Remove-Item $Work -Recurse -Force }
if (Test-Path $OutDir) { Remove-Item $OutDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $Payload,$Assets,$OutDir | Out-Null

& robocopy.exe $SourceDir $Payload /E /COPY:DAT /DCOPY:DAT /R:1 /W:1 /NFL /NDL /NJH /NJS /NP /XF 'Uninstall*.exe' 'unins*.exe' '*.log'
$robo = $LASTEXITCODE
if ($robo -ge 8) { Fail "Robocopy falhou com codigo $robo." }
# Garantir que o principal existe com nome canonico esperado no manifesto.
$CopiedExe = Join-Path $Payload 'MarshMallow.exe'
if (-not (Test-Path $CopiedExe)) {
    Copy-Item $ExePath $CopiedExe -Force
}
Get-ChildItem $Payload -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -like 'Uninstall*.exe' -or $_.Name -like 'unins*.exe'
} | Remove-Item -Force -ErrorAction SilentlyContinue
Ok 'Payload copiado sem o desinstalador NSIS.'

Step '3/7 - Gerar assets a partir do icone do navegador'
Add-Type -AssemblyName System.Drawing
$icon = [System.Drawing.Icon]::ExtractAssociatedIcon($CopiedExe)
if ($null -eq $icon) { Fail 'Nao foi possivel extrair o icone de MarshMallow.exe.' }
$bitmap = $icon.ToBitmap()
try {
    Save-Logo $bitmap (Join-Path $Assets 'StoreLogo.png') 50 50
    Save-Logo $bitmap (Join-Path $Assets 'Square44x44Logo.png') 44 44
    Save-Logo $bitmap (Join-Path $Assets 'Square150x150Logo.png') 150 150
    Save-Logo $bitmap (Join-Path $Assets 'Wide310x150Logo.png') 310 150
    Save-Logo $bitmap (Join-Path $Assets 'Square310x310Logo.png') 310 310
} finally { $bitmap.Dispose(); $icon.Dispose() }
Ok 'Assets PNG gerados.'

Step '4/7 - Criar e validar manifesto da Store'
Copy-Item $ManifestTemplate $Manifest -Force
[xml]$mx = Get-Content $Manifest -Raw
$ns = New-Object System.Xml.XmlNamespaceManager($mx.NameTable)
$ns.AddNamespace('f','http://schemas.microsoft.com/appx/manifest/foundation/windows10')
$id = $mx.SelectSingleNode('/f:Package/f:Identity',$ns)
if ($null -eq $id) { Fail 'Identity ausente no manifesto.' }
if ($id.Name -ne $ExpectedName) { Fail "Identity Name incorreto: $($id.Name)" }
if ($id.Publisher -ne $ExpectedPublisher) { Fail "Publisher incorreto: $($id.Publisher)" }
if ($id.Version -ne $ExpectedVersion) { Fail "Versao incorreta: $($id.Version)" }
if ($id.ProcessorArchitecture -ne $ExpectedArch) { Fail "Arquitetura incorreta: $($id.ProcessorArchitecture)" }
Ok 'Manifesto confere com a identidade reservada no Partner Center.'

Step '5/7 - Instalar/localizar Microsoft winapp CLI'
$winapp = Get-Command winapp.exe -ErrorAction SilentlyContinue
if (-not $winapp) { $winapp = Get-Command winapp -ErrorAction SilentlyContinue }
if (-not $winapp) {
    if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) { Fail 'WinGet nao encontrado. Atualize o App Installer da Microsoft Store.' }
    Write-Host 'Instalando Microsoft Windows App Development CLI (winapp)...' -ForegroundColor Yellow
    & winget.exe install --id microsoft.winappcli -e --source winget --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -ne 0) { Fail "winget falhou ao instalar winapp (codigo $LASTEXITCODE)." }
    $env:PATH += ";$env:LOCALAPPDATA\Microsoft\WinGet\Links"
    $winapp = Get-Command winapp.exe -ErrorAction SilentlyContinue
    if (-not $winapp) { $winapp = Get-Command winapp -ErrorAction SilentlyContinue }
    if (-not $winapp) {
        $foundWinapp = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Filter winapp.exe -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($foundWinapp) { $winapp = $foundWinapp.FullName }
    }
}
if (-not $winapp) { Fail 'winapp foi instalado, mas nao consegui localizar winapp.exe. Feche e rode o BAT novamente.' }
$winappPath = if ($winapp -is [string]) { $winapp } else { $winapp.Source }
Write-Host "winapp: $winappPath"
& $winappPath --version
if ($LASTEXITCODE -ne 0) { Fail 'winapp nao respondeu corretamente.' }

Step '6/7 - Gerar MSIX x64 para Microsoft Store'
if (Test-Path $Msix) { Remove-Item $Msix -Force }
# Nao assinar: a Microsoft Store assina o pacote apos a submissao.
& $winappPath pack $Payload --manifest $Manifest --executable 'MarshMallow.exe' --output $Msix
if ($LASTEXITCODE -ne 0) { Fail "winapp pack falhou com codigo $LASTEXITCODE." }
if (-not (Test-Path $Msix)) { Fail 'winapp terminou sem criar o arquivo MSIX esperado.' }
Ok "MSIX criado: $Msix"

Step '7/7 - Reabrir o MSIX e conferir identidade interna'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($Msix)
try {
    $entry = $zip.GetEntry('AppxManifest.xml')
    if ($null -eq $entry) { Fail 'MSIX criado sem AppxManifest.xml.' }
    $reader = New-Object IO.StreamReader($entry.Open())
    try { $manifestText = $reader.ReadToEnd() } finally { $reader.Dispose() }
} finally { $zip.Dispose() }
[xml]$inside = $manifestText
$ins = New-Object System.Xml.XmlNamespaceManager($inside.NameTable)
$ins.AddNamespace('f','http://schemas.microsoft.com/appx/manifest/foundation/windows10')
$insideId = $inside.SelectSingleNode('/f:Package/f:Identity',$ins)
if ($null -eq $insideId) { Fail 'Identity nao encontrada dentro do MSIX.' }
$checks = @(
    @('Name', [string]$insideId.Name, $ExpectedName),
    @('Publisher', [string]$insideId.Publisher, $ExpectedPublisher),
    @('Version', [string]$insideId.Version, $ExpectedVersion),
    @('ProcessorArchitecture', [string]$insideId.ProcessorArchitecture, $ExpectedArch)
)
foreach ($c in $checks) {
    if ($c[1] -ne $c[2]) { Fail "MSIX interno: $($c[0])='$($c[1])', esperado '$($c[2])'." }
    Write-Host ("  {0}: {1}" -f $c[0],$c[1]) -ForegroundColor Green
}
$hash = (Get-FileHash $Msix -Algorithm SHA256).Hash.ToLowerInvariant()
$size = (Get-Item $Msix).Length
"$hash  MarshMallow-Browser-5.0.0-x64.msix" | Set-Content $HashFile -Encoding ASCII
Write-Host "`nSHA-256: $hash"
Write-Host "Tamanho: $size bytes"
Write-Host "`n[LIBERADO PARA UPLOAD] A identidade interna confere com o Partner Center." -ForegroundColor Green
Write-Host "Arquivo: $Msix" -ForegroundColor Cyan
Write-Host "No Partner Center: Pacotes > browse your files > selecione este .msix." -ForegroundColor Yellow
Start-Process explorer.exe -ArgumentList "/select,`"$Msix`""
exit 0
