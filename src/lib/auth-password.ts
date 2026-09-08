import {
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const HASH_PREFIX = "scrypt";
const HASH_LENGTH = 64;

export function verifyPassword(
  password: string,
  storedHash: string
) {
  const [prefix, saltHex, hashHex] = storedHash.split("$");

  if (
    prefix !== HASH_PREFIX ||
    !saltHex ||
    !hashHex ||
    !/^[0-9a-f]+$/i.test(saltHex) ||
    !/^[0-9a-f]+$/i.test(hashHex)
  ) {
    return false;
  }

  try {
    const expected = Buffer.from(hashHex, "hex");

    if (expected.length !== HASH_LENGTH) {
      return false;
    }

    const actual = scryptSync(
      password,
      Buffer.from(saltHex, "hex"),
      HASH_LENGTH
    );

    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
