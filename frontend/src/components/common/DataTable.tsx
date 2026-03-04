import React, { useState } from 'react';
import GlassPanel from './GlassPanel';
import { Search } from 'lucide-react';

interface Column<T> {
    header: string;
    key: keyof T | string;
    render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
    data: T[];
    columns: Column<T>[];
    searchKey?: keyof T | string;
    searchPlaceholder?: string;
    actions?: (item: T) => React.ReactNode;
}

function DataTable<T extends { id: string | number }>({
    data,
    columns,
    searchKey,
    searchPlaceholder = "Search...",
    actions
}: DataTableProps<T>) {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredData = searchTerm && searchKey
        ? data.filter(item => {
            const value = (item as Record<string, unknown>)[searchKey as string];
            return String(value).toLowerCase().includes(searchTerm.toLowerCase());
        })
        : data;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {searchKey && (
                <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
                    <Search size={18} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        placeholder={searchPlaceholder}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ paddingLeft: '45px', width: '100%', boxSizing: 'border-box' }}
                    />
                </div>
            )}

            <GlassPanel style={{ overflow: 'hidden' }}>
                <div className="scrollable-x">
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
                                {columns.map((col, idx) => (
                                    <th key={idx} style={{ padding: '20px' }}>{col.header}</th>
                                ))}
                                {actions && <th style={{ padding: '20px', textAlign: 'right' }}>Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.map((item) => (
                                <tr key={item.id} className="data-table-row">
                                    {columns.map((col, idx) => (
                                        <td key={idx} style={{ padding: '20px' }}>
                                            {col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key as string] ?? '')}
                                        </td>
                                    ))}
                                    {actions && (
                                        <td style={{ padding: '20px', textAlign: 'right' }}>
                                            {actions(item)}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </GlassPanel>
        </div>
    );
}

export default DataTable;
