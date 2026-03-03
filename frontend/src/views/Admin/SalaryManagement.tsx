import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminService } from '../../services/admin.service';
import { Plus, Trash2, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import DataTable from '../../components/common/DataTable';
import Button from '../../components/common/Button';
import { Input, Select } from '../../components/common/FormElements';
import GlassPanel from '../../components/common/GlassPanel';
import type { Salary, User, Shift } from '../../types';
import * as XLSX from 'xlsx';

const SalaryManagement: React.FC = () => {
    const [salaries, setSalaries] = useState<Salary[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState({ staffId: '', amount: 0, period: '', shiftId: '' });
    const [loading, setLoading] = useState(true);

    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalSalaries, setTotalSalaries] = useState(0);

    const loadData = async () => {
        try {
            const [salRes, uRes, shRes] = await Promise.all([
                adminService.getSalaries({ page, pageSize, fromDate, toDate }),
                adminService.getUsers(),
                adminService.getShifts(),
            ]);
            setSalaries(salRes.data.data || salRes.data);
            setTotalPages(salRes.data.totalPages || 1);
            setTotalSalaries(salRes.data.total || 0);

            setUsers(uRes.data?.data || uRes.data);
            const shiftsArray = (shRes.data as any).data || shRes.data;
            const activeShifts = shiftsArray.filter((s: Shift) => s.status === 'open');
            setShifts(activeShifts);
            if ((uRes.data?.data || uRes.data).length > 0 && !formData.staffId) {
                setFormData(prev => ({ ...prev, staffId: (uRes.data?.data || uRes.data)[0].id }));
            }
        } catch (err) {
            console.error('Error loading salaries', err);
        } finally {
            setLoading(false);
        }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { void loadData(); }, [page, fromDate, toDate]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await adminService.createSalary({ ...formData, shiftId: formData.shiftId || undefined });
            setIsCreating(false);
            setFormData({ staffId: users[0]?.id || '', amount: 0, period: '', shiftId: '' });
            loadData();
            toast.success('Salary record created');
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { error?: string } } }).response?.data?.error : undefined;
            toast.error(msg || 'Error recording salary');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this salary payout?')) return;
        try {
            await adminService.deleteSalary(id);
            loadData();
            toast.success('Salary record deleted');
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { error?: string } } }).response?.data?.error : undefined;
            toast.error(msg || 'Error deleting salary payout');
        }
    };

    const exportToExcel = () => {
        // Current page export logic (if full system export is needed, a backend endpoint should be built instead)
        const worksheetData = salaries.map(sal => {
            const user = users.find(u => u.id === sal.staffId);
            return {
                'Staff Member': sal.staff?.username ?? user?.username ?? '—',
                'Amount (EGP)': sal.amount,
                'Period': sal.period,
                'Recorded At': new Date(sal.createdAt).toLocaleString(),
            };
        });

        const ws = XLSX.utils.json_to_sheet(worksheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Salaries");

        const fileName = `Salaries_${fromDate || 'All'}_to_${toDate || 'All'}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    const columns = [
        {
            header: 'Staff Member',
            key: 'staff',
            render: (sal: Salary) => {
                const user = users.find(u => u.id === sal.staffId);
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', background: 'var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 'bold' }}>
                            {(sal.staff?.username ?? user?.username ?? '?').charAt(0).toUpperCase()}
                        </div>
                        {sal.staff?.username ?? user?.username ?? '—'}
                    </div>
                );
            },
        },
        {
            header: 'Amount',
            key: 'amount',
            render: (sal: Salary) => <span style={{ fontWeight: '600', color: 'var(--danger)' }}>-EGP {sal.amount.toFixed(2)}</span>,
        },
        { header: 'Period', key: 'period' },
        {
            header: 'Recorded At',
            key: 'createdAt',
            render: (sal: Salary) => new Date(sal.createdAt).toLocaleString(),
        },
    ];

    if (loading) return <div style={{ color: 'var(--text-muted)' }}>Loading salaries...</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>Staff Salaries</h2>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '4px 12px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>FROM</span>
                            <input
                                type="date"
                                value={fromDate}
                                onChange={e => setFromDate(e.target.value)}
                                style={{ padding: '6px 10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '6px', fontSize: '13px' }}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>TO</span>
                            <input
                                type="date"
                                value={toDate}
                                onChange={e => setToDate(e.target.value)}
                                style={{ padding: '6px 10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '6px', fontSize: '13px' }}
                            />
                        </div>
                        <Button variant="secondary" onClick={exportToExcel} icon={<Download size={16} />} style={{ marginLeft: '4px', padding: '6px 12px' }}>
                            Export Excel
                        </Button>
                    </div>

                    <Button onClick={() => setIsCreating(true)} icon={<Plus size={18} />}>Record Payout</Button>
                </div>
            </div>

            {isCreating && (
                <GlassPanel style={{ padding: '30px', marginBottom: '20px' }}>
                    <h3 style={{ marginBottom: '20px', color: 'var(--primary)' }}>New Salary Payout</h3>
                    <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                        <Select
                            label="STAFF MEMBER"
                            value={formData.staffId}
                            options={users.map(u => ({ value: u.id, label: `${u.username} (${u.role.name})` }))}
                            onChange={e => setFormData({ ...formData, staffId: e.target.value })}
                        />
                        <Input type="number" label="AMOUNT" value={formData.amount} onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) })} required />
                        <Input label="PERIOD" placeholder="e.g. Feb 2026" value={formData.period} onChange={e => setFormData({ ...formData, period: e.target.value })} required />
                        <Select
                            label="SHIFT (OPTIONAL)"
                            value={formData.shiftId}
                            options={[
                                { value: '', label: 'No Shift (Standalone)' },
                                ...shifts.map(s => ({ value: s.id, label: `${s.staff?.username ?? 'Unknown'} – ${new Date(s.startTime).toLocaleTimeString()}` })),
                            ]}
                            onChange={e => setFormData({ ...formData, shiftId: e.target.value })}
                        />
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', gridColumn: 'span 2' }}>
                            <Button type="submit" style={{ flex: 1 }}>Record Payout</Button>
                            <Button type="button" variant="secondary" onClick={() => setIsCreating(false)} style={{ flex: 1 }}>Cancel</Button>
                        </div>
                    </form>
                </GlassPanel>
            )}

            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <DataTable
                    data={salaries}
                    columns={columns}
                    searchKey="period"
                    searchPlaceholder="Filter by period..."
                    actions={(sal: Salary) => (
                        <Button onClick={() => handleDelete(sal.id)} size="small" variant="secondary" style={{ color: 'var(--danger)' }}>
                            <Trash2 size={16} />
                        </Button>
                    )}
                />

                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '12px 24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            Showing page {page} of {totalPages} ({totalSalaries} total salaries)
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <Button
                                variant="secondary"
                                size="small"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                icon={<ChevronLeft size={16} />}
                            >
                                Previous
                            </Button>
                            <Button
                                variant="secondary"
                                size="small"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                icon={<ChevronRight size={16} />}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SalaryManagement;
