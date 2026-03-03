import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminService } from '../../services/admin.service';
import { TrendingUp, Users, ShoppingCart, Activity, Wallet, Download } from 'lucide-react';
import GlassPanel from '../../components/common/GlassPanel';
import Button from '../../components/common/Button';
import { Input } from '../../components/common/FormElements';
import type { GlobalStats, PaymentMode } from '../../types';

const Analytics: React.FC = () => {
    const [stats, setStats] = useState<GlobalStats | null>(null);
    const [modes, setModes] = useState<PaymentMode[]>([]);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [statsRes, modesRes] = await Promise.all([
                    adminService.getGlobalStats(),
                    adminService.getPaymentModes(),
                ]);
                setStats(statsRes.data);
                setModes(modesRes.data);
            } catch (err) {
                console.error('Error fetching analytics', err);
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, []);

    if (loading) return <div style={{ color: 'var(--text-muted)' }}>Loading analytics...</div>;
    if (!stats) return <div style={{ color: 'var(--danger)' }}>Failed to load analytics</div>;

    const getModeName = (modeId: string) => {
        const found = modes.find(m => m.id === modeId);
        return found ? found.name : modeId.slice(0, 8) + '...';
    };

    const modeIconColors: Record<string, string> = {
        CASH: '#00e676',
        CARD: '#4fc3f7',
        WALLET: '#ffb74d',
    };

    const handleExport = async (type: string) => {
        try {
            const res = await adminService.exportReport(type, startDate, endDate);
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${type}_export_${new Date().getTime()}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('Report exported successfully');
        } catch (err) {
            console.error('Error exporting report', err);
            toast.error('Failed to export report');
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
            {/* Report Export Controls */}
            <GlassPanel style={{ padding: '20px', display: 'flex', gap: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Start Date</label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>End Date</label>
                    <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
                <Button onClick={() => handleExport('payments')} icon={<Download size={16} />}>Export Payments (CSV)</Button>
            </GlassPanel>

            {/* KPI Cards */}
            <div style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', display: 'grid', gap: '25px' }}>
                <StatCard
                    title="Total Revenue"
                    value={`EGP${(stats.totalRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    icon={"EGP"}
                />
                <StatCard
                    title="Total Sessions"
                    value={stats.totalSessions.toLocaleString()}
                    icon={<Activity size={24} color="#2979ff" />}
                />
                <StatCard
                    title="Total Orders"
                    value={stats.totalOrders.toLocaleString()}
                    icon={<ShoppingCart size={24} color="#ffab00" />}
                />
                <StatCard
                    title="Occupied Rooms"
                    value={`${stats.activeRooms} Room${stats.activeRooms !== 1 ? 's' : ''}`}
                    icon={<Users size={24} color="#00e676" />}
                />
            </div>

            {/* Revenue by Payment Mode */}
            <GlassPanel style={{ padding: '30px' }}>
                <h3 style={{ marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px', fontWeight: '600' }}>
                    <TrendingUp size={20} color="var(--primary)" /> Revenue by Payment Mode
                </h3>
                {stats.revenueByMode.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No payment data yet</div>
                ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
                        {stats.revenueByMode.map(mode => {
                            const modeName = getModeName(mode.modeId);
                            const color = modeIconColors[modeName.toUpperCase()] ?? 'var(--primary)';
                            return (
                                <div key={mode.modeId} style={{
                                    background: 'rgba(255, 255, 255, 0.04)',
                                    padding: '20px 28px',
                                    borderRadius: '16px',
                                    border: `1px solid ${color}30`,
                                    minWidth: '160px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Wallet size={15} color={color} />
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            {modeName}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '22px', fontWeight: '700', color }}>
                                        EGP {(mode._sum.amount ?? 0).toFixed(2)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </GlassPanel>
        </div>
    );
};

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode }> = ({ title, value, icon }) => (
    <GlassPanel style={{ padding: '25px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
                <h3 style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>{title}</h3>
                <div style={{ fontSize: '28px', fontWeight: '700', marginTop: '12px' }}>{value}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '12px', flexShrink: 0 }}>
                {icon}
            </div>
        </div>
    </GlassPanel>
);

export default Analytics;
