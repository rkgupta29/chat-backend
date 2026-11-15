# Chat Backend

A small REST API for 1:1 chat. Users, chats and memberships live in PostgreSQL (via Prisma). Messages, read receipts and last-seen markers live in Firestore.

Built with Node.js, TypeScript, Express, Zod, Prisma and the Firebase Admin SDK.

> **Heads up: there's no login.** The API trusts whatever user IDs the caller sends, so anyone with a user's ID can act as them. Before going live, take the user's identity from a verified token instead of the request body.

## Getting started

```bash
npm install
cp .env.example .env      # then fill it in
npm run migrate:deploy
npm run dev
```

Your `.env`:

```
DATABASE_URL=postgresql://user@localhost:5432/chat_backend?schema=public
FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/service-account.json
PORT=3000
NODE_ENV=development
```

Keep the service account file outside the repo. Users aren't created by the API, so add them to the `users` table yourself.

For production: `npm run build && npm start`.

Once it's running, check `GET /health` and browse the interactive docs at `/api-docs`.

## How it works

- **One chat per pair.** Each chat stores a `pair_key` built from the two sorted user IDs, with a unique constraint. Simultaneous requests can't create duplicates; the loser just gets the existing chat.
- **Pagination.** Messages are sorted by timestamp, then document ID, so ties are stable. The first page is the latest messages; pass `nextCursor` to load older ones.
- **Last seen only moves forward**, and read receipts are safe to repeat.
- **Chat list is one query.** Sending a message bumps the chat's `updated_at`, so Firestore never has to be queried per chat.

Code is organised by feature (`chat`, `message`, `user`), each with routes, controller, service, repository and schema.

### Data

PostgreSQL: `users`, `chats` (with `pair_key`), `chat_members` (unique per chat and user).

Firestore:

```
chats/{chatId}/messages/{messageId}
chats/{chatId}/readReceipts/{messageId}_{userId}
chats/{chatId}/lastSeen/{userId}
```

## API

Errors look like `{"error": {"code": "...", "message": "..."}}`.

| Endpoint | Body / query | Returns |
|---|---|---|
| `POST /chat/create` | `userAId`, `userBId` | `{ chatId }` (201 new, 200 existing) |
| `POST /chat/:chatId/message/send` | `senderId`, `text` (1–4000 chars) | `201 { message }` |
| `GET /chat/:chatId/messages` | `userId`, `limit` (default 50, max 100), `cursor` | `{ messages, nextCursor }` |
| `POST /chat/:chatId/message/:messageId/read` | `userId` | `{ receipt }` (201 first time, 200 after) |
| `POST /chat/:chatId/lastseen` | `userId`, `messageId` | `{ lastSeen, updated }` |
| `GET /user/:userId/chats` | | `{ chats: [{ chatId, memberIds, createdAt, updatedAt }] }` |

Example:

```bash
curl -X POST localhost:3000/chat/123e4567-e89b-42d3-a456-426614174000/message/send \
  -H 'Content-Type: application/json' \
  -d '{"senderId":"<uuid>","text":"Hello!"}'
```

Common errors: `400` bad input, `403` not a chat member, `404` chat, user or message not found.

## Tests

Tests run against a real PostgreSQL database and the Firestore emulator (needs Java 11+). They wipe the test database, so use a separate one:

```bash
createdb chat_backend_test
# add TEST_DATABASE_URL to .env, then:
DATABASE_URL=<test db url> npx prisma migrate deploy
npm test
```

## Known limitations

- No authentication (see the note at the top).
- Postgres and Firestore can't share a transaction. If the `updated_at` bump fails after a message is saved, chat ordering may lag.
- The chat list isn't paginated and has no unread counts or last-message preview.
- No message edit or delete endpoints yet.
- No rate limiting, and CORS is open to all origins.
- Only tested against the Firestore emulator, not a live project.
