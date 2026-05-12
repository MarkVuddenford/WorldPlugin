import {
  appendRemoteFriendRequest,
  appendRemoteMessage,
  appendRemoteOrder,
  applyRemoteChannelClear,
  applyRemoteFriendRequestStatus,
  applyRemoteModeration,
  applyRemoteSentMessagesCount,
  applyRemoteOrderAccept,
  applyRemoteOrderComplete,
  applyRemoteFriendRemove,
  appendRemoteProfileReaction,
  mergeRemoteFriendRequests,
  mergeRemoteMessages,
  replaceRemoteOrders,
  replaceRemoteProfileReactions,
  registerWsSend,
  type Order,
  type ChatMessage,
  type FriendRequest,
  type ProfileReaction,
} from './store';

const PERSIST_KEY = 'worldplugin-storage';

function resolveWsUrl(): string | null {
  const v = import.meta.env.VITE_CHAT_WS_URL as string | undefined;
  if (v === '' || v === 'false') return null;
  if (v) return v;
  if (import.meta.env.DEV) {
    const h = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    return `ws://${h}:8787`;
  }
  return null;
}

export function initChatSync() {
  if (typeof window === 'undefined') return;

  const url = resolveWsUrl();

  // Если есть WS, он уже авторитетный источник синхронизации между вкладками/клиентами.
  // Дублирующая sync через storage может вызывать шторм ререндеров.
  if (!url) {
    window.addEventListener('storage', (e) => {
      if (e.key !== PERSIST_KEY || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue);
        const msgs = parsed.state?.messages;
        if (Array.isArray(msgs)) mergeRemoteMessages(msgs as ChatMessage[]);
        const fr = parsed.state?.friendRequests;
        if (Array.isArray(fr)) mergeRemoteFriendRequests(fr as FriendRequest[]);
        const ord = parsed.state?.orders;
        if (Array.isArray(ord)) replaceRemoteOrders(ord as Order[]);
        const pr = parsed.state?.profileReactions;
        if (Array.isArray(pr)) replaceRemoteProfileReactions(pr as ProfileReaction[]);
      } catch {
        /* ignore */
      }
    });
    return;
  }

  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      registerWsSend((payload) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(payload));
        }
      });
    };

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(String(ev.data));
        if (data.type === 'snapshot') {
          if (Array.isArray(data.messages)) {
            mergeRemoteMessages(data.messages as ChatMessage[]);
          }
          if (Array.isArray(data.friendRequests)) {
            mergeRemoteFriendRequests(data.friendRequests as FriendRequest[]);
          }
          if (Array.isArray(data.orders)) {
            replaceRemoteOrders(data.orders as Order[]);
          }
          if (Array.isArray(data.profileReactions)) {
            replaceRemoteProfileReactions(data.profileReactions as ProfileReaction[]);
          }
        } else if (data.type === 'append' && data.message) {
          appendRemoteMessage(data.message as ChatMessage);
        } else if (data.type === 'order-append' && data.order) {
          appendRemoteOrder(data.order as Order);
        } else if (
          data.type === 'order-accept' &&
          typeof data.orderId === 'string' &&
          typeof data.userId === 'string' &&
          typeof data.userName === 'string' &&
          typeof data.channelId === 'string'
        ) {
          applyRemoteOrderAccept(data.orderId, data.userId, data.userName, data.channelId);
        } else if (
          data.type === 'order-complete' &&
          typeof data.orderId === 'string'
        ) {
          applyRemoteOrderComplete(data.orderId, typeof data.channelId === 'string' ? data.channelId : undefined);
        } else if (data.type === 'friend-request-append' && data.request) {
          appendRemoteFriendRequest(data.request as FriendRequest);
        } else if (
          data.type === 'friend-link-remove' &&
          typeof data.userId === 'string' &&
          typeof data.friendId === 'string'
        ) {
          applyRemoteFriendRemove(data.userId, data.friendId);
        } else if (data.type === 'profile-reaction-append' && data.reaction) {
          appendRemoteProfileReaction(data.reaction as ProfileReaction);
        } else if (
          data.type === 'friend-request-status' &&
          typeof data.requestId === 'string' &&
          (data.status === 'accepted' || data.status === 'rejected')
        ) {
          applyRemoteFriendRequestStatus(data.requestId, data.status);
        } else if (
          data.type === 'account-stats' &&
          typeof data.userId === 'string' &&
          typeof data.sentMessagesCount === 'number'
        ) {
          applyRemoteSentMessagesCount(data.userId, data.sentMessagesCount);
        } else if (
          data.type === 'account-moderation' &&
          typeof data.userId === 'string' &&
          data.patch &&
          typeof data.patch === 'object'
        ) {
          applyRemoteModeration(data.userId, data.patch as { mutedUntil?: number; bannedUntil?: number; banReason?: string });
        } else if (
          data.type === 'channel-clear' &&
          typeof data.channelId === 'string'
        ) {
          applyRemoteChannelClear(data.channelId);
        }
      } catch {
        /* ignore */
      }
    };

    ws.onclose = () => {
      registerWsSend(null);
      reconnectTimer = setTimeout(connect, 2500);
    };

    ws.onerror = () => {
      ws.close();
    };
  };

  connect();
}
