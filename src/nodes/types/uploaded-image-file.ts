/** Мінімальний тип файлу від multer (memoryStorage) */
export interface UploadedImageFile {
    fieldname?: string;
    originalname: string;
    encoding?: string;
    mimetype: string;
    buffer: Buffer;
    size: number;
    /** Лише для legacy diskStorage */
    filename?: string;
}
