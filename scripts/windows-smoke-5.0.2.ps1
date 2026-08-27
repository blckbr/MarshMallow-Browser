param([string]$Root = (Split-Path -Parent $PSScriptRoot))
$Root = ([string]$Root).Trim().Trim([char[]]'"')
$Root = [IO.Path]::GetFullPath($Root)
if ($Root.Length -gt 3) { $Root = $Root.TrimEnd([char[]]'\/') }
$ErrorActionPreference='Stop'
$Version='5.0.2'
$BuildReport=Join-Path $Root 'BUILD_VALIDATION_5.0.2.json'
$SmokeReport=Join-Path $Root 'RUNTIME_SMOKE_5.0.2_PASS.json'
$Installer=Join-Path $Root "release\MarshMallow-Setup-$Version.exe"
if (-not (Test-Path $BuildReport) -or -not (Test-Path $Installer)) { throw 'Primeiro execute VALIDAR_E_COMPILAR_MARSHMALLOW_5.0.2.bat.' }
$build=Get-Content -Raw -LiteralPath $BuildReport | ConvertFrom-Json
$hash=(Get-FileHash -LiteralPath $Installer -Algorithm SHA256).Hash.ToLowerInvariant()
if (-not $build.buildPassed -or [string]$build.sha256 -ne $hash) { throw 'O instalador mudou ou o build report nao e valido. Recompile antes do smoke test.' }
if (Test-Path $SmokeReport) { Remove-Item $SmokeReport -Force }

Write-Host ''
Write-Host 'MARSHMALLOW 5.0.2 - SMOKE TEST OBRIGATORIO' -ForegroundColor Cyan
Write-Host 'Instale/abra o MarshMallow 5.0.2 gerado e confirme cada item com S somente se ele realmente funcionar.'
Write-Host 'Qualquer N bloqueia a publicacao.' -ForegroundColor Yellow
Write-Host ''

$checks=@(
  'Instalador com MarshMallow aberto: deixe o navegador funcionando e execute novamente MarshMallow-Setup-5.0.2.exe. O navegador deve salvar a sessao, fechar automaticamente e a instalacao deve continuar SEM a caixa tecnica "MarshMallow esta funcionando / Clique OK para fechar". Ao abrir depois, a sessao normal deve permanecer.',
  'Toolbar: voltar, avancar, recarregar, omnibox, Modo Jogo, Downloader, Extensoes e menu aparecem em UMA linha sem botoes cortados.',
  'Menu de tres pontos: abra o menu ... sobre uma pagina externa. Todos os itens, inclusive Configuracoes, devem ficar totalmente visiveis e clicaveis; a pagina deve recuar para baixo enquanto o menu estiver aberto e voltar ao normal ao fechar.',
  'Wallpaper: em um site normal, clique na barra de endereco e abra as sugestoes. O wallpaper da Nova Aba NAO pode aparecer na area exposta; ele deve existir somente em marshmallow://newtab.',
  'Pop-ups confiaveis: em um site que abra uma janela legitima, confirme que o modo Inteligente mostra Abrir desta vez e Sempre permitir neste site; ao confiar no site, a permissao persiste e pode ser removida em Configuracoes -> Abas e navegacao.',
  'Aviso temporario/toast: execute uma acao que mostre uma mensagem temporaria do MarshMallow. O aviso deve aparecer na area superior do chrome do navegador e nunca ficar escondido atras da pagina.',
  'Autocomplete: visite https://example.com/docs, depois outra pagina; Ctrl+L e digite exam. A pagina visitada Example Docs aparece como sugestao. Continue digitando para confirmar que a lista atualiza a cada tecla e teste setas/Tab/Enter/Esc.',
  'Historico: na MESMA aba visite pelo menos 3 paginas. Clique normal em voltar/avancar navega 1 pagina; segurar ~450 ms ou botao direito abre a lista correta. Feche e abra o menu uma segunda vez depois de navegar para confirmar que a lista atualiza; selecionar uma entrada salta diretamente.',
  'Google: faca uma busca normal; em pelo menos 3 resultados, clique UMA UNICA VEZ no link para um site externo. Cada primeiro clique deve abrir/navegar imediatamente; duplo clique nao pode ser necessario e nenhum clique pode apenas recarregar ou manter a pagina de resultados.',
  'Downloader: no YouTube ou outro player adaptativo, abrir o painel nao corta nem cobre o conteudo do painel; a pagina e redimensionada ao lado.',
  'Downloads normais: Ctrl+J abre a lista; um arquivo comum mostra progresso e permite pausar/continuar/cancelar quando suportado, e itens concluidos ficam no historico com Abrir/Pasta.',
  'MarshMallow Downloader Manager: Configuracoes -> Downloads mostra Gerenciador integrado como padrao e o Downloader Manager como opcional; enquanto estiver em desenvolvimento nao existe link morto nem encaminhamento forcado.',
  'Deteccao de midia: em pagina de video observavel, o detector encontra trafego de VIDEO alem de audio quando o site realmente o expoe; HLS/DASH/MediaSource sao identificados sem tentar contornar DRM.',
  'Modo Jogo: em um jogo HTML5/WebGL, Automático/Ativado/Desativado funciona, fullscreen e controles solicitados pelo jogo funcionam, e a preferencia fica por dominio.',
  'Segundo plano: com Modo Jogo ativo e economia desligada, o jogo continua executando ao trocar de aba; ativar Economizar recursos restaura a politica economica.',
  'Extensoes e privacidade: pagina de extensoes abre; uma aba privada abre separada e nao entra na restauracao/historico persistente.',
  'Sessao: feche e reabra o MarshMallow e confirme que abas normais configuradas para restauracao retornam sem restaurar abas privadas.',
  'Encerramento: feche completamente o MarshMallow e aguarde alguns segundos. O processo deve terminar sem nenhuma janela de erro JavaScript, sem sequencia de dialogs e sem processo preso em segundo plano.',
  'Watch Together: abra o painel e inicie uma transmissao em uma pagina longa; a pagina continua permitindo rolagem para cima/baixo com a roda do mouse e barra de rolagem, sem o player forcar overflow hidden na pagina.',
  'Botao do meio do mouse: em uma pagina longa, clique com a rodinha em area vazia e confirme o autoscroll; em um link, middle-click abre a pagina em uma nova aba de segundo plano.',
  'Watch Together e IA: os paineis abrem/fecham sem cobrir incorretamente a pagina e as funcoes basicas existentes continuam acessiveis.',
  'PDF Reader: na Nova Aba, o botao vermelho PDF Reader aparece logo abaixo de Watch Together. Abra um arquivo PDF local pelo seletor e confirme leitura, miniaturas, zoom, busca, impressao e Salvar copia; depois abra um PDF pela web e confirme que ele abre em uma aba PDF Reader sem travar o PC. O modulo nao deve exibir ferramentas de edicao.',
  'Apoio: o coracao abre a pagina interna com somente APOIA.se, Ko-fi e Buy Me a Coffee; nenhum pedido de apoio aparece sozinho.',
  'Desempenho/Atualizacao: marshmallow://performance mostra dados reais da GPU/recursos; Sobre/atualizacao nao instala nada silenciosamente.'
)
$results=@()
foreach($check in $checks){
  Write-Host ''
  Write-Host ('TESTE: '+$check)
  $answer=Read-Host 'Passou? Digite S ou N'
  $ok=($answer -match '^[sS]$')
  $results += [pscustomobject]@{ check=$check; passed=$ok }
  if(-not $ok){
    Write-Host 'Smoke test reprovado. A publicacao permanece bloqueada.' -ForegroundColor Red
    exit 1
  }
}
$report=[ordered]@{version=$Version;pass=$true;installer=[IO.Path]::GetFileName($Installer);size=[int64](Get-Item $Installer).Length;sha256=$hash;testedAt=(Get-Date).ToUniversalTime().ToString('o');checks=$results}
$report|ConvertTo-Json -Depth 6|Set-Content -LiteralPath $SmokeReport -Encoding UTF8
Write-Host ''
Write-Host 'PASS: smoke test registrado. O publicador agora pode aceitar este EXE/hash.' -ForegroundColor Green
