import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import GlassPanel from '../components/common/GlassPanel';
import api from '../services/api';
import type { User, SessionOrder, SessionDetail } from '../types';
import { TrendingUp, TrendingDown, Clock, ShoppingCart, History } from 'lucide-react';

interface OwnerDashboardViewProps {
    user: User;
}

export default function OwnerDashboardView({ }: OwnerDashboardViewProps) {
    const [data, setData] = useState<{
        balance: number;
        orders: SessionOrder[];
        sessions: SessionDetail[];
        transactions: any[];
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [activeTab, setActiveTab] = useState<'overview' | 'sessions' | 'orders' | 'wallet'>('overview');

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await api.get('/owners/dashboard');
            setData(res.data);
        } catch (error: any) {
            console.error('Failed to load owner dashboard:', error);
            toast.error(error.response?.data?.error || 'Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => `EGP ${amount.toFixed(2)}`;

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (loading) {
        return <div style={{ color: 'var(--text-muted)' }}>Loading dashboard...</div>;
    }

    if (!data) return null;

    const TabButton = ({ id, label, icon: Icon }: { id: typeof activeTab, label: string, icon: any }) => (
        <button
            onClick={() => setActiveTab(id)}
            style={{
                flex: 1,
                padding: '12px 16px',
                background: activeTab === id ? 'rgba(0,230,118,0.1)' : 'transparent',
                border: 'none',
                borderBottom: `2px solid ${activeTab === id ? 'var(--primary)' : 'transparent'}`,
                color: activeTab === id ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: activeTab === id ? '600' : '400',
                transition: 'all 0.2s'
            }}
        >
            <Icon size={18} />
            {!isMobile && label}
        </button>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '24px', paddingBottom: '40px' }}>
            {/* Status Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
                <GlassPanel style={{ padding: isMobile ? '20px' : '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '8px' }}>Wallet Balance</div>
                        <div style={{ fontSize: isMobile ? '28px' : '40px', fontWeight: '900', color: data.balance >= 0 ? 'var(--primary)' : '#ff3b30' }}>
                            {formatCurrency(data.balance)}
                        </div>
                        {data.balance < 0 && (
                            <div style={{ color: '#ff3b30', fontSize: '13px', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <TrendingDown size={14} /> Outstanding Tab
                            </div>
                        )}
                        {data.balance > 0 && (
                            <div style={{ color: 'var(--primary)', fontSize: '13px', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <TrendingUp size={14} /> Prepaid Credit
                            </div>
                        )}
                    </div>
                </GlassPanel>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '10px' }}>
                <TabButton id="overview" label="Overview" icon={TrendingUp} />
                <TabButton id="sessions" label="Sessions" icon={Clock} />
                <TabButton id="orders" label="Orders" icon={ShoppingCart} />
                <TabButton id="wallet" label="Wallet" icon={History} />
            </div>

            {/* Tab Contents */}
            <div style={{ minHeight: '300px' }}>
                {activeTab === 'overview' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px' }}>
                            <GlassPanel style={{ padding: '20px' }}>
                                <div style={{ color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', marginBottom: '15px' }}>Recent Activity</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Total Sessions</span>
                                        <span style={{ fontWeight: '700' }}>{data.sessions.length}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Total Orders</span>
                                        <span style={{ fontWeight: '700' }}>{data.orders.length}</span>
                                    </div>
                                </div>
                            </GlassPanel>
                            <GlassPanel style={{ padding: '20px' }}>
                                <div style={{ color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', marginBottom: '15px' }}>Quick Stats</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Recent Order</span>
                                        <span style={{ fontWeight: '700' }}>{data.orders[0] ? formatCurrency(data.orders[0].orderCharge?.finalTotal || 0) : 'N/A'}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Last Session</span>
                                        <span style={{ fontWeight: '700' }}>{data.sessions[0]?.room.name || 'N/A'}</span>
                                    </div>
                                </div>
                            </GlassPanel>
                        </div>
                    </div>
                )}

                {activeTab === 'sessions' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {data.sessions.length === 0 ? (
                            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>No session history.</div>
                        ) : (
                            data.sessions.map(s => (
                                <GlassPanel key={s.id} style={{ padding: '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                        <div style={{ fontWeight: '700', fontSize: '16px' }}>{s.room.name}</div>
                                        <div style={{ color: 'var(--primary)', fontWeight: '700' }}>{formatCurrency(s.sessionCharge?.finalTotal || 0)}</div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px', color: 'var(--text-muted)' }}>
                                        <div><b>Start:</b> {new Date(s.startTime).toLocaleString()}</div>
                                        <div><b>End:</b> {s.endTime ? new Date(s.endTime).toLocaleString() : 'Active'}</div>
                                        <div><b>Duration:</b> {s.sessionCharge?.durationMinutes || 0} mins</div>
                                    </div>
                                </GlassPanel>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'orders' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {data.orders.length === 0 ? (
                            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>No orders found.</div>
                        ) : (
                            data.orders.map(o => (
                                <GlassPanel key={o.id} style={{ padding: '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(o.createdAt).toLocaleString()}</div>
                                        <div style={{ fontWeight: '800', color: 'var(--primary)' }}>{formatCurrency(o.orderCharge?.finalTotal || 0)}</div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {o.items?.map((item: any) => (
                                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                                                <span>{item.qty}x {item.product?.name}</span>
                                                <span style={{ opacity: 0.7 }}>{formatCurrency(item.total)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </GlassPanel>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'wallet' && (
                    <GlassPanel style={{ padding: isMobile ? '12px' : '24px' }}>
                        {data.transactions.length === 0 ? (
                            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>No transactions recorded.</div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                {isMobile ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {data.transactions.map(t => (
                                            <div key={t.id} style={{
                                                padding: '16px',
                                                background: 'rgba(255,255,255,0.03)',
                                                borderRadius: '12px',
                                                border: '1px solid var(--border)'
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                        {new Date(t.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                                    </div>
                                                    <div style={{ fontWeight: '700', color: t.amount > 0 ? 'var(--primary)' : '#ff3b30' }}>
                                                        {t.amount > 0 ? '+' : ''}{t.amount.toFixed(2)}
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: '14px', lineHeight: '1.4' }}>
                                                    {t.orderId ? `Order #${t.orderId.slice(0, 8)}` : (t.note || 'Wallet Payment')}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '14px' }}>
                                                <th style={{ padding: '16px 8px', fontWeight: '500' }}>Date</th>
                                                <th style={{ padding: '16px 8px', fontWeight: '500' }}>Description</th>
                                                <th style={{ padding: '16px 8px', fontWeight: '500', textAlign: 'right' }}>Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.transactions.map(t => (
                                                <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <td style={{ padding: '16px 8px' }}>
                                                        {new Date(t.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                                    </td>
                                                    <td style={{ padding: '16px 8px' }}>
                                                        {t.orderId ? `Deduction for Order #${t.orderId.slice(0, 8)}` : (t.note || 'Wallet Payment')}
                                                    </td>
                                                    <td style={{ padding: '16px 8px', textAlign: 'right', fontWeight: '600', color: t.amount > 0 ? 'var(--primary)' : '#ff3b30' }}>
                                                        {t.amount > 0 ? '+' : ''}{t.amount.toFixed(2)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}
                    </GlassPanel>
                )}
            </div>
        </div>
    );
}
