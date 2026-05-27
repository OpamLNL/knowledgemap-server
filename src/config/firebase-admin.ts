import * as admin from 'firebase-admin';
import * as fs from 'fs';

let serviceAccount: any;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
        // Очищаємо рядок від можливих пробілів та виправляємо переноси рядків
        const cleanJson = process.env.FIREBASE_SERVICE_ACCOUNT.trim().replace(/\\n/g, '\n');
        serviceAccount = JSON.parse(cleanJson);
    } catch (error) {
        throw new Error(`❌ Firebase JSON parsing failed. Reason: ${error.message}`);
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