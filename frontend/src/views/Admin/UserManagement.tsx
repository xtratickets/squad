import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminService } from '../../services/admin.service';
import { UserPlus, Edit, Check, X, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import DataTable from '../../components/common/DataTable';
import Button from '../../components/common/Button';
import { Input, Select } from '../../components/common/FormElements';
import GlassPanel from '../../components/common/GlassPanel';
import type { User, Role } from '../../types';

const UserManagement: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [isEditing, setIsEditing] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState({ username: '', password: '', roleId: '' });
    const [loading, setLoading] = useState(true);

    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalUsers, setTotalUsers] = useState(0);

    const loadData = async () => {
        try {
            const [uRes, rRes] = await Promise.all([
                adminService.getUsers({ page, pageSize }),
                adminService.getRoles(),
            ]);
            setUsers(uRes.data.data || uRes.data); // Support both old and new format during transition
            setTotalPages(uRes.data.totalPages || 1);
            setTotalUsers(uRes.data.total || 0);

            setRoles(rRes.data);
            if (rRes.data.length > 0 && !formData.roleId) {
                setFormData(prev => ({ ...prev, roleId: rRes.data[0].id }));
            }
        } catch (err) {
            console.error('Error loading users', err);
        } finally {
            setLoading(false);
        }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { void loadData(); }, [page]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await adminService.createUser(formData);
            setIsCreating(false);
            setFormData({ username: '', password: '', roleId: roles[0]?.id || '' });
            loadData();
            toast.success('User created successfully');
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { error?: string } } }).response?.data?.error : undefined;
            toast.error(msg || 'Error creating user');
        }
    };

    const handleUpdate = async (id: string, e: React.FormEvent) => {
        e.preventDefault();
        try {
            await adminService.updateUser(id, formData);
            setIsEditing(null);
            loadData();
            toast.success('User updated successfully');
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { error?: string } } }).response?.data?.error : undefined;
            toast.error(msg || 'Error updating user');
        }
    };

    const startEdit = (user: User) => {
        setIsEditing(user.id);
        setFormData({ username: user.username, password: '', roleId: user.role.id });
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this user?')) return;
        try {
            await adminService.deleteUser(id);
            loadData();
            toast.success('User deleted successfully');
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { error?: string } } }).response?.data?.error : undefined;
            toast.error(msg || 'Error deleting user');
        }
    };

    const columns = [
        {
            header: 'Username',
            key: 'username',
            render: (u: User) => isEditing === u.id ? (
                <Input value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} />
            ) : u.username,
        },
        {
            header: 'Role',
            key: 'role',
            render: (u: User) => isEditing === u.id ? (
                <Select
                    value={formData.roleId}
                    options={roles.map(r => ({ value: r.id, label: r.name }))}
                    onChange={e => setFormData({ ...formData, roleId: e.target.value })}
                />
            ) : (
                <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', background: u.role.name === 'ADMIN' ? 'rgba(41, 121, 255, 0.1)' : 'rgba(255,255,255,0.05)', color: u.role.name === 'ADMIN' ? '#2979ff' : 'var(--text-muted)', fontWeight: '600' }}>
                    {u.role.name}
                </span>
            ),
        },
    ];

    if (loading) return <div style={{ color: 'var(--text-muted)' }}>Loading users...</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', height: '100%', paddingBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <h2 style={{ fontSize: '24px', fontWeight: '600' }}>User Management</h2>
                <Button onClick={() => setIsCreating(true)} icon={<UserPlus size={18} />}>Add New User</Button>
            </div>

            {isCreating && (
                <GlassPanel style={{ padding: '30px', marginBottom: '20px', flexShrink: 0 }}>
                    <h3 style={{ marginBottom: '20px', color: 'var(--primary)' }}>Create User</h3>
                    <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                        <Input placeholder="Username" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} required />
                        <Input type="password" placeholder="Password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} required />
                        <Select value={formData.roleId} options={roles.map(r => ({ value: r.id, label: r.name }))} onChange={e => setFormData({ ...formData, roleId: e.target.value })} />
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <Button type="submit">Create</Button>
                            <Button type="button" variant="secondary" onClick={() => setIsCreating(false)}>Cancel</Button>
                        </div>
                    </form>
                </GlassPanel>
            )}

            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <DataTable
                    data={users}
                    columns={columns}
                    searchKey="username"
                    searchPlaceholder="Search users..."
                    actions={(u: User) => (
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            {isEditing === u.id ? (
                                <>
                                    <Button onClick={(e: React.MouseEvent) => handleUpdate(u.id, e)} size="small" variant="primary"><Check size={16} /></Button>
                                    <Button onClick={() => setIsEditing(null)} size="small" variant="secondary"><X size={16} /></Button>
                                </>
                            ) : (
                                <>
                                    <Button onClick={() => startEdit(u)} size="small" variant="secondary"><Edit size={16} strokeWidth={2.5} /></Button>
                                    <Button onClick={() => handleDelete(u.id)} size="small" variant="secondary" style={{ color: 'var(--danger)' }}><Trash2 size={16} strokeWidth={2.5} /></Button>
                                </>
                            )}
                        </div>
                    )}
                />

                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '12px 24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            Showing page {page} of {totalPages} ({totalUsers} total users)
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

export default UserManagement;
