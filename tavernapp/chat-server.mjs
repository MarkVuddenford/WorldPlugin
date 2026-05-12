/**
 * Общая синхронизация: чат + заявки + заказы + реакции + модерация.
 * Запуск: node chat-server.mjs | порт CHAT_PORT или 8787
 */
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.CHAT_PORT || 8787);
const MAX_MESSAGES = 4000;
const MAX_FRIEND_REQUESTS = 2000;

/** @type {unknown[]} */
const messages = [];
/** @type {unknown[]} */
const friendRequests = [];
/** @type {unknown[]} */
const profileReactions = [];
/** @type {unknown[]} */
const orders = [];

function broadcast(obj) {
  const packet = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(packet);
  }
}

const wss = new WebSocketServer({ port: PORT });
console.log(`[chat-server] ws://127.0.0.1:${PORT}`);

wss.on('connection', (socket) => {
  socket.send(JSON.stringify({
    type: 'snapshot',
    messages: [...messages],
    friendRequests: [...friendRequests],
    orders: [...orders],
    profileReactions: [...profileReactions],
  }));

  socket.on('message', (buf) => {
    try {
      const parsed = JSON.parse(String(buf));

      if (parsed.type === 'message' && parsed.message && !parsed.message.isNPC) {
        const m = parsed.message;
        if (typeof m.id !== 'string') return;
        if (messages.some((x) => x.id === m.id)) return;
        messages.push(m);
        if (messages.length > MAX_MESSAGES) messages.splice(0, messages.length - MAX_MESSAGES);
        broadcast({ type: 'append', message: m });
        return;
      }

      if (parsed.type === 'friend-request-new' && parsed.request) {
        const r = parsed.request;
        if (typeof r.id !== 'string') return;
        if (friendRequests.some((x) => x.id === r.id)) return;
        if (
          friendRequests.some(
            (x) => x.fromId === r.fromId && x.toId === r.toId && x.status === 'pending'
          )
        ) {
          return;
        }
        friendRequests.push(r);
        if (friendRequests.length > MAX_FRIEND_REQUESTS) {
          friendRequests.splice(0, friendRequests.length - MAX_FRIEND_REQUESTS);
        }
        broadcast({ type: 'friend-request-append', request: r });
        return;
      }

      if (parsed.type === 'friend-request-update' && parsed.requestId && parsed.status) {
        const { requestId, status } = parsed;
        if (status !== 'accepted' && status !== 'rejected') return;
        const idx = friendRequests.findIndex((x) => x.id === requestId);
        if (idx >= 0) friendRequests[idx] = { ...friendRequests[idx], status };
        broadcast({ type: 'friend-request-status', requestId, status });
        return;
      }

      if (parsed.type === 'profile-reaction-new' && parsed.reaction) {
        const r = parsed.reaction;
        if (typeof r.id !== 'string') return;
        if (profileReactions.some((x) => x.id === r.id)) return;
        profileReactions.push(r);
        broadcast({ type: 'profile-reaction-append', reaction: r });
        return;
      }

      if (parsed.type === 'order-create' && parsed.order) {
        const o = parsed.order;
        if (typeof o.id !== 'string') return;
        if (orders.some((x) => x.id === o.id)) return;
        orders.push(o);
        broadcast({ type: 'order-append', order: o });
        return;
      }

      if (parsed.type === 'order-accept' && parsed.orderId && parsed.userId && parsed.userName && parsed.channelId) {
        const { orderId, userId, userName, channelId } = parsed;
        const idx = orders.findIndex((x) => x.id === orderId);
        if (idx >= 0) {
          orders[idx] = { ...orders[idx], acceptedById: userId, acceptedByName: userName, channelId };
        }
        broadcast({ type: 'order-accept', orderId, userId, userName, channelId });
        return;
      }

      if (parsed.type === 'order-complete' && parsed.orderId) {
        const { orderId, channelId } = parsed;
        const idx = orders.findIndex((x) => x.id === orderId);
        if (idx >= 0) orders.splice(idx, 1);
        if (typeof channelId === 'string') {
          for (let i = messages.length - 1; i >= 0; i--) {
            const m = messages[i];
            if (m && typeof m === 'object' && m.channelId === channelId) {
              messages.splice(i, 1);
            }
          }
        }
        broadcast({ type: 'order-complete', orderId, channelId });
        return;
      }

      if (parsed.type === 'account-moderation' && parsed.userId && parsed.patch && typeof parsed.patch === 'object') {
        broadcast({ type: 'account-moderation', userId: parsed.userId, patch: parsed.patch });
        return;
      }

      if (parsed.type === 'account-stats' && parsed.userId && typeof parsed.sentMessagesCount === 'number') {
        broadcast({ type: 'account-stats', userId: parsed.userId, sentMessagesCount: parsed.sentMessagesCount });
        return;
      }

      if (parsed.type === 'friend-link-remove' && parsed.userId && parsed.friendId) {
        const [a, b] = [parsed.userId, parsed.friendId].sort();
        for (let i = friendRequests.length - 1; i >= 0; i--) {
          const r = friendRequests[i];
          if (!r || typeof r !== 'object') continue;
          const pair = [r.fromId, r.toId].sort();
          if (pair[0] === a && pair[1] === b && r.status === 'accepted') {
            friendRequests.splice(i, 1);
          }
        }
        broadcast({ type: 'friend-link-remove', userId: parsed.userId, friendId: parsed.friendId });
        return;
      }

      if (parsed.type === 'channel-clear' && typeof parsed.channelId === 'string') {
        const channelId = parsed.channelId;
        for (let i = messages.length - 1; i >= 0; i--) {
          const m = messages[i];
          if (m && typeof m === 'object' && m.channelId === channelId) {
            messages.splice(i, 1);
          }
        }
        broadcast({ type: 'channel-clear', channelId });
      }
    } catch {
      /* ignore */
    }
  });
});
