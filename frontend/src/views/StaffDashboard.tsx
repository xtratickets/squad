import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { roomService } from '../services/room.service';
import { adminService } from '../services/admin.service';
import GlassPanel from '../components/common/GlassPanel';
import Button from '../components/common/Button';
import {
    Clock, Home, ShoppingCart, Users,
    CheckCircle, XCircle, ArrowRight, Zap,
    X, CreditCard, Receipt, AlertCircle,
    Plus, Package, Trash2, Printer, Camera, RefreshCw,
    Pause, Play
} from 'lucide-react';
import type {
    Room, Shift, ShiftStats, PaymentMode, Payment, Reservation,
    SessionDetail, SessionBilling, RoomStateResponse, SessionOrder,
} from '../types';

type RoomWithSession = Room & {
    activeSession?: SessionDetail | null;
};

interface ShiftStatsReport extends ShiftStats {
    sessions?: {
        id: string;
        roomName: string;
        startTime: string;
        endTime: string;
        totalPausedMs: number;
        finalTotal: number;
        roomAmount: number;
        ordersAmount: number;
        discount: number;
    }[];
}
import { useSocket } from '../hooks/useSocket';
import { BASE_URL, API_URL } from '../services/api';
import Webcam from 'react-webcam';

// ─── Types ─────────────────────────────────────────────────────────

interface CartItem { productId: string; name: string; price: number; qty: number; }

interface CartItem { productId: string; name: string; price: number; qty: number; }
interface OrderSummary {
    id: string; type: string; status: string; shiftId: string;
    roomId?: string; sessionId?: string;
    room?: { name: string };
    items: { id: string; productId: string; qty: number; unitPrice: number; total: number; product?: { id: string; name: string; price: number } }[];
    createdAt: string;
    orderCharge?: { finalTotal: number } | null;
}
interface StaffDashboardProps {
    rooms: RoomWithSession[];
    fetchRooms: () => void;
    currentShift: Shift | null;
    onShiftChange: (s: Shift | null) => void;
    username: string;
    userRole: string;
}

// ─── Helpers ───────────────────────────────────────────────────────

const errMsg = (err: unknown, fallback: string) => {
    if (err && typeof err === 'object' && 'response' in err)
        return (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? fallback;
    return fallback;
};

function formatElapsed(startIso: string, totalPausedMs: number = 0, isPaused: boolean = false, lastPausedAt?: string | null) {
    const start = new Date(startIso).getTime();
    const now = Date.now();
    let diffMs = now - start;

    let pausedMs = totalPausedMs || 0;
    if (isPaused && lastPausedAt) {
        pausedMs += now - new Date(lastPausedAt).getTime();
    }

    const diff = Math.max(0, Math.floor((diffMs - pausedMs) / 1000));
    const h = Math.floor(diff / 3600).toString().padStart(2, '0');
    const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
    const s = (diff % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

function useElapsedTime(startTime: string | undefined, totalPausedMs: number = 0, isPaused: boolean = false, lastPausedAt?: string | null) {
    const [, tick] = useState(0);
    useEffect(() => {
        if (!startTime || isPaused) return;
        const id = setInterval(() => tick(n => n + 1), 1000);
        return () => clearInterval(id);
    }, [startTime, isPaused]);
    return startTime ? formatElapsed(startTime, totalPausedMs, isPaused, lastPausedAt) : '';
}

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Morning';
    if (h < 17) return 'Afternoon';
    return 'Evening';
}

const fmt = (n: number) => n.toFixed(2);

const formatDate = (iso: string) => {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// ─── Session Timer badge ──────────────────────────────────────────

const SessionTimer: React.FC<{
    startTime: string;
    totalPausedMs?: number;
    isPaused?: boolean;
    lastPausedAt?: string | null;
}> = ({ startTime, totalPausedMs, isPaused, lastPausedAt }) => {
    const elapsed = useElapsedTime(startTime, totalPausedMs, isPaused, lastPausedAt);
    return (
        <div style={{
            fontSize: '12px',
            fontFamily: 'monospace',
            color: isPaused ? 'var(--text-muted)' : 'var(--danger)',
            fontWeight: 'bold',
            letterSpacing: '1px',
            display: 'flex',
            alignItems: 'center',
            gap: 4
        }}>
            <Clock size={11} /> {elapsed} {isPaused && <span style={{ fontSize: '10px', opacity: 0.7 }}>(PAUSED)</span>}
        </div>
    );
};

// ─── Stat Card ────────────────────────────────────────────────────

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string; color: string; highlight?: boolean }> = ({ icon, label, value, color, highlight }) => (
    <GlassPanel style={{ padding: '22px', background: highlight ? 'rgba(0,230,118,0.05)' : undefined, border: highlight ? '1px solid rgba(0,230,118,0.2)' : undefined }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{ color }}>{icon}</div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</span>
        </div>
        <div style={{ fontSize: '26px', fontWeight: '800', color, letterSpacing: '-1px' }}>{value}</div>
    </GlassPanel>
);

// ─── Reservation badge ────────────────────────────────────────────

const ReservationBadge: React.FC<{ status: string }> = ({ status }) => {
    const map: Record<string, { bg: string; color: string }> = {
        pending: { bg: 'rgba(255,171,0,0.1)', color: '#ffab00' },
        confirmed: { bg: 'rgba(41,121,255,0.1)', color: '#2979ff' },
        checked_in: { bg: 'rgba(0,230,118,0.1)', color: 'var(--primary)' },
    };
    const s = map[status] ?? { bg: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' };
    return (
        <span style={{ fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '20px', background: s.bg, color: s.color, textTransform: 'uppercase', letterSpacing: '1px' }}>
            {status.replace('_', ' ')}
        </span>
    );
};

// ─── Webcam Modal ──────────────────────────────────────────────────

const WebcamModal: React.FC<{ onCapture: (key: string, url: string) => void; onClose: () => void }> = ({ onCapture, onClose }) => {
    const webcamRef = useRef<Webcam>(null);
    const [capturing, setCapturing] = useState(false);

    const capture = useCallback(async () => {
        if (!webcamRef.current) return;
        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) return;

        setCapturing(true);
        try {
            const res = await fetch(imageSrc);
            const blob = await res.blob();
            const formData = new FormData();
            formData.append('receipt', blob, 'receipt.jpg');

            const token = localStorage.getItem('squad_token');
            const apiRes = await fetch(`${API_URL}/payments/upload-receipt`, {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                body: formData,
            });
            if (!apiRes.ok) throw new Error('Upload failed');
            const data = await apiRes.json();
            onCapture(data.receiptKey, data.receiptUrl);
        } catch (err) {
            console.error(err);
            toast.error('Failed to upload receipt');
            setCapturing(false);
        }
    }, [webcamRef, onCapture]);

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GlassPanel style={{ padding: '24px', width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>Capture Receipt</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
                </div>
                <div style={{ borderRadius: '12px', overflow: 'hidden', background: '#000', display: 'flex', justifyContent: 'center' }}>
                    <Webcam
                        audio={false}
                        ref={webcamRef}
                        screenshotFormat="image/jpeg"
                        videoConstraints={{ facingMode: 'environment' }}
                        style={{ width: '100%', maxHeight: '400px', objectFit: 'contain' }}
                    />
                </div>
                <Button loading={capturing} onClick={() => void capture()} icon={<Camera size={18} />}>
                    Capture & Upload
                </Button>
            </GlassPanel>
        </div>
    );
};

// ─── Room Card ────────────────────────────────────────────────────

const statusConfig = {
    available: { color: 'var(--primary)', bg: 'rgba(0,230,118,0.08)', label: 'AVAILABLE', border: 'var(--primary)' },
    occupied: { color: 'var(--danger)', bg: 'rgba(255,82,82,0.08)', label: 'OCCUPIED', border: 'var(--danger)' },
    paused: { color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.06)', label: 'PAUSED', border: 'var(--text-muted)' },
    cleaning: { color: '#ffab00', bg: 'rgba(255,171,0,0.08)', label: 'CLEANING', border: '#ffab00' },
    maintenance: { color: '#9e9e9e', bg: 'rgba(158,158,158,0.08)', label: 'MAINTENANCE', border: '#9e9e9e' },
};

interface RoomCardProps {
    room: RoomWithSession;
    state: RoomStateResponse | null;
    onClick: () => void;
    onAddOrder: () => void;
    onTogglePause: () => void;
    isAdminViewing?: boolean;
}

const RoomCard: React.FC<RoomCardProps> = ({ room, state, onClick, onAddOrder, onTogglePause, isAdminViewing }) => {
    const statusKey = room.activeSession?.isPaused ? 'paused' : (room.status as keyof typeof statusConfig);
    const cfg = statusConfig[statusKey] ?? statusConfig.maintenance;
    const isInteractive = room.status === 'available' || room.status === 'occupied' || isAdminViewing;
    return (
        <GlassPanel
            onClick={isInteractive ? onClick : undefined}
            style={{
                padding: '20px',
                cursor: isInteractive ? 'pointer' : 'default',
                borderTop: `4px solid ${cfg.border}`,
                background: cfg.bg,
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                minHeight: '180px',
            }}
        >
            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <div style={{ fontWeight: '700', fontSize: '17px', marginBottom: '2px' }}>{room.name}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>{room.category}</div>
                </div>
                <span style={{ fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '20px', background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, letterSpacing: '1px', whiteSpace: 'nowrap' }}>
                    {cfg.label}
                </span>
            </div>

            {/* Pricing info */}
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    <span style={{ color: cfg.color, fontWeight: '700' }}>EGP {fmt(room.pricePerHour ?? 0)}</span>/hr
                </div>
                {(room.minMinutes ?? 0) > 0 && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        min <span style={{ fontWeight: '600' }}>{room.minMinutes}m</span>
                    </div>
                )}
            </div>

            {/* Active session info */}
            {room.status === 'occupied' && room.activeSession && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: 'auto', padding: '10px', borderRadius: '8px', background: room.activeSession.isPaused ? 'rgba(255,255,255,0.05)' : 'rgba(255,82,82,0.08)', border: room.activeSession.isPaused ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,82,82,0.15)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <SessionTimer
                            startTime={room.activeSession.startTime}
                            isPaused={room.activeSession.isPaused}
                            totalPausedMs={room.activeSession.totalPausedMs}
                            lastPausedAt={room.activeSession.lastPausedAt}
                        />
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onTogglePause();
                            }}
                            title={room.activeSession.isPaused ? "Resume Session" : "Pause Session"}
                            style={{
                                padding: '4px', borderRadius: '4px', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                        >
                            {room.activeSession.isPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
                        </button>
                    </div>
                    {state ? (
                        <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--danger)' }}>
                            EGP {fmt(state.runningTotal)}
                            {state.ordersOpen > 0 && (
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '400', marginLeft: 6 }}>
                                    +{state.ordersOpen} open order{state.ordersOpen > 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                    ) : (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Loading…</div>
                    )}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onAddOrder();
                        }}
                        style={{
                            marginTop: 4, padding: '6px', borderRadius: '6px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                            color: 'var(--text)', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                            transition: 'all 0.1s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    >
                        <Plus size={12} /> Add Order
                    </button>
                </div>
            )}

            {/* CTA */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: cfg.color, fontSize: '12px', fontWeight: '600', marginTop: room.status === 'occupied' ? '0' : 'auto' }}>
                {room.status === 'available' && <><ArrowRight size={13} /> Start Session</>}
                {room.status === 'occupied' && <><Receipt size={13} /> View Receipt / Checkout</>}
            </div>
        </GlassPanel>
    );
};

// ─── Receipt Modal ────────────────────────────────────────────────

interface ReceiptModalProps {
    sessionId: string;
    roomName: string;
    shiftId: string | undefined;
    modes: PaymentMode[];
    onConfirm: () => void;
    onClose: () => void;
    onAddOrder: () => void;
    isAdminViewing?: boolean;
    staffName: string;
}

const ReceiptModal: React.FC<ReceiptModalProps> = ({ sessionId, roomName, shiftId, modes, onConfirm, onClose, onAddOrder, isAdminViewing, staffName }) => {
    const [data, setData] = useState<{ session: SessionDetail; billing: SessionBilling } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Checkout state
    const [step, setStep] = useState<'receipt' | 'checkout'>('receipt');
    const [payments, setPayments] = useState<{ id: string; modeId: string; amount: string; receiptUrl?: string; receiptKey?: string }[]>([
        { id: '1', modeId: modes[0]?.id ?? '', amount: '' }
    ]);
    const [activeWebcamPaymentId, setActiveWebcamPaymentId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Tips & Owners state
    const [tipInput, setTipInput] = useState<string>('');
    const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');
    const [owners, setOwners] = useState<{ id: string; username: string }[]>([]);

    const [promoCode, setPromoCode] = useState('');
    const [promoDiscount, setPromoDiscount] = useState<{ type: 'percent' | 'fixed'; value: number; applyTo: 'room' | 'orders' | 'both' } | null>(null);
    const [promoError, setPromoError] = useState('');
    const [loadingPromo, setLoadingPromo] = useState(false);

    const elapsed = useElapsedTime(data?.session.startTime);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const res = await roomService.getSession(sessionId);
            setData(res.data);
            recalculateAmount(res.data.billing, promoDiscount, parseFloat(tipInput || '0'));

            // Also fetch owners for the dropdown
            const ownerRes = await import('../services/api').then(m => m.default.get('/owners'));
            setOwners(ownerRes.data);

            // Auto-select owner if already assigned to this session
            const ownerOrder = res.data.session.orders.find((o: SessionOrder) => o.type === 'owner' && o.ownerUserId);
            if (ownerOrder?.ownerUserId) {
                setSelectedOwnerId(ownerOrder.ownerUserId);
            }
        } catch (err) {
            setError(errMsg(err, 'Failed to load session or owners'));
        } finally {
            setLoading(false);
        }
    }, [sessionId, tipInput, promoDiscount]);

    useEffect(() => { void loadData(); }, [loadData]);

    const recalculateAmount = (billing: any, discount: { type: 'percent' | 'fixed'; value: number; applyTo: 'room' | 'orders' | 'both' } | null, explicitTip: number = 0) => {
        let discountAmt = 0;
        if (discount) {
            const rCharge = billing.roomAmount ?? 0;
            const oCharge = billing.ordersAmount ?? 0;
            const base = discount.applyTo === 'room' ? rCharge : discount.applyTo === 'orders' ? oCharge : rCharge + oCharge;
            if (discount.type === 'percent') {
                discountAmt = base * (discount.value / 100);
            } else {
                discountAmt = Math.min(discount.value, base);
            }
        }
        const final = billing.finalTotal - discountAmt + explicitTip;
        setPayments([{ id: Date.now().toString(), modeId: modes[0]?.id ?? '', amount: Math.max(0, final).toFixed(2) }]);
    };

    const validatePromo = async () => {
        if (!promoCode.trim()) return;
        setLoadingPromo(true);
        setPromoError('');
        try {
            const res = await import('../services/api').then(m => m.default.get(`/promocodes/${promoCode}`));
            const discount = { type: res.data.type, value: res.data.value, applyTo: res.data.applyTo ?? 'both' } as const;
            setPromoDiscount(discount);
            if (data?.billing) {
                recalculateAmount(data.billing, discount, parseFloat(tipInput || '0'));
            }
        } catch (err) {
            setPromoDiscount(null);
            setPromoError(errMsg(err, 'Invalid or expired promo code'));
            if (data?.billing) recalculateAmount(data.billing, null, parseFloat(tipInput || '0'));
        } finally {
            setLoadingPromo(false);
        }
    };

    // Auto-refresh when websocket pushes new state
    useSocket(BASE_URL, (type) => {
        if (type === 'rooms.states_update' && step === 'receipt') {
            void loadData();
        }
    });

    const handleCheckout = async (e: React.FormEvent) => {
        e.preventDefault();

        const explicitTip = parseFloat(tipInput || '0');
        const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);

        let finalTipToSend = explicitTip;

        // Validation: If NOT an owner checkout, ensure sufficient funds are collected.
        if (!selectedOwnerId) {
            if (totalPaid < finalDue) {
                return toast.error('Total collected amount is less than the amount due!');
            }
            finalTipToSend = totalPaid - finalDue; // Calculate tip as overpayment
        }

        if (!shiftId) return toast.error('Cannot checkout without an active shift');
        setSubmitting(true);
        try {
            const api = await import('../services/api').then(m => m.default);
            // 0. Assign Owner if selected
            if (selectedOwnerId) {
                await api.post(`/sessions/${sessionId}/assign-owner`, {
                    ownerUserId: selectedOwnerId,
                    shiftId,
                });
            }

            // 1. End session first — this creates the sessionCharge record in DB
            await roomService.endSession(sessionId, shiftId, promoDiscount ? promoCode : undefined, finalTipToSend);

            // 2. Record multiple payments against the persisted sessionCharge (Skip if owner is selected)
            if (!selectedOwnerId) {
                await Promise.all(payments.filter(p => parseFloat(p.amount || '0') > 0).map(p =>
                    api.post('/payments', {
                        modeId: p.modeId,
                        amount: parseFloat(p.amount || '0'),
                        referenceType: 'session',
                        referenceId: sessionId,
                        shiftId,
                        receiptUrl: p.receiptKey ?? p.receiptUrl,
                    })
                ));
            }
            onConfirm();
            toast.success('Checkout successful!');
        } catch (err) {
            toast.error(errMsg(err, 'Checkout failed. (Ensure backend handles multiple payments per session if needed)'));
        } finally {
            setSubmitting(false);
        }
    };

    const b = data?.billing;
    const s = data?.session;

    const baseFinalTotal = b?.finalTotal ?? 0;
    const computeFinalDue = () => {
        let discountAmt = 0;
        if (promoDiscount && b) {
            const rCharge = b.roomAmount ?? 0;
            const oCharge = b.ordersAmount ?? 0;
            const base = promoDiscount.applyTo === 'room' ? rCharge : promoDiscount.applyTo === 'orders' ? oCharge : rCharge + oCharge;
            if (promoDiscount.type === 'percent') {
                discountAmt = base * (promoDiscount.value / 100);
            } else {
                discountAmt = Math.min(promoDiscount.value, base);
            }
        }
        return Math.max(0, baseFinalTotal - discountAmt);
    };
    const finalDue = computeFinalDue();
    const currentTotalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);

    return (
        <div className="no-print-bg" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    .print-only { display: block !important; }
                    .receipt-print-area { box-shadow: none !important; border: none !important; background: #fff !important; color: #000 !important; width: 100% !important; max-width: 100% !important; padding: 0 !important; }
                    .receipt-content { padding: 0 !important; overflow: visible !important; }
                    .no-print-bg { background: none !important; position: static !important; padding: 0 !important; }
                    .glass-panel { background: none !important; border: none !important; backdrop-filter: none !important; }
                    .receipt-summary-box { background: #f9f9f9 !important; border: 1px solid #000 !important; color: #000 !important; }
                    .receipt-divider { border-top: 1px dashed #000 !important; }
                    .mono { font-family: monospace !important; font-weight: bold !important; }
                }
                .mono { font-family: 'JetBrains Mono', 'Roboto Mono', monospace; }
                .receipt-divider { height: 1px; border-top: 1px dashed var(--border); margin: 12px 0; }
                .receipt-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 6px; }
            `}</style>
            <GlassPanel className="receipt-print-area" style={{ padding: '0', maxWidth: '520px', width: '100%', maxHeight: '95vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                {/* Header (Sticky) */}
                <div className="no-print" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', zIndex: 10, flexShrink: 0 }}>
                    <div>
                        <div style={{ fontWeight: '800', fontSize: '16px', display: 'flex', alignItems: 'center', gap: 10, letterSpacing: '0.5px' }}>
                            <Receipt size={18} color="var(--primary)" />
                            {step === 'receipt' ? 'SESSION RECEIPT' : 'CHECKOUT'}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 4 }}>
                            {roomName} {elapsed ? ` • ${elapsed}` : ''}
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '8px', borderRadius: '50%', display: 'flex' }}>
                        <X size={18} />
                    </button>
                </div>

                {/* Print Header */}
                <div className="print-only" style={{ display: 'none', textAlign: 'center', padding: '20px 0 10px 0' }}>
                    <div style={{ fontSize: '28px', fontWeight: '900', letterSpacing: '2px', marginBottom: '4px' }}>SQUAD POS</div>
                    <div style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8 }}>Official Receipt</div>
                    <div className="receipt-divider" style={{ width: '60px', margin: '15px auto' }} />
                </div>

                {/* Scrollable Content Area */}
                <div className="receipt-content" style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
                    {/* Metadata Section */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px', fontSize: '12px' }}>
                        <div>
                            <span style={{ color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontSize: '10px', marginBottom: '2px' }}>Date & Time</span>
                            <span style={{ fontWeight: '600' }}>{new Date().toLocaleString()}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontSize: '10px', marginBottom: '2px' }}>Staff / ID</span>
                            <span style={{ fontWeight: '600' }}>{staffName} / {sessionId.slice(0, 8)}</span>
                        </div>
                    </div>

                    {loading && <div className="no-print" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>Loading session details…</div>}
                    {error && (
                        <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)', fontSize: '13px', background: 'rgba(255,82,82,0.1)', padding: '12px', borderRadius: '8px' }}>
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}

                    {data && step === 'receipt' && (
                        <>
                            {/* Room Usage */}
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '10px', fontWeight: '700' }}>Room Usage</div>
                                <div className="receipt-row">
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: '700', fontSize: '14px' }}>{roomName}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                            {b!.billableMinutes} mins @ EGP {fmt(b!.hourlyPrice)}/hr
                                            {((s as any).totalPausedMs > 0 || (s as any).isPaused) && (
                                                <div style={{ color: 'var(--primary)', fontWeight: '600', marginTop: '2px' }}>• Paused time excluded</div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mono" style={{ fontWeight: '700', fontSize: '14px' }}>EGP {fmt(b!.roomAmount)}</div>
                                </div>
                                <div className="receipt-divider" />
                            </div>

                            {/* Orders Section */}
                            {s!.orders.length > 0 && (
                                <div style={{ marginBottom: '20px' }}>
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '10px', fontWeight: '700' }}>Orders Breakdown</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {s!.orders.map(order => (
                                            <div key={order.id} style={{ marginBottom: '4px' }}>
                                                {order.items.map(item => (
                                                    <div key={item.id} className="receipt-row" style={{ fontSize: '13px' }}>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontWeight: '600' }}>{item.product?.name ?? 'Item'}</div>
                                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Qty: {item.qty} × EGP {fmt(item.unitPrice)}</div>
                                                        </div>
                                                        <div className="mono" style={{ fontWeight: '600' }}>EGP {fmt(item.total)}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="receipt-divider" />
                                </div>
                            )}

                            {/* Final Calculations */}
                            <div style={{ marginTop: 'auto' }}>
                                <div className="receipt-row" style={{ fontSize: '14px', marginBottom: '12px' }}>
                                    <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>SUBTOTAL</span>
                                    <span style={{ fontWeight: '700' }} className="mono">EGP {fmt(b!.roomAmount + b!.ordersAmount)}</span>
                                </div>

                                {(() => {
                                    const discountAmt = baseFinalTotal - finalDue;
                                    const adjustments = [
                                        // Promo line info
                                        ...(promoDiscount ? [{ label: `Promo Code: ${promoCode}`, value: 0, isPromo: true, isInfo: true }] : []),
                                        // Discount value (always show if promo active or discount > 0)
                                        ...(promoDiscount || b!.discount > 0 ? [{ label: 'DISCOUNT', value: -Math.max(b!.discount, discountAmt) }] : []),
                                        // Fees
                                        ...(b!.serviceFee > 0 ? [{ label: 'Service Fee', value: b!.serviceFee }] : []),
                                        ...(b!.tax > 0 ? [{ label: 'Tax', value: b!.tax }] : []),
                                        // Tip (calculated statically or from input)
                                        { label: 'TIP', value: Math.max(b!.tip, parseFloat(tipInput || '0')) },
                                    ];

                                    if (adjustments.length === 0) return null;

                                    return (
                                        <div className="receipt-summary-box" style={{ borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', padding: '12px 16px', marginBottom: '20px' }}>
                                            {adjustments.map((row, i) => (
                                                <div key={i} className="receipt-row" style={{ fontSize: '12px', marginBottom: i === adjustments.length - 1 ? 0 : '8px' }}>
                                                    <span style={{ color: (row as any).isPromo ? 'var(--primary)' : 'var(--text-muted)', fontWeight: (row as any).isPromo ? '700' : '500' }}>{row.label}</span>
                                                    <span className="mono" style={{ color: (row as any).isInfo ? 'var(--primary)' : (row.value < 0 ? 'var(--primary)' : 'var(--text)'), fontWeight: '600' }}>
                                                        {(row as any).isInfo ? '' : (row.value < 0 ? '-' : '+')} {(row as any).isInfo ? '' : 'EGP '} {(row as any).isInfo ? '' : fmt(Math.abs(row.value))}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}

                                <div className="receipt-print-total" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderTop: '2px solid var(--text)', borderBottom: '2px solid var(--text)', margin: '10px 0 20px 0' }}>
                                    <span style={{ fontSize: '18px', fontWeight: '900', letterSpacing: '1px' }}>TOTAL DUE</span>
                                    <span style={{ fontSize: '24px', fontWeight: '900' }} className="mono">EGP {fmt(finalDue + parseFloat(tipInput || '0'))}</span>
                                </div>

                                {/* Dynamic Payments Collected Summary */}
                                {payments.some(p => parseFloat(p.amount || '0') > 0) && (
                                    <div style={{ marginTop: '10px' }}>
                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '10px', fontWeight: '700' }}>Payments Collected</div>
                                        {payments.filter(p => parseFloat(p.amount || '0') > 0).map((p) => {
                                            const modeName = modes.find(m => m.id === p.modeId)?.name || 'Unknown';
                                            return (
                                                <div key={p.id} className="receipt-row" style={{ fontSize: '13px', marginBottom: '4px' }}>
                                                    <span style={{ fontWeight: '600' }}>{modeName.toUpperCase()}</span>
                                                    <span className="mono">EGP {fmt(parseFloat(p.amount || '0'))}</span>
                                                </div>
                                            );
                                        })}
                                        <div className="receipt-divider" />
                                    </div>
                                )}
                            </div>

                            {/* Print Footer */}
                            <div className="print-only" style={{ display: 'none', textAlign: 'center', marginTop: '20px' }}>
                                <div style={{ fontSize: '14px', fontWeight: '900', letterSpacing: '2px', marginBottom: '4px' }}>THANK YOU</div>
                                <div style={{ fontSize: '11px', opacity: 0.7 }}>SQUAD POS • Managed Efficiency</div>
                            </div>

                            {/* Promo Code Input */}
                            <div className="no-print" style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginTop: '10px' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            placeholder="Promo Code"
                                            value={promoCode}
                                            onChange={e => {
                                                setPromoCode(e.target.value);
                                                setPromoDiscount(null);
                                                setPromoError('');
                                            }}
                                            disabled={loadingPromo}
                                            style={{ width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${promoError ? 'var(--danger)' : promoDiscount ? 'var(--primary)' : 'var(--border)'}`, color: 'var(--text)', borderRadius: '10px', boxSizing: 'border-box', fontSize: '14px' }}
                                        />
                                        {promoDiscount && <CheckCircle size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)' }} />}
                                    </div>
                                    {promoError && <div style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '4px', paddingLeft: '4px' }}>{promoError}</div>}
                                </div>
                                <Button variant="secondary" onClick={() => void validatePromo()} loading={loadingPromo} style={{ padding: '0 20px', height: '42px', borderRadius: '10px' }}>
                                    Apply
                                </Button>
                            </div>
                        </>
                    )}
                </div>


                {/* Footer Actions (Sticky) */}
                {data && step === 'receipt' && (
                    <div className="no-print" style={{ padding: '24px 28px', borderTop: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', gap: '12px', zIndex: 10, flexShrink: 0 }}>
                        {!isAdminViewing && (
                            <>
                                <Button style={{ flex: 2, padding: '12px' }} icon={<CreditCard size={16} />} onClick={() => setStep('checkout')}>
                                    Proceed to Checkout
                                </Button>
                                <Button variant="secondary" style={{ flex: 1, padding: '12px' }} icon={<Plus size={16} />} onClick={onAddOrder}>
                                    Add Order
                                </Button>
                            </>
                        )}
                        <Button variant="secondary" style={{ flex: 1, padding: '12px' }} icon={<Printer size={16} />} onClick={() => window.print()}>
                            Print Receipt
                        </Button>
                        <Button variant="secondary" style={{ flex: 1, padding: '12px' }} icon={<XCircle size={16} />} onClick={onClose}>
                            Close
                        </Button>
                    </div>
                )}
                {data && step === 'checkout' && (
                    <form onSubmit={(e) => { void handleCheckout(e); }} style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '0 28px 24px 28px' }}>
                        {/* Total reminder */}
                        <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Amount due</span>
                            <span style={{ fontSize: '24px', fontWeight: '800', color: 'var(--primary)' }}>EGP {fmt(finalDue)}</span>
                        </div>

                        {/* Optional Adjustments: Tip & Owner */}
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block', textTransform: 'uppercase', letterSpacing: '1px' }}>Assign Owner (Optional)</label>
                                <select
                                    value={selectedOwnerId}
                                    onChange={e => setSelectedOwnerId(e.target.value)}
                                    style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '10px' }}
                                >
                                    <option value="" style={{ background: '#1a1a1a' }}>-- Select Owner --</option>
                                    {owners.map(o => (
                                        <option key={o.id} value={o.id} style={{ background: '#1a1a1a' }}>{o.username}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ width: '140px' }}>
                                <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block', textTransform: 'uppercase', letterSpacing: '1px' }}>Explicit Tip</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="number" step="0.01" min="0"
                                        placeholder="0.00"
                                        value={tipInput}
                                        onChange={e => {
                                            setTipInput(e.target.value);
                                            recalculateAmount(data.billing, promoDiscount, parseFloat(e.target.value || '0'));
                                        }}
                                        style={{ width: '100%', padding: '12px', paddingLeft: '45px', background: 'rgba(255,171,0,0.05)', border: '1px solid rgba(255,171,0,0.3)', color: '#ffab00', borderRadius: '10px', boxSizing: 'border-box' }}
                                    />
                                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#ffab00', fontSize: '13px' }}>EGP</span>
                                </div>
                            </div>
                        </div>

                        {/* Payment Splits - Only show if NO owner is selected */}
                        {!selectedOwnerId ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>PAYMENT SPLITS</label>
                                    <button type="button" onClick={() => {
                                        const computedDue = computeFinalDue() + parseFloat(tipInput || '0');
                                        const remaining = Math.max(0, computedDue - currentTotalPaid);
                                        setPayments([...payments, { id: Date.now().toString(), modeId: modes[0]?.id ?? '', amount: remaining > 0 ? remaining.toFixed(2) : '' }]);
                                    }} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Plus size={14} /> Add Mode
                                    </button>
                                </div>

                                {payments.map(payment => (
                                    <div key={payment.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                        <select
                                            value={payment.modeId}
                                            onChange={e => setPayments(prev => prev.map(p => p.id === payment.id ? { ...p, modeId: e.target.value } : p))}
                                            style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '10px' }}
                                        >
                                            {modes.filter(m => m.active).map(m => (
                                                <option key={m.id} value={m.id} style={{ background: '#1a1a1a' }}>{m.name}</option>
                                            ))}
                                        </select>
                                        <div style={{ flex: 1, position: 'relative' }}>
                                            <input
                                                type="number" step="0.01" required
                                                placeholder="0.00"
                                                value={payment.amount}
                                                onChange={e => setPayments(prev => prev.map(p => p.id === payment.id ? { ...p, amount: e.target.value } : p))}
                                                style={{ width: '100%', padding: '12px', paddingLeft: '45px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '10px', boxSizing: 'border-box' }}
                                            />
                                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '13px' }}>EGP</span>
                                        </div>
                                        {modes.find(m => m.id === payment.modeId)?.name.match(/visa|instapay/i) && (
                                            <button type="button" onClick={() => setActiveWebcamPaymentId(payment.id)} title={payment.receiptUrl ? "Receipt captured" : "Capture receipt photo"} style={{ background: payment.receiptUrl ? 'rgba(0,230,118,0.1)' : 'rgba(255,255,255,0.06)', border: `1px solid ${payment.receiptUrl ? 'rgba(0,230,118,0.3)' : 'var(--border)'}`, color: payment.receiptUrl ? 'var(--primary)' : 'var(--text-muted)', borderRadius: '10px', width: '42px', height: '42.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <Camera size={16} />
                                            </button>
                                        )}
                                        {payments.length > 1 && (
                                            <button type="button" onClick={() => setPayments(prev => prev.filter(p => p.id !== payment.id))} style={{ background: 'rgba(255,82,82,0.1)', border: 'none', color: 'var(--danger)', borderRadius: '10px', width: '42px', height: '42.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ padding: '20px', borderRadius: '12px', background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.2)', textAlign: 'center' }}>
                                <div style={{ color: 'var(--primary)', fontWeight: '700', fontSize: '15px' }}>Owner Tab Charge</div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
                                    Total will be deducted from owner's balance. No payment modes required.
                                </div>
                            </div>
                        )}

                        {/* Balance Remaining / Tip Notice */}
                        <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {currentTotalPaid < finalDue ? (
                                <>
                                    <AlertCircle size={14} color="#ffab00" />
                                    <span style={{ color: '#ffab00' }}>Remaining balance to allocate: EGP {(finalDue - currentTotalPaid).toFixed(2)}</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle size={14} color="var(--primary)" />
                                    <span style={{ color: 'var(--primary)' }}>
                                        {currentTotalPaid > finalDue
                                            ? `Tip included: EGP ${(currentTotalPaid - finalDue).toFixed(2)}`
                                            : 'Payment fully allocated'}
                                    </span>
                                </>
                            )}
                        </div>

                        {/* Extra Tip breakdown row (Mirroring receipt style) */}
                        {currentTotalPaid > finalDue && (
                            <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(0,230,118,0.05)', border: '1px dashed var(--primary)', display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Included Tip</span>
                                <span style={{ fontWeight: '700', color: 'var(--primary)' }}>EGP {fmt(currentTotalPaid - finalDue)}</span>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                            <Button type="submit" style={{ flex: 1 }} loading={submitting} disabled={!selectedOwnerId && currentTotalPaid < finalDue} icon={<CheckCircle size={18} />}>
                                Confirm {selectedOwnerId ? 'Deduction' : 'Payment'}
                            </Button>
                            <Button type="button" variant="secondary" onClick={() => setStep('receipt')} icon={<ArrowRight size={16} style={{ transform: 'rotate(180deg)' }} />} style={{ flex: 1 }}>
                                Back
                            </Button>
                        </div>
                    </form>
                )}
            </GlassPanel>

            {activeWebcamPaymentId && (
                <WebcamModal
                    onCapture={(key, url) => {
                        setPayments(prev => prev.map(p => p.id === activeWebcamPaymentId ? { ...p, receiptKey: key, receiptUrl: url } : p));
                        setActiveWebcamPaymentId(null);
                    }}
                    onClose={() => setActiveWebcamPaymentId(null)}
                />
            )}
        </div>
    );
};

// ─── New Order Modal ─────────────────────────────────────────────

interface NewOrderModalProps {
    shiftId: string;
    roomId?: string;
    roomName?: string;
    sessionId?: string;
    modes?: PaymentMode[];
    onCreated: () => void;
    onClose: () => void;
}

const NewOrderModal: React.FC<NewOrderModalProps> = ({ shiftId, roomId, roomName, sessionId, modes = [], onCreated, onClose }) => {
    const [orderType, setOrderType] = useState<'regular' | 'owner' | 'room'>(roomId ? 'room' : 'regular');
    const [products, setProducts] = useState<{ id: string; name: string; price: number; stockQty: number; imageUrl?: string; category?: { name: string } }[]>([]);
    const [users, setUsers] = useState<{ id: string; username: string; walletBalance: number }[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [ownerUserId, setOwnerUserId] = useState('');
    const [promoCode, setPromoCode] = useState('');
    const [promoDiscount, setPromoDiscount] = useState<{ type: 'percent' | 'fixed'; value: number; applyTo: 'room' | 'orders' | 'both' } | null>(null);
    const [promoError, setPromoError] = useState('');
    const [loadingPromo, setLoadingPromo] = useState(false);
    const [selectedModeId, setSelectedModeId] = useState<string>(modes.find(m => m.name.toLowerCase() === 'cash')?.id ?? modes[0]?.id ?? '');

    useEffect(() => {
        setLoading(true);
        Promise.all([
            adminService.getProducts(),
            adminService.getUsersList(),
        ]).then(([pRes, uRes]) => {
            setProducts((pRes.data as any).data || (pRes.data as any));
            setUsers(uRes.data);
            if (uRes.data.length > 0) setOwnerUserId(uRes.data[0].id);
        }).catch(console.error).finally(() => setLoading(false));
    }, []);

    const selectedOwner = users.find(u => u.id === ownerUserId);
    const calculateTotal = () => {
        const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
        let discountAmt = 0;
        if (promoDiscount && promoDiscount.applyTo !== 'room') {
            if (promoDiscount.type === 'percent') {
                discountAmt = subtotal * (promoDiscount.value / 100);
            } else {
                discountAmt = Math.min(promoDiscount.value, subtotal);
            }
        }
        return Math.max(0, subtotal - discountAmt);
    };

    const cartTotal = calculateTotal();
    const ownerLowBalance = orderType === 'owner' && selectedOwner && selectedOwner.walletBalance < cartTotal;
    const subTotal = cart.reduce((s, c) => s + c.price * c.qty, 0);

    const validatePromo = async () => {
        if (!promoCode.trim()) return;
        setLoadingPromo(true);
        setPromoError('');
        try {
            // we will need to import api from api service or use fetch directly since we don't have it in admin.service
            const res = await import('../services/api').then(m => m.default.get(`/promocodes/${promoCode}`));
            setPromoDiscount({ type: res.data.type, value: res.data.value, applyTo: res.data.applyTo ?? 'both' });
        } catch (err) {
            setPromoDiscount(null);
            setPromoError(errMsg(err, 'Invalid or expired promo code'));
        } finally {
            setLoadingPromo(false);
        }
    };

    const addToCart = (p: typeof products[0]) => {
        setCart(prev => {
            const existing = prev.find(c => c.productId === p.id);
            if (existing) return prev.map(c => c.productId === p.id ? { ...c, qty: c.qty + 1 } : c);
            return [...prev, { productId: p.id, name: p.name, price: p.price, qty: 1 }];
        });
    };

    const removeFromCart = (productId: string) =>
        setCart(prev => prev.filter(c => c.productId !== productId));

    const changeQty = (productId: string, delta: number) => {
        setCart(prev => prev.map(c => c.productId === productId
            ? { ...c, qty: Math.max(1, c.qty + delta) } : c));
    };

    const handleSubmit = async () => {
        if (cart.length === 0) return toast.error('Add at least one item');
        if (orderType === 'owner' && !ownerUserId) return toast.error('Select an owner');
        setSubmitting(true);
        try {
            const res = await adminService.createOrder({
                type: orderType,
                shiftId,
                roomId: orderType === 'room' ? roomId : undefined,
                sessionId: orderType === 'room' ? sessionId : undefined,
                items: cart.map(c => ({ productId: c.productId, qty: c.qty })),
                promoCode: promoDiscount ? promoCode : undefined,
                ...(orderType === 'owner' ? { ownerUserId } : {}),
            });
            // Auto-approve all manual (staff-created) orders — only guest orders need approval
            await adminService.approveOrder(res.data.id);

            // If it's a walk-in order (regular) and not an owner or room order, process payment
            if (orderType === 'regular' && selectedModeId) {
                await adminService.checkoutOrder(res.data.id, {
                    shiftId,
                    payments: [{ modeId: selectedModeId, amount: cartTotal }]
                });
            }

            onCreated();
            toast.success('Order created successfully');
        } catch (err) {
            const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed to create order';
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    const filtered = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || p.category?.name === selectedCategory;
        return matchesSearch && matchesCategory && p.stockQty > 0;
    });

    // Derive unique categories from products
    const uniqueCategories = Array.from(new Set(products.map(p => p.category?.name).filter(Boolean))) as string[];

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <GlassPanel style={{ width: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: '700', fontSize: '17px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ShoppingCart size={18} color="var(--primary)" /> New Order {roomName && <span style={{ color: 'var(--text-muted)', fontWeight: '400' }}>— {roomName}</span>}
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
                </div>

                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    {/* Left: Product Picker */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)', overflow: 'hidden' }}>
                        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                            <input
                                placeholder="Search products…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '8px', boxSizing: 'border-box' }}
                            />
                            {/* Categories */}
                            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
                                <button
                                    onClick={() => setSelectedCategory('all')}
                                    style={{
                                        padding: '6px 14px', borderRadius: '16px', fontSize: '12px', fontWeight: '700', whiteSpace: 'nowrap',
                                        background: selectedCategory === 'all' ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                                        color: selectedCategory === 'all' ? '#000' : 'var(--text)',
                                        border: '1px solid', borderColor: selectedCategory === 'all' ? 'var(--primary)' : 'var(--border)',
                                        cursor: 'pointer', transition: 'all 0.2s'
                                    }}
                                >
                                    All
                                </button>
                                {uniqueCategories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setSelectedCategory(cat)}
                                        style={{
                                            padding: '6px 14px', borderRadius: '16px', fontSize: '12px', fontWeight: '700', whiteSpace: 'nowrap',
                                            background: selectedCategory === cat ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                                            color: selectedCategory === cat ? '#000' : 'var(--text)',
                                            border: '1px solid', borderColor: selectedCategory === cat ? 'var(--primary)' : 'var(--border)',
                                            cursor: 'pointer', transition: 'all 0.2s'
                                        }}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px', alignContent: 'start' }}>
                            {loading && <div style={{ color: 'var(--text-muted)', fontSize: '13px', gridColumn: '1/-1' }}>Loading…</div>}
                            {filtered.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => addToCart(p)}
                                    style={{ padding: '0', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', color: 'var(--text)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                        e.currentTarget.style.borderColor = 'var(--primary)';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                                        e.currentTarget.style.borderColor = 'var(--border)';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    }}
                                >
                                    <div style={{ height: '80px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--border)', overflow: 'hidden' }}>
                                        {p.imageUrl ? (
                                            <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <Package size={24} color="var(--text-muted)" />
                                        )}
                                    </div>
                                    <div style={{ padding: '10px' }}>
                                        <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '700' }}>EGP {fmt(p.price)}</div>
                                    </div>
                                </button>
                            ))}
                            {!loading && filtered.length === 0 && (
                                <div style={{ color: 'var(--text-muted)', fontSize: '13px', gridColumn: '1/-1', textAlign: 'center', paddingTop: '30px' }}>No products found</div>
                            )}
                        </div>
                    </div>

                    {/* Right: Cart + Options */}
                    <div style={{ width: '300px', display: 'flex', flexDirection: 'column' }}>
                        {/* Order type */}
                        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Order Type</div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {([roomId ? 'room' : 'regular', 'owner'] as const).map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setOrderType(t as any)}
                                        style={{
                                            flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: '700',
                                            cursor: 'pointer', border: '1px solid',
                                            background: orderType === t ? (t === 'owner' ? 'rgba(255,171,0,0.15)' : 'rgba(0,230,118,0.12)') : 'rgba(255,255,255,0.04)',
                                            color: orderType === t ? (t === 'owner' ? '#ffab00' : 'var(--primary)') : 'var(--text-muted)',
                                            borderColor: orderType === t ? (t === 'owner' ? '#ffab00' : 'var(--primary)') : 'var(--border)',
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        {t === 'room' ? '🏠 Room' : t === 'regular' ? '🛒 Walk-in' : '👑 Owner'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Owner selector (only for owner type) */}
                        {orderType === 'owner' && (
                            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(255,171,0,0.04)' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Owner</div>
                                <select
                                    value={ownerUserId}
                                    onChange={e => setOwnerUserId(e.target.value)}
                                    disabled={users.length === 0}
                                    style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.06)', border: `1px solid ${users.length === 0 ? 'var(--danger)' : 'var(--border)'}`, color: 'var(--text)', borderRadius: '8px', boxSizing: 'border-box', cursor: users.length === 0 ? 'not-allowed' : 'pointer' }}
                                >
                                    {users.length === 0 ? (
                                        <option value="" style={{ background: '#1a1a1a' }}>No owners found</option>
                                    ) : (
                                        users.map(u => (
                                            <option key={u.id} value={u.id} style={{ background: '#1a1a1a' }}>
                                                {u.username}
                                            </option>
                                        ))
                                    )}
                                </select>
                                {users.length === 0 && (
                                    <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--danger)', fontStyle: 'italic' }}>
                                        Please add an 'OWNER' role user in User Management first.
                                    </div>
                                )}

                                {selectedOwner && (
                                    <div style={{ marginTop: '10px', padding: '10px', borderRadius: '8px', background: ownerLowBalance ? 'rgba(255,82,82,0.08)' : 'rgba(0,230,118,0.07)', border: `1px solid ${ownerLowBalance ? 'var(--danger)' : 'rgba(0,230,118,0.2)'}` }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Wallet Balance</span>
                                            <span style={{ fontWeight: '800', fontSize: '14px', color: ownerLowBalance ? 'var(--danger)' : 'var(--primary)' }}>
                                                EGP {fmt(selectedOwner.walletBalance)}
                                            </span>
                                        </div>
                                        {ownerLowBalance && (
                                            <div style={{ marginTop: 6, fontSize: '11px', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <AlertCircle size={11} /> Insufficient balance — order will fail on approval
                                            </div>
                                        )}
                                        {!ownerLowBalance && cartTotal > 0 && (
                                            <div style={{ marginTop: 6, fontSize: '11px', color: 'var(--text-muted)' }}>
                                                After deduction: EGP {fmt(selectedOwner.walletBalance - cartTotal)}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Payment method selector for walk-in orders */}
                        {orderType === 'regular' && modes.length > 0 && (
                            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Payment Method</div>
                                <select
                                    value={selectedModeId}
                                    onChange={e => setSelectedModeId(e.target.value)}
                                    style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '8px', cursor: 'pointer' }}
                                >
                                    {modes.map(m => (
                                        <option key={m.id} value={m.id} style={{ background: '#1a1a1a' }}>{m.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Cart items */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>
                            {cart.length === 0 ? (
                                <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', paddingTop: 30 }}>Add products from the left</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {cart.map(item => (
                                        <div key={item.productId} style={{ padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                                <span style={{ fontSize: '13px', fontWeight: '600' }}>{item.name}</span>
                                                <button onClick={() => removeFromCart(item.productId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 0 }}>
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <button onClick={() => changeQty(item.productId, -1)} style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: '14px' }}>−</button>
                                                <span style={{ fontSize: '13px', fontWeight: '700', minWidth: 20, textAlign: 'center' }}>{item.qty}</span>
                                                <button onClick={() => changeQty(item.productId, 1)} style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: '14px' }}>+</button>
                                                <span style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--text-muted)' }}>EGP {fmt(item.price * item.qty)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
                            {/* Promo Code Input */}
                            <div style={{ marginBottom: '14px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <input
                                        placeholder="Promo Code"
                                        value={promoCode}
                                        onChange={e => {
                                            setPromoCode(e.target.value);
                                            setPromoDiscount(null);
                                            setPromoError('');
                                        }}
                                        disabled={loadingPromo}
                                        style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.06)', border: `1px solid ${promoError ? 'var(--danger)' : promoDiscount ? 'var(--primary)' : 'var(--border)'}`, color: 'var(--text)', borderRadius: '8px', boxSizing: 'border-box', fontSize: '13px' }}
                                    />
                                    {promoError && <div style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '4px' }}>{promoError}</div>}
                                    {promoDiscount && <div style={{ fontSize: '11px', color: 'var(--primary)', marginTop: '4px' }}>Promo applied!</div>}
                                </div>
                                <Button variant="secondary" onClick={() => void validatePromo()} loading={loadingPromo} style={{ padding: '8px 12px', fontSize: '12px' }}>
                                    Apply
                                </Button>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px', color: 'var(--text-muted)' }}>
                                <span>Subtotal</span>
                                <span>EGP {fmt(subTotal)}</span>
                            </div>
                            {promoDiscount && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: 'var(--primary)' }}>
                                    <span>Discount</span>
                                    <span>- EGP {fmt(subTotal - cartTotal)}</span>
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                                <span style={{ fontWeight: '700' }}>Est. Total</span>
                                <span style={{ fontWeight: '800', color: 'var(--primary)' }}>
                                    EGP {fmt(cartTotal)}
                                </span>
                            </div>
                            {orderType === 'owner' && (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', textAlign: 'center', lineHeight: 1.5 }}>
                                    Wallet deduction happens on approval — order stays pending until staff approves
                                </div>
                            )}
                            <Button style={{ width: '100%' }} loading={submitting} icon={<Plus size={16} />} onClick={() => void handleSubmit()}>
                                {orderType === 'owner' ? 'Create Owner Order' : orderType === 'room' ? 'Add Order to Room' : 'Place Walk-in Order'}
                            </Button>
                        </div>
                    </div>
                </div>
            </GlassPanel>
        </div>
    );
};

// ─── Orders Panel ────────────────────────────────────────────────

interface OrdersPanelProps {
    orders: OrderSummary[];
    onApprove: (id: string) => void;
    onCancel: (id: string) => void;
    onNewOrder: () => void;
    shiftOpen: boolean;
    // Server-side pagination
    page: number;
    totalPages: number;
    total: number;
    pageSize: number;
    statusFilter: 'all' | 'pending' | 'approved' | 'cancelled';
    onPageChange: (page: number) => void;
    onStatusFilterChange: (s: 'all' | 'pending' | 'approved' | 'cancelled') => void;
}

const OrderTypeBadge: React.FC<{ type: string }> = ({ type }) => {
    const map: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
        regular: { label: 'Walk-in', icon: <ShoppingCart size={11} />, color: 'var(--primary)', bg: 'rgba(0,230,118,0.1)' },
        owner: { label: 'Owner', icon: <Users size={11} />, color: '#ffab00', bg: 'rgba(255,171,0,0.1)' },
        room: { label: 'Room', icon: <Home size={11} />, color: '#2979ff', bg: 'rgba(41,121,255,0.1)' },
    };
    const s = map[type] ?? map.regular;
    return (
        <span style={{ fontSize: '10px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px', background: s.bg, color: s.color, display: 'flex', alignItems: 'center', gap: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {s.icon} {s.label}
        </span>
    );
};

const OrderStatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const map: Record<string, { color: string; bg: string }> = {
        pending: { color: '#ffab00', bg: 'rgba(255,171,0,0.1)' },
        approved: { color: 'var(--primary)', bg: 'rgba(0,230,118,0.1)' },
        cancelled: { color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.06)' },
    };
    const s = map[status] ?? map.pending;
    return <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', background: s.bg, color: s.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{status}</span>;
};

const OrdersPanel: React.FC<OrdersPanelProps> = ({
    orders, onApprove, onCancel, onNewOrder, shiftOpen,
    page, totalPages, total, pageSize, statusFilter,
    onPageChange, onStatusFilterChange,
}) => {
    const [actioning, setActioning] = useState<string | null>(null);

    const handleAction = async (id: string, action: 'approve' | 'cancel') => {
        setActioning(id);
        try {
            if (action === 'approve') await onApprove(id);
            else await onCancel(id);
        } finally {
            setActioning(null);
        }
    };

    const filters: { value: typeof statusFilter; label: string; color: string }[] = [
        { value: 'all', label: 'All', color: 'var(--text-muted)' },
        { value: 'pending', label: 'Pending', color: '#ffab00' },
        { value: 'approved', label: 'Approved', color: 'var(--primary)' },
        { value: 'cancelled', label: 'Cancelled', color: 'var(--danger)' },
    ];

    return (
        <GlassPanel style={{ padding: '24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                    <ShoppingCart size={20} color="var(--primary)" /> Orders
                    <span style={{ fontSize: '13px', fontWeight: '400', color: 'var(--text-muted)' }}>
                        ({total} total)
                    </span>
                </h2>
                {shiftOpen && (
                    <Button icon={<Plus size={16} />} onClick={onNewOrder} style={{ fontSize: '13px', padding: '8px 16px' }}>
                        New Order
                    </Button>
                )}
            </div>

            {/* Status Filter */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                {filters.map(f => (
                    <button
                        key={f.value}
                        onClick={() => onStatusFilterChange(f.value)}
                        style={{
                            padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '700',
                            cursor: 'pointer', border: '1px solid',
                            background: statusFilter === f.value ? `${f.color}1a` : 'transparent',
                            color: statusFilter === f.value ? f.color : 'var(--text-muted)',
                            borderColor: statusFilter === f.value ? f.color : 'var(--border)',
                            transition: 'all 0.15s',
                        }}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Orders List */}
            {(!orders || orders.length === 0) ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '30px 0' }}>
                    {shiftOpen ? `No ${statusFilter === 'all' ? '' : statusFilter + ' '}orders this shift` : 'Open a shift to create orders'}
                </div>
            ) : (
                <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                        {orders.map(order => (
                            <div key={order.id} style={{ padding: '14px 16px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <OrderTypeBadge type={order.type} />
                                        {order.room?.name && <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)' }}>— {order.room.name}</span>}
                                        <OrderStatusBadge status={order.status} />
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>#{order.id.slice(0, 8)}</span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                            {order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </span>
                                    </div>
                                    {order.orderCharge && (
                                        <span style={{ fontWeight: '800', color: 'var(--primary)', fontSize: '15px' }}>EGP {fmt(order.orderCharge.finalTotal)}</span>
                                    )}
                                </div>

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: order.status === 'pending' ? '12px' : '0' }}>
                                    {order.items.map(item => (
                                        <span key={item.id} style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', color: 'var(--text)' }}>
                                            {item.product?.name ?? '?'} ×{item.qty}
                                        </span>
                                    ))}
                                </div>

                                {order.status === 'pending' && (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            disabled={actioning === order.id}
                                            onClick={() => void handleAction(order.id, 'approve')}
                                            style={{ flex: 1, padding: '7px', borderRadius: '8px', background: 'rgba(0,230,118,0.12)', border: '1px solid var(--primary)', color: 'var(--primary)', cursor: 'pointer', fontWeight: '700', fontSize: '12px' }}
                                        >
                                            <CheckCircle size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                            Approve
                                        </button>
                                        <button
                                            disabled={actioning === order.id}
                                            onClick={() => void handleAction(order.id, 'cancel')}
                                            style={{ flex: 1, padding: '7px', borderRadius: '8px', background: 'rgba(255,82,82,0.08)', border: '1px solid var(--danger)', color: 'var(--danger)', cursor: 'pointer', fontWeight: '700', fontSize: '12px' }}
                                        >
                                            <XCircle size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                            Cancel
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                            <button
                                onClick={() => onPageChange(page - 1)}
                                disabled={page === 0}
                                style={{
                                    padding: '7px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '700',
                                    background: page === 0 ? 'transparent' : 'rgba(255,255,255,0.06)',
                                    border: '1px solid var(--border)',
                                    color: page === 0 ? 'var(--text-muted)' : 'var(--text)',
                                    cursor: page === 0 ? 'not-allowed' : 'pointer',
                                    opacity: page === 0 ? 0.4 : 1,
                                    transition: 'all 0.15s',
                                }}
                            >
                                ← Prev
                            </button>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                Page <span style={{ color: 'var(--text)', fontWeight: '700' }}>{page + 1}</span> of{' '}
                                <span style={{ color: 'var(--text)', fontWeight: '700' }}>{totalPages}</span>
                                <span style={{ marginLeft: '8px', opacity: 0.6 }}>
                                    ({page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total})
                                </span>
                            </div>
                            <button
                                onClick={() => onPageChange(page + 1)}
                                disabled={page >= totalPages - 1}
                                style={{
                                    padding: '7px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '700',
                                    background: page >= totalPages - 1 ? 'transparent' : 'rgba(255,255,255,0.06)',
                                    border: '1px solid var(--border)',
                                    color: page >= totalPages - 1 ? 'var(--text-muted)' : 'var(--text)',
                                    cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
                                    opacity: page >= totalPages - 1 ? 0.4 : 1,
                                    transition: 'all 0.15s',
                                }}
                            >
                                Next →
                            </button>
                        </div>
                    )}
                </>
            )}
        </GlassPanel>
    );
};

// ─── Main Component ─────────────────────────────────────────────

const StaffDashboard: React.FC<StaffDashboardProps> = ({ rooms, fetchRooms, currentShift, onShiftChange, username, userRole }) => {
    const [shiftStats, setShiftStats] = useState<ShiftStatsReport | null>(null);
    const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
    const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [receiptRoom, setReceiptRoom] = useState<RoomWithSession | null>(null);
    const [loadingShiftAction, setLoadingShiftAction] = useState(false);
    const [roomStates, setRoomStates] = useState<Record<string, RoomStateResponse>>({});
    const [orders, setOrders] = useState<OrderSummary[]>([]);
    const [ordersPage, setOrdersPage] = useState(0);
    const [ordersTotal, setOrdersTotal] = useState(0);
    const [ordersTotalPages, setOrdersTotalPages] = useState(0);
    const [ordersStatusFilter, setOrdersStatusFilter] = useState<'all' | 'pending' | 'approved' | 'cancelled'>('all');
    const ORDERS_PAGE_SIZE = 10;
    const [showNewOrderModal, setShowNewOrderModal] = useState(false);
    const [orderRoom, setOrderRoom] = useState<RoomWithSession | null>(null);
    const [isPrintingShiftReport, setIsPrintingShiftReport] = useState(false);

    const handlePrintShiftReport = () => {
        setIsPrintingShiftReport(true);
        setTimeout(() => {
            window.print();
            setIsPrintingShiftReport(false);
        }, 100);
    };

    const [isRefreshing, setIsRefreshing] = useState(false);
    const handleManualRefresh = async () => {
        setIsRefreshing(true);
        try {
            fetchRooms();
            if (currentShift) {
                await Promise.all([
                    fetchStats(),
                    fetchOrders(0, ordersStatusFilter),
                ]);
            }
            await fetchRoomStates();
            toast.success('Dashboard refreshed');
        } catch (err) {
            console.error(err);
            toast.error('Failed to refresh');
        } finally {
            setIsRefreshing(false);
        }
    };

    const shiftElapsed = useElapsedTime(currentShift?.startTime);


    // Load static data once
    useEffect(() => {
        const load = async () => {
            try {
                const [modesRes, resRes] = await Promise.all([
                    adminService.getPaymentModes(),
                    adminService.getReservations(),
                ]);
                setPaymentModes(modesRes.data);
                setReservations(resRes.data);
            } catch (err) {
                console.error('Failed to load dashboard data', err);
            }
        };
        void load();
    }, []);

    // Poll live room state for all occupied rooms
    const fetchRoomStates = useCallback(async () => {
        const occupiedRooms = rooms.filter(r => r.status === 'occupied');
        if (occupiedRooms.length === 0) return;
        const results = await Promise.allSettled(occupiedRooms.map(r => roomService.getRoomState(r.id)));
        const next: Record<string, RoomStateResponse> = {};
        results.forEach((result, i) => {
            if (result.status === 'fulfilled') {
                next[occupiedRooms[i].id] = result.value.data;
            }
        });
        setRoomStates(prev => ({ ...prev, ...next }));
    }, [rooms]);

    useEffect(() => {
        void fetchRoomStates();
        // Polling removed in favor of WebSocket 'rooms.states_update'
    }, [fetchRoomStates]);

    useSocket(BASE_URL, (type, data) => {
        if (type === 'order_update' || type === 'order_notification' || type === 'order.created' || type === 'order.approved' || type === 'order.updated' || type === 'order.cancelled') {
            toast('🔔 New order activity received!', { icon: '📦', position: 'bottom-right', id: 'order-toast' });
            void fetchOrders();
            void fetchRoomStates();
        } else if (type === 'room_update') {
            fetchRooms();
            void fetchRoomStates();
        } else if (type === 'shift_update') {
            void fetchStats();
        } else if (type === 'rooms.states_update') {
            // Bulk update from backend interval
            if (data) {
                setRoomStates(prev => ({ ...prev, ...(data as Record<string, RoomStateResponse>) }));
            }
        }
    });

    // Live shift stats polling
    const fetchStats = useCallback(async () => {
        if (!currentShift) { setShiftStats(null); setRecentPayments([]); return; }
        try {
            const statsRes = await roomService.getShiftStats(currentShift.id);
            setShiftStats(statsRes.data as ShiftStatsReport);
            const paymentsRes = await adminService.getPayments();
            const payload = paymentsRes.data as any;
            const pData: Payment[] = Array.isArray(payload) ? payload : (payload.data || []);
            setRecentPayments(pData.filter(p => p.shiftId === currentShift.id).slice(0, 10));
        } catch (err) {
            console.error('Failed to fetch shift stats', err);
        }
    }, [currentShift]);

    const [activeTab, setActiveTab] = useState<'overview' | 'orders'>('overview');
    const [pendingOrdersCount, setPendingOrdersCount] = useState<number>(0);

    // Fetch orders for the shift (server-side paginated)
    const fetchOrders = useCallback(async (page = ordersPage, status = ordersStatusFilter) => {
        if (!currentShift) { setOrders([]); setOrdersTotal(0); setOrdersTotalPages(0); setPendingOrdersCount(0); return; }
        try {
            const res = await adminService.getOrders(currentShift.id, {
                page: page + 1, // API is 1-based
                pageSize: ORDERS_PAGE_SIZE,
                ...(status !== 'all' ? { status } : {}),
            });
            const payload = res.data as unknown as { data: OrderSummary[]; total: number; totalPages: number };
            const sortedOrders = payload.data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setOrders(sortedOrders);
            setOrdersTotal(payload.total);
            setOrdersTotalPages(payload.totalPages);

            // Fetch pending count selectively if current filter isn't pending
            if (status === 'pending') {
                setPendingOrdersCount(payload.total);
            } else {
                const pRes = await adminService.getOrders(currentShift.id, { page: 1, pageSize: 1, status: 'pending' });
                const pPayload = pRes.data as unknown as { total: number };
                setPendingOrdersCount(pPayload.total);
            }

        } catch (err) {
            console.error('Failed to fetch orders', err);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentShift, ordersPage, ordersStatusFilter]);

    useEffect(() => {
        void fetchOrders();
        // Polling removed in favor of WebSocket events
    }, [fetchOrders]);

    const handleApproveOrder = async (id: string) => {
        try {
            await adminService.approveOrder(id);
            void fetchOrders();
            toast.success('Order approved');
        }
        catch (err) { toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed to approve'); }
    };

    const handleCancelOrder = async (id: string) => {
        try {
            await adminService.cancelOrder(id);
            void fetchOrders();
            toast.success('Order cancelled');
        }
        catch (err) { toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed to cancel'); }
    };

    useEffect(() => {
        void fetchStats();
        // Polling removed in favor of WebSocket events
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentShift?.id]);

    const handleOpenShift = async () => {
        const cash = prompt('Opening Cash Amount (EGP):', '0');
        if (cash === null) return;
        setLoadingShiftAction(true);
        try {
            const res = await roomService.openShift(parseFloat(cash) || 0);
            const shift = res.data as Shift;
            onShiftChange(shift);
            localStorage.setItem('squad_shift', JSON.stringify(shift));
            toast.success('Shift opened successfully');
        } catch (err: unknown) {
            toast.error(errMsg(err, 'Error opening shift'));
        } finally { setLoadingShiftAction(false); }
    };

    const handleCloseShift = async () => {
        if (!currentShift) return;
        const cash = prompt('Enter Physical Cash Count (EGP):');
        if (cash === null) return;
        setLoadingShiftAction(true);
        try {
            await roomService.closeShift(currentShift.id, parseFloat(cash) || 0);
            onShiftChange(null);
            localStorage.removeItem('squad_shift');
            setShiftStats(null);
            toast.success('Shift closed successfully');
        } catch (err: unknown) {
            toast.error(errMsg(err, 'Error closing shift'));
        } finally { setLoadingShiftAction(false); }
    };

    const handleRoomClick = async (room: RoomWithSession) => {
        // ADMIN can view occupied rooms without a shift. Other roles/actions need an active shift.
        if (!currentShift) {
            const tempAdminAccess = (userRole === 'ADMIN' || userRole === 'admin') && room.status === 'occupied';
            if (!tempAdminAccess) {
                return toast.error('Please open a shift first!');
            }
        }

        if (room.status === 'cleaning' || room.status === 'maintenance') return;
        if (room.status === 'occupied') {
            setReceiptRoom(room); // Opens ReceiptModal
            return;
        }

        try {
            // Reaching here means starting a session — shift is guaranteed by the check above
            await roomService.startSession(room.id, currentShift!.id);
            fetchRooms();
            toast.success(`Session started in ${room.name}`);
        } catch (err: unknown) {
            toast.error(errMsg(err, 'Error starting session'));
        }
    };

    const handleTogglePause = async (room: RoomWithSession) => {
        if (!room.activeSession) return;
        try {
            if (room.activeSession.isPaused) {
                await roomService.resumeSession(room.activeSession.id);
                toast.success(`Session resumed in ${room.name}`);
            } else {
                await roomService.pauseSession(room.activeSession.id);
                toast.success(`Session paused in ${room.name}`);
            }
            fetchRooms();
        } catch (err: unknown) {
            toast.error(errMsg(err, 'Error toggling pause'));
        }
    };

    const handleReceiptConfirm = () => {
        setReceiptRoom(null);
        fetchRooms();
        void fetchStats();
    };

    // Derived stats
    const occupied = rooms.filter(r => r.status === 'occupied').length;
    const available = rooms.filter(r => r.status === 'available').length;
    const totalRevenue = (shiftStats?.paymentsCash ?? 0) + (shiftStats?.paymentsCard ?? 0) + (shiftStats?.paymentsWallet ?? 0);

    // Today's reservations
    const todayStr = new Date().toDateString();
    const todayReservations = reservations
        .filter(r => new Date(r.startTime).toDateString() === todayStr && r.status !== 'cancelled')
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

                {/* ── Shift Banner ─────────────────────────────────────── */}
                <GlassPanel style={{
                    padding: '24px 32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: currentShift ? 'rgba(0,230,118,0.06)' : 'rgba(255,255,255,0.03)',
                    borderLeft: `4px solid ${currentShift ? 'var(--primary)' : 'var(--border)'}`,
                    flexWrap: 'wrap',
                    gap: '16px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: currentShift ? 'rgba(0,230,118,0.15)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Zap size={22} color={currentShift ? 'var(--primary)' : 'var(--text-muted)'} />
                        </div>
                        <div>
                            <div style={{ fontWeight: '700', fontSize: '17px' }}>Good {getGreeting()}, {username}!</div>
                            {currentShift ? (
                                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '3px' }}>
                                    Shift active &nbsp;•&nbsp; <span style={{ fontFamily: 'monospace', color: 'var(--primary)' }}>{shiftElapsed}</span>
                                    &nbsp;•&nbsp; ID: {currentShift.id.slice(0, 8)}
                                </div>
                            ) : (
                                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '3px' }}>No active shift. Open a shift to begin.</div>
                            )}
                        </div>
                    </div>
                    <div className="no-print" style={{ display: 'flex', gap: '8px' }}>
                        <Button
                            variant="secondary"
                            icon={<RefreshCw size={16} className={isRefreshing ? 'spin-animation' : ''} />}
                            onClick={handleManualRefresh}
                            disabled={isRefreshing}
                        >
                            Refresh
                        </Button>
                        {currentShift && (
                            <Button variant="secondary" icon={<Printer size={16} />} onClick={handlePrintShiftReport}>
                                Print Report
                            </Button>
                        )}
                        {(userRole === 'STAFF' || userRole === 'staff') && (
                            <Button
                                onClick={currentShift ? handleCloseShift : handleOpenShift}
                                variant={currentShift ? 'secondary' : 'primary'}
                                loading={loadingShiftAction}
                                style={{ minWidth: '160px' }}
                            >
                                {currentShift ? 'Close Shift' : 'Open Shift'}
                            </Button>
                        )}
                    </div>
                </GlassPanel>

                {/* ── Stats Row ───────────────────────────────────────────── */}
                <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '18px' }}>
                    <StatCard icon={<Home size={22} />} label="Occupied" value={`${occupied} / ${rooms.length}`} color="var(--primary)" />
                    <StatCard icon={<Users size={22} />} label="Available" value={String(available)} color="#2979ff" />

                    {shiftStats?.paymentsByMode && shiftStats.paymentsByMode.length > 0 ? (
                        shiftStats.paymentsByMode.map((mode, i) => (
                            <StatCard
                                key={mode.name}
                                icon={mode.name.toLowerCase().includes('card') ? <CreditCard size={22} /> : "EGP"}
                                label={`${mode.name} (Shift)`}
                                value={`EGP ${fmt(mode.amount)}`}
                                color={['#00e676', '#ffab00', '#2979ff', '#e040fb', '#18ffff'][i % 5]}
                            />
                        ))
                    ) : (
                        <>
                            <StatCard icon="EGP" label="Cash (Shift)" value={`EGP ${fmt(shiftStats?.paymentsCash ?? 0)}`} color="#00e676" />
                            <StatCard icon={<CreditCard size={22} />} label="Card (Shift)" value={`EGP ${fmt(shiftStats?.paymentsCard ?? 0)}`} color="#ffab00" />
                        </>
                    )}

                    <StatCard icon="EGP" label="Total Revenue" value={`EGP ${fmt(totalRevenue)}`} color="var(--primary)" highlight />

                    {/* Expenses & Cash on Hand */}
                    {shiftStats?.expenses && shiftStats.expenses.length > 0 && (
                        <>
                            <StatCard
                                icon="EGP"
                                label="Expenses (Shift)"
                                value={`-EGP ${fmt(shiftStats.expenses.reduce((s: number, e: any) => s + e.amount, 0))}`}
                                color="#d32f2f"
                            />
                            <StatCard
                                icon="EGP"
                                label="Cash on Hand"
                                value={`EGP ${fmt(
                                    (shiftStats?.paymentsByMode?.find(m => m.name.toLowerCase() === 'cash')?.amount || shiftStats?.paymentsCash || 0)
                                    - shiftStats.expenses.reduce((s: number, e: any) => s + e.amount, 0)
                                )}`}
                                color="#00b0ff"
                            />
                        </>
                    )}
                </div>

                {/* ── Tabs Navigation ────────────────────────────────────── */}
                <div className="no-print" style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                    <button
                        onClick={() => setActiveTab('overview')}
                        style={{
                            padding: '8px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: '700',
                            background: activeTab === 'overview' ? 'var(--primary)' : 'transparent',
                            color: activeTab === 'overview' ? '#000' : 'var(--text-muted)',
                            border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                            display: 'flex', alignItems: 'center', gap: '8px'
                        }}
                    >
                        <Home size={16} /> Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('orders')}
                        style={{
                            padding: '8px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: '700',
                            background: activeTab === 'orders' ? 'var(--primary)' : 'transparent',
                            color: activeTab === 'orders' ? '#000' : 'var(--text-muted)',
                            border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                            display: 'flex', alignItems: 'center', gap: '8px', position: 'relative'
                        }}
                    >
                        <ShoppingCart size={16} /> Orders
                        {pendingOrdersCount > 0 && (
                            <span style={{
                                background: '#ffab00', color: '#000', fontSize: '11px', fontWeight: '800',
                                padding: '2px 6px', borderRadius: '20px', marginLeft: '4px'
                            }}>
                                {pendingOrdersCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* ── Tab Views ────────────────────────────────────────── */}

                {activeTab === 'overview' && (
                    <>
                        {/* ── two-column lower section ─────────────────────────── */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '28px', alignItems: 'start' }}>

                            {/* Room Grid */}
                            <div>
                                <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Home size={20} color="var(--primary)" /> Rooms
                                </h2>

                                {Object.entries(rooms.reduce((acc, room) => {
                                    const cat = room.category || 'Uncategorized';
                                    if (!acc[cat]) acc[cat] = [];
                                    acc[cat].push(room);
                                    return acc;
                                }, {} as Record<string, typeof rooms>)).map(([category, catRooms]) => (
                                    <div key={category} style={{ marginBottom: '24px' }}>
                                        <h3 style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                            {category}
                                        </h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '18px' }}>
                                            {catRooms.map(room => (
                                                <RoomCard
                                                    key={room.id}
                                                    room={room}
                                                    state={roomStates[room.id] ?? null}
                                                    onClick={() => void handleRoomClick(room)}
                                                    onAddOrder={() => {
                                                        if (!currentShift) return toast.error('Please open a shift first!');
                                                        setOrderRoom(room);
                                                        setShowNewOrderModal(true);
                                                    }}
                                                    onTogglePause={() => void handleTogglePause(room)}
                                                    isAdminViewing={!currentShift && (userRole === 'ADMIN' || userRole === 'admin')}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Right column */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                                {/* Reservations Today */}
                                <GlassPanel style={{ padding: '24px' }}>
                                    <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Clock size={16} color="var(--primary)" /> Reservations Today
                                    </h3>
                                    {todayReservations.length === 0 ? (
                                        <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>No reservations today</div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {todayReservations.slice(0, 5).map(r => (
                                                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                                                    <div>
                                                        <div style={{ fontSize: '13px', fontWeight: '600' }}>{r.room?.name ?? 'Room'}</div>
                                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                            {new Date(r.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            {r.guestName && ` • ${r.guestName}`}
                                                            {r.guestPhone && ` • ${r.guestPhone}`}
                                                        </div>
                                                    </div>
                                                    <ReservationBadge status={r.status} />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </GlassPanel>

                                {/* Activity Feed */}
                                <GlassPanel style={{ padding: '24px' }}>
                                    <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <ShoppingCart size={16} color="var(--primary)" /> Recent Payments
                                    </h3>
                                    {recentPayments.length === 0 ? (
                                        <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
                                            {currentShift ? 'No payments yet this shift' : 'Open a shift to track payments'}
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {recentPayments.map(p => (
                                                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                                                    <div>
                                                        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--primary)' }}>EGP {fmt(p.amount)}</div>
                                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.mode?.name ?? 'Cash'} • {p.referenceType}</div>
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                        {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </GlassPanel>

                            </div>
                        </div>
                    </>
                )}

                {activeTab === 'orders' && (
                    <OrdersPanel
                        orders={orders}
                        onApprove={id => void handleApproveOrder(id)}
                        onCancel={id => void handleCancelOrder(id)}
                        onNewOrder={() => setShowNewOrderModal(true)}
                        shiftOpen={!!currentShift}
                        page={ordersPage}
                        totalPages={ordersTotalPages}
                        total={ordersTotal}
                        pageSize={ORDERS_PAGE_SIZE}
                        statusFilter={ordersStatusFilter}
                        onPageChange={(p) => { setOrdersPage(p); void fetchOrders(p, ordersStatusFilter); }}
                        onStatusFilterChange={(s) => { setOrdersStatusFilter(s); setOrdersPage(0); void fetchOrders(0, s); }}
                    />
                )}
            </div>

            {/* Shift Report Print Only */}
            {isPrintingShiftReport && (
                <div className="print-only receipt-print-area" style={{ display: 'none' }}>
                    <h2 style={{ textAlign: 'center', margin: '0 0 10px 0', borderBottom: '1px dashed #000', paddingBottom: '10px', fontSize: '18px', fontWeight: '900' }}>SHIFT REPORT</h2>
                    <div style={{ marginBottom: '15px' }}>
                        <div><b>Date:</b> {new Date().toLocaleDateString()}</div>
                        <div><b>Staff:</b> {username}</div>
                        {currentShift && <div><b>Shift ID:</b> {currentShift.id.slice(0, 8)}</div>}
                        {currentShift && <div><b>Started:</b> {new Date(currentShift.startTime).toLocaleTimeString()}</div>}
                    </div>

                    <div style={{ borderTop: '1px dashed #000', paddingTop: '10px', marginBottom: '15px' }}>
                        <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>Payments Collected:</div>
                        {shiftStats?.paymentsByMode && shiftStats.paymentsByMode.length > 0 ? (
                            shiftStats.paymentsByMode.map(mode => (
                                <div key={mode.name} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span>{mode.name}</span>
                                    <span style={{ fontWeight: '600', fontFamily: 'monospace' }}>{fmt(mode.amount)}</span>
                                </div>
                            ))
                        ) : (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span>Cash</span>
                                    <span style={{ fontWeight: '600', fontFamily: 'monospace' }}>{fmt(shiftStats?.paymentsCash ?? 0)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span>Card</span>
                                    <span style={{ fontWeight: '600', fontFamily: 'monospace' }}>{fmt(shiftStats?.paymentsCard ?? 0)}</span>
                                </div>
                            </>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #000', fontWeight: 'bold' }}>
                            <span>Total Payments</span>
                            <span style={{ fontFamily: 'monospace' }}>{fmt((shiftStats?.paymentsByMode || []).reduce((sum, m) => sum + m.amount, 0) || (shiftStats?.paymentsCash || 0) + (shiftStats?.paymentsCard || 0))}</span>
                        </div>
                    </div>

                    {shiftStats?.expenses && shiftStats.expenses.length > 0 && (
                        <div style={{ borderTop: '1px dashed #000', paddingTop: '10px', marginBottom: '15px' }}>
                            <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>Expenses:</div>
                            {shiftStats.expenses.map((exp: any) => (
                                <div key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                                    <span>{exp.category} {exp.note ? `- ${exp.note}` : ''}</span>
                                    <span style={{ fontWeight: '600', fontFamily: 'monospace' }}>-{fmt(exp.amount)}</span>
                                </div>
                            ))}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #000', fontWeight: 'bold' }}>
                                <span>Total Expenses</span>
                                <span style={{ color: '#d32f2f', fontFamily: 'monospace' }}>-{fmt(shiftStats.expenses.reduce((sum: number, e: any) => sum + e.amount, 0))}</span>
                            </div>
                        </div>
                    )}

                    {shiftStats?.sessions && shiftStats.sessions.length > 0 && (
                        <div style={{ borderTop: '1px dashed #000', paddingTop: '10px', marginBottom: '15px' }}>
                            <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>Sessions Breakdown:</div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #000' }}>
                                        <th style={{ textAlign: 'left', padding: '4px 0' }}>Room</th>
                                        <th style={{ textAlign: 'center', padding: '4px 0' }}>Time</th>
                                        <th style={{ textAlign: 'right', padding: '4px 0' }}>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {shiftStats.sessions.map(s => (
                                        <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: '6px 0' }}>
                                                <div>{s.roomName}</div>
                                                <div style={{ fontSize: '9px', color: '#666' }}>{formatDate(s.startTime)} - {formatDate(s.endTime)}</div>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                {Math.round((new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 60000)}m
                                                {s.totalPausedMs > 0 && <span style={{ fontSize: '9px', color: 'var(--primary)' }}> (-{Math.round(s.totalPausedMs / 60000)}m)</span>}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: '600', fontFamily: 'monospace' }}>
                                                EGP {fmt(s.finalTotal)}
                                                {s.discount > 0 && <span style={{ fontSize: '9px', color: 'var(--primary)', display: 'block' }}>(-EGP {fmt(s.discount)})</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="receipt-print-total" style={{ borderTop: '2px solid #000', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
                        <span>TOTAL REVENUE:</span>
                        <span style={{ fontFamily: 'monospace' }}>{fmt(shiftStats?.totalRevenue || totalRevenue)}</span>
                    </div>

                    <div className="receipt-print-total" style={{ borderTop: '2px solid #000', marginTop: '10px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '900' }}>
                        <span>CASH ON HAND:</span>
                        <span style={{ fontFamily: 'monospace' }}>
                            {fmt(
                                (shiftStats?.paymentsByMode?.find(m => m.name.toLowerCase() === 'cash')?.amount || shiftStats?.paymentsCash || 0)
                                - (shiftStats?.expenses ? shiftStats.expenses.reduce((sum: number, e: any) => sum + e.amount, 0) : 0)
                            )}
                        </span>
                    </div>

                    <div style={{ marginTop: '30px', borderTop: '1px dashed #000', paddingTop: '15px', textAlign: 'center' }}>
                        Signature: _______________________
                    </div>
                </div>
            )}

            {/* Receipt / Checkout Modal */}
            {receiptRoom && receiptRoom.activeSession && (
                <ReceiptModal
                    sessionId={receiptRoom.activeSession.id!}
                    roomName={receiptRoom.name}
                    shiftId={currentShift?.id} // safely pass undefined when admins are just viewing
                    modes={paymentModes}
                    onConfirm={handleReceiptConfirm}
                    onClose={() => setReceiptRoom(null)}
                    onAddOrder={() => {
                        setReceiptRoom(null);
                        setOrderRoom(receiptRoom);
                        setShowNewOrderModal(true);
                    }}
                    isAdminViewing={!currentShift && (userRole === 'ADMIN' || userRole === 'admin')}
                    staffName={username}
                />
            )}

            {/* New Order Modal */}
            {showNewOrderModal && currentShift && (
                <NewOrderModal
                    shiftId={currentShift.id}
                    roomId={orderRoom?.id}
                    roomName={orderRoom?.name}
                    sessionId={orderRoom?.activeSession?.id}
                    modes={paymentModes}
                    onCreated={() => {
                        setShowNewOrderModal(false);
                        setOrderRoom(null);
                        void fetchOrders();
                        void fetchRoomStates();
                    }}
                    onClose={() => {
                        setShowNewOrderModal(false);
                        setOrderRoom(null);
                    }}
                />
            )}

        </div>
    );
};

export default StaffDashboard;
