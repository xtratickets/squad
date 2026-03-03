import { prisma } from './prisma.service';
import { logger } from '../utils/logger';

export class AuditService {
    static async log(
        entity: string,
        entityId: string,
        action: string,
        userId: string,
        before?: any,
        after?: any
    ) {
        try {
            await prisma.auditLog.create({
                data: {
                    entity,
                    entityId,
                    action,
                    userId,
                    before: before ? JSON.stringify(before) : null,
                    after: after ? JSON.stringify(after) : null,
                },
            });
        } catch (error) {
            logger.error({ error, entity, entityId, action }, 'Failed to create audit log');
        }
    }
}
