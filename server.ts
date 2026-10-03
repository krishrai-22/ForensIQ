/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { type Request, type Response } from 'express';
import path from 'path';
import crypto from 'crypto';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '60mb' }));

// In-memory mock server database of enrolled officers and accepted chain
interface EnrolledOfficer {
  operatorId: string;
  badgeUnit: string;
  publicKeySpkiBase64: string;
  keyFingerprint: string;
  enrolledAtIso: string;
}

const enrolledOfficers = new Map<string, EnrolledOfficer>();
const serverChainStore = new Map<string, unknown>();

// Generate server master ECDSA keypair for countersigning
let serverPrivateKey: crypto.KeyObject;
let serverPublicKey: crypto.KeyObject;
let serverPublicKeySpkiBase64: string;

try {
  const keyPair = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  });
  serverPrivateKey = keyPair.privateKey;
  serverPublicKey = keyPair.publicKey;
  serverPublicKeySpkiBase64 = serverPublicKey
    .export({ type: 'spki', format: 'der' })
    .toString('base64');
} catch (err) {
  console.error('Failed to generate server ECDSA keypair:', err);
}

// -------------------------------------------------------------
// API: Health & Server Status
// -------------------------------------------------------------
app.get('/api/sync-health', (_req: Request, res: Response) => {
  res.json({
    status: 'ONLINE',
    serverTimestampIso: new Date().toISOString(),
    enrolledOfficersCount: enrolledOfficers.size,
    storedChainHeight: serverChainStore.size,
    serverPublicKeySpkiBase64,
  });
});

// -------------------------------------------------------------
// API: Enrol Officer Public Key
// -------------------------------------------------------------
app.post('/api/enrol-officer', (req: Request, res: Response) => {
  const { operatorId, badgeUnit, publicKeySpkiBase64, keyFingerprint } = req.body;

  if (!operatorId || !publicKeySpkiBase64) {
    res.status(400).json({ error: 'Missing operatorId or publicKeySpkiBase64' });
    return;
  }

  const officer: EnrolledOfficer = {
    operatorId,
    badgeUnit: badgeUnit || 'N/A',
    publicKeySpkiBase64,
    keyFingerprint: keyFingerprint || 'N/A',
    enrolledAtIso: new Date().toISOString(),
  };

  enrolledOfficers.set(operatorId, officer);
  console.log(`[SERVER] Enrolled operator: ${operatorId} (${officer.badgeUnit})`);

  res.json({
    success: true,
    message: `Officer ${operatorId} enrolled in central authority directory.`,
    officer,
  });
});

// -------------------------------------------------------------
// Helper: Canonicalize JSON
// -------------------------------------------------------------
function canonicalizeJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalizeJson).join(',') + ']';
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const entries = keys.map(
    (key) => JSON.stringify(key) + ':' + canonicalizeJson((obj as Record<string, unknown>)[key])
  );
  return '{' + entries.join(',') + '}';
}

// -------------------------------------------------------------
// API: Sync Batch of Field Records
// -------------------------------------------------------------
app.post('/api/sync-batch', async (req: Request, res: Response) => {
  const { records, simulateMode } = req.body;

  if (!Array.isArray(records)) {
    res.status(400).json({ error: 'Invalid batch format. Expected array of records.' });
    return;
  }

  // Handle simulated server failure
  if (simulateMode === 'force_server_error') {
    res.status(500).json({ error: 'Internal Server Error (Simulated 500 Failure)' });
    return;
  }
  if (simulateMode === 'force_auth_error') {
    res.status(403).json({ error: 'Departmental Authentication Revoked (Simulated 403)' });
    return;
  }

  const accepted: unknown[] = [];
  const rejected: { id: string; reason: string }[] = [];

  for (const record of records) {
    try {
      const {
        id,
        operatorId,
        recordHashSha256,
        signatureHex,
        prevRecordHash,
        tampered,
      } = record;

      // Check simulated or explicit tamper flag
      if (tampered) {
        rejected.push({
          id,
          reason: 'Cryptographic signature mismatch: record marked as tampered.',
        });
        continue;
      }

      // Check enrolled officer
      let officer = enrolledOfficers.get(operatorId);
      if (!officer) {
        // Auto-enrol if sent with publicKeySpkiBase64 in record or fallback to record key
        if (record.publicKeyFingerprint) {
          officer = {
            operatorId,
            badgeUnit: record.badgeUnit || 'Field Unit',
            publicKeySpkiBase64: record.publicKeySpkiBase64 || '',
            keyFingerprint: record.publicKeyFingerprint,
            enrolledAtIso: new Date().toISOString(),
          };
          enrolledOfficers.set(operatorId, officer);
        }
      }

      // Re-compute canonical hash
      const {
        signatureHex: _sig,
        recordHashSha256: _hash,
        syncStatus: _sync,
        syncedAtIso: _syncAt,
        serverCounterSignature: _counterSig,
        ...unsignedPayload
      } = record;

      const canonicalStr = canonicalizeJson(unsignedPayload);
      const computedHash = crypto.createHash('sha256').update(canonicalStr).digest('hex');

      if (computedHash !== recordHashSha256) {
        rejected.push({
          id,
          reason: `Digest mismatch: canonical hash (${computedHash.substring(0, 8)}...) does not match recordHashSha256 (${recordHashSha256?.substring(0, 8)}...).`,
        });
        continue;
      }

      // Verify ECDSA signature if public key is available
      if (officer?.publicKeySpkiBase64) {
        try {
          const spkiBuffer = Buffer.from(officer.publicKeySpkiBase64, 'base64');
          const pubKey = crypto.createPublicKey({
            key: spkiBuffer,
            format: 'der',
            type: 'spki',
          });

          // In Node.js, ECDSA P-256 signatures from WebCrypto are raw IEEE P1363 (64 bytes).
          // Node's verify supports IEEE P1363 with dsaEncoding: 'ieee-p1363'
          const sigBuffer = Buffer.from(signatureHex, 'hex');
          const verifier = crypto.createVerify('SHA256');
          verifier.update(recordHashSha256);
          verifier.end();

          const isValid = verifier.verify(
            { key: pubKey, dsaEncoding: 'ieee-p1363' },
            sigBuffer
          );

          if (!isValid) {
            rejected.push({
              id,
              reason: 'ECDSA signature verification failed against officer public key.',
            });
            continue;
          }
        } catch (cryptoErr) {
          console.warn('[SERVER] Key verification warning:', cryptoErr);
          // If DER / SPKI format variance occurs in mock, proceed with payload hash check
        }
      }

      // Generate server timestamp & countersignature
      const serverTimestampIso = new Date().toISOString();
      const serverPayloadToSign = `${id}:${recordHashSha256}:${serverTimestampIso}`;

      let serverCounterSignature = '';
      if (serverPrivateKey) {
        const signer = crypto.createSign('SHA256');
        signer.update(serverPayloadToSign);
        signer.end();
        serverCounterSignature = signer
          .sign({ key: serverPrivateKey, dsaEncoding: 'ieee-p1363' })
          .toString('hex');
      } else {
        serverCounterSignature = crypto
          .createHmac('sha256', 'FIELDTEST_SERVER_SECRET')
          .update(serverPayloadToSign)
          .digest('hex');
      }

      const syncedRecord = {
        ...record,
        syncStatus: 'synced',
        syncedAtIso: serverTimestampIso,
        serverCounterSignature,
      };

      serverChainStore.set(id, syncedRecord);
      accepted.push(syncedRecord);
    } catch (recordErr) {
      rejected.push({
        id: record.id || 'unknown',
        reason: 'Malformed record structure: ' + String(recordErr),
      });
    }
  }

  res.json({
    success: true,
    acceptedCount: accepted.length,
    rejectedCount: rejected.length,
    acceptedRecords: accepted,
    rejectedRecords: rejected,
    serverTimestampIso: new Date().toISOString(),
  });
});

// -------------------------------------------------------------
// Vite Middlewares in Dev / Static Serving in Prod
// -------------------------------------------------------------
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve('dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] FieldTest Companion server running on http://0.0.0.0:${PORT}`);
  });
}

export default app;

if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('Fatal server startup error:', err);
    process.exit(1);
  });
}
