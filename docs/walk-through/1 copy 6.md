# Edge Node Resilience Walkthrough

We've hardened the Edge Node Android Service (`AgentBridgeService`) and its `ShellExecutor` to achieve near 100% uptime and resilience against OS or execution failures.

## 1. Network & OS Resilience (`AgentBridgeService.kt`)

The background service has been fortified against the two main killers of Android background processes: network drops and OS memory management.

- **Aggressive Reconnection Engine:** The `Socket.IO` instance is now explicitly configured to automatically retry connections infinitely (`reconnectionAttempts = Int.MAX_VALUE`), using an exponential backoff (`reconnectionDelayMax = 5000`). If the Node.js Orchestrator reboots, the Edge Node will quietly reconnect without human intervention.
- **Service Stickiness:** We explicitly implemented `onStartCommand` to return `START_STICKY`. If the Android OS aggressively kills the service to reclaim memory, the OS will automatically reschedule and restart the service as soon as memory frees up.
- **Global Error Boundaries:** All Socket incoming events are now wrapped in `try-catch` blocks to prevent malformed JSON payloads from crashing the event loop.

## 2. Deadlock Prevention (`ShellExecutor.kt`)

We discovered a critical vulnerability where heavy shell commands (like `dmesg` or `logcat`) could permanently hang the execution loop.

- **Concurrent Stream Buffering:** Previously, the `stdout` and `stderr` streams were read sequentially. If a command pumped too much data into `stderr` while we were waiting on `stdout`, the OS pipe buffer would fill, deadlocking the `Process.waitFor()`. We refactored the streams to be consumed by concurrent threads immediately upon execution.
- **Execution Timeouts:** We added a 60-second watchdog wrapper around `process.exitValue()`. If a rogue command hangs or zombies, the Executor will forcibly interrupt the streams, destroy the process, and return an `Exit -1` Telemetry payload back to the Orchestrator, rather than freezing the Edge Node.
