import { useState, useRef } from 'react';
import { useStore, Account, getPlayerRoleBySentMessages } from '../store';

interface Props {
  profileUser: Account;
  currentUser: Account;
  onClose: () => void;
}

export default function PlayerProfile({ profileUser, currentUser, onClose }: Props) {
  const { updateProfile, addProfileReaction, getProfileReactions, sendFriendRequest, getFriends, friendRequests } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState(profileUser.bio || '');
  const [reactionText, setReactionText] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const isOwnProfile = profileUser.id === currentUser.id;
  const reactions = getProfileReactions(profileUser.id);
  const friends = getFriends(currentUser.id);

  const isAlreadyFriend = friends.some(f => f.id === profileUser.id);
  const hasPendingRequest = friendRequests.some(
    r => r.fromId === currentUser.id && r.toId === profileUser.id && r.status === 'pending'
  );

  const freshProfile = useStore(s => s.accounts.find(a => a.id === profileUser.id)) || profileUser;

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      updateProfile(currentUser.id, { avatarUrl: ev.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      updateProfile(currentUser.id, { bannerUrl: ev.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = () => {
    updateProfile(currentUser.id, { bio });
    setIsEditing(false);
  };

  const handleSendReaction = () => {
    if (!reactionText.trim()) return;
    addProfileReaction(currentUser.id, currentUser.username, profileUser.id, reactionText.trim());
    setReactionText('');
  };

  const handleAddFriend = () => {
    sendFriendRequest(currentUser.id, currentUser.username, profileUser.id, profileUser.username);
  };

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  const role = getPlayerRoleBySentMessages(freshProfile.sentMessagesCount ?? 0);

  return (
    <div className="profile-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={e => e.stopPropagation()}>

        <div
          className="profile-banner"
          style={{
            backgroundImage: freshProfile.bannerUrl
              ? `url(${freshProfile.bannerUrl})`
              : undefined,
          }}
        >
          {!freshProfile.bannerUrl && (
            <div className="profile-banner-default" />
          )}
          {isOwnProfile && (
            <>
              <button
                type="button"
                className="banner-edit-btn"
                onClick={() => bannerInputRef.current?.click()}
              >
                📷 Изменить баннер
              </button>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleBannerUpload}
              />
            </>
          )}
        </div>

        <button type="button" className="profile-close-btn" onClick={onClose}>✕</button>

        <div className="profile-identity">
          <div className="profile-avatar-wrap">
            {freshProfile.avatarUrl ? (
              <img
                src={freshProfile.avatarUrl}
                alt="avatar"
                className="profile-avatar-img"
              />
            ) : (
              <span className="profile-avatar-emoji">{freshProfile.avatar}</span>
            )}
            {isOwnProfile && (
              <>
                <button
                  type="button"
                  className="avatar-change-btn"
                  onClick={() => avatarInputRef.current?.click()}
                  title="Изменить аватар"
                >
                  ✏️
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleAvatarUpload}
                />
              </>
            )}
          </div>

          <div className="profile-name-block">
            <div className="profile-username">
              {freshProfile.username}
              <span className={`role-pill role-pill-${role.id}`}>{role.label}</span>
            </div>
            <div className="profile-since">В таверне с {formatDate(freshProfile.createdAt)}</div>
          </div>

          {!isOwnProfile && (
            <div className="profile-friend-action">
              {isAlreadyFriend ? (
                <span className="friend-status-badge">✓ Вы друзья</span>
              ) : hasPendingRequest ? (
                <span className="friend-status-badge pending">⏳ Заявка отправлена</span>
              ) : (
                <button type="button" className="mc-btn mc-btn-primary small" onClick={handleAddFriend}>
                  👥 Добавить в друзья
                </button>
              )}
            </div>
          )}
        </div>

        <div className="profile-section">
          <div className="profile-section-title">📜 О персонаже</div>
          {isOwnProfile && isEditing ? (
            <div className="bio-editor">
              <textarea
                className="mc-input bio-textarea"
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Расскажи о своём персонаже, его истории, классе, целях..."
                maxLength={300}
                rows={4}
              />
              <div className="bio-editor-footer">
                <span className="bio-counter">{bio.length}/300</span>
                <button
                  type="button"
                  className="mc-btn mc-btn-secondary small"
                  onClick={() => { setBio(freshProfile.bio || ''); setIsEditing(false); }}
                >
                  Отмена
                </button>
                <button type="button" className="mc-btn mc-btn-primary small" onClick={handleSaveProfile}>
                  Сохранить
                </button>
              </div>
            </div>
          ) : (
            <div className="bio-display">
              <p className="bio-text">
                {freshProfile.bio
                  ? freshProfile.bio
                  : isOwnProfile
                    ? 'Нажми "Редактировать" чтобы добавить описание персонажа...'
                    : 'Этот искатель приключений хранит своё прошлое в тайне...'}
              </p>
              {isOwnProfile && (
                <button
                  type="button"
                  className="mc-btn mc-btn-secondary small"
                  onClick={() => setIsEditing(true)}
                >
                  ✏️ Редактировать
                </button>
              )}
            </div>
          )}
        </div>

        <div className="profile-section">
          <div className="profile-section-title">
            💬 Книга отзывов
            {reactions.length > 0 && (
              <span className="reactions-count">{reactions.length}</span>
            )}
          </div>

          <div className="reactions-list">
            {reactions.length === 0 ? (
              <div className="reactions-empty">
                Страницы пусты... Будь первым, кто оставит запись.
              </div>
            ) : (
              [...reactions].reverse().map(r => (
                <div key={r.id} className="reaction-item">
                  <div className="reaction-header">
                    <span className="reaction-author">{r.fromName}</span>
                    <span className="reaction-date">
                      {new Date(r.timestamp).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                  <div className="reaction-text">{r.text}</div>
                </div>
              ))
            )}
          </div>

          {!isOwnProfile && (
            <div className="reaction-form">
              <input
                className="mc-input"
                placeholder="Оставь запись в книге отзывов..."
                value={reactionText}
                onChange={e => setReactionText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendReaction()}
                maxLength={200}
              />
              <button
                type="button"
                className="mc-btn mc-btn-primary small"
                onClick={handleSendReaction}
                disabled={!reactionText.trim()}
              >
                Написать
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
