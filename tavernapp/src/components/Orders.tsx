import { useStore, Account } from '../store';

interface Props {
  currentUser: Account;
}

export default function Orders({ currentUser }: Props) {
  const { orders, acceptOrder, setActiveSection, setActiveChannel } = useStore();

  const availableOrders = orders.filter(o => !o.acceptedById);

  const handleAccept = (orderId: string) => {
    acceptOrder(orderId, currentUser.id, currentUser.username);
    setActiveSection('tavern');
    const order = orders.find(o => o.id === orderId);
    if (order) {
      setActiveChannel(`order_${orderId}`);
    }
  };

  return (
    <div className="orders-layout">
      <div className="orders-header">
        <h1 className="orders-title">📜 ДОСКА ЗАКАЗОВ</h1>
        <p className="orders-subtitle">Задания от жителей королевства • Принятый заказ открывает личный чат с заказчиком</p>
      </div>

      {availableOrders.length === 0 ? (
        <div className="orders-empty">
          <div className="empty-icon">📭</div>
          <div className="empty-title">Доска пуста</div>
          <div className="empty-desc">Новые заказы появятся здесь, когда жители королевства разместят их через администрацию</div>
        </div>
      ) : (
        <div className="orders-grid">
          {availableOrders.map(order => (
            <div key={order.id} className="order-card">
              <div className="order-card-header">
                <div className="order-resident-badge">
                  <span className="order-resident-icon">👤</span>
                  <span className="order-resident-name">{order.residentName}</span>
                </div>
                <div className="order-date">{new Date(order.createdAt).toLocaleDateString('ru-RU')}</div>
              </div>
              <div className="order-card-title">{order.title}</div>
              <div className="order-card-desc">{order.description}</div>
              <div className="order-card-footer">
                <div className="order-reward">
                  <span className="reward-icon">💰</span>
                  <span className="reward-text">{order.reward}</span>
                </div>
                <button className="mc-btn mc-btn-primary" onClick={() => handleAccept(order.id)}>
                  ПРИНЯТЬ ЗАКАЗ
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
