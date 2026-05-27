import 'dotenv/config';
import { buildMysqlSslOptions, normalizePem, resolveMysqlSslCa } from './mysql-ssl';
import * as fs from 'fs';

function main() {
    const caPath = process.env.DB_CA_PATH?.trim();
    const fromEnv = resolveMysqlSslCa();
    const fromFile = caPath && fs.existsSync(caPath) ? fs.readFileSync(caPath) : null;

    console.log('DB_SSL:', process.env.DB_SSL);
    console.log('DB_SSL_CA set:', !!process.env.DB_SSL_CA?.trim());
    console.log('DB_CA_PATH:', caPath ?? '(not set)');

    if (!fromEnv) {
        throw new Error('Could not resolve SSL CA from DB_SSL_CA or DB_CA_PATH');
    }

    const normalized = process.env.DB_SSL_CA?.trim()
        ? normalizePem(process.env.DB_SSL_CA)
        : fromEnv.toString();

    if (!normalized.includes('-----BEGIN CERTIFICATE-----')) {
        throw new Error('Normalized PEM missing BEGIN CERTIFICATE header');
    }

    if (fromFile && fromEnv.equals(fromFile)) {
        console.log('DB_SSL_CA matches ca.pem file');
    } else if (fromFile && process.env.DB_SSL_CA?.trim()) {
        console.log(
            'Note: DB_SSL_CA differs from ca.pem (expected if Vercel uses env-only cert)',
        );
    }

    const ssl = buildMysqlSslOptions();
    console.log('SSL options:', {
        hasCa: !!ssl?.ca,
        rejectUnauthorized: ssl?.rejectUnauthorized,
    });
    console.log('MySQL SSL CA resolved OK');
}

main();
