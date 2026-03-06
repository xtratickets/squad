import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminService } from '../../services/admin.service';
import { Clock, User, ArrowRight, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
import DataTable from '../../components/common/DataTable';
import Button from '../../components/common/Button';
import GlassPanel from '../../components/common/GlassPanel';
import { Input } from '../../components/common/FormElements';
import type { Shift } from '../../types';

const ShiftManagement: React.FC = () => {
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(true);
    const [closingId, setClosingId] = useState<string | null>(null);
    const [cashPhysical, setCashPhysical] = useState(0);

    const [page, setPage] = useState(1);
    const [pageSize] = useState(50);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);

    const loadShifts = async () => {
        setLoading(true);
        try {
            const res = await adminService.getShifts({ page, pageSize });
            const payload = res.data as any;
            if (payload && typeof payload === 'object' && 'data' in payload) {
                setShifts(payload.data);
                setTotalPages(payload.totalPages);
                setTotalRecords(payload.total);
            } else {
                setShifts(payload as Shift[]);
            }
        } catch (err) {
            console.error('Error fetching shifts', err);
        } finally {
            setLoading(false);
        }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { void loadShifts(); }, [page, pageSize]);

    const handleClose = async (id: string) => {
        try {
            await adminService.closeShift(id, { cashPhysical });
            setClosingId(null);
            setCashPhysical(0);
            loadShifts();
            toast.success('Shift closed successfully');
        } catch (err) {
            const msg = err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
                : undefined;
            toast.error(msg || 'Error closing shift');
        }
    };

    const statusColor = (status: string) =>
        status === 'open' ? 'var(--primary)' : 'var(--text-muted)';
    const statusBg = (status: string) =>
        status === 'open' ? 'rgba(0,230,118,0.1)' : 'rgba(255,255,255,0.05)';

    const columns = [
        {
            header: 'Staff',
            key: 'staff',
            render: (s: Shift) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', background: 'var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#000' }}>
                        {s.staff?.username.charAt(0).toUpperCase()}
                    </div>
                    {s.staff?.username ?? '—'}
                </div>
            ),
        },
        {
            header: 'Status',
            key: 'status',
            render: (s: Shift) => (
                <span style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', background: statusBg(s.status), color: statusColor(s.status) }}>
                    {s.status}
                </span>
            ),
        },
        {
            header: 'Started',
            key: 'startTime',
            render: (s: Shift) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    <Clock size={13} />
                    {new Date(s.startTime).toLocaleString()}
                </div>
            ),
        },
        {
            header: 'Ended',
            key: 'endTime',
            render: (s: Shift) => s.endTime ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    <ArrowRight size={13} />
                    {new Date(s.endTime).toLocaleString()}
                </div>
            ) : (
                <span style={{ color: 'var(--primary)', fontSize: '12px', fontWeight: '600' }}>Still Open</span>
            ),
        },
        {
            header: 'Opening Cash',
            key: 'openingCash',
            render: (s: Shift) => s.stats?.openingCash !== undefined
                ? <span style={{ fontWeight: '600' }}>EGP {Math.round(s.stats.openingCash)}</span>
                : <span style={{ color: 'var(--text-muted)' }}>-</span>
        },
        {
            header: 'CASH',
            key: 'cash',
            render: (s: Shift) => {
                const cashAmount = s.paymentsByMode ? s.paymentsByMode.find(m => m.name.toLowerCase() === 'cash')?.amount ?? 0 : s.stats?.paymentsCash ?? 0;
                return <span style={{ color: 'var(--primary)', fontWeight: '600' }}>EGP {Math.round(cashAmount)}</span>;
            }
        },
        {
            header: 'CARD/OTHER',
            key: 'card_other',
            render: (s: Shift) => {
                const nonCashAmount = s.paymentsByMode
                    ? s.paymentsByMode.filter(m => m.name.toLowerCase() !== 'cash').reduce((sum, p) => sum + p.amount, 0)
                    : (s.stats?.paymentsCard ?? 0) + (s.stats?.paymentsWallet ?? 0);
                return <span style={{ color: 'var(--text-muted)' }}>EGP {nonCashAmount.toFixed(2)}</span>;
            }
        },
        {
            header: 'TOTAL REVENUE',
            key: 'total_revenue',
            render: (s: Shift) => {
                const total = s.paymentsByMode
                    ? s.paymentsByMode.filter(m => m.name.toUpperCase() !== 'WALLET').reduce((sum, p) => sum + p.amount, 0)
                    : (s.stats?.paymentsCash ?? 0) + (s.stats?.paymentsCard ?? 0);
                return <span style={{ fontWeight: '700' }}>EGP {Math.round(total)}</span>;
            }
        },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                        <User size={24} color="var(--primary)" /> Shift Management
                    </h2>
                    <span style={{ color: 'var(--text-muted)', fontSize: '14px', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '12px' }}>
                        Total: {totalRecords} Records
                    </span>
                </div>
            </div>

            {closingId && (
                <GlassPanel style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <span style={{ fontSize: '14px', flex: 1 }}>Enter physical cash count to close shift:</span>
                    <Input
                        type="number"
                        label="PHYSICAL CASH (EGP)"
                        value={cashPhysical}
                        onChange={e => setCashPhysical(parseFloat(e.target.value) || 0)}
                        style={{ width: '180px' }}
                    />
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Button onClick={() => handleClose(closingId)} size="small" variant="primary"><Check size={16} /> Confirm</Button>
                        <Button onClick={() => setClosingId(null)} size="small" variant="secondary"><X size={16} /></Button>
                    </div>
                </GlassPanel>
            )}

            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading shifts...</div>
                ) : (
                    <DataTable
                        data={shifts}
                        columns={columns}
                        searchKey="status"
                        searchPlaceholder="Filter by status..."
                        actions={(s: Shift) => s.status === 'open' ? (
                            <Button
                                onClick={() => { setClosingId(s.id); setCashPhysical(0); }}
                                size="small"
                                variant="secondary"
                                style={{ color: 'var(--danger)' }}
                            >
                                Force Close
                            </Button>
                        ) : null}
                    />
                )}
            </div>

            {/* Pagination Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderTop: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                    Showing page <span style={{ color: 'var(--text)', fontWeight: 'bold' }}>{page}</span> of {totalPages || 1}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <Button
                        variant="secondary"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1 || loading}
                        icon={<ChevronLeft size={16} />}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages || loading}
                    >
                        Next <ChevronRight size={16} style={{ marginLeft: '6px' }} />
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ShiftManagement;
