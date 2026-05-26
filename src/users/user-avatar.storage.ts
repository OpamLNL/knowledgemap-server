import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import type { Request } from 'express';
import type { UploadedImageFile } from '../nodes/types/uploaded-image-file';

export const USER_AVATAR_UPLOAD_DIR = join(process.cwd(), 'uploads', 'avatars');

const ALLOWED_MIME = new Set([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
]);

export function ensureUserAvatarUploadDir(): void {
    if (!existsSync(USER_AVATAR_UPLOAD_DIR)) {
        mkdirSync(USER_AVATAR_UPLOAD_DIR, { recursive: true });
    }
}

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
    storage: diskStorage({
        destination: (_req, _file, cb) => {
            ensureUserAvatarUploadDir();
            cb(null, USER_AVATAR_UPLOAD_DIR);
        },
        filename: (req, file, cb) => {
            const uid = (req as Request & { user?: { uid?: string } }).user?.uid ?? 'user';
            const safeExt = extname(file.originalname).toLowerCase().slice(0, 8) || '.jpg';
            cb(null, `${uid}-${Date.now()}${safeExt}`);
        },
    }),
};

export function userAvatarPublicUrl(filename: string): string {
    return `/api/uploads/avatars/${filename}`;
}

export function userAvatarAbsolutePath(filename: string): string {
    return join(USER_AVATAR_UPLOAD_DIR, filename);
}

export function filenameFromAvatarUrl(url: string): string | null {
    const prefix = '/api/uploads/avatars/';
    if (!url.startsWith(prefix)) return null;
    return url.slice(prefix.length) || null;
}

export function isUploadedAvatarUrl(url: string | null | undefined): boolean {
    return !!url?.startsWith('/api/uploads/avatars/');
}
