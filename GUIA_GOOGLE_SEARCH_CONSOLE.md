# MarshMallow 5.0.0 — Google Search Console

Este pacote prepara o site para descoberta e indexação orgânica do Google sem anúncios pagos.

## 1. Publicar o SEO

1. Extraia este patch sobre a pasta raiz do MarshMallow 5.0.0 R14, permitindo substituir os arquivos com o mesmo nome.
2. Execute `REPUBLICAR_SITE_SEO_GOOGLE_5.0.0.bat`.
3. Digite `SEO` quando solicitado.
4. O publicador executa os testes SEO, confere o instalador e a Release existente apenas para não regredir os metadados de download, e publica somente `MarshMallow-Official-Website-5.0.0\site` no Cloudflare Pages.
5. Em caso de sucesso, o próprio script confirma publicamente a home, `robots.txt`, `sitemap.xml`, `/seguranca/` e o arquivo de verificação existente.

O script NÃO recompila o navegador, NÃO faz git push, NÃO cria Release e NÃO reenvia o instalador.

## 2. Adicionar ao Google Search Console

1. Entre no Google Search Console com a conta que ficará responsável pelo MarshMallow.
2. Adicione uma propriedade do tipo **Prefixo do URL** com exatamente:
   `https://marshmallow-browser-br.pages.dev/`
3. Escolha **Arquivo HTML** como método de verificação.
4. O site já contém `googlecb101239684b3450.html`. Se o Search Console apresentar exatamente esse mesmo arquivo/token, basta confirmar que ele abre na raiz do site e clicar em **Verificar**.
5. Se o Search Console fornecer outro arquivo, use exatamente o arquivo oferecido pela sua conta: não renomeie nem altere o conteúdo. Copie-o para `MarshMallow-Official-Website-5.0.0\site\`, execute novamente o publicador SEO e depois clique em **Verificar**. Tokens de verificação são vinculados à conta do Google.

## 3. Enviar o sitemap

Na propriedade já verificada, abra **Sitemaps** e envie:

`sitemap.xml`

Endereço completo:
`https://marshmallow-browser-br.pages.dev/sitemap.xml`

## 4. Solicitar indexação das páginas principais

Na ferramenta **Inspeção de URL**, teste e solicite indexação destas páginas, nesta ordem:

- `https://marshmallow-browser-br.pages.dev/`
- `https://marshmallow-browser-br.pages.dev/download/`
- `https://marshmallow-browser-br.pages.dev/recursos/`
- `https://marshmallow-browser-br.pages.dev/seguranca/`
- `https://marshmallow-browser-br.pages.dev/changelog/`
- `https://marshmallow-browser-br.pages.dev/en/`

Não é necessário solicitar todas manualmente: o sitemap existe justamente para ajudar o Google a descobrir o conjunto de URLs.

## 5. O que foi preparado para o Google

- Nome consistente **MarshMallow Browser** na home, `WebSite` JSON-LD, `og:site_name`, título e H1.
- `SoftwareApplication` com categoria `BrowserApplication`, Windows, versão 5.0.0 e preço zero.
- Favicon 192×192 como ícone principal para rastreamento.
- Títulos, descrições, canonical, Open Graph e Twitter metadata únicos nas páginas públicas.
- `hreflang` pt-BR/en/x-default entre as homes portuguesa e inglesa.
- `robots.txt` liberando rastreamento e anunciando o sitemap.
- `sitemap.xml` limpo, com URLs indexáveis e `lastmod` significativo.
- Nova página `/seguranca/`, mais `/.well-known/security.txt`.
- 404 marcado como `noindex,follow`.
- Links para o repositório oficial e sinais consistentes de autoria/criação.

## Observação importante

SEO e Search Console não compram posição. O pacote elimina obstáculos técnicos e fornece sinais claros para o Google, mas indexação e posição continuam sendo decisões automáticas do mecanismo de pesquisa.
