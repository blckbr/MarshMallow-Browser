$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Read-Optional([object]$Object, [string]$Name) {
    $p = $Object.PSObject.Properties[$Name]
    if ($null -eq $p) { return '' }
    return [string]$p.Value
}

# Reproduz o formato heterogeneo do registro de desinstalacao.
$entries = @(
    [pscustomobject]@{ PSPath='fake:1'; UninstallString='x' },
    [pscustomobject]@{ DisplayName='Outro App'; DisplayIcon='C:\\Outro.exe' },
    [pscustomobject]@{ DisplayName='MarshMallow Browser'; InstallLocation='C:\\FakeMarshMallow' }
)

$names = @()
foreach ($entry in $entries) {
    $displayName = Read-Optional $entry 'DisplayName'
    if ($displayName -like '*MarshMallow*') { $names += $displayName }
    [void](Read-Optional $entry 'InstallLocation')
    [void](Read-Optional $entry 'DisplayIcon')
}
if ($names.Count -ne 1 -or $names[0] -ne 'MarshMallow Browser') {
    throw 'Falha no teste de propriedades opcionais do Registro.'
}
Write-Host '[OK] Registro heterogeneo nao quebra sob StrictMode.' -ForegroundColor Green
exit 0
