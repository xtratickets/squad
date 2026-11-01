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
    onSearch?: (term: string) => void;
    loading?: boolean;
    /** Enables a checkbox column. Selection is controlled by the parent. */
    selectable?: boolean;
    selectedIds?: Set<string | number>;
    onSelectionChange?: (ids: Set<string | number>) => void;
}

function DataTable<T extends { id: string | number }>({
    data,
    columns,
    searchKey,
    searchPlaceholder = "Search...",
    actions,
    onSearch,
    loading,
    selectable,
    selectedIds,
    onSelectionChange
}: DataTableProps<T>) {
    const [searchTerm, setSearchTerm] = useState('');

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchTerm(value);
        if (onSearch) {
            onSearch(value);
        }
    };

    const filteredData = onSearch || (!searchTerm || !searchKey)
        ? data
        : data.filter(item => {
            const value = (item as Record<string, unknown>)[searchKey as string];
            return String(value).toLowerCase().includes(searchTerm.toLowerCase());
        });

    const selected = selectedIds ?? new Set<string | number>();
    const visibleSelected = filteredData.filter(item => selected.has(item.id)).length;
    const allVisibleSelected = filteredData.length > 0 && visibleSelected === filteredData.length;

    const toggleAll = () => {
        const next = new Set(selected);
        if (allVisibleSelected) filteredData.forEach(item => next.delete(item.id));
        else filteredData.forEach(item => next.add(item.id));
        onSelectionChange?.(next);
    };

    const toggleOne = (id: string | number) => {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id); else next.add(id);
        onSelectionChange?.(next);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative' }}>
            {searchKey && (
                <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
                    <Search size={18} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        placeholder={searchPlaceholder}
                        value={searchTerm}
                        onChange={handleSearchChange}
                        style={{ paddingLeft: '45px', width: '100%', boxSizing: 'border-box' }}
                    />
                </div>
            )}

            {loading && (
                <div style={{
                    position: 'absolute', inset: 0, top: '58px', background: 'rgba(0,0,0,0.1)',
                    backdropFilter: 'blur(1px)', zIndex: 10, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', borderRadius: '12px'
                }}>
                    <div style={{ color: 'var(--primary)', fontSize: '13px', fontWeight: '600' }}>Loading...</div>
                </div>
            )}

            <GlassPanel style={{ overflow: 'hidden' }}>
                <div className="scrollable-x">
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
                                {selectable && (
                                    <th style={{ padding: '20px', width: '44px' }}>
                                        <input
                                            type="checkbox"
                                            aria-label="Select all rows"
                                            checked={allVisibleSelected}
                                            ref={el => { if (el) el.indeterminate = visibleSelected > 0 && !allVisibleSelected; }}
                                            onChange={toggleAll}
                                            style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                                        />
                                    </th>
                                )}
                                {columns.map((col, idx) => (
                                    <th key={idx} style={{ padding: '20px' }}>{col.header}</th>
                                ))}
                                {actions && <th style={{ padding: '20px', textAlign: 'right' }}>Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.map((item) => (
                                <tr key={item.id} className="data-table-row" style={selectable && selected.has(item.id) ? { background: 'rgba(0,230,118,0.06)' } : undefined}>
                                    {selectable && (
                                        <td style={{ padding: '20px', width: '44px' }}>
                                            <input
                                                type="checkbox"
                                                aria-label="Select row"
                                                checked={selected.has(item.id)}
                                                onChange={() => toggleOne(item.id)}
                                                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                                            />
                                        </td>
                                    )}
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
