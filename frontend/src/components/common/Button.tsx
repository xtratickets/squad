import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger';
    size?: 'small' | 'medium' | 'large';
    loading?: boolean;
    icon?: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    size = 'medium',
    loading,
    icon,
    className,
    disabled,
    ...props
}) => {
    const variantClass = variant === 'primary' ? '' : variant;
    const sizeClass = size !== 'medium' ? size : '';

    return (
        <button
            className={[variantClass, sizeClass, className].filter(Boolean).join(' ')}
            disabled={disabled || loading}
            {...props}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {loading ? '...' : (
                    <>
                        {icon}
                        {children}
                    </>
                )}
            </div>
        </button>
    );
};

export default Button;
