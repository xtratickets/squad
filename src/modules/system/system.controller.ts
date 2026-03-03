import { Request, Response } from 'express';
import { config } from '../../config/config';
import fs from 'fs';
import path from 'path';

export const getSystemSettings = (req: Request, res: Response) => {
    res.json({
        systemName: config.systemName,
        systemLogo: config.systemLogo,
        version: '1.0.0', // Could be from package.json
    });
};

export const updateSystemSettings = (req: Request, res: Response) => {
    const { systemName, systemLogo } = req.body;
    
    if (systemName) config.systemName = systemName;
    if (systemLogo) config.systemLogo = systemLogo;

    // Write to .env file to persist across restarts
    const envPath = path.resolve(process.cwd(), '.env');
    try {
        if (fs.existsSync(envPath)) {
            let envContent = fs.readFileSync(envPath, 'utf8');
            
            if (envContent.includes('SYSTEM_NAME=')) {
                envContent = envContent.replace(/SYSTEM_NAME=.*/g, `SYSTEM_NAME="${config.systemName}"`);
            } else {
                envContent += `\nSYSTEM_NAME="${config.systemName}"`;
            }

            if (envContent.includes('SYSTEM_LOGO=')) {
                envContent = envContent.replace(/SYSTEM_LOGO=.*/g, `SYSTEM_LOGO="${config.systemLogo}"`);
            } else {
                envContent += `\nSYSTEM_LOGO="${config.systemLogo}"`;
            }

            fs.writeFileSync(envPath, envContent);
        }
    } catch (err) {
        console.error('Failed to write to .env', err);
    }

    res.json({
        systemName: config.systemName,
        systemLogo: config.systemLogo,
        version: '1.0.0'
    });
};
