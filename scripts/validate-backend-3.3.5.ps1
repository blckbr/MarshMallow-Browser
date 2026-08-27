param(
  [Parameter(Mandatory=$true)][string]$BaseUrl,
  [switch]$RequireGemini,
  [int]$WaitSeconds = 90
)
$ErrorActionPreference = 'Stop'
$BaseUrl = $BaseUrl.TrimEnd('/')

function Get-Health() {
  $stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $url = "$BaseUrl/health?nocache=$stamp"
  $r = Invoke-WebRequest -UseBasicParsing -Uri $url -Headers @{ 'Cache-Control'='no-cache'; 'Pragma'='no-cache' } -TimeoutSec 30
  return ($r.Content | ConvertFrom-Json)
}

function Post-Json([string]$Url, $Body) {
  $json = $Body | ConvertTo-Json -Depth 8 -Compress
  $r = Invoke-WebRequest -UseBasicParsing -Method Post -Uri $Url -ContentType 'application/json' -Headers @{ 'Cache-Control'='no-cache' } -Body $json -TimeoutSec 90
  return ($r.Content | ConvertFrom-Json)
}

Write-Host "Validando: $BaseUrl"
$deadline = (Get-Date).AddSeconds([Math]::Max(10,$WaitSeconds))
$health = $null
$lastSummary = ''
do {
  try {
    $health = Get-Health
    $lastSummary = "backend=$($health.backendVersion); gemini=$($health.geminiConfigured); provider=$($health.aiProvider)"
    $versionOk = ([string]$health.backendVersion -eq '3.3.5')
    $geminiOk = (-not $RequireGemini) -or [bool]$health.geminiConfigured
    if ($health.ok -and $versionOk -and $geminiOk) { break }
  } catch {
    $lastSummary = $_.Exception.Message
  }
  Start-Sleep -Seconds 3
} while ((Get-Date) -lt $deadline)

if (-not $health -or -not $health.ok) { throw "Health do backend retornou falha. Ultimo estado: $lastSummary" }
if ([string]$health.backendVersion -ne '3.3.5') { throw "Backend publicado ainda e $($health.backendVersion), esperado 3.3.5." }
Write-Host "[OK] Backend: $($health.backendVersion)"
Write-Host "[OK] Provedor principal: $($health.aiProvider)"
Write-Host "[OK] Modelo: $($health.model)"
if ($health.aiFallbackProvider) { Write-Host "[OK] Fallback: $($health.aiFallbackProvider)" }

if ($RequireGemini -and -not $health.geminiConfigured) {
  throw "GEMINI_API_KEY aparece no Wrangler, mas ainda nao chegou ao runtime depois de $WaitSeconds s. Ultimo estado: $lastSummary"
}

$probe = Post-Json "$BaseUrl/api/ai" @{
  prompt = 'Responda em uma frase curta: qual e a capital do Brasil?'
  messages = @()
  tabs = @()
  groups = @()
  permissions = @{}
}
$reply = [string]$probe.reply
if ([string]::IsNullOrWhiteSpace($reply)) { throw 'A IA respondeu sem texto.' }
if ($reply -match '\[object Object\]') { throw 'A IA ainda retornou [object Object].' }
Write-Host "[OK] Pergunta geral respondida: $reply"
if ($probe.provider) { Write-Host "[OK] Resposta servida por: $($probe.provider)" }

$identity = Post-Json "$BaseUrl/api/ai" @{
  prompt = 'Quem e o criador e desenvolvedor do MarshMallow?'
  messages = @()
  tabs = @()
  groups = @()
  permissions = @{}
}
$identityReply = [string]$identity.reply
if ($identityReply -notmatch 'Deivison Santos' -or $identityReply -notmatch '@devsaex') {
  throw "Autoria oficial nao foi retornada corretamente: $identityReply"
}
Write-Host "[OK] Autoria oficial: $identityReply"

Write-Host '[OK] MarshMallow AI geral esta operacional.'
exit 0
