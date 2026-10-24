
function bitsToBytes(bits) {
  if (!Array.isArray(bits) || bits.length < 256) {
    throw new Error(
      "At least 256 shared key bits are required for this demo."
    );
  }

  if (!bits.every(bit => bit === 0 || bit === 1)) {
    throw new Error("Key must contain only 0s and 1s.");
  }

  // Encode the original bit length, then pack bits into bytes.
  const bytes = new Uint8Array(
    4 + Math.ceil(bits.length / 8)
  );

  new DataView(bytes.buffer).setUint32(0, bits.length);

  for (let i = 0; i < bits.length; i++) {
    bytes[4 + Math.floor(i / 8)] |=
      bits[i] << (7 - (i % 8));
  }

  return bytes;
}

async function importAESKey(keyBits, usage) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    bitsToBytes(keyBits),
    "HKDF",
    false,
    ["deriveKey"]
  );

  // A fixed salt and context are suitable for this demo only.
  // Real protocols need carefully designed key management.
  const salt = new TextEncoder().encode("BB84-AES-DEMO-SALT-v1");
  const info = new TextEncoder().encode("pharmaceutical-data");

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt,
      info
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    [usage]
  );
}

function bytesToBase64(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);

  return Uint8Array.from(
    binary,
    character => character.charCodeAt(0)
  );
}

async function aesEncrypt(plaintext, keyBits) {
  const key = await importAESKey(keyBits, "encrypt");
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );

  return {
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv)
  };
}

async function aesDecrypt(encryptedData, keyBits) {
  const key = await importAESKey(keyBits, "decrypt");
  const iv = base64ToBytes(encryptedData.iv);
  const ciphertext = base64ToBytes(encryptedData.ciphertext);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}
