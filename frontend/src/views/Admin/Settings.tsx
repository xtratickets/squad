import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminService } from '../../services/admin.service';
import { systemService } from '../../services/system.service';
import { Save, Plus, Ticket, Trash2, CreditCard, ToggleLeft, ToggleRight, X, Monitor } from 'lucide-react';
import DataTable from '../../components/common/DataTable';
import Button from '../../components/common/Button';
import { Input, Select } from '../../components/common/FormElements';
import GlassPanel from '../../components/common/GlassPanel';
import type { PromoCode, FeeConfig, PaymentMode } from '../../types';

const Settings: React.FC = () => {
    const [feeConfig, setFeeConfig] = useState<FeeConfig | null>(null);
    const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
    const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
    const [systemConfig, setSystemConfig] = useState({ systemName: '', systemLogo: '' });
    const [isCreatingPromo, setIsCreatingPromo] = useState(false);
    const [isCreatingMode, setIsCreatingMode] = useState(false);
    const [newPromo, setNewPromo] = useState({ code: '', type: 'percent' as 'percent' | 'fixed', value: 0 });
    const [newMode, setNewMode] = useState({ name: '', active: true, allowSplit: false });
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        try {
            const [fRes, pRes, mRes, sysRes] = await Promise.all([
                adminService.getFees(),
                adminService.getPromoCodes(),
                adminService.getPaymentModes(),
                systemService.getSettings(),
            ]);
            setFeeConfig(fRes.data);
            setPromoCodes(pRes.data);
            setPaymentModes(mRes.data);
            setSystemConfig({ systemName: sysRes.data.systemName, systemLogo: sysRes.data.systemLogo });
        } catch (err) {
            console.error('Error loading settings', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const handleUpdateSystem = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await adminService.updateSystemSettings({ systemName: systemConfig.systemName, systemLogo: systemConfig.systemLogo });
            toast.success('System settings updated successfully. Reload to see changes.');
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { error?: string } } }).response?.data?.error : undefined;
            toast.error(msg || 'Error updating system settings');
        }
    };

    const handleUpdateFees = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!feeConfig) return;
        try {
            await adminService.updateFees(feeConfig);
            toast.success('Fees updated successfully');
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { error?: string } } }).response?.data?.error : undefined;
            toast.error(msg || 'Error updating fees');
        }
    };

    const handleCreatePromo = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await adminService.createPromoCode(newPromo);
            setIsCreatingPromo(false);
            setNewPromo({ code: '', type: 'percent', value: 0 });
            loadData();
            toast.success('Promo code created successfully');
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { error?: string } } }).response?.data?.error : undefined;
            toast.error(msg || 'Error creating promo code');
        }
    };

    const handleDeletePromo = async (id: string) => {
        if (!window.confirm('Are you sure?')) return;
        try {
            await adminService.deletePromoCode(id);
            loadData();
            toast.success('Promo code deleted');
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { error?: string } } }).response?.data?.error : undefined;
            toast.error(msg || 'Error deleting promo code');
        }
    };

    const handleCreateMode = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await adminService.createPaymentMode(newMode);
            setIsCreatingMode(false);
            setNewMode({ name: '', active: true, allowSplit: false });
            loadData();
            toast.success('Payment mode created');
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { error?: string } } }).response?.data?.error : undefined;
            toast.error(msg || 'Error creating payment mode');
        }
    };

    const handleToggleMode = async (mode: PaymentMode) => {
        try {
            await adminService.updatePaymentMode(mode.id, { active: !mode.active });
            loadData();
            toast.success(`Payment mode ${!mode.active ? 'enabled' : 'disabled'}`);
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { error?: string } } }).response?.data?.error : undefined;
            toast.error(msg || 'Error updating mode');
        }
    };

    const handleDeleteMode = async (id: string) => {
        if (!window.confirm('Delete this payment mode?')) return;
        try {
            await adminService.deletePaymentMode(id);
            loadData();
            toast.success('Payment mode deleted');
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { error?: string } } }).response?.data?.error : undefined;
            toast.error(msg || 'Error deleting payment mode');
        }
    };

    const promoColumns = [
        { header: 'Code', key: 'code' },
        {
            header: 'Discount',
            key: 'discount',
            render: (p: PromoCode) => (
                <span style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: '600' }}>
                    {p.type === 'percent' ? `${p.value}% Off` : `EGP${p.value} Off`}
                </span>
            ),
        },
        {
            header: 'Status',
            key: 'active',
            render: (p: PromoCode) => (
                <span style={{ fontSize: '11px', background: p.active ? 'rgba(0,230,118,0.1)' : 'rgba(255,82,82,0.1)', color: p.active ? 'var(--primary)' : 'var(--danger)', padding: '3px 8px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                    {p.active ? 'Active' : 'Inactive'}
                </span>
            ),
        },
    ];

    if (loading) return <div style={{ color: 'var(--text-muted)' }}>Loading settings...</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
            {/* System Branding */}
            <GlassPanel style={{ padding: '30px' }}>
                <h3 style={{ marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px' }}>
                    <Monitor size={20} color="var(--primary)" /> System Branding
                </h3>
                <form onSubmit={handleUpdateSystem} style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '400px' }}>
                    <Input
                        label="SYSTEM NAME"
                        value={systemConfig.systemName}
                        onChange={e => setSystemConfig({ ...systemConfig, systemName: e.target.value })}
                        required
                    />
                    <Input
                        label="SYSTEM LOGO URL"
                        value={systemConfig.systemLogo}
                        onChange={e => setSystemConfig({ ...systemConfig, systemLogo: e.target.value })}
                    />
                    <Button type="submit" style={{ marginTop: '10px', width: 'fit-content' }}>Save Branding</Button>
                </form>
            </GlassPanel>

            {/* Row 1: Fees + Promo */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '30px' }}>
                {/* Fee Configuration */}
                <GlassPanel style={{ padding: '30px' }}>
                    <h3 style={{ marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px' }}>
                        <Save size={20} color="var(--primary)" /> System Fees
                    </h3>
                    {feeConfig && (
                        <form onSubmit={handleUpdateFees} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <Input
                                label="SERVICE FEE (%)"
                                type="number"
                                value={feeConfig.serviceFeePercent}
                                onChange={e => setFeeConfig({ ...feeConfig, serviceFeePercent: parseFloat(e.target.value) })}
                            />
                            <Input
                                label="TAX (%)"
                                type="number"
                                value={feeConfig.taxPercent}
                                onChange={e => setFeeConfig({ ...feeConfig, taxPercent: parseFloat(e.target.value) })}
                            />
                            <Button type="submit" style={{ marginTop: '10px' }}>Update Fees</Button>
                        </form>
                    )}
                </GlassPanel>

                {/* Promo Codes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px' }}>
                            <Ticket size={20} color="var(--accent)" /> Promo Codes
                        </h3>
                        <Button onClick={() => setIsCreatingPromo(true)} size="small" icon={<Plus size={16} />}>New Code</Button>
                    </div>

                    {isCreatingPromo && (
                        <GlassPanel style={{ padding: '20px' }}>
                            <form onSubmit={handleCreatePromo} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                                <Input placeholder="PROMO CODE" value={newPromo.code} onChange={e => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })} required />
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <Select
                                        value={newPromo.type}
                                        options={[{ value: 'percent', label: '%' }, { value: 'fixed', label: 'EGP' }]}
                                        onChange={e => setNewPromo({ ...newPromo, type: e.target.value as 'percent' | 'fixed' })}
                                    />
                                    <Input type="number" placeholder="Val" value={newPromo.value} onChange={e => setNewPromo({ ...newPromo, value: parseFloat(e.target.value) })} style={{ width: '80px' }} required />
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <Button type="submit" size="small"><Plus size={14} /></Button>
                                    <Button type="button" variant="secondary" size="small" onClick={() => setIsCreatingPromo(false)}><X size={14} /></Button>
                                </div>
                            </form>
                        </GlassPanel>
                    )}

                    <DataTable
                        data={promoCodes}
                        columns={promoColumns}
                        actions={(p: PromoCode) => (
                            <Button onClick={() => handleDeletePromo(p.id)} size="small" variant="secondary" style={{ color: 'var(--danger)' }}><Trash2 size={16} /></Button>
                        )}
                    />
                </div>
            </div>

            {/* Row 2: Payment Modes */}
            <GlassPanel style={{ padding: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px' }}>
                        <CreditCard size={20} color="#4fc3f7" /> Payment Modes
                    </h3>
                    <Button onClick={() => setIsCreatingMode(v => !v)} size="small" icon={<Plus size={16} />}>Add Mode</Button>
                </div>

                {isCreatingMode && (
                    <form onSubmit={handleCreateMode} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '20px', padding: '20px', background: 'rgba(255,255,255,0.04)', borderRadius: '12px' }}>
                        <Input label="NAME" placeholder="e.g. CASH" value={newMode.name} onChange={e => setNewMode({ ...newMode, name: e.target.value.toUpperCase() })} required />
                        <Select
                            label="SPLIT ALLOWED"
                            value={newMode.allowSplit ? 'yes' : 'no'}
                            options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
                            onChange={e => setNewMode({ ...newMode, allowSplit: e.target.value === 'yes' })}
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <Button type="submit" size="small">Create</Button>
                            <Button type="button" variant="secondary" size="small" onClick={() => setIsCreatingMode(false)}>Cancel</Button>
                        </div>
                    </form>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {paymentModes.length === 0 && (
                        <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No payment modes configured</div>
                    )}
                    {paymentModes.map(mode => (
                        <div
                            key={mode.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '15px',
                                padding: '14px 20px',
                                borderRadius: '12px',
                                background: 'rgba(255,255,255,0.04)',
                                border: mode.active ? '1px solid rgba(0,230,118,0.2)' : '1px solid var(--border)',
                            }}
                        >
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: '600', fontSize: '14px' }}>{mode.name}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    {mode.allowSplit ? 'Split allowed' : 'No split'}
                                </div>
                            </div>
                            <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '6px', fontWeight: '700', textTransform: 'uppercase', background: mode.active ? 'rgba(0,230,118,0.1)' : 'rgba(255,255,255,0.05)', color: mode.active ? 'var(--primary)' : 'var(--text-muted)' }}>
                                {mode.active ? 'Active' : 'Inactive'}
                            </span>
                            <button onClick={() => handleToggleMode(mode)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: mode.active ? 'var(--primary)' : 'var(--text-muted)', display: 'flex', padding: '4px' }} title={mode.active ? 'Disable' : 'Enable'}>
                                {mode.active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                            </button>
                            <button onClick={() => handleDeleteMode(mode.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex', padding: '4px' }} title="Delete">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            </GlassPanel>
        </div>
    );
};

export default Settings;
