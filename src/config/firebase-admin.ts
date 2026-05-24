import * as admin from 'firebase-admin';
import * as fs from 'fs';




let serviceAccount: any;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Для Vercel / сервера
    serviceAccount = JSON.parse(
        Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf-8')
    );
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
