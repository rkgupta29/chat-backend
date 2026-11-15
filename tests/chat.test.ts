import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/database';
import { api, createUser, randomId, resetData } from './helpers';

beforeEach(resetData);
afterAll(() => prisma.$disconnect());

describe('POST /chat/create', () => {
  it('creates a new chat with two memberships', async () => {
    const [a, b] = [await createUser('a'), await createUser('b')];
    const res = await api.post('/chat/create').send({ userAId: a.id, userBId: b.id });
    expect(res.status).toBe(201);
    expect(res.body.chatId).toMatch(/^[0-9a-f-]{36}$/);
    expect(await prisma.chatMember.count({ where: { chatId: res.body.chatId } })).toBe(2);
  });

  it('returns the existing chat, regardless of user order', async () => {
    const [a, b] = [await createUser(), await createUser()];
    const first = await api.post('/chat/create').send({ userAId: a.id, userBId: b.id });
    const second = await api.post('/chat/create').send({ userAId: b.id, userBId: a.id });
    expect(second.status).toBe(200);
    expect(second.body.chatId).toBe(first.body.chatId);
    expect(await prisma.chat.count()).toBe(1);
  });

  it('creates exactly one chat under concurrent requests (both orders)', async () => {
    const [a, b] = [await createUser(), await createUser()];
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        i % 2
          ? api.post('/chat/create').send({ userAId: a.id, userBId: b.id })
          : api.post('/chat/create').send({ userAId: b.id, userBId: a.id }),
      ),
    );
    expect(results.every((r) => r.status === 200 || r.status === 201)).toBe(true);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(new Set(results.map((r) => r.body.chatId)).size).toBe(1);
    expect(await prisma.chat.count()).toBe(1);
    expect(await prisma.chatMember.count()).toBe(2);
  });

  it('rejects a chat with oneself (400)', async () => {
    const a = await createUser();
    const res = await api.post('/chat/create').send({ userAId: a.id, userBId: a.id });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SELF_CHAT');
  });

  it('rejects malformed ids (400)', async () => {
    const res = await api.post('/chat/create').send({ userAId: 'nope', userBId: 42 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when a user does not exist', async () => {
    const a = await createUser();
    const res = await api.post('/chat/create').send({ userAId: a.id, userBId: randomId() });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });

  it('returns 400 on malformed JSON', async () => {
    const res = await api.post('/chat/create').set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
  });
});

describe('GET /user/:userId/chats', () => {
  it('lists chats with members, most recently updated first', async () => {
    const [a, b, c] = [await createUser(), await createUser(), await createUser()];
    const ab = (await api.post('/chat/create').send({ userAId: a.id, userBId: b.id })).body.chatId;
    const ac = (await api.post('/chat/create').send({ userAId: a.id, userBId: c.id })).body.chatId;

    await api.post(`/chat/${ab}/message/send`).send({ senderId: a.id, text: 'bump' });

    const res = await api.get(`/user/${a.id}/chats`);
    expect(res.status).toBe(200);
    expect(res.body.chats.map((x: { chatId: string }) => x.chatId)).toEqual([ab, ac]);
    expect(res.body.chats[0].memberIds.sort()).toEqual([a.id, b.id].sort());
    expect(res.body.chats[0].createdAt).toBeTruthy();

    const other = await api.get(`/user/${c.id}/chats`);
    expect(other.body.chats.map((x: { chatId: string }) => x.chatId)).toEqual([ac]);
  });

  it('returns an empty list for a user with no chats, 404 for unknown user, 400 for bad id', async () => {
    const a = await createUser();
    expect((await api.get(`/user/${a.id}/chats`)).body).toEqual({ chats: [] });
    expect((await api.get(`/user/${randomId()}/chats`)).status).toBe(404);
    expect((await api.get('/user/not-a-uuid/chats')).status).toBe(400);
  });
});
