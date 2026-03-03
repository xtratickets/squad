import React, { useState, useEffect, useCallback } from 'react';
import Login from './components/Login';
import { LayoutGrid, ShoppingCart, Settings, LogOut, Shield, Users, Calendar, History, Wrench } from 'lucide-react';
import { useSocket } from './hooks/useSocket';
import { roomService } from './services/room.service';
import AdminDashboard from './views/Admin/AdminDashboard';
import StaffDashboard from './views/StaffDashboard';
import OrdersView from './views/OrdersView';
import OwnersView from './views/OwnersView';
import OwnerDashboardView from './views/OwnerDashboardView';
import ReservationsView from './views/ReservationsView';
import ShiftHistoryView from './views/ShiftHistoryView';
import GuestBookingView from './views/GuestBookingView';
import GuestOrderingView from './views/GuestOrderingView';
import OperationsDashboard from './views/OperationsDashboard';
import { systemService } from './services/system.service';
import { BASE_URL } from './services/api';
import type { Room, Shift, User, SystemSettings } from './types';

// Handles both legacy format (role: "ADMIN" string) and new format (role: { name: "ADMIN" })
import { Toaster } from 'react-hot-toast';

const getRoleName = (user: User | null): string => {
  if (!user) return '';
  if (typeof user.role === 'string') return (user.role as string);
  return user.role?.name ?? '';
};

const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('squad_token'));
  const [user, setUser] = useState<User | null>(JSON.parse(localStorage.getItem('squad_user') || 'null'));
  const [activeView, setActiveView] = useState(() => {
    const savedUser = JSON.parse(localStorage.getItem('squad_user') || 'null');
    return getRoleName(savedUser) === 'OWNER' ? 'owner-dashboard' : getRoleName(savedUser) === 'OPERATION' ? 'operations' : 'dashboard';
  });
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentShift, setCurrentShift] = useState<Shift | null>(JSON.parse(localStorage.getItem('squad_shift') || 'null'));
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({ systemName: 'SQUAD', systemLogo: '', version: '1.0.0' });

  const fetchRooms = useCallback(async () => {
    try {
      const res = await roomService.getRooms();
      setRooms(res.data);
    } catch (err) {
      console.error('Error fetching rooms', err);
    }
  }, []);

  const handleUpdate = useCallback((type: string, data: unknown) => {
    if (type === 'room') void fetchRooms();
    if (type === 'shift') {
      if (data) {
        setCurrentShift(data as Shift);
        localStorage.setItem('squad_shift', JSON.stringify(data));
      } else {
        setCurrentShift(null);
        localStorage.removeItem('squad_shift');
      }
    }
    // fetchRooms is stable (empty deps in useCallback), safe to ignore here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useSocket(BASE_URL, handleUpdate);

  useEffect(() => {
    systemService.getSettings().then(res => {
      setSystemSettings(res.data);
      // Update document title and favicon
      document.title = `${(res.data?.systemName || 'SQUAD').toUpperCase()} POS`;
      if (res.data.systemLogo) {
        let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'shortcut icon';
          document.getElementsByTagName('head')[0].appendChild(link);
        }
        link.href = res.data.systemLogo;
      }
    }).catch(console.error);
  }, []);

  // Fetch rooms and active shift on initial auth
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (token) {
      void fetchRooms();
      if (!currentShift) {
        roomService.getActiveShift().then(res => {
          if (res.data) {
            setCurrentShift(res.data);
            localStorage.setItem('squad_shift', JSON.stringify(res.data));
          }
        }).catch(() => { /* ignore 404 */ });
      }
    }
  }, [token]); // leaving exact deps as before to avoid loop bugs with currentShift

  const handleLogin = (newToken: string, newUser: User) => {
    localStorage.setItem('squad_token', newToken);
    localStorage.setItem('squad_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = () => {
    localStorage.clear();
    setToken(null);
    setUser(null);
  };

  const isGuestBooking = window.location.hash.includes('#/book') || window.location.pathname.includes('/book');
  const isGuestRoom = window.location.hash.includes('#/room/') || window.location.pathname.includes('/room/') ||
    window.location.hash.includes('#/order/') || window.location.pathname.includes('/order/');

  if (isGuestBooking) {
    return <GuestBookingView systemSettings={systemSettings} />;
  }

  if (isGuestRoom) {
    const match = window.location.hash.match(/#\/(?:room|order)\/([a-zA-Z0-9-]+)/) || window.location.pathname.match(/\/(?:room|order)\/([a-zA-Z0-9-]+)/);
    const roomId = match ? match[1] : '';
    if (roomId) return <GuestOrderingView roomId={roomId} systemSettings={systemSettings} />;
  }

  if (!token) {
    return <Login onLogin={handleLogin} systemSettings={systemSettings} />;
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
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
      <aside className="no-print" style={{
        width: '260px',
        background: 'var(--surface-solid)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '30px 0',
        zIndex: 100
      }}>
        <div style={{
          fontSize: '28px',
          fontWeight: '800',
          color: 'var(--primary)',
          textAlign: 'center',
          marginBottom: '50px',
          letterSpacing: '4px',
          textShadow: '0 0 20px rgba(0, 230, 118, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px'
        }}>
          {systemSettings.systemLogo && (
            <img src={systemSettings.systemLogo} alt="Logo" style={{ width: '60px', borderRadius: '12px' }} />
          )}
          {systemSettings?.systemName?.toUpperCase() || 'SQUAD'}
        </div>

        <nav>
          <ul style={{ listStyle: 'none' }}>
            {getRoleName(user) !== 'OWNER' && getRoleName(user) !== 'OPERATION' && (
              <>
                <li onClick={() => setActiveView('dashboard')} style={navItemStyle(activeView === 'dashboard')}>
                  <LayoutGrid size={20} /> Dashboard
                </li>
                <li onClick={() => setActiveView('orders')} style={navItemStyle(activeView === 'orders')}>
                  <ShoppingCart size={20} /> Orders
                </li>
                <li onClick={() => setActiveView('owners')} style={navItemStyle(activeView === 'owners')}>
                  <Users size={20} /> Owners
                </li>
                <li onClick={() => setActiveView('reservations')} style={navItemStyle(activeView === 'reservations')}>
                  <Calendar size={20} /> Reservations
                </li>
                <li onClick={() => setActiveView('history')} style={navItemStyle(activeView === 'history')}>
                  <History size={20} /> Shift History
                </li>
              </>
            )}
            {getRoleName(user) === 'OWNER' && (
              <li onClick={() => setActiveView('owner-dashboard')} style={navItemStyle(activeView === 'owner-dashboard')}>
                <LayoutGrid size={20} /> My Dashboard
              </li>
            )}
            {getRoleName(user) === 'ADMIN' && (
              <li onClick={() => setActiveView('admin')} style={navItemStyle(activeView === 'admin')}>
                <Shield size={20} /> Admin
              </li>
            )}
            {getRoleName(user) === 'OPERATION' && (
              <li onClick={() => setActiveView('operations')} style={navItemStyle(activeView === 'operations')}>
                <Wrench size={20} /> Operations
              </li>
            )}
            <li onClick={() => setActiveView('settings')} style={navItemStyle(activeView === 'settings')}>
              <Settings size={20} /> Settings
            </li>
          </ul>
        </nav>

        <div style={{ marginTop: 'auto', padding: '20px', borderTop: '1px solid var(--border)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '5px' }}>SHIFT: {currentShift ? 'ACTIVE' : 'CLOSED'}</div>
          {currentShift ? (
            <div style={{ color: 'var(--primary)', fontSize: '11px', marginBottom: '10px' }}>ID: {currentShift.id.slice(0, 8)}</div>
          ) : null}
          <button onClick={handleLogout} className="secondary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '10px' }}>
            <LogOut size={16} /> LOGOUT
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        <header className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: '700' }}>{activeView?.toUpperCase() || 'VIEW'}</h1>
          <div style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{user?.username} ({user?.role.name})</div>
        </header>

        {activeView === 'dashboard' && (
          <StaffDashboard
            rooms={rooms}
            fetchRooms={() => void fetchRooms()}
            currentShift={currentShift}
            onShiftChange={setCurrentShift}
            username={user?.username ?? 'Staff'}
            userRole={getRoleName(user)}
          />
        )}
        {activeView === 'orders' && <OrdersView rooms={rooms} currentShift={currentShift} />}
        {activeView === 'owners' && <OwnersView currentShift={currentShift} />}
        {activeView === 'owner-dashboard' && <OwnerDashboardView user={user!} />}
        {activeView === 'reservations' && <ReservationsView />}
        {activeView === 'history' && <ShiftHistoryView user={user} />}
        {activeView === 'admin' && getRoleName(user) === 'ADMIN' && <AdminDashboard />}
        {activeView === 'operations' && getRoleName(user) === 'OPERATION' && <OperationsDashboard />}
        {activeView === 'settings' && (
          <div style={{ color: 'var(--text-muted)' }}>Staff settings coming soon...</div>
        )}
      </main>
    </div>
  );
};

const navItemStyle = (active: boolean): React.CSSProperties => ({
  padding: '16px 30px',
  cursor: 'pointer',
  transition: 'all 0.3s',
  display: 'flex',
  alignItems: 'center',
  gap: '15px',
  color: active ? 'var(--primary)' : 'var(--text-muted)',
  fontWeight: '500',
  background: active ? 'linear-gradient(90deg, rgba(0, 230, 118, 0.1) 0%, transparent 100%)' : 'transparent',
  borderLeft: active ? '4px solid var(--primary)' : '4px solid transparent',
});

export default App;
