package com.tokiyo.shizukuspike.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.tokiyo.core.domain.JobDispatcher
import com.tokiyo.core.domain.interfaces.TelemetryClient
import com.tokiyo.core.domain.models.JobPayload
import com.tokiyo.core.security.SecurityEngine
import com.tokiyo.core.shizuku.ShizukuExecutor
import com.tokiyo.core.uiautomator.AppLifecycleControllerImpl
import com.tokiyo.core.uiautomator.UiAutomatorService

import com.tokiyo.core.uiautomator.TouchDispatcherImpl
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.serialization.json.Json
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import org.json.JSONObject

class AgentBridgeService : Service(), TelemetryClient {
    private val scope = CoroutineScope(Dispatchers.IO + Job())
    private lateinit var nodeId: String
    
    private val orchestratorUrl = "http://10.0.2.2:3000" 
    private val samplePublicKey = "e1c79c1742c5a8668cd3313ec0221d86910b51731ab3e6e1069836ad0abad744"
    
    private var socket: Socket? = null
    private val json = Json { ignoreUnknownKeys = true }
    
    private lateinit var jobDispatcher: JobDispatcher

    override fun onCreate() {
        super.onCreate()
        nodeId = android.provider.Settings.Secure.getString(contentResolver, android.provider.Settings.Secure.ANDROID_ID) ?: "unknown_node"
        
        val executor = ShizukuExecutor()
        val uiAutomatorService = UiAutomatorService(executor)
        
        jobDispatcher = JobDispatcher(
            scope = scope,
            nodeId = nodeId,
            verifier = SecurityEngine(samplePublicKey),
            executor = executor,
            uiAutomator = uiAutomatorService,
            telemetry = this,
            touchDispatcher = TouchDispatcherImpl(executor),
            clipboardInjector = ClipboardInjectorImpl(this, executor),
            appLifecycleController = AppLifecycleControllerImpl(executor),
            flightRecorder = com.tokiyo.core.uiautomator.FlightRecorderImpl(executor)
        )
        
        createNotificationChannel()
        startForeground(
            1,
            NotificationCompat.Builder(this, "bridge_channel")
                .setContentTitle("Edge Agent Bridge")
                .setContentText("Connected to Orchestrator")
                .setSmallIcon(android.R.drawable.ic_menu_upload)
                .build()
        )
        connectSocketIO()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val payloadStr = intent?.getStringExtra("fcm_payload")
        if (payloadStr != null) {
            Log.i("AgentBridgeService", "Received FCM payload via intent")
            try {
                val payload = json.decodeFromString<JobPayload>(payloadStr)
                jobDispatcher.dispatch(payload, payloadStr)
            } catch (e: Exception) {
                Log.e("AgentBridgeService", "Failed to parse FCM payload", e)
            }
        }
        return START_STICKY
    }

    private fun connectSocketIO() {
        try {
            val options = IO.Options().apply {
                reconnection = true
                reconnectionAttempts = Int.MAX_VALUE
                reconnectionDelay = 1000
                reconnectionDelayMax = 5000
                randomizationFactor = 0.5
                timeout = 20000
            }
            socket = IO.socket(orchestratorUrl, options)
            
            socket?.on(Socket.EVENT_CONNECT) {
                try {
                    Log.i("AgentBridgeService", "Connected to Orchestrator!")
                    val registerPayload = JSONObject().apply {
                        put("node_id", nodeId)
                    }
                    socket?.emit("register_node", registerPayload)
                } catch (e: Exception) {
                    Log.e("AgentBridgeService", "Error in EVENT_CONNECT", e)
                }
            }
            
            socket?.on("registered") {
                Log.i("AgentBridgeService", "Node registered successfully!")
            }

            socket?.on("dispatch_job") { args ->
                try {
                    val data = args[0] as JSONObject
                    val rawJsonString = data.toString()
                    val payload = json.decodeFromString<JobPayload>(rawJsonString)
                    
                    Log.i("AgentBridgeService", "Received job: ${payload.job_id}")
                    
                    // Dispatch to Service Layer
                    jobDispatcher.dispatch(payload, rawJsonString)
                } catch (e: Exception) {
                    Log.e("AgentBridgeService", "Error parsing job", e)
                }
            }

            socket?.on(Socket.EVENT_DISCONNECT) {
                Log.w("AgentBridgeService", "Disconnected from Orchestrator")
            }

            socket?.on(Socket.EVENT_CONNECT_ERROR) { args ->
                Log.e("AgentBridgeService", "Connect Error: ${args.contentToString()}")
            }

            socket?.connect()
        } catch (e: Exception) {
            Log.e("AgentBridgeService", "Socket initialization error", e)
        }
    }

    override suspend fun sendTelemetry(
        jobId: String,
        nodeId: String,
        status: String,
        exitCode: Int,
        stdout: String,
        stderr: String,
        uiDump: String?,
        screenshot: String?
    ) {
        val telemetry = JSONObject().apply {
            put("job_id", jobId)
            put("node_id", nodeId)
            put("status", status)
            put("exit_code", exitCode)
            put("stdout", stdout)
            put("stderr", stderr)
            uiDump?.let { put("ui_dump", it) }
            screenshot?.let { put("screenshot", it) }
        }
        socket?.emit("telemetry_report", telemetry)
        Log.i("AgentBridgeService", "Telemetry sent!")
    }

    override fun onDestroy() {
        super.onDestroy()
        socket?.disconnect()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "bridge_channel",
                "Orchestrator Bridge",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }
}
