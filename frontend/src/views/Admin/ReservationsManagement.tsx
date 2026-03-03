import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminService } from '../../services/admin.service';
import { Plus } from 'lucide-react';
import { BookingCalendar } from '../../components/common/BookingCalendar';
import Button from '../../components/common/Button';
import { Input, Select } from '../../components/common/FormElements';
import GlassPanel from '../../components/common/GlassPanel';
import type { Reservation, Room } from '../../types';

const ReservationsManagement: React.FC = () => {
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState({
        roomId: '',
        startTime: '',
        endTime: '',
        guestName: '',
        guestPhone: '',
        note: ''
    });
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());

    const loadData = async () => {
        try {
            const [resRes, roomRes] = await Promise.all([
                adminService.getReservations(),
                adminService.getRooms(),
            ]);
            setReservations(resRes.data);
            const roomsData = roomRes.data && 'data' in roomRes.data ? (roomRes.data as any).data : (Array.isArray(roomRes.data) ? roomRes.data : []);
            setRooms(roomsData);
            if (roomsData.length > 0 && !formData.roomId) {
                setFormData(prev => ({ ...prev, roomId: roomsData[0].id }));
            }
        } catch (err) {
            console.error('Error loading reservations', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

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
            loadData();
            toast.success('Reservation created successfully');
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { error?: string } } }).response?.data?.error : undefined;
            toast.error(msg || 'Error creating reservation');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this reservation?')) return;
        try {
            await adminService.deleteReservation(id);
            loadData();
            toast.success('Reservation deleted');
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { error?: string } } }).response?.data?.error : undefined;
            toast.error(msg || 'Error deleting reservation');
        }
    };

    if (loading) return <div style={{ color: 'var(--text-muted)' }}>Loading reservations...</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '24px', fontWeight: '600' }}>Room Reservations</h2>
                <Button onClick={() => setIsCreating(true)} icon={<Plus size={18} />}>New Reservation</Button>
            </div>

            {isCreating && (
                <GlassPanel style={{ padding: '30px', marginBottom: '20px' }}>
                    <h3 style={{ marginBottom: '20px', color: 'var(--primary)' }}>Create Reservation</h3>
                    <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
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
                </GlassPanel>
            )}

            <div style={{ flex: 1, minHeight: 0 }}>
                <BookingCalendar
                    reservations={reservations}
                    rooms={rooms}
                    currentDate={currentDate}
                    onDateChange={setCurrentDate}
                    onAction={async (action, res) => {
                        if (action === 'delete') {
                            await handleDelete(res.id);
                        }
                    }}
                    isAdmin={true}
                />
            </div>
        </div>
    );
};

export default ReservationsManagement;
