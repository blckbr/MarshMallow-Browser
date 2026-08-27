param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUrl
)

$ErrorActionPreference = 'Stop'
$base = $BaseUrl.TrimEnd('/')
$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

function Show-HttpFailure {
    param([System.Management.Automation.ErrorRecord]$ErrorRecord)
    Write-Host ''
    Write-Host '[ERRO] A requisicao ao backend falhou.' -ForegroundColor Red
    Write-Host ('Mensagem: ' + $ErrorRecord.Exception.Message) -ForegroundColor Red
    if ($ErrorRecord.ErrorDetails -and $ErrorRecord.ErrorDetails.Message) {
        Write-Host 'Detalhe retornado pelo Worker:' -ForegroundColor Yellow
        Write-Host $ErrorRecord.ErrorDetails.Message
    }

    try {
        if ($ErrorRecord.Exception.Response) {
            $status = [int]$ErrorRecord.Exception.Response.StatusCode
            Write-Host ('HTTP: ' + $status) -ForegroundColor Red
            $stream = $ErrorRecord.Exception.Response.GetResponseStream()
            if ($stream) {
                $reader = New-Object System.IO.StreamReader($stream)
                $body = $reader.ReadToEnd()
                if ($body) {
                    Write-Host 'Resposta do servidor:' -ForegroundColor Yellow
                    Write-Host $body
                }
            }
        }
    } catch {
        # A mensagem principal acima ja e suficiente.
    }
}

try {
    Write-Host ('Validando: ' + $base)

    $health = Invoke-RestMethod -Uri ($base + '/health?_mm=' + $stamp) -Method Get -TimeoutSec 30 -Headers @{'Cache-Control'='no-cache'}
    if (-not $health.ok) { throw 'Health falhou.' }
    if ($health.backendVersion -ne '3.2.2') { throw ('Backend publicado nao e 3.2.2. Recebido: ' + $health.backendVersion) }
    if (-not $health.accountsConfigured) { throw 'Binding ACCOUNTS nao foi ativado.' }
    if (-not $health.workersAiConfigured) { throw 'Workers AI binding nao foi ativado.' }

    Write-Host ('[OK] Backend: ' + $health.backendVersion) -ForegroundColor Green
    Write-Host ('[OK] AI provider: ' + $health.aiProvider) -ForegroundColor Green
    Write-Host ('[OK] Modelo: ' + $health.model) -ForegroundColor Green

    $ping = Invoke-RestMethod -Uri ($base + '/api/auth/ping?_mm=' + $stamp) -Method Get -TimeoutSec 30 -Headers @{'Cache-Control'='no-cache'}
    if (-not $ping.ok) { throw 'Autoteste do AccountStore falhou.' }
    if ($ping.registry -ne 'v3.2.2') { throw ('Registro de contas incorreto: ' + $ping.registry) }
    if ($ping.recovery -ne 'SHA-256') { throw ('Autoteste de recuperacao falhou: ' + $ping.recovery) }

    Write-Host ('[OK] AccountStore: ' + $ping.storage + ' / ' + $ping.crypto + ' / recovery ' + $ping.recovery) -ForegroundColor Green

    $authOk = $false
    try {
        $session = Invoke-WebRequest -Uri ($base + '/api/auth/session?_mm=' + $stamp) -Method Get -TimeoutSec 20 -Headers @{'Cache-Control'='no-cache'} -UseBasicParsing
        if ([int]$session.StatusCode -eq 401) { $authOk = $true }
    } catch {
        if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 401) {
            $authOk = $true
        } else {
            throw
        }
    }

    if (-not $authOk) { throw 'Rota de contas nao exigiu sessao como esperado.' }
    Write-Host '[OK] Cadastro/login/recuperacao online ativos' -ForegroundColor Green
    exit 0
} catch {
    Show-HttpFailure -ErrorRecord $_
    exit 1
}
