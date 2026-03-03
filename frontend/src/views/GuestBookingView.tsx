import React, { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import GlassPanel from '../components/common/GlassPanel';
import Button from '../components/common/Button';
import { Clock, Plus } from 'lucide-react';
import type { Reservation, Room, SystemSettings } from '../types';
import { useSocket } from '../hooks/useSocket';
import { BookingCalendar } from '../components/common/BookingCalendar';
import { Input, Select } from '../components/common/FormElements';
import { BASE_URL } from '../services/api';

const GuestBookingView: React.FC<{ systemSettings: SystemSettings }> = ({ systemSettings }) => {
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isCreating, setIsCreating] = useState(false);
    const [submitting, setSubmitting] = useState(false);
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
            const api = await import('../services/api').then(m => m.default);
            // We use the guest (public) endpoints
            const [resRes, roomRes] = await Promise.all([
                api.get('/guest/reservations'),
                api.get('/guest/rooms')
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

        // Name and Phone are required for guests making a reservation
        if (!formData.guestName.trim() || !formData.guestPhone.trim()) {
            return toast.error('Name and Phone Number are required to book.');
        }

        setSubmitting(true);
        try {
            const api = await import('../services/api').then(m => m.default);
            await api.post('/guest/reservations', {
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
            toast.success('Reservation request submitted successfully! We will see you soon.');
        } catch (err: unknown) {
            const apiErr = err as { response?: { data?: { error?: string } } };
            toast.error(apiErr.response?.data?.error || 'Error creating reservation');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--text)', padding: '20px' }}>
            <Toaster
                position="top-right"
                toastOptions={{
                    style: {
                        background: 'var(--surface-solid)',
                        color: 'var(--text)',
                        border: '1px solid var(--border)',
                        backdropFilter: 'blur(10px)',
                    },
                    success: {
                        iconTheme: {
                            primary: 'var(--primary)',
                            secondary: '#000',
                        },
                    },
                }}
            />
            <GlassPanel style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {systemSettings.systemLogo && (
                            <img src={systemSettings.systemLogo} alt="Logo" style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'contain' }} />
                        )}
                        <div>
                            <h2 style={{ fontSize: '24px', fontWeight: '800', margin: 0, color: 'var(--primary)' }}>
                                {systemSettings.systemName.toUpperCase()} - Book a Session
                            </h2>
                            <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>Please review the calendar for availability before requesting a slot.</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Button variant="secondary" icon={<Clock size={16} />} onClick={() => void fetchData()}>
                            Refresh
                        </Button>
                        <Button onClick={() => setIsCreating(true)} icon={<Plus size={16} />}>
                            Request Booking
                        </Button>
                    </div>
                </div>

                {isCreating && (
                    <div style={{ marginBottom: '24px', padding: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--primary)' }}>
                        <h3 style={{ marginBottom: '20px', fontSize: '18px', fontWeight: '700', color: 'var(--primary)', borderBottom: '1px solid rgba(0,230,118,0.2)', paddingBottom: '10px' }}>Reservation Details</h3>
                        <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                            <Select
                                label="SELECT ROOM"
                                value={formData.roomId}
                                options={rooms.map(r => ({ value: r.id, label: `${r.name} (${r.category})` }))}
                                onChange={e => setFormData({ ...formData, roomId: e.target.value })}
                            />
                            <Input type="datetime-local" label="START TIME *" value={formData.startTime} onChange={e => setFormData({ ...formData, startTime: e.target.value })} required />
                            <Input type="datetime-local" label="END TIME (Optional)" value={formData.endTime} onChange={e => setFormData({ ...formData, endTime: e.target.value })} />

                            <Input label="YOUR NAME *" value={formData.guestName} onChange={e => setFormData({ ...formData, guestName: e.target.value })} required placeholder="John Doe" />
                            <Input label="YOUR PHONE *" value={formData.guestPhone} onChange={e => setFormData({ ...formData, guestPhone: e.target.value })} required placeholder="01xxxxxxxxx" />

                            <div style={{ gridColumn: '1 / -1' }}>
                                <Input label="SPECIAL REQUESTS / NOTES" value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })} placeholder="Any specific requirements?" />
                            </div>

                            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', gridColumn: '1 / -1', marginTop: '10px' }}>
                                <Button loading={submitting} type="submit" style={{ flex: 1, padding: '16px' }}>Submit Booking Request</Button>
                                <Button type="button" variant="secondary" onClick={() => setIsCreating(false)} style={{ flex: 1, padding: '16px' }}>Cancel</Button>
                            </div>
                        </form>
                    </div>
                )}

                <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '10px' }}>
                    {loading && reservations.length === 0 && rooms.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '60px' }}>Loading availability...</div>
                    ) : (
                        <BookingCalendar
                            reservations={reservations}
                            rooms={rooms}
                            currentDate={currentDate}
                            onDateChange={setCurrentDate}
                            isGuest={true}
                        />
                    )}
                </div>
            </GlassPanel>
        </div>
    );
};

export default GuestBookingView;
