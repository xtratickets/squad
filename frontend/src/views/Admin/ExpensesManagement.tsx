import React, { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { adminService } from '../../services/admin.service';
import { Plus, Trash2, Download } from 'lucide-react';
import DataTable from '../../components/common/DataTable';
import Button from '../../components/common/Button';
import { Input, Select } from '../../components/common/FormElements';
import GlassPanel from '../../components/common/GlassPanel';
import type { Expense, Shift } from '../../types';
import * as XLSX from 'xlsx';

const ExpensesManagement: React.FC = () => {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState({ amount: 0, category: '', shiftId: '' });
    const [loading, setLoading] = useState(true);

    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    const loadData = async () => {
        try {
            const [eRes, sRes] = await Promise.all([
                adminService.getExpenses(),
                adminService.getShifts(),
            ]);
            setExpenses(eRes.data);
            const shiftsData = (sRes.data as any).data || sRes.data;
            const activeShifts = Array.isArray(shiftsData) ? shiftsData.filter((s: Shift) => s.status === 'open') : [];
            setShifts(activeShifts);
            if (activeShifts.length > 0 && !formData.shiftId) {
                setFormData(prev => ({ ...prev, shiftId: activeShifts[0].id }));
            }
        } catch (err) {
            console.error('Error loading expenses', err);
        } finally {
            setLoading(false);
        }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { void loadData(); }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.shiftId) return toast.error('An active shift is required to record an expense.');
        try {
            await adminService.createExpense(formData);
            setIsCreating(false);
            setFormData({ amount: 0, category: '', shiftId: shifts[0]?.id || '' });
            loadData();
            toast.success('Expense recorded successfully');
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { error?: string } } }).response?.data?.error : undefined;
            toast.error(msg || 'Error creating expense');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this expense entry?')) return;
        try {
            await adminService.deleteExpense(id);
            loadData();
            toast.success('Expense deleted');
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { error?: string } } }).response?.data?.error : undefined;
            toast.error(msg || 'Error deleting expense');
        }
    };

    const filteredExpenses = useMemo(() => {
        return expenses.filter(exp => {
            const expDate = new Date(exp.createdAt).getTime();
            if (fromDate && expDate < new Date(fromDate).getTime()) return false;
            if (toDate && expDate > new Date(toDate).getTime() + 86400000) return false; // Include entire toDate
            return true;
        });
    }, [expenses, fromDate, toDate]);

    const exportToExcel = () => {
        const worksheetData = filteredExpenses.map(exp => ({
            'Category': exp.category,
            'Amount (EGP)': exp.amount,
            'Created By': exp.createdBy?.username || 'System',
            'Date': new Date(exp.createdAt).toLocaleString(),
        }));

        const ws = XLSX.utils.json_to_sheet(worksheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Expenses");

        const fileName = `Expenses_${fromDate || 'All'}_to_${toDate || 'All'}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    const columns = [
        { header: 'Category', key: 'category' },
        {
            header: 'Amount',
            key: 'amount',
            render: (exp: Expense) => <span style={{ fontWeight: '600', color: 'var(--danger)' }}>-EGP {exp.amount.toFixed(2)}</span>,
        },
        {
            header: 'Created By',
            key: 'createdBy',
            render: (exp: Expense) => exp.createdBy?.username || 'System',
        },
        {
            header: 'Date',
            key: 'createdAt',
            render: (exp: Expense) => new Date(exp.createdAt).toLocaleString(),
        },
    ];

    if (loading) return <div style={{ color: 'var(--text-muted)' }}>Loading expenses...</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>Operational Expenses</h2>

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

                    <Button onClick={() => setIsCreating(true)} icon={<Plus size={18} />}>Record Expense</Button>
                </div>
            </div>

            {isCreating && (
                <GlassPanel style={{ padding: '30px', marginBottom: '20px' }}>
                    <h3 style={{ marginBottom: '20px', color: 'var(--primary)' }}>New Expense Entry</h3>
                    <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                        <Input type="number" label="AMOUNT" value={formData.amount} onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) })} required />
                        <Input label="CATEGORY" placeholder="e.g. Cleaning Supplies" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} required />
                        <Select
                            label="ACTIVE SHIFT"
                            value={formData.shiftId}
                            options={[
                                ...shifts.map(s => ({ value: s.id, label: `${s.staff?.username ?? 'Unknown'} – ${new Date(s.startTime).toLocaleTimeString()}` })),
                                ...(shifts.length === 0 ? [{ value: '', label: 'No active shifts' }] : []),
                            ]}
                            onChange={e => setFormData({ ...formData, shiftId: e.target.value })}
                        />
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                            <Button type="submit" style={{ flex: 1 }}>Record</Button>
                            <Button type="button" variant="secondary" onClick={() => setIsCreating(false)} style={{ flex: 1 }}>Cancel</Button>
                        </div>
                    </form>
                </GlassPanel>
            )}

            <DataTable
                data={filteredExpenses}
                columns={columns}
                searchKey="category"
                searchPlaceholder="Search expenses..."
                actions={(exp: Expense) => (
                    <Button onClick={() => handleDelete(exp.id)} size="small" variant="secondary" style={{ color: 'var(--danger)' }}>
                        <Trash2 size={16} strokeWidth={2.5} />
                    </Button>
                )}
            />
        </div>
    );
};

export default ExpensesManagement;
