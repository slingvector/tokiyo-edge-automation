import * as crypto from 'crypto';

export class Signer {
  private privateKey: crypto.KeyObject;
  private publicKey: crypto.KeyObject;

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

  public getPublicKeyHex(): string {
    return this.publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('hex');
  }

  public signPayload(payload: any): any {
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

// Singleton instance
export const signer = new Signer();
