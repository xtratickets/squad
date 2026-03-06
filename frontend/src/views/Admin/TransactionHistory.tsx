import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/admin.service';
import { Receipt, ArrowRight, Wallet, CreditCard, Banknote, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import DataTable from '../../components/common/DataTable';
import Button from '../../components/common/Button';
import type { Payment } from '../../types';
import * as XLSX from 'xlsx';

const TransactionHistory: React.FC = () => {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);

    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    const [page, setPage] = useState(1);
    const [pageSize] = useState(50);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await adminService.getPayments({ page, pageSize, startDate: fromDate || undefined, endDate: toDate || undefined });
            const payload = res.data as any;
            if (payload && typeof payload === 'object' && 'data' in payload) {
                setPayments(payload.data);
                setTotalPages(payload.totalPages);
                setTotalRecords(payload.total);
            } else {
                setPayments(payload as Payment[]);
            }
        } catch (err) {
            console.error('Error loading payments', err);
        } finally {
            setLoading(false);
        }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { void loadData(); }, [page, pageSize, fromDate, toDate]);

    const exportToExcel = () => {
        const worksheetData = payments.map(p => ({
            'Reference Type': p.referenceType.toUpperCase(),
            'Reference ID': p.referenceId,
            'Mode': p.mode.name,
            'Amount (EGP)': p.amount,
            'Staff': p.shift?.staff?.username ?? 'System',
            'Date': new Date(p.createdAt).toLocaleString(),
        }));

        const ws = XLSX.utils.json_to_sheet(worksheetData);
        ws['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 }];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Transactions");

        const fileName = `Transactions_Page${page}_${fromDate || 'All'}_to_${toDate || 'All'}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    const getModeIcon = (modeName: string) => {
        switch (modeName.toUpperCase()) {
            case 'CASH': return <Banknote size={16} color="var(--primary)" />;
            case 'CARD': return <CreditCard size={16} color="#4fc3f7" />;
            case 'WALLET': return <Wallet size={16} color="#ffb74d" />;
            default: return <Receipt size={16} />;
        }
    };

    const columns = [
        {
            header: 'Reference',
            key: 'referenceId',
            render: (p: Payment) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'monospace', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{p.referenceType.toUpperCase()}</span>
                    <ArrowRight size={12} color="var(--text-muted)" />
                    {p.referenceId.slice(0, 13)}…
                </div>
            ),
        },
        {
            header: 'Mode',
            key: 'mode',
            render: (p: Payment) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {getModeIcon(p.mode.name)}
                    {p.mode.name}
                </div>
            ),
        },
        {
            header: 'Amount',
            key: 'amount',
            render: (p: Payment) => <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>EGP {Math.round(p.amount)}</span>,
        },
        {
            header: 'Staff',
            key: 'staff',
            render: (p: Payment) => p.shift?.staff?.username ?? 'System',
        },
        {
            header: 'Date',
            key: 'createdAt',
            render: (p: Payment) => <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{new Date(p.createdAt).toLocaleString()}</span>,
        },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>Transaction History</h2>
                    <span style={{ color: 'var(--text-muted)', fontSize: '14px', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '12px' }}>
                        Total: {totalRecords} Records
                    </span>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '4px 12px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>FROM</span>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={e => { setFromDate(e.target.value); setPage(1); }}
                            style={{ padding: '6px 10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '6px', fontSize: '13px' }}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>TO</span>
                        <input
                            type="date"
                            value={toDate}
                            onChange={e => { setToDate(e.target.value); setPage(1); }}
                            style={{ padding: '6px 10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '6px', fontSize: '13px' }}
                        />
                    </div>
                    <Button variant="secondary" onClick={exportToExcel} icon={<Download size={16} />} style={{ marginLeft: '4px', padding: '6px 12px' }}>
                        Export Page
                    </Button>
                </div>
            </div>

            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading transactions...</div>
                ) : (
                    <DataTable
                        data={payments}
                        columns={columns}
                        searchKey="referenceId"
                        searchPlaceholder="Search by Reference ID..."
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

export default TransactionHistory;
