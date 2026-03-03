import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import GlassPanel from '../components/common/GlassPanel';
import Button from '../components/common/Button';
import { Input, Select } from '../components/common/FormElements';
import { adminService } from '../services/admin.service';
import { roomService } from '../services/room.service';
import { Wallet, TrendingDown, TrendingUp, CheckCircle, Plus, RefreshCw } from 'lucide-react';
import type { Room, Shift, PaymentMode } from '../types';

interface Props {
    currentShift?: Shift | null;
}

interface Owner {
    id: string;
    username: string;
    walletBalance: number;
}

interface WalletTx {
    id: string;
    amount: number;
    note?: string;
    createdAt: string;
}

const fmt = (n: number) => n.toFixed(2);

const OwnersView: React.FC<Props> = ({ currentShift }) => {
    const [owners, setOwners] = useState<Owner[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedOwner, setSelectedOwner] = useState<Owner | null>(null);
    const [walletTxs, setWalletTxs] = useState<WalletTx[]>([]);
    const [loadingTxs, setLoadingTxs] = useState(false);
    const [loading, setLoading] = useState(false);

    // Post payment / debit modal
    const [showPayModal, setShowPayModal] = useState(false);
    const [payMode, setPayMode] = useState<'settle' | 'debit'>('settle');
    const [payAmount, setPayAmount] = useState('');
    const [payNote, setPayNote] = useState('');
    const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
    const [selectedModeId, setSelectedModeId] = useState('');
    const [payLoading, setPayLoading] = useState(false);

    // Assign session modal
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [activeRooms, setActiveRooms] = useState<Room[]>([]);
    const [selectedRoomId, setSelectedRoomId] = useState('');
    const [assignLoading, setAssignLoading] = useState(false);

    const fetchOwners = async () => {
        setLoading(true);
        try {
            const res = await adminService.getOwners();
            const data = Array.isArray(res.data) ? res.data : [];
            setOwners(data);
            if (!selectedOwner && data.length > 0) {
                setSelectedOwner(data[0]);
            } else if (selectedOwner) {
                const updated = data.find((u: Owner) => u.id === selectedOwner.id);
                if (updated) setSelectedOwner(updated);
            }
        } catch (err) {
            console.error('Failed to load owners', err);
        } finally {
            setLoading(false);
        }
    };
    const fetchPaymentModes = async () => {
        try {
            const res = await adminService.getPaymentModes();
            setPaymentModes(res.data || []);
            if (res.data && res.data.length > 0) {
                const cash = res.data.find(m => m.name.toUpperCase() === 'CASH');
                setSelectedModeId(cash?.id || res.data[0].id);
            }
        } catch (err) {
            console.error('Failed to load payment modes', err);
        }
    };

    const fetchWalletHistory = async (ownerId: string) => {
        setLoadingTxs(true);
        try {
            const res = await adminService.getOwnerWallet(ownerId);
            setWalletTxs(res.data.transactions || []);
        } catch {
            setWalletTxs([]);
        } finally {
            setLoadingTxs(false);
        }
    };

    useEffect(() => {
        void fetchOwners();
        void fetchPaymentModes();
    }, []);

    useEffect(() => {
        if (selectedOwner) void fetchWalletHistory(selectedOwner.id);
    }, [selectedOwner?.id]);

    const handlePostPay = async () => {
        if (!selectedOwner || !payAmount || isNaN(Number(payAmount))) return;
        const signedAmount = payMode === 'settle' ? Math.abs(Number(payAmount)) : -Math.abs(Number(payAmount));
        if (signedAmount === 0) return;
        setPayLoading(true);
        try {
            await adminService.payOwner(selectedOwner.id, {
                amount: signedAmount,
                note: payNote || undefined,
                modeId: payMode === 'settle' ? selectedModeId : undefined,
                ...(currentShift ? { shiftId: currentShift.id } : {}),
            });
            setShowPayModal(false);
            setPayAmount('');
            setPayNote('');
            void fetchOwners();
            void fetchWalletHistory(selectedOwner.id);
            toast.success(payMode === 'settle' ? 'Payment posted successfully' : 'Debit added successfully');
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Failed to post payment');
        } finally {
            setPayLoading(false);
        }
    };

    const fetchActiveRooms = async () => {
        try {
            const res = await roomService.getRooms();
            const data = Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
            setActiveRooms(data.filter((r: Room) => r.status === 'occupied'));
        } catch (err) {
            console.error(err);
        }
    };

    const handleAssignSession = async () => {
        if (!selectedOwner || !selectedRoomId) return;
        setAssignLoading(true);
        try {
            const roomState = await roomService.getRoomState(selectedRoomId);
            const sessionId = roomState.data.activeSessionId;
            if (!sessionId) { toast.error('Room has no active session'); return; }

            const api = await import('../services/api').then(m => m.default);
            await api.post(`/sessions/${sessionId}/assign-owner`, { ownerUserId: selectedOwner.id });
            toast.success(`Session assigned to ${selectedOwner.username}. Amount will be deducted when session closes.`);
            setShowAssignModal(false);
            setSelectedRoomId('');
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Failed to assign session');
        } finally {
            setAssignLoading(false);
        }
    };

    const filteredOwners = owners.filter(o => o.username.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div style={{ display: 'flex', gap: '30px', height: 'calc(100vh - 180px)' }}>

            {/* Left Sidebar: Owners List */}
            <GlassPanel style={{ width: '280px', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Wallet size={20} color="var(--primary)" /> Owners
                    </h2>
                    <Input
                        placeholder="Search owners..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {loading && owners.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
                    ) : filteredOwners.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                            No owners found.<br />Assign the OWNER role in User Management.
                        </div>
                    ) : (
                        filteredOwners.map(owner => (
                            <div
                                key={owner.id}
                                onClick={() => setSelectedOwner(owner)}
                                style={{
                                    padding: '16px 20px',
                                    borderBottom: '1px solid var(--border)',
                                    cursor: 'pointer',
                                    background: selectedOwner?.id === owner.id ? 'rgba(0, 230, 118, 0.08)' : 'transparent',
                                    borderLeft: `4px solid ${selectedOwner?.id === owner.id ? 'var(--primary)' : 'transparent'}`,
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '4px' }}>{owner.username}</div>
                                <div style={{
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    color: owner.walletBalance < 0 ? 'var(--danger)' : 'var(--primary)',
                                    display: 'flex', alignItems: 'center', gap: '6px'
                                }}>
                                    {owner.walletBalance < 0 ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
                                    EGP {fmt(owner.walletBalance)}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </GlassPanel>

            {/* Right Side: Owner Details */}
            {selectedOwner ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', overflow: 'hidden' }}>

                    {/* Header Card */}
                    <GlassPanel style={{ padding: '24px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                        <div>
                            <h1 style={{ fontSize: '26px', fontWeight: '800', marginBottom: '4px' }}>{selectedOwner.username}</h1>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>ID: {selectedOwner.id}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>Current Balance</div>
                            <div style={{
                                fontSize: '30px',
                                fontWeight: '800',
                                color: selectedOwner.walletBalance < 0 ? 'var(--danger)' : 'var(--primary)'
                            }}>
                                EGP {fmt(selectedOwner.walletBalance)}
                            </div>
                            {selectedOwner.walletBalance < 0 && (
                                <div style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '4px' }}>⚠ Outstanding balance — payment required</div>
                            )}
                        </div>
                    </GlassPanel>

                    {/* Actions + History Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', flexShrink: 0 }}>
                        {/* Settle Account */}
                        <div style={{ padding: '20px', border: '1px solid var(--border)', borderRadius: '12px', background: 'rgba(0,230,118,0.03)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                <div style={{ padding: '8px', background: 'rgba(0, 230, 118, 0.1)', borderRadius: '8px', color: 'var(--primary)' }}>
                                    <Wallet size={18} />
                                </div>
                                <span style={{ fontWeight: '700' }}>Settle / Adjust Balance</span>
                            </div>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '15px' }}>
                                Post a payment to settle the owner's tab, or add a debit for future charges.
                            </p>
                            <Button onClick={() => { setPayMode('settle'); setShowPayModal(true); }}>Post Payment</Button>
                            <Button variant="secondary" onClick={() => { setPayMode('debit'); setShowPayModal(true); }} style={{ marginLeft: '8px' }}>Add Debit</Button>
                        </div>

                        {/* Assign Session */}
                        <div style={{ padding: '20px', border: '1px solid var(--border)', borderRadius: '12px', background: 'rgba(41,121,255,0.03)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                <div style={{ padding: '8px', background: 'rgba(41, 121, 255, 0.1)', borderRadius: '8px', color: '#2979ff' }}>
                                    <Plus size={18} />
                                </div>
                                <span style={{ fontWeight: '700' }}>Assign Room Session</span>
                            </div>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '15px' }}>
                                Link an active room session to this owner. The cost will be <strong>automatically deducted</strong> when the session closes.
                            </p>
                            <Button
                                variant="secondary"
                                onClick={() => { void fetchActiveRooms(); setShowAssignModal(true); }}
                            >
                                Assign Session
                            </Button>
                        </div>
                    </div>

                    {/* Wallet Transaction History */}
                    <GlassPanel style={{ flex: 1, padding: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Transaction History</h3>
                            <button onClick={() => void fetchWalletHistory(selectedOwner.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <RefreshCw size={16} />
                            </button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {loadingTxs ? (
                                <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading transactions...</div>
                            ) : walletTxs.length === 0 ? (
                                <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '30px' }}>No transactions yet</div>
                            ) : (
                                walletTxs.map(tx => (
                                    <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                                        <div>
                                            <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '2px' }}>{tx.note || 'Transaction'}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                {new Date(tx.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                            </div>
                                        </div>
                                        <div style={{
                                            fontWeight: '800',
                                            fontSize: '15px',
                                            color: tx.amount >= 0 ? 'var(--primary)' : 'var(--danger)'
                                        }}>
                                            {tx.amount >= 0 ? '+' : ''}EGP {fmt(tx.amount)}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </GlassPanel>
                </div>
            ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    Select an owner from the list
                </div>
            )}

            {/* Pay / Debit Modal */}
            {showPayModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <GlassPanel style={{ width: '420px', padding: '30px' }}>
                        <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '6px' }}>
                            {payMode === 'settle' ? '💰 Post Payment' : '📋 Add Debit'}
                        </h3>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                            {payMode === 'settle'
                                ? `Record a payment received from ${selectedOwner?.username} to reduce their balance.`
                                : `Add a debit charge to ${selectedOwner?.username}'s tab (allows negative balance for post-pay).`
                            }
                        </div>

                        {/* Toggle */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                            {(['settle', 'debit'] as const).map(m => (
                                <button key={m} onClick={() => setPayMode(m)} style={{
                                    flex: 1, padding: '8px', borderRadius: '8px', fontSize: '13px', fontWeight: '700',
                                    cursor: 'pointer', border: '1px solid',
                                    background: payMode === m ? (m === 'settle' ? 'rgba(0,230,118,0.15)' : 'rgba(255,82,82,0.15)') : 'rgba(255,255,255,0.04)',
                                    color: payMode === m ? (m === 'settle' ? 'var(--primary)' : 'var(--danger)') : 'var(--text-muted)',
                                    borderColor: payMode === m ? (m === 'settle' ? 'var(--primary)' : 'var(--danger)') : 'var(--border)',
                                }}>
                                    {m === 'settle' ? '✅ Settle (Credit)' : '➖ Debit (Post-Pay)'}
                                </button>
                            ))}
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>Amount (EGP)</label>
                            <Input
                                type="number"
                                placeholder="0.00"
                                value={payAmount}
                                onChange={(e) => setPayAmount(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>Note (Optional)</label>
                            <Input
                                placeholder="e.g. Cash payment, invoice #123..."
                                value={payNote}
                                onChange={(e) => setPayNote(e.target.value)}
                            />
                        </div>

                        {payMode === 'settle' && paymentModes.length > 0 && (
                            <div style={{ marginBottom: '20px' }}>
                                <Select
                                    label="Payment Mode"
                                    value={selectedModeId}
                                    options={paymentModes.map(m => ({ value: m.id, label: m.name }))}
                                    onChange={e => setSelectedModeId(e.target.value)}
                                />
                            </div>
                        )}

                        {/* Preview */}
                        {payAmount && !isNaN(Number(payAmount)) && Number(payAmount) > 0 && selectedOwner && (
                            <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', marginBottom: '20px', fontSize: '13px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Current balance</span>
                                    <span style={{ color: selectedOwner.walletBalance < 0 ? 'var(--danger)' : 'var(--primary)' }}>EGP {fmt(selectedOwner.walletBalance)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Balance after</span>
                                    <span style={{
                                        color: (selectedOwner.walletBalance + (payMode === 'settle' ? 1 : -1) * Number(payAmount)) < 0 ? 'var(--danger)' : 'var(--primary)'
                                    }}>
                                        EGP {fmt(selectedOwner.walletBalance + (payMode === 'settle' ? 1 : -1) * Number(payAmount))}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <Button variant="secondary" onClick={() => { setShowPayModal(false); setPayAmount(''); setPayNote(''); }}>Cancel</Button>
                            <Button loading={payLoading} onClick={() => void handlePostPay()} icon={<CheckCircle size={16} />}>
                                {payMode === 'settle' ? 'Confirm Payment' : 'Add Debit'}
                            </Button>
                        </div>
                    </GlassPanel>
                </div>
            )}

            {/* Assign Session Modal */}
            {showAssignModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <GlassPanel style={{ width: '440px', padding: '30px' }}>
                        <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>Assign Session to {selectedOwner?.username}</h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                            The full room charge will be <strong style={{ color: 'var(--primary)' }}>automatically deducted</strong> from this owner's wallet when the session closes. Negative balance is allowed for post-pay.
                        </p>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>Active Room Sessions</label>
                            <select
                                value={selectedRoomId}
                                onChange={(e) => setSelectedRoomId(e.target.value)}
                                style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '8px', boxSizing: 'border-box' }}
                            >
                                <option value="" style={{ background: '#1a1a1a' }}>-- Select Occupied Room --</option>
                                {activeRooms.map(r => (
                                    <option key={r.id} value={r.id} style={{ background: '#1a1a1a' }}>{r.name}</option>
                                ))}
                            </select>
                            {activeRooms.length === 0 && (
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>No active (occupied) rooms found.</div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <Button variant="secondary" onClick={() => { setShowAssignModal(false); setSelectedRoomId(''); }}>Cancel</Button>
                            <Button loading={assignLoading} onClick={() => void handleAssignSession()} disabled={!selectedRoomId}>
                                Assign & Confirm
                            </Button>
                        </div>
                    </GlassPanel>
                </div>
            )}
        </div >
    );
};

export default OwnersView;
