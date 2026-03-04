import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminService } from '../../services/admin.service';
import { Plus, Edit, Check, X, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import DataTable from '../../components/common/DataTable';
import Button from '../../components/common/Button';
import { Input } from '../../components/common/FormElements';
import GlassPanel from '../../components/common/GlassPanel';
import type { Room } from '../../types';

const RoomManagement: React.FC = () => {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [isEditing, setIsEditing] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState({ name: '', category: '', pricePerHour: 0, minMinutes: 0, displayOrder: 0, status: 'available' });
    const [loading, setLoading] = useState(true);

    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRooms, setTotalRooms] = useState(0);

    const loadRooms = async () => {
        try {
            const res = await adminService.getRooms({ page, pageSize });
            setRooms(res.data.data || res.data); // Support both structures
            setTotalPages(res.data.totalPages || 1);
            setTotalRooms(res.data.total || 0);
        } catch (err) {
            console.error('Error loading rooms', err);
        } finally {
            setLoading(false);
        }
    };


    useEffect(() => { void loadRooms(); }, [page]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await adminService.createRoom(formData);
            setIsCreating(false);
            setFormData({ name: '', category: '', pricePerHour: 0, minMinutes: 0, displayOrder: 0, status: 'available' });
            loadRooms();
            toast.success('Room created successfully');
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { error?: string } } }).response?.data?.error : undefined;
            toast.error(msg || 'Error creating room');
        }
    };

    const handleUpdate = async (id: string, e: React.FormEvent) => {
        e.preventDefault();
        try {
            await adminService.updateRoom(id, formData);
            setIsEditing(null);
            loadRooms();
            toast.success('Room updated successfully');
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { error?: string } } }).response?.data?.error : undefined;
            toast.error(msg || 'Error updating room');
        }
    };

    const startEdit = (room: Room) => {
        setIsEditing(room.id);
        setFormData({
            name: room.name,
            category: room.category,
            pricePerHour: room.pricePerHour,
            minMinutes: room.minMinutes,
            displayOrder: room.displayOrder || 0,
            status: room.status
        });
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this room?')) return;
        try {
            await adminService.deleteRoom(id);
            loadRooms();
            toast.success('Room deleted successfully');
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { error?: string } } }).response?.data?.error : undefined;
            toast.error(msg || 'Error deleting room');
        }
    };

    const columns = [
        {
            header: 'Room Name',
            key: 'name',
            render: (r: Room) => isEditing === r.id ? (
                <Input
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
            ) : r.name
        },
        {
            header: 'Category',
            key: 'category',
            render: (r: Room) => isEditing === r.id ? (
                <Input
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                />
            ) : (
                <span className="badge">{r.category}</span>
            )
        },
        {
            header: 'Price/Hr',
            key: 'pricePerHour',
            render: (r: Room) => isEditing === r.id ? (
                <Input
                    type="number"
                    value={formData.pricePerHour}
                    onChange={e => setFormData({ ...formData, pricePerHour: parseFloat(e.target.value) })}
                />
            ) : `EGP ${(r.pricePerHour || 0).toFixed(2)}`
        },
        {
            header: 'Status',
            key: 'status',
            render: (r: Room) => (
                <span style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    background: r.status === 'available' ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 82, 82, 0.1)',
                    color: r.status === 'available' ? 'var(--primary)' : 'var(--danger)',
                    fontWeight: '600',
                    textTransform: 'uppercase'
                }}>
                    {r.status}
                </span>
            )
        },
        {
            header: 'Display Order',
            key: 'displayOrder',
            render: (r: Room) => isEditing === r.id ? (
                <Input
                    type="number"
                    value={formData.displayOrder}
                    onChange={e => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                />
            ) : r.displayOrder || 0
        }
    ];

    if (loading) return <div style={{ color: 'var(--text-muted)' }}>Loading rooms...</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', height: '100%', paddingBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <h2 style={{ fontSize: '24px', fontWeight: '600' }}>Room Management</h2>
                <Button onClick={() => setIsCreating(true)} icon={<Plus size={18} />}>
                    Add New Room
                </Button>
            </div>

            {isCreating && (
                <GlassPanel style={{ padding: '30px', marginBottom: '20px', flexShrink: 0 }}>
                    <h3 style={{ marginBottom: '20px', color: 'var(--primary)' }}>Create Room</h3>
                    <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                        <Input placeholder="Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                        <Input placeholder="Category" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} required />
                        <Input type="number" placeholder="Price Per Hour" value={formData.pricePerHour} onChange={e => setFormData({ ...formData, pricePerHour: parseFloat(e.target.value) })} required />
                        <Input type="number" placeholder="Min Minutes" value={formData.minMinutes} onChange={e => setFormData({ ...formData, minMinutes: parseInt(e.target.value) })} required />
                        <Input type="number" placeholder="Display Order (Optional)" value={formData.displayOrder} onChange={e => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })} />
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <Button type="submit">Create</Button>
                            <Button type="button" variant="secondary" onClick={() => setIsCreating(false)}>Cancel</Button>
                        </div>
                    </form>
                </GlassPanel>
            )}

            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <DataTable
                    data={rooms}
                    columns={columns}
                    searchKey="name"
                    searchPlaceholder="Search rooms..."
                    actions={(r) => (
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            {isEditing === r.id ? (
                                <>
                                    <Button onClick={(e: React.MouseEvent) => handleUpdate(r.id, e)} size="small" variant="primary"><Check size={16} /></Button>
                                    <Button onClick={() => setIsEditing(null)} size="small" variant="secondary"><X size={16} /></Button>
                                </>
                            ) : (
                                <>
                                    <Button onClick={() => startEdit(r)} size="small" variant="secondary">
                                        <Edit size={16} />
                                    </Button>
                                    <Button onClick={() => handleDelete(r.id)} size="small" variant="secondary" style={{ color: 'var(--danger)' }}>
                                        <Trash2 size={16} />
                                    </Button>
                                </>
                            )}
                        </div>
                    )}
                />

                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '12px 24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            Showing page {page} of {totalPages} ({totalRooms} total rooms)
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <Button
                                variant="secondary"
                                size="small"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                icon={<ChevronLeft size={16} />}
                            >
                                Previous
                            </Button>
                            <Button
                                variant="secondary"
                                size="small"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                icon={<ChevronRight size={16} />}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RoomManagement;
