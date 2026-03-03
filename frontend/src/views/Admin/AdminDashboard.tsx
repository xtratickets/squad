import React, { useState } from 'react';
import Analytics from './Analytics';
import UserManagement from './UserManagement';
import RoomManagement from './RoomManagement';
import ProductManagement from './ProductManagement';
import ProductSales from './ProductSales';
import ExpensesManagement from './ExpensesManagement';
import SalaryManagement from './SalaryManagement';
import ReservationsManagement from './ReservationsManagement';
import InventoryLogs from './InventoryLogs';
import TransactionHistory from './TransactionHistory';
import Settings from './Settings';
import ShiftManagement from './ShiftManagement';
import PromoCodeManagement from './PromoCodeManagement';
import {
    BarChart3, Users, Home, Box, Settings as SettingsIcon,
    CreditCard, Briefcase, Calendar, ScrollText, History, Clock, Tag
} from 'lucide-react';
import GlassPanel from '../../components/common/GlassPanel';

type SubView =
    | 'analytics' | 'users' | 'rooms' | 'products' | 'sales'
    | 'expenses' | 'salaries' | 'reservations'
    | 'inventory' | 'transactions' | 'shifts' | 'settings' | 'promoCodes';

const AdminDashboard: React.FC = () => {
    const [subView, setSubView] = useState<SubView>('analytics');

    const renderSubView = () => {
        switch (subView) {
            case 'analytics': return <Analytics />;
            case 'users': return <UserManagement />;
            case 'rooms': return <RoomManagement />;
            case 'products': return <ProductManagement />;
            case 'sales': return <ProductSales />;
            case 'expenses': return <ExpensesManagement />;
            case 'salaries': return <SalaryManagement />;
            case 'reservations': return <ReservationsManagement />;
            case 'inventory': return <InventoryLogs />;
            case 'transactions': return <TransactionHistory />;
            case 'shifts': return <ShiftManagement />;
            case 'settings': return <Settings />;
            case 'promoCodes': return <PromoCodeManagement />;
            default: return <Analytics />;
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            {/* Sub-navigation Tabs */}
            <GlassPanel style={{
                display: 'flex',
                gap: '8px',
                padding: '10px',
                width: '100%',
                overflowX: 'auto',
                border: '1px solid var(--border)',
                scrollbarWidth: 'none',
            }}>
                <AdminTab active={subView === 'analytics'} onClick={() => setSubView('analytics')} icon={<BarChart3 size={17} />} label="Analytics" />
                <AdminTab active={subView === 'users'} onClick={() => setSubView('users')} icon={<Users size={17} />} label="Users" />
                <AdminTab active={subView === 'rooms'} onClick={() => setSubView('rooms')} icon={<Home size={17} />} label="Rooms" />
                <AdminTab active={subView === 'products'} onClick={() => setSubView('products')} icon={<Box size={17} />} label="Products" />
                <AdminTab active={subView === 'sales'} onClick={() => setSubView('sales')} icon={<BarChart3 size={17} />} label="Sales Report" />
                <AdminTab active={subView === 'expenses'} onClick={() => setSubView('expenses')} icon={<CreditCard size={17} />} label="Expenses" />
                <AdminTab active={subView === 'salaries'} onClick={() => setSubView('salaries')} icon={<Briefcase size={17} />} label="Salaries" />
                <AdminTab active={subView === 'reservations'} onClick={() => setSubView('reservations')} icon={<Calendar size={17} />} label="Reservations" />
                <AdminTab active={subView === 'inventory'} onClick={() => setSubView('inventory')} icon={<ScrollText size={17} />} label="Inventory" />
                <AdminTab active={subView === 'transactions'} onClick={() => setSubView('transactions')} icon={<History size={17} />} label="History" />
                <AdminTab active={subView === 'shifts'} onClick={() => setSubView('shifts')} icon={<Clock size={17} />} label="Shifts" />
                <AdminTab active={subView === 'promoCodes'} onClick={() => setSubView('promoCodes')} icon={<Tag size={17} />} label="Promo Codes" />
                <AdminTab active={subView === 'settings'} onClick={() => setSubView('settings')} icon={<SettingsIcon size={17} />} label="Settings" />
            </GlassPanel>

            <div style={{ marginTop: '10px' }}>
                {renderSubView()}
            </div>
        </div>
    );
};

const AdminTab: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
    <div
        onClick={onClick}
        className={`admin-tab ${active ? 'active' : ''}`}
    >
        {icon} {label}
    </div>
);

export default AdminDashboard;
