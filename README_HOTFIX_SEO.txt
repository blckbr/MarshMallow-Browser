MarshMallow 5.0.0 - Hotfix do verificador SEO

Motivo:
O deploy do Cloudflare foi concluido, mas o verificador da home dependia de um titulo contendo um travessao Unicode. No Windows PowerShell 5.1, a resposta UTF-8 pode ser interpretada com mojibake e causar um falso FAIL mesmo com HTTP 200 e o site novo publicado.

O que este hotfix faz:
1. Corrige o verificador original para usar marcadores ASCII/estruturais.
2. Adiciona CONFIRMAR_SITE_SEO_GOOGLE_5.0.0.bat, que SOMENTE verifica o site publico.
3. O CONFIRMAR nao faz deploy, nao recompila, nao altera GitHub e nao envia instalador.

Como usar agora:
1. Extraia este ZIP sobre a raiz do MarshMallow 5.0.0 R14 e permita substituir os arquivos.
2. Execute CONFIRMAR_SITE_SEO_GOOGLE_5.0.0.bat.
3. Se der SUCESSO, o deploy SEO anterior ja esta valido e nao e necessario republicar.
4. Se der FALHA, envie CONFIRMACAO_SITE_SEO_5.0.0.log ao ChatGPT.

Nao execute o publicador novamente antes de testar o CONFIRMAR.
