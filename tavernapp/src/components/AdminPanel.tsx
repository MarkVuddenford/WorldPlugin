import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { getPlayerRoleBySentMessages, useStore } from '../store';

interface Props {
  onExit: () => void;
}

export default function AdminPanel({ onExit }: Props) {
  const {
    accounts, orders, messages,
    createAccount, deleteAccount, createOrder, sendMessage,
    clearChannel, addProfileReaction, setSentMessagesCount, setModeration,
    completeOrder,
    npcBotEnabled, npcIntervalMinMs, npcIntervalMaxMs, setNpcBotConfig,
  } = useStore(
    useShallow(s => ({
      accounts: s.accounts,
      orders: s.orders,
      messages: s.messages,
      createAccount: s.createAccount,
      deleteAccount: s.deleteAccount,
      createOrder: s.createOrder,
      sendMessage: s.sendMessage,
      clearChannel: s.clearChannel,
      addProfileReaction: s.addProfileReaction,
      setSentMessagesCount: s.setSentMessagesCount,
      setModeration: s.setModeration,
      completeOrder: s.completeOrder,
      npcBotEnabled: s.npcBotEnabled,
      npcIntervalMinMs: s.npcIntervalMinMs,
      npcIntervalMaxMs: s.npcIntervalMaxMs,
      setNpcBotConfig: s.setNpcBotConfig,
    }))
  );
  const [tab, setTab] = useState<'accounts' | 'orders' | 'chat' | 'bots' | 'reactions' | 'roles' | 'moderation'>('accounts');
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');
  const [createMsg, setCreateMsg] = useState('');
  const [orderResident, setOrderResident] = useState('');
  const [orderTitle, setOrderTitle] = useState('');
  const [orderDesc, setOrderDesc] = useState('');
  const [orderReward, setOrderReward] = useState('');
  const [orderMsg, setOrderMsg] = useState('');
  const [chatText, setChatText] = useState('');
  const [sendMode, setSendMode] = useState<'main' | 'dm' | 'channel'>('main');
  const [senderId, setSenderId] = useState<string>('custom');
  const [customSenderName, setCustomSenderName] = useState<string>('Вестник');
  const [customSenderAvatarUrl, setCustomSenderAvatarUrl] = useState<string>('');
  const [receiverId, setReceiverId] = useState<string>('');

  const [clearChannelId, setClearChannelId] = useState<string>('main');
  const [sendChannelId, setSendChannelId] = useState<string>('main');
  const [orderSenderId, setOrderSenderId] = useState<string>('');
  const [orderSenderText, setOrderSenderText] = useState<string>('');

  const [reactionToId, setReactionToId] = useState<string>('');
  const [reactionFromNick, setReactionFromNick] = useState<string>('');
  const [reactionText, setReactionText] = useState<string>('');

  const [roleAccountId, setRoleAccountId] = useState<string>('');
  const [roleCountInput, setRoleCountInput] = useState<string>('0');
  const [modUserId, setModUserId] = useState<string>('');
  const [muteHours, setMuteHours] = useState<string>('1');
  const [banHours, setBanHours] = useState<string>('24');
  const [banReason, setBanReason] = useState<string>('Нарушение правил');

  useEffect(() => {
    if (accounts.length === 0) return;
    if (senderId === 'custom' && !customSenderName) setCustomSenderName('Вестник');
    if (!receiverId) setReceiverId(accounts[0].id);
    if (!reactionToId) setReactionToId(accounts[0].id);
    if (!reactionFromNick) setReactionFromNick(accounts[0].username);
    if (!roleAccountId) setRoleAccountId(accounts[0].id);
    if (!modUserId) setModUserId(accounts[0].id);
    if (!orderSenderId) {
      const firstAccepted = orders.find(o => o.acceptedById && o.channelId);
      if (firstAccepted) setOrderSenderId(firstAccepted.id);
    }
  }, [accounts, senderId, customSenderName, receiverId, reactionToId, reactionFromNick, roleAccountId, modUserId]);

  const dmChannelId = useMemo(() => {
    if (!senderId || !receiverId) return '';
    return `friend_${[senderId, receiverId].sort().join('_')}`;
  }, [senderId, receiverId]);

  const channelOptions = useMemo(() => {
    const set = new Set<string>();
    set.add('main');
    for (const m of messages) if (m.channelId) set.add(m.channelId);
    for (const o of orders) if (o.channelId) set.add(o.channelId);
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [messages, orders]);

  useEffect(() => {
    if (channelOptions.length === 0) return;
    if (!channelOptions.includes(sendChannelId)) {
      setSendChannelId(channelOptions[0]);
    }
  }, [channelOptions, sendChannelId]);

  const handleCreateAccount = () => {
    if (!newUser.trim() || !newPass.trim()) { setCreateMsg('Заполни все поля!'); return; }
    const ok = createAccount(newUser.trim(), newPass.trim());
    if (ok) { setCreateMsg('✅ Аккаунт создан!'); setNewUser(''); setNewPass(''); }
    else setCreateMsg('❌ Такое имя уже занято!');
  };

  const handleCreateOrder = () => {
    if (!orderResident.trim() || !orderTitle.trim() || !orderDesc.trim() || !orderReward.trim()) {
      setOrderMsg('Заполни все поля!'); return;
    }
    createOrder(orderResident.trim(), orderTitle.trim(), orderDesc.trim(), orderReward.trim());
    setOrderMsg('✅ Заказ создан!');
    setOrderResident(''); setOrderTitle(''); setOrderDesc(''); setOrderReward('');
  };

  const acceptedOrders = orders.filter(o => o.acceptedById);
  const selectedAcceptedOrder = acceptedOrders.find(o => o.id === orderSenderId);

  const senderAcc = accounts.find(a => a.id === senderId) ?? null;
  const receiverAcc = accounts.find(a => a.id === receiverId) ?? null;
  const reactionToAcc = accounts.find(a => a.id === reactionToId) ?? null;
  const roleAcc = accounts.find(a => a.id === roleAccountId) ?? null;

  const handleSendChat = () => {
    const text = chatText.trim();
    if (!text) return;
    const senderName = senderId === 'custom' ? customSenderName.trim() : (senderAcc?.username ?? '');
    if (!senderName) return;
    const senderAuthorId = senderId === 'custom' ? `admin_custom_${senderName}` : (senderAcc?.id ?? '');
    if (!senderAuthorId) return;
    const avatarUrl = senderId === 'custom' ? (customSenderAvatarUrl.trim() || undefined) : senderAcc?.avatarUrl;
    if (sendMode === 'main') {
      sendMessage('main', senderAuthorId, senderName, text, undefined, false, avatarUrl);
      setChatText('');
      return;
    }
    if (sendMode === 'channel') {
      if (!sendChannelId) return;
      sendMessage(sendChannelId, senderAuthorId, senderName, text, undefined, false, avatarUrl);
      setChatText('');
      return;
    }
    if (!receiverAcc) return;
    if (!dmChannelId) return;
    sendMessage(dmChannelId, senderAuthorId, senderName, text, undefined, false, avatarUrl);
    setChatText('');
  };

  const handleClearChannel = () => {
    if (!clearChannelId) return;
    const ok = window.confirm(`Очистить канал: ${clearChannelId}?`);
    if (!ok) return;
    clearChannel(clearChannelId);
  };

  const handleAddReaction = () => {
    if (!reactionToAcc) return;
    const fromNick = reactionFromNick.trim();
    const text = reactionText.trim();
    if (!fromNick || !text) return;
    addProfileReaction(`admin_${fromNick}`, fromNick, reactionToAcc.id, text);
    setReactionText('');
  };

  const handleSetRole = () => {
    if (!roleAcc) return;
    const n = Math.max(0, Math.floor(Number(roleCountInput)));
    if (!Number.isFinite(n)) return;
    setSentMessagesCount(roleAcc.id, n);
  };

  const handleMute = () => {
    const h = Math.max(0, Number(muteHours));
    if (!Number.isFinite(h) || !modUserId) return;
    setModeration(modUserId, { mutedUntil: h > 0 ? Date.now() + h * 3600_000 : 0 });
  };

  const handleSendAsResident = () => {
    if (!selectedAcceptedOrder?.channelId) return;
    const text = orderSenderText.trim();
    if (!text) return;
    sendMessage(
      selectedAcceptedOrder.channelId,
      `order_resident_${selectedAcceptedOrder.id}`,
      selectedAcceptedOrder.residentName,
      text,
      undefined,
      false
    );
    setOrderSenderText('');
  };

  const handleBan = () => {
    const h = Math.max(0, Number(banHours));
    if (!Number.isFinite(h) || !modUserId) return;
    setModeration(modUserId, {
      bannedUntil: h > 0 ? Date.now() + h * 3600_000 : 0,
      banReason: banReason.trim(),
    });
  };

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <div className="admin-title-row">
          <span className="admin-icon">⚙️</span>
          <h1 className="admin-title">ПАНЕЛЬ АДМИНИСТРАТОРА</h1>
        </div>
        <button className="mc-btn mc-btn-danger" onClick={onExit}>ВЫЙТИ ИЗ ПАНЕЛИ</button>
      </div>

      <div className="admin-tabs">
        <button className={`admin-tab ${tab === 'accounts' ? 'active' : ''}`} onClick={() => setTab('accounts')}>👥 АККАУНТЫ</button>
        <button className={`admin-tab ${tab === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')}>📜 ЗАКАЗЫ</button>
        <button className={`admin-tab ${tab === 'chat' ? 'active' : ''}`} onClick={() => setTab('chat')}>💬 ЧАТЫ</button>
        <button className={`admin-tab ${tab === 'bots' ? 'active' : ''}`} onClick={() => setTab('bots')}>🤖 БОТЫ</button>
        <button className={`admin-tab ${tab === 'reactions' ? 'active' : ''}`} onClick={() => setTab('reactions')}>📝 РЕАКЦИИ</button>
        <button className={`admin-tab ${tab === 'roles' ? 'active' : ''}`} onClick={() => setTab('roles')}>🏅 РОЛИ</button>
        <button className={`admin-tab ${tab === 'moderation' ? 'active' : ''}`} onClick={() => setTab('moderation')}>🚫 МОДЕРАЦИЯ</button>
      </div>

      <div className="admin-content">
        {tab === 'accounts' && (
          <div className="admin-section">
            <h2 className="section-title">СОЗДАТЬ АККАУНТ</h2>
            <div className="admin-form-row">
              <input className="mc-input" placeholder="Имя персонажа..." value={newUser} onChange={e => setNewUser(e.target.value)} />
              <input className="mc-input" type="password" placeholder="Пароль..." value={newPass} onChange={e => setNewPass(e.target.value)} />
              <button className="mc-btn mc-btn-primary" onClick={handleCreateAccount}>СОЗДАТЬ</button>
            </div>
            {createMsg && <div className="admin-msg">{createMsg}</div>}

            <h2 className="section-title" style={{ marginTop: 32 }}>СПИСОК АККАУНТОВ ({accounts.length})</h2>
            <div className="accounts-list">
              {accounts.length === 0 && <div className="empty-msg">Нет аккаунтов</div>}
              {accounts.map(acc => (
                <div key={acc.id} className="account-card">
                  <span className="acc-avatar">{acc.avatar}</span>
                  <div className="acc-info">
                    <span className="acc-name">{acc.username}</span>
                    <span className="acc-pass">Пароль: {acc.password}</span>
                  </div>
                  <button className="mc-btn mc-btn-danger small" onClick={() => deleteAccount(acc.id)}>УДАЛИТЬ</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'orders' && (
          <div className="admin-section">
            <h2 className="section-title">СОЗДАТЬ ЗАКАЗ</h2>
            <div className="admin-form-col">
              <input className="mc-input" placeholder="Имя жителя (заказчик)..." value={orderResident} onChange={e => setOrderResident(e.target.value)} />
              <input className="mc-input" placeholder="Заголовок заказа..." value={orderTitle} onChange={e => setOrderTitle(e.target.value)} />
              <textarea className="mc-textarea" placeholder="Описание задания..." value={orderDesc} onChange={e => setOrderDesc(e.target.value)} rows={3} />
              <input className="mc-input" placeholder="Награда (например: 500 золотых монет)..." value={orderReward} onChange={e => setOrderReward(e.target.value)} />
              <button className="mc-btn mc-btn-primary" onClick={handleCreateOrder}>ОПУБЛИКОВАТЬ ЗАКАЗ</button>
            </div>
            {orderMsg && <div className="admin-msg">{orderMsg}</div>}

            <h2 className="section-title" style={{ marginTop: 32 }}>АКТИВНЫЕ ЗАКАЗЫ</h2>
            <div className="orders-admin-list">
              {orders.filter(o => !o.acceptedById).length === 0 && <div className="empty-msg">Нет активных заказов</div>}
              {orders.filter(o => !o.acceptedById).map(o => (
                <div key={o.id} className="order-admin-card">
                  <div className="order-resident">📜 {o.residentName}</div>
                  <div className="order-title-text">{o.title}</div>
                  <div className="order-reward-text">💰 {o.reward}</div>
                </div>
              ))}
            </div>

            {acceptedOrders.length > 0 && (
              <>
                <h2 className="section-title" style={{ marginTop: 32 }}>ПРИНЯТЫЕ ЗАКАЗЫ</h2>
                <div className="orders-admin-list">
                  {acceptedOrders.map(o => (
                    <div key={o.id} className="order-admin-card accepted">
                      <div className="order-resident">📜 {o.residentName} → {o.acceptedByName}</div>
                      <div className="order-title-text">{o.title}</div>
                      <button className="mc-btn mc-btn-danger small" onClick={() => completeOrder(o.id)}>
                        ✅ ЗАВЕРШИТЬ ЗАКАЗ
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'chat' && (
          <div className="admin-section">
            <h2 className="section-title">ОЧИСТКА КАНАЛОВ</h2>
            <div className="admin-form-row">
              <select className="mc-input mc-select" value={clearChannelId} onChange={e => setClearChannelId(e.target.value)}>
                {channelOptions.map(ch => (
                  <option key={ch} value={ch}>{ch}</option>
                ))}
              </select>
              <button className="mc-btn mc-btn-danger small" onClick={handleClearChannel}>ОЧИСТИТЬ</button>
            </div>

            <h2 className="section-title" style={{ marginTop: 28 }}>ПИСАТЬ ИГРОКАМ</h2>
            <div className="admin-form-col">
              <div className="admin-form-row">
                <div className="admin-form-col" style={{ flex: 1 }}>
                  <label className="form-label">РЕЖИМ</label>
                  <select className="mc-input mc-select" value={sendMode} onChange={e => setSendMode(e.target.value as 'main' | 'dm' | 'channel')}>
                    <option value="main">В основной канал</option>
                    <option value="dm">Личный чат (DM)</option>
                    <option value="channel">В конкретный канал</option>
                  </select>
                </div>
                {sendMode === 'channel' && (
                  <div className="admin-form-col" style={{ flex: 1 }}>
                    <label className="form-label">КАНАЛ</label>
                    <select className="mc-input mc-select" value={sendChannelId} onChange={e => setSendChannelId(e.target.value)}>
                      {channelOptions.map(ch => (
                        <option key={ch} value={ch}>{ch}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="admin-form-col" style={{ flex: 1 }}>
                  <label className="form-label">ОТ ИМЕНИ</label>
                  <select className="mc-input mc-select" value={senderId} onChange={e => setSenderId(e.target.value)}>
                    <option value="custom">Произвольный ник</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.username}</option>
                    ))}
                  </select>
                </div>
                {senderId === 'custom' && (
                  <>
                    <div className="admin-form-col" style={{ flex: 1 }}>
                      <label className="form-label">ПРОИЗВОЛЬНЫЙ НИК</label>
                      <input
                        className="mc-input"
                        value={customSenderName}
                        onChange={e => setCustomSenderName(e.target.value)}
                        placeholder="Любой ник"
                      />
                    </div>
                    <div className="admin-form-col" style={{ flex: 1 }}>
                      <label className="form-label">АВАТАР URL (ОПЦИОНАЛЬНО)</label>
                      <input
                        className="mc-input"
                        value={customSenderAvatarUrl}
                        onChange={e => setCustomSenderAvatarUrl(e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                  </>
                )}
                {sendMode === 'dm' && (
                  <div className="admin-form-col" style={{ flex: 1 }}>
                    <label className="form-label">КОМУ</label>
                    <select className="mc-input mc-select" value={receiverId} onChange={e => setReceiverId(e.target.value)}>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.username}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <textarea
                className="mc-textarea"
                placeholder="Сообщение..."
                value={chatText}
                onChange={e => setChatText(e.target.value)}
                rows={3}
              />
              <button className="mc-btn mc-btn-primary" onClick={handleSendChat}>ОТПРАВИТЬ</button>
            </div>

            <h2 className="section-title" style={{ marginTop: 28 }}>ПИСАТЬ ОТ ИМЕНИ ЗАКАЗЧИКА</h2>
            <div className="admin-form-col">
              <select className="mc-input mc-select" value={orderSenderId} onChange={e => setOrderSenderId(e.target.value)}>
                <option value="">Выберите принятый заказ</option>
                {acceptedOrders.filter(o => o.channelId).map(o => (
                  <option key={o.id} value={o.id}>
                    {o.residentName} → {o.acceptedByName} ({o.channelId})
                  </option>
                ))}
              </select>
              <textarea
                className="mc-textarea"
                placeholder="Сообщение от имени заказчика..."
                value={orderSenderText}
                onChange={e => setOrderSenderText(e.target.value)}
                rows={3}
              />
              <button className="mc-btn mc-btn-primary" onClick={handleSendAsResident} disabled={!selectedAcceptedOrder?.channelId}>
                ОТПРАВИТЬ КАК ЗАКАЗЧИК
              </button>
            </div>

            <h2 className="section-title" style={{ marginTop: 32 }}>ПОСЛЕДНИЕ СООБЩЕНИЯ (Основной)</h2>
            <div className="admin-messages">
              {messages.filter(m => m.channelId === 'main').slice(-20).reverse().map(m => (
                <div key={m.id} className="admin-msg-item">
                  <span className="admin-msg-author">{m.authorName}:</span>
                  <span className="admin-msg-text">{m.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'reactions' && (
          <div className="admin-section">
            <h2 className="section-title">ДОБАВИТЬ РЕАКЦИЮ В ПРОФИЛЬ</h2>
            <div className="admin-form-col">
              <label className="form-label">К КОМУ</label>
              <select className="mc-input mc-select" value={reactionToId} onChange={e => setReactionToId(e.target.value)}>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.username}</option>
                ))}
              </select>

              <label className="form-label">ОТ КАКОГО НИКА</label>
              <input
                className="mc-input"
                placeholder="Например: Странник"
                value={reactionFromNick}
                onChange={e => setReactionFromNick(e.target.value)}
              />

              <textarea
                className="mc-textarea"
                placeholder="Текст реакции..."
                value={reactionText}
                onChange={e => setReactionText(e.target.value)}
                rows={3}
              />

              <button className="mc-btn mc-btn-primary" onClick={handleAddReaction}>
                ДОБАВИТЬ
              </button>
            </div>
          </div>
        )}

        {tab === 'roles' && (
          <div className="admin-section">
            <h2 className="section-title">РОЛИ ПО СЧЁТЧИКУ СООБЩЕНИЙ</h2>
            <div className="admin-msg" style={{ marginBottom: 16 }}>
              Считаем «сколько раз отправлял сообщения», а не длину текста. ЛЕГЕНДА начинается с 5000+.
            </div>

            <div className="admin-form-row" style={{ alignItems: 'stretch' }}>
              <div className="admin-form-col" style={{ flex: 1 }}>
                <label className="form-label">КАКОМУ ИГРОКУ</label>
                <select className="mc-input mc-select" value={roleAccountId} onChange={e => setRoleAccountId(e.target.value)}>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.username}</option>
                  ))}
                </select>
              </div>
              <div className="admin-form-col" style={{ flex: 1 }}>
                <label className="form-label">НОВЫЙ СЧЁТЧИК (ПРЯМОЕ ЗНАЧЕНИЕ)</label>
                <input
                  className="mc-input"
                  type="number"
                  min={0}
                  value={roleCountInput}
                  onChange={e => setRoleCountInput(e.target.value)}
                />
              </div>
              <div className="admin-form-col" style={{ flex: 0.5, justifyContent: 'flex-end' }}>
                <button className="mc-btn mc-btn-primary small" onClick={handleSetRole}>
                  ВЫДАТЬ
                </button>
              </div>
            </div>

            <h2 className="section-title" style={{ marginTop: 24 }}>ТЕКУЩИЕ РОЛИ</h2>
            <div className="accounts-list">
              {accounts.map(a => (
                <div key={a.id} className="account-card">
                  <span className="acc-avatar">{a.avatar}</span>
                  <div className="acc-info">
                    <span className="acc-name">{a.username}</span>
                    <span className="acc-pass">Сообщений: {a.sentMessagesCount ?? 0}</span>
                    <span className="acc-pass">
                      Роль: {getPlayerRoleBySentMessages(a.sentMessagesCount ?? 0).label}
                    </span>
                  </div>
                  <button
                    className="mc-btn mc-btn-secondary small"
                    onClick={() => {
                      setRoleAccountId(a.id);
                      setRoleCountInput(String(a.sentMessagesCount ?? 0));
                    }}
                  >
                    РЕДАКТ.
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'moderation' && (
          <div className="admin-section">
            <h2 className="section-title">МУТЫ И БАНЫ</h2>
            <div className="admin-form-col">
              <label className="form-label">ИГРОК</label>
              <select className="mc-input mc-select" value={modUserId} onChange={e => setModUserId(e.target.value)}>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.username}</option>
                ))}
              </select>

              <div className="admin-form-row" style={{ flexWrap: 'wrap' }}>
                <div className="admin-form-col" style={{ flex: 1 }}>
                  <label className="form-label">МУТ (ЧАСЫ, 0 = СНЯТЬ)</label>
                  <input className="mc-input" type="number" min={0} value={muteHours} onChange={e => setMuteHours(e.target.value)} />
                  <button className="mc-btn mc-btn-secondary small" onClick={handleMute}>ПРИМЕНИТЬ МУТ</button>
                </div>

                <div className="admin-form-col" style={{ flex: 1 }}>
                  <label className="form-label">БАН (ЧАСЫ, 0 = СНЯТЬ)</label>
                  <input className="mc-input" type="number" min={0} value={banHours} onChange={e => setBanHours(e.target.value)} />
                  <input className="mc-input" placeholder="Причина" value={banReason} onChange={e => setBanReason(e.target.value)} />
                  <button className="mc-btn mc-btn-danger small" onClick={handleBan}>ПРИМЕНИТЬ БАН</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'bots' && (
          <div className="admin-section">
            <h2 className="section-title">ОСНОВНОЙ КАНАЛ — СООБЩЕНИЯ NPC</h2>
            <p className="modal-desc" style={{ marginBottom: 16 }}>
              Интервал — случайная задержка между сообщениями в пределах от минимума до максимума (секунды).
            </p>
            <label className="login-remember-label" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={npcBotEnabled}
                onChange={e => setNpcBotConfig({ npcBotEnabled: e.target.checked })}
              />
              <span>Включить автосообщения от ботов в «Основном»</span>
            </label>
            <div className="admin-form-row" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
              <div className="admin-form-col" style={{ flex: 1, minWidth: 200 }}>
                <label className="form-label">МИН. ПАУЗА (СЕК)</label>
                <input
                  className="mc-input"
                  type="number"
                  min={3}
                  max={600}
                  value={Math.round(npcIntervalMinMs / 1000)}
                  onChange={e => {
                    const sec = Number(e.target.value);
                    if (!Number.isFinite(sec)) return;
                    setNpcBotConfig({ npcIntervalMinMs: sec * 1000 });
                  }}
                />
              </div>
              <div className="admin-form-col" style={{ flex: 1, minWidth: 200 }}>
                <label className="form-label">МАКС. ПАУЗА (СЕК)</label>
                <input
                  className="mc-input"
                  type="number"
                  min={4}
                  max={600}
                  value={Math.round(npcIntervalMaxMs / 1000)}
                  onChange={e => {
                    const sec = Number(e.target.value);
                    if (!Number.isFinite(sec)) return;
                    setNpcBotConfig({ npcIntervalMaxMs: sec * 1000 });
                  }}
                />
              </div>
            </div>
            <div className="admin-msg" style={{ marginTop: 8 }}>
              Сейчас: {npcBotEnabled ? `вкл · от ${(npcIntervalMinMs / 1000).toFixed(0)} до ${(npcIntervalMaxMs / 1000).toFixed(0)} с` : 'выкл'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
