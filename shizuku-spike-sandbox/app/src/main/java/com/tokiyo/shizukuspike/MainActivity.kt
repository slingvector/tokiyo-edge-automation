package com.tokiyo.shizukuspike

import android.content.Context
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Log
import androidx.appcompat.app.AppCompatActivity
import com.tokiyo.shizukuspike.databinding.ActivityMainBinding
import kotlinx.coroutines.*
import rikka.shizuku.Shizuku
import rikka.shizuku.Shizuku.OnBinderDeadListener
import rikka.shizuku.Shizuku.OnBinderReceivedListener
import java.io.BufferedReader
import java.io.InputStreamReader
import kotlin.system.measureTimeMillis

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private val scope = CoroutineScope(Dispatchers.Main + Job())
    // Ktor Server removed
    
    private val binderReceivedListener = OnBinderReceivedListener {
        updateStatus("Shizuku Binder Received (Connected)")
        checkPermissionAndStartServer()
    }
    
    private val binderDeadListener = OnBinderDeadListener {
        updateStatus("Shizuku Binder Dead (Disconnected)")
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        Shizuku.addBinderReceivedListener(binderReceivedListener)
        Shizuku.addBinderDeadListener(binderDeadListener)
        
        if (Shizuku.pingBinder()) {
            updateStatus("Shizuku Binder Active")
        } else {
            updateStatus("Shizuku not running. Falling back to native root (su).")
        }
        checkPermissionAndStartServer()
        
        val prefs = getSharedPreferences("app_prefs", Context.MODE_PRIVATE)
        val defaultUrl = com.tokiyo.shizukuspike.BuildConfig.ORCHESTRATOR_URL
        val currentUrl = prefs.getString("orchestrator_url", defaultUrl)
        binding.etOrchestratorUrl.setText(currentUrl)

        binding.btnUpdateUrl.setOnClickListener {
            val newUrl = binding.etOrchestratorUrl.text.toString()
            prefs.edit().putString("orchestrator_url", newUrl).apply()
            log("Saved URL: $newUrl")
            checkPermissionAndStartServer() // Restarts the service with new URL
        }

        binding.btnSetLocal.setOnClickListener {
            val localUrl = "http://127.0.0.1:3000"
            binding.etOrchestratorUrl.setText(localUrl)
            prefs.edit().putString("orchestrator_url", localUrl).apply()
            log("Saved Local URL: $localUrl (ADB Reverse)")
            checkPermissionAndStartServer()
        }

        binding.btnRunBenchmark.setOnClickListener {
            runLatencyBenchmark()
        }
    }
    
    private fun checkPermissionAndStartServer() {
        try {
            if (Shizuku.pingBinder() && Shizuku.checkSelfPermission() != PackageManager.PERMISSION_GRANTED) {
                Shizuku.requestPermission(0)
            }
        } catch (e: Exception) {
            Log.e("ShizukuSpike", "Shizuku permission check failed", e)
        }
        // Always start the server; ShizukuExecutor will fallback to root 'su' if needed
        startHeadlessServer()
    }
    
    private fun updateStatus(status: String) {
        runOnUiThread {
            binding.tvStatus.text = status
            log(status)
        }
    }
    
    private fun log(msg: String) {
        runOnUiThread {
            binding.tvLogs.append("$msg\n")
            Log.d("ShizukuSpike", msg)
        }
    }
    
    private fun runLatencyBenchmark() {
        if (Shizuku.checkSelfPermission() != PackageManager.PERMISSION_GRANTED) {
            log("Permission not granted.")
            return
        }
        
        binding.btnRunBenchmark.isEnabled = false
        log("Starting Latency Benchmark (50 loops)...")
        
        scope.launch(Dispatchers.IO) {
            val totalTime = measureTimeMillis {
                for (i in 1..50) {
                    val loopTime = measureTimeMillis {
                        executeShellCommand("uiautomator dump /data/local/tmp/test.xml")
                        executeShellCommand("input tap 500 500")
                    }
                    log("Loop $i: ${loopTime}ms")
                }
            }
            log("Benchmark Completed in ${totalTime}ms. Average: ${totalTime / 50}ms per loop")
            withContext(Dispatchers.Main) {
                binding.btnRunBenchmark.isEnabled = true
            }
        }
    }
    
    private fun executeShellCommand(cmd: String): String {
        return try {
            val method = Shizuku::class.java.getDeclaredMethod("newProcess", Array<String>::class.java, Array<String>::class.java, String::class.java)
            method.isAccessible = true
            val process = method.invoke(null, arrayOf("sh", "-c", cmd), null, null) as Process
            val reader = BufferedReader(InputStreamReader(process.inputStream))
            val output = StringBuilder()
            var line: String?
            while (reader.readLine().also { line = it } != null) {
                output.append(line).append("\n")
            }
            process.waitFor()
            output.toString()
        } catch (e: Exception) {
            Log.e("ShizukuSpike", "Command failed: $cmd", e)
            "Error: ${e.message}"
        }
    }
    
    private fun startHeadlessServer() {
        val intent = android.content.Intent(this, com.tokiyo.shizukuspike.service.AgentBridgeService::class.java)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
        log("Started AgentBridgeService via Foreground Service.")
    }

    override fun onDestroy() {
        super.onDestroy()
        Shizuku.removeBinderReceivedListener(binderReceivedListener)
        Shizuku.removeBinderDeadListener(binderDeadListener)
        // Removed ktorServer
        scope.cancel()
    }
}
