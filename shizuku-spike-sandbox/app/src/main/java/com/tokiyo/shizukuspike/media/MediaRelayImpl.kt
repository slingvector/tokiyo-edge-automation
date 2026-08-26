package com.tokiyo.shizukuspike.media

import android.content.Context
import android.media.MediaScannerConnection
import android.os.Environment
import android.util.Log
import com.tokiyo.core.domain.interfaces.IMediaRelay
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

class MediaRelayImpl(private val context: Context) : IMediaRelay {
    
    override suspend fun downloadAndIndexMedia(urlString: String, fileName: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val dcimDir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DCIM), "TokiyoRelay")
            if (!dcimDir.exists()) {
                dcimDir.mkdirs()
            }
            
            val outputFile = File(dcimDir, fileName)
            
            val url = URL(urlString)
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "GET"
            connection.connectTimeout = 15000
            connection.readTimeout = 60000
            
            connection.inputStream.use { input ->
                FileOutputStream(outputFile).use { output ->
                    input.copyTo(output)
                }
            }
            
            Log.i("MediaRelay", "Downloaded file to ${outputFile.absolutePath}")
            
            // Trigger Media Scanner so it shows up in Gallery instantly
            val indexed = suspendCoroutine<Boolean> { cont ->
                MediaScannerConnection.scanFile(
                    context,
                    arrayOf(outputFile.absolutePath),
                    null
                ) { path, uri ->
                    Log.i("MediaRelay", "Scanned $path: -> uri=$uri")
                    cont.resume(uri != null)
                }
            }
            
            return@withContext indexed
        } catch (e: Exception) {
            Log.e("MediaRelay", "Error downloading media", e)
            return@withContext false
        }
    }
}
