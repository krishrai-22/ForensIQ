# ForensIQ 🔍💊

> **Expeditionary Forensic Substance Intelligence & Cryptographic Chain-of-Custody System**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646cff.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38bdf8.svg)](https://tailwindcss.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-ffca28.svg)](https://firebase.google.com/)
[![PWA](https://img.shields.io/badge/PWA-Offline--First-5a0fc8.svg)](https://web.dev/progressive-web-apps/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black.svg)](https://vercel.com/)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

---

## 📌 Overview

**ForensIQ** is an offline-first, tamper-evident Progressive Web Application (PWA) designed for sworn law enforcement officers, forensic investigators, and field analysts. It transforms standard mobile and desktop cameras into standardized scientific colorimetric screening instruments with an immutable, cryptographically signed chain of custody.

Standard field chemical presumptive tests (such as Cobalt Thiocyanate for Cocaine, Marquis Reagent for Opiates, Duquenois-Levine for Cannabis, and Scott Reagent) suffer from subjective visual interpretation, variable field lighting conditions, and evidentiary disputes in court. **ForensIQ** eliminates subjective human bias through mathematical colorimetry, strict quality gates, and hardware-backed digital signatures.

---

## 🔬 Core Capabilities

### 1. Deterministic Colorimetric Classification
* **Affine 3x3 Calibration Matrix**: Normalizes camera sensor variations and disparate ambient illumination using color calibration reference targets.
* **CIEDE2000 (ΔE₀₀) Distance Metric**: Evaluates color deviations against validated laboratory ground-truth standards in perceptually uniform CIELAB color space.
* **Strict Ambiguity Margin Gate**: Automatically enforces an `INCONCLUSIVE` analytical outcome if the delta margin between positive and negative centroids is $\le 3.5\ \Delta E_{00}$.
* **Zero AI "Hallucinations"**: Chemical classifications are strictly deterministic; large language models are completely isolated from analytical decision boundaries.

### 2. Pre-Flight Optical Quality Gates
Before any chemical reaction is sampled, the raw image stream must pass four programmatic validation barriers:
* **Laplacian Blur Variance ($\ge 100$)**: Rejects motion blur and out-of-focus camera frames.
* **Mean Luminance (35–235)**: Detects underexposed (too dark) or overexposed (blown out) reaction chambers.
* **Specular Glare Rejection ($\le 4\%$)**: Identifies reflective plastic vial highlights that distort chemical color readings.
* **Reaction Kinetics Timer**: Tracks elapsed reaction seconds against reagent-specific shelf windows (e.g. 30–60s) to guard against stale color degradation.

### 3. Evidentiary Cryptography & Tamper-Evident Hash Chain
* **WebCrypto ECDSA (P-256)**: Each field operator enrolls a non-extractable cryptographic key pair stored securely in device hardware.
* **SHA-256 Merkle Ledger**: Every evidence record encapsulates the SHA-256 hash of its canonical JSON payload, the SHA-256 digest of raw image bytes, and a `prevRecordHash` linking back to the previous seizure block.
* **Clock Tamper Protection**: Compares system UTC timestamps against monotonic performance timers (`performance.now()`), GPS clock deltas, and central gateway counter-signatures.

### 4. Cloud Gateway & Firebase Firestore Integration
* **Cloud Firestore Database**: Free-tier cloud persistence with central synchronization for multi-device field squads.
* **Google Authentication**: Built-in 1-click Google OAuth sign-in with role-based access control.
* **Hardened Security Rules (`firestore.rules`)**: Enforces evidentiary immutability (`allow update: if false;`)—once an evidence record is committed with an ECDSA signature, it cannot be modified or forged in the cloud.

---

## 🏛️ System Architecture

```
                                  FIELD ENVIRONMENT (OFFLINE)
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                        │
│   Smartphone / Web Camera                                                              │
│              │                                                                         │
│              ▼                                                                         │
│   ┌─────────────────────┐       FAIL       ┌────────────────────────┐                  │
│   │ Optical Quality     │ ───────────────> │ Reject Frame & Prompt  │                  │
│   │ Gates (Blur, Glare) │                  │ Operator Adjustment    │                  │
│   └─────────────────────┘                  └────────────────────────┘                  │
│              │ PASS                                                                    │
│              ▼                                                                         │
│   ┌─────────────────────┐                  ┌────────────────────────┐                  │
│   │ Affine 3x3 Color    │ ───────────────> │ Corrected Sample RGB   │                  │
│   │ Target Calibration  │                  │ in CIELAB Space        │                  │
│   └─────────────────────┘                  └────────────────────────┘                  │
│              │                                          │                              │
│              ▼                                          ▼                              │
│   ┌─────────────────────────────────────────────────────────────────┐                  │
│   │ Deterministic CIEDE2000 Distance Classifier                     │                  │
│   │ (Positive vs. Negative vs. Inconclusive Margin <= 3.5 dE)       │                  │
│   └─────────────────────────────────────────────────────────────────┘                  │
│              │                                                                         │
│              ▼                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐                  │
│   │ Cryptographic Sealer                                            │                  │
│   │ • SHA-256 Payload Hash      • SHA-256 Image Byte Hash           │                  │
│   │ • Prev Record Hash Block    • WebCrypto ECDSA P-256 Signature   │                  │
│   └─────────────────────────────────────────────────────────────────┘                  │
│              │                                                                         │
│              ▼                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐                  │
│   │ Local IndexedDB (Dexie.js) - Persistent Offline Storage         │                  │
│   └─────────────────────────────────────────────────────────────────┘                  │
└──────────────────────────────────────┬─────────────────────────────────────────────────┘
                                       │
                         NETWORK RECOVERY / RE-CONNECT
                                       │
                                       ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                             CENTRAL AUTHORITY (ONLINE)                                 │
│                                                                                        │
│   ┌───────────────────────────┐                ┌───────────────────────────────────┐   │
│   │ Vercel Serverless Gateway │                │ Firebase Cloud Firestore          │   │
│   │ • /api/sync-batch         │                │ • /records/{recordId} (Immutable) │   │
│   │ • ECDSA Counter-Signature │                │ • Google OAuth User Directory     │   │
│   └───────────────────────────┘                └───────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Repository Structure

```
forensiq/
├── api/                         # Vercel serverless function entrypoint
│   └── index.ts                 # Full-stack API router handler
├── public/                      # Static PWA assets & icons
│   ├── icon.svg                 # Vector ForensIQ search & medicine emblem
│   ├── manifest.webmanifest     # Web App Manifest
│   ├── pwa-192x192.png          # PWA home screen icon
│   └── pwa-512x512.png          # High-resolution splash icon
├── src/
│   ├── components/              # UI components
│   │   ├── ForensIQLogo.tsx     # Custom vector brand logo
│   │   ├── OperatorSetupModal.tsx # Cryptographic officer enrollment
│   │   ├── FinalReportModal.tsx # Court-admissible certificate generator
│   │   └── tabs/                # Main interface workstation views
│   │       ├── TestTab.tsx      # Live camera, calibration, & assay execution
│   │       ├── LogTab.tsx       # Local chain-of-custody audit ledger
│   │       ├── SyncTab.tsx      # Gateway sync & Firebase Cloud manager
│   │       └── SettingsTab.tsx  # Cryptographic keys, test kits, & storage
│   ├── db/                      # IndexedDB schema (Dexie.js)
│   ├── hooks/                   # PWA & online status custom hooks
│   ├── lib/                     # Core forensic & cryptographic algorithms
│   │   ├── classifier.ts        # CIEDE2000 math & deterministic color logic
│   │   ├── calibration.ts       # Affine 3x3 least-squares color calibration
│   │   ├── qualityGates.ts      # Optical pre-flight blur/glare filters
│   │   ├── crypto.ts            # WebCrypto ECDSA signing & verification
│   │   ├── firebase.ts          # Firebase SDK & Cloud Firestore client
│   │   ├── syncService.ts       # Batch synchronization pipeline
│   │   ├── storage.ts           # StorageManager persistence requests
│   │   └── test-runner.ts       # Self-contained forensic unit tests
│   ├── App.tsx                  # Root application shell
│   └── main.tsx                 # React entrypoint
├── firebase-applet-config.json  # Firebase client credentials
├── firebase-blueprint.json      # Database schema blueprint
├── firestore.rules              # Zero-Trust Firestore security rules
├── security_spec.md             # Security specification & audit assertions
├── server.ts                    # Express development & API server
├── vercel.json                  # Vercel deployment configuration
└── vite.config.ts               # Vite & VitePWA configuration
```

---

## 🚀 Getting Started

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **npm** or **bun**
* Modern browser with WebCrypto and IndexedDB support (Chrome, Safari, Firefox, Edge)

### 1. Clone & Install
```bash
git clone https://github.com/your-org/forensiq.git
cd forensiq
npm install
```

### 2. Run Locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Run Forensic Unit Tests
Verify mathematical colorimetry, deltaE margins, and quality gate boundaries:
```bash
npm test
```

### 4. Build for Production
```bash
npm run build
```

---

## ☁️ Deployment

### Deploying to Vercel (1-Click Ready)
The repository includes a production-ready `vercel.json` and serverless router in `api/index.ts`:

1. Push your repository to **GitHub**.
2. Log into [Vercel](https://vercel.com) and click **"Add New Project"**.
3. Select your repository. Vercel will automatically detect Vite and configure:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Click **Deploy**. Your app will be live on global Edge infrastructure with automated HTTPS.

---

## 🔒 Security & Judicial Compliance

* **Presumptive Screening Disclaimer**: Under forensic statutory requirements, presumptive colorimetric assays provide field probable cause. Confirmatory laboratory testing via GC/MS or LC/MS is required for formal judicial indictment.
* **Non-Repudiation**: Evidence records signed with officer ECDSA keys cannot be altered in transit or post-seizure without invalidating the cryptographic signature.
* **Hardened Cloud Rules**: Cloud Firestore rules strictly reject `update` operations on `/records/{recordId}` to guarantee historical immutability.

---

## 📄 License

Licensed under the **Apache License, Version 2.0**. See [LICENSE](LICENSE) for details.
