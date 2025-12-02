use anchor_lang::prelude::*;

declare_id!("H194n25SeQTsUFnXWeySFND4Hi3xB5aktuSaKWKSgbFR");

// Constants for the voting system
const THRESHOLD: usize = 3;       // Minimum number of shares needed to reconstruct the secret
const TOTAL_VOTERS: usize = 5;    // Total number of voters
const PRIME: u64 = 2089;          // Prime number for finite field arithmetic
const SECRET: u64 = 11;           // The secret to be reconstructed

#[program]
pub mod secure_voting {
    use super::*;

    // Initialize the voting state and the upgrade file
    pub fn initialize(
        ctx: Context<Initialize>,
    ) -> Result<()> {
        let vote_state = &mut ctx.accounts.vote_state;
        vote_state.threshold = THRESHOLD as u64;
        vote_state.total_voters = TOTAL_VOTERS as u64;
        vote_state.upgrade_occurred = false;
        vote_state.shares_collected = 0;
        vote_state.x_values = [0u64; THRESHOLD];
        vote_state.y_values = [0u64; THRESHOLD];
        vote_state.dealer_authority = ctx.accounts.dealer.key();
        vote_state.yes_votes = 0;
        vote_state.total_votes = 0;

        let upgrade_file = &mut ctx.accounts.upgrade_file;
        let initial_content = "Before upgrading";
        let content_bytes = initial_content.as_bytes();

        require!(
            content_bytes.len() <= upgrade_file.content.len(),
            VoteError::ContentTooLarge
        );

        upgrade_file.content[..content_bytes.len()].copy_from_slice(content_bytes);

        Ok(())
    }

    // Dealer creates polynomial and distributes shares
    pub fn create_polynomial_and_distribute_shares(
        ctx: Context<CreatePolynomialAndDistributeShares>,
        coefficients: Vec<u64>,
    ) -> Result<()> {
        let vote_state = &mut ctx.accounts.vote_state;
        
        require!(coefficients.len() == THRESHOLD, VoteError::InvalidPolynomialDegree);
        vote_state.coefficients = coefficients;
        
        // The dealer's job is done after this, so we can remove the dealer's authority
        vote_state.dealer_authority = Pubkey::default();

        Ok(())
    }

    // Initialize a voter account
    pub fn initialize_voter(
        ctx: Context<InitializeVoter>,
        share_x: u64,
        share_y: u64,
    ) -> Result<()> {
        let voter = &mut ctx.accounts.voter;
        voter.has_voted = false;
        voter.share_x = share_x;
        voter.share_y = share_y;
        voter.authority = ctx.accounts.authority.key();

        Ok(())
    }

    // Submit a vote
    pub fn submit_vote(ctx: Context<SubmitVote>, vote: bool) -> Result<()> {
        let voter = &mut ctx.accounts.voter;
        let vote_state = &mut ctx.accounts.vote_state;

        require!(!voter.has_voted, VoteError::AlreadyVoted);

        voter.has_voted = true;
        vote_state.total_votes += 1;

        if vote {
            vote_state.yes_votes += 1;
            if vote_state.shares_collected < vote_state.threshold {
                let index = vote_state.shares_collected as usize;
                vote_state.x_values[index] = voter.share_x;
                vote_state.y_values[index] = voter.share_y;
                vote_state.shares_collected += 1;
            }
        }

        Ok(())
    }

    // Compute the final result
    pub fn compute_result(ctx: Context<ComputeResult>) -> Result<()> {
        let vote_state = &mut ctx.accounts.vote_state;

        if vote_state.yes_votes >= vote_state.threshold {
            let secret = reconstruct_secret(
                &vote_state.x_values[..vote_state.threshold as usize],
                &vote_state.y_values[..vote_state.threshold as usize],
            )?;

            vote_state.upgrade_occurred = secret == SECRET;
        } else {
            vote_state.upgrade_occurred = false;
        }

        Ok(())
    }

    // Apply the upgrade by updating the UpgradeFile account
    pub fn apply_upgrade(ctx: Context<ApplyUpgrade>) -> Result<()> {
        let vote_state = &ctx.accounts.vote_state;
        let upgrade_file = &mut ctx.accounts.upgrade_file;

        require!(
            vote_state.upgrade_occurred,
            VoteError::UpgradeNotApproved
        );

        let new_content = "Successfully implemented upgrading file";
        let content_bytes = new_content.as_bytes();

        require!(
            content_bytes.len() <= upgrade_file.content.len(),
            VoteError::ContentTooLarge
        );

        upgrade_file.content[..content_bytes.len()].copy_from_slice(content_bytes);

        Ok(())
    }
}

// Function to reconstruct the secret using Lagrange interpolation
// CHANGED: Made public for testing
#[inline(never)]
pub fn reconstruct_secret(x_values: &[u64], y_values: &[u64]) -> Result<u64> {
    let threshold = x_values.len();
    let mut secret = 0u64;

    for i in 0..threshold {
        let mut numerator = 1u64;
        let mut denominator = 1u64;

        for j in 0..threshold {
            if i != j {
                numerator = (numerator * (PRIME - x_values[j] % PRIME)) % PRIME;
                denominator = (denominator * ((x_values[i] + PRIME - x_values[j]) % PRIME)) % PRIME;
            }
        }

        let inv_denominator = mod_inverse(denominator, PRIME)?;
        let lagrange_coefficient = (numerator * inv_denominator) % PRIME;

        secret = (secret + (y_values[i] * lagrange_coefficient)) % PRIME;
    }

    Ok(secret)
}

// Function to compute modular inverse using the extended Euclidean algorithm
// CHANGED: Made public for testing
#[inline(never)]
pub fn mod_inverse(a: u64, modulus: u64) -> Result<u64> {
    let (gcd, x, _) = extended_gcd(a as i64, modulus as i64);
    require!(gcd == 1, VoteError::NonInvertible);

    Ok(((x % modulus as i64 + modulus as i64) % modulus as i64) as u64)
}

// Iterative implementation of the extended Euclidean algorithm
// CHANGED: Made public for testing
#[inline(never)]
pub fn extended_gcd(mut a: i64, mut b: i64) -> (i64, i64, i64) {
    let mut x0 = 1i64;
    let mut y0 = 0i64;
    let mut x1 = 0i64;
    let mut y1 = 1i64;

    while b != 0 {
        let q = a / b;
        let (a_old, b_old) = (a, b);
        a = b;
        b = a_old % b_old;

        let (x0_old, x1_old) = (x0, x1);
        x0 = x1;
        x1 = x0_old - q * x1_old;

        let (y0_old, y1_old) = (y0, y1);
        y0 = y1;
        y1 = y0_old - q * y1_old;
    }

    (a, x0, y0)
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = dealer, space = VoteState::LEN)]
    pub vote_state: Box<Account<'info, VoteState>>, // BOXED

    #[account(init, payer = dealer, space = UpgradeFile::LEN)]
    pub upgrade_file: Box<Account<'info, UpgradeFile>>, // BOXED

    #[account(mut)]
    pub dealer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreatePolynomialAndDistributeShares<'info> {
    #[account(mut, has_one = dealer_authority)]
    pub vote_state: Box<Account<'info, VoteState>>, // BOXED
    pub dealer_authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct InitializeVoter<'info> {
    #[account(init, payer = payer, space = Voter::LEN)]
    pub voter: Account<'info, Voter>, // Voter is small, usually fine unboxed, but can box if needed

    /// CHECK: We can use any account as the payer
    #[account(mut)]
    pub payer: Signer<'info>,

    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitVote<'info> {
    #[account(mut, has_one = authority)]
    pub voter: Box<Account<'info, Voter>>, // BOXED to be safe with stack limits when combined with VoteState

    #[account(mut)]
    pub vote_state: Box<Account<'info, VoteState>>, // BOXED

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ComputeResult<'info> {
    #[account(mut)]
    pub vote_state: Box<Account<'info, VoteState>>, // BOXED
}

#[derive(Accounts)]
pub struct ApplyUpgrade<'info> {
    #[account(mut)]
    pub vote_state: Box<Account<'info, VoteState>>, // BOXED

    #[account(mut)]
    pub upgrade_file: Box<Account<'info, UpgradeFile>>, // BOXED

    pub authority: Signer<'info>,
}

#[account]
pub struct VoteState {
    pub threshold: u64,
    pub total_voters: u64,
    pub shares_collected: u64,
    pub x_values: [u64; THRESHOLD],
    pub y_values: [u64; THRESHOLD],
    pub upgrade_occurred: bool,
    pub coefficients: Vec<u64>,
    pub dealer_authority: Pubkey,
    pub yes_votes: u64,
    pub total_votes: u64,
}

impl VoteState {
    pub const LEN: usize = 8 + 24 + 48 + 1 + 7 + 32 + (8 * THRESHOLD) + 32 + 8 + 8;
}

#[account]
pub struct UpgradeFile {
    pub content: [u8; 64],
}

impl UpgradeFile {
    pub const LEN: usize = 8 + 64;
}

#[account]
pub struct Voter {
    pub has_voted: bool,
    pub share_x: u64,
    pub share_y: u64,
    pub authority: Pubkey,
}

impl Voter {
    pub const LEN: usize = 8 + 1 + 7 + 8 + 8 + 32;
}

#[error_code]
pub enum VoteError {
    #[msg("Voter has already voted")]
    AlreadyVoted,
    #[msg("Insufficient shares to compute the result")]
    InsufficientShares,
    #[msg("Non-invertible element encountered")]
    NonInvertible,
    #[msg("Upgrade has not been approved")]
    UpgradeNotApproved,
    #[msg("Content is too large for the UpgradeFile account")]
    ContentTooLarge,
    #[msg("Invalid polynomial degree")]
    InvalidPolynomialDegree,
}

// Include the invariant tests module (make sure you created this file!)
#[cfg(test)]
mod invariant_tests;