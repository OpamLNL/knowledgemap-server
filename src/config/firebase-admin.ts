import * as admin from 'firebase-admin';
import * as fs from 'fs';

let serviceAccount: any;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
        // 1. Декодуємо з Base64
        const decodedString = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf-8');

        // 2. ФІКС: Якщо випадково завантажився не Base64, а звичайний рядок,
        // або якщо всередині JSON побилися переноси:
        const cleanJson = decodedString.trim().replace(/\\n/g, '\n');

        serviceAccount = JSON.parse(cleanJson);
    } catch (error) {
        // Якщо Base64 впав, спробуємо розпарсити пряме значення (про всяк випадок)
        try {
            const cleanRaw = process.env.FIREBASE_SERVICE_ACCOUNT.trim().replace(/\\n/g, '\n');
            serviceAccount = JSON.parse(cleanRaw);
        } catch (innerError) {
            throw new Error(`❌ Firebase config parsing failed. original error: ${error.message}`);
        }
    }
} else {
    // Для локальної розробки
    serviceAccount = JSON.parse(
      fs.readFileSync('src/config/firebase-service-account.json', 'utf-8')
    );
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

export { admin };