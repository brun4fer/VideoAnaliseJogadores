# Video Análise de Jogadores

Aplicação privada de análise individual de jogadores em Next.js e PostgreSQL. Cada ocorrência cria uma janela de vídeo entre 4 segundos antes e 6 segundos depois do momento marcado.

## Arranque local

1. Copiar `.env.example` para `.env.local` e preencher `DATABASE_URL`.
2. Executar `npm install`.
3. Executar `npm run prisma:push` numa base de dados nova ou `npx prisma migrate deploy` numa base de dados existente.
4. Executar `npm run dev`.

## Vídeos no Cloudflare R2

Os vídeos são guardados num bucket R2 privado. O PostgreSQL conserva apenas o proprietário, a chave do objeto, o estado do upload e os metadados. O browser envia partes de 64 MiB diretamente ao R2; os ficheiros grandes não passam pelas funções do Vercel.

Variáveis obrigatórias no `.env.local` e no Vercel:

```dotenv
R2_BUCKET_NAME="video-analise-jogadores-prod"
R2_ENDPOINT="https://ACCOUNT_ID.eu.r2.cloudflarestorage.com"
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
```

As credenciais devem ter `Object Read & Write` apenas no bucket da aplicação. Nunca devem usar o prefixo `NEXT_PUBLIC_`.

Configuração CORS recomendada, substituindo a origem do Vercel:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://TEU-PROJETO.vercel.app"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type", "Range"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Range", "Accept-Ranges"],
    "MaxAgeSeconds": 3600
  }
]
```

Depois de publicar a alteração, aplicar as migrações antes de abrir a aplicação:

```bash
npx prisma migrate deploy
```

Os vídeos antigos continuam associados aos jogos como registos locais. Ao abrir cada jogo, o botão `Upload existing video` permite selecionar o ficheiro original e enviá-lo para o R2. Se a ligação cair, selecionar novamente o mesmo ficheiro retoma as partes já recebidas.

## Fotografias

As fotografias de jogadores e os emblemas ainda são registados através de URLs externas. A camada R2 criada para os vídeos pode ser reutilizada posteriormente para uploads de imagens, mas esse fluxo não faz parte da primeira migração de vídeo.
