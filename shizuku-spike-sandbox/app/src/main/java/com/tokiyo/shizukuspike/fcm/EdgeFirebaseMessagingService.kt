package com.tokiyo.shizukuspike.fcm

import android.content.Intent
import android.util.Log
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.tokiyo.shizukuspike.service.AgentBridgeService

class EdgeFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.i("EdgeFCMService", "New FCM token received: $token")
        // TODO: Send token to Orchestrator to update Node.fcmToken
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        Log.i("EdgeFCMService", "FCM Message received from: ${remoteMessage.from}")

        // Ensure the data payload contains the cryptographically signed job
        val payload = remoteMessage.data["payload"]
        if (payload != null) {
            Log.i("EdgeFCMService", "Dispatching payload to AgentBridgeService")
            
            val intent = Intent(this, AgentBridgeService::class.java).apply {
                putExtra("fcm_payload", payload)
            }
            
            // Start or wake up the foreground service to handle the payload
            ContextCompat.startForegroundService(this, intent)
        } else {
            Log.w("EdgeFCMService", "FCM Message contained no 'payload' data")
        }
    }
}
