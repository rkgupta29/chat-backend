import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import { prisma } from '../src/config/database';
import { getFirestore } from '../src/config/firebase';
import { api, createChat, createUser, randomId, resetData, sendMessage } from './helpers';

let a: { id: string };
let b: { id: string };
let outsider: { id: string };
let chatId: string;

beforeEach(async () => {
  await resetData();
  [a, b, outsider] = [await createUser('a'), await createUser('b'), await createUser('out')];
  chatId = await createChat(a.id, b.id);
});
afterAll(() => prisma.$disconnect());

describe('POST /chat/:chatId/message/send', () => {
  it('stores a message with a Firestore id and server timestamp', async () => {
    const res = await api.post(`/chat/${chatId}/message/send`).send({ senderId: a.id, text: ' Hello! ' });
    expect(res.status).toBe(201);
    expect(res.body.message).toMatchObject({ chatId, senderId: a.id, text: 'Hello!', editedAt: null, deletedAt: null });
    expect(res.body.message.id).toBeTruthy();
    expect(Date.parse(res.body.message.timestamp)).not.toBeNaN();
  });

  it('rejects empty, whitespace-only and oversized text (400)', async () => {
    for (const text of ['', '   ', 'x'.repeat(4001), 5]) {
      const res = await api.post(`/chat/${chatId}/message/send`).send({ senderId: a.id, text });
      expect(res.status).toBe(400);
    }
  });

  it('rejects non-members (403) and unknown chats (404)', async () => {
    const res = await api.post(`/chat/${chatId}/message/send`).send({ senderId: outsider.id, text: 'hi' });
    expect(res.status).toBe(403);
    const res2 = await api.post(`/chat/${randomId()}/message/send`).send({ senderId: a.id, text: 'hi' });
    expect(res2.status).toBe(404);
  });

  it('bumps the chat to the top of the sender\'s chat list via updatedAt', async () => {
    const before = await prisma.chat.findUniqueOrThrow({ where: { id: chatId } });
    await new Promise((r) => setTimeout(r, 10));
    await sendMessage(chatId, a.id, 'hi');
    const after = await prisma.chat.findUniqueOrThrow({ where: { id: chatId } });
    expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
  });
});

describe('GET /chat/:chatId/messages', () => {
  const get = (qs = '', user = a.id) => api.get(`/chat/${chatId}/messages?userId=${user}${qs}`);

  it('returns messages in chronological order', async () => {
    for (const t of ['one', 'two', 'three']) await sendMessage(chatId, a.id, t);
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body.messages.map((m: { text: string }) => m.text)).toEqual(['one', 'two', 'three']);
    expect(res.body.nextCursor).toBeNull();
  });

  it('paginates the latest messages first, then older ones, without duplicates or gaps', async () => {
    const sent: string[] = [];
    for (let i = 0; i < 7; i++) sent.push((await sendMessage(chatId, i % 2 ? a.id : b.id, `m${i}`)).id);

    const p1 = await get('&limit=3');
    expect(p1.body.messages.map((m: { text: string }) => m.text)).toEqual(['m4', 'm5', 'm6']);
    expect(p1.body.nextCursor).toBeTruthy();

    const p2 = await get(`&limit=3&cursor=${p1.body.nextCursor}`);
    expect(p2.body.messages.map((m: { text: string }) => m.text)).toEqual(['m1', 'm2', 'm3']);

    const p3 = await get(`&limit=3&cursor=${p2.body.nextCursor}`);
    expect(p3.body.messages.map((m: { text: string }) => m.text)).toEqual(['m0']);
    expect(p3.body.nextCursor).toBeNull();

    const all = [...p3.body.messages, ...p2.body.messages, ...p1.body.messages].map((m: { id: string }) => m.id);
    expect(all).toEqual(sent);
  });

  it('does not return a cursor when the page is exactly the last one', async () => {
    for (let i = 0; i < 3; i++) await sendMessage(chatId, a.id, `m${i}`);
    expect((await get('&limit=3')).body.nextCursor).toBeNull();
  });

  it('pages correctly through messages sharing identical timestamps', async () => {
    const col = getFirestore().collection('chats').doc(chatId).collection('messages');
    const ts = Timestamp.fromMillis(1_700_000_000_000);
    const ids = ['a1', 'b2', 'c3', 'd4', 'e5'];
    for (const id of ids) await col.doc(id).set({ senderId: a.id, text: id, timestamp: ts });

    const p1 = await get('&limit=2');
    const p2 = await get(`&limit=2&cursor=${p1.body.nextCursor}`);
    const p3 = await get(`&limit=2&cursor=${p2.body.nextCursor}`);
    const seen = [...p3.body.messages, ...p2.body.messages, ...p1.body.messages].map((m: { id: string }) => m.id);
    expect(seen).toEqual(ids);
  });

  it('defaults to 50, clamps limit to 100, and validates input', async () => {
    expect((await get('&limit=1000')).status).toBe(200);
    expect((await get('&limit=0')).status).toBe(400);
    expect((await get('&limit=abc')).status).toBe(400);
    const bad = await get('&cursor=garbage');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('INVALID_CURSOR');
    expect((await api.get(`/chat/${chatId}/messages`)).status).toBe(400);
  });

  it('denies non-members (403) and unknown chats (404)', async () => {
    expect((await get('', outsider.id)).status).toBe(403);
    expect((await api.get(`/chat/${randomId()}/messages?userId=${a.id}`)).status).toBe(404);
  });
});

describe('POST /chat/:chatId/message/:messageId/read', () => {
  const read = (messageId: string, userId: string) =>
    api.post(`/chat/${chatId}/message/${messageId}/read`).send({ userId });

  it('creates a receipt, and is idempotent (keeps original readAt)', async () => {
    const msg = await sendMessage(chatId, a.id, 'hi');
    const first = await read(msg.id, b.id);
    expect(first.status).toBe(201);
    expect(first.body.receipt).toMatchObject({ messageId: msg.id, userId: b.id });

    const second = await read(msg.id, b.id);
    expect(second.status).toBe(200);
    expect(second.body.receipt.readAt).toBe(first.body.receipt.readAt);

    const snap = await getFirestore().collection('chats').doc(chatId).collection('readReceipts').get();
    expect(snap.docs.map((d) => d.id)).toEqual([`${msg.id}_${b.id}`]);
  });

  it('prevents reading your own message (400)', async () => {
    const msg = await sendMessage(chatId, a.id, 'hi');
    const res = await read(msg.id, a.id);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CANNOT_READ_OWN_MESSAGE');
  });

  it('403 for non-members, 404 for unknown message, 400 for invalid message id', async () => {
    const msg = await sendMessage(chatId, a.id, 'hi');
    expect((await read(msg.id, outsider.id)).status).toBe(403);
    expect((await read('doesnotexist', b.id)).status).toBe(404);
    expect((await read('bad%20id', b.id)).status).toBe(400);
  });
});

describe('POST /chat/:chatId/lastseen', () => {
  const seen = (userId: string, messageId: string) =>
    api.post(`/chat/${chatId}/lastseen`).send({ userId, messageId });

  it('sets last seen, is repeatable, and advances forward', async () => {
    const [m1, m2] = [await sendMessage(chatId, a.id, '1'), await sendMessage(chatId, a.id, '2')];
    const r1 = await seen(b.id, m1.id);
    expect(r1.status).toBe(200);
    expect(r1.body).toMatchObject({ updated: true, lastSeen: { userId: b.id, messageId: m1.id } });

    const repeat = await seen(b.id, m1.id);
    expect(repeat.body.updated).toBe(false);
    expect(repeat.body.lastSeen.messageId).toBe(m1.id);

    const r2 = await seen(b.id, m2.id);
    expect(r2.body).toMatchObject({ updated: true, lastSeen: { messageId: m2.id } });
  });

  it('never moves backwards', async () => {
    const [m1, m2] = [await sendMessage(chatId, a.id, '1'), await sendMessage(chatId, a.id, '2')];
    await seen(b.id, m2.id);
    const back = await seen(b.id, m1.id);
    expect(back.status).toBe(200);
    expect(back.body).toMatchObject({ updated: false, lastSeen: { messageId: m2.id } });
  });

  it('ends on the newest message under concurrent out-of-order requests', async () => {
    const msgs = [];
    for (let i = 0; i < 6; i++) msgs.push(await sendMessage(chatId, a.id, `${i}`));
    const shuffled = [msgs[3], msgs[0], msgs[5], msgs[1], msgs[4], msgs[2]] as typeof msgs;
    await Promise.all(shuffled.map((m) => seen(b.id, m.id)));
    const final = await seen(b.id, msgs[0]!.id);
    expect(final.body.lastSeen.messageId).toBe(msgs[5]!.id);
  });

  it('403 for non-members, 404 for unknown message', async () => {
    const m = await sendMessage(chatId, a.id, '1');
    expect((await seen(outsider.id, m.id)).status).toBe(403);
    expect((await seen(b.id, 'doesnotexist')).status).toBe(404);
  });
});

describe('misc', () => {
  it('GET /health and unknown routes', async () => {
    expect((await api.get('/health')).body).toEqual({ status: 'ok' });
    const res = await api.get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
  it('serves Swagger UI at /api-docs', async () => {
    const res = await api.get('/api-docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger');
  });
});
