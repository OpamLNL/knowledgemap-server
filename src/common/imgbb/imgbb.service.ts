import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'fs/promises';
import { nodeMediaAbsolutePath, filenameFromPublicUrl } from '../../nodes/node-media.storage';
import { filenameFromAvatarUrl, userAvatarAbsolutePath } from '../../users/user-avatar.storage';

export type ImgbbUploadResult = {
    url: string;
    deleteUrl: string | null;
};

type ImgbbApiResponse = {
    success?: boolean;
    error?: { message?: string };
    data?: {
        url?: string;
        display_url?: string;
        delete_url?: string;
    };
};

@Injectable()
export class ImgbbService {
    private readonly logger = new Logger(ImgbbService.name);

    constructor(private readonly config: ConfigService) {}

    private get apiKey(): string {
        return this.config.get<string>('IMGBB_API_KEY')?.trim() ?? '';
    }

    isConfigured(): boolean {
        return this.apiKey.length > 0;
    }

    isHostedImageUrl(url: string | null | undefined): boolean {
        if (!url) return false;
        if (url.startsWith('https://i.ibb.co/') || url.includes('imgbb.com')) return true;
        return url.startsWith('/api/uploads/');
    }

    async uploadImage(buffer: Buffer, name?: string): Promise<ImgbbUploadResult> {
        if (!this.isConfigured()) {
            throw new BadRequestException('IMGBB_API_KEY не налаштовано на сервері');
        }
        if (!buffer?.length) {
            throw new BadRequestException('Порожній файл зображення');
        }

        const body = new URLSearchParams();
        body.set('key', this.apiKey);
        body.set('image', buffer.toString('base64'));
        if (name?.trim()) {
            body.set('name', name.trim().slice(0, 64));
        }

        const response = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        });

        const payload = (await response.json()) as ImgbbApiResponse;
        if (!response.ok || !payload.success || !payload.data?.url) {
            const message = payload.error?.message ?? `ImgBB HTTP ${response.status}`;
            throw new BadRequestException(`Не вдалося завантажити зображення: ${message}`);
        }

        return {
            url: payload.data.display_url ?? payload.data.url,
            deleteUrl: payload.data.delete_url ?? null,
        };
    }

    /** ImgBB видаляє зображення через GET на delete_url (офіційний механізм). */
    async deleteByUrl(deleteUrl: string | null | undefined): Promise<void> {
        if (!deleteUrl?.trim()) return;
        try {
            await fetch(deleteUrl.trim(), { method: 'GET' });
        } catch (error) {
            this.logger.warn(`ImgBB delete failed: ${String(error)}`);
        }
    }

    /** Завантажити байти з ImgBB/legacy локального шляху для export/import. */
    async readImageBytes(publicUrl: string): Promise<Buffer | null> {
        const legacyNode = filenameFromPublicUrl(publicUrl);
        if (legacyNode) {
            try {
                return await readFile(nodeMediaAbsolutePath(legacyNode));
            } catch {
                return null;
            }
        }

        const legacyAvatar = filenameFromAvatarUrl(publicUrl);
        if (legacyAvatar) {
            try {
                return await readFile(userAvatarAbsolutePath(legacyAvatar));
            } catch {
                return null;
            }
        }

        if (!publicUrl.startsWith('http://') && !publicUrl.startsWith('https://')) {
            return null;
        }

        try {
            const response = await fetch(publicUrl);
            if (!response.ok) return null;
            return Buffer.from(await response.arrayBuffer());
        } catch {
            return null;
        }
    }
}
