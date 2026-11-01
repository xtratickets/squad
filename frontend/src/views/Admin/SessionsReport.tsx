import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminService, type SessionRow } from '../../services/admin.service';
import DataTable from '../../components/common/DataTable';
import Button from '../../components/common/Button';
import BulkActionBar from '../../components/common/BulkActionBar';
import ExportButtons from '../../components/common/ExportButtons';
import { Select } from '../../components/common/FormElements';
import { useSelection, runBulk } from '../../hooks/useSelection';
import { Ban, ChevronLeft, ChevronRight } from 'lucide-react';

const money = (n: number) => `EGP ${Math.round(n).toLocaleString('en-US')}`;
const fmtDuration = (mins?: number) => (mins === undefined ? '—' : `${Math.floor(mins / 60)}h ${mins % 60}m`);

const statusColor: Record<string, string> = {
    active: '#00e676',
    closed: 'var(--text-muted)',
    cancelled: 'var(--danger)',
};

const sessionColumns = [
    { header: 'Room', value: (s: SessionRow) => s.room?.name ?? '—' },
    { header: 'Status', value: (s: SessionRow) => s.status },
    { header: 'Start', value: (s: SessionRow) => new Date(s.startTime).toLocaleString() },
    { header: 'End', value: (s: SessionRow) => (s.endTime ? new Date(s.endTime).toLocaleString() : '') },
    { header: 'Duration (min)', value: (s: SessionRow) => s.sessionCharge?.durationMinutes ?? '' },
    { header: 'Staff', value: (s: SessionRow) => s.staffUsername ?? '' },
    { header: 'Room Amount (EGP)', value: (s: SessionRow) => Math.round(s.sessionCharge?.roomAmount ?? 0) },
    { header: 'Orders Amount (EGP)', value: (s: SessionRow) => Math.round(s.sessionCharge?.ordersAmount ?? 0) },
    { header: 'Discount (EGP)', value: (s: SessionRow) => Math.round(s.sessionCharge?.discount ?? 0) },
    { header: 'Total (EGP)', value: (s: SessionRow) => Math.round(s.sessionCharge?.finalTotal ?? 0) },
    { header: 'Paid With', value: (s: SessionRow) => s.payments.map(p => `${p.mode.name} ${Math.round(p.amount)}`).join(' + ') },
];

const SessionsReport: React.FC = () => {
    const [rows, setRows] = useState<SessionRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [status, setStatus] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const sel = useSelection();
    const { prune } = sel;

    const filters = useCallback(() => ({
        startDate: fromDate || undefined,
        endDate: toDate || undefined,
        status: status || undefined,
    }), [fromDate, toDate, status]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminService.getSessions({ ...filters(), page, pageSize: 50 });
            setRows(res.data.data);
            setTotalPages(Math.max(1, res.data.totalPages));
            setTotal(res.data.total);
            prune(res.data.data.map(s => s.id));
        } catch {
            toast.error('Failed to load sessions');
        } finally {
            setLoading(false);
        }
    }, [filters, page, prune]);

    useEffect(() => { void load(); }, [load]);
    useEffect(() => { setPage(1); }, [fromDate, toDate, status]);

    const cancellable = rows.filter(s => sel.selected.has(s.id) && s.status !== 'cancelled');

    const handleBulkCancel = async () => {
        if (cancellable.length === 0) return toast.error('Selected sessions are already cancelled');
        if (!window.confirm(`Cancel ${cancellable.length} session(s)? Their charges and payments will be reverted.`)) return;
        await runBulk(cancellable.map(s => s.id), id => adminService.cancelSession(id), 'Cancelled');
        sel.clear();
        void load();
    };

    const inputStyle: React.CSSProperties = { padding: '6px 10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '6px', fontSize: '13px' };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: 600, margin: 0 }}>Sessions</h2>
                    <span style={{ color: 'var(--text-muted)', fontSize: '14px', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '12px' }}>
                        Total: {total} Records
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', background: 'rgba(255,255,255,0.03)', padding: '4px 12px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>FROM</span>
                    <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={inputStyle} />
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>TO</span>
                    <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={inputStyle} />
                    <div style={{ minWidth: '130px' }}>
                        <Select
                            value={status}
                            onChange={e => setStatus(e.target.value)}
                            style={{ padding: '6px 10px', fontSize: '13px' }}
                            options={[{ value: '', label: 'All statuses' }, { value: 'active', label: 'Active' }, { value: 'closed', label: 'Closed' }, { value: 'cancelled', label: 'Cancelled' }]}
                        />
                    </div>
                    <ExportButtons
                        title="Sessions Report"
                        filename="Sessions"
                        columns={sessionColumns}
                        getRows={async () => (await adminService.getSessions({ ...filters(), page: 1, pageSize: 10000 })).data.data}
                        summary={all => [
                            { label: 'Sessions', value: all.length },
                            { label: 'Total billed', value: money(all.filter(s => s.status === 'closed').reduce((sum, s) => sum + (s.sessionCharge?.finalTotal ?? 0), 0)) },
                        ]}
                    />
                </div>
            </div>

            <BulkActionBar count={sel.selected.size} onClear={sel.clear}>
                <Button size="small" variant="secondary" onClick={handleBulkCancel} icon={<Ban size={14} />} style={{ color: 'var(--danger)' }}>
                    Cancel sessions
                </Button>
            </BulkActionBar>

            <DataTable
                data={rows}
                loading={loading}
                selectable
                selectedIds={sel.selected}
                onSelectionChange={sel.setSelected}
                searchKey="id"
                searchPlaceholder="Search by session ID..."
                columns={[
                    { header: 'Room', key: 'room', render: (s: SessionRow) => <span style={{ fontWeight: 600 }}>{s.room?.name ?? '—'}</span> },
                    { header: 'Status', key: 'status', render: (s: SessionRow) => <span style={{ color: statusColor[s.status], fontWeight: 700, textTransform: 'uppercase', fontSize: '11px' }}>{s.status}</span> },
                    { header: 'Started', key: 'startTime', render: (s: SessionRow) => <span style={{ fontSize: '13px' }}>{new Date(s.startTime).toLocaleString()}</span> },
                    { header: 'Duration', key: 'duration', render: (s: SessionRow) => fmtDuration(s.sessionCharge?.durationMinutes) },
                    { header: 'Staff', key: 'staff', render: (s: SessionRow) => s.staffUsername ?? '—' },
                    { header: 'Total', key: 'total', render: (s: SessionRow) => (
                        <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{s.sessionCharge ? money(s.sessionCharge.finalTotal) : '—'}</span>
                    ) },
                ]}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderTop: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Page {page} of {totalPages}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <Button variant="secondary" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading} icon={<ChevronLeft size={16} />}>Previous</Button>
                    <Button variant="secondary" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading}>Next <ChevronRight size={16} /></Button>
                </div>
            </div>
        </div>
    );
};

export default SessionsReport;
