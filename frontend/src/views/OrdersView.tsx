import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { adminService } from '../services/admin.service';
import { roomService } from '../services/room.service';
import GlassPanel from '../components/common/GlassPanel';
import Button from '../components/common/Button';
import { Input } from '../components/common/FormElements';
import api from '../services/api';
import { RefreshCw } from 'lucide-react';
import type { Product, Category, Room, Shift, PaymentMode } from '../types';

interface CartItem {
    productId: string;
    name: string;
    price: number;
    qty: number;
}

interface OrdersViewProps {
    rooms: Room[];
    currentShift: Shift | null;
}

const errMsg = (err: unknown, fallback: string) => {
    if (err && typeof err === 'object' && 'response' in err)
        return (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? fallback;
    return fallback;
};

const OrdersView: React.FC<OrdersViewProps> = ({ rooms, currentShift }) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [users, setUsers] = useState<{ id: string; username: string; walletBalance: number }[]>([]);
    const [activeCatId, setActiveCatId] = useState<string>('all');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [orderType, setOrderType] = useState<'regular' | 'owner' | 'room'>('room');
    const [selectedRoomId, setSelectedRoomId] = useState<string>('');
    const [ownerUserId, setOwnerUserId] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
    const [paymentModeId, setPaymentModeId] = useState<string>('');

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Initial load for categories, users, payment modes
    useEffect(() => {
        Promise.all([
            adminService.getCategories(),
            adminService.getUsersList(),
            api.get('/payments/modes'),
        ]).then(([c, u, m]) => {
            setCategories(c.data);
            setUsers(u.data);
            const modes: PaymentMode[] = m.data ?? [];
            setPaymentModes(modes);
            if (modes.length) setPaymentModeId(modes[0].id);
            if (u.data.length > 0) setOwnerUserId(u.data[0].id);
        }).catch(err => {
            console.error('Error loading initial data', err);
            toast.error('Failed to load categories or users');
        });
    }, []);

    // Load products when search, category, or page changes
    const loadProducts = useCallback(async (isLoadMore = false) => {
        const targetPage = isLoadMore ? page + 1 : 1;
        if (isLoadMore) setLoadingMore(true); else setLoading(true);

        try {
            const res = await adminService.getProducts({
                page: targetPage,
                pageSize: 20,
                search: debouncedSearch,
                categoryId: (debouncedSearch || activeCatId === 'all') ? undefined : activeCatId
            });

            const newProducts = res.data.data;
            if (isLoadMore) {
                setProducts(prev => [...prev, ...newProducts]);
                setPage(targetPage);
            } else {
                setProducts(newProducts);
                setPage(1);
            }
            setTotalPages(res.data.totalPages);
        } catch (err) {
            console.error('Failed to load products', err);
            toast.error('Failed to load products');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [debouncedSearch, activeCatId, page]);

    useEffect(() => {
        void loadProducts();
    }, [debouncedSearch, activeCatId]);

    const addToCart = (p: Product) => {
        setCart(prev => {
            const ex = prev.find(i => i.productId === p.id);
            if (ex) return prev.map(i => i.productId === p.id ? { ...i, qty: i.qty + 1 } : i);
            return [...prev, { productId: p.id, name: p.name, price: p.price, qty: 1 }];
        });
    };

    const removeFromCart = (productId: string) => {
        setCart(prev => {
            const ex = prev.find(i => i.productId === productId);
            if (ex && ex.qty > 1) return prev.map(i => i.productId === productId ? { ...i, qty: i.qty - 1 } : i);
            return prev.filter(i => i.productId !== productId);
        });
    };

    const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

    const placeOrder = async () => {
        if (!currentShift) return toast.error('Please open a shift first!');
        if (orderType === 'room' && !selectedRoomId) return toast.error('Select a room');
        if (orderType === 'owner' && !ownerUserId) return toast.error('Select an owner');
        if (!cart.length) return toast.error('Cart is empty');
        if (orderType === 'regular' && !paymentModeId) return toast.error('Select a payment mode');

        setSubmitting(true);
        try {
            let sessionId: string | undefined = undefined;
            if (orderType === 'room') {
                const state = await roomService.getRoomState(selectedRoomId);
                if (!state.data.activeSessionId) throw new Error('Selected room has no active session');
                sessionId = state.data.activeSessionId;
            }

            const res = await adminService.createOrder({
                type: orderType,
                shiftId: currentShift.id,
                roomId: orderType === 'room' ? selectedRoomId : undefined,
                sessionId,
                items: cart.map(i => ({ productId: i.productId, qty: i.qty })),
                ...(orderType === 'owner' ? { ownerUserId } : {})
            });

            await adminService.approveOrder(res.data.id);

            if (orderType === 'regular' && cartTotal > 0 && paymentModeId) {
                await api.post('/payments', {
                    modeId: paymentModeId,
                    amount: cartTotal,
                    referenceType: 'order',
                    referenceId: res.data.id,
                    shiftId: currentShift.id,
                });
            }

            toast.success('Order placed successfully');
            setCart([]);
        } catch (err: unknown) {
            toast.error(errMsg(err, 'Order failed'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{ display: 'flex', gap: '30px', height: 'calc(100vh - 180px)' }}>
            {/* Menu Section */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <Input
                        placeholder="Search products..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ maxWidth: '300px' }}
                    />
                </div>

                <div style={{ display: 'flex', height: '120px', gap: '10px', overflowX: 'auto', boxSizing: 'border-box', marginBottom: '20px', scrollbarWidth: 'none' }}>
                    <Button
                        variant={activeCatId === 'all' ? 'primary' : 'secondary'}
                        size="small"
                        onClick={() => setActiveCatId('all')}
                        style={{ whiteSpace: 'nowrap' }}
                    >
                        All Categories
                    </Button>
                    {categories.map(c => (
                        <Button
                            key={c.id}
                            variant={activeCatId === c.id ? 'primary' : 'secondary'}
                            size="small"
                            onClick={() => setActiveCatId(c.id)}
                            style={{ whiteSpace: 'nowrap' }}
                        >
                            {c.name}
                        </Button>
                    ))}
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                    gap: '20px',
                    overflowY: 'auto',
                    paddingRight: '5px',
                    position: 'relative',
                    minHeight: loading ? '200px' : 'auto'
                }}>
                    {loading && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.1)', borderRadius: '12px' }}>
                            <RefreshCw className="animate-spin" size={24} />
                        </div>
                    )}
                    {products.map(p => (
                        <GlassPanel
                            key={p.id}
                            style={{
                                padding: '15px',
                                textAlign: 'center',
                                cursor: 'pointer',
                                transition: 'transform 0.1s ease',
                                opacity: p.stockQty !== undefined && p.stockQty <= 0 ? 0.6 : 1
                            }}
                            onClick={() => addToCart(p)}
                        >
                            <div style={{ fontWeight: '600', marginBottom: '8px' }}>{p.name}</div>
                            <div style={{ color: 'var(--primary)', fontWeight: 'bold' }}>EGP {p.price.toFixed(2)}</div>
                            {p.stockQty !== undefined && (
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    Stock: {p.stockQty}
                                </div>
                            )}
                        </GlassPanel>
                    ))}
                </div>

                {totalPages > page && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                        <Button
                            variant="secondary"
                            onClick={() => void loadProducts(true)}
                            loading={loadingMore}
                        >
                            Load More Products
                        </Button>
                    </div>
                )}
            </div>

            {/* Cart Section */}
            <GlassPanel style={{ width: '380px', padding: '25px', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ marginBottom: '20px', fontSize: '20px', fontWeight: 'bold' }}>Order Summary</h3>

                {/* Order Type */}
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>ORDER TYPE</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {([{ id: 'room', label: 'Room' }, { id: 'regular', label: 'Walk-in' }, { id: 'owner', label: 'Owner' }] as const).map(t => (
                            <button
                                key={t.id}
                                onClick={() => setOrderType(t.id)}
                                style={{
                                    flex: 1, padding: '10px 0', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                                    background: orderType === t.id ? (t.id === 'owner' ? 'rgba(255,171,0,0.15)' : 'rgba(0,230,118,0.12)') : 'rgba(255,255,255,0.04)',
                                    color: orderType === t.id ? (t.id === 'owner' ? '#ffab00' : 'var(--primary)') : 'var(--text-muted)',
                                    border: `1px solid ${orderType === t.id ? (t.id === 'owner' ? '#ffab00' : 'var(--primary)') : 'var(--border)'}`,
                                    transition: 'all 0.2s'
                                }}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Scope Target Selector */}
                <div style={{ marginBottom: '20px' }}>
                    {orderType === 'room' && (
                        <select
                            value={selectedRoomId}
                            onChange={(e) => setSelectedRoomId(e.target.value)}
                            style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '8px' }}
                        >
                            <option value="" style={{ background: '#1a1a1a' }}>Select Room</option>
                            {rooms.filter(r => r.status === 'occupied').map(r => (
                                <option key={r.id} value={r.id} style={{ background: '#1a1a1a' }}>
                                    {r.name} (Active)
                                </option>
                            ))}
                        </select>
                    )}

                    {orderType === 'owner' && (
                        <select
                            value={ownerUserId}
                            onChange={(e) => setOwnerUserId(e.target.value)}
                            style={{ width: '100%', padding: '12px', background: 'rgba(255,171,0,0.08)', border: '1px solid #ffab00', color: 'var(--text)', borderRadius: '8px', outline: 'none' }}
                        >
                            <option value="" style={{ background: '#1a1a1a' }}>Select Owner</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id} style={{ background: '#1a1a1a' }}>
                                    {u.username} (Balance: EGP {u.walletBalance})
                                </option>
                            ))}
                        </select>
                    )}

                    {/* Payment mode selector — walk-in orders only */}
                    {orderType === 'regular' && (
                        <div>
                            <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>PAYMENT MODE</label>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {paymentModes.map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => setPaymentModeId(m.id)}
                                        style={{
                                            flex: 1, padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                                            background: paymentModeId === m.id ? 'rgba(0,230,118,0.12)' : 'rgba(255,255,255,0.04)',
                                            color: paymentModeId === m.id ? 'var(--primary)' : 'var(--text-muted)',
                                            border: `1px solid ${paymentModeId === m.id ? 'var(--primary)' : 'var(--border)'}`,
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        {m.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px' }}>
                    {cart.map((item, i) => (
                        <div key={i} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.05)'
                        }}>
                            <div>
                                <div style={{ fontWeight: '500', fontSize: '14px' }}>{item.name}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>EGP {item.price.toFixed(2)} x {item.qty}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <Button size="small" variant="secondary" onClick={() => removeFromCart(item.productId)}>-</Button>
                                <Button size="small" variant="secondary" onClick={() => addToCart(products.find(p => p.id === item.productId)!)}>+</Button>
                            </div>
                        </div>
                    ))}
                    {cart.length === 0 && (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px' }}>
                            Cart is empty
                        </div>
                    )}
                </div>

                <div style={{ borderTop: '2px solid var(--border)', paddingTop: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '20px', marginBottom: '25px' }}>
                        <span>Total</span>
                        <span style={{ color: 'var(--primary)' }}>EGP {cartTotal.toFixed(2)}</span>
                    </div>
                    <Button
                        onClick={() => void placeOrder()}
                        loading={submitting}
                        style={{ width: '100%', padding: '15px', fontSize: '16px' }}
                        disabled={cart.length === 0}
                    >
                        PLACE ORDER
                    </Button>
                </div>
            </GlassPanel>
        </div>
    );
};

export default OrdersView;
