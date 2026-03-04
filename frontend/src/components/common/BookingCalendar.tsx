import React, { useMemo, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, CheckCircle, XCircle, Trash2, X, Clock, User, Phone, FileText, Home } from 'lucide-react';
import type { Reservation, Room } from '../../types';
import Button from './Button';

interface BookingCalendarProps {
    reservations: Reservation[];
    rooms: Room[];
    currentDate?: Date;
    onDateChange?: (date: Date) => void;
    onAction?: (action: 'confirm' | 'cancel' | 'delete' | 'checkin', res: Reservation) => void;
    isAdmin?: boolean;
    isGuest?: boolean;
}

const statusColors: Record<string, { bg: string; border: string; text: string }> = {
    pending: { bg: 'rgba(255,171,0,0.2)', border: 'rgba(255,171,0,0.5)', text: '#ffc400' },
    confirmed: { bg: 'rgba(41,121,255,0.2)', border: 'rgba(41,121,255,0.5)', text: '#82b1ff' },
    checked_in: { bg: 'rgba(0,230,118,0.2)', border: 'rgba(0,230,118,0.5)', text: '#69f0ae' },
    cancelled: { bg: 'rgba(255,82,82,0.1)', border: 'rgba(255,82,82,0.3)', text: 'var(--danger)' },
};

// ─── Detail Dialog ────────────────────────────────────────────────────────────
const DetailDialog: React.FC<{
    res: Reservation;
    onClose: () => void;
    onAction?: (action: 'confirm' | 'cancel' | 'delete' | 'checkin', res: Reservation) => void;
    isAdmin?: boolean;
}> = ({ res, onClose, onAction, isAdmin }) => {
    const colors = statusColors[res.status] ?? statusColors.pending;
    const start = new Date(res.startTime);
    const end = res.endTime ? new Date(res.endTime) : null;

    const fmt = (d: Date) => d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
    const duration = end
        ? (() => {
            const mins = Math.round((end.getTime() - start.getTime()) / 60000);
            if (mins < 60) return `${mins}m`;
            const h = Math.floor(mins / 60);
            const m = mins % 60;
            return m === 0 ? `${h}h` : `${h}h ${m}m`;
        })()
        : 'Open-ended';

    return (
        <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: '20px' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div style={{ background: 'var(--surface)', border: `1px solid ${colors.border}`, borderRadius: '16px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', boxShadow: `0 8px 48px rgba(0,0,0,0.5), 0 0 0 1px ${colors.border}` }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', background: colors.bg, borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 1, backdropFilter: 'blur(10px)' }}>
                    <div>
                        <div style={{ fontSize: '11px', color: colors.text, fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '4px' }}>
                            {res.status.replace('_', ' ')}
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text)' }}>
                            Reservation Details
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '8px', padding: '8px', cursor: 'pointer', color: 'var(--text)', display: 'flex', alignItems: 'center' }}>
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Room */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                        <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }}>
                            <Home size={16} color="var(--primary)" />
                        </div>
                        <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>Room</div>
                            <div style={{ fontSize: '15px', fontWeight: '600' }}>
                                {(res as any).room?.name || 'Unknown Room'}
                            </div>
                        </div>
                    </div>

                    {/* Times */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                        <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }}>
                            <Clock size={16} color={colors.text} />
                        </div>
                        <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>Time</div>
                            <div style={{ fontSize: '14px', fontWeight: '600' }}>
                                {fmt(start)} → {end ? fmt(end) : <span style={{ color: colors.text }}>Open-ended (??:??)</span>}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Duration: {duration}</div>
                        </div>
                    </div>

                    {/* Guest Name */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                        <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }}>
                            <User size={16} color="var(--text-muted)" />
                        </div>
                        <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>Guest Name</div>
                            <div style={{ fontSize: '15px', fontWeight: '600', color: (res as any).guestName ? 'var(--text)' : 'var(--text-muted)' }}>
                                {(res as any).guestName || 'Not provided'}
                            </div>
                        </div>
                    </div>

                    {/* Guest Phone */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                        <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }}>
                            <Phone size={16} color="var(--text-muted)" />
                        </div>
                        <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>Phone</div>
                            <div style={{ fontSize: '15px', fontWeight: '600', color: (res as any).guestPhone ? 'var(--text)' : 'var(--text-muted)' }}>
                                {(res as any).guestPhone || 'Not provided'}
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    {(res as any).note && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }}>
                                <FileText size={16} color="var(--text-muted)" />
                            </div>
                            <div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>Notes</div>
                                <div style={{ fontSize: '14px', lineHeight: 1.5, color: 'var(--text)' }}>{(res as any).note}</div>
                            </div>
                        </div>
                    )}

                    {/* Created By */}
                    {res.createdBy && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }}>
                                <User size={16} color="var(--primary)" />
                            </div>
                            <div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>Created By</div>
                                <div style={{ fontSize: '14px', fontWeight: '600' }}>{res.createdBy.username}</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions */}
                {onAction && res.status !== 'cancelled' && (
                    <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: '10px', flexWrap: 'wrap', position: 'sticky', bottom: 0, background: 'var(--surface)', zIndex: 1 }}>
                        {res.status === 'pending' && (
                            <>
                                <Button
                                    icon={<CheckCircle size={15} />}
                                    onClick={() => { onAction('confirm', res); onClose(); }}
                                    style={{ flex: 1 }}
                                >
                                    Confirm
                                </Button>
                                <Button
                                    variant="secondary"
                                    icon={<XCircle size={15} />}
                                    onClick={() => { onAction('cancel', res); onClose(); }}
                                    style={{ flex: 1, color: 'var(--danger)' }}
                                >
                                    Cancel
                                </Button>
                            </>
                        )}
                        {res.status === 'confirmed' && (
                            <>
                                <Button
                                    icon={<CheckCircle size={15} />}
                                    onClick={() => { onAction?.('checkin', res); onClose(); }}
                                    style={{ flex: 1 }}
                                >
                                    Check-in
                                </Button>
                                <Button
                                    variant="secondary"
                                    icon={<XCircle size={15} />}
                                    onClick={() => { onAction?.('cancel', res); onClose(); }}
                                    style={{ flex: 1, color: 'var(--danger)' }}
                                >
                                    Cancel Reservation
                                </Button>
                            </>
                        )}
                        {isAdmin && (
                            <Button
                                variant="secondary"
                                icon={<Trash2 size={15} />}
                                onClick={() => { onAction('delete', res); onClose(); }}
                                style={{ color: 'var(--danger)', flexShrink: 0 }}
                            >
                                Delete
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Main Calendar ────────────────────────────────────────────────────────────

export const BookingCalendar: React.FC<BookingCalendarProps> = ({
    reservations,
    rooms,
    currentDate = new Date(),
    onDateChange,
    onAction,
    isAdmin = false,
    isGuest = false,
}) => {
    const [selectedRes, setSelectedRes] = useState<Reservation | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const HOUR_WIDTH = isMobile ? 80 : 100; // px per hour
    const ROOM_COL_WIDTH = isMobile ? 100 : 150;
    const HOURS_IN_DAY = 24;

    const startOfDay = useMemo(() => {
        const d = new Date(currentDate);
        d.setHours(0, 0, 0, 0);
        return d;
    }, [currentDate]);

    const endOfDay = useMemo(() => {
        const d = new Date(currentDate);
        d.setHours(23, 59, 59, 999);
        return d;
    }, [currentDate]);

    const dailyReservations = useMemo(() => {
        return (reservations ?? []).filter(res => {
            const start = new Date(res.startTime).getTime();
            const end = res.endTime ? new Date(res.endTime).getTime() : start + 3600000;
            return start < endOfDay.getTime() && end > startOfDay.getTime();
        });
    }, [reservations, startOfDay, endOfDay]);

    const hours = useMemo(() => Array.from({ length: HOURS_IN_DAY }, (_, i) => i), []);

    const handlePrevDay = () => { const d = new Date(currentDate); d.setDate(d.getDate() - 1); onDateChange?.(d); };
    const handleNextDay = () => { const d = new Date(currentDate); d.setDate(d.getDate() + 1); onDateChange?.(d); };
    const handleToday = () => onDateChange?.(new Date());

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '12px' : '20px', height: '100%' }}>
            {/* Header / Date Picker */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: isMobile ? '12px' : '16px', borderRadius: '12px', border: '1px solid var(--border)', flexShrink: 0, flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <CalendarIcon size={isMobile ? 18 : 20} color="var(--primary)" />
                    <h3 style={{ margin: 0, fontSize: isMobile ? '14px' : '16px', fontWeight: '600' }}>Schedule Bookings</h3>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'space-between' : 'flex-end' }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <Button variant="secondary" size="small" onClick={handlePrevDay} icon={<ChevronLeft size={16} />} />
                        <Button variant="secondary" size="small" onClick={handleNextDay} icon={<ChevronRight size={16} />} />
                    </div>
                    <div style={{ padding: '6px 12px', background: 'var(--background)', borderRadius: '8px', border: '1px solid var(--border)', fontWeight: 'bold', fontSize: isMobile ? '12px' : '14px', minWidth: isMobile ? '120px' : '160px', textAlign: 'center' }}>
                        {currentDate.toLocaleDateString([], isMobile ? { month: 'short', day: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric' })}
                    </div>
                    <Button variant="secondary" size="small" onClick={handleToday}>{isMobile ? 'Today' : 'Today'}</Button>
                </div>
            </div>

            {/* Timeline */}
            <div style={{ flex: 1, overflow: 'auto', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', minHeight: '300px', WebkitOverflowScrolling: 'touch' }}>

                {/* Hour Headers */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', position: 'sticky', top: 0, zIndex: 10, flexShrink: 0 }}>
                    <div style={{ width: `${ROOM_COL_WIDTH}px`, minWidth: `${ROOM_COL_WIDTH}px`, padding: '14px 16px', borderRight: '1px solid var(--border)', fontWeight: 'bold', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Room
                    </div>
                    <div style={{ display: 'flex', width: `${HOURS_IN_DAY * HOUR_WIDTH}px`, flexShrink: 0 }}>
                        {hours.map(h => (
                            <div key={h} style={{ width: `${HOUR_WIDTH}px`, minWidth: `${HOUR_WIDTH}px`, padding: '12px 0', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.04)', fontSize: '11px', color: 'var(--text-muted)' }}>
                                {h.toString().padStart(2, '0')}:00
                            </div>
                        ))}
                    </div>
                </div>

                {/* Room Rows */}
                <div style={{ position: 'relative', flex: 1 }}>
                    {(rooms ?? []).map((room, index) => {
                        const roomRes = dailyReservations.filter(r => r.roomId === room.id);
                        return (
                            <div key={room.id} style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.04)', minHeight: isMobile ? '56px' : '64px', position: 'relative' }}>
                                {/* Room Label */}
                                <div style={{
                                    width: `${ROOM_COL_WIDTH}px`, minWidth: `${ROOM_COL_WIDTH}px`, padding: '10px 12px',
                                    borderRight: '1px solid var(--border)',
                                    background: index % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                                    display: 'flex', flexDirection: 'column', justifyContent: 'center',
                                    position: 'sticky', left: 0, zIndex: 5,
                                    backdropFilter: 'blur(5px)'
                                }}>
                                    <span style={{ fontWeight: '700', fontSize: isMobile ? '12px' : '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{room.name}</span>
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{room.category}</span>
                                </div>

                                {/* Timeline Grid + Reservation Blocks */}
                                <div style={{ position: 'relative', background: index % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent', width: `${HOURS_IN_DAY * HOUR_WIDTH}px`, flexShrink: 0 }}>
                                    {/* Grid lines */}
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', pointerEvents: 'none' }}>
                                        {hours.map(h => (
                                            <div key={h} style={{ width: `${HOUR_WIDTH}px`, borderRight: '1px dashed rgba(255,255,255,0.03)' }} />
                                        ))}
                                    </div>

                                    {/* Reservation Blocks */}
                                    {roomRes.map(res => {
                                        const rStart = new Date(res.startTime);
                                        const isOpenTimed = !res.endTime;
                                        const rEnd = res.endTime ? new Date(res.endTime) : new Date(rStart.getTime() + 7200000);

                                        const renderStart = Math.max(startOfDay.getTime(), rStart.getTime());
                                        const renderEnd = Math.min(endOfDay.getTime(), rEnd.getTime());

                                        const startOffsetMinutes = (renderStart - startOfDay.getTime()) / 60000;
                                        const durationMinutes = (renderEnd - renderStart) / 60000;

                                        const leftPx = (startOffsetMinutes / 60) * HOUR_WIDTH;
                                        const widthPx = Math.max((durationMinutes / 60) * HOUR_WIDTH, isMobile ? 48 : 64);

                                        const colors = statusColors[res.status] ?? statusColors.pending;

                                        return (
                                            <div
                                                key={res.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (!isGuest || isAdmin) setSelectedRes(res);
                                                }}
                                                title={`${(res as any).guestName || 'Guest'} — Click for details`}
                                                style={{
                                                    position: 'absolute',
                                                    top: '4px', bottom: '4px',
                                                    left: `${leftPx}px`,
                                                    width: `${widthPx}px`,
                                                    background: colors.bg,
                                                    border: `2px solid ${colors.border}`,
                                                    borderRadius: '6px',
                                                    padding: '2px 6px',
                                                    cursor: isGuest && !isAdmin ? 'default' : 'pointer',
                                                    overflow: 'hidden',
                                                    zIndex: 2,
                                                    transition: 'all 0.15s',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    justifyContent: 'center',
                                                    boxSizing: 'border-box',
                                                }}
                                                onMouseEnter={e => {
                                                    if (!isGuest || isAdmin) {
                                                        (e.currentTarget as HTMLElement).style.transform = 'scaleY(1.05)';
                                                        (e.currentTarget as HTMLElement).style.zIndex = '10';
                                                        (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 20px ${colors.border}`;
                                                    }
                                                }}
                                                onMouseLeave={e => {
                                                    if (!isGuest || isAdmin) {
                                                        (e.currentTarget as HTMLElement).style.transform = 'scaleY(1)';
                                                        (e.currentTarget as HTMLElement).style.zIndex = '2';
                                                        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                                                    }
                                                }}
                                            >
                                                <div style={{ fontSize: '9px', color: colors.text, fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {res.status.replace('_', ' ')}
                                                </div>
                                                <div style={{ fontSize: isMobile ? '9px' : '10px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text)' }}>
                                                    {rStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {isOpenTimed ? '??:??' : rEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                                {!isMobile && (res as any).guestName && (
                                                    <div style={{ fontSize: '9px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '1px', fontWeight: '600' }}>
                                                        {(res as any).guestName}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}

                    {(rooms ?? []).length === 0 && (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                            No rooms configured
                        </div>
                    )}
                </div>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: '12px', padding: '0 4px', fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0, flexWrap: 'wrap' }}>
                {Object.entries(statusColors).map(([status, c]) => (
                    <div key={status} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: c.bg, border: `1px solid ${c.border}` }} />
                        <span style={{ textTransform: 'capitalize' }}>{status.replace('_', ' ')}</span>
                    </div>
                ))}
                {!isGuest && <span style={{ marginLeft: 'auto', fontStyle: 'italic', color: 'var(--text-muted)' }}>Click a block to view details</span>}
            </div>

            {/* Detail Dialog */}
            {selectedRes && (
                <DetailDialog
                    res={selectedRes}
                    onClose={() => setSelectedRes(null)}
                    onAction={onAction}
                    isAdmin={isAdmin}
                />
            )}
        </div>
    );
};
