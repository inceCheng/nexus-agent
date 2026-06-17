# NexusAgent

NexusAgent is a separated frontend/backend MVP for multi-conversation agent chat.

- `backend/`: Next.js App Router API, Prisma, MySQL, DeepAgents, LangChain.
- `frontend/`: Vite React workspace UI with Ant Design X.
- Model catalog: loaded from `https://models.dev/api.json` and cached in MySQL.

## Environment

Create `backend/.env.local`:

```bash
DATABASE_URL="mysql://root:123456@10.23.16.54:3306/nexus_agent"
```

API keys are not stored. The frontend sends the key only with the current chat request.

## Commands

```bash
npm install
npm run dev
```

Development URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`

Verification:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Database:

```bash
npm run prisma:generate --workspace backend
npm run prisma:migrate --workspace backend
```

## API

- `GET /api/models/providers`
- `GET /api/models/providers/:providerId/models`
- `GET /api/conversations`
- `POST /api/conversations`
- `GET /api/conversations/:id/messages`
- `POST /api/conversations/:id/messages/stream`
