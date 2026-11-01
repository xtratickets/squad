import * as XLSX from 'xlsx';

export interface ExportColumn<T> {
    header: string;
    /** Plain value written to the file (numbers stay numeric in Excel). */
    value: (row: T) => string | number | null | undefined;
}

export interface ExportOptions<T> {
    title: string;
    filename: string;
    columns: ExportColumn<T>[];
    rows: T[];
    /** Optional label/value pairs shown above the table (e.g. totals, date range). */
    summary?: { label: string; value: string | number }[];
}

const safeName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, '_');
const stamp = () => new Date().toISOString().slice(0, 10);

export const exportExcel = <T,>({ title, filename, columns, rows, summary }: ExportOptions<T>) => {
    const header = columns.map(c => c.header);
    const body = rows.map(r => columns.map(c => c.value(r) ?? ''));

    const aoa: (string | number)[][] = [];
    if (summary?.length) {
        summary.forEach(s => aoa.push([s.label, s.value]));
        aoa.push([]);
    }
    aoa.push(header, ...body);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = columns.map((c, i) => {
        const longest = Math.max(c.header.length, ...body.slice(0, 200).map(r => String(r[i] ?? '').length));
        return { wch: Math.min(Math.max(longest + 2, 10), 50) };
    });

    const wb = XLSX.utils.book_new();
    // Sheet names are limited to 31 chars and cannot contain : \ / ? * [ ]
    XLSX.utils.book_append_sheet(wb, ws, title.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'Report');
    XLSX.writeFile(wb, `${safeName(filename)}_${stamp()}.xlsx`);
};

const escapeHtml = (value: unknown) =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

/**
 * PDF export via the browser's print engine ("Save as PDF").
 * Unlike a canvas/PDF library this renders Arabic / RTL text correctly.
 */
export const exportPdf = <T,>({ title, filename, columns, rows, summary }: ExportOptions<T>) => {
    const summaryHtml = summary?.length
        ? `<div class="summary">${summary.map(s => `<div><span>${escapeHtml(s.label)}</span><strong>${escapeHtml(s.value)}</strong></div>`).join('')}</div>`
        : '';

    const thead = columns.map(c => `<th>${escapeHtml(c.header)}</th>`).join('');
    const tbody = rows
        .map(r => `<tr>${columns.map(c => {
            const v = c.value(r);
            return `<td dir="auto"${typeof v === 'number' ? ' class="num"' : ''}>${escapeHtml(v)}</td>`;
        }).join('')}</tr>`)
        .join('');

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(safeName(filename))}_${stamp()}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color: #111; font-size: 11px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .meta { color: #666; margin-bottom: 12px; }
  .summary { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; }
  .summary div { border: 1px solid #ddd; border-radius: 6px; padding: 6px 12px; }
  .summary span { display: block; color: #666; font-size: 10px; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ddd; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { background: #f1f3f5; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  tr { page-break-inside: avoid; }
  thead { display: table-header-group; }
</style></head><body>
<h1>${escapeHtml(title)}</h1>
<div class="meta">Generated ${escapeHtml(new Date().toLocaleString())} &middot; ${rows.length} rows</div>
${summaryHtml}
<table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>
</body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) {
        iframe.remove();
        throw new Error('Unable to open the print preview');
    }

    doc.open();
    doc.write(html);
    doc.close();

    const cleanup = () => setTimeout(() => iframe.remove(), 1000);
    win.onafterprint = cleanup;
    // Give the iframe a tick to lay out before printing.
    setTimeout(() => {
        win.focus();
        win.print();
        // Fallback for browsers that never fire afterprint.
        setTimeout(cleanup, 60000);
    }, 250);
};
