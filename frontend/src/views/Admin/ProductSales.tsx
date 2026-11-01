import React, { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { adminService, type MonthlySalesRow, type ProductSaleRow } from '../../services/admin.service';
import GlassPanel from '../../components/common/GlassPanel';
import Button from '../../components/common/Button';
import { Select } from '../../components/common/FormElements';
import DataTable from '../../components/common/DataTable';
import ExportButtons from '../../components/common/ExportButtons';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Category } from '../../types';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const money = (n: number) => `EGP ${Math.round(n).toLocaleString('en-US')}`;

/** Exact local-time bounds so the product breakdown matches the monthly table. */
const periodRange = (year: number, month: number | 'year') => {
    const from = month === 'year' ? new Date(year, 0, 1) : new Date(year, month, 1);
    const to = month === 'year' ? new Date(year + 1, 0, 1) : new Date(year, month + 1, 1);
    return { startDate: from.toISOString(), endDate: to.toISOString() };
};

const ProductSales: React.FC = () => {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [months, setMonths] = useState<MonthlySalesRow[]>([]);
    const [monthsLoading, setMonthsLoading] = useState(true);
    const [period, setPeriod] = useState<number | 'year'>(now.getMonth());

    const [categories, setCategories] = useState<Category[]>([]);
    const [categoryId, setCategoryId] = useState('');
    const [data, setData] = useState<ProductSaleRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        adminService.getCategories().then(r => setCategories(r.data)).catch(() => toast.error('Failed to load categories'));
    }, []);

    useEffect(() => {
        let cancelled = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMonthsLoading(true);
        adminService.getMonthlySales(year)
            .then(r => { if (!cancelled) setMonths(r.data.months); })
            .catch(() => { if (!cancelled) { setMonths([]); toast.error('Failed to load monthly sales'); } })
            .finally(() => { if (!cancelled) setMonthsLoading(false); });
        return () => { cancelled = true; };
    }, [year]);

    const fetchProducts = useCallback((pageNum: number, pageSize: number) => {
        return adminService.getProductSales({ ...periodRange(year, period), categoryId: categoryId || undefined, page: pageNum, pageSize });
    }, [year, period, categoryId]);

    // Any filter change goes back to page 1; both effects collapse into one fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { setPage(1); }, [year, period, categoryId]);

    useEffect(() => {
        let cancelled = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(true);
        fetchProducts(page, 50)
            .then(res => {
                if (cancelled) return;
                setData(res.data.data);
                setTotalPages(Math.max(1, res.data.totalPages));
            })
            .catch(() => { if (!cancelled) toast.error('Failed to load product sales data'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [fetchProducts, page]);

    const totals = useMemo(() => months.reduce((acc, m) => ({
        sessionsRevenue: acc.sessionsRevenue + m.sessionsRevenue,
        ordersRevenue: acc.ordersRevenue + m.ordersRevenue,
        totalRevenue: acc.totalRevenue + m.totalRevenue,
        sessionsCount: acc.sessionsCount + m.sessionsCount,
        ordersCount: acc.ordersCount + m.ordersCount,
        expenses: acc.expenses + m.expenses,
        salaries: acc.salaries + m.salaries,
        net: acc.net + m.net,
    }), { sessionsRevenue: 0, ordersRevenue: 0, totalRevenue: 0, sessionsCount: 0, ordersCount: 0, expenses: 0, salaries: 0, net: 0 }), [months]);

    const periodLabel = period === 'year' ? `${year}` : `${MONTH_NAMES[period]} ${year}`;

    const monthlyColumns = [
        { header: 'Month', value: (m: MonthlySalesRow) => MONTH_NAMES[parseInt(m.month.slice(5)) - 1] },
        { header: 'Room Sessions (EGP)', value: (m: MonthlySalesRow) => Math.round(m.sessionsRevenue) },
        { header: 'Product Orders (EGP)', value: (m: MonthlySalesRow) => Math.round(m.ordersRevenue) },
        { header: 'Total Sales (EGP)', value: (m: MonthlySalesRow) => Math.round(m.totalRevenue) },
        { header: '# Sessions', value: (m: MonthlySalesRow) => m.sessionsCount },
        { header: '# Orders', value: (m: MonthlySalesRow) => m.ordersCount },
        { header: 'Expenses (EGP)', value: (m: MonthlySalesRow) => Math.round(m.expenses) },
        { header: 'Salaries (EGP)', value: (m: MonthlySalesRow) => Math.round(m.salaries) },
        { header: 'Net (EGP)', value: (m: MonthlySalesRow) => Math.round(m.net) },
    ];

    const productColumns = [
        { header: 'Product', value: (r: ProductSaleRow) => r.name },
        { header: 'Category', value: (r: ProductSaleRow) => r.categoryName },
        { header: 'Qty Sold', value: (r: ProductSaleRow) => r.totalQty },
        { header: 'Revenue (EGP)', value: (r: ProductSaleRow) => Math.round(r.totalRevenue) },
    ];

    const th: React.CSSProperties = { padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' };
    const td: React.CSSProperties = { padding: '14px 16px', textAlign: 'right', fontFamily: 'monospace', whiteSpace: 'nowrap' };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Monthly summary */}
            <GlassPanel style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Monthly Sales</h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Button variant="secondary" size="small" onClick={() => setYear(y => y - 1)} aria-label="Previous year"><ChevronLeft size={16} /></Button>
                            <span style={{ fontWeight: 700, minWidth: '48px', textAlign: 'center' }}>{year}</span>
                            <Button variant="secondary" size="small" onClick={() => setYear(y => y + 1)} disabled={year >= now.getFullYear()} aria-label="Next year"><ChevronRight size={16} /></Button>
                        </div>
                    </div>
                    <ExportButtons
                        title={`Monthly Sales ${year}`}
                        filename={`Monthly_Sales_${year}`}
                        columns={monthlyColumns}
                        getRows={() => months}
                        summary={() => [
                            { label: 'Total sales', value: money(totals.totalRevenue) },
                            { label: 'Expenses', value: money(totals.expenses) },
                            { label: 'Salaries', value: money(totals.salaries) },
                            { label: 'Net', value: money(totals.net) },
                        ]}
                    />
                </div>

                <div className="scrollable-x">
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '860px' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                <th style={{ ...th, textAlign: 'left' }}>Month</th>
                                <th style={th}>Room Sessions</th>
                                <th style={th}>Product Orders</th>
                                <th style={th}>Total Sales</th>
                                <th style={th}># Sessions</th>
                                <th style={th}># Orders</th>
                                <th style={th}>Expenses</th>
                                <th style={th}>Salaries</th>
                                <th style={th}>Net</th>
                            </tr>
                        </thead>
                        <tbody style={{ opacity: monthsLoading ? 0.5 : 1 }}>
                            {months.map((m, i) => {
                                const active = period === i;
                                const empty = m.totalRevenue === 0 && m.expenses === 0 && m.salaries === 0;
                                return (
                                    <tr
                                        key={m.month}
                                        onClick={() => setPeriod(i)}
                                        className="data-table-row"
                                        style={{ cursor: 'pointer', background: active ? 'rgba(0,230,118,0.08)' : undefined, color: empty ? 'var(--text-muted)' : undefined }}
                                    >
                                        <td style={{ ...td, textAlign: 'left', fontFamily: 'inherit', fontWeight: active ? 700 : 500 }}>{MONTH_NAMES[i]}</td>
                                        <td style={td}>{money(m.sessionsRevenue)}</td>
                                        <td style={td}>{money(m.ordersRevenue)}</td>
                                        <td style={{ ...td, fontWeight: 700, color: empty ? undefined : 'var(--primary)' }}>{money(m.totalRevenue)}</td>
                                        <td style={td}>{m.sessionsCount}</td>
                                        <td style={td}>{m.ordersCount}</td>
                                        <td style={td}>{money(m.expenses)}</td>
                                        <td style={td}>{money(m.salaries)}</td>
                                        <td style={{ ...td, fontWeight: 700, color: m.net < 0 ? 'var(--danger)' : undefined }}>{money(m.net)}</td>
                                    </tr>
                                );
                            })}
                            <tr
                                onClick={() => setPeriod('year')}
                                style={{ cursor: 'pointer', borderTop: '2px solid var(--border)', fontWeight: 700, background: period === 'year' ? 'rgba(0,230,118,0.08)' : 'rgba(255,255,255,0.03)' }}
                            >
                                <td style={{ ...td, textAlign: 'left', fontFamily: 'inherit' }}>Total {year}</td>
                                <td style={td}>{money(totals.sessionsRevenue)}</td>
                                <td style={td}>{money(totals.ordersRevenue)}</td>
                                <td style={{ ...td, color: 'var(--primary)' }}>{money(totals.totalRevenue)}</td>
                                <td style={td}>{totals.sessionsCount}</td>
                                <td style={td}>{totals.ordersCount}</td>
                                <td style={td}>{money(totals.expenses)}</td>
                                <td style={td}>{money(totals.salaries)}</td>
                                <td style={{ ...td, color: totals.net < 0 ? 'var(--danger)' : undefined }}>{money(totals.net)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Sales = payments collected in the month. Click a month (or the total row) to see the product breakdown below.
                </div>
            </GlassPanel>

            {/* Product breakdown for the selected period */}
            <GlassPanel style={{ padding: '20px', display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap', flex: 1 }}>
                    <div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Product sales for</div>
                        <div style={{ fontSize: '18px', fontWeight: 700 }}>{periodLabel}</div>
                    </div>
                    <Select
                        label="Category"
                        value={categoryId}
                        onChange={e => setCategoryId(e.target.value)}
                        style={{ minWidth: '180px' }}
                        options={[{ value: '', label: 'All Categories' }, ...categories.map(c => ({ value: c.id, label: c.name }))]}
                    />
                </div>
                <ExportButtons
                    title={`Product Sales – ${periodLabel}`}
                    filename={`Product_Sales_${periodLabel.replace(/\s+/g, '_')}`}
                    columns={productColumns}
                    getRows={async () => (await fetchProducts(1, 10000)).data.data}
                    summary={rows => [
                        { label: 'Products', value: rows.length },
                        { label: 'Units sold', value: rows.reduce((s, r) => s + r.totalQty, 0) },
                        { label: 'Revenue', value: money(rows.reduce((s, r) => s + r.totalRevenue, 0)) },
                    ]}
                />
            </GlassPanel>

            <DataTable
                data={data}
                loading={loading}
                searchKey="name"
                searchPlaceholder="Search product name..."
                columns={[
                    { header: 'Product', key: 'name', render: (row: ProductSaleRow) => <span style={{ fontWeight: 600 }}>{row.name}</span> },
                    { header: 'Category', key: 'categoryName', render: (row: ProductSaleRow) => <span style={{ color: 'var(--text-muted)' }}>{row.categoryName}</span> },
                    { header: 'Qty Sold', key: 'totalQty', render: (row: ProductSaleRow) => <span style={{ fontWeight: 700 }}>{row.totalQty}</span> },
                    { header: 'Revenue', key: 'totalRevenue', render: (row: ProductSaleRow) => <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{money(row.totalRevenue)}</span> },
                ]}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Page {page} of {totalPages}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <Button variant="secondary" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading}>
                        <ChevronLeft size={16} /> Prev
                    </Button>
                    <Button variant="secondary" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading}>
                        Next <ChevronRight size={16} />
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ProductSales;
