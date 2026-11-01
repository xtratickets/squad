const DAY_MS = 86400000;

/**
 * Builds an inclusive [startDate, endDate] range for Prisma `createdAt`-style filters.
 * A date-only `endDate` covers the whole day (exclusive bound = next midnight); an ISO timestamp is used as-is.
 * Returns undefined when neither bound is a valid date.
 */
export const buildDateRange = (startDate?: unknown, endDate?: unknown): { gte?: Date; lt?: Date } | undefined => {
    const range: { gte?: Date; lt?: Date } = {};

    if (typeof startDate === 'string' && startDate) {
        const start = new Date(startDate);
        if (!isNaN(start.getTime())) range.gte = start;
    }
    if (typeof endDate === 'string' && endDate) {
        const end = new Date(endDate);
        // A bare date ("2026-10-31") means the whole day; a full timestamp is an exact exclusive bound.
        if (!isNaN(end.getTime())) range.lt = new Date(end.getTime() + (endDate.includes('T') ? 0 : DAY_MS));
    }

    return range.gte || range.lt ? range : undefined;
};

/** Returns a valid IANA timezone name, falling back to UTC. */
export const safeTimeZone = (tz: unknown): string => {
    // Named zones only (e.g. Africa/Cairo): fixed offsets like "+03:00" mean the opposite in Postgres.
    if (typeof tz !== 'string' || !/^[A-Za-z][A-Za-z0-9_+\-/]*$/.test(tz)) return 'UTC';
    try {
        new Intl.DateTimeFormat('en', { timeZone: tz });
        return tz;
    } catch {
        return 'UTC';
    }
};
