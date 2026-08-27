$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$env:NO_COLOR = "1"
$env:FORCE_COLOR = "0"

function Put-Secret([string]$Name, [string]$Value) {
    if ([string]::IsNullOrWhiteSpace($Value)) {
        throw "$Name não pode ficar vazio."
    }

    Push-Location ".\backend"
    try {
        $old = $ErrorActionPreference
        try {
            $ErrorActionPreference = "Continue"
            $output = $Value | & npx.cmd wrangler secret put $Name 2>&1
            $code = $LASTEXITCODE
        } finally {
            $ErrorActionPreference = $old
        }
        $output | ForEach-Object { Write-Host "$_" }
        if ($code -ne 0) {
            throw "Não foi possível salvar $Name no Cloudflare Worker."
        }
    } finally {
        Pop-Location
    }
}

Write-Host ""
Write-Host "==============================================================" -ForegroundColor DarkGray
Write-Host " MARSHMALLOW 2.0 - CONFIGURAR LIVEKIT" -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Use os três valores do seu projeto LiveKit Cloud:" -ForegroundColor White
Write-Host "  Project URL  (wss://...livekit.cloud)" -ForegroundColor Gray
Write-Host "  API Key      (API...)" -ForegroundColor Gray
Write-Host "  API Secret" -ForegroundColor Gray
Write-Host ""
Write-Host "O API Secret ficará somente como segredo criptografado do Worker." -ForegroundColor Green
Write-Host "Ele NÃO é salvo no frontend nem enviado aos convidados." -ForegroundColor Green
Write-Host ""

$LiveKitUrl = Read-Host "LIVEKIT_URL"
$LiveKitKey = Read-Host "LIVEKIT_API_KEY"
$SecretSecure = Read-Host "LIVEKIT_API_SECRET" -AsSecureString
$BSTR = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecretSecure)
try {
    $LiveKitSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($BSTR)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
}

if ($LiveKitUrl -notmatch '^wss?://') {
    throw "LIVEKIT_URL deve começar com wss:// (ou ws:// em servidor local)."
}

Write-Host ""
Write-Host "[1/3] Salvando LIVEKIT_URL..." -ForegroundColor Cyan
Put-Secret "LIVEKIT_URL" $LiveKitUrl

Write-Host ""
Write-Host "[2/3] Salvando LIVEKIT_API_KEY..." -ForegroundColor Cyan
Put-Secret "LIVEKIT_API_KEY" $LiveKitKey

Write-Host ""
Write-Host "[3/3] Salvando LIVEKIT_API_SECRET..." -ForegroundColor Cyan
Put-Secret "LIVEKIT_API_SECRET" $LiveKitSecret

Write-Host ""
Write-Host "Credenciais LiveKit configuradas." -ForegroundColor Green
Write-Host "Agora execute PUBLICAR_MARSHMALLOW_2.0.0.bat." -ForegroundColor Cyan
Write-Host ""
Read-Host "Pressione ENTER para fechar"
