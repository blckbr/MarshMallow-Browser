# MarshMallow 3.3.4 — Gemini Secret Fix

Correção específica da ativação do Gemini no Cloudflare Worker.

## O que foi corrigido

- `wrangler secret put GEMINI_API_KEY` já cria e publica uma nova versão do Worker. O ativador antigo executava um `wrangler deploy` imediatamente depois; a 3.3.4 remove esse segundo deploy.
- A ativação agora confirma o Secret com `wrangler secret list --format json`.
- O validador usa cache-buster e aguarda até 90 segundos pela propagação do novo binding.
- O endpoint de IA inclui `provider` e `model` na resposta para diagnóstico.
- Workers AI continua sendo fallback automático e continua funcionando sem Gemini.

## Como usar

1. Extraia por cima de `C:\MarshMallow-Electron`.
2. Execute `ATIVAR_GEMINI_3.3.4.bat`.
3. Cole a chave apenas no prompt seguro do Wrangler.
4. Aguarde a confirmação `[OK] GEMINI_API_KEY consta na lista remota de Secrets` e a validação do Gemini.

Não compartilhe a API Key no chat.
