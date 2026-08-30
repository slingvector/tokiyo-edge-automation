#!/bin/bash
echo "Setting up root daemons on emulators..."

for device in $(adb devices | grep emulator | grep -v offline | awk '{print $1}'); do
    echo "Setting up $device..."
    adb -s $device root
    sleep 2
    
    cat << 'DAEMON' > /tmp/root_daemon_$device.sh
#!/system/bin/sh
CMD_FILE="/data/data/com.tokiyo.shizukuspike/files/command.txt"
OUT_FILE="/data/data/com.tokiyo.shizukuspike/files/output.txt"
DON_FILE="/data/data/com.tokiyo.shizukuspike/files/done.txt"

mkdir -p /data/data/com.tokiyo.shizukuspike/files
chmod 777 /data/data/com.tokiyo.shizukuspike/files

while true; do
  if [ -f "$CMD_FILE" ]; then
    cmd=$(cat "$CMD_FILE")
    rm -f "$CMD_FILE"
    
    # Run the command and capture output
    sh -c "$cmd" > "$OUT_FILE" 2>&1
    
    # Signal completion
    echo "done" > "$DON_FILE"
    chmod 666 "$OUT_FILE"
    chmod 666 "$DON_FILE"
  fi
  sleep 0.2
done
DAEMON
    
    adb -s $device push /tmp/root_daemon_$device.sh /data/local/tmp/root_daemon.sh
    adb -s $device shell chmod +x /data/local/tmp/root_daemon.sh
    
    # Kill existing daemon
    adb -s $device shell "pkill -f root_daemon.sh"
    
    # Start new daemon
    adb -s $device shell "nohup /data/local/tmp/root_daemon.sh > /data/local/tmp/daemon.log 2>&1 &"
    echo "Daemon started on $device."
done
echo "All emulators setup! Shizuku bypass is now active."
