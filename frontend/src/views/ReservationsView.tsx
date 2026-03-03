import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import GlassPanel from '../components/common/GlassPanel';
import Button from '../components/common/Button';
import { adminService } from '../services/admin.service';
import { Clock, Plus } from 'lucide-react';
import type { Reservation, Room } from '../types';
import { useSocket } from '../hooks/useSocket';
import { BookingCalendar } from '../components/common/BookingCalendar';
import { Input, Select } from '../components/common/FormElements';
import { BASE_URL } from '../services/api';

const ReservationsView: React.FC = () => {
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState({
        roomId: '',
        startTime: '',
        endTime: '',
        guestName: '',
        guestPhone: '',
        note: ''
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [resRes, roomRes] = await Promise.all([
                adminService.getReservations(),
                adminService.getRooms()
            ]);
            const reservationsData = Array.isArray(resRes.data) ? resRes.data : [];
            setReservations(reservationsData.sort((a: Reservation, b: Reservation) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));

            const roomsData = roomRes.data && 'data' in roomRes.data ? (roomRes.data as any).data : (Array.isArray(roomRes.data) ? roomRes.data : []);
            setRooms(roomsData);

            if (roomsData.length > 0 && !formData.roomId) {
                setFormData(prev => ({ ...prev, roomId: roomsData[0].id }));
            }
        } catch (err) {
            console.error('Failed to load reservations data', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchData();
    }, []);

    // Listen for real-time reservation updates
    const handleSocketUpdate = (type: string) => {
        if (type === 'reservation_update' || type === 'reservation') {
            void fetchData();
        }
    };
    useSocket(BASE_URL, handleSocketUpdate);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await adminService.createReservation({
                ...formData,
                endTime: formData.endTime || undefined
            });
            setIsCreating(false);
            setFormData({
                roomId: rooms[0]?.id || '',
                startTime: '',
                endTime: '',
                guestName: '',
                guestPhone: '',
                note: ''
            });
            void fetchData();
            toast.success('Reservation created successfully');
        } catch (err: unknown) {
            const apiErr = err as { response?: { data?: { error?: string } } };
            toast.error(apiErr.response?.data?.error || 'Error creating reservation');
        }
    };

    const handleAction = async (action: 'confirm' | 'cancel' | 'delete' | 'checkin', res: Reservation) => {
        if (action === 'delete') return; // Staff cannot delete reservations
        try {
            const statusMap: Record<string, string> = {
                confirm: 'confirmed',
                cancel: 'cancelled',
                checkin: 'checked_in'
            };
            const status = statusMap[action];
            if (!status) return;

            const api = await import('../services/api').then(m => m.default);
            await api.patch(`/reservations/${res.id}/status`, { status });
            void fetchData();
            toast.success(`Reservation ${action === 'confirm' ? 'confirmed' : action === 'cancel' ? 'cancelled' : 'checked in'} successfully`);
        } catch (err) {
            toast.error('Failed to update reservation status.');
        }
    };

    return (
        <div style={{ height: 'calc(100vh - 180px)', display: 'flex', flexDirection: 'column' }}>
            <GlassPanel style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: '700' }}>Manage Reservations</h2>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Button variant="secondary" icon={<Clock size={16} />} onClick={() => void fetchData()}>
                            Refresh
                        </Button>
                        <Button onClick={() => setIsCreating(true)} icon={<Plus size={16} />}>
                            New Reservation
                        </Button>
                    </div>
                </div>

                {isCreating && (
                    <div style={{ marginBottom: '24px', padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: '600', color: 'var(--primary)' }}>Create Reservation</h3>
                        <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                            <Select
                                label="ROOM"
                                value={formData.roomId}
                                options={rooms.map(r => ({ value: r.id, label: `${r.name} (${r.category})` }))}
                                onChange={e => setFormData({ ...formData, roomId: e.target.value })}
                            />
                            <Input type="datetime-local" label="START TIME" value={formData.startTime} onChange={e => setFormData({ ...formData, startTime: e.target.value })} required />
                            <Input type="datetime-local" label="END TIME (Optional)" value={formData.endTime} onChange={e => setFormData({ ...formData, endTime: e.target.value })} />

                            <Input label="GUEST NAME" value={formData.guestName} onChange={e => setFormData({ ...formData, guestName: e.target.value })} placeholder="Optional" />
                            <Input label="GUEST PHONE" value={formData.guestPhone} onChange={e => setFormData({ ...formData, guestPhone: e.target.value })} placeholder="Optional" />

                            <div style={{ gridColumn: 'span 2' }}>
                                <Input label="NOTES" value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })} placeholder="Entry code, special requests, etc." />
                            </div>

                            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', gridColumn: 'span 2' }}>
                                <Button type="submit" style={{ flex: 1 }}>Save Reservation</Button>
                                <Button type="button" variant="secondary" onClick={() => setIsCreating(false)} style={{ flex: 1 }}>Cancel</Button>
                            </div>
                        </form>
                    </div>
                )}

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {loading && reservations.length === 0 && rooms.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>Loading reservations...</div>
                    ) : (
                        <BookingCalendar
                            reservations={reservations}
                            rooms={rooms}
                            currentDate={currentDate}
                            onDateChange={setCurrentDate}
                            onAction={handleAction}
                            isAdmin={false}
                        />
                    )}
                </div>
            </GlassPanel>
        </div>
    );
};

export default ReservationsView;
