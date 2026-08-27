# MarshMallow 4.0.9 — Mídia em novas abas de segundo plano

Esta versão impede que vídeos e áudios iniciem/reproduzam antes da primeira abertura da aba quando o link foi criado em segundo plano.

## Comportamento

- A página da nova aba em segundo plano continua carregando normalmente.
- Áudio é silenciado imediatamente durante o carregamento para evitar qualquer som acidental.
- Elementos HTML5 de vídeo/áudio que tentarem iniciar são pausados enquanto a aba ainda nunca foi aberta.
- Ao clicar na aba pela primeira vez, o bloqueio temporário é removido e a reprodução que estava tentando iniciar pode continuar.
- Depois da primeira abertura, a aba passa a se comportar normalmente: trocar para outra aba não pausa um vídeo que o usuário já decidiu reproduzir.
- O mudo manual continua independente desse bloqueio temporário.

## Configuração

Em **Configurações > Desempenho** existe a opção:

**Não reproduzir mídia de novas abas em segundo plano até eu abri-las**

Ela vem ativada por padrão.

## Escopo

O mecanismo foi pensado principalmente para YouTube e players HTML5. Sites que usam mecanismos de áudio não-HTML5 muito específicos podem exigir tratamento adicional.
