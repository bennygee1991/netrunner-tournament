import { randomInt } from "node:crypto";
import type { Rng } from "@/engine";

/** Cryptographically random source for live events (pairings, coin flips). */
export const cryptoRng: Rng = () => randomInt(0, 2 ** 32) / 2 ** 32;
