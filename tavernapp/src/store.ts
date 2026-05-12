import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export interface Account {
  id: string;
  username: string;
  password: string;
  avatar: string;
  avatarUrl?: string;
  bannerUrl?: string;
  bio?: string;
  createdAt: number;
  /** Сколько раз игрок отправлял сообщения (не длину текста). */
  sentMessagesCount?: number;
  mutedUntil?: number;
  bannedUntil?: number;
  banReason?: string;
}

export interface ProfileReaction {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  text: string;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  text: string;
  authorAvatarUrl?: string;
  imageUrl?: string;
  timestamp: number;
  isNPC?: boolean;
}

export interface FriendRequest {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  status: 'pending' | 'accepted' | 'rejected';
  timestamp: number;
}

export interface Order {
  id: string;
  residentName: string;
  title: string;
  description: string;
  reward: string;
  createdAt: number;
  acceptedById?: string;
  acceptedByName?: string;
  channelId?: string;
}

export interface MarketItem {
  id: string;
  name: string;
  category: string;
  currentPrice: number;
  history: { time: number; price: number }[];
  unit: string;
  currency: string;
  trend: 'up' | 'down' | 'stable';
}

interface AppStore {
  currentUser: Account | null;
  /** Сохранять вход в localStorage (чекбокс «Запомнить меня»). */
  persistSession: boolean;
  accounts: Account[];
  messages: ChatMessage[];
  friendRequests: FriendRequest[];
  orders: Order[];
  marketItems: MarketItem[];
  profileReactions: ProfileReaction[];
  activeSection: 'tavern' | 'market' | 'orders';
  activeChannel: string;
  lastReadAtByChannel: Record<string, number>;
  /** Авто-сообщения NPC в канале main */
  npcBotEnabled: boolean;
  npcIntervalMinMs: number;
  npcIntervalMaxMs: number;

  login: (username: string, password: string, rememberMe?: boolean) => boolean;
  logout: () => void;
  setNpcBotConfig: (patch: Partial<{ npcBotEnabled: boolean; npcIntervalMinMs: number; npcIntervalMaxMs: number }>) => void;
  createAccount: (username: string, password: string) => boolean;
  deleteAccount: (id: string) => void;
  /** Очистить историю сообщений в канале (и синхронизировать между клиентами). */
  clearChannel: (channelId: string) => void;
  /** Админ: установить сколько всего сообщений отправил игрок. */
  setSentMessagesCount: (userId: string, count: number) => void;
  /** Админ: выдать/снять мут или бан. */
  setModeration: (userId: string, patch: Partial<Pick<Account, 'mutedUntil' | 'bannedUntil' | 'banReason'>>) => void;
  sendMessage: (
    channelId: string,
    authorId: string,
    authorName: string,
    text: string,
    imageUrl?: string,
    isNPC?: boolean,
    authorAvatarUrl?: string
  ) => void;
  sendFriendRequest: (fromId: string, fromName: string, toId: string, toName: string) => void;
  acceptFriendRequest: (requestId: string) => void;
  rejectFriendRequest: (requestId: string) => void;
  removeFriend: (userId: string, friendId: string) => void;
  getFriends: (userId: string) => Account[];
  getChannelMessages: (channelId: string) => ChatMessage[];
  createOrder: (residentName: string, title: string, description: string, reward: string) => void;
  acceptOrder: (orderId: string, userId: string, userName: string) => void;
  completeOrder: (orderId: string) => void;
  setActiveSection: (section: 'tavern' | 'market' | 'orders') => void;
  setActiveChannel: (channel: string) => void;
  markChannelRead: (channel: string, atTs?: number) => void;
  updateMarket: () => void;
  updateProfile: (userId: string, updates: Partial<Pick<Account, 'bio' | 'avatarUrl' | 'bannerUrl' | 'avatar'>>) => void;
  addProfileReaction: (fromId: string, fromName: string, toId: string, text: string) => void;
  getProfileReactions: (userId: string) => ProfileReaction[];
}

const CURRENCY_NAMES = ['медных монет', 'железных монет', 'золотых монет', 'платиновых монет', 'мифриловых монет'];
const MAX_LOCAL_MESSAGES = 5000;

export type PlayerRoleId = 'rookie' | 'adept' | 'hunter' | 'guardian' | 'veteran' | 'master' | 'prophet' | 'legend';
export interface PlayerRole {
  id: PlayerRoleId;
  label: string;
  min: number;
}

export function getPlayerRoleBySentMessages(count: number): PlayerRole {
  const c = Math.max(0, count);
  if (c >= 5000) return { id: 'legend', label: 'ЛЕГЕНДА', min: 5000 };
  if (c >= 3000) return { id: 'prophet', label: 'ПРОРОК', min: 3000 };
  if (c >= 1500) return { id: 'master', label: 'МАСТЕР', min: 1500 };
  if (c >= 700) return { id: 'veteran', label: 'ВЕТЕРАН', min: 700 };
  if (c >= 300) return { id: 'guardian', label: 'ЗАЩИТНИК', min: 300 };
  if (c >= 100) return { id: 'hunter', label: 'ОХОТНИК', min: 100 };
  if (c >= 10) return { id: 'adept', label: 'ПОДМАСТЕРЬЕ', min: 10 };
  return { id: 'rookie', label: 'НОВИЧОК', min: 0 };
}

function randomCurrency(val: number): string {
  if (val < 50) return `${val} ${CURRENCY_NAMES[0]}`;
  if (val < 200) return `${val} ${CURRENCY_NAMES[1]}`;
  if (val < 1000) return `${val} ${CURRENCY_NAMES[2]}`;
  if (val < 5000) return `${val} ${CURRENCY_NAMES[3]}`;
  return `${val} ${CURRENCY_NAMES[4]}`;
}

function generateMarketItems(): MarketItem[] {
  const items = [
    { name: 'Железо', category: 'Металлы', base: 120, unit: 'за слиток' },
    { name: 'Золото', category: 'Металлы', base: 450, unit: 'за слиток' },
    { name: 'Мифрил', category: 'Металлы', base: 2800, unit: 'за слиток' },
    { name: 'Адамантит', category: 'Магметаллы', base: 3500, unit: 'за слиток' },
    { name: 'Эфириум', category: 'Магметаллы', base: 1200, unit: 'за кристалл' },
    { name: 'Звёздный металл', category: 'Магметаллы', base: 4200, unit: 'за слиток' },
    { name: 'Магическая пыль', category: 'Магия', base: 85, unit: 'за горсть' },
    { name: 'Философский камень', category: 'Магия', base: 9800, unit: 'за штуку' },
    { name: 'Зелье зоркости', category: 'Зелья', base: 220, unit: 'за флакон' },
    { name: 'Эссенция дракона', category: 'Магия', base: 6500, unit: 'за каплю' },
  ];
  const now = Date.now();
  return items.map((item, i) => {
    const history: { time: number; price: number }[] = [];
    let price = item.base;
    for (let j = 20; j >= 0; j--) {
      price = Math.max(10, price + Math.floor((Math.random() - 0.5) * item.base * 0.15));
      history.push({ time: now - j * 3600000, price });
    }
    const last = history[history.length - 1].price;
    const prev = history[history.length - 2].price;
    return {
      id: String(i),
      name: item.name,
      category: item.category,
      currentPrice: last,
      history,
      unit: item.unit,
      currency: randomCurrency(last),
      trend: last > prev ? 'up' : last < prev ? 'down' : 'stable',
    };
  });
}

const NPC_MESSAGES = [
  ['Странник', 'Эй, кто-нибудь слышал о пещере за северными горами? Говорят, там живёт дракон!'],
  ['Кузнец Борин', 'Мой молот снова сломался... проклятые гоблины напали на склад!'],
  ['Торговец Дэйв', 'Цены на мифрил снова ползут вверх. Закупайтесь пока есть возможность!'],
  ['Охотник Рей', 'Вчера видел следы тролля возле реки. Будьте осторожны там...'],
  ['Эльфийка Лэйя', 'Лунный цветок расцветает только раз в столетие. Это знак перемен...'],
  ['Маг Зэйрос', 'Мои изыскания продвигаются! Скоро раскрою тайну исчезнувшего города.'],
  ['Барменша Грейс', 'Ещё одна кружка эля? Сегодня скидки для искателей приключений!'],
  ['Рыцарь Торвальд', 'Орден Стальной Руки объявил поход на восток. Ищем добровольцев!'],
  ['Ведьма Милла', 'Звёзды говорят... грядут тёмные времена. Запасайтесь амулетами.'],
  ['Гном Кракт', 'Нашёл жилу руды глубоко под горой! Но туда не добраться без верёвки и смелости.'],
  ['Бард Силас', 'Слышали мою новую балладу? Она о герое, победившем Короля-лича!'],
  ['Торговец Дэйв', 'Кто купит зачарованные сапоги? Всего за 300 золотых!'],
  ['Странник', 'Не знаете хорошего мага-целителя? Меня укусил мертвяк...'],
  ['Охотник Рей', 'Сегодня удачная охота! Продаю шкуры виверны по честной цене.'],
  ['Кузнец Борин', 'Приносите сюда своё оружие! Заточу лучше, чем эльфийские мастера!'],
  ['Маг Зэйрос', 'Не трогайте старые руины на холме. Там просыпается нечто древнее...'],
  ['Бард Силас', 'Ха! Слышали анекдот про дракона и принцессу? Она сама его съела!'],
  ['Ведьма Милла', 'Продаю обереги от нежити. Цена — одна услуга или пять золотых.'],
  ['Рыцарь Торвальд', 'Честь и доблесть — вот оружие настоящего рыцаря. И хороший меч.'],
  ['Эльфийка Лэйя', 'Люди такие торопливые... Мне уже триста лет, а вы всё куда-то спешите.'],
  ['Гном Кракт', 'Борода — гордость гнома! Кто тронет мою бороду — пожалеет!'],
  ['Барменша Грейс', 'Тише там! Это таверна, а не поле битвы. Ещё раз подерётесь — выгоню всех!'],
  ['Странник', 'Ищу попутчиков до Серебряного Предела. Дорога опасная, одному не пройти.'],
  ['Охотник Рей', 'Говорят, в лесу Теней завелись оборотни. Я видел следы... огромные.'],
  ['Торговец Дэйв', 'Налетай! Редкие артефакты из дальних земель! Только сегодня!'],
];

let npcInterval: ReturnType<typeof setTimeout> | null = null;

/** Синхронизация с chat-server (сообщения, заявки в друзья). */
let wsSend: ((payload: Record<string, unknown>) => void) | null = null;

export function registerWsSend(fn: ((payload: Record<string, unknown>) => void) | null) {
  wsSend = fn;
}

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      currentUser: null,
      persistSession: false,
      accounts: [],
      messages: [],
      friendRequests: [],
      orders: [],
      marketItems: generateMarketItems(),
      profileReactions: [],
      activeSection: 'tavern',
      activeChannel: 'main',
      lastReadAtByChannel: {},
      npcBotEnabled: true,
      npcIntervalMinMs: 15000,
      npcIntervalMaxMs: 45000,

      login: (username, password, rememberMe) => {
        const acc = get().accounts.find(a => a.username === username && a.password === password);
        if (acc) {
          set({ currentUser: acc, persistSession: !!rememberMe });
          return true;
        }
        return false;
      },

      logout: () => set({
        currentUser: null,
        persistSession: false,
        activeSection: 'tavern',
        activeChannel: 'main',
      }),

      setNpcBotConfig: (patch) => {
        set(s => {
          const enabled = patch.npcBotEnabled ?? s.npcBotEnabled;
          let minMs = patch.npcIntervalMinMs ?? s.npcIntervalMinMs;
          let maxMs = patch.npcIntervalMaxMs ?? s.npcIntervalMaxMs;
          minMs = Math.max(3000, Math.min(minMs, 600_000));
          maxMs = Math.max(minMs + 1000, Math.min(maxMs, 600_000));
          return { npcBotEnabled: enabled, npcIntervalMinMs: minMs, npcIntervalMaxMs: maxMs };
        });
        clearNpcSchedule();
        scheduleNextNpc();
      },

      createAccount: (username, password) => {
        if (get().accounts.find(a => a.username === username)) return false;
        const avatars = ['🧙', '⚔️', '🏹', '🛡️', '🔮', '🗡️', '🦅', '🐉', '💎', '🌙'];
        const newAcc: Account = {
          id: uuidv4(),
          username,
          password,
          avatar: avatars[Math.floor(Math.random() * avatars.length)],
          createdAt: Date.now(),
          sentMessagesCount: 0,
        };
        set(s => ({ accounts: [...s.accounts, newAcc] }));
        return true;
      },

      deleteAccount: (id) => {
        set(s => ({ accounts: s.accounts.filter(a => a.id !== id) }));
      },

      sendMessage: (channelId, authorId, authorName, text, imageUrl, isNPC, authorAvatarUrl) => {
        if (!isNPC) {
          const author = get().accounts.find(a => a.id === authorId);
          const mutedUntil = author?.mutedUntil ?? 0;
          if (mutedUntil > Date.now()) return;
        }
        const msg: ChatMessage = {
          id: uuidv4(),
          channelId,
          authorId,
          authorName,
          text,
          authorAvatarUrl,
          imageUrl,
          timestamp: Date.now(),
          isNPC,
        };
        const isNpc = !!isNPC;
        set(s => ({
          messages: [...s.messages, msg].slice(-MAX_LOCAL_MESSAGES),
          accounts: isNpc
            ? s.accounts
            : s.accounts.map(a =>
                a.id === authorId
                  ? { ...a, sentMessagesCount: (a.sentMessagesCount ?? 0) + 1 }
                  : a
              ),
          currentUser:
            !isNpc && s.currentUser?.id === authorId
              ? { ...s.currentUser, sentMessagesCount: (s.currentUser.sentMessagesCount ?? 0) + 1 }
              : s.currentUser,
          lastReadAtByChannel:
            !isNpc && authorId === s.currentUser?.id
              ? { ...s.lastReadAtByChannel, [channelId]: Date.now() }
              : s.lastReadAtByChannel,
        }));
        if (!isNpc) wsSend?.({ type: 'message', message: msg });
      },

      sendFriendRequest: (fromId, fromName, toId, toName) => {
        const existing = get().friendRequests.find(
          r => r.fromId === fromId && r.toId === toId && r.status === 'pending'
        );
        if (existing) return;
        const req: FriendRequest = {
          id: uuidv4(),
          fromId,
          fromName,
          toId,
          toName,
          status: 'pending',
          timestamp: Date.now(),
        };
        set(s => ({ friendRequests: [...s.friendRequests, req] }));
        wsSend?.({ type: 'friend-request-new', request: req });
      },

      acceptFriendRequest: (requestId) => {
        set(s => ({
          friendRequests: s.friendRequests.map(r =>
            r.id === requestId ? { ...r, status: 'accepted' } : r
          ),
        }));
        wsSend?.({ type: 'friend-request-update', requestId, status: 'accepted' });
      },

      rejectFriendRequest: (requestId) => {
        set(s => ({
          friendRequests: s.friendRequests.map(r =>
            r.id === requestId ? { ...r, status: 'rejected' } : r
          ),
        }));
        wsSend?.({ type: 'friend-request-update', requestId, status: 'rejected' });
      },

      removeFriend: (userId, friendId) => {
        const [a, b] = [userId, friendId].sort();
        set(s => ({
          friendRequests: s.friendRequests.filter(r => {
            const pair = [r.fromId, r.toId].sort();
            if (pair[0] !== a || pair[1] !== b) return true;
            return r.status !== 'accepted';
          }),
        }));
        wsSend?.({ type: 'friend-link-remove', userId, friendId });
      },

      getFriends: (userId) => {
        const reqs = get().friendRequests.filter(
          r => r.status === 'accepted' && (r.fromId === userId || r.toId === userId)
        );
        const accounts = get().accounts;
        return reqs.map(r => {
          const friendId = r.fromId === userId ? r.toId : r.fromId;
          return accounts.find(a => a.id === friendId);
        }).filter(Boolean) as Account[];
      },

      getChannelMessages: (channelId) => {
        return get().messages.filter(m => m.channelId === channelId);
      },

      createOrder: (residentName, title, description, reward) => {
        const order: Order = {
          id: uuidv4(),
          residentName,
          title,
          description,
          reward,
          createdAt: Date.now(),
        };
        set(s => ({ orders: [...s.orders, order] }));
        wsSend?.({ type: 'order-create', order });
      },

      acceptOrder: (orderId, userId, userName) => {
        const order = get().orders.find(o => o.id === orderId);
        if (!order) return;
        const channelId = `order_${orderId}`;
        set(s => ({
          orders: s.orders.map(o =>
            o.id === orderId
              ? { ...o, acceptedById: userId, acceptedByName: userName, channelId }
              : o
          ),
        }));
        wsSend?.({ type: 'order-accept', orderId, userId, userName, channelId });
      },

      completeOrder: (orderId) => {
        const channelId = get().orders.find(o => o.id === orderId)?.channelId;
        set(s => ({
          orders: s.orders.filter(o => o.id !== orderId),
          messages: channelId ? s.messages.filter(m => m.channelId !== channelId) : s.messages,
        }));
        wsSend?.({ type: 'order-complete', orderId, channelId });
      },

      setActiveSection: (section) => set({ activeSection: section }),
      setActiveChannel: (channel) => set(s => {
        const current = s.lastReadAtByChannel[channel] ?? 0;
        const next = Date.now();
        return {
          activeChannel: channel,
          lastReadAtByChannel: next > current
            ? { ...s.lastReadAtByChannel, [channel]: next }
            : s.lastReadAtByChannel,
        };
      }),

      markChannelRead: (channel, atTs) => set(s => {
        const current = s.lastReadAtByChannel[channel] ?? 0;
        const next = Math.max(atTs ?? Date.now(), current);
        if (next === current) return s;
        return {
          lastReadAtByChannel: { ...s.lastReadAtByChannel, [channel]: next },
        };
      }),

      clearChannel: (channelId) => {
        set(s => ({
          messages: s.messages.filter(m => m.channelId !== channelId),
        }));
        wsSend?.({ type: 'channel-clear', channelId });
      },

      setSentMessagesCount: (userId, count) => {
        const safe = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0));
        set(s => ({
          accounts: s.accounts.map(a => (a.id === userId ? { ...a, sentMessagesCount: safe } : a)),
          currentUser: s.currentUser?.id === userId ? { ...s.currentUser, sentMessagesCount: safe } : s.currentUser,
        }));
        wsSend?.({ type: 'account-stats', userId, sentMessagesCount: safe });
      },

      setModeration: (userId, patch) => {
        const normalized: Partial<Pick<Account, 'mutedUntil' | 'bannedUntil' | 'banReason'>> = {
          ...(typeof patch.mutedUntil === 'number' ? { mutedUntil: Math.max(0, patch.mutedUntil) } : {}),
          ...(typeof patch.bannedUntil === 'number' ? { bannedUntil: Math.max(0, patch.bannedUntil) } : {}),
          ...(typeof patch.banReason === 'string' ? { banReason: patch.banReason } : {}),
        };
        set(s => ({
          accounts: s.accounts.map(a => (a.id === userId ? { ...a, ...normalized } : a)),
          currentUser: s.currentUser?.id === userId ? { ...s.currentUser, ...normalized } : s.currentUser,
        }));
        wsSend?.({ type: 'account-moderation', userId, patch: normalized });
      },

      updateMarket: () => {
        set(s => ({
          marketItems: s.marketItems.map(item => {
            const last = item.history[item.history.length - 1];
            const newPrice = Math.max(10, last.price + Math.floor((Math.random() - 0.5) * item.currentPrice * 0.08));
            const newHistory = [...item.history.slice(-29), { time: Date.now(), price: newPrice }];
            return {
              ...item,
              currentPrice: newPrice,
              history: newHistory,
              currency: randomCurrency(newPrice),
              trend: newPrice > last.price ? 'up' : newPrice < last.price ? 'down' : 'stable',
            };
          }),
        }));
      },

      updateProfile: (userId, updates) => {
        set(s => ({
          accounts: s.accounts.map(a => a.id === userId ? { ...a, ...updates } : a),
          currentUser: s.currentUser?.id === userId
            ? { ...s.currentUser, ...updates }
            : s.currentUser,
        }));
      },

      addProfileReaction: (fromId, fromName, toId, text) => {
        const reaction: ProfileReaction = {
          id: uuidv4(),
          fromId,
          fromName,
          toId,
          text,
          timestamp: Date.now(),
        };
        set(s => ({ profileReactions: [...s.profileReactions, reaction] }));
        wsSend?.({ type: 'profile-reaction-new', reaction });
      },

      getProfileReactions: (userId) => {
        return get().profileReactions.filter(r => r.toId === userId);
      },
    }),
    {
      name: 'worldplugin-storage',
      partialize: (state) => ({
        accounts: state.accounts,
        messages: state.messages,
        friendRequests: state.friendRequests,
        orders: state.orders,
        marketItems: state.marketItems,
        profileReactions: state.profileReactions,
        persistSession: state.persistSession,
        lastReadAtByChannel: state.lastReadAtByChannel,
        npcBotEnabled: state.npcBotEnabled,
        npcIntervalMinMs: state.npcIntervalMinMs,
        npcIntervalMaxMs: state.npcIntervalMaxMs,
        ...(state.persistSession && state.currentUser ? { currentUser: state.currentUser } : {}),
      }),
    }
  )
);

function clearNpcSchedule() {
  if (npcInterval) {
    clearTimeout(npcInterval);
    npcInterval = null;
  }
}

function scheduleNextNpc() {
  clearNpcSchedule();
  const state = useStore.getState();
  if (!state.npcBotEnabled) return;
  const span = Math.max(1000, state.npcIntervalMaxMs - state.npcIntervalMinMs);
  const delay = state.npcIntervalMinMs + Math.random() * span;
  npcInterval = setTimeout(() => {
    const msg = NPC_MESSAGES[Math.floor(Math.random() * NPC_MESSAGES.length)];
    useStore.getState().sendMessage('main', 'npc', msg[0], msg[1], undefined, true);
    scheduleNextNpc();
  }, delay);
}

export function startNPCMessages() {
  const store = useStore.getState();
  if (store.npcBotEnabled) {
    const existing = store.messages.filter(m => m.channelId === 'main' && m.isNPC);
    if (existing.length === 0) {
      for (let i = 0; i < 5; i++) {
        const msg = NPC_MESSAGES[Math.floor(Math.random() * NPC_MESSAGES.length)];
        store.sendMessage('main', 'npc', msg[0], msg[1], undefined, true);
      }
    }
  }
  clearNpcSchedule();
  scheduleNextNpc();
}

function mergeMessageLists(a: ChatMessage[], b: ChatMessage[]): ChatMessage[] {
  const map = new Map<string, ChatMessage>();
  for (const m of a) map.set(m.id, m);
  for (const m of b) map.set(m.id, m);
  const merged = Array.from(map.values()).sort((x, y) => x.timestamp - y.timestamp);
  return merged.length > MAX_LOCAL_MESSAGES ? merged.slice(-MAX_LOCAL_MESSAGES) : merged;
}

/** Слияние с сервером или другой вкладкой: общий чат по id. */
export function mergeRemoteMessages(incoming: ChatMessage[]) {
  useStore.setState(s => {
    const existingIds = new Set(s.messages.map(m => m.id));
    const newOnes = incoming.filter(m => !existingIds.has(m.id));
    if (newOnes.length === 0) return s;

    const incByAuthor = new Map<string, number>();
    for (const m of newOnes) {
      if (m.isNPC) continue;
      incByAuthor.set(m.authorId, (incByAuthor.get(m.authorId) ?? 0) + 1);
    }

    return {
      messages: mergeMessageLists(s.messages, incoming),
      accounts: s.accounts.map(a => {
        const inc = incByAuthor.get(a.id) ?? 0;
        return inc > 0 ? { ...a, sentMessagesCount: (a.sentMessagesCount ?? 0) + inc } : a;
      }),
      currentUser:
        s.currentUser && incByAuthor.has(s.currentUser.id)
          ? {
              ...s.currentUser,
              sentMessagesCount:
                (s.currentUser.sentMessagesCount ?? 0) + (incByAuthor.get(s.currentUser.id) ?? 0),
            }
          : s.currentUser,
    };
  });
}

/**
 * Авторитетная замена полного списка сообщений.
 * Нужна, чтобы корректно обрабатывать удаления (например, очистку канала).
 */
export function replaceRemoteMessages(incoming: ChatMessage[]) {
  useStore.setState(s => {
    const existingIds = new Set(s.messages.map(m => m.id));
    const newOnes = incoming.filter(m => !existingIds.has(m.id));

    const incByAuthor = new Map<string, number>();
    for (const m of newOnes) {
      if (m.isNPC) continue;
      incByAuthor.set(m.authorId, (incByAuthor.get(m.authorId) ?? 0) + 1);
    }

    const sorted = [...incoming].sort((x, y) => x.timestamp - y.timestamp);
    const nextMessages = sorted.length > MAX_LOCAL_MESSAGES ? sorted.slice(-MAX_LOCAL_MESSAGES) : sorted;

    return {
      messages: nextMessages,
      accounts: s.accounts.map(a => {
        const inc = incByAuthor.get(a.id) ?? 0;
        return inc > 0 ? { ...a, sentMessagesCount: (a.sentMessagesCount ?? 0) + inc } : a;
      }),
      currentUser:
        s.currentUser && incByAuthor.has(s.currentUser.id)
          ? {
              ...s.currentUser,
              sentMessagesCount:
                (s.currentUser.sentMessagesCount ?? 0) + (incByAuthor.get(s.currentUser.id) ?? 0),
            }
          : s.currentUser,
    };
  });
}

export function applyRemoteChannelClear(channelId: string) {
  useStore.setState(s => ({
    messages: s.messages.filter(m => m.channelId !== channelId),
  }));
}

export function appendRemoteProfileReaction(reaction: ProfileReaction) {
  useStore.setState(s => {
    if (s.profileReactions.some(r => r.id === reaction.id)) return s;
    return { profileReactions: [...s.profileReactions, reaction] };
  });
}

export function replaceRemoteProfileReactions(incoming: ProfileReaction[]) {
  useStore.setState(s => {
    const byId = new Map<string, ProfileReaction>();
    for (const r of s.profileReactions) byId.set(r.id, r);
    for (const r of incoming) byId.set(r.id, r);
    const next = Array.from(byId.values()).sort((a, b) => a.timestamp - b.timestamp);
    if (next.length === s.profileReactions.length) {
      let same = true;
      for (let i = 0; i < next.length; i++) {
        const a = next[i];
        const b = s.profileReactions[i];
        if (!b || a.id !== b.id || a.text !== b.text || a.timestamp !== b.timestamp) {
          same = false;
          break;
        }
      }
      if (same) return s;
    }
    return { profileReactions: next };
  });
}

export function replaceRemoteOrders(incoming: Order[]) {
  useStore.setState(s => {
    const byId = new Map<string, Order>();
    for (const o of s.orders) byId.set(o.id, o);
    for (const o of incoming) byId.set(o.id, o);
    const next = Array.from(byId.values()).sort((a, b) => a.createdAt - b.createdAt);
    if (next.length === s.orders.length) {
      let same = true;
      for (let i = 0; i < next.length; i++) {
        const a = next[i];
        const b = s.orders[i];
        if (
          !b ||
          a.id !== b.id ||
          a.acceptedById !== b.acceptedById ||
          a.acceptedByName !== b.acceptedByName ||
          a.channelId !== b.channelId
        ) {
          same = false;
          break;
        }
      }
      if (same) return s;
    }
    return { orders: next };
  });
}

export function appendRemoteOrder(order: Order) {
  useStore.setState(s => {
    if (s.orders.some(o => o.id === order.id)) return s;
    return { orders: [...s.orders, order].sort((a, b) => a.createdAt - b.createdAt) };
  });
}

export function applyRemoteOrderAccept(orderId: string, userId: string, userName: string, channelId: string) {
  useStore.setState(s => ({
    orders: s.orders.map(o =>
      o.id === orderId ? { ...o, acceptedById: userId, acceptedByName: userName, channelId } : o
    ),
  }));
}

export function applyRemoteOrderComplete(orderId: string, channelId?: string) {
  useStore.setState(s => ({
    orders: s.orders.filter(o => o.id !== orderId),
    messages: channelId ? s.messages.filter(m => m.channelId !== channelId) : s.messages,
  }));
}

export function applyRemoteModeration(
  userId: string,
  patch: Partial<Pick<Account, 'mutedUntil' | 'bannedUntil' | 'banReason'>>
) {
  useStore.setState(s => ({
    accounts: s.accounts.map(a => (a.id === userId ? { ...a, ...patch } : a)),
    currentUser: s.currentUser?.id === userId ? { ...s.currentUser, ...patch } : s.currentUser,
  }));
}

export function applyRemoteSentMessagesCount(userId: string, count: number) {
  const safe = Math.max(0, Math.floor(count));
  useStore.setState(s => ({
    accounts: s.accounts.map(a => (a.id === userId ? { ...a, sentMessagesCount: safe } : a)),
    currentUser: s.currentUser?.id === userId ? { ...s.currentUser, sentMessagesCount: safe } : s.currentUser,
  }));
}

export function applyRemoteFriendRemove(userId: string, friendId: string) {
  const [a, b] = [userId, friendId].sort();
  useStore.setState(s => ({
    friendRequests: s.friendRequests.filter(r => {
      const pair = [r.fromId, r.toId].sort();
      if (pair[0] !== a || pair[1] !== b) return true;
      return r.status !== 'accepted';
    }),
  }));
}

export function appendRemoteMessage(msg: ChatMessage) {
  useStore.setState(s => {
    if (s.messages.some(m => m.id === msg.id)) return s;
    const inc =
      !msg.isNPC && s.accounts.some(a => a.id === msg.authorId)
        ? 1
        : 0;
    return {
      messages: [...s.messages, msg].slice(-MAX_LOCAL_MESSAGES),
      accounts: inc
        ? s.accounts.map(a =>
            a.id === msg.authorId ? { ...a, sentMessagesCount: (a.sentMessagesCount ?? 0) + 1 } : a
          )
        : s.accounts,
      currentUser:
        inc && s.currentUser?.id === msg.authorId
          ? { ...s.currentUser, sentMessagesCount: (s.currentUser.sentMessagesCount ?? 0) + 1 }
          : s.currentUser,
    };
  });
}

function friendStatusRank(s: FriendRequest['status']): number {
  if (s === 'accepted' || s === 'rejected') return 2;
  return 1;
}

/** Слияние по id: accepted/rejected не затираются устаревшим pending с тем же id. */
function mergeFriendRequestLists(a: FriendRequest[], b: FriendRequest[]): FriendRequest[] {
  const byId = new Map<string, FriendRequest>();
  const put = (r: FriendRequest) => {
    const cur = byId.get(r.id);
    if (!cur) {
      byId.set(r.id, r);
      return;
    }
    const nr = friendStatusRank(r.status);
    const nc = friendStatusRank(cur.status);
    if (nr > nc) byId.set(r.id, r);
    else if (nr === nc && r.timestamp >= cur.timestamp) byId.set(r.id, r);
  };
  for (const r of a) put(r);
  for (const r of b) put(r);
  return Array.from(byId.values()).sort((x, y) => x.timestamp - y.timestamp);
}

export function mergeRemoteFriendRequests(incoming: FriendRequest[]) {
  useStore.setState(s => {
    const next = mergeFriendRequestLists(s.friendRequests, incoming);
    if (next.length === s.friendRequests.length) {
      let same = true;
      for (let i = 0; i < next.length; i++) {
        if (next[i].id !== s.friendRequests[i]?.id || next[i].status !== s.friendRequests[i]?.status) {
          same = false;
          break;
        }
      }
      if (same) return s;
    }
    return { friendRequests: next };
  });
}

export function appendRemoteFriendRequest(r: FriendRequest) {
  useStore.setState(s => {
    if (s.friendRequests.some(x => x.id === r.id)) return s;
    if (r.status === 'pending') {
      if (
        s.friendRequests.some(
          x => x.fromId === r.fromId && x.toId === r.toId && (x.status === 'accepted' || x.status === 'rejected')
        )
      ) {
        return s;
      }
      if (
        s.friendRequests.some(
          x => x.fromId === r.fromId && x.toId === r.toId && x.status === 'pending'
        )
      ) {
        return s;
      }
    }
    return { friendRequests: [...s.friendRequests, r] };
  });
}

export function applyRemoteFriendRequestStatus(requestId: string, status: 'accepted' | 'rejected') {
  useStore.setState(s => ({
    friendRequests: s.friendRequests.map(r =>
      r.id === requestId ? { ...r, status } : r
    ),
  }));
}
