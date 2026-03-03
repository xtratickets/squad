import React, { useState, useEffect } from 'react';
import GlassPanel from '../components/common/GlassPanel';
import { adminService } from '../services/admin.service';
import { History, Calendar, Clock, ChevronDown, ChevronUp, Coffee, ReceiptText, Printer, X, Edit3, Check } from 'lucide-react';
import type { Shift, User, SessionDetail, SessionOrder } from '../types';
import api from '../services/api';
import toast from 'react-hot-toast';

// ─── Inline Payments Editor ─────────────────────────────────────────────────

interface PaymentsEditorProps {
    payments: any[];
    onUpdated: () => void;
}

const PaymentsEditor: React.FC<PaymentsEditorProps> = ({ payments, onUpdated }) => {
    const [modes, setModes] = useState<any[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [selectedModeId, setSelectedModeId] = useState('');
    const [saving, setSaving] = useState(false);
    // Local state so we can show updated name immediately
    const [localPayments, setLocalPayments] = useState(payments);

    useEffect(() => {
        api.get('/payments/modes').then(r => setModes(r.data ?? [])).catch(() => { });
    }, []);

    const startEdit = (p: any) => {
        setEditingId(p.id);
        setSelectedModeId(p.modeId ?? '');
    };

    const save = async (p: any) => {
        setSaving(true);
        try {
            await api.patch(`/payments/${p.id}`, { modeId: selectedModeId });
            const updatedMode = modes.find(m => m.id === selectedModeId);
            setLocalPayments(prev => prev.map(lp => lp.id === p.id
                ? { ...lp, modeId: selectedModeId, mode: updatedMode ?? lp.mode }
                : lp
            ));
            setEditingId(null);
            toast.success('Payment mode updated');
            onUpdated();
        } catch {
            toast.error('Failed to update payment mode');
        } finally {
            setSaving(false);
        }
    };

    const formatCurrency = (v?: number) => `EGP ${(v || 0).toFixed(2)}`;

    return (
        <div style={{ marginBottom: '24px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' as const, marginBottom: '12px', fontWeight: 'bold' }}>
                Payments Collected
            </div>
            {localPayments.map((p, i) => (
                <div key={p.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                        {editingId === p.id ? (
                            <>
                                <select
                                    value={selectedModeId}
                                    onChange={e => setSelectedModeId(e.target.value)}
                                    style={{ background: 'rgba(0,0,0,0.4)', color: 'white', border: '1px solid var(--primary)', borderRadius: '8px', padding: '4px 10px', fontSize: '13px' }}
                                >
                                    {modes.map(m => <option key={m.id} value={m.id} style={{ background: '#111' }}>{m.name}</option>)}
                                </select>
                                <button
                                    onClick={() => save(p)}
                                    disabled={saving}
                                    style={{ background: 'rgba(0,230,118,0.15)', border: '1px solid var(--primary)', color: 'var(--primary)', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
                                >
                                    <Check size={12} /> Save
                                </button>
                                <button
                                    onClick={() => setEditingId(null)}
                                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '3px' }}
                                >
                                    <X size={14} />
                                </button>
                            </>
                        ) : (
                            <>
                                <span>{p.mode?.name || 'Unknown'}</span>
                                {p.receiptUrl && (
                                    <a href={p.receiptUrl} target="_blank" rel="noreferrer" title="View Receipt" style={{ display: 'flex', alignItems: 'center' }}>
                                        <img src={p.receiptUrl} alt="Receipt" style={{ height: '24px', width: '24px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border)' }} />
                                    </a>
                                )}
                                <button
                                    onClick={() => startEdit(p)}
                                    title="Change payment mode"
                                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', opacity: 0.6, transition: 'opacity 0.2s' }}
                                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
                                >
                                    <Edit3 size={13} />
                                </button>
                            </>
                        )}
                    </div>
                    <span style={{ fontWeight: '600' }}>{formatCurrency(p.amount)}</span>
                </div>
            ))}
        </div>
    );
};

// ────────────────────────────────────────────────────────────────────────────

interface ShiftHistoryViewProps {
    user: User | null;
}

const ShiftHistoryView: React.FC<ShiftHistoryViewProps> = ({ user }) => {
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedShifts, setExpandedShifts] = useState<Record<string, boolean>>({});
    const [printingShift, setPrintingShift] = useState<Shift | null>(null);
    const [viewSession, setViewSession] = useState<SessionDetail | null>(null);
    const [viewOrder, setViewOrder] = useState<SessionOrder | null>(null);

    const printShift = (e: React.MouseEvent, shift: Shift) => {
        e.stopPropagation(); // prevent toggleExpand
        setPrintingShift(shift);
        setTimeout(() => window.print(), 100);
    };

    useEffect(() => {
        const fetchShifts = async () => {
            setLoading(true);
            try {
                const res = await adminService.getShiftHistory();
                const myShifts = res.data.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
                setShifts(myShifts);
                // Expand the first shift by default if it's open
                if (myShifts.length > 0 && myShifts[0].status === 'open') {
                    setExpandedShifts({ [myShifts[0].id]: true });
                }
            } catch (err) {
                console.error('Failed to load shift history', err);
            } finally {
                setLoading(false);
            }
        };
        if (user) {
            void fetchShifts();
        }
    }, [user]);

    const toggleExpand = (id: string) => {
        setExpandedShifts(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const formatCurrency = (val?: number) => `EGP ${(val || 0).toFixed(2)}`;

    const formatDuration = (start: string, end?: string) => {
        if (!end) return 'Active Now';
        const diffMs = new Date(end).getTime() - new Date(start).getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        return `${hours}h ${mins}m`;
    };

    return (
        <div style={{ height: 'calc(100vh - 180px)', display: 'flex', flexDirection: 'column' }}>
            <GlassPanel className="no-print" style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <History size={24} color="var(--primary)" />
                        Detailed Shift History
                    </h2>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
                    {loading && shifts.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>Loading history...</div>
                    ) : shifts.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>No shifts found.</div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '16px' }}>
                            {shifts.map(shift => {
                                const isExpanded = !!expandedShifts[shift.id];
                                const totalRevenue = shift.stats?.totalRevenue ?? (shift.paymentsByMode ? shift.paymentsByMode.reduce((sum, p) => sum + p.amount, 0) : ((shift.stats?.paymentsCash || 0) + (shift.stats?.paymentsCard || 0) + (shift.stats?.paymentsWallet || 0)));

                                return (
                                    <div key={shift.id} style={{
                                        borderRadius: '16px',
                                        background: 'rgba(255,255,255,0.02)',
                                        border: `1px solid ${shift.status === 'open' ? 'var(--primary)' : 'var(--border)'}`,
                                        overflow: 'hidden',
                                        transition: 'all 0.3s ease'
                                    }}>
                                        {/* Header */}
                                        <div
                                            onClick={() => toggleExpand(shift.id)}
                                            style={{
                                                padding: '24px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                background: isExpanded ? 'rgba(255,255,255,0.03)' : 'transparent'
                                            }}
                                        >
                                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                                <div style={{
                                                    width: '48px',
                                                    height: '48px',
                                                    borderRadius: '12px',
                                                    background: shift.status === 'open' ? 'rgba(0,230,118,0.1)' : 'rgba(255,255,255,0.05)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    <Calendar size={20} color={shift.status === 'open' ? 'var(--primary)' : 'var(--text-muted)'} />
                                                </div>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                        <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
                                                            {new Date(shift.startTime).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                                        </span>
                                                        {shift.status === 'open' && (
                                                            <span style={{ fontSize: '10px', padding: '2px 8px', background: 'rgba(0,230,118,0.1)', color: 'var(--primary)', borderRadius: '10px', fontWeight: 'bold' }}>Active</span>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                                        <Clock size={12} />
                                                        <span>{new Date(shift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        <span>→</span>
                                                        <span>{shift.endTime ? new Date(shift.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Ongoing'}</span>
                                                        <span style={{ margin: '0 4px' }}>•</span>
                                                        <span>{formatDuration(shift.startTime, shift.endTime)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
                                                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                    <div>
                                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Total Revenue</div>
                                                        <div style={{ fontSize: '20px', fontWeight: '800', color: shift.status === 'open' ? 'var(--primary)' : 'var(--text)' }}>
                                                            {formatCurrency(totalRevenue)}
                                                        </div>
                                                    </div>
                                                    {isExpanded && (
                                                        <button
                                                            onClick={(e) => printShift(e, shift)}
                                                            title="Print Shift Report"
                                                            style={{
                                                                background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                                                                color: 'var(--text)', padding: '8px', borderRadius: '8px', cursor: 'pointer',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                            }}>
                                                            <Printer size={18} />
                                                        </button>
                                                    )}
                                                </div>
                                                {isExpanded ? <ChevronUp size={20} color="var(--text-muted)" /> : <ChevronDown size={20} color="var(--text-muted)" />}
                                            </div>
                                        </div>

                                        {/* Content */}
                                        {isExpanded && (
                                            <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                                {/* Stats Grid */}
                                                <div style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                                                    gap: '12px',
                                                    padding: '16px',
                                                    background: 'rgba(0,0,0,0.15)',
                                                    borderRadius: '12px'
                                                }}>
                                                    {shift.paymentsByMode && shift.paymentsByMode.length > 0 ? (
                                                        <>
                                                            {shift.paymentsByMode.map((mode, i) => (
                                                                <div key={mode.name}>
                                                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>{mode.name}</div>
                                                                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: ['#00e676', '#ffab00', '#2979ff', '#e040fb', '#18ffff'][i % 5] }}>{formatCurrency(mode.amount)}</div>
                                                                </div>
                                                            ))}
                                                            <div>
                                                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>Total Payments</div>
                                                                <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text)' }}>
                                                                    {formatCurrency(shift.paymentsByMode.reduce((sum, p) => sum + p.amount, 0))}
                                                                </div>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div>
                                                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>Cash</div>
                                                                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#00e676' }}>{formatCurrency(shift.stats?.paymentsCash)}</div>
                                                            </div>
                                                            <div>
                                                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>Card</div>
                                                                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#ffab00' }}>{formatCurrency(shift.stats?.paymentsCard)}</div>
                                                            </div>
                                                            <div>
                                                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>Wallet</div>
                                                                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#2979ff' }}>{formatCurrency(shift.stats?.paymentsWallet)}</div>
                                                            </div>
                                                        </>
                                                    )}

                                                    {shift.stats?.expenses && shift.stats.expenses.length > 0 && (
                                                        <>
                                                            <div>
                                                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>Expenses</div>
                                                                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#d32f2f' }}>
                                                                    -{formatCurrency(shift.stats.expenses.reduce((s: number, e: any) => s + e.amount, 0))}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>Cash on Hand</div>
                                                                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#00b0ff' }}>
                                                                    {formatCurrency(
                                                                        (shift.paymentsByMode?.find(m => m.name.toLowerCase() === 'cash')?.amount || shift.stats?.paymentsCash || 0)
                                                                        - shift.stats.expenses.reduce((s: number, e: any) => s + e.amount, 0)
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                                    {/* Sessions */}
                                                    <div>
                                                        <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <Coffee size={14} /> Sessions ({shift.openedSessions?.length || 0})
                                                        </h4>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                            {shift.openedSessions && shift.openedSessions.length > 0 ? (
                                                                shift.openedSessions.map(s => (
                                                                    <div key={s.id} onClick={() => setViewSession(s)} style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}>
                                                                        <div>
                                                                            <div style={{ fontSize: '13px', fontWeight: '600' }}>{s.room.name}</div>
                                                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                <span>{s.status.toUpperCase()} • {formatDuration(s.startTime, s.endTime)}</span>
                                                                                {(s.sessionCharge as any)?.discount > 0 && (
                                                                                    <span style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', fontSize: '10px', padding: '1px 6px', borderRadius: '6px', fontWeight: 700 }}>
                                                                                        -{formatCurrency((s.sessionCharge as any).discount)}
                                                                                    </span>
                                                                                )}
                                                                                {(s.sessionCharge as any)?.promoCode && (
                                                                                    <span style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa', fontSize: '10px', padding: '1px 6px', borderRadius: '6px', fontWeight: 700 }}>
                                                                                        {(s.sessionCharge as any).promoCode}
                                                                                    </span>
                                                                                )}
                                                                                {(s.sessionCharge as any)?.tip > 0 && (
                                                                                    <span style={{ background: 'rgba(0,230,118,0.12)', color: 'var(--primary)', fontSize: '10px', padding: '1px 6px', borderRadius: '6px', fontWeight: 700 }}>
                                                                                        +{formatCurrency((s.sessionCharge as any).tip)}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        <div style={{ textAlign: 'right' }}>
                                                                            {(s.sessionCharge as any)?.discount > 0 && (
                                                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                                                                                    After Disc: {formatCurrency(((s.sessionCharge as any).itemsTotal || (s.sessionCharge as any).roomAmount + (s.sessionCharge as any).ordersAmount) - (s.sessionCharge as any).discount)}
                                                                                </div>
                                                                            )}
                                                                            <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--primary)' }}>
                                                                                {formatCurrency(s.sessionCharge?.finalTotal)}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '10px' }}>No sessions recorded.</div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Standalone Orders */}
                                                    <div>
                                                        <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <ReceiptText size={14} /> Other Orders ({shift.orders?.length || 0})
                                                        </h4>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                            {shift.orders && shift.orders.length > 0 ? (
                                                                shift.orders.map(o => (
                                                                    <div key={o.id} onClick={() => setViewOrder(o)} style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}>
                                                                        <div>
                                                                            <div style={{ fontSize: '13px', fontWeight: '600' }}>{o.type === 'owner' ? 'Owner Order' : 'Walk-in Order'}</div>
                                                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                                                {o.items?.map(i => `${i.qty}x ${i.product?.name || 'Item'}`).join(', ')}
                                                                            </div>
                                                                        </div>
                                                                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--primary)' }}>
                                                                            {formatCurrency(o.orderCharge?.finalTotal)}
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '10px' }}>No direct orders recorded.</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </GlassPanel>

            {/* Print Section for Shift History */}
            {printingShift && (
                <div className="print-only receipt-print-area" style={{ display: 'none' }}>
                    <h2 style={{ textAlign: 'center', margin: '0 0 10px 0', borderBottom: '1px dashed #000', paddingBottom: '10px', fontSize: '18px', fontWeight: '900' }}>SHIFT REPORT</h2>
                    <div style={{ marginBottom: '15px' }}>
                        <div><b>Date:</b> {new Date(printingShift.startTime).toLocaleDateString()}</div>
                        <div><b>Shift ID:</b> {printingShift.id.slice(0, 8)}</div>
                        <div><b>Started:</b> {new Date(printingShift.startTime).toLocaleTimeString()}</div>
                        {printingShift.endTime && <div><b>Closed:</b> {new Date(printingShift.endTime).toLocaleTimeString()}</div>}
                    </div>

                    <div style={{ borderTop: '1px dashed #000', paddingTop: '10px', marginBottom: '15px' }}>
                        <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>Payments Collected:</div>
                        {printingShift.paymentsByMode && printingShift.paymentsByMode.length > 0 ? (
                            printingShift.paymentsByMode.map((mode: any) => (
                                <div key={mode.name} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span>{mode.name}</span>
                                    <span style={{ fontWeight: '600' }}>{formatCurrency(mode.amount)}</span>
                                </div>
                            ))
                        ) : (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span>Cash</span>
                                    <span style={{ fontWeight: '600' }}>{formatCurrency(printingShift.stats?.paymentsCash ?? 0)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span>Card</span>
                                    <span style={{ fontWeight: '600' }}>{formatCurrency(printingShift.stats?.paymentsCard ?? 0)}</span>
                                </div>
                            </>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #000', fontWeight: 'bold' }}>
                            <span>Total Payments</span>
                            <span>{formatCurrency((printingShift.paymentsByMode || []).reduce((sum, m) => sum + m.amount, 0) || (printingShift.stats?.paymentsCash || 0) + (printingShift.stats?.paymentsCard || 0))}</span>
                        </div>
                    </div>

                    {printingShift.stats?.expenses && printingShift.stats.expenses.length > 0 && (
                        <div style={{ borderTop: '1px dashed #000', paddingTop: '10px', marginBottom: '15px' }}>
                            <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>Expenses:</div>
                            {printingShift.stats.expenses.map((exp: any) => (
                                <div key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                                    <span>{exp.category} {exp.note ? `- ${exp.note}` : ''}</span>
                                    <span style={{ fontWeight: '600' }}>-{formatCurrency(exp.amount)}</span>
                                </div>
                            ))}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #000', fontWeight: 'bold' }}>
                                <span>Total Expenses</span>
                                <span style={{ color: '#d32f2f' }}>-{formatCurrency(printingShift.stats.expenses.reduce((sum: number, e: any) => sum + e.amount, 0))}</span>
                            </div>
                        </div>
                    )}

                    <div className="receipt-print-total" style={{ borderTop: '2px solid #000', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
                        <span>TOTAL REVENUE:</span>
                        <span>{formatCurrency(printingShift.stats?.totalRevenue ||
                            (printingShift.paymentsByMode ? printingShift.paymentsByMode.reduce((sum: number, p: any) => sum + p.amount, 0) : ((printingShift.stats?.paymentsCash || 0) + (printingShift.stats?.paymentsCard || 0) + (printingShift.stats?.paymentsWallet || 0)))
                        )}</span>
                    </div>

                    <div className="receipt-print-total" style={{ borderTop: '2px solid #000', marginTop: '10px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '900' }}>
                        <span>CASH ON HAND:</span>
                        <span>
                            {formatCurrency(
                                (printingShift.paymentsByMode?.find(m => m.name.toLowerCase() === 'cash')?.amount || printingShift.stats?.paymentsCash || 0)
                                - (printingShift.stats?.expenses ? printingShift.stats.expenses.reduce((sum: number, e: any) => sum + e.amount, 0) : 0)
                            )}
                        </span>
                    </div>

                    <div style={{ marginTop: '30px', borderTop: '1px dashed #000', paddingTop: '15px', textAlign: 'center' }}>
                        Signature: _______________________
                    </div>
                </div>
            )}

            {/* Session Details Modal */}
            {viewSession && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setViewSession(null)}>
                    <GlassPanel style={{ width: '100%', maxWidth: '600px', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}><Coffee size={20} color="var(--primary)" /> Session: {viewSession.room.name}</h3>
                            <button onClick={() => setViewSession(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={24} /></button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px', fontSize: '14px' }}>
                            <div><b>Start:</b> {new Date(viewSession.startTime).toLocaleString()}</div>
                            <div><b>End:</b> {viewSession.endTime ? new Date(viewSession.endTime).toLocaleString() : 'Active'}</div>
                            <div><b>Status:</b> <span style={{ padding: '2px 8px', borderRadius: '4px', background: viewSession.status === 'active' ? 'rgba(0,230,118,0.1)' : 'rgba(255,255,255,0.05)', color: viewSession.status === 'active' ? 'var(--primary)' : 'var(--text)', fontSize: '12px', fontWeight: 'bold' }}>{viewSession.status.toUpperCase()}</span></div>
                            <div><b>Total Charge:</b> <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{formatCurrency(viewSession.sessionCharge?.finalTotal)}</span></div>
                        </div>

                        {/* Charge Breakdown — shows when discount, tip, or promo code is present */}
                        {viewSession.sessionCharge && (
                            (viewSession.sessionCharge as any).discount > 0 ||
                            (viewSession.sessionCharge as any).tip > 0 ||
                            (viewSession.sessionCharge as any).promoCode ||
                            ((viewSession.sessionCharge as any).serviceFee || 0) > 0 ||
                            ((viewSession.sessionCharge as any).tax || 0) > 0
                        ) && (
                                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', marginBottom: '20px', fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px' }}>Charge Breakdown</div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>Subtotal (Room + Orders)</span>
                                        <span>{formatCurrency(((viewSession.sessionCharge as any).roomAmount || 0) + ((viewSession.sessionCharge as any).ordersAmount || 0))}</span>
                                    </div>

                                    {(viewSession.sessionCharge as any).promoCode && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Promo Code</span>
                                            <span style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa', fontSize: '11px', padding: '2px 10px', borderRadius: '8px', fontWeight: 700 }}>
                                                {(viewSession.sessionCharge as any).promoCode}
                                            </span>
                                        </div>
                                    )}

                                    {((viewSession.sessionCharge as any).discount > 0 || (viewSession.sessionCharge as any).promoCode) && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', fontSize: '11px', padding: '1px 8px', borderRadius: '8px', fontWeight: 700 }}>DISCOUNT</span>
                                            </span>
                                            <span style={{ color: '#f87171', fontWeight: 600 }}>-{formatCurrency((viewSession.sessionCharge as any).discount || 0)}</span>
                                        </div>
                                    )}

                                    {((viewSession.sessionCharge as any).serviceFee || 0) > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>Service Fee</span>
                                            <span>{formatCurrency((viewSession.sessionCharge as any).serviceFee)}</span>
                                        </div>
                                    )}

                                    {((viewSession.sessionCharge as any).tax || 0) > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>Tax</span>
                                            <span>{formatCurrency((viewSession.sessionCharge as any).tax)}</span>
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ background: 'rgba(0,230,118,0.12)', color: 'var(--primary)', fontSize: '11px', padding: '1px 8px', borderRadius: '8px', fontWeight: 700 }}>TIP</span>
                                        </span>
                                        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>+{formatCurrency((viewSession.sessionCharge as any).tip || 0)}</span>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '8px', fontWeight: 700 }}>
                                        <span>Final Total</span>
                                        <span style={{ color: 'var(--primary)' }}>{formatCurrency(viewSession.sessionCharge?.finalTotal)}</span>
                                    </div>
                                </div>
                            )}

                        {viewSession.payments && viewSession.payments.length > 0 && (
                            <PaymentsEditor payments={viewSession.payments} onUpdated={() => {
                                // Re-fetch the session to show updated mode
                                setViewSession((prev: any) => prev ? { ...prev } : null);
                            }} />
                        )}

                        {viewSession.orders && viewSession.orders.length > 0 && (
                            <div>
                                <h4 style={{ fontSize: '14px', marginBottom: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>Associated Orders</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {viewSession.orders.map(o => (
                                        <div key={o.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                                <span>{new Date(o.createdAt).toLocaleTimeString()}</span>
                                                <span style={{ fontWeight: 'bold', color: o.status === 'approved' ? 'var(--primary)' : 'var(--text)' }}>{o.status.toUpperCase()}</span>
                                            </div>
                                            {o.items?.map(i => (
                                                <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '6px' }}>
                                                    <span><span style={{ color: 'var(--text-muted)', marginRight: '8px' }}>{i.qty}x</span> {i.product?.name}</span>
                                                    <span style={{ fontWeight: '600' }}>{formatCurrency(i.total)}</span>
                                                </div>
                                            ))}
                                            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
                                                <span>Subtotal</span>
                                                <span>{formatCurrency(o.orderCharge?.finalTotal ?? 0)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {(!viewSession.orders || viewSession.orders.length === 0) && (
                            <div style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>No orders attached to this session.</div>
                        )}
                    </GlassPanel>
                </div>
            )}

            {/* Order Details Modal */}
            {viewOrder && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setViewOrder(null)}>
                    <GlassPanel style={{ width: '100%', maxWidth: '500px', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}><ReceiptText size={20} color="var(--primary)" /> Order Details</h3>
                            <button onClick={() => setViewOrder(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={24} /></button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px', fontSize: '14px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Date:</span> <b>{new Date(viewOrder.createdAt).toLocaleString()}</b>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Type:</span> <b>{viewOrder.type === 'owner' ? 'Owner Order' : 'Walk-in Order'}</b>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Status:</span> <b style={{ color: viewOrder.status === 'approved' ? 'var(--primary)' : 'inherit' }}>{viewOrder.status.toUpperCase()}</b>
                            </div>
                        </div>

                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginBottom: '16px' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', fontWeight: 'bold' }}>Items</div>
                            {viewOrder.items?.map(i => (
                                <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '16px' }}>
                                    <div>
                                        <div style={{ fontWeight: '600' }}>{i.product?.name}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{i.qty}x @ {formatCurrency(i.unitPrice)}</div>
                                    </div>
                                    <div style={{ fontWeight: 'bold' }}>{formatCurrency(i.total)}</div>
                                </div>
                            ))}
                        </div>

                        <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: '800', color: 'var(--primary)', background: 'rgba(0,230,118,0.05)', padding: '16px', borderRadius: '8px', margin: '0 -8px' }}>
                            <span>Total Charge:</span>
                            <span>{formatCurrency(viewOrder.orderCharge?.finalTotal)}</span>
                        </div>
                    </GlassPanel>
                </div>
            )}
        </div>
    );
};

export default ShiftHistoryView;
