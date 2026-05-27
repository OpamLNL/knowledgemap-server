import { join } from 'path';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import type { UploadedImageFile } from './types/uploaded-image-file';

/** Legacy шлях (лише для читання/видалення старих записів у БД). */
const NODE_MEDIA_UPLOAD_DIR = join(process.cwd(), 'uploads', 'node-media');

const ALLOWED_MIME = new Set([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
]);

export const nodeMediaMulterOptions = {
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (
        _req: Request,
        file: UploadedImageFile,
        cb: (error: Error | null, acceptFile: boolean) => void,
    ) => {
        if (!ALLOWED_MIME.has(file.mimetype)) {
            cb(new Error('Дозволені лише зображення (JPEG, PNG, GIF, WebP)'), false);
            return;
        }
        cb(null, true);
    },
    storage: memoryStorage(),
};

export function nodeMediaAbsolutePath(filename: string): string {
    return join(NODE_MEDIA_UPLOAD_DIR, filename);
}

export function filenameFromPublicUrl(url: string): string | null {
    const prefix = '/api/uploads/node-media/';
    if (!url.startsWith(prefix)) return null;
    return url.slice(prefix.length) || null;
}
