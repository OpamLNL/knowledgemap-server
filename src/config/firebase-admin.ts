import * as admin from 'firebase-admin';
import * as fs from 'fs';

let serviceAccount: any;

// Якщо на Vercel є окрема змінна для приватного ключа
if (process.env.FIREBASE_PRIVATE_KEY) {
    serviceAccount = {
        type: 'service_account',
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
    };
} else {
    // Для локальної розробки (залишається з файлу)
    try {
        serviceAccount = JSON.parse(
          fs.readFileSync('src/config/firebase-service-account.json', 'utf-8')
        );
    } catch (e) {
        serviceAccount = {};
    }
}

if (!admin.apps.length && serviceAccount.private_key) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

export { admin };