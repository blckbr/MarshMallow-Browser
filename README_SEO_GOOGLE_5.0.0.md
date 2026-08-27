# MarshMallow 5.0.0 — Patch SEO Google gratuito

Patch para a base R14 do MarshMallow Browser.

## Aplicação

Extraia o ZIP sobre a pasta raiz da base R14 e execute:

`REPUBLICAR_SITE_SEO_GOOGLE_5.0.0.bat`

Digite `SEO` para confirmar.

O publicador altera somente o site do Cloudflare Pages. Ele não recompila o navegador, não faz git push, não cria/edita GitHub Release e não reenvia o instalador.

Depois da publicação, siga `GUIA_GOOGLE_SEARCH_CONSOLE.md`. A etapa de propriedade do Search Console precisa ser concluída na conta Google responsável pelo site, pois o token de verificação pertence à conta.

## Validação incluída

`tests/site-seo.test.mjs` verifica metadados, canonical, dados estruturados, idiomas, segurança, sitemap, robots e o publicador SEO.
