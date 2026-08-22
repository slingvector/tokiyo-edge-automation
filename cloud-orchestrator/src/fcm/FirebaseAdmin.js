"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messaging = void 0;
const app_1 = require("firebase-admin/app");
const messaging_1 = require("firebase-admin/messaging");
if ((0, app_1.getApps)().length === 0) {
    try {
        (0, app_1.initializeApp)({
            credential: (0, app_1.applicationDefault)(),
        });
        console.log('[FirebaseAdmin] Initialized successfully.');
    }
    catch (error) {
        console.error('[FirebaseAdmin] Failed to initialize:', error.message);
    }
}
exports.messaging = (0, app_1.getApps)().length > 0 ? (0, messaging_1.getMessaging)() : null;
//# sourceMappingURL=FirebaseAdmin.js.map