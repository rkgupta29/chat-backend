import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { prisma } from '../src/config/database';
import { getFirestore } from '../src/config/firebase';
import { createApp } from '../src/app';

export const api = request(createApp());

export async function resetData() {
  await prisma.$executeRaw`TRUNCATE TABLE chat_members, chats, users CASCADE`;
  const db = getFirestore();
  await db.recursiveDelete(db.collection('chats'));
}

export async function createUser(name = 'user') {
  return prisma.user.create({ data: { name } });
}

export async function createChat(a: string, b: string): Promise<string> {
  const res = await api.post('/chat/create').send({ userAId: a, userBId: b });
  return res.body.chatId;
}

export async function sendMessage(chatId: string, senderId: string, text: string) {
  const res = await api.post(`/chat/${chatId}/message/send`).send({ senderId, text });
  if (res.status !== 201) throw new Error(`send failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.message as { id: string; text: string; timestamp: string; senderId: string };
}

export const randomId = () => randomUUID();
