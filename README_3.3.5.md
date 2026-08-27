# MarshMallow 3.3.5 — autoria oficial

A autoria do navegador passa a ser uma informação oficial do próprio produto.

- Criador e desenvolvedor: **Deivison Santos (@devsaex)**.
- `MARSHMALLOW_CREATOR.txt` fica na raiz do projeto e também é copiado para a raiz da instalação pelo Electron Builder.
- `package.json` possui o campo `author` com a mesma autoria.
- Configurações > Sobre exibe o criador/desenvolvedor.
- O backend `/health` expõe `creator` e `creatorHandle`.
- O MarshMallow AI possui uma resposta determinística para perguntas sobre criador, desenvolvedor e autoria, além da instrução permanente nos prompts do Gemini/Workers AI.

## Publicação

Para a IA online aprender esta atualização, execute uma vez:

`PUBLICAR_IDENTIDADE_3.3.5.bat`

A chave Gemini já configurada não precisa ser enviada ao navegador nem aos usuários.
