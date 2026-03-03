"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRoles = exports.updateUser = exports.createUser = exports.getUsers = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_service_1 = require("../../services/prisma.service");
const logger_1 = require("../../utils/logger");
const getUsers = async (req, res) => {
    try {
        const users = await prisma_service_1.prisma.user.findMany({
            include: { role: true },
        });
        res.json(users);
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
        // @ts-ignore
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
        // @ts-ignore
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
