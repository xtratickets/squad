import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminService } from '../../services/admin.service';
import { TrendingUp, Users, ShoppingCart, Activity, Wallet, Download } from 'lucide-react';
import GlassPanel from '../../components/common/GlassPanel';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import { Input } from '../../components/common/FormElements';
import type { GlobalStats, PaymentMode } from '../../types';

const Analytics: React.FC = () => {
    const [stats, setStats] = useState<GlobalStats | null>(null);
    const [modes, setModes] = useState<PaymentMode[]>([]);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [showRevenueCalc, setShowRevenueCalc] = useState(false);

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
                    onClick={() => setShowRevenueCalc(true)}
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
                                        EGP {Math.round(mode._sum.amount ?? 0)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </GlassPanel>

            <RevenueCalculationModal
                isOpen={showRevenueCalc}
                stats={stats}
                modes={modes}
                onClose={() => setShowRevenueCalc(false)}
            />
        </div>
    );
};

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; onClick?: () => void }> = ({ title, value, icon, onClick }) => (
    <GlassPanel
        onClick={onClick}
        style={{
            padding: '25px',
            position: 'relative',
            overflow: 'hidden',
            cursor: onClick ? 'pointer' : 'default',
            transition: 'transform 0.2s',
        }}
    >
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

// ─── Revenue Calculation Breakdown ───────────────────────────────

const RevenueCalculationModal: React.FC<{
    isOpen: boolean;
    stats: GlobalStats | null;
    modes: PaymentMode[];
    onClose: () => void;
}> = ({ isOpen, stats, modes, onClose }) => {
    if (!stats) return null;

    const getModeName = (modeId: string) => {
        const found = modes.find(m => m.id === modeId);
        return found ? found.name : modeId.slice(0, 8) + '...';
    };

    return (
        <Modal isOpen={isOpen} title="Revenue Calculation Breakdown" onClose={onClose}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <section>
                    <h4 style={{ marginBottom: '12px', color: 'var(--primary)', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Collections (Payments Received)</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px' }}>
                        {stats.revenueByMode.map(m => (
                            <div key={m.modeId} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>{getModeName(m.modeId)}</span>
                                <span style={{ fontWeight: '600', fontFamily: 'monospace' }}>EGP {(m._sum.amount ?? 0).toFixed(2)}</span>
                            </div>
                        ))}
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '6px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '15px' }}>
                            <span>Total Collections</span>
                            <span style={{ color: 'var(--primary)' }}>EGP {stats.totalRevenue.toFixed(2)}</span>
                        </div>
                    </div>
                </section>

                <section>
                    <h4 style={{ marginBottom: '12px', color: 'var(--primary)', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sales Breakdown</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px' }}>
                        {stats.revenueBySource.map(s => (
                            <div key={s.referenceType} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{s.referenceType === 'session' ? 'Room Sessions' : 'Product Orders'} (Net)</span>
                                <span style={{ fontWeight: '600', fontFamily: 'monospace' }}>EGP {(s._sum.amount ?? 0).toFixed(2)}</span>
                            </div>
                        ))}
                        {(stats.totalServiceFees || 0) > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Service Fees</span>
                                <span style={{ fontWeight: '600', fontFamily: 'monospace' }}>EGP {stats.totalServiceFees?.toFixed(2)}</span>
                            </div>
                        )}
                        {(stats.totalTax || 0) > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Taxes</span>
                                <span style={{ fontWeight: '600', fontFamily: 'monospace' }}>EGP {stats.totalTax?.toFixed(2)}</span>
                            </div>
                        )}
                        {(stats.totalDiscounts || 0) > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Total Discounts</span>
                                <span style={{ fontWeight: '600', color: '#f87171', fontFamily: 'monospace' }}>-EGP {stats.totalDiscounts?.toFixed(2)}</span>
                            </div>
                        )}
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '6px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '15px' }}>
                            <span>Total System Revenue</span>
                            <span style={{ color: 'var(--primary)' }}>EGP {stats.totalRevenue.toFixed(2)}</span>
                        </div>
                    </div>
                </section>

                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '12px', background: 'rgba(0,230,118,0.05)', borderRadius: '12px', border: '1px solid rgba(0,230,118,0.1)' }}>
                    <strong>Global Statistics Note:</strong><br />
                    This represents the all-time totals of your SQUAD system.
                    Collections are payments recorded across all shifts.
                    Sales Sources show whether revenue came from room sessions or independent product orders.
                </div>
            </div>
        </Modal>
    );
};

export default Analytics;
