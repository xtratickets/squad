import React from 'react';
import { Coffee, ReceiptText } from 'lucide-react';
import type { Shift, SessionDetail, SessionOrder } from '../../types';

interface ShiftReportProps {
    shift: Shift;
    mode?: 'display' | 'print';
    onViewSession?: (session: SessionDetail) => void;
    onViewOrder?: (order: SessionOrder) => void;
}

const ShiftReport: React.FC<ShiftReportProps> = ({
    shift,
    mode = 'display',
    onViewSession,
    onViewOrder
}) => {
    const formatCurrency = (val?: number) => `EGP ${(val || 0).toFixed(2)}`;

    const formatDuration = (start: string, end?: string) => {
        if (!end) return 'Active Now';
        const diffMs = new Date(end).getTime() - new Date(start).getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        return `${hours}h ${mins}m`;
    };

    if (mode === 'print') {
        const totalExpenses = shift.stats?.expenses?.reduce((sum: number, e: any) => sum + e.amount, 0) || 0;
        const totalPayments = (shift.paymentsByMode || []).reduce((sum, m) => sum + m.amount, 0) ||
            (shift.stats?.paymentsCash || 0) + (shift.stats?.paymentsCard || 0);

        return (
            <div className="print-only receipt-print-area" style={{ padding: '10px' }}>
                <h2 style={{ textAlign: 'center', margin: '0 0 10px 0', borderBottom: '1px dashed #000', paddingBottom: '10px', fontSize: '18px', fontWeight: '900' }}>SHIFT REPORT</h2>

                <div style={{ marginBottom: '15px', fontSize: '12px' }}>
                    <div><b>Date:</b> {new Date(shift.startTime).toLocaleDateString()}</div>
                    <div><b>Staff:</b> {shift.staff?.username}</div>
                    <div><b>Shift ID:</b> {shift.id.slice(0, 8)}</div>
                    <div><b>Started:</b> {new Date(shift.startTime).toLocaleTimeString()}</div>
                    {shift.endTime && <div><b>Closed:</b> {new Date(shift.endTime).toLocaleTimeString()}</div>}
                </div>

                {/* Sales Breakdown */}
                <div style={{ borderTop: '1px dashed #000', paddingTop: '10px', marginBottom: '15px' }}>
                    <div style={{ marginBottom: '8px', fontWeight: 'bold', fontSize: '13px' }}>Sales Breakdown:</div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                        <span>Sessions ({shift.openedSessions?.length || 0})</span>
                        <span style={{ fontWeight: '600' }}>{formatCurrency(shift.stats?.sessionsRevenue ?? 0)}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                        <span>Other Orders ({shift.orders?.length || 0})</span>
                        <span style={{ fontWeight: '600' }}>{formatCurrency(shift.stats?.ordersRevenue ?? 0)}</span>
                    </div>

                    {(shift.settlements?.length || 0) > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                            <span>Owner Settlements ({shift.settlements?.length})</span>
                            <span style={{ fontWeight: '600' }}>{formatCurrency(shift.settlements?.reduce((sum, s) => sum + s.amount, 0))}</span>
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                        <span>Service Fees</span>
                        <span style={{ fontWeight: '600' }}>+{formatCurrency(shift.stats?.totalServiceFees ?? 0)}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                        <span>Tax</span>
                        <span style={{ fontWeight: '600' }}>+{formatCurrency(shift.stats?.totalTax ?? 0)}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                        <span>Discounts</span>
                        <span style={{ fontWeight: '600', color: '#000' }}>-{formatCurrency(shift.stats?.totalDiscounts ?? 0)}</span>
                    </div>
                </div>

                {/* Collections Breakdown */}
                <div style={{ borderTop: '1px dashed #000', paddingTop: '10px', marginBottom: '15px' }}>
                    <div style={{ marginBottom: '8px', fontWeight: 'bold', fontSize: '13px' }}>Collections by Mode:</div>
                    {shift.paymentsByMode && shift.paymentsByMode.length > 0 ? (
                        shift.paymentsByMode.map(mode => (
                            <div key={mode.name} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                                <span>{mode.name}</span>
                                <span style={{ fontWeight: '600' }}>{formatCurrency(mode.amount)}</span>
                            </div>
                        ))
                    ) : (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                                <span>Cash</span>
                                <span style={{ fontWeight: '600' }}>{formatCurrency(shift.stats?.paymentsCash ?? 0)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                                <span>Card</span>
                                <span style={{ fontWeight: '600' }}>{formatCurrency(shift.stats?.paymentsCard ?? 0)}</span>
                            </div>
                        </>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #000', fontWeight: 'bold', fontSize: '13px' }}>
                        <span>Total Collected</span>
                        <span>{formatCurrency(totalPayments)}</span>
                    </div>
                </div>

                {/* Tips */}
                {shift.stats?.tipsTotal !== undefined && shift.stats.tipsTotal > 0 && (
                    <div style={{ borderTop: '1px dashed #000', paddingTop: '10px', marginBottom: '15px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '12px' }}>
                            <span>Tips Total:</span>
                            <span>{formatCurrency(shift.stats.tipsTotal)}</span>
                        </div>
                    </div>
                )}

                {/* Expenses */}
                {shift.stats?.expenses && shift.stats.expenses.length > 0 && (
                    <div style={{ borderTop: '1px dashed #000', paddingTop: '10px', marginBottom: '15px' }}>
                        <div style={{ marginBottom: '8px', fontWeight: 'bold', fontSize: '13px' }}>Expenses Details:</div>
                        {shift.stats.expenses.map((exp: any) => (
                            <div key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px' }}>
                                <span>{exp.category} {exp.note ? `- ${exp.note}` : ''}</span>
                                <span style={{ fontWeight: '600' }}>-{formatCurrency(exp.amount)}</span>
                            </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #000', fontWeight: 'bold', fontSize: '13px' }}>
                            <span>Total Expenses</span>
                            <span>-{formatCurrency(totalExpenses)}</span>
                        </div>
                    </div>
                )}

                {/* Net Cash */}
                <div style={{ borderTop: '2px solid #000', padding: '10px 0', marginTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: '900' }}>
                        <span>CASH ON HAND:</span>
                        <span>
                            {formatCurrency(
                                (shift.paymentsByMode?.find(m => m.name.toLowerCase() === 'cash')?.amount || shift.stats?.paymentsCash || 0)
                                - totalExpenses
                            )}
                        </span>
                    </div>
                </div>

                <div style={{ marginTop: '30px', borderTop: '1px dashed #000', paddingTop: '15px', textAlign: 'center', fontSize: '12px' }}>
                    Signature: _______________________
                </div>
                <div style={{ marginTop: '30px', borderTop: '1px dashed #000', paddingTop: '15px', textAlign: 'center', fontSize: '8px', color: '#777' }}>
                    Powered by XTRA
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
                {/* Sessions */}
                <div>
                    <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Coffee size={14} /> Sessions ({shift.openedSessions?.length || 0})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {shift.openedSessions && shift.openedSessions.length > 0 ? (
                            shift.openedSessions.map(s => (
                                <div
                                    key={s.id}
                                    onClick={() => onViewSession?.(s)}
                                    style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: onViewSession ? 'pointer' : 'default', transition: 'background 0.2s' }}
                                    onMouseEnter={e => { if (onViewSession) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                                    onMouseLeave={e => { if (onViewSession) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                                >
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
                                <div
                                    key={o.id}
                                    onClick={() => onViewOrder?.(o)}
                                    style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: onViewOrder ? 'pointer' : 'default', transition: 'background 0.2s' }}
                                    onMouseEnter={e => { if (onViewOrder) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                                    onMouseLeave={e => { if (onViewOrder) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                                >
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

                {/* Owner Settlements */}
                {(shift.settlements?.length || 0) > 0 && (
                    <div>
                        <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ReceiptText size={14} /> Settlements ({shift.settlements?.length})
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {shift.settlements?.map(s => (
                                <div key={s.id} style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: '13px', fontWeight: '600' }}>{s.ownerName}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                            {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {s.mode?.name || 'CASH'}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--primary)' }}>
                                        {formatCurrency(s.amount)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ShiftReport;
