# Secure Voting Protocol (Solana)

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Audit Status](https://img.shields.io/badge/security-self--audited-orange)
![Test Coverage](https://img.shields.io/badge/chaos--tests-passing-blueviolet)
![License](https://img.shields.io/badge/license-MIT-blue)

A privacy-preserving, threshold-based voting protocol built on **Solana (Anchor)**. This system utilizes on-chain **Shamir's Secret Sharing (SSS)** to ensure that sensitive execution payloads (e.g., file decryption keys, upgrade authorities) are only reconstructed when a cryptographic quorum of voters is reached.

## Key Engineering Features

- **On-Chain Threshold Cryptography:** Implements Lagrange Interpolation directly in the SVM (Solana Virtual Machine) to reconstruct secrets from distributed shares without relying on off-chain coordination.
- **Chaos Fuzz Testing:** Includes a stochastic test suite simulating **50+ concurrent users** with randomized voting patterns to verify consensus integrity and state consistency under high load.
- **Optimized BPF Memory:** Solved Solana's strict 4KB stack limit constraints by utilizing heap-allocated `Box<Account>` patterns and `opt-level="z"` compiler tuning to reduce binary size.
- **Formal Verification (Property-Based):** Validated mathematical correctness of modular inverse and interpolation logic using `proptest` (Rust) against thousands of random input vectors.
- **Automated CI/CD:** Integrated GitHub Actions pipeline for automated linting (`clippy`), building, and regression testing on every commit.

##  Architecture

The protocol separates the **Dealer** (who initializes the secret polynomial) from the **Voters** (who hold shares).

1.  **Initialization:** Dealer generates a polynomial $f(x)$ where $f(0) = Secret$.
2.  **Distribution:** Shares $(x, f(x))$ are distributed to voter accounts.
3.  **Voting:** Voters submit `Yes/No`. If `Yes`, their share is added to the temporary on-chain store.
4.  **Reconstruction:** Once `shares_collected >= threshold`, the protocol performs Lagrange Interpolation to reconstruct $f(0)$ and unlock the upgrade file.

##  Prerequisites

Ensure you have the following installed to match the verified build environment:
- **Rust:** v1.75.0 (Aligned with Solana 1.18 toolchain)
- **Solana CLI:** v1.18.18
- **Anchor CLI:** v0.29.0
- **Node.js / Yarn**

## Quick Start

### 1. Installation
Clone the repository and install JavaScript dependencies:
```bash
yarn install
````

### 2\. Build the Program

Compiles the Rust smart contract into BPF bytecode with size optimizations enabled:

```bash
anchor build
```

### 3\. Sync Program ID

Ensures the on-chain program ID matches the build artifact:

```bash
anchor keys sync
```

##  Testing & Verification

This project uses a layered testing strategy to ensure robustness.

### 1\. Math Verification (Unit Tests)

Runs Rust property-based tests (`proptest`) to verify the cryptographic primitives (Modular Inverse, GCD, Interpolation) hold true for random inputs.

```bash
cd programs/secure_voting
cargo test
```

### 2\. Integration & Chaos Tests

Runs the full end-to-end simulation on a local validator, including the **Chaos Fuzz Test** with 50 random actors.

```bash
# From root directory
anchor test
```

**Chaos Test Output Sample:**

```text
💥 STARTING CHAOS FUZZ TESTING 💥
   📊 Chaos Result: 27 YES votes recorded.
   📊 Real Count:   27 YES votes expected.
✅ CHAOS TEST PASSED: System handled 50 random interactions perfectly.
```

## Security Audit

A self-conducted security assessment was performed in Dec 2025.

  - **Findings:** See [AUDIT.md](https://www.google.com/search?q=./AUDIT.md) for details on Arithmetic Overflow risks and Dealer Centralization.
  - **Mitigations:** Stack memory optimization and CI/CD pipelines enforcing `cargo clippy`.

## 📄 License

MIT License. Free for academic and educational use.
