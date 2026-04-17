/**
 * cryptoCookies.ts
 * • Because the PBKDF2 passphrase lives in JS bundle source, its not the worlds most secure
 *   implementation. If someone really wanted to they could decompile the source code and find
 *   the passphrase but it prevents casual inspection */

// ── Constants ────────────────────────────────────────────────────────────────

/** Changing either of these will invalidate all previously stored cookies. */
const PBKDF2_PASSPHRASE = "comp3900-ontology-explorer-cookie-v1";
const PBKDF2_SALT_STR = "ontology-api-key-salt-v1";
const PBKDF2_ITERATIONS = 100_000;
const AES_IV_BYTES = 12; // 96-bit IV for AES-GCM


let _keyCache: Promise<CryptoKey> | null = null;

function getKey(): Promise<CryptoKey> {
    if (_keyCache) return _keyCache;
    _keyCache = (async () => {
        const rawKeyMaterial = await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(PBKDF2_PASSPHRASE),
            { name: "PBKDF2" },
            false,
            ["deriveKey"]
        );
        return crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: new TextEncoder().encode(PBKDF2_SALT_STR),
                iterations: PBKDF2_ITERATIONS,
                hash: "SHA-256",
            },
            rawKeyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
    })();
    return _keyCache;
}

// ── Encoding helpers ──────────────────────────────────────────────────────────

function bufToBase64(buf: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToBuf(b64: string): Uint8Array {
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// ── Low-level cookie access ───────────────────────────────────────────────────

function readRawCookie(name: string): string | null {
    const entry = document.cookie
        .split("; ")
        .find((row) => row.startsWith(`${name}=`));
    return entry ? decodeURIComponent(entry.slice(name.length + 1)) : null;
}

function buildCookieString(name: string, value: string, maxAge: number): string {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    return `${name}=${encodeURIComponent(value)}; SameSite=Strict${secure}; max-age=${maxAge}; path=/`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** One year in seconds. */
const ONE_YEAR = 60 * 60 * 24 * 365;

export async function encryptToCookie(name: string, value: string): Promise<void> {
    const key = await getKey();
    const iv = crypto.getRandomValues(new Uint8Array(AES_IV_BYTES));

    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        new TextEncoder().encode(value)
    );

    // Store as base64(IV ‖ ciphertext)
    const combined = new Uint8Array(AES_IV_BYTES + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), AES_IV_BYTES);

    document.cookie = buildCookieString(name, bufToBase64(combined.buffer), ONE_YEAR);
}

export async function decryptFromCookie(name: string): Promise<string | null> {
    const raw = readRawCookie(name);
    if (!raw) return null;
    try {
        const key = await getKey();
        const combined = base64ToBuf(raw);
        const iv = combined.slice(0, AES_IV_BYTES);
        const ciphertext = combined.slice(AES_IV_BYTES);

        const plaintext = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key,
            ciphertext
        );
        return new TextDecoder().decode(plaintext);
    } catch {
        // Corrupted / wrong key — treat as absent
        return null;
    }
}

/**
 * Returns `true` if an encrypted cookie with the given name is present.
 */
export function hasCookie(name: string): boolean {
    return readRawCookie(name) !== null;
}

/**
 * Remove a previously stored cookie.
 */
export function removeCookie(name: string): void {
    document.cookie = buildCookieString(name, "", 0);
}
