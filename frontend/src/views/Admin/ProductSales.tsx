import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import GlassPanel from '../../components/common/GlassPanel';
import Button from '../../components/common/Button';
import { Input, Select } from '../../components/common/FormElements';
import DataTable from '../../components/common/DataTable';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';

const ProductSales: React.FC = () => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        categoryId: ''
    });

    const loadCategories = async () => {
        try {
            const res = await api.get('/products/categories');
            setCategories(res.data);
        } catch {
            toast.error('Failed to load categories');
        }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            if (filters.categoryId) params.append('categoryId', filters.categoryId);
            params.append('page', String(page));
            params.append('pageSize', '50');

            const res = await api.get(`/reports/product-sales?${params.toString()}`);
            setData(res.data.data);
            setTotalPages(res.data.totalPages);
        } catch {
            toast.error('Failed to load product sales data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadCategories();
    }, []);

    useEffect(() => {
        void loadData();
    }, [page]);

    const handleFilter = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        void loadData();
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <GlassPanel style={{ padding: '20px' }}>
                <form onSubmit={handleFilter} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <Input
                        label="From Date"
                        type="date"
                        value={filters.startDate}
                        onChange={e => setFilters({ ...filters, startDate: e.target.value })}
                        style={{ flex: 1, minWidth: '150px' }}
                    />
                    <Input
                        label="To Date"
                        type="date"
                        value={filters.endDate}
                        onChange={e => setFilters({ ...filters, endDate: e.target.value })}
                        style={{ flex: 1, minWidth: '150px' }}
                    />
                    <Select
                        label="Category"
                        value={filters.categoryId}
                        onChange={e => setFilters({ ...filters, categoryId: e.target.value })}
                        style={{ flex: 1, minWidth: '150px' }}
                        options={[
                            { value: '', label: 'All Categories' },
                            ...categories.map(c => ({ value: c.id, label: c.name }))
                        ]}
                    />
                    <Button type="submit" loading={loading}>
                        <Filter size={16} /> Filter
                    </Button>
                </form>
            </GlassPanel>

            {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading sales data...</div>
            ) : (
                <>
                    <DataTable
                        data={data}
                        searchKey="name"
                        searchPlaceholder="Search product name..."
                        columns={[
                            { header: 'Product', key: 'name', render: (row: any) => <span style={{ fontWeight: 600 }}>{row.name}</span> },
                            { header: 'Category', key: 'categoryName', render: (row: any) => <span style={{ color: 'var(--text-muted)' }}>{row.categoryName}</span> },
                            { header: 'Qty Sold', key: 'totalQty', render: (row: any) => <span style={{ fontWeight: 700 }}>{row.totalQty}</span> },
                            { header: 'Revenue', key: 'totalRevenue', render: (row: any) => <span style={{ fontWeight: 700, color: 'var(--primary)' }}>EGP {row.totalRevenue.toFixed(2)}</span> },
                        ]}
                    />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Page {page} of {totalPages}</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <Button
                                variant="secondary"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                            >
                                <ChevronLeft size={16} /> Prev
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                            >
                                Next <ChevronRight size={16} />
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ProductSales;
