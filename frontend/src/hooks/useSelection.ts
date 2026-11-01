import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';

export type RowId = string | number;

export function useSelection() {
    const [selected, setSelected] = useState<Set<RowId>>(new Set());

    const clear = useCallback(() => setSelected(new Set()), []);
    /** Drops selected ids that are no longer present (e.g. after a reload). */
    const prune = useCallback((validIds: RowId[]) => {
        setSelected(prev => {
            const valid = new Set(validIds);
            const next = new Set([...prev].filter(id => valid.has(id)));
            return next.size === prev.size ? prev : next;
        });
    }, []);

    return { selected, setSelected, clear, prune, ids: [...selected] as string[] };
}

const messageOf = (reason: unknown) =>
    reason && typeof reason === 'object' && 'response' in reason
        ? (reason as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;

/**
 * Runs `action` for every id (a few at a time) and reports partial failures
 * instead of aborting on the first error. Returns the ids that succeeded.
 */
export async function runBulk(ids: string[], action: (id: string) => Promise<unknown>, verb: string): Promise<string[]> {
    const succeeded: string[] = [];
    const errors: string[] = [];
    const CONCURRENCY = 4;

    for (let i = 0; i < ids.length; i += CONCURRENCY) {
        const chunk = ids.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(chunk.map(id => action(id)));
        results.forEach((r, idx) => {
            if (r.status === 'fulfilled') succeeded.push(chunk[idx]);
            else errors.push(messageOf(r.reason) ?? 'Unknown error');
        });
    }

    if (errors.length === 0) {
        toast.success(`${verb}: ${succeeded.length} item${succeeded.length === 1 ? '' : 's'}`);
    } else if (succeeded.length === 0) {
        toast.error(`${verb} failed: ${errors[0]}`);
    } else {
        toast.error(`${verb}: ${succeeded.length} done, ${errors.length} failed (${errors[0]})`);
    }
    return succeeded;
}
