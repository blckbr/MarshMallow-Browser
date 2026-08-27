# MarshMallow 3.2.3 — PBKDF2 Cloudflare Fix

## O que foi corrigido

A 3.2.2 usava PBKDF2-SHA256 com **120.000 iterações**. O runtime do Cloudflare
Workers rejeitou esse valor com a mensagem `iteration counts above 100000 are not supported`.
A 3.2.3 usa **100.000 iterações**, o máximo aceito pelo runtime que respondeu ao teste.

Também foi criado um identificador estável para o banco lógico de contas: `accounts-main-v1`.
A partir desta versão, correções do aplicativo não devem trocar de registro e abandonar contas
já criadas. Cada usuário passa a ter `passwordKdf` e `passwordIterations` gravados junto ao hash,
permitindo uma migração de algoritmo no futuro sem quebrar logins existentes.

## Como reparar

1. Extraia esta versão sobre `C:\MarshMallow-Electron`.
2. Execute `REPARAR_CONTAS_3.2.3.bat`.
3. Aguarde a etapa 4 mostrar `100000 iteracoes`.
4. O MarshMallow será iniciado automaticamente.
5. Crie a conta local e guarde o código de recuperação mostrado uma única vez.

O endereço oficial do backend permanece:

`https://marshmallow-gateway.marshmallow-browser-br.workers.dev`
