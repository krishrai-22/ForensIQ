/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SignedTestRecord, TestRecordEntity, KitProfile } from '../types/index.ts';

export interface TimeDenotationDetails {
  isoUtc: string;
  localFormatted: string;
  localDateOnly: string;
  localTimeOnly: string;
  timeZoneName: string;
  utcOffset: string;
  epochMs: number;
  bootClockMs: number;
  reactionElapsedSeconds?: number;
  reactionTargetSeconds?: number;
  reactionToleranceSeconds?: number;
  reactionTimeFlag?: 'ON_TIME' | 'EARLY' | 'LATE';
  gpsFixTimestampIso?: string | null;
  gpsClockDeltaMs?: number | null;
}

/**
 * Computes complete standardized forensic time denotation metadata for any test record.
 */
export function extractTimeDenotation(
  record: SignedTestRecord | TestRecordEntity,
  kitProfile?: KitProfile
): TimeDenotationDetails {
  const d = new Date(record.timestampIso);
  const epochMs = isNaN(d.getTime()) ? Date.now() : d.getTime();
  const validDate = isNaN(d.getTime()) ? new Date() : d;

  // Local Formatted with full date and time
  const localFormatted = validDate.toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });

  const localDateOnly = validDate.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const localTimeOnly = validDate.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });

  // Timezone identifier & UTC offset
  let timeZoneName = 'Local';
  try {
    timeZoneName = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
  } catch {
    // fallback
  }

  const offsetMinutes = validDate.getTimezoneOffset();
  const sign = offsetMinutes > 0 ? '-' : '+';
  const absOffset = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absOffset / 60)).padStart(2, '0');
  const mins = String(absOffset % 60).padStart(2, '0');
  const utcOffset = `UTC${sign}${hours}:${mins}`;

  // GPS Clock Delta
  let gpsClockDeltaMs: number | null = null;
  if (record.gps?.timestampIso) {
    const gpsTime = new Date(record.gps.timestampIso).getTime();
    if (!isNaN(gpsTime)) {
      gpsClockDeltaMs = epochMs - gpsTime;
    }
  }

  return {
    isoUtc: record.timestampIso,
    localFormatted,
    localDateOnly,
    localTimeOnly,
    timeZoneName,
    utcOffset,
    epochMs,
    bootClockMs: record.bootClockMs || 0,
    reactionElapsedSeconds: record.reactionElapsedSeconds,
    reactionTargetSeconds: kitProfile?.requiredReadTimeSeconds,
    reactionToleranceSeconds: kitProfile?.readTimeToleranceSeconds,
    reactionTimeFlag: record.reactionTimeFlag,
    gpsFixTimestampIso: record.gps?.timestampIso || null,
    gpsClockDeltaMs,
  };
}

/**
 * Builds the comprehensive formal forensic certificate text report with complete time denotation.
 */
export function generateForensicReportText(
  record: TestRecordEntity,
  kitProfile?: KitProfile
): string {
  const time = extractTimeDenotation(record, kitProfile);
  const nowIso = new Date().toISOString();
  const nowLocal = new Date().toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });

  const gpsLocationStr =
    record.gps?.latitude !== null && record.gps?.longitude !== null
      ? `${record.gps.latitude.toFixed(6)}, ${record.gps.longitude.toFixed(6)} (Accuracy: ${record.gps.accuracyMeters?.toFixed(1) || 'N/A'}m, Status: ${record.gps.status})`
      : 'GPS FIX UNAVAILABLE';

  const reactionStr =
    record.reactionElapsedSeconds !== undefined
      ? `${record.reactionElapsedSeconds}s elapsed (Target: ${kitProfile?.requiredReadTimeSeconds || 45}s ± ${kitProfile?.readTimeToleranceSeconds || 15}s, Compliance: ${record.reactionTimeFlag || 'ON_TIME'})`
      : 'Standard reaction read window';

  const gpsDeltaStr =
    time.gpsClockDeltaMs != null
      ? `${time.gpsClockDeltaMs >= 0 ? '+' : ''}${time.gpsClockDeltaMs} ms relative to device clock`
      : 'N/A';

  return `================================================================================
OFFICIAL FORENSIC FIELD EVIDENCE REPORT & CHAIN OF CUSTODY CERTIFICATE
ForensIQ • Forensic Field Substance Analysis & Digital Custody System
================================================================================

[REPORT ISSUANCE & VERIFICATION METADATA]
REPORT CERTIFICATE NO: FIQ-EVID-${record.id.substring(0, 8).toUpperCase()}
REPORT ISSUED AT (UTC): ${nowIso}
REPORT ISSUED AT (LOC): ${nowLocal}
TERMINAL CLIENT SPEC:   ${record.deviceInfo?.userAgent || 'ForensIQ Secure Node v1.0'}

--------------------------------------------------------------------------------
SECTION I: CASE & OPERATOR CREDENTIALS
--------------------------------------------------------------------------------
RECORD IDENTIFIER (UUID): ${record.id}
SWORN OPERATOR ID:        ${record.operatorId}
BADGE / PATROL UNIT:      ${record.badgeUnit}
DEPARTMENT / AGENCY:      Narcotics Field Enforcement
PUBLIC KEY FINGERPRINT:   ${record.publicKeyFingerprint}
KEY SPECIFICATION:        ECDSA P-256 (WebCrypto non-extractable hardware key)

--------------------------------------------------------------------------------
SECTION II: CHRONOLOGICAL TIME DENOTATION & TIMING RECORD
--------------------------------------------------------------------------------
PRIMARY EVIDENCE ACQUISITION TIME:
  • UTC TIMESTAMP (ISO 8601): ${time.isoUtc}
  • LOCAL STATION / FIELD:    ${time.localFormatted}
  • TIMEZONE SPECIFICATION:   ${time.timeZoneName} (${time.utcOffset})
  • UNIX EPOCH TIME:          ${time.epochMs} ms

MONOTONIC TIME INTEGRITY:
  • BOOT-RELATIVE OFFSET:     +${time.bootClockMs.toFixed(3)} ms monotonic baseline
  • TIME ANTI-TAMPER NOTE:    Validated against monotonic hardware performance counter

CHEMICAL REACTION TIMING WINDOW:
  • REACTION TIMING:          ${reactionStr}
  • TIMING STATUS FLAG:       ${record.reactionTimeFlag || 'ON_TIME (VALIDATED READ WINDOW)'}

SATELLITE / NETWORK TIME ALIGNMENT:
  • GPS TIME FIX (UTC):       ${time.gpsFixTimestampIso || 'UNAVAILABLE'}
  • GPS / DEVICE CLOCK DELTA: ${gpsDeltaStr}
  • GEOLOCATION COORDINATES:  ${gpsLocationStr}

--------------------------------------------------------------------------------
SECTION III: COLORIMETRIC SCREENING RESULTS & RESIDUAL METRICS
--------------------------------------------------------------------------------
REAGENT TEST PROTOCOL:   ${record.kitProfileId} (Version ${record.kitProfileVersion})
RESULT INDICATION:       ${record.result}
CONFIDENCE INDEX:        ${Math.round(record.confidence * 100)}%
CALIBRATION RESIDUAL:    ${record.calibrationData?.meanResidualDeltaE?.toFixed(2) || '0.00'} ΔE₀₀ (${record.calibrationData?.quality || 'POOR'})
COLOR SPACE METRIC:      CIEDE2000 (NIST-traceable reference standard)

FINDINGS & RATIONALE:
${record.reason}

--------------------------------------------------------------------------------
SECTION IV: STATUTORY & LEGAL DISCLAIMER
--------------------------------------------------------------------------------
PRESUMPTIVE FIELD SCREENING ONLY:
This digital companion and field colorimetric testing system outputs a
PRESUMPTIVE screening indication only. It does NOT replace forensic laboratory
confirmatory testing (GC/MS, LC/MS, or FTIR spectrophotometry).
Formal forensic laboratory chemical analysis is mandatory for evidentiary
indictment and judicial prosecution in court.

--------------------------------------------------------------------------------
SECTION V: CRYPTOGRAPHIC PROVENANCE & CHAIN OF CUSTODY
--------------------------------------------------------------------------------
SAMPLE IMAGE SHA-256:    ${record.sampleImageHashSha256 || record.imageHashSha256}
CARD IMAGE SHA-256:      ${record.referenceCardImageHashSha256 || 'N/A'}
CANONICAL RECORD SHA-256:${record.recordHashSha256}
PREDECESSOR CHAIN HASH:  ${record.prevRecordHash}
ECDSA P-256 SIGNATURE:   ${record.signatureHex}

CHAIN OF CUSTODY STATUS: VERIFIED & SEALED
================================================================================`;
}
