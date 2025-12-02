import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { PublicKey } from '@solana/web3.js';

// Since we can't import the types directly, we'll define a minimal interface
interface SecureVoting extends Program {
  methods: {
    initialize: (userVote: anchor.BN) => any;
  }
}

module.exports = async function (provider: anchor.AnchorProvider) {
  // Configure client to use the provider.
  anchor.setProvider(provider);

  // Get the program ID from the workspace
  const programId = new PublicKey("3pqQ2gAWU3jCDk4BmR1c7vVvbcHYpJiDAsbhRGLWRLcs");

  // Fetch the program from the workspace using the program ID
  const program = new anchor.Program(
    require("../target/idl/secure_voting.json"),
    programId,
    provider
  ) as unknown as SecureVoting;

  console.log("Deploying Secure Voting program...");

  // Initialize the vote state
  const voteState = anchor.web3.Keypair.generate();
  const userVote = new anchor.BN(1); // Example vote

  try {
    await program.methods
      .initialize(userVote)
      .accounts({
        voteState: voteState.publicKey,
        initializer: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        voterAccounts: Array(5).fill(null).map(() => anchor.web3.Keypair.generate().publicKey),
      })
      .signers([voteState])
      .rpc();

    console.log("Vote state initialized with public key:", voteState.publicKey.toBase58());
  } catch (error) {
    console.error("Error during deployment:", error);
  }
};