param(
  [Parameter(Mandatory=$true)][string]$BaseUrl,
  [switch]$RequireGemini
)
$ErrorActionPreference = 'Stop'
$BaseUrl = $BaseUrl.TrimEnd('/')

function Get-Json([string]$Url) {
  $r = Invoke-WebRequest -UseBasicParsing -Uri $Url -Headers @{ 'Cache-Control'='no-cache' } -TimeoutSec 30
  return ($r.Content | ConvertFrom-Json)
}

function Post-Json([string]$Url, $Body) {
  $json = $Body | ConvertTo-Json -Depth 8 -Compress
  $r = Invoke-WebRequest -UseBasicParsing -Method Post -Uri $Url -ContentType 'application/json' -Body $json -TimeoutSec 90
  return ($r.Content | ConvertFrom-Json)
}

Write-Host "Validando: $BaseUrl"
$health = Get-Json "$BaseUrl/health"
if (-not $health.ok) { throw 'Health do backend retornou falha.' }
if ([string]$health.backendVersion -ne '3.3.3') { throw "Backend publicado ainda e $($health.backendVersion), esperado 3.3.3." }
Write-Host "[OK] Backend: $($health.backendVersion)"
Write-Host "[OK] Provedor principal: $($health.aiProvider)"
Write-Host "[OK] Modelo: $($health.model)"
if ($health.aiFallbackProvider) { Write-Host "[OK] Fallback: $($health.aiFallbackProvider)" }

if ($RequireGemini -and -not $health.geminiConfigured) {
  throw 'GEMINI_API_KEY nao ficou configurada no Worker.'
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
Write-Host "[OK] MarshMallow AI geral esta operacional."
exit 0
