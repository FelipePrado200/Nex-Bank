/**
 * luhn.ts
 * Luhn algorithm — card number generation and validation.
 *
 * All generated PANs use test BINs (not assigned to real issuers).
 * Generated cards are for TEST ONLY and will not work in real stores.
 */

import { randomInt } from "crypto";

// Test BINs — not assigned to real issuers
const TEST_BINS: Record<string, string> = {
  MASTERCARD: "5299", // MC test BIN range 5200-5599
  VISA:       "4111", // Visa test BIN
  ELO:        "6362", // Elo test BIN
};

// ─────────────────────────────────────────────
// Luhn check digit
// ─────────────────────────────────────────────

/**
 * Computes the Luhn check digit for a partial PAN (without check digit).
 */
export function luhnCheckDigit(partial: string): number {
  const digits = partial.split("").map(Number);
  let sum = 0;

  // The check digit will be appended at the right, so the rightmost digit of the
  // partial PAN sits in the 2nd position from the right and must be doubled.
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits[i];
    if ((digits.length - i) % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }

  return (10 - (sum % 10)) % 10;
}

// ─────────────────────────────────────────────
// Validate a full PAN
// ─────────────────────────────────────────────

/**
 * Returns true if the full PAN passes the Luhn check.
 */
export function luhnValidate(pan: string): boolean {
  if (!/^\d+$/.test(pan)) return false;
  const digits = pan.split("").map(Number);
  let sum = 0;

  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits[i];
    if ((digits.length - i) % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }

  return sum % 10 === 0;
}

// ─────────────────────────────────────────────
// Generate a valid PAN
// ─────────────────────────────────────────────

/**
 * Generates a valid 16-digit PAN for the given network.
 * Uses a test BIN — the number is Luhn-valid but not a real card.
 */
export function generatePan(network: "VISA" | "MASTERCARD" | "ELO"): string {
  const bin = TEST_BINS[network];
  if (!bin) throw new Error(`Unknown network: ${network}`);

  // Fill remaining digits randomly (bin + 11 random + 1 check digit = 16)
  const randomLength = 15 - bin.length; // 11 random digits
  let partial = bin;

  for (let i = 0; i < randomLength; i++) {
    partial += randomInt(0, 10).toString();
  }

  const check = luhnCheckDigit(partial);
  const pan = partial + check.toString();

  // Sanity check
  if (!luhnValidate(pan)) {
    throw new Error("Generated PAN failed Luhn validation — this is a bug.");
  }

  return pan;
}

// ─────────────────────────────────────────────
// Generate CVV
// ─────────────────────────────────────────────

/**
 * Generates a random 3-digit CVV.
 * Note: Real CVVs are derived from card data + a secret key (CVV algorithm).
 * For this test system we use a cryptographically random 3-digit number.
 */
export function generateCvv(): string {
  // Use crypto for better randomness
  return randomInt(100, 1000).toString(); // 100–999 inclusive
}

// ─────────────────────────────────────────────
// Generate expiry date
// ─────────────────────────────────────────────

/** Returns { month, year } for a card expiring `yearsFromNow` years in the future. */
export function generateExpiry(yearsFromNow = 5): { month: number; year: number } {
  const now = new Date();
  return {
    month: now.getMonth() + 1, // 1-based
    year: now.getFullYear() + yearsFromNow,
  };
}

// ─────────────────────────────────────────────
// Format PAN for display
// ─────────────────────────────────────────────

/**
 * Formats a PAN as groups of 4: "1234 5678 9012 3456"
 * Never show the full PAN to the client — use masked version instead.
 */
export function formatPan(pan: string): string {
  return pan.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

/** Returns the display-safe masked PAN: "•••• •••• •••• 3456" */
export function maskPan(lastFour: string): string {
  return `•••• •••• •••• ${lastFour}`;
}
