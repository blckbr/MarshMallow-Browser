# MarshMallow 3.3.0 — Central de Configurações

A 3.3.0 transforma o antigo painel curto de configurações em uma central organizada e pesquisável,
inspirada nas áreas de configuração presentes nos navegadores desktop mais usados.

## Configurações funcionais nesta versão

- Perfil e identidade local.
- Inicialização: continuar sessão, nova guia, página inicial ou conjunto de páginas.
- Página inicial e página de nova guia personalizáveis.
- Mecanismo de pesquisa: Brave Search, Google, Bing, DuckDuckGo ou Ecosia.
- Aparência: abas compactas, escala da interface, zoom padrão dos sites, fonte padrão/mínima e animações de imagens.
- Pop-ups: inteligente, bloquear ou permitir.
- Reprodução automática com ou sem exigência de interação.
- Privacidade: DNT, Global Privacy Control, limpeza de cookies/cache/dados ao sair e política WebRTC/IP.
- Permissões globais: câmera, microfone, localização, notificações, área de transferência, MIDI e tela cheia.
- Downloads: perguntar onde salvar, pasta padrão e abertura rápida da pasta.
- Idiomas: corretor ortográfico, idiomas do corretor e Accept-Language.
- Desempenho: throttling de abas em segundo plano e aceleração por hardware.
- Sistema/rede: proxy do sistema, conexão direta ou proxy personalizado; atalho para navegador padrão do Windows.
- MarshMallow AI e Watch Together integrados à mesma central.
- Ferramentas avançadas: DevTools e limpeza de dados.

As preferências que precisam existir antes de o Chromium criar as abas são persistidas em
`browser-preferences.json` no diretório de dados do aplicativo. Algumas opções, como aceleração de
hardware, fonte padrão do Chromium e política de autoplay, podem exigir reinicialização completa.

## Próximas camadas já previstas pela interface

- Gerenciador de senhas e preenchimento automático.
- Extensões Chromium.
- Exceções de permissões por site.
- Proteção avançada contra rastreadores e cookies de terceiros.
- HTTPS-Only, DNS seguro e certificados.
- Perfis, importação e sincronização entre dispositivos.
- Descarte inteligente/economia de memória por aba.

O backend de contas permanece na versão 3.2.3 e não precisa ser republicado apenas por causa desta atualização de interface.
