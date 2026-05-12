import { useEffect } from 'react';
import { LineChart, Line, Tooltip, ResponsiveContainer } from 'recharts';
import { useStore } from '../store';

const CATEGORY_ICONS: Record<string, string> = {
  'Металлы': '⚒',
  'Магметаллы': '✨',
  'Магия': '🔮',
  'Зелья': '🧪',
};

function formatCurrency(val: number): string {
  if (val < 50) return `${val} мед.`;
  if (val < 200) return `${val} жел.`;
  if (val < 1000) return `${val} зол.`;
  if (val < 5000) return `${val} плат.`;
  return `${val} миф.`;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <span>{formatCurrency(payload[0].value)}</span>
      </div>
    );
  }
  return null;
};

export default function Market() {
  const { marketItems, updateMarket } = useStore();

  useEffect(() => {
    const interval = setInterval(() => {
      updateMarket();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const categories = Array.from(new Set(marketItems.map(i => i.category)));

  return (
    <div className="market-layout">
      <div className="market-header">
        <h1 className="market-title">⚖ ТОРГОВЫЙ РЫНОК</h1>
        <p className="market-subtitle">Актуальные цены королевства • Валюта обновляется в реальном времени</p>
      </div>

      <div className="currency-legend">
        <div className="legend-title">ВАЛЮТЫ ЛОРА:</div>
        {[
          { icon: '🟤', name: 'Медная монета', desc: 'наименьшая' },
          { icon: '⚙', name: 'Железная монета', desc: '' },
          { icon: '🟡', name: 'Золотая монета', desc: '' },
          { icon: '🔘', name: 'Платиновая монета', desc: '' },
          { icon: '💠', name: 'Мифриловая монета', desc: 'наивысшая' },
        ].map(c => (
          <div key={c.name} className="legend-item">
            <span className="legend-icon">{c.icon}</span>
            <span className="legend-name">{c.name}</span>
            {c.desc && <span className="legend-desc">({c.desc})</span>}
          </div>
        ))}
      </div>

      {categories.map(cat => (
        <div key={cat} className="market-category">
          <div className="category-header">
            <span className="category-icon">{CATEGORY_ICONS[cat] || '📦'}</span>
            <h2 className="category-name">{cat}</h2>
          </div>
          <div className="market-grid">
            {marketItems.filter(i => i.category === cat).map(item => {
              const first = item.history[0]?.price || item.currentPrice;
              const change = ((item.currentPrice - first) / first * 100).toFixed(1);
              const isUp = item.trend === 'up';
              const isDown = item.trend === 'down';
              const data = item.history.slice(-15).map((h, idx) => ({ idx, price: h.price }));

              return (
                <div key={item.id} className="market-card">
                  <div className="market-card-header">
                    <span className="market-item-name">{item.name}</span>
                    <span className={`trend-badge ${isUp ? 'up' : isDown ? 'down' : 'stable'}`}>
                      {isUp ? '▲' : isDown ? '▼' : '●'} {Math.abs(Number(change))}%
                    </span>
                  </div>
                  <div className="market-price">
                    {item.currency}
                  </div>
                  <div className="market-unit">{item.unit}</div>
                  <div className="market-chart">
                    <div className="market-chart-inner">
                      <ResponsiveContainer width="100%" height="100%" debounce={50}>
                        <LineChart data={data} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
                          <Line
                            type="monotone"
                            dataKey="price"
                            stroke={isUp ? '#4ade80' : isDown ? '#f87171' : '#94a3b8'}
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                          />
                          <Tooltip content={<CustomTooltip />} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
