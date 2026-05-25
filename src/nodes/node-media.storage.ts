import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import type { Request } from 'express';
import type { UploadedImageFile } from './types/uploaded-image-file';

export const NODE_MEDIA_UPLOAD_DIR = join(process.cwd(), 'uploads', 'node-media');

const ALLOWED_MIME = new Set([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
]);

export function ensureNodeMediaUploadDir(): void {
    if (!existsSync(NODE_MEDIA_UPLOAD_DIR)) {
        mkdirSync(NODE_MEDIA_UPLOAD_DIR, { recursive: true });
    }
}

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
    storage: diskStorage({
        destination: (_req, _file, cb) => {
            ensureNodeMediaUploadDir();
            cb(null, NODE_MEDIA_UPLOAD_DIR);
        },
        filename: (req, file, cb) => {
            const nodeId = req.params?.id ?? '0';
            const safeExt = extname(file.originalname).toLowerCase().slice(0, 8) || '.jpg';
            cb(null, `node-${nodeId}-${Date.now()}${safeExt}`);
        },
    }),
};

export function nodeMediaPublicUrl(filename: string): string {
    return `/api/uploads/node-media/${filename}`;
}

export function nodeMediaAbsolutePath(filename: string): string {
    return join(NODE_MEDIA_UPLOAD_DIR, filename);
}

export function filenameFromPublicUrl(url: string): string | null {
    const prefix = '/api/uploads/node-media/';
    if (!url.startsWith(prefix)) return null;
    return url.slice(prefix.length) || null;
}
