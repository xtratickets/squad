import React from 'react';
import { X } from 'lucide-react';
import GlassPanel from './GlassPanel';
import Button from './Button';

interface BulkActionBarProps {
    count: number;
    onClear: () => void;
    children: React.ReactNode;
}

/** Appears above a table once at least one row is selected. */
const BulkActionBar: React.FC<BulkActionBarProps> = ({ count, onClear, children }) => {
    if (count === 0) return null;
    return (
        <GlassPanel style={{
            padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
            border: '1px solid var(--primary)',
        }}>
            <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--primary)' }}>{count} selected</span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1 }}>{children}</div>
            <Button variant="secondary" size="small" onClick={onClear} icon={<X size={14} />}>Clear</Button>
        </GlassPanel>
    );
};

export default BulkActionBar;
