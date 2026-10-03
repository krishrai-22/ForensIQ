# Security Specification: Forensic FieldTest Companion

## 1. Data Invariants
- An evidence record represents a legally binding, cryptographically signed digital custody artifact.
- Evidence records are strictly **append-only and immutable**; once written to `/records/{recordId}`, no non-admin user can update or overwrite canonical evidence hashes, ECDSA signatures, or assay outcomes.
- Record IDs must be valid alphanumeric identifiers up to 64 characters.
- A user can only create evidence records when authenticated.
- User profiles at `/users/{userId}` can only be created and updated by the respective user (`request.auth.uid == userId`), and privileged fields cannot be self-elevated.

## 2. Hardened Rules Matrix
- Collection `/records/{recordId}`:
  - `read`: Authenticated personnel (`request.auth != null`).
  - `create`: Authenticated user, matching `id == recordId`, valid schema boundaries, valid string lengths.
  - `update`: Denied (`false`) to guarantee evidentiary immutability and prevent tampering.
  - `delete`: Restricted to admin only (`barelyknownit@gmail.com`).
- Collection `/users/{userId}`:
  - `get`: Owner (`request.auth.uid == userId`) or admin.
  - `list`: Admin only (prevent user enumeration).
  - `create`: Owner only with valid profile keys.
  - `update`: Owner only, restricted to `['displayName', 'badgeUnit', 'updatedAt']`.
  - `delete`: Admin only.
