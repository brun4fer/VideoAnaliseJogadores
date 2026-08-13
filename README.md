# Video Análise de Jogadores

Aplicação de análise individual de jogadores a partir de vídeo. Mantém o fluxo visual da aplicação `AnaliseEQUIPA`, mas cada registo representa uma ação de um jogador e gera automaticamente um intervalo de vídeo entre 4 segundos antes e 6 segundos depois do clique.

## Arranque local

1. Copiar `.env.example` para `.env.local` e indicar uma base de dados PostgreSQL.
2. Executar `npm install`.
3. Executar `npm run prisma:push`.
4. Executar `npm run dev`.

Os vídeos não são enviados para o servidor. O ficheiro fica no browser e a aplicação guarda apenas os metadados, timestamps e classificações.
