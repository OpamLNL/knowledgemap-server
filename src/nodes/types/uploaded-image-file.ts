/** Мінімальний тип файлу від multer (без @types/multer) */
export interface UploadedImageFile {
    filename: string;
    originalname: string;
    mimetype: string;
}
