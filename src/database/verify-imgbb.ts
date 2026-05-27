import 'dotenv/config';
import { AppDataSource } from '../data-source';

async function main() {
    await AppDataSource.initialize();

    const nodeMediaCols = await AppDataSource.query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'node_media'
        AND COLUMN_NAME IN ('delete_url', 'url')
    `);
    const userCols = await AppDataSource.query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
        AND COLUMN_NAME IN ('avatar_delete_url', 'avatarUrl')
    `);
    const migrations = await AppDataSource.query(`
        SELECT name FROM migrations ORDER BY id DESC LIMIT 3
    `);

    console.log('node_media columns:', nodeMediaCols.map((c: { COLUMN_NAME: string }) => c.COLUMN_NAME));
    console.log('users columns:', userCols.map((c: { COLUMN_NAME: string }) => c.COLUMN_NAME));
    console.log('recent migrations:', migrations.map((m: { name: string }) => m.name));

    const apiKey = process.env.IMGBB_API_KEY?.trim();
    if (!apiKey) {
        throw new Error('IMGBB_API_KEY missing');
    }

    const png1x1 = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
    );
    const body = new URLSearchParams();
    body.set('key', apiKey);
    body.set('image', png1x1.toString('base64'));
    body.set('name', 'graphedit-verify');

    const response = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });
    const payload = (await response.json()) as {
        success?: boolean;
        data?: { url?: string; display_url?: string; delete_url?: string };
        error?: { message?: string };
    };

    if (!response.ok || !payload.success || !payload.data?.url) {
        throw new Error(`ImgBB test failed: ${payload.error?.message ?? response.status}`);
    }

    console.log('ImgBB upload OK:', payload.data.display_url ?? payload.data.url);
    console.log('ImgBB delete_url present:', !!payload.data.delete_url);

    if (payload.data.delete_url) {
        await fetch(payload.data.delete_url);
        console.log('ImgBB cleanup delete OK');
    }

    await AppDataSource.destroy();
    console.log('All checks passed');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
