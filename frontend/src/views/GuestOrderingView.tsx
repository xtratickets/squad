import React, { useState, useEffect, useMemo } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import GlassPanel from '../components/common/GlassPanel';
import Button from '../components/common/Button';
import { Search, ShoppingCart, Plus, Minus, X, PackageOpen, Coffee } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import type { Category, Product, SessionOrder as Order, SystemSettings } from '../types';
import { BASE_URL } from '../services/api';

interface CartItem extends Product {
    cartQty: number;
}

const GuestOrderingView: React.FC<{ roomId: string; systemSettings: SystemSettings }> = ({ roomId, systemSettings }) => {
    const [sessionData, setSessionData] = useState<any>(null); // { session: Session, room: Room }
    const [categories, setCategories] = useState<Category[]>([]);
    const [activeCat, setActiveCat] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState<'menu' | 'orders'>('menu');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const fetchData = async () => {
        try {
            const api = await import('../services/api').then(m => m.default);
            // Fetch session status. If 400 or 404, it will hit catch block.
            const sessionRes = await api.get(`/guest/rooms/${roomId}/session`);
            setSessionData(sessionRes.data);

            // Fetch menu
            const menuRes = await api.get('/guest/menu');
            const cats = menuRes.data as Category[];
            setCategories(cats);
            if (cats.length > 0 && !activeCat) setActiveCat(cats[0].id);
        } catch (err: any) {
            console.error('Failed to load guest session or menu', err);
            if (err?.response?.status === 400 || err?.response?.status === 404) {
                setSessionData(null); // No active session
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId]);

    useSocket(BASE_URL, (type) => {
        if (type === 'order_update' || type === 'rooms.states_update') {
            void fetchData();
        }
    });

    const products = useMemo(() => {
        let allProducts: Product[] = [];
        if (activeCat) {
            const c = categories.find(cat => cat.id === activeCat);
            if (c) allProducts = c.products || [];
        } else {
            allProducts = categories.flatMap(c => c.products || []);
        }

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            return allProducts.filter(p => p.name.toLowerCase().includes(lower));
        }
        return allProducts;
    }, [categories, activeCat, searchTerm]);

    const addToCart = (p: Product) => {
        if (p.stockQty <= 0) return toast.error('Out of stock');
        setCart(prev => {
            const ex = prev.find(i => i.id === p.id);
            if (ex) {
                if (ex.cartQty >= p.stockQty) {
                    toast.error('Not enough stock available');
                    return prev;
                }
                return prev.map(i => i.id === p.id ? { ...i, cartQty: i.cartQty + 1 } : i);
            }
            return [...prev, { ...p, cartQty: 1 }];
        });
        toast.success(`Included ${p.name}`);
    };

    const removeFromCart = (productId: string, removeAll = false) => {
        setCart(prev => {
            if (removeAll) return prev.filter(i => i.id !== productId);
            const ex = prev.find(i => i.id === productId);
            if (ex && ex.cartQty > 1) return prev.map(i => i.id === productId ? { ...i, cartQty: i.cartQty - 1 } : i);
            return prev.filter(i => i.id !== productId);
        });
    };

    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.cartQty), 0);
    const cartCount = cart.reduce((sum, item) => sum + item.cartQty, 0);

    const placeOrder = async () => {
        if (!cart.length) return toast.error('Cart is empty');
        setSubmitting(true);
        try {
            const api = await import('../services/api').then(m => m.default);
            await api.post(`/guest/rooms/${roomId}/orders`, {
                items: cart.map(i => ({ productId: i.id, quantity: i.cartQty }))
            });
            toast.success('Order placed successfully! We are preparing it now.');
            setCart([]);
            setIsCartOpen(false);
            setActiveTab('orders');
            void fetchData();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to place order.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>Loading...</div>;
    }

    if (!sessionData || !sessionData.session) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text)', padding: '24px', textAlign: 'center' }}>
                {systemSettings.systemLogo ? (
                    <img src={systemSettings.systemLogo} alt="Logo" style={{ width: '80px', height: '80px', marginBottom: '20px', objectFit: 'contain', borderRadius: '16px' }} />
                ) : (
                    <Coffee size={64} color="var(--primary)" style={{ marginBottom: '20px', opacity: 0.8 }} />
                )}
                <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '10px' }}>Welcome to {systemSettings.systemName.toUpperCase()}</h2>
                <p style={{ color: 'var(--text-muted)', maxWidth: '400px', lineHeight: 1.6 }}>There is currently no active session in this room. Please speak with reception to begin your session and start ordering.</p>
            </div>
        );
    }

    const { room, session } = sessionData;
    const orders = (session.orders || []) as Order[];

    return (
        <div style={{ height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--text)', position: 'relative' }}>
            <Toaster
                position="top-center"
                toastOptions={{
                    style: { background: 'var(--surface-solid)', color: 'var(--text)', border: '1px solid var(--border)', backdropFilter: 'blur(10px)' },
                    success: { iconTheme: { primary: 'var(--primary)', secondary: '#000' } }
                }}
            />

            {/* Header */}
            <header style={{ padding: isMobile ? '12px 16px' : '20px 24px', background: 'var(--surface-solid)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(20px)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? '12px' : '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px' }}>
                        {systemSettings.systemLogo && (
                            <img src={systemSettings.systemLogo} alt="Logo" style={{ width: isMobile ? '32px' : '40px', height: isMobile ? '32px' : '40px', borderRadius: '8px', objectFit: 'contain' }} />
                        )}
                        <div>
                            <h1 style={{ fontSize: isMobile ? '16px' : '20px', fontWeight: '800', color: 'var(--primary)', margin: 0 }}>Room {room.name}</h1>
                            {!isMobile && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{systemSettings.systemName.toUpperCase()} - {session.status.toUpperCase()}</div>}
                        </div>
                    </div>
                    {cartCount > 0 && (
                        <button
                            onClick={() => setIsCartOpen(true)}
                            style={{ background: 'var(--primary)', border: 'none', borderRadius: '50px', padding: isMobile ? '8px 16px' : '10px 20px', display: 'flex', gap: '8px', alignItems: 'center', color: '#000', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0, 230, 118, 0.3)', fontSize: isMobile ? '13px' : '14px' }}
                        >
                            <ShoppingCart size={isMobile ? 16 : 18} />
                            <span>{cartCount} {isMobile ? '' : 'items'}</span>
                        </button>
                    )}
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: isMobile ? '15px' : '20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <button
                        onClick={() => setActiveTab('menu')}
                        style={{ background: 'none', border: 'none', color: activeTab === 'menu' ? 'var(--primary)' : 'var(--text-muted)', padding: '10px 0', fontWeight: activeTab === 'menu' ? '700' : '500', borderBottom: activeTab === 'menu' ? '2px solid var(--primary)' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.2s', fontSize: isMobile ? '14px' : '16px' }}
                    >
                        Menu
                    </button>
                    <button
                        onClick={() => setActiveTab('orders')}
                        style={{ background: 'none', border: 'none', color: activeTab === 'orders' ? 'var(--primary)' : 'var(--text-muted)', padding: '10px 0', fontWeight: activeTab === 'orders' ? '700' : '500', borderBottom: activeTab === 'orders' ? '2px solid var(--primary)' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.2s', fontSize: isMobile ? '14px' : '16px' }}
                    >
                        {isMobile ? 'Orders' : 'My Orders'} ({orders.length})
                    </button>
                </div>
            </header>

            {/* Body */}
            <main style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px' : '20px', paddingBottom: '100px' }}>
                {activeTab === 'menu' ? (
                    <>
                        <div style={{ marginBottom: isMobile ? '16px' : '20px' }}>
                            <div style={{ position: 'relative' }}>
                                <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    placeholder="Search for drinks, snacks..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{ width: '100%', padding: '16px 16px 16px 44px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)', fontSize: '16px', outline: 'none' }}
                                />
                            </div>
                        </div>

                        {/* Category Strip */}
                        {!searchTerm && (
                            <div style={{ display: 'flex', overflowX: 'auto', gap: '8px', paddingBottom: '16px', marginBottom: isMobile ? '8px' : '16px', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
                                <button
                                    onClick={() => setActiveCat(null)}
                                    style={{ padding: '8px 16px', borderRadius: '30px', border: 'none', background: activeCat === null ? 'rgba(0,230,118,0.2)' : 'rgba(255,255,255,0.05)', color: activeCat === null ? 'var(--primary)' : 'var(--text)', fontWeight: activeCat === null ? '700' : '500', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '13px' }}
                                >
                                    All
                                </button>
                                {categories.map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => setActiveCat(c.id)}
                                        style={{ padding: '8px 16px', borderRadius: '30px', border: 'none', background: activeCat === c.id ? 'rgba(0,230,118,0.2)' : 'rgba(255,255,255,0.05)', color: activeCat === c.id ? 'var(--primary)' : 'var(--text)', fontWeight: activeCat === c.id ? '700' : '500', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '13px' }}
                                    >
                                        {c.name}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Product Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(150px, 1fr))', gap: isMobile ? '12px' : '16px' }}>
                            {products.length === 0 ? (
                                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                    No products found
                                </div>
                            ) : (
                                products.map(p => {
                                    const inCart = cart.find(i => i.id === p.id);
                                    return (
                                        <div key={p.id} style={{ background: 'var(--surface-solid)', borderRadius: isMobile ? '12px' : '16px', overflow: 'hidden', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                                            {p.imageUrl ? (
                                                <div style={{ width: '100%', paddingTop: '100%', position: 'relative', background: '#000' }}>
                                                    <img src={p.imageUrl} alt={p.name} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                                                </div>
                                            ) : (
                                                <div style={{ width: '100%', paddingTop: '100%', position: 'relative', background: 'rgba(255,255,255,0.03)' }}>
                                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <PackageOpen size={isMobile ? 24 : 32} color="var(--text-muted)" opacity={0.5} />
                                                    </div>
                                                </div>
                                            )}

                                            <div style={{ padding: isMobile ? '10px' : '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <div style={{ fontSize: isMobile ? '13px' : '15px', fontWeight: '600', lineHeight: 1.2, height: '2.4em', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.name}</div>
                                                <div style={{ color: 'var(--primary)', fontWeight: '700', fontSize: isMobile ? '14px' : '16px', marginTop: 'auto' }}>EGP {p.price}</div>

                                                {inCart ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,230,118,0.1)', borderRadius: '8px', border: '1px solid rgba(0,230,118,0.3)', marginTop: '8px' }}>
                                                        <button onClick={() => removeFromCart(p.id)} style={{ padding: '8px 10px', background: 'none', border: 'none', color: 'var(--primary)' }}><Minus size={14} /></button>
                                                        <span style={{ fontWeight: '700', color: 'var(--primary)', fontSize: '13px' }}>{inCart.cartQty}</span>
                                                        <button onClick={() => addToCart(p)} style={{ padding: '8px 10px', background: 'none', border: 'none', color: 'var(--primary)' }}><Plus size={14} /></button>
                                                    </div>
                                                ) : (
                                                    <Button
                                                        onClick={() => addToCart(p)}
                                                        style={{ width: '100%', padding: '8px', marginTop: '8px', fontSize: '13px' }}
                                                        disabled={p.stockQty <= 0}
                                                        variant={p.stockQty <= 0 ? 'secondary' : 'primary'}
                                                    >
                                                        {p.stockQty <= 0 ? 'Out of Stock' : 'Add'}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {orders.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                                <PackageOpen size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
                                <div>No orders yet. Start adding items to your cart!</div>
                            </div>
                        ) : (
                            orders.map(order => (
                                <GlassPanel key={order.id} style={{ padding: isMobile ? '16px' : '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
                                        <div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                            <div style={{ fontWeight: '700', marginTop: '4px', color: order.status === 'pending' ? '#ffc400' : 'var(--primary)', fontSize: '13px' }}>
                                                {order.status === 'pending' ? 'Preparing' : 'Served'}
                                            </div>
                                        </div>
                                        <div style={{ fontWeight: '800', fontSize: isMobile ? '16px' : '18px' }}>
                                            EGP {(order.orderCharge as any)?.finalTotal ?? order.items?.reduce((sum, i) => sum + i.total, 0) ?? 0}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {order.items?.map((item: any) => (
                                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: isMobile ? '13px' : '14px' }}>
                                                <div><span style={{ color: 'var(--text-muted)', marginRight: '8px' }}>{item.qty}x</span> {item.product?.name}</div>
                                                <div style={{ opacity: 0.8 }}>EGP {item.total}</div>
                                            </div>
                                        ))}
                                    </div>
                                </GlassPanel>
                            ))
                        )}
                    </div>
                )}
            </main>

            {/* Cart Modal / Drawer */}
            {isCartOpen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)' }}>
                    <div style={{ background: 'var(--surface)', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: isMobile ? '20px' : '24px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--border)', boxShadow: '0 -10px 40px rgba(0,0,0,0.5)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ margin: 0, fontSize: isMobile ? '18px' : '20px', fontWeight: '800' }}>Your Cart</h2>
                            <button onClick={() => setIsCartOpen(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50px', padding: '8px', color: 'var(--text)', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '24px', WebkitOverflowScrolling: 'touch' }}>
                            {cart.length === 0 ? (
                                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>Cart is empty</div>
                            ) : (
                                cart.map(item => (
                                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: '600', fontSize: isMobile ? '14px' : '16px' }}>{item.name}</div>
                                            <div style={{ color: 'var(--primary)', marginTop: '2px', fontWeight: '700', fontSize: '14px' }}>EGP {item.price * item.cartQty}</div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '50px', marginLeft: '12px' }}>
                                            <button onClick={() => removeFromCart(item.id)} style={{ padding: '6px', background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer' }}><Minus size={14} /></button>
                                            <span style={{ fontWeight: '700', width: '20px', textAlign: 'center', fontSize: '13px' }}>{item.cartQty}</span>
                                            <button onClick={() => addToCart(item)} style={{ padding: '6px', background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer' }}><Plus size={14} /></button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {cart.length > 0 && (
                            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: 'auto' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: isMobile ? '18px' : '20px', fontWeight: '800' }}>
                                    <span>Total</span>
                                    <span style={{ color: 'var(--primary)' }}>EGP {cartTotal}</span>
                                </div>
                                <Button
                                    onClick={placeOrder}
                                    loading={submitting}
                                    style={{ width: '100%', padding: '16px', fontSize: '16px', borderRadius: '16px' }}
                                >
                                    Place Order
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default GuestOrderingView;
