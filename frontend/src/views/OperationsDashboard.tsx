import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import GlassPanel from '../components/common/GlassPanel';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import { Input, Select } from '../components/common/FormElements';
import DataTable from '../components/common/DataTable';
import ProductManagement from './Admin/ProductManagement';
import ExpensesManagement from './Admin/ExpensesManagement';
import SalaryManagement from './Admin/SalaryManagement';
import ReservationsManagement from './Admin/ReservationsManagement';
import ProductSales from './Admin/ProductSales';
import {
    Layers, ShoppingCart, CreditCard, Calendar, Package,
    DollarSign, Clock, Edit3, X, Check, Printer, ChevronLeft, ChevronRight, BarChart3
} from 'lucide-react';

type Tab = 'sessions' | 'orders' | 'payments' | 'reservations' | 'products' | 'expenses' | 'shifts' | 'sales';

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'sessions', label: 'Sessions', icon: <Layers size={16} /> },
    { key: 'orders', label: 'Orders', icon: <ShoppingCart size={16} /> },
    { key: 'payments', label: 'Payments', icon: <CreditCard size={16} /> },
    { key: 'reservations', label: 'Reservations', icon: <Calendar size={16} /> },
    { key: 'products', label: 'Products & Stock', icon: <Package size={16} /> },
    { key: 'sales', label: 'Product Sales', icon: <BarChart3 size={16} /> },
    { key: 'expenses', label: 'Expenses / Salaries', icon: <DollarSign size={16} /> },
    { key: 'shifts', label: 'Shifts', icon: <Clock size={16} /> },
];

// ─── Sessions Tab ───────────────────────────────────────────────────────────

const SessionsTab: React.FC = () => {
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<any | null>(null);
    const [form, setForm] = useState({ startTime: '', endTime: '' });
    const [modes, setModes] = useState<any[]>([]);
    const [paymentSession, setPaymentSession] = useState<any | null>(null); // session whose payments we're editing
    const [localPayments, setLocalPayments] = useState<any[]>([]);
    const [savingPayment, setSavingPayment] = useState(false);
    const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.get('/shifts/all?pageSize=200');
            const shifts = res.data?.data ?? [];
            if (res.data?.modes) setModes(res.data.modes);
            const flat: any[] = [];
            for (const shift of shifts) {
                for (const s of (shift.openedSessions ?? [])) {
                    flat.push({ ...s, staffUsername: shift.staff?.username });
                }
            }
            setSessions(flat.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()));
        } catch { toast.error('Failed to load sessions'); }
        finally { setLoading(false); }
    };

    useEffect(() => { void load(); }, []);

    const openEdit = (s: any) => {
        setEditing(s);
        setForm({
            startTime: s.startTime ? new Date(s.startTime).toISOString().slice(0, 16) : '',
            endTime: s.endTime ? new Date(s.endTime).toISOString().slice(0, 16) : '',
        });
    };

    const saveEdit = async () => {
        if (!editing) return;
        try {
            await api.patch(`/sessions/${editing.id}`, {
                startTime: form.startTime ? new Date(form.startTime).toISOString() : undefined,
                endTime: form.endTime ? new Date(form.endTime).toISOString() : undefined,
            });
            toast.success('Session updated');
            setEditing(null);
            void load();
        } catch { toast.error('Failed to update session'); }
    };

    const openPayments = (s: any) => {
        setPaymentSession(s);
        setLocalPayments((s.payments ?? []).map((p: any) => ({ ...p })));
    };

    const saveModeChange = async (payment: any, newModeId: string) => {
        setSavingPayment(true);
        try {
            await api.patch(`/payments/${payment.id}`, { modeId: newModeId });
            const updatedMode = modes.find(m => m.id === newModeId);
            setLocalPayments(prev => prev.map(p => p.id === payment.id
                ? { ...p, modeId: newModeId, mode: updatedMode ?? p.mode }
                : p
            ));
            toast.success('Payment mode updated');
        } catch { toast.error('Failed to update payment mode'); }
        finally { setSavingPayment(false); }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {editing && (
                <GlassPanel style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: '16px' }}>Edit Session Times</h3>
                        <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <Input label="Start Time" type="datetime-local" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} style={{ flex: 1, minWidth: '200px' }} />
                        <Input label="End Time" type="datetime-local" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} style={{ flex: 1, minWidth: '200px' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Button onClick={saveEdit} size="small" variant="primary"><Check size={14} /> Save Changes</Button>
                        <Button onClick={() => setEditing(null)} size="small" variant="secondary"><X size={14} /> Cancel</Button>
                    </div>
                </GlassPanel>
            )}

            {/* Payment Mode Editor Panel */}
            {paymentSession && (
                <GlassPanel style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: '16px' }}>
                            Payments — {paymentSession.room?.name ?? '—'} ({paymentSession.staffUsername ?? '—'})
                        </h3>
                        <button onClick={() => setPaymentSession(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
                    </div>
                    {localPayments.length === 0
                        ? <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No payments for this session.</span>
                        : localPayments.map((p: any) => (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 600 }}>EGP {Math.round(p.amount ?? 0)}</span>
                                <select
                                    value={p.modeId ?? ''}
                                    disabled={savingPayment}
                                    onChange={e => void saveModeChange(p, e.target.value)}
                                    style={{ background: 'rgba(0,0,0,0.4)', color: 'white', border: '1px solid var(--primary)', borderRadius: '8px', padding: '5px 10px', fontSize: '13px', cursor: 'pointer' }}
                                >
                                    {modes.map(m => <option key={m.id} value={m.id} style={{ background: '#111' }}>{m.name}</option>)}
                                </select>
                                {p.receiptUrl && (
                                    <div
                                        onClick={() => setViewingReceipt(p.receiptUrl)}
                                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                    >
                                        <img src={p.receiptUrl} alt="Receipt" style={{ height: '28px', width: '28px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border)' }} />
                                    </div>
                                )}
                                <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-muted)' }}>{p.mode?.name ?? '—'}</span>
                            </div>
                        ))
                    }
                </GlassPanel>
            )}

            {loading ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading sessions...</div> : (
                <DataTable
                    data={sessions}
                    searchKey="status"
                    searchPlaceholder="Filter by status..."
                    columns={[
                        { header: 'Room', key: 'room', render: (s: any) => <span style={{ fontWeight: 600 }}>{s.room?.name ?? '—'}</span> },
                        { header: 'Staff', key: 'staff', render: (s: any) => <span>{s.staffUsername ?? '—'}</span> },
                        { header: 'Status', key: 'status', render: (s: any) => <span style={{ color: s.status === 'active' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600 }}>{s.status}</span> },
                        { header: 'Start', key: 'startTime', render: (s: any) => <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(s.startTime).toLocaleString()}</span> },
                        { header: 'End', key: 'endTime', render: (s: any) => s.endTime ? <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(s.endTime).toLocaleString()}</span> : <span style={{ color: 'var(--primary)', fontSize: '12px' }}>Active</span> },
                        {
                            header: 'Total',
                            key: 'total',
                            render: (s: any) => s.sessionCharge ? (
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: 600 }}>EGP {Math.round(s.sessionCharge.finalTotal || 0)}</span>
                                    {s.sessionCharge.discount > 0 && (
                                        <span style={{ fontSize: '10px', color: '#f87171', fontWeight: 700 }}>
                                            -EGP {Math.round(s.sessionCharge.discount || 0)} (Disc)
                                        </span>
                                    )}
                                </div>
                            ) : <span style={{ color: 'var(--text-muted)' }}>—</span>
                        },
                        { header: 'Payments', key: 'payments', render: (s: any) => <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{(s.payments ?? []).length} paid</span> },
                    ]}
                    actions={(s: any) => (
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <Button size="small" variant="secondary" onClick={() => openEdit(s)}>
                                <Edit3 size={13} /> Times
                            </Button>
                            <Button size="small" variant="secondary" onClick={() => openPayments(s)}>
                                <CreditCard size={13} /> Payments
                            </Button>
                            {s.status !== 'cancelled' && (
                                <Button size="small" variant="danger" onClick={async () => {
                                    if (window.confirm(`Are you sure you want to CANCEL session in ${s.room?.name}? This will reverse ALL revenue and payments associated with this session.`)) {
                                        try {
                                            await api.post(`/sessions/${s.id}/cancel`);
                                            toast.success('Session cancelled and reversed');
                                            void load();
                                        } catch { toast.error('Failed to cancel session'); }
                                    }
                                }}>
                                    <X size={13} /> Cancel
                                </Button>
                            )}
                        </div>
                    )}
                />
            )}

            <Modal
                isOpen={!!viewingReceipt}
                onClose={() => setViewingReceipt(null)}
                title="Payment Receipt"
                maxWidth="500px"
            >
                {viewingReceipt && (
                    <img
                        src={viewingReceipt}
                        alt="Receipt Full"
                        style={{ width: '100%', borderRadius: '8px', display: 'block' }}
                    />
                )}
            </Modal>
        </div>
    );
};

// ─── Orders Tab ─────────────────────────────────────────────────────────────

const OrdersTab: React.FC = () => {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [editing, setEditing] = useState<any | null>(null);
    const [editType, setEditType] = useState<'status' | 'items' | null>(null);
    const [newStatus, setNewStatus] = useState('');
    const [editCart, setEditCart] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/orders?page=${page}&pageSize=50`);
            const payload = res.data;
            setOrders(payload.data ?? payload);
            setTotalPages(payload.totalPages ?? 1);
        } catch { toast.error('Failed to load orders'); }
        finally { setLoading(false); }
    };

    useEffect(() => { void load(); }, [page]);
    useEffect(() => {
        api.get('/products?page=1&pageSize=500').then(r => {
            const payload = r.data;
            setProducts(payload.data ?? payload);
        }).catch(() => { });
    }, []);

    const saveStatus = async () => {
        if (!editing) return;
        try {
            await api.patch(`/orders/${editing.id}`, { status: newStatus });
            toast.success('Order updated');
            setEditing(null);
            void load();
        } catch { toast.error('Failed to update order'); }
    };

    const statusColor = (s: string) => s === 'approved' ? 'var(--primary)' : s === 'pending' ? '#f59e0b' : s === 'cancelled' ? 'var(--danger)' : 'var(--text-muted)';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {editing && editType === 'status' && (
                <GlassPanel style={{ padding: '20px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ flex: 1 }}>Edit status for order <strong>{editing.id.slice(0, 8)}</strong></span>
                    <Select label="Status" value={newStatus} onChange={e => setNewStatus(e.target.value)} style={{ width: '180px' }}
                        options={['pending', 'approved', 'cancelled'].map(s => ({ value: s, label: s }))} />
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Button size="small" variant="primary" onClick={saveStatus}><Check size={14} /> Save</Button>
                        <Button size="small" variant="secondary" onClick={() => setEditing(null)}><X size={14} /></Button>
                    </div>
                </GlassPanel>
            )}

            {editing && editType === 'items' && (
                <GlassPanel style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600 }}>Edit items for order <strong>{editing.id.slice(0, 8)}</strong></span>
                        <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                        {editCart.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px' }}>
                                <span style={{ flex: 1, fontSize: '13px', fontWeight: 600 }}>{item.name}</span>
                                <span style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: 600 }}>EGP {Math.round(item.price)}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '6px' }}>
                                    <button onClick={() => {
                                        const newCart = [...editCart];
                                        if (newCart[idx].qty > 1) { newCart[idx].qty--; setEditCart(newCart); }
                                        else { newCart.splice(idx, 1); setEditCart(newCart); }
                                    }} style={{ background: 'rgba(255,255,255,0.1)', cursor: 'pointer', border: 'none', color: 'white', width: '24px', height: '24px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
                                    <span style={{ width: '20px', textAlign: 'center', fontSize: '12px', fontWeight: 700 }}>{item.qty}</span>
                                    <button onClick={() => {
                                        const newCart = [...editCart];
                                        newCart[idx].qty++;
                                        setEditCart(newCart);
                                    }} style={{ background: 'rgba(255,255,255,0.1)', cursor: 'pointer', border: 'none', color: 'white', width: '24px', height: '24px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                                </div>
                            </div>
                        ))}
                        {editCart.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '10px' }}>Cart is empty</span>}
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>Add Product</label>
                            <select
                                defaultValue=""
                                onChange={e => {
                                    const pid = e.target.value;
                                    if (!pid) return;
                                    const prod = products.find(p => p.id === pid);
                                    if (!prod) return;
                                    const existing = editCart.findIndex(i => i.productId === pid);
                                    if (existing >= 0) {
                                        const newCart = [...editCart];
                                        newCart[existing].qty++;
                                        setEditCart(newCart);
                                    } else {
                                        setEditCart([...editCart, { productId: prod.id, name: prod.name, price: prod.price, qty: 1 }]);
                                    }
                                    e.target.value = '';
                                }}
                                style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '8px' }}
                            >
                                <option value="" style={{ background: '#1a1a1a' }}>-- Select product to add --</option>
                                {products.map((p: any) => (
                                    <option key={p.id} value={p.id} style={{ background: '#1a1a1a' }}>{p.name} (EGP {Math.round(p.price)})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                        <Button size="small" variant="primary" onClick={async () => {
                            try {
                                setEditing({ ...editing, savingItems: true });
                                await api.patch(`/orders/${editing.id}/items`, { items: editCart.map(i => ({ productId: i.productId, qty: i.qty })) });
                                toast.success('Order items updated');
                                setEditing(null);
                                void load();
                            } catch (err: any) {
                                toast.error(err.response?.data?.error || 'Failed to update items');
                                setEditing({ ...editing, savingItems: false });
                            }
                        }} loading={editing.savingItems}><Check size={14} /> Save Items</Button>
                        <Button size="small" variant="secondary" onClick={() => setEditing(null)} disabled={editing.savingItems}><X size={14} /> Cancel</Button>
                    </div>
                </GlassPanel>
            )}
            {loading ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading orders...</div> : (
                <DataTable
                    data={orders}
                    searchKey="status"
                    searchPlaceholder="Filter by status..."
                    columns={[
                        { header: 'ID', key: 'id', render: (o: any) => <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{o.id.slice(0, 8)}</span> },
                        { header: 'Type', key: 'type', render: (o: any) => <span style={{ fontWeight: 600 }}>{o.type}</span> },
                        { header: 'Status', key: 'status', render: (o: any) => <span style={{ color: statusColor(o.status), fontWeight: 600 }}>{o.status}</span> },
                        { header: 'Room', key: 'room', render: (o: any) => <span>{o.room?.name ?? '—'}</span> },
                        { header: 'Items', key: 'items', render: (o: any) => <span style={{ color: 'var(--text-muted)' }}>{o.items?.length ?? 0} item(s)</span> },
                        { header: 'Total', key: 'total', render: (o: any) => o.orderCharge ? <span style={{ fontWeight: 700 }}>EGP {Math.round(o.orderCharge.finalTotal)}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span> },
                        { header: 'Date', key: 'createdAt', render: (o: any) => <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(o.createdAt).toLocaleString()}</span> },
                    ]}
                    actions={(o: any) => (
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <Button size="small" variant="secondary" onClick={() => { setEditing(o); setNewStatus(o.status); setEditType('status'); }}>
                                <Edit3 size={13} /> Status
                            </Button>
                            <Button size="small" variant="secondary" onClick={() => {
                                setEditing(o);
                                setEditCart((o.items || []).map((i: any) => ({ productId: i.productId, name: i.product?.name || 'Unknown', price: i.unitPrice, qty: i.qty })));
                                setEditType('items');
                            }}>
                                <ShoppingCart size={13} /> Items
                            </Button>
                        </div>
                    )}
                />
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Page {page} of {totalPages}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <Button variant="secondary" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft size={16} /> Prev</Button>
                    <Button variant="secondary" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next <ChevronRight size={16} /></Button>
                </div>
            </div>
        </div>
    );
};

// ─── Payments Tab ────────────────────────────────────────────────────────────

const PaymentsTab: React.FC = () => {
    const [payments, setPayments] = useState<any[]>([]);
    const [modes, setModes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [editing, setEditing] = useState<any | null>(null);
    const [form, setForm] = useState({ amount: '', modeId: '' });
    const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const [pRes, mRes] = await Promise.all([api.get(`/payments?page=${page}&pageSize=50`), api.get('/payments/modes')]);
            setPayments(pRes.data?.data ?? []);
            setTotalPages(pRes.data?.totalPages ?? 1);
            setModes(mRes.data ?? []);
        } catch { toast.error('Failed to load payments'); }
        finally { setLoading(false); }
    };

    useEffect(() => { void load(); }, [page]);

    const openEdit = (p: any) => {
        setEditing(p);
        setForm({ amount: String(p.amount), modeId: p.modeId });
    };

    const save = async () => {
        if (!editing) return;
        try {
            await api.patch(`/payments/${editing.id}`, { amount: parseFloat(form.amount), modeId: form.modeId });
            toast.success('Payment updated');
            setEditing(null);
            void load();
        } catch { toast.error('Failed to update payment'); }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {editing && (
                <GlassPanel style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <h3 style={{ margin: 0, fontSize: '16px' }}>Edit Payment</h3>
                        <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <Input label="Amount (EGP)" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={{ flex: 1, minWidth: '160px' }} />
                        <Select label="Payment Mode" value={form.modeId} onChange={e => setForm(f => ({ ...f, modeId: e.target.value }))} style={{ flex: 1, minWidth: '160px' }}
                            options={modes.map(m => ({ value: m.id, label: m.name }))} />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Button onClick={save} size="small" variant="primary"><Check size={14} /> Save</Button>
                        <Button onClick={() => setEditing(null)} size="small" variant="secondary"><X size={14} /> Cancel</Button>
                    </div>
                </GlassPanel>
            )}
            {loading ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading payments...</div> : (
                <DataTable
                    data={payments}
                    searchKey="referenceType"
                    searchPlaceholder="Filter by type..."
                    columns={[
                        { header: 'ID', key: 'id', render: (p: any) => <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.id.slice(0, 8)}</span> },
                        { header: 'Mode', key: 'mode', render: (p: any) => <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{p.mode?.name ?? '—'}</span> },
                        { header: 'Amount', key: 'amount', render: (p: any) => <span style={{ fontWeight: 700 }}>EGP {Math.round(p.amount)}</span> },
                        { header: 'Ref Type', key: 'referenceType', render: (p: any) => <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{p.referenceType}</span> },
                        { header: 'Staff', key: 'staff', render: (p: any) => <span style={{ fontSize: '12px' }}>{p.shift?.staff?.username ?? '—'}</span> },
                        { header: 'Date', key: 'createdAt', render: (p: any) => <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(p.createdAt).toLocaleString()}</span> },
                        {
                            header: 'Receipt', key: 'receipt', render: (p: any) => p.receiptUrl
                                ? (
                                    <div
                                        onClick={() => setViewingReceipt(p.receiptUrl)}
                                        style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                                    >
                                        <img src={p.receiptUrl} alt="Receipt" style={{ height: '30px', width: '30px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border)' }} />
                                    </div>
                                )
                                : <span style={{ color: 'var(--text-muted)' }}>—</span>
                        },
                    ]}
                    actions={(p: any) => (
                        <Button size="small" variant="secondary" onClick={() => openEdit(p)}>
                            <Edit3 size={13} /> Edit
                        </Button>
                    )}
                />
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Page {page} of {totalPages}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <Button variant="secondary" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft size={16} /> Prev</Button>
                    <Button variant="secondary" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next <ChevronRight size={16} /></Button>
                </div>
            </div>

            <Modal
                isOpen={!!viewingReceipt}
                onClose={() => setViewingReceipt(null)}
                title="Payment Receipt"
                maxWidth="500px"
            >
                {viewingReceipt && (
                    <img
                        src={viewingReceipt}
                        alt="Receipt Full"
                        style={{ width: '100%', borderRadius: '8px', display: 'block' }}
                    />
                )}
            </Modal>
        </div>
    );
};

// ─── Shifts Tab ──────────────────────────────────────────────────────────────

const ShiftsTab: React.FC = () => {
    const [shifts, setShifts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/shifts/all?page=${page}&pageSize=50`);
            setShifts(res.data?.data ?? []);
            setTotalPages(res.data?.totalPages ?? 1);
        } catch { toast.error('Failed to load shifts'); }
        finally { setLoading(false); }
    };

    useEffect(() => { void load(); }, [page]);

    const printShift = (shift: any) => {
        const win = window.open('', '_blank', 'width=400,height=700');
        if (!win) return;
        const stats = shift.stats;
        win.document.write(`
            <html><head><title>Shift Report</title><style>
                body { font-family: monospace; font-size: 14px; padding: 20px; }
                h2 { text-align: center; } hr { margin: 12px 0; }
                table { width: 100%; } td { padding: 3px 0; }
                td:last-child { text-align: right; font-weight: bold; }
            </style></head><body>
            <h2>SHIFT REPORT</h2>
            <hr/>
            <table>
                <tr><td>Staff</td><td>${shift.staff?.username ?? '—'}</td></tr>
                <tr><td>Status</td><td>${shift.status}</td></tr>
                <tr><td>Start</td><td>${new Date(shift.startTime).toLocaleString()}</td></tr>
                <tr><td>End</td><td>${shift.endTime ? new Date(shift.endTime).toLocaleString() : 'Still Open'}</td></tr>
            </table>
            <hr/>
            <table>
                <tr><td>Opening Cash</td><td>EGP ${Math.round(stats?.openingCash ?? 0)}</td></tr>
                <tr><td>Cash Payments</td><td>EGP ${Math.round(stats?.paymentsCash ?? 0)}</td></tr>
                <tr><td>Card Payments</td><td>EGP ${Math.round(stats?.paymentsCard ?? 0)}</td></tr>
                <tr><td>Total Revenue</td><td>EGP ${Math.round(stats?.totalRevenue ?? 0)}</td></tr>
                <tr><td>Sessions</td><td>${shift.openedSessions?.length ?? 0}</td></tr>
            </table>
            <hr/>
            </body></html>
        `);
        win.document.close();
        win.print();
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {loading ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading shifts...</div> : (
                <DataTable
                    data={shifts}
                    searchKey="status"
                    searchPlaceholder="Filter by status..."
                    columns={[
                        { header: 'Staff', key: 'staff', render: (s: any) => <span style={{ fontWeight: 600 }}>{s.staff?.username ?? '—'}</span> },
                        { header: 'Status', key: 'status', render: (s: any) => <span style={{ color: s.status === 'open' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600 }}>{s.status}</span> },
                        { header: 'Start', key: 'startTime', render: (s: any) => <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(s.startTime).toLocaleString()}</span> },
                        { header: 'End', key: 'endTime', render: (s: any) => s.endTime ? <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(s.endTime).toLocaleString()}</span> : <span style={{ color: 'var(--primary)', fontSize: '12px' }}>Open</span> },
                        { header: 'Revenue', key: 'revenue', render: (s: any) => <span style={{ fontWeight: 700 }}>EGP {Math.round(s.stats?.totalRevenue ?? 0)}</span> },
                        { header: 'Sessions', key: 'sessions', render: (s: any) => <span style={{ color: 'var(--text-muted)' }}>{s.openedSessions?.length ?? 0}</span> },
                    ]}
                    actions={(s: any) => (
                        <Button size="small" variant="secondary" onClick={() => printShift(s)}>
                            <Printer size={13} /> Print
                        </Button>
                    )}
                />
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Page {page} of {totalPages}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <Button variant="secondary" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft size={16} /> Prev</Button>
                    <Button variant="secondary" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next <ChevronRight size={16} /></Button>
                </div>
            </div>
        </div>
    );
};

// ─── Main Dashboard ──────────────────────────────────────────────────────────

const OperationsDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('sessions');

    const tabStyle = (key: Tab): React.CSSProperties => ({
        padding: '10px 20px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '13px',
        fontWeight: 600,
        borderBottom: `3px solid ${activeTab === key ? 'var(--primary)' : 'transparent'}`,
        color: activeTab === key ? 'var(--primary)' : 'var(--text-muted)',
        transition: 'all 0.2s',
        whiteSpace: 'nowrap',
    });

    const renderTab = () => {
        switch (activeTab) {
            case 'sessions': return <SessionsTab />;
            case 'orders': return <OrdersTab />;
            case 'payments': return <PaymentsTab />;
            case 'reservations': return <ReservationsManagement />;
            case 'products': return <ProductManagement />;
            case 'expenses': return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
                    <ExpensesManagement />
                    <SalaryManagement />
                </div>
            );
            case 'shifts': return <ShiftsTab />;
            case 'sales': return <ProductSales />;
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Tab bar */}
            <GlassPanel style={{ padding: '0 8px', borderRadius: '14px', overflowX: 'auto', scrollbarWidth: 'none' }} className="scrollable-x">
                <div style={{ display: 'flex', gap: '4px' }}>
                    {TABS.map(t => (
                        <div key={t.key} style={tabStyle(t.key)} onClick={() => setActiveTab(t.key)}>
                            {t.icon} <span className="hide-on-mobile">{t.label}</span>
                        </div>
                    ))}
                </div>
            </GlassPanel>

            {/* Tab content */}
            <GlassPanel style={{ padding: 'var(--container-padding)', minHeight: '400px' }}>
                {renderTab()}
            </GlassPanel>
        </div>
    );
};

export default OperationsDashboard;
