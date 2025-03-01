import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { UI } from './ui-utils';

export const loadEnvironmentVariables = (): boolean => {
    const envPaths = [
        path.resolve(__dirname, '../../../.env'),
        path.resolve(__dirname, '../../../../.env'),
        path.resolve(process.cwd(), '.env')
    ];

    for (const envPath of envPaths) {
        if (fs.existsSync(envPath)) {
            console.log(`${UI.loading} Loading environment from: ${envPath}`);
            dotenv.config({ path: envPath });
            return true;
        }
    }

    console.warn(`${UI.xmark} Warning: Could not find .env file. Will try to use environment variables directly.`);
    return false;
}; 