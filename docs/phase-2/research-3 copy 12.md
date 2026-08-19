To push heavy binary files (videos and images) into a distributed Android farm reliably, you must bypass ADB entirely. adb push is synchronous, locks up the command line, and doesn't scale well when orchestrating 50 concurrent device uploads.
Because your Edge Agent is already running a Ktor server for WebSocket commands, you will expand that Ktor instance to handle HTTP multipart uploads.
For an automated content relay pipeline like MCR, this requires a three-step orchestration: Transport, OS Indexing, and Gallery Isolation.
1. The Transport Layer (Ktor Multipart)
While WebSockets are perfect for fast, lightweight JSON state commands, they are inefficient for sending 50MB .mp4 files. You should open a dedicated HTTP POST /upload endpoint on the exact same Ktor server running on the Edge Agent.
The Control Plane streams the file over the local network directly into a sandboxed directory on the Edge Agent.
// Inside your Edge Agent's Ktor routing block
post("/upload") {
    val multipartData = call.receiveMultipart()
    var fileName = "default.mp4"
    // Create an isolated directory for the relay pipeline
    val targetDir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DCIM), "MCR_Relay")
    if (!targetDir.exists()) targetDir.mkdirs()

    multipartData.forEachPart { part ->
        if (part is PartData.FileItem) {
            fileName = part.originalFileName as String
            val file = File(targetDir, fileName)
            
            // Stream the binary directly to disk to prevent RAM bloat
            part.streamProvider().use { its ->
                file.outputStream().buffered().use { it.write(its.readBytes()) }
            }
        }
        part.dispose()
    }
    
    // Step 2 happens here: Force the OS to see the file
    MediaSyncEngine.forceIndex(call.application, File(targetDir, fileName))
    
    call.respond(HttpStatusCode.OK, "File securely staged at $fileName")
}

2. The MediaStore Force-Sync (The Android Indexer)
When you drop a file into the Android file system, apps like Instagram or LinkedIn cannot see it. They do not read the raw file system; they query the Android MediaStore (an SQLite database maintained by the OS). The OS only scans for new files periodically or upon reboot.
To force Android to index your newly injected media instantly, your Edge Agent must invoke the MediaScannerConnection. Because your Agent is a native Kotlin app, it can do this cleanly without needing Shizuku privileges.
import android.content.Context
import android.media.MediaScannerConnection
import java.io.File

object MediaSyncEngine {
    fun forceIndex(context: Context, file: File) {
        MediaScannerConnection.scanFile(
            context,
            arrayOf(file.absolutePath),
            arrayOf("video/mp4", "image/jpeg") // Specify mime types to speed up indexing
        ) { path, uri ->
            println("OS successfully indexed: $path with URI: $uri")
            // The file is now instantly visible to Instagram, LinkedIn, etc.
        }
    }
}

3. Gallery Isolation (The UI Strategy)
When your Control Plane commands the Edge Agent to open Instagram and tap the "New Post" button, the Instagram custom gallery picker opens.
If you just drop files into the standard camera roll, your automation script has to parse a grid of random images to find the right one. This is highly error-prone.
By saving your files to a dedicated folder (e.g., DCIM/MCR_Relay/), you create a highly deterministic UI state:
 * Clear the directory before upload: The Control Plane should always send a CLEANUP command to wipe the folder before sending a new file.
 * Select the Album: Instruct the Edge Agent to tap the "Recents" or "Gallery" dropdown in Instagram/LinkedIn and select the "MCR_Relay" album.
 * Tap the first item: Because you clear the directory before every task, there will only ever be exactly one media file in that folder. Your semantic parser simply selects the first clickable bounding box in the gallery grid.
4. Garbage Collection (Crucial for Scale)
Video files will rapidly destroy an emulator's virtual disk space. The Control Plane must treat the Edge Agent's storage as ephemeral.
Add a specific state to your workflow definition: CLEANUP.
Once the Control Plane verifies the post is successfully published, it sends a command to the Edge Agent to execute File(targetDir).deleteRecursively(). This ensures your 100-device farm doesn't crash from ENOSPC (Error No Space Left on Device) after three days of automated posting.