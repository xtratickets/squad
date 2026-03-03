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
const orderController = __importStar(require("./order.controller"));
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.get('/', auth_middleware_1.authenticate, orderController.getOrders);
router.post('/', auth_middleware_1.authenticate, orderController.createOrder);
router.post('/:id/approve', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)(['STAFF', 'OPERATION', 'ADMIN']), orderController.approveOrder);
router.post('/:id/checkout', auth_middleware_1.authenticate, orderController.checkoutOrder);
router.patch('/:id', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)(['STAFF', 'OPERATION', 'ADMIN']), orderController.updateOrder);
router.patch('/:id/items', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)(['STAFF', 'OPERATION', 'ADMIN']), orderController.updateOrderItems);
router.get('/:id', auth_middleware_1.authenticate, orderController.getOrder);
exports.default = router;
