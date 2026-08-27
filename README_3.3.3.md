# MarshMallow 3.3.3 — IA e chat

## Interface
- MarshMallow AI: Enter envia; Shift+Enter cria nova linha.
- MarshMallow AI: a conversa rola automaticamente para a mensagem mais recente.
- Watch Together (host): o chat rola automaticamente para a mensagem mais recente.
- Watch Together: Enter continua enviando mensagens tanto no host quanto na página do convidado.

## Correção de `[object Object]`
O backend agora normaliza respostas textuais mesmo quando um provedor/modelo devolve um objeto aninhado. O parser aceita JSON puro, JSON cercado por markdown e respostas textuais normais sem exibir `[object Object]` ao usuário.

## Provedores de IA
- Clima continua usando Open-Meteo diretamente.
- Se `GEMINI_API_KEY` estiver configurada no Cloudflare Worker, Gemini (`gemini-3.5-flash-lite`) é o provedor principal.
- Workers AI (`@cf/meta/llama-3.1-8b-instruct-fast`) fica como fallback automático.
- Sem Gemini configurado, Workers AI continua respondendo perguntas gerais.

## Publicação
1. Execute `PUBLICAR_BACKEND_3.3.3.bat` para publicar o parser/roteamento novo.
2. Se desejar Gemini como principal, execute `ATIVAR_GEMINI_3.3.3.bat` e informe a API Key somente ao Wrangler.
3. Abra `INICIAR_MARSHMALLOW_DIRETO.bat`.

A API Key do Gemini fica como Secret no Cloudflare Worker e não é embutida no aplicativo distribuído.
