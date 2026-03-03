"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
const prisma_service_1 = require("./prisma.service");
const logger_1 = require("../utils/logger");
class AuditService {
    static async log(entity, entityId, action, userId, before, after) {
        try {
            await prisma_service_1.prisma.auditLog.create({
                data: {
                    entity,
                    entityId,
                    action,
                    userId,
                    before: before ? JSON.stringify(before) : null,
                    after: after ? JSON.stringify(after) : null,
                },
            });
        }
        catch (error) {
            logger_1.logger.error({ error, entity, entityId, action }, 'Failed to create audit log');
        }
    }
}
exports.AuditService = AuditService;
