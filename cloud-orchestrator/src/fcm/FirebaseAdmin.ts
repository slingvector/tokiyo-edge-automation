import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

if (getApps().length === 0) {
    try {
        initializeApp({
            credential: applicationDefault(),
        });
        console.log('[FirebaseAdmin] Initialized successfully.');
    } catch (error: any) {
        console.error('[FirebaseAdmin] Failed to initialize:', error.message);
    }
}

export const messaging = getApps().length > 0 ? getMessaging() : null;
