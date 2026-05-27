import { join } from 'path';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import type { UploadedImageFile } from '../nodes/types/uploaded-image-file';

/** Legacy шлях (лише для читання/видалення старих записів у БД). */
const USER_AVATAR_UPLOAD_DIR = join(process.cwd(), 'uploads', 'avatars');

const ALLOWED_MIME = new Set([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
]);

export const userAvatarMulterOptions = {
    limits: { fileSize: 2 * 1024 * 1024 },
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

export function userAvatarAbsolutePath(filename: string): string {
    return join(USER_AVATAR_UPLOAD_DIR, filename);
}

export function filenameFromAvatarUrl(url: string): string | null {
    const prefix = '/api/uploads/avatars/';
    if (!url.startsWith(prefix)) return null;
    return url.slice(prefix.length) || null;
}

export function isUploadedAvatarUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    if (url.startsWith('/api/uploads/avatars/')) return true;
    return url.includes('ibb.co') || url.includes('imgbb.com');
}
