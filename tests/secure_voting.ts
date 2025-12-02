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
});