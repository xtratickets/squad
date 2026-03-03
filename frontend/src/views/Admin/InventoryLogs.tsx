import React, { useEffect, useState, useMemo } from 'react';
import { adminService } from '../../services/admin.service';
import { ArrowUpRight, ArrowDownLeft, Box, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import DataTable from '../../components/common/DataTable';
import Button from '../../components/common/Button';
import type { StockMovement } from '../../types';
import * as XLSX from 'xlsx';

const InventoryLogs: React.FC = () => {
    const [movements, setMovements] = useState<StockMovement[]>([]);
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
            const res = await adminService.getStockMovements({ page, pageSize });
            // Handle new paginated response format
            if ('data' in res.data) {
                setMovements(res.data.data);
                setTotalPages(res.data.totalPages);
                setTotalRecords(res.data.total);
            } else {
                // Fallback if backend wasn't updated
                setMovements(res.data as unknown as StockMovement[]);
            }
        } catch (err) {
            console.error('Error loading movements', err);
        } finally {
            setLoading(false);
        }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { void loadData(); }, [page, pageSize]);

    const filteredMovements = useMemo(() => {
        return movements.filter(m => {
            const mDate = new Date(m.createdAt).getTime();
            if (fromDate && mDate < new Date(fromDate).getTime()) return false;
            if (toDate && mDate > new Date(toDate).getTime() + 86400000) return false; // Include entire toDate
            return true;
        });
    }, [movements, fromDate, toDate]);

    const exportToExcel = () => {
        const worksheetData = filteredMovements.map(m => ({
            'Product': m.product?.name ?? 'Unknown Product',
            'Quantity': m.qty > 0 ? `+${m.qty}` : m.qty,
            'Type': m.type.toUpperCase(),
            'Reference': m.reference ?? '—',
            'Date': new Date(m.createdAt).toLocaleString(),
        }));

        const ws = XLSX.utils.json_to_sheet(worksheetData);
        // adjust column widths roughly
        ws['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 15 }, { wch: 25 }, { wch: 20 }];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "InventoryLogs");

        const fileName = `InventoryLogs_Page${page}_${fromDate || 'All'}_to_${toDate || 'All'}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    const columns = [
        {
            header: 'Product',
            key: 'product',
            render: (m: StockMovement) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Box size={16} color="var(--primary)" />
                    {m.product?.name ?? 'Unknown Product'}
                </div>
            ),
        },
        {
            header: 'Quantity',
            key: 'qty',
            render: (m: StockMovement) => (
                <span style={{ fontWeight: 'bold', color: m.qty > 0 ? 'var(--primary)' : 'var(--danger)' }}>
                    {m.qty > 0 ? `+${m.qty}` : m.qty}
                </span>
            ),
        },
        {
            header: 'Type',
            key: 'type',
            render: (m: StockMovement) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {m.type === 'add' || m.type === 'restock'
                        ? <ArrowUpRight size={14} color="var(--primary)" />
                        : <ArrowDownLeft size={14} color="var(--danger)" />}
                    <span style={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: 'bold' }}>{m.type}</span>
                </div>
            ),
        },
        {
            header: 'Reference',
            key: 'reference',
            render: (m: StockMovement) => <span style={{ color: 'var(--text-muted)' }}>{m.reference ?? '—'}</span>,
        },
        {
            header: 'Date',
            key: 'createdAt',
            render: (m: StockMovement) => (
                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{new Date(m.createdAt).toLocaleString()}</span>
            ),
        },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>Inventory Logs</h2>
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
                        Export Page
                    </Button>
                </div>
            </div>

            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading logs...</div>
                ) : (
                    <DataTable
                        data={filteredMovements}
                        columns={columns}
                        searchKey="reference"
                        searchPlaceholder="Search by reference..."
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

export default InventoryLogs;
