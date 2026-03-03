import React from 'react';

interface GlassPanelProps {
    children: React.ReactNode;
    style?: React.CSSProperties;
    className?: string;
    onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

const GlassPanel: React.FC<GlassPanelProps> = ({ children, style, className, onClick }) => {
    return (
        <div
            className={`glass-panel ${className || ''}`}
            style={style}
            onClick={onClick}
        >
            {children}
        </div>
    );
};

export default GlassPanel;
