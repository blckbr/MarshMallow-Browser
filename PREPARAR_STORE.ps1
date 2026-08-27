$ErrorActionPreference = 'Stop'

$Product = [ordered]@{
  ProductName = 'MarshMallow Browser'
  StoreId = '9PG75P9FT0JN'
  PackageIdentityName = 'Devsaex.MarshMallowBrowser'
  PackageIdentityPublisher = 'CN=523D70FB-BE15-4C20-AF5F-12A81A65BD6F'
  PublisherDisplayName = 'Devsaex'
  Creator = 'Deivison Santos / @devsaex'
  Version = '5.0.0.0'
  Architecture = 'x64'
  Price = 'Gratuito'
  Markets = 'Todos os mercados disponiveis'
  PrimaryCategory = 'Utilitarios + ferramentas'
  Website = 'https://marshmallow-browser-br.pages.dev/'
  Support = 'https://marshmallow-browser-br.pages.dev/apoie/'
  PrivacyPolicy = ''
}

$Desktop = [Environment]::GetFolderPath('Desktop')
$Out = Join-Path $Desktop 'MarshMallow-Store-Submission'
New-Item -ItemType Directory -Force -Path $Out | Out-Null

function Test-HttpUrl([string]$Url) {
  try {
    $r = Invoke-WebRequest -Uri $Url -Method Head -MaximumRedirection 5 -TimeoutSec 12 -UseBasicParsing
    return ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400)
  } catch {
    try {
      $r = Invoke-WebRequest -Uri $Url -Method Get -MaximumRedirection 5 -TimeoutSec 12 -UseBasicParsing
      return ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400)
    } catch { return $false }
  }
}

$websiteOk = Test-HttpUrl $Product.Website
$supportOk = Test-HttpUrl $Product.Support

$readme = @"
MARSHMALLOW BROWSER - MICROSOFT STORE
=====================================

Este kit prepara o PRIMEIRO envio do MarshMallow Browser.

IMPORTANTE:
- A primeira submissao ainda exige interacao no Partner Center.
- O questionario IARC/classificacao etaria deve ser respondido por voce.
- O script NAO inventa respostas legais e NAO envia para certificacao sozinho.
- Depois que a primeira submissao for criada, podemos automatizar futuras atualizacoes pela API oficial da Store.

IDENTIDADE OFICIAL RESERVADA
----------------------------
Nome do produto: $($Product.ProductName)
Store ID: $($Product.StoreId)
Package/Identity/Name: $($Product.PackageIdentityName)
Package/Identity/Publisher: $($Product.PackageIdentityPublisher)
PublisherDisplayName: $($Product.PublisherDisplayName)
Criador/desenvolvedor: $($Product.Creator)

VALIDACAO DE URLS
-----------------
Site: $($Product.Website) -> $(if($websiteOk){'OK'}else{'NAO CONFIRMADO'})
Suporte: $($Product.Support) -> $(if($supportOk){'OK'}else{'NAO CONFIRMADO'})

BLOQUEIO ATUAL
--------------
Politica de privacidade: ainda precisa de URL publica valida antes da certificacao caso o app acesse/colete/transmita informacoes pessoais.
Nao invente essa URL. Primeiro publique uma politica que descreva com precisao o comportamento real do MarshMallow.
"@
Set-Content -Path (Join-Path $Out '00-LEIA-ME.txt') -Value $readme -Encoding UTF8

$fields = @"
VALORES RECOMENDADOS - PRIMEIRO ENVIO
=====================================

PRECO E DISPONIBILIDADE
- Preco: Gratuito
- Avaliacao gratuita/trial: Nao aplicavel
- Mercados: Todos os mercados disponiveis
- Data de lancamento: Assim que passar na certificacao

PROPRIEDADES
- Categoria primaria: Utilitarios + ferramentas
- Subcategoria: deixar em branco se nao houver opcao adequada
- Categoria secundaria: deixar em branco
- Site: $($Product.Website)
- Suporte: $($Product.Support)
- Desenvolvido por: Deivison Santos / @devsaex
- Jogo: Nao
- Xbox: Nao

IDENTIDADE MSIX
- Name: $($Product.PackageIdentityName)
- Publisher: $($Product.PackageIdentityPublisher)
- PublisherDisplayName: $($Product.PublisherDisplayName)
- Version: $($Product.Version)
- Architecture: $($Product.Architecture)

NAO PREENCHER AUTOMATICAMENTE
- Classificacao etaria/IARC: responder conforme o comportamento real do navegador.
- Declaracoes legais/privacidade: confirmar somente apos revisar a politica de privacidade.
- Capacidades restritas: declarar apenas as que existirem realmente no manifesto MSIX final.
"@
Set-Content -Path (Join-Path $Out '01-CAMPOS-PARTNER-CENTER.txt') -Value $fields -Encoding UTF8

$listing = @"
LISTAGEM PT-BR - MARSHMALLOW BROWSER
===================================

NOME
MarshMallow Browser

DESCRICAO CURTA
Navegador para Windows com interface Black Piano, abas verticais, organizacao de navegacao, Game Mode e ferramentas locais de midia.

DESCRICAO
MarshMallow Browser e um navegador desktop para Windows desenvolvido com foco em organizacao, personalizacao e recursos integrados. Ele combina navegacao baseada em Chromium com abas verticais, grupos, restauracao de sessao, historico, favoritos, modo privado, suporte a extensoes e ferramentas de produtividade.

Entre os recursos do MarshMallow estao Game Mode para jogos HTML5/WebGL/WebAssembly, Watch Together, diagnosticos de GPU/WebGL, gerenciamento de downloads com progresso, pausa, retomada e historico, alem de deteccao local de midia e integracao opcional com o MarshMallow Downloader Manager.

O navegador preserva os limites de seguranca do Chromium. Recursos de midia nao quebram DRM nem contornam protecoes de conteudo.

Criado e desenvolvido por Deivison Santos / @devsaex.

RECURSOS
- Abas verticais, grupos e restauracao de sessao
- Historico e favoritos
- Navegacao privada
- Extensoes Chromium e modo desenvolvedor
- Game Mode para jogos web modernos
- Watch Together
- Gerenciador de downloads integrado
- Deteccao de audio, video, HLS e DASH sem quebra de DRM
- Ferramentas locais de midia quando FFmpeg esta disponivel
- Interface e temas MarshMallow

PALAVRAS-CHAVE SUGERIDAS
browser, navegador, chromium, abas verticais, produtividade, downloads, web, marshmallow

COPYRIGHT
Copyright (c) 2026 Deivison Santos. Todos os direitos reservados.
"@
Set-Content -Path (Join-Path $Out '02-LISTAGEM-PT-BR.txt') -Value $listing -Encoding UTF8

$manifest = @"
<!-- Trecho de identidade para o AppxManifest.xml / Package.appxmanifest -->
<Identity
  Name="$($Product.PackageIdentityName)"
  Publisher="$($Product.PackageIdentityPublisher)"
  Version="$($Product.Version)"
  ProcessorArchitecture="$($Product.Architecture)" />

<Properties>
  <DisplayName>$($Product.ProductName)</DisplayName>
  <PublisherDisplayName>$($Product.PublisherDisplayName)</PublisherDisplayName>
</Properties>
"@
Set-Content -Path (Join-Path $Out '03-MSIX-IDENTIDADE.xml') -Value $manifest -Encoding UTF8

$checklist = @"
CHECKLIST DO PRIMEIRO ENVIO
===========================

[ ] 1. No Partner Center, clicar em "Iniciar envio".
[ ] 2. Preco = Gratuito.
[ ] 3. Mercados = todos os mercados desejados.
[ ] 4. Categoria = Utilitarios + ferramentas.
[ ] 5. Site oficial conferido.
[ ] 6. Politica de privacidade publicada e URL validada, se exigida.
[ ] 7. Responder TODO o questionario IARC manualmente e com verdade.
[ ] 8. Gerar o MSIX usando a identidade oficial deste kit.
[ ] 9. Executar Windows App Certification Kit no MSIX final.
[ ] 10. Fazer upload do pacote MSIX.
[ ] 11. Adicionar logos/screenshots da Store.
[ ] 12. Colar a listagem PT-BR deste kit e revisar visualmente.
[ ] 13. Revisar capacidades restritas declaradas no pacote.
[ ] 14. So entao clicar em "Enviar para certificacao".

NAO SUBMETER se qualquer validacao estiver vermelha ou se a politica de privacidade ainda nao estiver publicada.
"@
Set-Content -Path (Join-Path $Out '04-CHECKLIST.txt') -Value $checklist -Encoding UTF8

$config = [ordered]@{
  product = $Product
  validation = [ordered]@{
    website = $websiteOk
    support = $supportOk
    privacyPolicyReady = -not [string]::IsNullOrWhiteSpace($Product.PrivacyPolicy)
  }
}
$config | ConvertTo-Json -Depth 8 | Set-Content -Path (Join-Path $Out 'store-config.json') -Encoding UTF8

# Coloca o primeiro valor util no clipboard para evitar erro de digitacao.
Set-Clipboard -Value $Product.ProductName

Write-Host ''
Write-Host '[OK] Kit criado em:' -ForegroundColor Green
Write-Host "     $Out"
Write-Host ''
Write-Host "[INFO] Nome '$($Product.ProductName)' copiado para a area de transferencia."
if (-not $websiteOk) { Write-Host '[AVISO] Site oficial nao foi confirmado pela verificacao HTTP.' -ForegroundColor Yellow }
if (-not $supportOk) { Write-Host '[AVISO] URL de suporte nao foi confirmada pela verificacao HTTP.' -ForegroundColor Yellow }
Write-Host '[BLOQUEIO] Politica de privacidade ainda nao definida neste kit.' -ForegroundColor Yellow
Write-Host ''

Start-Process explorer.exe $Out
Start-Process 'https://partner.microsoft.com/dashboard'
