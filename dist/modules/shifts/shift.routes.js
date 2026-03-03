"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const shiftController = __importStar(require("./shift.controller"));
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.post('/open', auth_middleware_1.authenticate, shiftController.openShift);
router.get('/active', auth_middleware_1.authenticate, shiftController.getActiveShift);
router.post('/:id/close', auth_middleware_1.authenticate, shiftController.closeShift);
router.get('/history', auth_middleware_1.authenticate, shiftController.getShiftHistory);
router.get('/:id/stats', auth_middleware_1.authenticate, shiftController.getShiftStats);
router.get('/all', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)(['OPERATION', 'ADMIN']), shiftController.getAllShifts);
router.get('/', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)(['ADMIN', 'OPERATION']), shiftController.getShifts);
exports.default = router;
