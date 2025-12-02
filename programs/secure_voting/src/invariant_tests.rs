use super::*;
use proptest::prelude::*;

// We use the same PRIME as defined in lib.rs
const PRIME: u64 = 2089;

proptest! {
    // Test 1: Verify Modular Inverse Property
    // Mathematically: (a * a^-1) % p must always equal 1
    #[test]
    fn test_modular_inverse_correctness(a in 1u64..PRIME) {
        let inv_result = mod_inverse(a, PRIME);
        
        // It should only fail if 'a' is a multiple of PRIME (which we excluded)
        if let Ok(inv) = inv_result {
            // Check: (a * inv) % PRIME == 1
            let product = (a as u128 * inv as u128) % PRIME as u128;
            assert_eq!(product, 1, "Modular inverse failed for input {}", a);
        }
    }

    // Test 2: Verify Secret Reconstruction
    // If we split a secret into shares, we must be able to get the EXACT secret back.
    #[test]
    fn test_shamir_reconstruction_roundtrip(
        secret in 0u64..PRIME,
        // Generate random unique coefficients for a quadratic polynomial (degree 2, threshold 3)
        c1 in 1u64..PRIME,
        c2 in 1u64..PRIME
    ) {
        // 1. Create Polynomial: f(x) = secret + c1*x + c2*x^2
        // We simulate 3 shares (x=1, x=2, x=3)
        let mut x_vals = [0u64; 3];
        let mut y_vals = [0u64; 3];

        for i in 0..3 {
            let x = (i + 1) as u64;
            let term1 = (c1 * x) % PRIME;
            let term2 = (c2 * x * x) % PRIME;
            let y = (secret + term1 + term2) % PRIME;
            
            x_vals[i] = x;
            y_vals[i] = y;
        }

        // 2. Attempt Reconstruction
        let result = reconstruct_secret(&x_vals, &y_vals);

        // 3. Assert correctness
        assert!(result.is_ok(), "Reconstruction failed");
        assert_eq!(result.unwrap(), secret, "Reconstructed secret did not match original");
    }
}