import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import GlassPanel from '../components/common/GlassPanel';
import api from '../services/api';
import type { User, SessionOrder, SessionDetail } from '../types';
import { TrendingUp, TrendingDown } from 'lucide-react';

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
    const [activeTab, setActiveTab] = useState<'orders' | 'sessions' | 'transactions'>('orders');

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

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (loading) {
        return <div style={{ color: 'var(--text-muted)' }}>Loading dashboard...</div>;
    }

    if (!data) return null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
            {/* Status Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
                <GlassPanel style={{ padding: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '8px' }}>Wallet Balance</div>
                        <div style={{ fontSize: '32px', fontWeight: '800', color: data.balance >= 0 ? 'var(--primary)' : '#ff3b30' }}>
                            EGP {data.balance.toFixed(2)}
                        </div>
                        {data.balance < 0 && (
                            <div style={{ color: '#ff3b30', fontSize: '12px', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <TrendingDown size={14} /> You have an outstanding tab.
                            </div>
                        )}
                        {data.balance > 0 && (
                            <div style={{ color: 'var(--primary)', fontSize: '12px', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <TrendingUp size={14} /> You have prepaid credit available.
                            </div>
                        )}
                    </div>
                </GlassPanel>

                <GlassPanel style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '8px' }}>Total Orders</div>
                    <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text)' }}>
                        {data.orders.length}
                    </div>
                </GlassPanel>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--border)' }}>
                <button
                    onClick={() => setActiveTab('orders')}
                    style={{
                        background: 'none', border: 'none', padding: '12px 0', fontSize: '16px', fontWeight: activeTab === 'orders' ? '700' : '500',
                        color: activeTab === 'orders' ? 'var(--primary)' : 'var(--text-muted)',
                        borderBottom: activeTab === 'orders' ? '2px solid var(--primary)' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.2s'
                    }}
                >
                    My Orders
                </button>
                <button
                    onClick={() => setActiveTab('sessions')}
                    style={{
                        background: 'none', border: 'none', padding: '12px 0', fontSize: '16px', fontWeight: activeTab === 'sessions' ? '700' : '500',
                        color: activeTab === 'sessions' ? 'var(--primary)' : 'var(--text-muted)',
                        borderBottom: activeTab === 'sessions' ? '2px solid var(--primary)' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.2s'
                    }}
                >
                    Room Sessions
                </button>
                <button
                    onClick={() => setActiveTab('transactions')}
                    style={{
                        background: 'none', border: 'none', padding: '12px 0', fontSize: '16px', fontWeight: activeTab === 'transactions' ? '700' : '500',
                        color: activeTab === 'transactions' ? 'var(--primary)' : 'var(--text-muted)',
                        borderBottom: activeTab === 'transactions' ? '2px solid var(--primary)' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.2s'
                    }}
                >
                    Transactions Ledger
                </button>
            </div>

            {/* Tab Contents */}
            {activeTab === 'orders' && (
                <GlassPanel style={{ padding: '24px' }}>
                    {data.orders.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>No orders found.</div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '14px' }}>
                                        <th style={{ padding: '16px 8px', fontWeight: '500' }}>Date</th>
                                        <th style={{ padding: '16px 8px', fontWeight: '500' }}>Items</th>
                                        <th style={{ padding: '16px 8px', fontWeight: '500' }}>Status</th>
                                        <th style={{ padding: '16px 8px', fontWeight: '500', textAlign: 'right' }}>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.orders.map(o => (
                                        <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '16px 8px' }}>
                                                {new Date(o.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                            </td>
                                            <td style={{ padding: '16px 8px' }}>
                                                {o.items?.map(i => `${i.qty}x ${(i as any).product?.name}`).join(', ')}
                                            </td>
                                            <td style={{ padding: '16px 8px' }}>
                                                <span style={{
                                                    padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                                                    background: o.status === 'approved' ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 196, 0, 0.1)',
                                                    color: o.status === 'approved' ? 'var(--primary)' : '#ffc400'
                                                }}>
                                                    {o.status.toUpperCase()}
                                                </span>
                                            </td>
                                            <td style={{ padding: '16px 8px', textAlign: 'right', fontWeight: '600' }}>
                                                EGP {(o.orderCharge as any)?.finalTotal ?? o.items?.reduce((s, i) => s + i.total, 0) ?? 0}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </GlassPanel>
            )}

            {activeTab === 'sessions' && (
                <GlassPanel style={{ padding: '24px' }}>
                    {data.sessions.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>No linked sessions found.</div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '14px' }}>
                                        <th style={{ padding: '16px 8px', fontWeight: '500' }}>Room</th>
                                        <th style={{ padding: '16px 8px', fontWeight: '500' }}>Start Time</th>
                                        <th style={{ padding: '16px 8px', fontWeight: '500' }}>End Time / Status</th>
                                        <th style={{ padding: '16px 8px', fontWeight: '500', textAlign: 'right' }}>Room Charge</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.sessions.map(s => (
                                        <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '16px 8px', fontWeight: '600' }}>{s.room.name}</td>
                                            <td style={{ padding: '16px 8px' }}>
                                                {new Date(s.startTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                            </td>
                                            <td style={{ padding: '16px 8px' }}>
                                                {s.endTime ? new Date(s.endTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : (
                                                    <span style={{ color: '#ffc400', fontSize: '13px' }}>In Progress (Active)</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '16px 8px', textAlign: 'right', fontWeight: '600' }}>
                                                {s.sessionCharge ? `EGP ${s.sessionCharge.roomAmount}` : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </GlassPanel>
            )}

            {activeTab === 'transactions' && (
                <GlassPanel style={{ padding: '24px' }}>
                    {data.transactions.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>No transactions recorded.</div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
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
                                                {t.amount > 0 ? '+' : ''}{t.amount}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </GlassPanel>
            )}
        </div>
    );
}
