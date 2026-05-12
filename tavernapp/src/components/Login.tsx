import { useState } from 'react';
import { useStore } from '../store';

interface Props {
  onAdminLogin: () => void;
}

export default function Login({ onAdminLogin }: Props) {
  const login = useStore(s => s.login);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loginClickCount, setLoginClickCount] = useState(0);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [adminError, setAdminError] = useState('');

  const handleLogin = () => {
    const ok = login(username.trim(), password, rememberMe);
    if (!ok) setError('Неверный логин или пароль, странник...');
    else setError('');
  };

  const handleEnterClick = () => {
    const newCount = loginClickCount + 1;
    setLoginClickCount(newCount);
    if (newCount >= 5) {
      setLoginClickCount(0);
      setShowAdminModal(true);
    } else {
      handleLogin();
    }
  };

  const handleAdminLogin = () => {
    if (adminPass === 'worldplugin228') {
      setShowAdminModal(false);
      setAdminPass('');
      setAdminError('');
      onAdminLogin();
    } else {
      setAdminError('Неверный пароль, самозванец!');
    }
  };

  return (
    <div className="login-screen">
      <div className="login-bg-overlay" />
      <div className="login-container">
        <div className="login-logo">
          <div className="logo-diamond">⬧</div>
          <h1 className="login-title">WORLDPLUGIN</h1>
          <p className="login-subtitle">Таверна Искателей Приключений</p>
        </div>

        <div className="login-form">
          <div className="form-group">
            <label className="form-label">ИМЯ ПЕРСОНАЖА</label>
            <input
              className="mc-input"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="Введи своё имя..."
            />
          </div>
          <div className="form-group">
            <label className="form-label">ПАРОЛЬ</label>
            <input
              className="mc-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="Введи пароль..."
            />
          </div>
          <div className="form-group login-remember-row">
            <label className="login-remember-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
              />
              <span>Запомнить меня</span>
            </label>
          </div>
          {error && <div className="login-error">⚠ {error}</div>}
          <button className="mc-btn mc-btn-primary login-btn" onClick={handleEnterClick}>
            ВОЙТИ В ТАВЕРНУ
          </button>
          <div className="login-hint">
            WPTeam
          </div>
        </div>
      </div>

      {showAdminModal && (
        <div className="modal-overlay" onClick={() => setShowAdminModal(false)}>
          <div className="modal-box admin-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-icon">🔐</span>
              <h2>ДОСТУП АДМИНИСТРАТОРА</h2>
            </div>
            <p className="modal-desc">Введи секретный пароль администратора</p>
            <input
              className="mc-input"
              type="password"
              value={adminPass}
              onChange={e => setAdminPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
              placeholder="Пароль..."
              autoFocus
            />
            {adminError && <div className="login-error">⚠ {adminError}</div>}
            <div className="modal-actions">
              <button className="mc-btn mc-btn-secondary" onClick={() => setShowAdminModal(false)}>ОТМЕНА</button>
              <button className="mc-btn mc-btn-primary" onClick={handleAdminLogin}>ВОЙТИ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
