# MarshMallow 4.0.2 — Google Compatibility Test

Esta revisão existe para diagnosticar e reduzir falsos positivos de `google.com/sorry/` antes da criação do instalador final.

## Alteração principal

O MarshMallow 3.x/4.0.0 usava um User-Agent limpo globalmente. No 4.0.2 o Google recebe o User-Agent real do Chromium/Electron, mantendo os Client Hints do próprio runtime coerentes. Outros sites continuam podendo receber o User-Agent limpo do MarshMallow. Não há alteração de `Sec-CH-UA`, `navigator.webdriver`, CAPTCHA, IP, cookies externos ou qualquer mecanismo destinado a contornar antiabuso.

## Teste recomendado

1. Execute `INICIAR_MARSHMALLOW_4.0.2.bat`.
2. Abra `https://www.google.com/`.
3. Compare com Edge/Chrome em janela InPrivate na mesma rede.
4. Se possível, teste o MarshMallow uma vez usando o hotspot do celular.

### Interpretação

- Se Edge/Chrome InPrivate também mostrar `/sorry/`, o fator é a rede/IP público.
- Se no hotspot o MarshMallow funcionar, o fator é a rede/IP público.
- Se somente o MarshMallow mostrar `/sorry/` em redes diferentes, a causa restante é a arquitetura Chromium incorporada e deve ser tratada antes do instalador final.

## Login Google

Continua sendo aberto em navegador nativo, conforme o núcleo 4.0, porque autenticação Google dentro de navegador incorporado pode ser recusada pelo Google.
