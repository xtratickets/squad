import React, { useState } from 'react';
import type { User, SystemSettings } from '../types';
import { authService } from '../services/auth.service';
import GlassPanel from './common/GlassPanel';
import Button from './common/Button';
import { Input } from './common/FormElements';

interface LoginProps {
    onLogin: (token: string, user: User) => void;
    systemSettings: SystemSettings;
}

const Login: React.FC<LoginProps> = ({ onLogin, systemSettings }) => {
    const [username, setUsername] = useState('admin');
    const [password, setPassword] = useState('admin123');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const { token, user } = await authService.login({ username, password });
            onLogin(token, user);
        } catch (err: unknown) {
            const errorMessage = err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
                : undefined;
            setError(errorMessage || 'Server offline or connection error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            width: '100vw',
            background: 'rgba(10, 10, 10, 0.8)',
            position: 'fixed',
            top: 0,
            left: 0,
            zIndex: 1000
        }}>
            <GlassPanel style={{ padding: '60px', width: '450px' }}>
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    {systemSettings.systemLogo && (
                        <img
                            src={systemSettings.systemLogo}
                            alt="Logo"
                            style={{ width: '80px', height: '80px', objectFit: 'contain', marginBottom: '20px', borderRadius: '16px' }}
                        />
                    )}
                    <h2 style={{ color: 'var(--primary)', letterSpacing: '4px', margin: 0 }}>
                        {systemSettings.systemName.toUpperCase()}
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '10px', letterSpacing: '2px' }}>MANAGEMENT SYSTEM</p>
                </div>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <Input
                        label="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Enter username"
                        required
                    />
                    <Input
                        label="Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password"
                        required
                    />
                    <Button type="submit" loading={loading} style={{ marginTop: '20px' }}>
                        SIGN IN
                    </Button>
                    {error && (
                        <p style={{ color: 'var(--danger)', fontSize: '13px', textAlign: 'center', marginTop: '10px' }}>
                            {error}
                        </p>
                    )}
                </form>
            </GlassPanel>
        </div>
    );
};

export default Login;
