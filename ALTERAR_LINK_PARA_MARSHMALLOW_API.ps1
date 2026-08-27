$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$Host.UI.RawUI.WindowTitle = "MarshMallow - migrar workers.dev para a marca"

function Banner([string]$Text) {
    Write-Host ""
    Write-Host "==============================================================" -ForegroundColor DarkGray
    Write-Host ("  " + $Text) -ForegroundColor Cyan
    Write-Host "==============================================================" -ForegroundColor DarkGray
}

function Require-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name nao foi encontrado no PATH."
    }
}

function Get-ApiErrorText($ErrorRecord) {
    $raw = $null
    try {
        if ($ErrorRecord.ErrorDetails -and $ErrorRecord.ErrorDetails.Message) {
            $raw = [string]$ErrorRecord.ErrorDetails.Message
        }
    } catch {}

    if ([string]::IsNullOrWhiteSpace($raw)) {
        try {
            $response = $ErrorRecord.Exception.Response
            if ($response) {
                $stream = $response.GetResponseStream()
                if ($stream) {
                    $reader = New-Object System.IO.StreamReader($stream)
                    try { $raw = $reader.ReadToEnd() } finally { $reader.Dispose() }
                }
            }
        } catch {}
    }

    if (-not [string]::IsNullOrWhiteSpace($raw)) {
        try {
            $json = $raw | ConvertFrom-Json
            if ($json.errors) {
                return (($json.errors | ForEach-Object {
                    if ($_.code) { "[$($_.code)] $($_.message)" } else { [string]$_.message }
                }) -join "; ")
            }
        } catch {}
        return $raw
    }

    return [string]$ErrorRecord.Exception.Message
}

function Invoke-CfApi([string]$Method, [string]$Uri, [hashtable]$Headers, $Body = $null) {
    if ($null -eq $Body) {
        return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers -TimeoutSec 45
    }
    return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers -ContentType "application/json" -Body ($Body | ConvertTo-Json -Compress) -TimeoutSec 45
}

function Select-AccountId([string]$WhoamiText) {
    $ids = @([regex]::Matches($WhoamiText, '(?i)\b[a-f0-9]{32}\b') | ForEach-Object { $_.Value.ToLowerInvariant() } | Select-Object -Unique)
    if ($ids.Count -eq 1) { return $ids[0] }
    if ($ids.Count -gt 1) {
        Write-Host ""
        Write-Host "O Wrangler encontrou mais de uma conta:" -ForegroundColor Yellow
        for ($i = 0; $i -lt $ids.Count; $i++) {
            Write-Host ("  [{0}] {1}" -f ($i + 1), $ids[$i])
        }
        while ($true) {
            $choice = Read-Host "Digite o numero da conta que contem marshmallow-gateway"
            $n = 0
            if ([int]::TryParse($choice, [ref]$n) -and $n -ge 1 -and $n -le $ids.Count) {
                return $ids[$n - 1]
            }
            Write-Host "Opcao invalida." -ForegroundColor Yellow
        }
    }

    Write-Host "Nao consegui detectar o Account ID automaticamente." -ForegroundColor Yellow
    $manual = (Read-Host "Cole o Account ID da Cloudflare (32 caracteres)").Trim()
    if ($manual -notmatch '^(?i)[a-f0-9]{32}$') {
        throw "Account ID invalido."
    }
    return $manual.ToLowerInvariant()
}

function Get-CurrentSubdomain([string]$Uri, [hashtable]$Headers) {
    try {
        $result = Invoke-CfApi -Method "GET" -Uri $Uri -Headers $Headers
        return [string]$result.result.subdomain
    }
    catch {
        $statusCode = $null
        try { $statusCode = [int]$_.Exception.Response.StatusCode } catch {}
        $detail = Get-ApiErrorText $_
        if ($statusCode -eq 404 -or $detail -match '(?i)not found|no subdomain|does not have') {
            return ""
        }
        throw "Nao consegui consultar o subdominio da conta. Cloudflare: $detail"
    }
}

function New-AccountSubdomain([string]$Name, [string]$Uri, [hashtable]$Headers, [int]$Attempts = 18) {
    $lastDetail = ""
    for ($i = 1; $i -le $Attempts; $i++) {
        try {
            $created = Invoke-CfApi -Method "PUT" -Uri $Uri -Headers $Headers -Body @{ subdomain = $Name }
            $confirmed = [string]$created.result.subdomain
            if ($confirmed -eq $Name) {
                return [pscustomobject]@{ Ok = $true; Name = $confirmed; Detail = "" }
            }
            $lastDetail = "A API respondeu, mas nao confirmou o nome solicitado."
        }
        catch {
            $lastDetail = Get-ApiErrorText $_

            # A exclusao do subdominio antigo pode levar alguns segundos para
            # propagar. Durante essa janela a API ainda responde 10036.
            if ($lastDetail -match '(?i)\[10036\]|already has an associated subdomain') {
                if ($i -lt $Attempts) {
                    Write-Host ("  aguardando a remocao anterior propagar... {0}/{1}" -f $i, $Attempts) -ForegroundColor DarkGray
                    Start-Sleep -Seconds 2
                    continue
                }
            }

            return [pscustomobject]@{ Ok = $false; Name = $Name; Detail = $lastDetail }
        }
    }

    return [pscustomobject]@{ Ok = $false; Name = $Name; Detail = $lastDetail }
}

function Restore-OldSubdomain([string]$OldName, [string]$Uri, [hashtable]$Headers) {
    if ([string]::IsNullOrWhiteSpace($OldName)) { return $true }
    Write-Host ""
    Write-Host ("Tentando restaurar imediatamente '" + $OldName + ".workers.dev'...") -ForegroundColor Yellow
    $restored = New-AccountSubdomain -Name $OldName -Uri $Uri -Headers $Headers -Attempts 25
    if ($restored.Ok) {
        Write-Host ("[OK] Subdominio anterior restaurado: " + $OldName + ".workers.dev") -ForegroundColor Green
        return $true
    }
    Write-Host "[ERRO CRITICO] Nao consegui restaurar automaticamente o subdominio anterior." -ForegroundColor Red
    Write-Host ("Cloudflare: " + $restored.Detail) -ForegroundColor Red
    Write-Host "Nao feche esta janela. Abra o painel/API da Cloudflare e recrie o subdominio anterior." -ForegroundColor Red
    return $false
}

Banner "MARSHMALLOW - REMOVER O NOME PESSOAL DO LINK"
Write-Host "O diagnostico foi corrigido nesta versao." -ForegroundColor Green
Write-Host "A API PUT nao renomeia um subdominio workers.dev que ja existe." -ForegroundColor White
Write-Host "Ela cria um subdominio somente quando a conta ainda nao possui um." -ForegroundColor White
Write-Host "Por isso o erro 10036 aparecia para TODOS os nomes testados." -ForegroundColor Yellow
Write-Host ""
Write-Host "A migracao correta sera:" -ForegroundColor Gray
Write-Host "  1. guardar o nome atual;" -ForegroundColor Gray
Write-Host "  2. excluir o subdominio da conta;" -ForegroundColor Gray
Write-Host "  3. criar o novo nome;" -ForegroundColor Gray
Write-Host "  4. se falhar, tentar restaurar automaticamente o anterior;" -ForegroundColor Gray
Write-Host "  5. republicar e testar o marshmallow-gateway." -ForegroundColor Gray
Write-Host ""
Write-Host "ATENCAO: durante alguns segundos os links *.workers.dev desta conta podem ficar indisponiveis." -ForegroundColor Yellow
Write-Host "A alteracao continua sendo da CONTA Cloudflare inteira." -ForegroundColor Yellow
Write-Host ""
$confirm = Read-Host "Digite MIGRAR para continuar"
if ($confirm.Trim().ToUpperInvariant() -ne "MIGRAR") {
    Write-Host "Cancelado. Nenhuma alteracao foi feita." -ForegroundColor Yellow
    exit 2
}

Require-Command "node"
Require-Command "npm.cmd"
Require-Command "npx.cmd"
if (-not (Test-Path (Join-Path $PSScriptRoot "backend\package.json"))) {
    throw "backend\package.json nao foi encontrado."
}

Write-Host ""
Write-Host "[1/8] Conferindo login do Wrangler..." -ForegroundColor Cyan
Push-Location (Join-Path $PSScriptRoot "backend")
try {
    $whoLines = @(& npx.cmd wrangler whoami 2>&1)
    if ($LASTEXITCODE -ne 0) {
        Write-Host "A sessao Cloudflare nao esta ativa. Abrindo login..." -ForegroundColor Yellow
        & npx.cmd wrangler login
        if ($LASTEXITCODE -ne 0) { throw "wrangler login falhou." }
        $whoLines = @(& npx.cmd wrangler whoami 2>&1)
        if ($LASTEXITCODE -ne 0) { throw "wrangler whoami falhou apos o login." }
    }
    $whoText = $whoLines -join [Environment]::NewLine
    $accountId = Select-AccountId $whoText
    Write-Host ("[OK] Account ID detectado: " + $accountId) -ForegroundColor Green
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "[2/8] Obtendo API Token..." -ForegroundColor Cyan
Write-Host "Use o mesmo Custom Token com:" -ForegroundColor Gray
Write-Host "  Account - Workers Scripts - Edit" -ForegroundColor White
Write-Host "O token fica apenas na memoria desta execucao." -ForegroundColor Green
Start-Process "https://dash.cloudflare.com/profile/api-tokens"
Write-Host ""
$secureToken = Read-Host "Cole o API Token aqui (a digitacao fica oculta)" -AsSecureString
$token = ([System.Net.NetworkCredential]::new("", $secureToken)).Password
if ([string]::IsNullOrWhiteSpace($token)) { throw "Token vazio." }
$headers = @{ Authorization = "Bearer $token"; Accept = "application/json" }

try {
    $subdomainUri = "https://api.cloudflare.com/client/v4/accounts/$accountId/workers/subdomain"

    Write-Host ""
    Write-Host "[3/8] Conferindo o subdominio atual..." -ForegroundColor Cyan
    $currentName = Get-CurrentSubdomain -Uri $subdomainUri -Headers $headers
    if ($currentName) {
        Write-Host ("Atual: " + $currentName + ".workers.dev") -ForegroundColor Gray
    } else {
        Write-Host "Atual: nenhum subdominio workers.dev configurado." -ForegroundColor Gray
    }

    $defaultDesired = "marshmallow-browser-br"
    $desired = ""
    while ($true) {
        Write-Host ""
        Write-Host "Digite SOMENTE o nome antes de .workers.dev." -ForegroundColor Gray
        Write-Host "Ex.: marshmallow-browser-br" -ForegroundColor Gray
        $desired = (Read-Host "Novo subdominio [$defaultDesired]").Trim().ToLowerInvariant()
        if (-not $desired) { $desired = $defaultDesired }
        if ($desired -match '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$') { break }
        Write-Host "Nome invalido. Nao escreva .workers.dev; use letras minusculas, numeros e hifen." -ForegroundColor Yellow
    }

    if ($currentName -eq $desired) {
        Write-Host ("[OK] A conta ja usa " + $desired + ".workers.dev") -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "[4/8] Preparando a troca atomica com rollback..." -ForegroundColor Cyan
        Write-Host ("Atual : " + $(if ($currentName) { $currentName + ".workers.dev" } else { "nenhum" })) -ForegroundColor Gray
        Write-Host ("Novo  : " + $desired + ".workers.dev") -ForegroundColor Gray
        Write-Host ""
        Write-Host "A Cloudflare nao oferece um endpoint de rename para uma conta que ja possui subdominio." -ForegroundColor Yellow
        Write-Host "O script precisa remover o atual e criar o novo. Se o novo falhar, tentara restaurar o atual." -ForegroundColor Yellow
        $finalConfirm = Read-Host "Digite TROCAR para executar esta etapa"
        if ($finalConfirm.Trim().ToUpperInvariant() -ne "TROCAR") {
            throw "Troca cancelada antes da exclusao. Nenhuma alteracao foi feita."
        }

        if ($currentName) {
            Write-Host ("Removendo temporariamente " + $currentName + ".workers.dev...") -ForegroundColor Cyan
            try {
                $null = Invoke-CfApi -Method "DELETE" -Uri $subdomainUri -Headers $headers
                Write-Host "[OK] Subdominio anterior removido da conta." -ForegroundColor Green
            }
            catch {
                $detail = Get-ApiErrorText $_
                throw "Nao foi possivel remover o subdominio atual. Nada foi recriado. Cloudflare: $detail"
            }
        }

        Write-Host ("Criando " + $desired + ".workers.dev...") -ForegroundColor Cyan
        $created = New-AccountSubdomain -Name $desired -Uri $subdomainUri -Headers $headers -Attempts 18
        if (-not $created.Ok) {
            Write-Host ""
            Write-Host ("A Cloudflare nao aceitou '" + $desired + "':") -ForegroundColor Red
            Write-Host ("  " + $created.Detail) -ForegroundColor Red
            $rollbackOk = Restore-OldSubdomain -OldName $currentName -Uri $subdomainUri -Headers $headers
            if ($rollbackOk) {
                throw "O novo nome foi recusado, mas o subdominio anterior foi restaurado com sucesso. Execute o script novamente e tente outro nome."
            }
            throw "O novo nome falhou E o rollback automatico tambem falhou. Intervencao manual necessaria."
        }

        $after = Get-CurrentSubdomain -Uri $subdomainUri -Headers $headers
        if ($after -ne $desired) {
            $rollbackOk = Restore-OldSubdomain -OldName $currentName -Uri $subdomainUri -Headers $headers
            if ($rollbackOk) {
                throw "A API nao confirmou o novo subdominio; o anterior foi restaurado."
            }
            throw "A API nao confirmou o novo subdominio e o rollback falhou."
        }
        Write-Host ("[OK] Novo subdominio da conta: " + $desired + ".workers.dev") -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "[5/8] Republicando marshmallow-gateway..." -ForegroundColor Cyan
    Push-Location (Join-Path $PSScriptRoot "backend")
    try {
        $deployLines = @(& npx.cmd wrangler deploy 2>&1)
        $deployCode = $LASTEXITCODE
        $deployLines | Tee-Object -FilePath (Join-Path $PSScriptRoot "MARSHMALLOW_BRANDED_LINK_DEPLOY.log") | ForEach-Object { Write-Host $_ }
        if ($deployCode -ne 0) { throw "wrangler deploy falhou. Veja MARSHMALLOW_BRANDED_LINK_DEPLOY.log." }
    }
    finally {
        Pop-Location
    }

    $workerName = "marshmallow-gateway"
    try {
        $wranglerText = Get-Content (Join-Path $PSScriptRoot "backend\wrangler.jsonc") -Raw
        $m = [regex]::Match($wranglerText, '"name"\s*:\s*"([^"]+)"')
        if ($m.Success) { $workerName = $m.Groups[1].Value }
    } catch {}

    Write-Host ""
    Write-Host "[6/8] Garantindo que o Worker usa workers.dev..." -ForegroundColor Cyan
    $scriptSubdomainUri = "https://api.cloudflare.com/client/v4/accounts/$accountId/workers/scripts/$workerName/subdomain"
    try {
        $enabledResult = Invoke-CfApi -Method "POST" -Uri $scriptSubdomainUri -Headers $headers -Body @{ enabled = $true; previews_enabled = $true }
        if ($enabledResult.result.enabled) {
            Write-Host "[OK] workers.dev habilitado para marshmallow-gateway." -ForegroundColor Green
        } else {
            Write-Host "A Cloudflare respondeu, mas o Worker ainda aparece com workers.dev desabilitado." -ForegroundColor Yellow
        }
    }
    catch {
        $detail = Get-ApiErrorText $_
        Write-Host ("Aviso: nao consegui confirmar o toggle workers.dev via API: " + $detail) -ForegroundColor Yellow
        Write-Host "O wrangler.jsonc ja possui workers_dev=true; o teste de /health abaixo sera a confirmacao final." -ForegroundColor Gray
    }

    $baseUrl = "https://$workerName.$desired.workers.dev"

    Write-Host ""
    Write-Host "[7/8] Aguardando o novo endereco responder..." -ForegroundColor Cyan
    $health = $null
    for ($i = 1; $i -le 30; $i++) {
        try {
            $health = Invoke-RestMethod -Uri ($baseUrl + "/health?_mm=" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) -Headers @{ "Cache-Control" = "no-cache,no-store"; Pragma = "no-cache" } -TimeoutSec 20
            if ($health.ok) { break }
        }
        catch {}
        Write-Host ("  tentativa " + $i + "/30...") -ForegroundColor DarkGray
        Start-Sleep -Seconds 3
    }
    if (-not $health -or -not $health.ok) {
        throw "O subdominio da conta foi alterado, mas o Worker ainda nao respondeu em: $baseUrl"
    }

    Set-Content (Join-Path $PSScriptRoot ".watch_backend_url") $baseUrl -Encoding ASCII
    Set-Content (Join-Path $PSScriptRoot ".env.local") ("VITE_MARSHMALLOW_API_URL=" + $baseUrl) -Encoding ASCII
    Set-Content (Join-Path $PSScriptRoot ".env.production") ("VITE_MARSHMALLOW_API_URL=" + $baseUrl) -Encoding ASCII
    Write-Host ("[OK] Backend aplicado localmente: " + $baseUrl) -ForegroundColor Green

    Write-Host ""
    Write-Host "[8/8] Criando um convite real de teste..." -ForegroundColor Cyan
    $room = Invoke-RestMethod -Uri ($baseUrl + "/api/rooms?_mm=" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) -Method Post -TimeoutSec 30
    if (-not $room.inviteUrl) { throw "O backend nao retornou inviteUrl." }
    $invite = [string]$room.inviteUrl
    if (-not $invite.StartsWith($baseUrl + "/", [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "O convite retornado nao usa o novo endereco: $invite"
    }

    Write-Host ""
    Banner "CONCLUIDO"
    Write-Host "O nome pessoal nao aparece mais no workers.dev." -ForegroundColor Green
    Write-Host ""
    Write-Host "Backend:" -ForegroundColor Gray
    Write-Host ("  " + $baseUrl) -ForegroundColor Cyan
    Write-Host "Convite de teste:" -ForegroundColor Gray
    Write-Host ("  " + $invite) -ForegroundColor Cyan
    Write-Host ""
    Write-Host "O MarshMallow foi atualizado localmente para usar esse endereco." -ForegroundColor Green
    Write-Host "Depois de confirmar o teste, gere novamente o instalador." -ForegroundColor Green
    Write-Host "Voce tambem pode revogar o API Token temporario no painel da Cloudflare." -ForegroundColor Gray
    try { Set-Clipboard -Value $invite; Write-Host "O convite de teste foi copiado para a area de transferencia." -ForegroundColor DarkGray } catch {}
}
finally {
    $token = $null
    $secureToken = $null
    $headers = $null
}
