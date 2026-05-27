import * as fs from 'fs';

const BEGIN = '-----BEGIN CERTIFICATE-----';
const END = '-----END CERTIFICATE-----';

/** Виправляє PEM після вставки в env (Vercel, .env одним рядком). */
export function normalizePem(raw: string): string {
    let text = raw.trim().replace(/\\n/g, '\n');

    text = text
        .replace(/-----BEGINCERTIFICATE-----/gi, BEGIN)
        .replace(/-----ENDCERTIFICATE-----/gi, END)
        .replace(/-----BEGIN\s+CERTIFICATE-----/gi, BEGIN)
        .replace(/-----END\s+CERTIFICATE-----/gi, END);

    const beginIdx = text.indexOf(BEGIN);
    const endIdx = text.indexOf(END);

    if (beginIdx !== -1 && endIdx !== -1 && endIdx > beginIdx) {
        const body = text.slice(beginIdx + BEGIN.length, endIdx).replace(/\s/g, '');
        if (body.length > 0) {
            const lines = body.match(/.{1,64}/g) ?? [body];
            return `${BEGIN}\n${lines.join('\n')}\n${END}\n`;
        }
    }

    const compact = text.replace(/\s/g, '');
    if (/^[A-Za-z0-9+/=]+$/.test(compact) && compact.length > 64) {
        const lines = compact.match(/.{1,64}/g) ?? [compact];
        return `${BEGIN}\n${lines.join('\n')}\n${END}\n`;
    }

    return text;
}

export function resolveMysqlSslCa(env: NodeJS.ProcessEnv = process.env): Buffer | undefined {
    const fromEnv = env.DB_SSL_CA?.trim();
    if (fromEnv) {
        return Buffer.from(normalizePem(fromEnv));
    }

    const caPath = env.DB_CA_PATH?.trim();
    if (caPath) {
        try {
            if (fs.existsSync(caPath)) {
                return fs.readFileSync(caPath);
            }
        } catch {
            /* ignore */
        }
    }

    return undefined;
}

export function buildMysqlSslOptions(
    env: NodeJS.ProcessEnv = process.env,
): { ca: Buffer; rejectUnauthorized: boolean } | undefined {
    if (env.DB_SSL !== 'true') {
        return undefined;
    }

    const ca = resolveMysqlSslCa(env);
    if (!ca) {
        return undefined;
    }

    return {
        ca,
        rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
    };
}
