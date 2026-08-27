# MarshMallow 3.0.6 — Browser Guard + Guest Volume

## Volume do convidado
- volume inicial: 30%;
- slider 0–100%;
- valor lembrado no navegador do convidado;
- todas as novas tracks de áudio recebem o volume escolhido.

## Google
- remove o token `Electron/x.y.z` do User-Agent das páginas;
- aplica User-Agent de Chromium/Chrome normal no app, sessão e abas;
- buscas digitadas na barra passam a usar Brave Search;
- `google.com` continua acessível.

A tela "tráfego incomum" do Google pode depender do IP/rede. Esta versão não
tenta contornar CAPTCHA.

## Pop-up Guard
Antes, todo `window.open()` era convertido em aba MarshMallow.

Agora:
- popup JavaScript automático cross-site é negado;
- gestos explícitos de aba continuam funcionando em páginas comuns;
- sites de anime usam política mais rígida;
- redirecionamento top-level cross-site disparado pela própria página também
  é bloqueado nesses sites;
- aparece um toast discreto quando algo é bloqueado.

Proteção inicial:
animefire.io, animefire.net, animefire.plus, animesonlinecc.to,
animesonline.cc, goyabu.io, anroll.plus, sushianimes.com.br,
donghuanosekai.com.

## Uso
Extraia sobre `C:\MarshMallow-Electron`.

Execute:
`npm run electron:dev`

Para aplicar o novo controle de volume ao link do convidado:
`PUBLICAR_BACKEND_3.0.6.bat`
