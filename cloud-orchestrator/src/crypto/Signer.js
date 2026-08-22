"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.signer = exports.Signer = void 0;
const crypto = __importStar(require("crypto"));
class Signer {
    privateKey;
    publicKey;
    constructor() {
        // Hardcoded static keypair for fail-fast integration test
        const privHex = "21ad98d5a69d40c289f1489c87c3bddf94db62fb4c0ae3dc96dc6a5ac8e8bf92";
        // Convert hex to DER formatted pkcs8 private key Buffer
        // A standard Ed25519 PKCS8 DER prefix is 16 bytes: 302e020100300506032b657004220420
        const derPrefix = Buffer.from('302e020100300506032b657004220420', 'hex');
        const privateKeyBuf = Buffer.concat([derPrefix, Buffer.from(privHex, 'hex')]);
        this.privateKey = crypto.createPrivateKey({
            key: privateKeyBuf,
            format: 'der',
            type: 'pkcs8'
        });
        // We don't technically need the public key object to sign, just returning the string.
        this.publicKey = crypto.createPublicKey(this.privateKey);
    }
    getPublicKeyHex() {
        return this.publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('hex');
    }
    signPayload(payload) {
        const timestamp = Math.floor(Date.now() / 1000);
        const ttl_seconds = 300; // 5 minutes validity
        const payloadWithoutSig = {
            version: "1.0",
            job_id: payload.job_id,
            node_id: payload.node_id,
            timestamp: timestamp,
            ttl_seconds: ttl_seconds,
            action: payload.action,
            params: payload.params || {},
            signature: ""
        };
        // Canonicalization matches Android: job_id|node_id|timestamp|action
        const canonicalPayload = `${payloadWithoutSig.job_id}|${payloadWithoutSig.node_id}|${payloadWithoutSig.timestamp}|${payloadWithoutSig.action}`;
        const signatureBytes = crypto.sign(null, Buffer.from(canonicalPayload, 'utf8'), this.privateKey);
        payloadWithoutSig.signature = signatureBytes.toString('hex');
        return payloadWithoutSig;
    }
}
exports.Signer = Signer;
// Singleton instance
exports.signer = new Signer();
//# sourceMappingURL=Signer.js.map