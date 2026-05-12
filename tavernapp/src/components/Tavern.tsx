import { useState, useRef, useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore, Account, getPlayerRoleBySentMessages } from '../store';
import PlayerProfile from './PlayerProfile';

interface Props {
  currentUser: Account;
}

export default function Tavern({ currentUser }: Props) {
  const {
    messages, friendRequests, orders,
    sendMessage, sendFriendRequest,
    acceptFriendRequest, rejectFriendRequest, removeFriend,
    getFriends, activeChannel, setActiveChannel, markChannelRead, lastReadAtByChannel, accounts,
  } = useStore(useShallow(s => ({
    messages: s.messages,
    friendRequests: s.friendRequests,
    orders: s.orders,
    sendMessage: s.sendMessage,
    sendFriendRequest: s.sendFriendRequest,
    acceptFriendRequest: s.acceptFriendRequest,
    rejectFriendRequest: s.rejectFriendRequest,
    removeFriend: s.removeFriend,
    getFriends: s.getFriends,
    activeChannel: s.activeChannel,
    setActiveChannel: s.setActiveChannel,
    markChannelRead: s.markChannelRead,
    lastReadAtByChannel: s.lastReadAtByChannel,
    accounts: s.accounts,
  })));

  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; targetUser: Account | null;
  } | null>(null);
  const [openProfile, setOpenProfile] = useState<Account | null>(null);
  const [friendMenu, setFriendMenu] = useState<{ x: number; y: number; user: Account } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const friends = useMemo(() => {
    const list = getFriends(currentUser.id);
    return [...list].sort((a, b) => a.username.localeCompare(b.username, 'ru'));
  }, [getFriends, friendRequests, accounts, currentUser.id]);

  const pendingRequests = friendRequests.filter(
    r => r.toId === currentUser.id && r.status === 'pending'
  );
  const sentRequests = friendRequests.filter(
    r => r.fromId === currentUser.id && r.status === 'pending'
  );

  const channels = useMemo(() => {
    const friendChannelMap = new Map<string, string>();
    for (const f of friends) {
      const id = `friend_${[currentUser.id, f.id].sort().join('_')}`;
      friendChannelMap.set(id, f.username);
    }

    const dmFromMessages = new Set<string>();
    for (const m of messages) {
      if (!m.channelId.startsWith('friend_')) continue;
      if (!m.channelId.includes(currentUser.id)) continue;
      dmFromMessages.add(m.channelId);
    }

    const dmIds = new Set<string>([
      ...friendChannelMap.keys(),
      ...dmFromMessages,
    ]);

    const dmChannels = Array.from(dmIds).map((id) => {
      const friendName = friendChannelMap.get(id);
      if (friendName) return { id, name: `💬 ${friendName}` };

      const inChannel = messages
        .filter(m => m.channelId === id)
        .sort((a, b) => b.timestamp - a.timestamp);

      const otherMsg = inChannel.find(m => m.authorId !== currentUser.id);
      const fallbackName = otherMsg?.authorName ?? 'Личка';
      return { id, name: `💬 ${fallbackName}` };
    });

    return [
      { id: 'main', name: '⚔ Основной' },
      ...dmChannels,
      ...orders
        .filter(o => o.acceptedById === currentUser.id && o.channelId)
        .map(o => ({ id: o.channelId!, name: `📜 ${o.residentName}` })),
    ];
  }, [friends, orders, currentUser.id, messages]);

  const channelMessages = messages.filter(m => m.channelId === activeChannel);
  const muteLeftMs = Math.max(0, (currentUser.mutedUntil ?? 0) - Date.now());
  const isMuted = muteLeftMs > 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [channelMessages.length]);

  useEffect(() => {
    const latestTs = channelMessages[channelMessages.length - 1]?.timestamp;
    if (!latestTs) return;
    markChannelRead(activeChannel, latestTs);
  }, [activeChannel, channelMessages.length, markChannelRead]);

  const dmUnreadByChannel = useMemo(() => {
    const result: Record<string, number> = {};
    for (const m of messages) {
      if (!m.channelId.startsWith('friend_')) continue;
      if (!m.channelId.includes(currentUser.id)) continue;
      if (m.authorId === currentUser.id) continue;
      const readTs = lastReadAtByChannel[m.channelId] ?? 0;
      if (m.timestamp > readTs) result[m.channelId] = (result[m.channelId] ?? 0) + 1;
    }
    return result;
  }, [messages, currentUser.id, lastReadAtByChannel]);

  const waitingUsers = useMemo(() => {
    return channels
      .filter(ch => ch.id.startsWith('friend_') && ch.id !== activeChannel && (dmUnreadByChannel[ch.id] ?? 0) > 0)
      .map(ch => ch.name.replace('💬 ', ''));
  }, [channels, activeChannel, dmUnreadByChannel]);

  const handleSend = () => {
    if (!text.trim() && !imageUrl.trim()) return;
    if (isMuted) return;
    sendMessage(activeChannel, currentUser.id, currentUser.username, text.trim(), imageUrl.trim() || undefined);
    setText('');
    setImageUrl('');
    setShowImageInput(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      sendMessage(activeChannel, currentUser.id, currentUser.username, text.trim() || '', ev.target?.result as string);
      setText('');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAvatarClick = (e: React.MouseEvent, targetId: string) => {
    if (targetId === 'npc') return;
    const target = accounts.find(a => a.id === targetId);
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, targetUser: target });
  };

  const handleAddFriend = () => {
    if (!contextMenu?.targetUser) return;
    const t = contextMenu.targetUser;
    sendFriendRequest(currentUser.id, currentUser.username, t.id, t.username);
    setContextMenu(null);
  };

  const handleOpenProfile = (user: Account) => {
    setOpenProfile(user);
    setContextMenu(null);
    setFriendMenu(null);
  };

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  const isAlreadyFriend = (id: string) => friends.some(f => f.id === id);
  const hasPendingRequest = (id: string) => sentRequests.some(r => r.toId === id);

  const getAccount = (id: string) => accounts.find(a => a.id === id);

  const handleRemoveFriend = (friend: Account) => {
    removeFriend(currentUser.id, friend.id);
    setFriendMenu(null);
  };

  return (
    <div className="tavern-layout" onClick={() => { setContextMenu(null); setFriendMenu(null); }}>

      {openProfile && (
        <PlayerProfile
          profileUser={openProfile}
          currentUser={currentUser}
          onClose={() => setOpenProfile(null)}
        />
      )}

      <div className="tavern-sidebar">
        <div className="sidebar-title">КАНАЛЫ</div>

        {channels.map(ch => (
          <button
            key={ch.id}
            type="button"
            className={`channel-btn ${activeChannel === ch.id ? 'active' : ''}`}
            onClick={() => setActiveChannel(ch.id)}
          >
            {ch.name}
            {dmUnreadByChannel[ch.id] ? (
              <span className="badge" style={{ marginLeft: 8 }}>{dmUnreadByChannel[ch.id]}</span>
            ) : null}
          </button>
        ))}

        {pendingRequests.length > 0 && (
          <div className="friend-requests">
            <div className="sidebar-section-title">
              ЗАЯВКИ <span className="badge">{pendingRequests.length}</span>
            </div>
            {pendingRequests.map(req => (
              <div key={req.id} className="friend-req-item">
                <span className="req-name">{req.fromName}</span>
                <div className="req-actions">
                  <button type="button" className="mc-btn mc-btn-primary small" onClick={() => acceptFriendRequest(req.id)}>✓</button>
                  <button type="button" className="mc-btn mc-btn-danger small" onClick={() => rejectFriendRequest(req.id)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {friends.length > 0 && (
          <div className="friends-list-sidebar">
            <div className="sidebar-section-title">ДРУЗЬЯ</div>
            {friends.map(f => {
              const freshF = getAccount(f.id) || f;
              return (
                <div
                  key={f.id}
                  className="friend-item clickable"
                  role="button"
                  tabIndex={0}
                  title="Клик — действия по другу"
                  onClick={e => {
                    e.stopPropagation();
                    setFriendMenu({ x: e.clientX, y: e.clientY, user: freshF });
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                      setFriendMenu({ x: rect.right, y: rect.top, user: freshF });
                    }
                  }}
                >
                  {freshF.avatarUrl ? (
                    <img src={freshF.avatarUrl} alt="" className="friend-avatar-img" />
                  ) : (
                    <span className="friend-avatar">{freshF.avatar}</span>
                  )}
                  <span className="friend-name">
                    {freshF.username}{' '}
                    <span className={`role-pill role-pill-${getPlayerRoleBySentMessages(freshF.sentMessagesCount ?? 0).id}`}>
                      {getPlayerRoleBySentMessages(freshF.sentMessagesCount ?? 0).label}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="sidebar-self">
          <button
            type="button"
            className="self-profile-btn"
            onClick={() => handleOpenProfile(getAccount(currentUser.id) || currentUser)}
          >
            {(getAccount(currentUser.id) || currentUser).avatarUrl ? (
              <img
                src={(getAccount(currentUser.id) || currentUser).avatarUrl}
                alt=""
                className="self-avatar-img"
              />
            ) : (
              <span className="self-avatar-emoji">{currentUser.avatar}</span>
            )}
            <span className="self-username">
              {currentUser.username}{' '}
              <span
                className={`role-pill role-pill-${getPlayerRoleBySentMessages(currentUser.sentMessagesCount ?? 0).id}`}
              >
                {getPlayerRoleBySentMessages(currentUser.sentMessagesCount ?? 0).label}
              </span>
            </span>
            <span className="self-edit-hint">✏️</span>
          </button>
        </div>
      </div>

      <div className="tavern-main">
        <div className="chat-header">
          <span className="chat-channel-name">
            {channels.find(c => c.id === activeChannel)?.name || '⚔ Основной'}
          </span>
          {activeChannel === 'main' && (
            <span className="chat-desc">
              Главный зал таверны — место встреч искателей приключений
            </span>
          )}
        </div>
        {waitingUsers.length > 0 && (
          <div className="admin-msg" style={{ margin: '8px 24px 0' }}>
            {waitingUsers[0]} ждёт вашего ответа
            {waitingUsers.length > 1 ? ` (+${waitingUsers.length - 1})` : ''}.
          </div>
        )}

        <div className="messages-container">
          {channelMessages.map(msg => {
            const msgAccount = getAccount(msg.authorId);
            const isOwn = msg.authorId === currentUser.id;

            return (
              <div
                key={msg.id}
                className={`message-row ${isOwn ? 'own' : ''} ${msg.isNPC ? 'npc' : ''}`}
              >
                <button
                  type="button"
                  className={`msg-avatar-btn ${msg.isNPC ? 'npc-avatar-btn' : ''}`}
                  onClick={e => !msg.isNPC && handleAvatarClick(e, msg.authorId)}
                  disabled={msg.isNPC}
                >
                  {msg.isNPC ? (
                    <span className="msg-avatar-emoji">🧝</span>
                  ) : (msgAccount?.avatarUrl || msg.authorAvatarUrl) ? (
                    <img src={msgAccount?.avatarUrl || msg.authorAvatarUrl} alt="" className="msg-avatar-img" />
                  ) : (
                    <span className="msg-avatar-emoji">{msgAccount?.avatar || '👤'}</span>
                  )}
                </button>

                <div className="message-content">
                  <div className="message-meta">
                    <span className={`msg-author ${msg.isNPC ? 'npc-author' : isOwn ? 'own-author' : ''}`}>
                      {msg.authorName}
                    </span>
                    {!msg.isNPC && msgAccount && (
                      <span className={`role-pill role-pill-${getPlayerRoleBySentMessages(msgAccount.sentMessagesCount ?? 0).id}`}>
                        {getPlayerRoleBySentMessages(msgAccount.sentMessagesCount ?? 0).label}
                      </span>
                    )}
                    {msg.isNPC && <span className="npc-tag">NPC</span>}
                    <span className="msg-time">{formatTime(msg.timestamp)}</span>
                  </div>
                  <div className="message-bubble">
                    {msg.text && <span className="msg-text">{msg.text}</span>}
                    {msg.imageUrl && (
                      <img
                        src={msg.imageUrl}
                        alt="вложение"
                        className="msg-image"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          {showImageInput && (
            <div className="image-url-row">
              <input
                className="mc-input"
                placeholder="Вставь ссылку на картинку..."
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
              />
              <button
                type="button"
                className="mc-btn mc-btn-secondary small"
                onClick={() => { setShowImageInput(false); setImageUrl(''); }}
              >✕</button>
            </div>
          )}
          <div className="input-row">
            <button
              type="button"
              className="mc-btn mc-btn-secondary icon-btn"
              onClick={() => setShowImageInput(!showImageInput)}
              title="Вставить картинку по ссылке"
            >🖼</button>
            <button
              type="button"
              className="mc-btn mc-btn-secondary icon-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Загрузить файл"
            >📎</button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <input
              className="mc-input chat-input"
              placeholder={
                isMuted
                  ? `Мут до ${new Date(currentUser.mutedUntil ?? 0).toLocaleTimeString('ru-RU')}`
                  : `Пиши в ${channels.find(c => c.id === activeChannel)?.name || 'канал'}...`
              }
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              disabled={isMuted}
            />
            <button type="button" className="mc-btn mc-btn-primary" onClick={handleSend} disabled={isMuted}>
              ОТПРАВИТЬ
            </button>
          </div>
        </div>
      </div>

      {contextMenu && contextMenu.targetUser && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          <div className="ctx-user-info">
            {contextMenu.targetUser.avatarUrl ? (
              <img src={contextMenu.targetUser.avatarUrl} alt="" className="ctx-avatar-img" />
            ) : (
              <span className="ctx-avatar-emoji">{contextMenu.targetUser.avatar}</span>
            )}
            <span className="ctx-username">{contextMenu.targetUser.username}</span>
            <span
              className={`role-pill role-pill-${getPlayerRoleBySentMessages(contextMenu.targetUser.sentMessagesCount ?? 0).id}`}
            >
              {getPlayerRoleBySentMessages(contextMenu.targetUser.sentMessagesCount ?? 0).label}
            </span>
          </div>

          <button type="button" className="ctx-item" onClick={() => handleOpenProfile(contextMenu.targetUser!)}>
            👤 Открыть профиль
          </button>

          {contextMenu.targetUser.id !== currentUser.id && (
            isAlreadyFriend(contextMenu.targetUser.id) ? (
              <div className="ctx-item disabled">✓ Уже друзья</div>
            ) : hasPendingRequest(contextMenu.targetUser.id) ? (
              <div className="ctx-item disabled">⏳ Заявка отправлена</div>
            ) : (
              <button type="button" className="ctx-item" onClick={handleAddFriend}>
                👥 Добавить в друзья
              </button>
            )
          )}
        </div>
      )}

      {friendMenu && (
        <div
          className="context-menu"
          style={{ left: friendMenu.x, top: friendMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          <div className="ctx-user-info">
            {friendMenu.user.avatarUrl ? (
              <img src={friendMenu.user.avatarUrl} alt="" className="ctx-avatar-img" />
            ) : (
              <span className="ctx-avatar-emoji">{friendMenu.user.avatar}</span>
            )}
            <span className="ctx-username">{friendMenu.user.username}</span>
          </div>
          <button
            type="button"
            className="ctx-item"
            onClick={() => {
              const dmId = `friend_${[currentUser.id, friendMenu.user.id].sort().join('_')}`;
              setActiveChannel(dmId);
              setFriendMenu(null);
            }}
          >
            ✉️ Написать сообщение
          </button>
          <button type="button" className="ctx-item" onClick={() => handleOpenProfile(friendMenu.user)}>
            👤 Открыть профиль
          </button>
          <button type="button" className="ctx-item" onClick={() => handleRemoveFriend(friendMenu.user)}>
            🗑️ Удалить из друзей
          </button>
        </div>
      )}
    </div>
  );
}
