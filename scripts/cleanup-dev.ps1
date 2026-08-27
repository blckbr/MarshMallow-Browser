param(
  [Parameter(Mandatory=$false)]
  [string]$ProjectRoot = ""
)

$ErrorActionPreference = "SilentlyContinue"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

$root = [System.IO.Path]::GetFullPath($ProjectRoot).TrimEnd('\')
$markers = @(
  "scripts\\dev.mjs",
  "node_modules\\vite",
  "node_modules\\electron\\dist\\electron.exe"
)

$targets = Get-CimInstance Win32_Process | Where-Object {
  $name = [string]$_.Name
  $cmd = [string]$_.CommandLine
  if ([string]::IsNullOrWhiteSpace($cmd)) { return $false }
  if ($cmd.IndexOf($root, [System.StringComparison]::OrdinalIgnoreCase) -lt 0) { return $false }
  if ($name -notin @("node.exe", "electron.exe")) { return $false }

  foreach ($marker in $markers) {
    if ($cmd.IndexOf($marker, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
      return $true
    }
  }
  return $false
}

if (-not $targets) {
  Write-Host "Nenhum processo de desenvolvimento antigo do MarshMallow encontrado."
  exit 0
}

Write-Host "Encerrando somente processos antigos do MarshMallow deste projeto..."
foreach ($process in ($targets | Sort-Object ProcessId -Descending)) {
  $pidValue = [int]$process.ProcessId
  if ($pidValue -le 0) { continue }
  & taskkill.exe /PID $pidValue /T /F 2>$null | Out-Null
}

Start-Sleep -Milliseconds 700
Write-Host "Processos antigos encerrados. Cookies e dados de navegacao foram preservados."
exit 0
