import {
  DocumentSnapshot,
  FieldPath,
  FieldValue,
  Timestamp,
  type CollectionReference,
} from 'firebase-admin/firestore';
import { getFirestore } from '../../config/firebase';

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  timestamp: string;
  editedAt: string | null;
  deletedAt: string | null;
}

export interface ReadReceipt {
  messageId: string;
  userId: string;
  readAt: string;
}

export interface LastSeen {
  userId: string;
  messageId: string;
  timestamp: string;
}

export interface MessagePosition {
  seconds: number;
  nanoseconds: number;
  id: string;
}

const iso = (t: unknown): string | null => (t instanceof Timestamp ? t.toDate().toISOString() : null);

function toMessage(chatId: string, doc: DocumentSnapshot): Message {
  const d = doc.data() ?? {};
  return {
    id: doc.id,
    chatId,
    senderId: d.senderId,
    text: d.text,
    timestamp: iso(d.timestamp) ?? new Date(0).toISOString(),
    editedAt: iso(d.editedAt),
    deletedAt: iso(d.deletedAt),
  };
}

function positionOf(doc: DocumentSnapshot): MessagePosition {
  const ts = doc.get('timestamp') as Timestamp;
  return { seconds: ts.seconds, nanoseconds: ts.nanoseconds, id: doc.id };
}

export function comparePositions(a: MessagePosition, b: MessagePosition): number {
  return (
    a.seconds - b.seconds ||
    a.nanoseconds - b.nanoseconds ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

const chatDoc = (chatId: string) => getFirestore().collection('chats').doc(chatId);
const messagesCol = (chatId: string): CollectionReference => chatDoc(chatId).collection('messages');
const receiptsCol = (chatId: string) => chatDoc(chatId).collection('readReceipts');
const lastSeenCol = (chatId: string) => chatDoc(chatId).collection('lastSeen');

const ALREADY_EXISTS = 6;

export const messageRepository = {
  async create(chatId: string, senderId: string, text: string): Promise<Message> {
    const ref = messagesCol(chatId).doc();
    await ref.create({
      senderId,
      text,
      timestamp: FieldValue.serverTimestamp(),
      editedAt: null,
      deletedAt: null,
    });
    return toMessage(chatId, await ref.get());
  },

  async findById(chatId: string, messageId: string): Promise<Message | null> {
    const doc = await messagesCol(chatId).doc(messageId).get();
    return doc.exists ? toMessage(chatId, doc) : null;
  },

  async findPage(chatId: string, limit: number, cursor?: MessagePosition) {
    let query = messagesCol(chatId)
      .orderBy('timestamp', 'desc')
      .orderBy(FieldPath.documentId(), 'desc')
      .limit(limit + 1);
    if (cursor) {
      query = query.startAfter(new Timestamp(cursor.seconds, cursor.nanoseconds), cursor.id);
    }

    const docs = (await query.get()).docs;
    const hasMore = docs.length > limit;
    const page = hasMore ? docs.slice(0, limit) : docs;
    const oldest = page[page.length - 1];

    return {
      messages: page.map((d) => toMessage(chatId, d)).reverse(),
      nextCursor: hasMore && oldest ? positionOf(oldest) : null,
    };
  },

  async createReadReceipt(chatId: string, messageId: string, userId: string) {
    const ref = receiptsCol(chatId).doc(`${messageId}_${userId}`);
    let created = true;
    try {
      await ref.create({ messageId, userId, readAt: FieldValue.serverTimestamp() });
    } catch (err) {
      if ((err as { code?: number }).code !== ALREADY_EXISTS) throw err;
      created = false;
    }
    const doc = await ref.get();
    const receipt: ReadReceipt = {
      messageId,
      userId,
      readAt: iso(doc.get('readAt')) ?? new Date(0).toISOString(),
    };
    return { receipt, created };
  },

  async advanceLastSeen(chatId: string, userId: string, messageId: string) {
    const db = getFirestore();
    const lastSeenRef = lastSeenCol(chatId).doc(userId);
    const targetRef = messagesCol(chatId).doc(messageId);

    const outcome = await db.runTransaction(async (tx) => {
      const [current, target] = await Promise.all([tx.get(lastSeenRef), tx.get(targetRef)]);
      if (!target.exists) return null;

      let advance = true;
      if (current.exists) {
        const currentMsg = await tx.get(messagesCol(chatId).doc(current.get('messageId')));
        if (currentMsg.exists && comparePositions(positionOf(target), positionOf(currentMsg)) <= 0) {
          advance = false;
        }
      }

      if (advance) {
        tx.set(lastSeenRef, { userId, messageId, timestamp: FieldValue.serverTimestamp() });
      }
      return { updated: advance };
    });
    if (!outcome) return null;

    const doc = await lastSeenRef.get();
    const lastSeen: LastSeen = {
      userId,
      messageId: doc.get('messageId'),
      timestamp: iso(doc.get('timestamp')) ?? new Date(0).toISOString(),
    };
    return { lastSeen, updated: outcome.updated };
  },
};
