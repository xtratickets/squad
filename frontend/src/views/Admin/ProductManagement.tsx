import React, { useEffect, useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { adminService } from '../../services/admin.service';
import { Plus, Edit, Check, X, Trash2, PackagePlus, Tag, Image as ImageIcon, Upload, ChevronLeft, ChevronRight } from 'lucide-react';
import DataTable from '../../components/common/DataTable';
import Button from '../../components/common/Button';
import { Input, Select } from '../../components/common/FormElements';
import GlassPanel from '../../components/common/GlassPanel';
import type { Product, Category } from '../../types';

const ProductManagement: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isEditing, setIsEditing] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [stockTarget, setStockTarget] = useState<string | null>(null);
    const [stockForm, setStockForm] = useState({ qty: 0, type: 'restock', reference: '' });
    const [newCategory, setNewCategory] = useState('');
    const [showCategoryForm, setShowCategoryForm] = useState(false);
    const [formData, setFormData] = useState({ name: '', categoryId: '', price: 0, cost: 0, stockQty: 0 });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalProducts, setTotalProducts] = useState(0);

    const loadData = useCallback(async () => {
        try {
            const [pRes, cRes] = await Promise.all([
                adminService.getProducts({ page, pageSize }),
                adminService.getCategories(),
            ]);
            setProducts(pRes.data.data || pRes.data);
            setTotalPages(pRes.data.totalPages || 1);
            setTotalProducts(pRes.data.total || 0);

            setCategories(cRes.data);
            if (cRes.data.length > 0 && !formData.categoryId) {
                setFormData(prev => ({ ...prev, categoryId: cRes.data[0].id }));
            }
        } catch (err) {
            console.error('Error loading products', err);
        } finally {
            setLoading(false);
        }
    }, [formData.categoryId]);

    useEffect(() => { loadData(); }, [loadData, page]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const data = new FormData();
            data.append('name', formData.name);
            data.append('categoryId', formData.categoryId);
            data.append('price', formData.price.toString());
            data.append('cost', formData.cost.toString());
            data.append('stockQty', formData.stockQty.toString());
            if (imageFile) {
                data.append('image', imageFile);
            }

            await adminService.createProduct(data);
            setIsCreating(false);
            setFormData({ name: '', categoryId: categories[0]?.id || '', price: 0, cost: 0, stockQty: 0 });
            setImageFile(null);
            setImagePreview(null);
            loadData();
            toast.success('Product created successfully');
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { error?: string } } }).response?.data?.error : undefined;
            toast.error(msg || 'Error creating product');
        }
    };

    const handleUpdate = async (id: string) => {
        try {
            const data = new FormData();
            data.append('name', formData.name);
            data.append('categoryId', formData.categoryId);
            data.append('price', formData.price.toString());
            data.append('cost', formData.cost.toString());
            data.append('stockQty', formData.stockQty.toString());
            if (imageFile) {
                data.append('image', imageFile);
            }

            await adminService.updateProduct(id, data);
            setIsEditing(null);
            setImageFile(null);
            setImagePreview(null);
            loadData();
            toast.success('Product updated');
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { error?: string } } }).response?.data?.error : undefined;
            toast.error(msg || 'Error updating product');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this product?')) return;
        try {
            await adminService.deleteProduct(id);
            loadData();
            toast.success('Product deleted');
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { error?: string } } }).response?.data?.error : undefined;
            toast.error(msg || 'Error deleting product');
        }
    };

    const handleAddStock = async (productId: string) => {
        try {
            await adminService.addStock(productId, stockForm.qty, stockForm.type, stockForm.reference);
            setStockTarget(null);
            setStockForm({ qty: 0, type: 'restock', reference: '' });
            loadData();
            toast.success('Stock adjusted');
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { error?: string } } }).response?.data?.error : undefined;
            toast.error(msg || 'Error adding stock');
        }
    };

    const handleCreateCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await adminService.createCategory({ name: newCategory });
            setNewCategory('');
            setShowCategoryForm(false);
            loadData();
            toast.success('Category created');
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { error?: string } } }).response?.data?.error : undefined;
            toast.error(msg || 'Error creating category');
        }
    };

    const handleDeleteCategory = async (id: string) => {
        if (!window.confirm('Delete this category? Products using it must be reassigned first.')) return;
        try {
            await adminService.deleteCategory(id);
            loadData();
            toast.success('Category deleted');
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { error?: string } } }).response?.data?.error : undefined;
            toast.error(msg || 'Error deleting category');
        }
    };

    const startEdit = (product: Product) => {
        setIsEditing(product.id);
        setFormData({ name: product.name, categoryId: product.categoryId, price: product.price, cost: product.cost, stockQty: product.stockQty });
        setImagePreview(product.imageUrl || null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const columns = [
        {
            header: 'Image',
            key: 'imageUrl',
            render: (p: Product) => (
                <div style={{ width: '40px', height: '40px', borderRadius: '8px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <ImageIcon size={18} color="var(--text-muted)" />
                    )}
                </div>
            )
        },
        {
            header: 'Product',
            key: 'name',
            render: (p: Product) => isEditing === p.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', background: 'rgba(255,255,255,0.06)',
                                border: '1px solid var(--border)', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', color: 'var(--text)'
                            }}
                        >
                            <Upload size={14} /> {imageFile ? 'Change' : 'Upload'}
                        </button>
                        {imagePreview && (
                            <img src={imagePreview} style={{ width: '24px', height: '24px', borderRadius: '4px', objectFit: 'cover' }} alt="Preview" />
                        )}
                        <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileChange} />
                    </div>
                </div>
            ) : p.name,
        },
        {
            header: 'Category',
            key: 'category',
            render: (p: Product) => isEditing === p.id ? (
                <Select
                    value={formData.categoryId}
                    options={categories.map(c => ({ value: c.id, label: c.name }))}
                    onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
                />
            ) : (
                <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                    {p.category?.name ?? categories.find(c => c.id === p.categoryId)?.name ?? '—'}
                </span>
            ),
        },
        {
            header: 'Price',
            key: 'price',
            render: (p: Product) => isEditing === p.id ? (
                <Input type="number" value={formData.price} onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })} />
            ) : `EGP${p.price.toFixed(2)}`,
        },
        {
            header: 'Cost',
            key: 'cost',
            render: (p: Product) => isEditing === p.id ? (
                <Input type="number" value={formData.cost} onChange={e => setFormData({ ...formData, cost: parseFloat(e.target.value) })} />
            ) : <span style={{ color: 'var(--text-muted)' }}>EGP {p.cost.toFixed(2)}</span>,
        },
        {
            header: 'Stock',
            key: 'stockQty',
            render: (p: Product) => isEditing === p.id ? (
                <Input type="number" value={formData.stockQty} onChange={e => setFormData({ ...formData, stockQty: parseInt(e.target.value) })} />
            ) : (
                <span style={{ color: p.stockQty < 5 ? 'var(--danger)' : p.stockQty < 15 ? '#ffab00' : 'inherit', fontWeight: p.stockQty < 15 ? 'bold' : 'normal' }}>
                    {p.stockQty} {p.stockQty < 5 ? '⚠' : ''}
                </span>
            ),
        },
    ];

    if (loading) return <div style={{ color: 'var(--text-muted)' }}>Loading products...</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', height: '100%', paddingBottom: '20px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <h2 style={{ fontSize: '24px', fontWeight: '600' }}>Product & Inventory</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <Button variant="secondary" size="small" onClick={() => setShowCategoryForm(v => !v)} icon={<Tag size={16} />}>
                        Categories
                    </Button>
                    <Button onClick={() => setIsCreating(true)} icon={<Plus size={18} />}>
                        Add Product
                    </Button>
                </div>
            </div>

            {/* Category Panel */}
            {showCategoryForm && (
                <GlassPanel style={{ padding: '25px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Tag size={18} color="var(--primary)" /> Category Management
                        </h3>
                        <form onSubmit={handleCreateCategory} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <Input
                                placeholder="New category name"
                                value={newCategory}
                                onChange={e => setNewCategory(e.target.value)}
                                required
                                style={{ width: '200px' }}
                            />
                            <Button type="submit" size="small" icon={<Plus size={14} />}>Add</Button>
                        </form>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {categories.map(cat => (
                            <div key={cat.id} style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                background: 'rgba(255,255,255,0.05)', padding: '8px 12px',
                                borderRadius: '8px', fontSize: '13px', fontWeight: '500',
                            }}>
                                {cat.name}
                                <button onClick={() => handleDeleteCategory(cat.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '0', display: 'flex', lineHeight: 1 }}>
                                    <Trash2 size={14} strokeWidth={2.5} />
                                </button>
                            </div>
                        ))}
                        {categories.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No categories yet</span>}
                    </div>
                </GlassPanel>
            )}

            {/* Create Product Form */}
            {isCreating && (
                <GlassPanel style={{ padding: '30px' }}>
                    <h3 style={{ marginBottom: '20px', color: 'var(--primary)' }}>Create Product</h3>
                    <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Product Image</label>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    width: '100%', height: '100px', borderRadius: '10px', border: '2px dashed var(--border)',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', overflow: 'hidden', position: 'relative'
                                }}
                            >
                                {imagePreview ? (
                                    <img src={imagePreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Preview" />
                                ) : (
                                    <>
                                        <Upload size={24} strokeWidth={2.5} color="var(--text-muted)" />
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>Click to upload</span>
                                    </>
                                )}
                            </div>
                            <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileChange} />
                        </div>
                        <Input placeholder="Product Name" label="Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                        <Select
                            label="Category"
                            value={formData.categoryId}
                            options={categories.map(c => ({ value: c.id, label: c.name }))}
                            onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
                        />
                        <Input type="number" placeholder="Price (EGP)" label="Price" value={formData.price} onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })} required />
                        <Input type="number" placeholder="Cost (EGP)" label="Cost" value={formData.cost} onChange={e => setFormData({ ...formData, cost: parseFloat(e.target.value) })} required />
                        <Input type="number" placeholder="Stock Qty" label="Initial Stock" value={formData.stockQty} onChange={e => setFormData({ ...formData, stockQty: parseInt(e.target.value) })} required />
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                            <Button type="submit">Create Product</Button>
                            <Button type="button" variant="secondary" onClick={() => { setIsCreating(false); setImagePreview(null); setImageFile(null); }}>Cancel</Button>
                        </div>
                    </form>
                </GlassPanel>
            )}

            {/* Add Stock Form */}
            {stockTarget && (
                <GlassPanel style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <PackagePlus size={18} /> Adjust Stock
                    </span>
                    <Input type="number" label="QTY" value={stockForm.qty} onChange={e => setStockForm({ ...stockForm, qty: parseInt(e.target.value) })} style={{ width: '100px' }} />
                    <Select
                        label="TYPE"
                        value={stockForm.type}
                        options={[
                            { value: 'restock', label: 'Restock' },
                            { value: 'add', label: 'Add' },
                            { value: 'adjustment', label: 'Adjustment' },
                            { value: 'deduct', label: 'Deduct' },
                        ]}
                        onChange={e => setStockForm({ ...stockForm, type: e.target.value })}
                    />
                    <Input placeholder="Reference" value={stockForm.reference} onChange={e => setStockForm({ ...stockForm, reference: e.target.value })} style={{ width: '180px' }} />
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Button size="small" onClick={() => handleAddStock(stockTarget)} icon={<Check size={14} />}>Apply</Button>
                        <Button size="small" variant="secondary" onClick={() => setStockTarget(null)}><X size={14} /></Button>
                    </div>
                </GlassPanel>
            )}

            {/* Products Table */}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <DataTable
                    data={products}
                    columns={columns}
                    searchKey="name"
                    searchPlaceholder="Search products..."
                    actions={(p: Product) => (
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            {isEditing === p.id ? (
                                <>
                                    <Button onClick={() => handleUpdate(p.id)} size="small" variant="primary"><Check size={16} /></Button>
                                    <Button onClick={() => setIsEditing(null)} size="small" variant="secondary"><X size={16} /></Button>
                                </>
                            ) : (
                                <>
                                    <Button onClick={() => { setStockTarget(p.id); setStockForm({ qty: 0, type: 'restock', reference: '' }); }} size="small" variant="secondary" title="Add Stock">
                                        <PackagePlus size={16} strokeWidth={2.5} />
                                    </Button>
                                    <Button onClick={() => startEdit(p)} size="small" variant="secondary"><Edit size={16} strokeWidth={2.5} /></Button>
                                    <Button onClick={() => handleDelete(p.id)} size="small" variant="secondary" style={{ color: 'var(--danger)' }}><Trash2 size={16} strokeWidth={2.5} /></Button>
                                </>
                            )}
                        </div>
                    )}
                />

                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '12px 24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            Showing page {page} of {totalPages} ({totalProducts} total products)
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

export default ProductManagement;
