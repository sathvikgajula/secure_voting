

# Secure Voting Using Shamir's Secret Sharing on Solana Blockchain

## Overview
This project implements a secure, decentralized voting system leveraging **Shamir's Secret Sharing Scheme (SSS)** and the **Solana blockchain**. It ensures privacy, anonymity, and threshold-based decision-making, enabling trustless and tamper-proof voting. The smart contract, written in Rust, handles secure vote aggregation, secret reconstruction, and automated action execution upon reaching consensus.

---

## **Features**
- **Dealerless Voting**: The system operates without a central authority after initialization, enhancing decentralization.
- **Threshold Enforcement**: Actions (e.g., file upgrades) occur only when a predefined number of "Yes" votes are reached.
- **Privacy and Anonymity**: Voter privacy is ensured using cryptographic techniques.
- **Blockchain Integration**: Immutable vote storage and secure execution via Solana smart contracts.

---

## **Technologies Used**
- **Languages**: Rust, TypeScript
- **Blockchain Framework**: Solana CLI, Anchor Framework
- **Cryptographic Techniques**: Shamir's Secret Sharing Scheme (SSS), Threshold Cryptography
- **Testing Tools**: Solana Localnet, Mocha (for client-side scripts)

---

## **Project Workflow**
1. **Initialize the Voting System**:
   - Set up the voting state, define thresholds, and prepare for share distribution.
2. **Generate and Distribute Shares**:
   - Dealer creates a polynomial using SSS and distributes shares to participants.
3. **Vote Submission**:
   - Voters submit their shares along with their "Yes" or "No" votes.
4. **Threshold Enforcement and Secret Reconstruction**:
   - The system validates if the threshold is met and reconstructs the secret using Lagrange Interpolation.
5. **Result Computation**:
   - If the reconstructed secret matches the original, actions (e.g., upgrading a file) are executed securely.

---

## **Installation and Setup**
### **Prerequisites**
- **Rust**: Install using [rustup](https://rustup.rs/).
- **Solana CLI**: Follow the [official guide](https://docs.solana.com/cli/install-solana-cli-tools).
- **Anchor Framework**: Install via Cargo:
  ```bash
  cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
  ```
- **Node.js**: Ensure you have Node.js installed for running client-side scripts.

### **Steps**
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/secure-voting
   cd secure-voting
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the smart contract:
   ```bash
   anchor build
   ```
4. Deploy to Solana Localnet:
   ```bash
   anchor deploy
   ```
5. Run tests:
   ```bash
   anchor test
   ```

---

## **Usage**
### **Key Files**
- **Smart Contract**:
  - `programs/secure_voting/src/lib.rs`: Core logic for voting, share distribution, and result computation.
- **Client Scripts**:
  - `tests/secure_voting.ts`: Simulates voting scenarios and validates functionality.
- **IDL**:
  - `target/idl/secure_voting.json`: Interface description for interacting with the smart contract.

### **How to Test Voting**
1. Initialize the voting state using the `initialize` function.
2. Generate and distribute shares using the `create_polynomial_and_distribute_shares` function.
3. Simulate voter participation by calling the `submit_vote` function.
4. Compute the voting result using `compute_result` and validate the outcome.

---

## **Challenges and Future Enhancements**
### **Challenges**
- Integration of cryptographic logic with Solana smart contracts.
- Manual wallet generation and predefined secret values for testing.
- Balancing computational complexity with performance efficiency.

### **Future Enhancements**
- **Dynamic Wallet Integration**: Allow users to connect Solana-compatible wallets (e.g., Phantom) for seamless voting participation.
- **Dynamic Secret Management**: Implement secure off-chain secret generation to eliminate hardcoded values.
- **Scalability**: Integrate Zero-Knowledge Proofs (ZKP) for enhanced privacy and support for larger voter groups.

---

## **Contributing**
Contributions are welcome! Feel free to fork the repository, make improvements, and submit pull requests.

---

## **Contact**
For questions or suggestions, feel free to contact **[Sathvik Gajula](mailto:sgajula2023@fau.edu)**.

---
