import { useState } from 'react';
import toast from 'react-hot-toast';
import { FileSpreadsheet, FileText } from 'lucide-react';
import Button from './Button';
import { exportExcel, exportPdf, type ExportColumn } from '../../utils/exporter';

interface ExportButtonsProps<T> {
    title: string;
    filename: string;
    columns: ExportColumn<T>[];
    /** Rows to export. May fetch the complete (unpaginated) data set. */
    getRows: () => Promise<T[]> | T[];
    summary?: (rows: T[]) => { label: string; value: string | number }[];
}

function ExportButtons<T>({ title, filename, columns, getRows, summary }: ExportButtonsProps<T>) {
    const [busy, setBusy] = useState<'excel' | 'pdf' | null>(null);

    const run = async (kind: 'excel' | 'pdf') => {
        setBusy(kind);
        try {
            const rows = await getRows();
            if (rows.length === 0) {
                toast.error('Nothing to export for the current filters');
                return;
            }
            const opts = { title, filename, columns, rows, summary: summary?.(rows) };
            if (kind === 'excel') exportExcel(opts);
            else exportPdf(opts);
        } catch (err) {
            console.error('Export failed', err);
            toast.error('Export failed');
        } finally {
            setBusy(null);
        }
    };

    return (
        <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="secondary" size="small" loading={busy === 'excel'} disabled={busy !== null} onClick={() => run('excel')} icon={<FileSpreadsheet size={16} />}>
                Excel
            </Button>
            <Button variant="secondary" size="small" loading={busy === 'pdf'} disabled={busy !== null} onClick={() => run('pdf')} icon={<FileText size={16} />}>
                PDF
            </Button>
        </div>
    );
}

export default ExportButtons;
