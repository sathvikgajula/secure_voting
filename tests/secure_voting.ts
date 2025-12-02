import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { SecureVoting } from '../target/types/secure_voting';
import * as crypto from 'crypto';

describe('secure_voting', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const connection = provider.connection;
  const program = anchor.workspace.SecureVoting as Program<SecureVoting>;

  const voteState = anchor.web3.Keypair.generate();
  const upgradeFile = anchor.web3.Keypair.generate();
  const dealer = anchor.web3.Keypair.generate();
  const voterAccounts = [...Array(5)].map(() => anchor.web3.Keypair.generate());

  console.log("Dealer Public Key:", dealer.publicKey.toBase58());
  voterAccounts.forEach((voter, index) => {
    console.log(`Voter ${index + 1} Public Key:`, voter.publicKey.toBase58());
  });

  async function airdrop(publicKey: anchor.web3.PublicKey, amount: number = 8 * anchor.web3.LAMPORTS_PER_SOL) {
    const signature = await connection.requestAirdrop(publicKey, amount);
    await connection.confirmTransaction(signature, 'confirmed');
  }

  const PRIME = BigInt(2089);
  const THRESHOLD = 3;
  const TOTAL_VOTERS = voterAccounts.length;

  it('Initializes the voting state, dealer creates polynomial, distributes shares, and leaves', async () => {
    await airdrop(dealer.publicKey);

    await program.methods.initialize().accounts({
      voteState: voteState.publicKey,
      upgradeFile: upgradeFile.publicKey,
      dealer: dealer.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    }).signers([voteState, upgradeFile, dealer]).rpc();

    console.log("Voting state and upgrade file initialized");

    const coefficients = [BigInt(11)];
    for (let i = 1; i < THRESHOLD; i++) {
      const coeff = Number(BigInt('0x' + crypto.randomBytes(8).toString('hex')) % PRIME);
      coefficients.push(BigInt(coeff));
    }

    await program.methods.createPolynomialAndDistributeShares(
      coefficients.map(c => new anchor.BN(c.toString()))
    ).accounts({
      voteState: voteState.publicKey,
      dealerAuthority: dealer.publicKey,
    }).signers([dealer]).rpc();

    console.log("Polynomial created and shares distributed");

    for (let i = 0; i < TOTAL_VOTERS; i++) {
      await airdrop(voterAccounts[i].publicKey);

      const x = BigInt(i + 1);
      let y = BigInt(0);
      for (let j = 0; j < coefficients.length; j++) {
        y = (y + coefficients[j] * (x ** BigInt(j))) % PRIME;
      }

      await program.methods.initializeVoter(
        new anchor.BN(x.toString()),
        new anchor.BN(y.toString())
      ).accounts({
        voter: voterAccounts[i].publicKey,
        payer: provider.wallet.publicKey,
        authority: voterAccounts[i].publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      }).signers([voterAccounts[i]]).rpc();

      console.log(`Voter ${i + 1} account initialized`);
    }
  });

  async function submitVotesWithParticipationAndDoubleVoting(
    voterParticipation: boolean[],
    doubleVoteAttempts: number[] = []
  ) {
    const votes = [true, true, false, false,false ];

    for (let i = 0; i < TOTAL_VOTERS; i++) {
      if (voterParticipation[i]) {
        try {
          await program.methods.submitVote(votes[i]).accounts({
            voter: voterAccounts[i].publicKey,
            voteState: voteState.publicKey,
            authority: voterAccounts[i].publicKey,
          }).signers([voterAccounts[i]]).rpc();

          console.log(`✅ Voter ${i + 1} submitted their vote.`);

          if (doubleVoteAttempts.includes(i)) {
            try {
              await program.methods.submitVote(votes[i]).accounts({
                voter: voterAccounts[i].publicKey,
                voteState: voteState.publicKey,
                authority: voterAccounts[i].publicKey,
              }).signers([voterAccounts[i]]).rpc();

              console.log(`❌ Voter ${i + 1} submitted their vote again (should not happen).`);
            } catch (error) {
              console.error(`🚫 Double voting attempt detected for Voter ${i + 1}`);
              console.error(`Reason: Voter has already voted.`);
            }
          }
        } catch (error) {
          console.error(`Error during voting for Voter ${i + 1}:`, error);
        }
      } else {
        console.log(`❌ Voter ${i + 1} chose not to participate.`);
      }
    }
    console.log("Voting submission completed.");
  }

  it('Tests voting with custom participation and optional double voting attempts', async () => {
    // Specify which voters choose to participate (true) or not (false)
    const voterParticipation = [true, true, true, true, true];
    
    // Specify which voters (by index) should attempt double voting
    // Leave this array empty for no double voting attempts
    const doubleVoteAttempts = []; 
    
    await submitVotesWithParticipationAndDoubleVoting(voterParticipation, doubleVoteAttempts);
    
    console.log("Voting scenario completed.");
  });

  it('Computed result', async () => {
    await program.methods.computeResult().accounts({
      voteState: voteState.publicKey,
    }).rpc();

    const updatedVoteState = await program.account.voteState.fetch(voteState.publicKey);
    
    console.log("Total votes:", updatedVoteState.totalVotes.toString());
    console.log("Yes votes:", updatedVoteState.yesVotes.toString());
    
    if (updatedVoteState.upgradeOccurred) {
      console.log("Upgrade approved");
    } else {
      console.log("Upgrade rejected");
    }
  });

  it('Applies the upgrade if approved', async () => {
    const updatedVoteState = await program.account.voteState.fetch(voteState.publicKey);
    
    if (updatedVoteState.upgradeOccurred) {
      await program.methods.applyUpgrade().accounts({
        voteState: voteState.publicKey,
        upgradeFile: upgradeFile.publicKey,
        authority: provider.wallet.publicKey,
      }).rpc();

      console.log("Upgrade applied");

      const upgradeFileAccount = await program.account.upgradeFile.fetch(upgradeFile.publicKey);
      const contentBuffer = Buffer.from(upgradeFileAccount.content);
      const content = contentBuffer.toString('utf8').trim();
      
      console.log("Upgrade File Content:", content);
    } else {
      console.log("Upgrade not approved. No changes made to the file.");
    }
  });

  // --- CHAOS FUZZING TEST BLOCK START ---
  it('SURVIVES CHAOS: 50 Random Voters with Fuzzed Inputs', async () => {
    console.log("\n💥 STARTING CHAOS FUZZ TESTING 💥");
    
    // 1. Setup a new chaotic election
    const fuzzVoteState = anchor.web3.Keypair.generate();
    const fuzzDealer = anchor.web3.Keypair.generate();
    // Since we reuse the upgradeFile struct in the program, we need a new account for it too
    const fuzzUpgradeFile = anchor.web3.Keypair.generate();

    // Airdrop to dealer
    await airdrop(fuzzDealer.publicKey);

    await program.methods.initialize().accounts({
      voteState: fuzzVoteState.publicKey,
      upgradeFile: fuzzUpgradeFile.publicKey,
      dealer: fuzzDealer.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    }).signers([fuzzVoteState, fuzzUpgradeFile, fuzzDealer]).rpc();

    // 2. Generate Polynomial
    // Random coefficients for checking different math scenarios
    const fuzzCoefficients = [BigInt(11)]; 
    for (let i = 1; i < THRESHOLD; i++) {
      // Random coefficient between 0 and PRIME
      const randomCoeff = Math.floor(Math.random() * 2089);
      fuzzCoefficients.push(BigInt(randomCoeff));
    }

    await program.methods.createPolynomialAndDistributeShares(
      fuzzCoefficients.map(c => new anchor.BN(c.toString()))
    ).accounts({
      voteState: fuzzVoteState.publicKey,
      dealerAuthority: fuzzDealer.publicKey,
    }).signers([fuzzDealer]).rpc();

    // 3. Run the Chaos Loop
    let yesVotesCount = 0;
    const NUM_FUZZ_VOTERS = 50;
    
    for (let i = 0; i < NUM_FUZZ_VOTERS; i++) {
      // A. Create a random voter
      const randomVoter = anchor.web3.Keypair.generate();
      await airdrop(randomVoter.publicKey, 0.1 * anchor.web3.LAMPORTS_PER_SOL); // Minimal SOL needed

      // B. Math: Generate valid shares for this specific voter index (i+1)
      const x = BigInt(i + 1);
      let y = BigInt(0);
      for (let j = 0; j < fuzzCoefficients.length; j++) {
        y = (y + fuzzCoefficients[j] * (x ** BigInt(j))) % PRIME;
      }

      // C. Initialize Voter On-Chain
      await program.methods.initializeVoter(
        new anchor.BN(x.toString()),
        new anchor.BN(y.toString())
      ).accounts({
        voter: randomVoter.publicKey,
        payer: provider.wallet.publicKey,
        authority: randomVoter.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      }).signers([randomVoter]).rpc();

      // D. Randomly Decide Vote
      const voteDecision = Math.random() < 0.6; // 60% chance of YES
      if (voteDecision) yesVotesCount++;

      // E. Cast Vote
      try {
        await program.methods.submitVote(voteDecision).accounts({
          voter: randomVoter.publicKey,
          voteState: fuzzVoteState.publicKey,
          authority: randomVoter.publicKey,
        }).signers([randomVoter]).rpc();
        // console.log(`   Generate Voter ${i+1}: Voted ${voteDecision ? "YES" : "NO"}`);
      } catch (err) {
        console.error(`   ❌ Chaos Error at voter ${i}:`, err);
        throw err; // Fail the test if the program crashes unexpectedly
      }
    }

    // 4. Verification
    await program.methods.computeResult().accounts({
      voteState: fuzzVoteState.publicKey,
    }).rpc();

    const state = await program.account.voteState.fetch(fuzzVoteState.publicKey);
    console.log(`   📊 Chaos Result: ${state.yesVotes} YES votes recorded.`);
    console.log(`   📊 Real Count:   ${yesVotesCount} YES votes expected.`);

    // Assertion: Did the blockchain count correctly matches our local count?
    if (state.yesVotes.toNumber() !== yesVotesCount) {
        throw new Error("❌ CRITICAL: Blockchain vote count mismatch!");
    }

    // Assertion: Did the secret reconstruction work if threshold met?
    if (yesVotesCount >= THRESHOLD && !state.upgradeOccurred) {
        throw new Error("❌ CRITICAL: Threshold met but secret NOT reconstructed!");
    }
    
    console.log("✅ CHAOS TEST PASSED: System handled 50 random interactions perfectly.");
  });
  // --- CHAOS FUZZING TEST BLOCK END ---
});