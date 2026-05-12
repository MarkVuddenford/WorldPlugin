import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore, startNPCMessages } from './store';
import Login from './components/Login';
import AdminPanel from './components/AdminPanel';
import Tavern from './components/Tavern';
import Market from './components/Market';
import Orders from './components/Orders';
import './App.css';

export default function App() {
  const { currentUser, activeSection, setActiveSection, logout } = useStore(
    useShallow(s => ({
      currentUser: s.currentUser,
      activeSection: s.activeSection,
      setActiveSection: s.setActiveSection,
      logout: s.logout,
    }))
  );
  const [isAdmin, setIsAdmin] = useState(false);
  const [nowTs, setNowTs] = useState(Date.now());

  useEffect(() => {
    startNPCMessages();
  }, []);

  useEffect(() => {
    if (!currentUser?.bannedUntil) return;
    if (currentUser.bannedUntil <= Date.now()) return;
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [currentUser?.bannedUntil]);

  useEffect(() => {
    const checkStaleSession = () => {
      const s = useStore.getState();
      if (s.currentUser && !s.accounts.some(a => a.id === s.currentUser!.id)) {
        useStore.setState({ currentUser: null, persistSession: false });
      }

      // Старые сохранения могли не содержать `sentMessagesCount`. Заполним его по фактическим сообщениям.
      const anyMissing = s.accounts.some(a => typeof a.sentMessagesCount !== 'number');
      if (anyMissing) {
        const counts = new Map<string, number>();
        for (const m of s.messages) {
          if (m.isNPC) continue;
          counts.set(m.authorId, (counts.get(m.authorId) ?? 0) + 1);
        }
        useStore.setState({
          accounts: s.accounts.map(a => ({
            ...a,
            sentMessagesCount: typeof a.sentMessagesCount === 'number' ? a.sentMessagesCount : (counts.get(a.id) ?? 0),
          })),
          currentUser: s.currentUser
            ? {
                ...s.currentUser,
                sentMessagesCount:
                  typeof s.currentUser.sentMessagesCount === 'number'
                    ? s.currentUser.sentMessagesCount
                    : (counts.get(s.currentUser.id) ?? 0),
              }
            : s.currentUser,
        });
      }
    };
    const unsub = useStore.persist.onFinishHydration(checkStaleSession);
    if (useStore.persist.hasHydrated()) checkStaleSession();
    return unsub;
  }, []);

  if (isAdmin) {
    return <AdminPanel onExit={() => setIsAdmin(false)} />;
  }

  if (!currentUser) {
    return <Login onAdminLogin={() => setIsAdmin(true)} />;
  }

  const banLeft = Math.max(0, (currentUser.bannedUntil ?? 0) - nowTs);
  if (banLeft > 0) {
    const hh = String(Math.floor(banLeft / 3_600_000)).padStart(2, '0');
    const mm = String(Math.floor((banLeft % 3_600_000) / 60_000)).padStart(2, '0');
    const ss = String(Math.floor((banLeft % 60_000) / 1000)).padStart(2, '0');
    return (
      <div className="profile-overlay">
        <div className="profile-modal" style={{ maxWidth: 560, textAlign: 'center', padding: 24 }}>
          <h2 className="section-title" style={{ fontSize: 20, marginBottom: 16 }}>⛔ ВЫ ЗАБАНЕНЫ</h2>
          <p className="bio-text" style={{ marginBottom: 12 }}>
            Доступ к аккаунту ограничен.
          </p>
          {currentUser.banReason ? (
            <p className="bio-text" style={{ marginBottom: 14 }}>
              Причина: {currentUser.banReason}
            </p>
          ) : null}
          <div className="admin-msg" style={{ fontSize: 16 }}>
            До разблокировки: {hh}:{mm}:{ss}
          </div>
          <div style={{ marginTop: 16 }}>
            <button className="mc-btn mc-btn-secondary small" onClick={logout}>ВЫЙТИ</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-root">
      <div className="torch-left"></div>
      <div className="torch-right">🔥</div>
      <header className="app-header">
        <div className="header-left">
          <div className="site-logo">
            <span className="logo-gem">◆</span>
            <span className="logo-text">WORLDPLUGIN</span>
          </div>
        </div>

        <nav className="header-nav">
          <button
            className={`nav-btn ${activeSection === 'tavern' ? 'active' : ''}`}
            onClick={() => setActiveSection('tavern')}
          >
            <span className="nav-icon">🍺</span>
            <span>ТАВЕРНА</span>
          </button>
          <button
            className={`nav-btn ${activeSection === 'market' ? 'active' : ''}`}
            onClick={() => setActiveSection('market')}
          >
            <span className="nav-icon">⚖</span>
            <span>ТОРГОВЫЙ РЫНОК</span>
          </button>
          <button
            className={`nav-btn ${activeSection === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveSection('orders')}
          >
            <span className="nav-icon">📜</span>
            <span>ЗАКАЗЫ</span>
          </button>
        </nav>

        <div className="header-right">
          <div className="user-info">
            <span className="user-avatar">{currentUser.avatar}</span>
            <span className="user-name">{currentUser.username}</span>
          </div>
          <button className="mc-btn mc-btn-secondary small" onClick={logout}>ВЫЙТИ</button>
        </div>
      </header>

      <main className="app-main">
        {activeSection === 'tavern' && <Tavern currentUser={currentUser} />}
        {activeSection === 'market' && <Market />}
        {activeSection === 'orders' && <Orders currentUser={currentUser} />}
      </main>
    </div>
  );
}
