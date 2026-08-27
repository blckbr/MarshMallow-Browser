# MarshMallow 3.3.7 — Google Verification Guard

Esta revisão trata com segurança a página `google.com/sorry/` ("tráfego incomum").

## O que mudou

- Mantém a correção anterior de User-Agent limpo, sem o token `Electron/x.y.z`.
- Não tenta contornar, automatizar ou burlar o reCAPTCHA do Google.
- Detecta quando o Google redireciona uma aba para `/sorry/`.
- Oferece as opções **Resolver no Google**, **Pesquisar no Brave** e **Pesquisar no Bing** quando a consulta original puder ser recuperada.
- Não grava a página `/sorry/` no histórico do MarshMallow.
- Não restaura automaticamente a página `/sorry/` na próxima abertura do navegador.
- Ao fechar uma aba de verificação, a reabertura usa o destino original (`continue`) quando disponível, nunca a própria página de bloqueio.

## Por que isso pode aparecer

A mensagem é decidida pelo Google com base no tráfego que ele associa à rede/IP. Ela pode ocorrer em redes compartilhadas, CGNAT, VPN/proxy ou quando há muitas solicitações originadas do mesmo endereço público. O navegador não deve tentar mascarar ou burlar essa verificação.

## Instalação

Não é necessário republicar o backend. Extraia por cima da pasta atual e execute `INICIAR_MARSHMALLOW_DIRETO.bat`.
