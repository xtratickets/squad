import React from 'react';
import toast from 'react-hot-toast';
import { roomService } from '../services/room.service';
import GlassPanel from '../components/common/GlassPanel';
import Button from '../components/common/Button';
import type { Room, Shift } from '../types';

interface DashboardViewProps {
    rooms: Room[];
    fetchRooms: () => void;
    currentShift: Shift | null;
    onShiftChange: (s: Shift | null) => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({ rooms, fetchRooms, currentShift, onShiftChange }) => {

    const startSession = async (roomId: string) => {
        if (!currentShift) return toast.error('Open a shift first!');
        try {
            await roomService.startSession(roomId, currentShift.id);
            fetchRooms();
            toast.success('Session started');
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { error?: string } } }).response?.data?.error : undefined;
            toast.error(msg || 'Error starting session');
        }
    };

    const openShift = async () => {
        const cash = prompt('Opening Cash:', '0');
        if (cash === null) return;
        try {
            const res = await roomService.openShift(parseFloat(cash));
            onShiftChange(res.data);
            localStorage.setItem('squad_shift', JSON.stringify(res.data));
            toast.success('Shift opened');
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { error?: string } } }).response?.data?.error : undefined;
            toast.error(msg || 'Error opening shift');
        }
    };

    const closeShift = async () => {
        if (!currentShift) return;
        const cash = prompt('Physical Cash Count:');
        if (cash === null) return;
        try {
            await roomService.closeShift(currentShift.id, parseFloat(cash));
            onShiftChange(null);
            localStorage.removeItem('squad_shift');
            toast.success('Shift Closed');
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { error?: string } } }).response?.data?.error : undefined;
            toast.error(msg || 'Error closing shift');
        }
    };

    return (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '25px', marginBottom: '50px' }}>
                <GlassPanel style={{ padding: '25px' }}>
                    <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '10px' }}>OCCUPANCY</h3>
                    <div style={{ fontSize: '32px', color: 'var(--primary)', fontWeight: 'bold' }}>
                        {rooms.filter(r => r.status === 'occupied').length} / {rooms.length}
                    </div>
                </GlassPanel>
                <GlassPanel style={{ padding: '25px' }}>
                    <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '10px' }}>SHIFT ACTION</h3>
                    <Button
                        onClick={currentShift ? closeShift : openShift}
                        variant={currentShift ? 'secondary' : 'primary'}
                        style={{ width: '100%' }}
                    >
                        {currentShift ? 'CLOSE SHIFT' : 'OPEN SHIFT'}
                    </Button>
                </GlassPanel>
            </div>

            <h2 style={{ marginBottom: '25px', fontSize: '24px', fontWeight: 'bold' }}>Rooms</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '25px' }}>
                {rooms.map(r => (
                    <GlassPanel
                        key={r.id}
                        style={{
                            padding: '20px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            borderTop: `4px solid ${r.status === 'available' ? 'var(--primary)' : 'var(--danger)'}`,
                            transition: 'transform 0.2s ease',
                        }}
                        onClick={() => r.status === 'available' && startSession(r.id)}
                    >
                        <h4 style={{ fontSize: '18px', marginBottom: '5px' }}>{r.name}</h4>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{r.category}</p>
                        <div style={{
                            marginTop: '15px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            color: r.status === 'available' ? 'var(--primary)' : 'var(--danger)',
                            letterSpacing: '1px'
                        }}>
                            {r.status.toUpperCase()}
                        </div>
                    </GlassPanel>
                ))}
            </div>
        </div>
    );
};

export default DashboardView;
