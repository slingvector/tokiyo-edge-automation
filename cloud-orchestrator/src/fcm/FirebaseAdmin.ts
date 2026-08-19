import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
        });
        console.log('[FirebaseAdmin] Initialized successfully.');
    } catch (error: any) {
        console.error('[FirebaseAdmin] Failed to initialize:', error.message);
    }
}

export const messaging = admin.messaging();
