const crypto = require('crypto');

// Generate an Ed25519 keypair
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');

// Convert keys to hex
const publicKeyHex = publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('hex');

const timestamp = Math.floor(Date.now() / 1000);

const payloadWithoutSig = {
  version: "1.0",
  job_id: "test-job-" + timestamp,
  node_id: "node-1",
  timestamp: timestamp,
  ttl_seconds: 300,
  action: "TEST_ACTION",
  params: {},
  signature: ""
};

const canonicalPayload = `${payloadWithoutSig.job_id}|${payloadWithoutSig.node_id}|${payloadWithoutSig.timestamp}|${payloadWithoutSig.action}`;

const signature = crypto.sign(null, Buffer.from(canonicalPayload, 'utf8'), privateKey);
const signatureHex = signature.toString('hex');

payloadWithoutSig.signature = signatureHex;

console.log("PUBLIC_KEY_HEX:", publicKeyHex);
console.log("\nJSON_PAYLOAD:");
console.log(JSON.stringify(payloadWithoutSig, null, 2));
