"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUsersList = exports.deleteUser = exports.getRoles = exports.updateUser = exports.createUser = exports.getUsers = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_service_1 = require("../../services/prisma.service");
const logger_1 = require("../../utils/logger");
const getUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 50;
        const [users, total] = await Promise.all([
            prisma_service_1.prisma.user.findMany({
                include: { role: true },
                skip: (page - 1) * pageSize,
                take: pageSize,
                orderBy: { username: 'asc' },
            }),
            prisma_service_1.prisma.user.count()
        ]);
        res.json({
            data: users,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize)
        });
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching users');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getUsers = getUsers;
const createUser = async (req, res) => {
    const { username, password, roleId } = req.body;
    try {
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const user = await prisma_service_1.prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                roleId,
            },
            include: { role: true },
        });
        delete user.password;
        res.status(201).json(user);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error creating user');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createUser = createUser;
const updateUser = async (req, res) => {
    const id = req.params.id;
    const { username, password, roleId } = req.body;
    try {
        const data = {};
        if (username)
            data.username = username;
        if (roleId)
            data.roleId = roleId;
        if (password)
            data.password = await bcryptjs_1.default.hash(password, 10);
        const user = await prisma_service_1.prisma.user.update({
            where: { id },
            data,
            include: { role: true },
        });
        delete user.password;
        res.json(user);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error updating user');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateUser = updateUser;
const getRoles = async (req, res) => {
    try {
        const roles = await prisma_service_1.prisma.role.findMany();
        res.json(roles);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching roles');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getRoles = getRoles;
const deleteUser = async (req, res) => {
    const id = req.params.id;
    try {
        await prisma_service_1.prisma.user.delete({
            where: { id },
        });
        res.status(204).send();
    }
    catch (error) {
        logger_1.logger.error(error, 'Error deleting user');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deleteUser = deleteUser;
const getUsersList = async (req, res) => {
    try {
        const users = await prisma_service_1.prisma.user.findMany({
            where: {
                role: {
                    name: 'OWNER'
                }
            },
            select: {
                id: true,
                username: true,
                walletBalance: true,
            },
            orderBy: { username: 'asc' }
        });
        res.json(users);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error fetching users list');
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getUsersList = getUsersList;
