import { hash, verify } from "@node-rs/argon2";

// OWASP-recommended argon2id parameters (19 MiB memory, 2 iterations, 1 lane).
// The @node-rs/argon2 default algorithm is argon2id.
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/**
 * A valid hash of a random value, used to spend the same time verifying a login
 * for a runner name that does not exist (avoids timing-based enumeration).
 */
let dummyHash: Promise<string> | undefined;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(crypto.randomUUID());
  return dummyHash;
}
