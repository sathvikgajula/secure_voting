// src/components/Voting.js

import React, { useEffect, useState } from 'react';
import * as anchor from '@coral-xyz/anchor';
import { Buffer } from 'buffer'; // Import Buffer

const PROGRAM_ID = new anchor.web3.PublicKey('4FWXDxhLGqGvdG3gbeS7PqXBoQFqsDBcWa1Bp578PamE');
const VOTE_STATE_SEED = 'vote_state';

const Voting = () => {
    const [wallet, setWallet] = useState(null);
    const [program, setProgram] = useState(null);
    const [voteStatePubkey, setVoteStatePubkey] = useState(null);
    const [idl, setIdl] = useState(null); // Load your IDL here
    const [voteCount, setVoteCount] = useState({ yesVotes: 0, noVotes: 0 });
    const [votingInitialized, setVotingInitialized] = useState(false);
    const [threshold, setThreshold] = useState(3); // Set threshold for secret reconstruction

    useEffect(() => {
        // Load IDL from the specified path
        const loadIdl = async () => {
            try {
                const response = await fetch('/idl/secure_voting.json'); // Adjust path accordingly
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                const idlData = await response.json();
                setIdl(idlData);
            } catch (error) {
                console.error("Error loading IDL:", error);
            }
        };

        loadIdl();
    }, []);

    const connectWallet = async () => {
        console.log("Connect Wallet button clicked");
        
        try {
            const { solana } = window;
            if (solana && solana.isPhantom) {
                const response = await solana.connect();
                setWallet(response.publicKey.toString());
                console.log('Connected with Public Key:', response.publicKey.toString());
                await initializeProgram();
            } else {
                alert('Phantom wallet not found! Please install it.');
            }
        } catch (error) {
            console.error('Error connecting to wallet:', error);
        }
    };

    const initializeProgram = async () => {
        const connection = new anchor.web3.Connection(anchor.web3.clusterApiUrl('devnet'), 'confirmed');
        const provider = new anchor.AnchorProvider(connection, wallet, { preflightCommitment: 'confirmed' });

        if (!idl || !idl.instructions) {
            console.error("IDL is null or does not contain instructions. Cannot initialize program.");
            return;
        }

        try {
            const programInstance = new anchor.Program(idl, PROGRAM_ID, provider);
            setProgram(programInstance);

            let [pubkey] = await anchor.web3.PublicKey.findProgramAddress(
                [Buffer.from(VOTE_STATE_SEED)],
                programInstance.programId
            );

            setVoteStatePubkey(pubkey);
            console.log("Vote State Public Key:", pubkey);
            console.log("Program initialized successfully.");

            await initializeVotingState(); 
        } catch (error) {
            console.error("Error initializing program:", error);
        }
    };

    const initializeVotingState = async () => {
        if (!program || !voteStatePubkey) {
            console.error('Program or Vote State Public Key is not initialized.');
            return;
        }

        try {
            await program.rpc.initialize({
                accounts: {
                    voteState: voteStatePubkey,
                    upgradeFile: anchor.web3.Keypair.generate().publicKey,
                    dealer: wallet,
                    systemProgram: anchor.web3.SystemProgram.programId,
                },
            });
            console.log("Voting state initialized");
            alert("Voting state has been initialized.");
            setVotingInitialized(true); 
            await updateVoteCount(); 
        } catch (error) {
            console.error("Error initializing voting state:", error);
        }
    };

    const vote = async (isYes) => {
        if (!program || !voteStatePubkey) {
            console.error('Program or Vote State Public Key is not initialized. Cannot submit vote.');
            return;
        }
        
        try {
            await program.rpc.submitVote(isYes, {
                accounts: {
                    voter: wallet,
                    voteState: voteStatePubkey,
                    authority: wallet,
                },
            });
            console.log('Vote submitted successfully');
            
            await updateVoteCount(); 
            
            // Check if we can reconstruct the secret based on the threshold
            if (await canReconstructSecret()) {
                alert("Threshold reached! Reconstructing secret...");
                await finalizeVoting(); 
            }
            
        } catch (error) {
            console.error('Error submitting vote:', error);
        }
    };

    const canReconstructSecret = async () => {
        if (!program || !voteStatePubkey) return false;

        try {
            const voteState = await program.account.voteState.fetch(voteStatePubkey);
            
            return voteState.yes_votes.toNumber() >= threshold; // Check if yesVotes meet the threshold
        } catch (error) {
            console.error('Error checking reconstruction eligibility:', error);
            return false;
        }
    };

    const updateVoteCount = async () => {
        if (!program || !voteStatePubkey) {
            console.error('Program or Vote State Public Key is not initialized. Cannot fetch vote count.');
            return;
        }

        try {
            const voteState = await program.account.voteState.fetch(voteStatePubkey);
            setVoteCount({
                yesVotes: voteState.yes_votes.toNumber(),
                noVotes: voteState.no_votes.toNumber(),
            });
        } catch (error) {
            console.error('Error fetching vote count:', error);
        }
    };

    const finalizeVoting = async () => {
        if (!program || !voteStatePubkey) {
            console.error('Program or Vote State Public Key is not initialized. Cannot finalize voting.');
            return;
        }

        try {
            await program.rpc.computeResult({
                accounts: {
                    voteState: voteStatePubkey,
                },
            });
            
            console.log("Voting finalized");
            alert("Voting has been finalized.");
            
            await updateVoteCount(); 
            
        } catch (error) {
            console.error('Error finalizing voting:', error);
        }
    };

    return (
        <div>
            <button onClick={connectWallet}>Connect Wallet</button>
            <button onClick={() => vote(true)}>Vote Yes</button>
            <button onClick={() => vote(false)}>Vote No</button>
            
            {votingInitialized && (
                <div>
                    <h2>Current Vote Count</h2>
                    <p>Yes Votes: {voteCount.yesVotes}</p>
                    <p>No Votes: {voteCount.noVotes}</p>
                    <button onClick={finalizeVoting}>Finalize Voting</button>
                </div>
            )}
        </div>
    );
};

export default Voting;