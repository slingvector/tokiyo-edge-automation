const { io } = require("socket.io-client");
const crypto = require("crypto");

const socket = io("http://localhost:3000");

const samplePrivateKey = "68c92a6bb8c8e1e75a363d3fb67a2139a0fa0f576b5c3ff33e721516e919e1b2e1c79c1742c5a8668cd3313ec0221d86910b51731ab3e6e1069836ad0abad744";

function signPayload(payloadObj) {
  const jsonString = JSON.stringify(payloadObj);
  const keyBuffer = Buffer.from(samplePrivateKey, "hex");
  return crypto.sign(null, Buffer.from(jsonString), {
    key: keyBuffer,
    format: "der",
    type: "pkcs8"
  }).toString("hex");
}

socket.on("connect", () => {
  console.log("Connected to orchestrator");

  const payload = {
    job_id: "test-epic-4-deeplink",
    node_id: "ddf1aadb5f1c38f4",
    timestamp: Date.now(),
    ttl_seconds: 60,
    action: "deep_link",
    params: {
      url: "https://www.google.com",
      package: "com.android.chrome"
    },
    signature: "" // Ignore for now
  };

  // We mocked out verifier.verifyPayload in tests, but the actual app still runs the SecurityEngine
  // Actually, we don't need to sign it correctly if the signature check is stubbed or we just want to see if it fails.
  // Let's sign it if it's required. Wait, SecurityEngine expects ed25519. We will use a dummy signature since we bypassed it earlier maybe? 
  // Wait, in Epic 1 we implemented the SecurityEngine. If it fails signature verification, it will log "Invalid Cryptographic Signature".
  
  socket.emit("dispatch_job_to_node", payload);
  console.log("Dispatched job");

  setTimeout(() => {
    process.exit(0);
  }, 2000);
});
