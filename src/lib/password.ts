// ============================================================
// Hachage de mots de passe — PBKDF2 via Web Crypto.
// Fonctionne en runtime Node ET Edge (crypto.subtle est global).
// Les mots de passe clients ne sont JAMAIS stockés en clair :
// on stocke { salt, hash } et on recompare au login.
// ============================================================

const PBKDF2_ITERATIONS = 100_000

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

export function generateSalt(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return bytesToHex(bytes)
}

export async function hashPassword(password: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password) as BufferSource,
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: hexToBytes(saltHex) as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  )
  return bytesToHex(new Uint8Array(bits))
}

// Comparaison à temps constant (évite les timing attacks), sans dépendance Node.
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

export async function verifyPassword(
  password: string,
  saltHex: string,
  expectedHashHex: string
): Promise<boolean> {
  const actual = await hashPassword(password, saltHex)
  return timingSafeEqualHex(actual, expectedHashHex)
}
