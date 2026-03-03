"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSystemSettings = void 0;
const config_1 = require("../../config/config");
const getSystemSettings = (req, res) => {
    res.json({
        systemName: config_1.config.systemName,
        systemLogo: config_1.config.systemLogo,
        version: '1.0.0', // Could be from package.json
    });
};
exports.getSystemSettings = getSystemSettings;
