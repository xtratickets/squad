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
exports.StorageService = void 0;
const Minio = __importStar(require("minio"));
const logger_1 = require("../utils/logger");
let _minioClient;
function getMinioClient() {
    if (!_minioClient) {
        _minioClient = new Minio.Client({
            endPoint: process.env.MINIO_ENDPOINT || 'localhost',
            port: parseInt(process.env.MINIO_PORT || '9000'),
            useSSL: process.env.MINIO_USE_SSL === 'true',
            accessKey: process.env.MINIO_ACCESS_KEY || '',
            secretKey: process.env.MINIO_SECRET_KEY || '',
            region: process.env.MINIO_REGION || 'us-east-1',
        });
    }
    return _minioClient;
}
const bucketName = process.env.MINIO_BUCKET || 'squad';
const region = process.env.MINIO_REGION || 'us-east-1';
class StorageService {
    static async init() {
        try {
            const exists = await getMinioClient().bucketExists(bucketName);
            if (!exists) {
                await getMinioClient().makeBucket(bucketName, region);
                logger_1.logger.info(`Bucket "${bucketName}" created.`);
                const policy = {
                    Version: '2012-10-17',
                    Statement: [
                        {
                            Effect: 'Allow',
                            Principal: { AWS: ['*'] },
                            Action: ['s3:GetObject'],
                            Resource: [`arn:aws:s3:::${bucketName}/*`],
                        },
                    ],
                };
                await getMinioClient().setBucketPolicy(bucketName, JSON.stringify(policy));
                logger_1.logger.info(`Public read policy set for bucket "${bucketName}".`);
            }
        }
        catch (error) {
            logger_1.logger.error(error, 'Error initializing Minio bucket');
        }
    }
    static async uploadFile(file, folder = 'products') {
        try {
            const sanitizedName = file.originalname
                .replace(/\s+/g, '_')
                .replace(/[^a-zA-Z0-9._\-]/g, '');
            const fileName = `${folder}/${Date.now()}-${sanitizedName}`;
            await getMinioClient().putObject(bucketName, fileName, file.buffer);
            return fileName;
        }
        catch (error) {
            logger_1.logger.error(error, 'Error uploading file to Minio');
            throw new Error('Failed to upload image');
        }
    }
    static async deleteFile(fileUrl) {
        try {
            if (!fileUrl)
                return;
            const fileName = extractObjectKey(fileUrl);
            await getMinioClient().removeObject(bucketName, fileName);
            logger_1.logger.info(`File deleted from Minio: ${fileName}`);
        }
        catch (error) {
            logger_1.logger.error(error, 'Error deleting file from Minio');
        }
    }
    static async getFileUrl(fileUrlOrName) {
        try {
            if (!fileUrlOrName)
                return fileUrlOrName;
            const fileName = extractObjectKey(fileUrlOrName);
            return await getMinioClient().presignedGetObject(bucketName, fileName, 24 * 60 * 60);
        }
        catch (error) {
            logger_1.logger.error(error, `Error generating presigned URL for ${fileUrlOrName}`);
            return fileUrlOrName;
        }
    }
}
exports.StorageService = StorageService;
function extractObjectKey(fileUrlOrName) {
    if (!fileUrlOrName.startsWith('http'))
        return fileUrlOrName;
    const urlPath = new URL(fileUrlOrName).pathname;
    const decoded = decodeURIComponent(urlPath);
    const prefix = `/${bucketName}/`;
    if (decoded.startsWith(prefix)) {
        return decoded.slice(prefix.length);
    }
    return decoded.startsWith('/') ? decoded.slice(1) : decoded;
}
