# MarshMallow 3.3.8 — Google sem popup do MarshMallow

Esta revisão remove a janela própria que oferecia **Resolver no Google / Pesquisar no Brave / Pesquisar no Bing** quando o Google redirecionava para `/sorry/`.

Agora o MarshMallow deixa a página de verificação do Google aparecer sem interferência. Ele não tenta burlar reCAPTCHA nem trocar o mecanismo de pesquisa automaticamente.

A proteção contra persistência continua ativa: páginas temporárias `google.com/sorry/` não são usadas como destino de restauração de sessão/aba fechada.

## Importante sobre “tráfego incomum”

A mensagem é emitida pelo Google e pode ser causada pela reputação do IP/rede, VPN/proxy, CGNAT ou tráfego automatizado vindo de outros dispositivos que compartilham o mesmo IP público. Se a mesma mensagem aparecer no Edge/Chrome da mesma máquina e rede, não é um defeito específico do MarshMallow.

Se ocorrer apenas no MarshMallow, compare com Edge/Chrome na mesma máquina e informe o resultado para investigarmos compatibilidade/fingerprint do Chromium.
