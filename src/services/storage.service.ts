import * as Minio from 'minio';
import { logger } from '../utils/logger';

let _minioClient: Minio.Client;

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

export class StorageService {
    static async init() {
        try {
            const exists = await getMinioClient().bucketExists(bucketName);
            if (!exists) {
                // Pass region when creating the bucket
                await getMinioClient().makeBucket(bucketName, region);
                logger.info(`Bucket "${bucketName}" created.`);

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
                logger.info(`Public read policy set for bucket "${bucketName}".`);
            }
        } catch (error) {
            logger.error(error, 'Error initializing Minio bucket');
        }
    }

    static async uploadFile(file: Express.Multer.File, folder: string = 'products'): Promise<string> {
        try {
            const sanitizedName = file.originalname
                .replace(/\s+/g, '_')
                .replace(/[^a-zA-Z0-9._\-]/g, '');

            const fileName = `${folder}/${Date.now()}-${sanitizedName}`;

            // Size argument removed — pass metadata in the options object only
            await getMinioClient().putObject(bucketName, fileName, file.buffer);

            return fileName;
        } catch (error) {
            logger.error(error, 'Error uploading file to Minio');
            throw new Error('Failed to upload image');
        }
    }

    static async deleteFile(fileUrl: string) {
        try {
            if (!fileUrl) return;
            const fileName = extractObjectKey(fileUrl);
            await getMinioClient().removeObject(bucketName, fileName);
            logger.info(`File deleted from Minio: ${fileName}`);
        } catch (error) {
            logger.error(error, 'Error deleting file from Minio');
        }
    }

    static async getFileUrl(fileUrlOrName: string): Promise<string> {
        try {
            if (!fileUrlOrName) return fileUrlOrName;
            const fileName = extractObjectKey(fileUrlOrName);
            // Generate a presigned URL valid for 24 hours
            return await getMinioClient().presignedGetObject(bucketName, fileName, 24 * 60 * 60);
        } catch (error) {
            logger.error(error, `Error generating presigned URL for ${fileUrlOrName}`);
            return fileUrlOrName;
        }
    }
}

/**
 * Extracts the MinIO object key from either a raw key or a full URL.
 * Handles legacy full URLs by stripping the leading /<bucketName>/ prefix safely.
 */
function extractObjectKey(fileUrlOrName: string): string {
    if (!fileUrlOrName.startsWith('http')) return fileUrlOrName;

    const urlPath = new URL(fileUrlOrName).pathname;
    const decoded = decodeURIComponent(urlPath);

    // Strip the leading slash and bucket name prefix exactly once
    const prefix = `/${bucketName}/`;
    if (decoded.startsWith(prefix)) {
        return decoded.slice(prefix.length);
    }

    // Fallback: strip any leading slash
    return decoded.startsWith('/') ? decoded.slice(1) : decoded;
}