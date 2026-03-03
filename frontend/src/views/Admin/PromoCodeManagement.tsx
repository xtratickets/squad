import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import GlassPanel from '../../components/common/GlassPanel';
import Button from '../../components/common/Button';
import { Input } from '../../components/common/FormElements';
import { Tag, Trash2, Edit3, X, Check } from 'lucide-react';

interface PromoCode {
    id: string;
    code: string;
    type: 'percent' | 'fixed';
    value: number;
    active: boolean;
    expiry?: string | null;
    usageLimit?: number | null;
    applyTo: 'room' | 'orders' | 'both';
}

const APPLY_OPTIONS = [
    { value: 'both', label: 'Room + Orders', color: 'rgba(0,230,118,0.12)', textColor: 'var(--primary)' },
    { value: 'room', label: 'Room Only', color: 'rgba(41,121,255,0.12)', textColor: '#2979ff' },
    { value: 'orders', label: 'Orders Only', color: 'rgba(255,171,0,0.12)', textColor: '#ffab00' },
];

const applyLabel = (v: string) => APPLY_OPTIONS.find(o => o.value === v) ?? APPLY_OPTIONS[0];

const emptyForm = { code: '', type: 'percent' as 'percent' | 'fixed', value: '', expiry: '', usageLimit: '', applyTo: 'both' as 'room' | 'orders' | 'both' };

const PromoCodeManagement: React.FC = () => {
    const [promos, setPromos] = useState<PromoCode[]>([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(emptyForm);
    const [submitting, setSubmitting] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.get('/promocodes');
            setPromos(res.data ?? []);
        } catch { toast.error('Failed to load promo codes'); }
        finally { setLoading(false); }
    };

    useEffect(() => { void load(); }, []);

    const openEdit = (p: PromoCode) => {
        setEditingId(p.id);
        setForm({
            code: p.code,
            type: p.type,
            value: String(p.value),
            expiry: p.expiry ? p.expiry.slice(0, 10) : '',
            usageLimit: p.usageLimit != null ? String(p.usageLimit) : '',
            applyTo: p.applyTo ?? 'both',
        });
    };

    const cancelEdit = () => { setEditingId(null); setForm(emptyForm); };

    const submit = async () => {
        if (!form.code || !form.value) return toast.error('Code and value are required');
        setSubmitting(true);
        try {
            const payload = {
                code: form.code.toUpperCase().trim(),
                type: form.type,
                value: parseFloat(form.value),
                applyTo: form.applyTo,
                expiry: form.expiry || null,
                usageLimit: form.usageLimit ? parseInt(form.usageLimit) : null,
            };
            if (editingId) {
                await api.patch(`/promocodes/${editingId}`, payload);
                toast.success('Promo code updated');
            } else {
                await api.post('/promocodes', payload);
                toast.success('Promo code created');
            }
            setForm(emptyForm);
            setEditingId(null);
            void load();
        } catch { toast.error('Failed to save promo code'); }
        finally { setSubmitting(false); }
    };

    const deletePromo = async (id: string) => {
        if (!window.confirm('Delete this promo code?')) return;
        try {
            await api.delete(`/promocodes/${id}`);
            toast.success('Deleted');
            void load();
        } catch { toast.error('Failed to delete'); }
    };

    const toggleActive = async (p: PromoCode) => {
        try {
            await api.patch(`/promocodes/${p.id}`, { active: !p.active });
            setPromos(prev => prev.map(r => r.id === p.id ? { ...r, active: !r.active } : r));
        } catch { toast.error('Failed to update'); }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* Form */}
            <GlassPanel style={{ padding: '24px' }}>
                <h3 style={{ margin: '0 0 20px', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Tag size={18} color="var(--primary)" />
                    {editingId ? 'Edit Promo Code' : 'Create Promo Code'}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <Input label="Code" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="SUMMER10" style={{ flex: 1, minWidth: '150px' }} />
                        <div style={{ flex: 1, minWidth: '130px' }}>
                            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>TYPE</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {(['percent', 'fixed'] as const).map(t => (
                                    <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                                        style={{ flex: 1, padding: '9px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', background: form.type === t ? 'rgba(0,230,118,0.12)' : 'rgba(255,255,255,0.04)', color: form.type === t ? 'var(--primary)' : 'var(--text-muted)', border: `1px solid ${form.type === t ? 'var(--primary)' : 'var(--border)'}`, transition: 'all 0.2s' }}>
                                        {t === 'percent' ? '% Percent' : 'EGP Fixed'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <Input label={form.type === 'percent' ? 'Discount %' : 'Discount EGP'} type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} style={{ flex: 1, minWidth: '120px' }} />
                    </div>

                    {/* Apply To */}
                    <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>APPLIES TO</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {APPLY_OPTIONS.map(opt => (
                                <button key={opt.value} onClick={() => setForm(f => ({ ...f, applyTo: opt.value as any }))}
                                    style={{ flex: 1, padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: form.applyTo === opt.value ? opt.color : 'rgba(255,255,255,0.04)', color: form.applyTo === opt.value ? opt.textColor : 'var(--text-muted)', border: `1px solid ${form.applyTo === opt.value ? opt.textColor : 'var(--border)'}`, transition: 'all 0.2s' }}>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <Input label="Usage Limit" type="number" value={form.usageLimit} onChange={e => setForm(f => ({ ...f, usageLimit: e.target.value }))} placeholder="Unlimited" style={{ flex: 1, minWidth: '130px' }} />
                        <Input label="Expiry Date" type="date" value={form.expiry} onChange={e => setForm(f => ({ ...f, expiry: e.target.value }))} style={{ flex: 1, minWidth: '160px' }} />
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Button onClick={() => void submit()} loading={submitting} variant="primary" size="small">
                            <Check size={14} /> {editingId ? 'Save Changes' : 'Create Code'}
                        </Button>
                        {editingId && <Button onClick={cancelEdit} variant="secondary" size="small"><X size={14} /> Cancel</Button>}
                    </div>
                </div>
            </GlassPanel>

            {/* List */}
            <GlassPanel style={{ padding: '24px' }}>
                <h3 style={{ margin: '0 0 20px', fontSize: '16px' }}>Active Promo Codes</h3>
                {loading ? <div style={{ color: 'var(--text-muted)', padding: '20px', textAlign: 'center' }}>Loading...</div> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {promos.length === 0 && <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No promo codes yet.</div>}
                        {promos.map(p => {
                            const opt = applyLabel(p.applyTo ?? 'both');
                            return (
                                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
                                    <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '15px', color: p.active ? 'var(--primary)' : 'var(--text-muted)', minWidth: '100px' }}>{p.code}</span>
                                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{p.type === 'percent' ? `${p.value}%` : `EGP ${p.value}`}</span>
                                    <span style={{ background: opt.color, color: opt.textColor, fontSize: '11px', padding: '2px 10px', borderRadius: '8px', fontWeight: 700 }}>{opt.label}</span>
                                    {p.usageLimit != null && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Uses left: {p.usageLimit}</span>}
                                    {p.expiry && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Expires: {new Date(p.expiry).toLocaleDateString()}</span>}
                                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                                        <button onClick={() => void toggleActive(p)} style={{ background: p.active ? 'rgba(0,230,118,0.1)' : 'rgba(255,68,68,0.1)', border: `1px solid ${p.active ? 'var(--primary)' : '#f87171'}`, color: p.active ? 'var(--primary)' : '#f87171', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer', fontWeight: 700 }}>
                                            {p.active ? 'Active' : 'Disabled'}
                                        </button>
                                        <button onClick={() => openEdit(p)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer' }}>
                                            <Edit3 size={13} />
                                        </button>
                                        <button onClick={() => void deletePromo(p.id)} style={{ background: 'none', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer' }}>
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </GlassPanel>
        </div>
    );
};

export default PromoCodeManagement;
