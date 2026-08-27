# MarshMallow 4.0.12 — Premium New Tab

Esta versão refaz a experiência da nova aba para deixá-la no nível de um navegador de uso diário.

## Nova aba e wallpapers

- A nova aba continua limpa por padrão.
- O convite de personalização é discreto e não abre a galeria sozinho.
- **Surpreenda-me**: troca o wallpaper a cada nova aba.
- **Imagem do dia**: usa a mesma imagem durante o dia e muda no dia seguinte.
- **Imagem fixa**: mantém a escolhida pelo usuário.
- **Sem imagem**: mantém a nova aba minimalista.
- **Fotográfico (online)**: coleção curada de fotografias em alta resolução hospedadas pela Unsplash.
- **MarshMallow Studio (offline)**: 12 fundos incluídos no navegador, sem conexão externa.
- Imagem própria continua disponível.
- A ordem das sugestões é embaralhada para a galeria não parecer estática.
- Miniaturas online usam resolução reduzida; a imagem em alta resolução só é carregada quando efetivamente usada.
- Se uma fotografia online falhar, a nova aba usa um wallpaper local como fallback.

## Restauração de abas

Em **Configurações > Inicialização** existe a opção:

> Manter as abas abertas para usá-las após reiniciar o MarshMallow

Quando ativada, o navegador salva localmente as abas normais e restaura até 30 abas na inicialização. Abas privadas nunca são gravadas. O estado é atualizado durante a navegação para auxiliar também em recuperação após falhas.

## Teste recomendado

1. Execute `VALIDAR_MARSHMALLOW_4.0.12.bat`.
2. Execute `TESTAR_WALLPAPERS_E_RESTAURACAO_4.0.12.bat`.
3. Só crie o instalador depois de validar os dois comportamentos.

## Privacidade da coleção fotográfica

A coleção **Fotográfico** é opcional e online. Ao utilizá-la, as imagens são solicitadas a `images.unsplash.com`. A coleção **MarshMallow Studio** não faz requisições externas.

Veja `WALLPAPER_CREDITS.md` para os créditos e informações de licença.
