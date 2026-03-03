import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, style, ...props }) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
            {label && <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{label.toUpperCase()}</label>}
            <input
                {...props}
                style={{
                    ...style,
                    border: error ? '1px solid var(--danger)' : undefined
                }}
            />
            {error && <span style={{ fontSize: '11px', color: 'var(--danger)' }}>{error}</span>}
        </div>
    );
};

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    options: { value: string | number; label: string }[];
    error?: string;
}

export const Select: React.FC<SelectProps> = ({ label, options, error, style, ...props }) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
            {label && <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{label.toUpperCase()}</label>}
            <select
                {...props}
                style={{
                    ...style,
                    padding: '14px',
                    background: 'rgba(0,0,0,0.3)',
                    color: 'white',
                    border: error ? '1px solid var(--danger)' : '1px solid var(--border)',
                    borderRadius: '14px'
                }}
            >
                {options.map(opt => (
                    <option key={opt.value} value={opt.value} style={{ background: '#111' }}>
                        {opt.label}
                    </option>
                ))}
            </select>
            {error && <span style={{ fontSize: '11px', color: 'var(--danger)' }}>{error}</span>}
        </div>
    );
};
