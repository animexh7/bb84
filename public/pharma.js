
/* Pharmaceutical Data Encryption and Decryption */

const pharmaInput = document.getElementById("pharmaData");
const encryptButton = document.getElementById("encryptBtn");
const decryptButton = document.getElementById("decryptBtn");
const encryptedOutput = document.getElementById("encryptedData");
const decryptedOutput = document.getElementById("decryptedData");
const pharmaStatus = document.getElementById("pharmaStatus");

let encryptedRecord = null;
let keyUsedForEncryption = null;
let operationInProgress = false;

const MINIMUM_KEY_BITS = 256;

/* Check the current BB84 verification and key length */
function getKeyStatus() {
    const title = document.getElementById("verificationTitle");
    const bits = window.verifiedBB84Key;

    if (
        window.bb84KeyVerified !== true ||
        !Array.isArray(bits) ||
        !title ||
        title.textContent.trim() !== "Key Verified" ||
        !bits.every(bit => bit === 0 || bit === 1)
    ) {
        return {
            ready: false,
            bits: null,
            message:
                "The BB84 key is not verified. Generate and verify a key first."
        };
    }

    if (bits.length < MINIMUM_KEY_BITS) {
        return {
            ready: false,
            bits: bits.slice(),
            message:
                `The key passed demonstration verification, but only ${bits.length} bits remain. At least ${MINIMUM_KEY_BITS} bits are required for this AES demo. Increase the simulation bit count and generate a new key.`
        };
    }

    return {
        ready: true,
        bits: bits.slice(),
        message: "Verified demonstration key ready for encryption."
    };
}

/* Compare two bit arrays */
function sameBits(first, second) {
    return (
        Array.isArray(first) &&
        Array.isArray(second) &&
        first.length === second.length &&
        first.every((bit, index) => bit === second[index])
    );
}

/* Update button availability */
function updatePharmaButtons() {
    const keyStatus = getKeyStatus();

    if (encryptButton) {
        encryptButton.disabled =
            operationInProgress || !keyStatus.ready;
    }

    if (decryptButton) {
        decryptButton.disabled =
            operationInProgress ||
            !keyStatus.ready ||
            !encryptedRecord ||
            !keyUsedForEncryption;
    }
}

/* Clear previous encrypted and decrypted results */
function clearPharmaResults(message) {
    encryptedRecord = null;
    keyUsedForEncryption = null;

    if (encryptedOutput) {
        encryptedOutput.textContent = "No data encrypted.";
    }

    if (decryptedOutput) {
        decryptedOutput.textContent = "No data decrypted yet.";
    }

    if (pharmaStatus) {
        pharmaStatus.textContent = message;
    }

    updatePharmaButtons();
}

/* Called when a new simulation starts */
window.resetPharmaForNewSimulation = function () {
    clearPharmaResults(
        "Generate and verify a new BB84 key before encrypting data."
    );
};

/* Encrypt pharmaceutical data using the existing aes.js */
if (
    pharmaInput &&
    encryptButton &&
    decryptButton &&
    encryptedOutput &&
    decryptedOutput &&
    pharmaStatus
) {
    encryptButton.addEventListener("click", async function () {
        if (operationInProgress) return;

        const keyStatus = getKeyStatus();

        if (!keyStatus.ready) {
            pharmaStatus.textContent = keyStatus.message;
            updatePharmaButtons();
            return;
        }

        const data = pharmaInput.value.trim();

        if (!data) {
            pharmaStatus.textContent =
                "Please enter pharmaceutical data first.";
            return;
        }

        if (
            typeof window.aesEncrypt !== "function" ||
            typeof window.aesDecrypt !== "function"
        ) {
            pharmaStatus.textContent =
                "AES functions were not loaded. Check the aes.js script.";
            return;
        }

        if (!window.crypto || !window.crypto.subtle) {
            pharmaStatus.textContent =
                "Web Crypto is unavailable. Open the deployed HTTPS site or localhost.";
            return;
        }

        operationInProgress = true;
        updatePharmaButtons();

        encryptedRecord = null;
        keyUsedForEncryption = null;

        encryptedOutput.textContent = "Encrypting...";
        decryptedOutput.textContent = "No data decrypted yet.";
        pharmaStatus.textContent = "Encrypting pharmaceutical data...";

        try {
            const bits = keyStatus.bits;
            const encrypted = await window.aesEncrypt(data, bits);

            /* Make sure the verified key has not changed */
            const currentStatus = getKeyStatus();

            if (
                !currentStatus.ready ||
                !sameBits(bits, currentStatus.bits)
            ) {
                encryptedOutput.textContent = "No data encrypted.";
                pharmaStatus.textContent =
                    "The BB84 key changed. Please generate and verify a new key.";
                return;
            }

            encryptedRecord = encrypted;
            keyUsedForEncryption = bits.slice();

            encryptedOutput.textContent = JSON.stringify(encryptedRecord);

            pharmaStatus.textContent =
                "Encryption successful using the verified BB84 demonstration key.";

        } catch (error) {
            console.error("Pharmaceutical encryption error:", error);

            encryptedRecord = null;
            keyUsedForEncryption = null;
            encryptedOutput.textContent = "No data encrypted.";

            pharmaStatus.textContent =
                error.message ||
                "Encryption failed. Please generate a new verified key.";
        } finally {
            operationInProgress = false;
            updatePharmaButtons();
        }
    });

    /* Decrypt using the same verified BB84 key */
    decryptButton.addEventListener("click", async function () {
        if (operationInProgress) return;

        const keyStatus = getKeyStatus();

        if (!keyStatus.ready) {
            pharmaStatus.textContent = keyStatus.message;
            updatePharmaButtons();
            return;
        }

        if (!encryptedRecord || !keyUsedForEncryption) {
            pharmaStatus.textContent =
                "Encrypt your data first using the current verified key.";
            updatePharmaButtons();
            return;
        }

        if (!sameBits(keyStatus.bits, keyUsedForEncryption)) {
            clearPharmaResults(
                "The BB84 key changed. Encrypt the data again with the new key."
            );
            return;
        }

        operationInProgress = true;
        updatePharmaButtons();

        decryptedOutput.textContent = "Decrypting...";
        pharmaStatus.textContent = "Decrypting pharmaceutical data...";

        try {
            const plaintext = await window.aesDecrypt(
                encryptedRecord,
                keyStatus.bits
            );

            const currentStatus = getKeyStatus();

            if (
                !currentStatus.ready ||
                !sameBits(keyStatus.bits, currentStatus.bits) ||
                !sameBits(keyStatus.bits, keyUsedForEncryption)
            ) {
                decryptedOutput.textContent = "No data decrypted yet.";
                pharmaStatus.textContent =
                    "The BB84 key changed. Please encrypt the data again.";
                return;
            }

            decryptedOutput.textContent = plaintext;
            pharmaStatus.textContent =
                "Decryption successful. Original data recovered.";

        } catch (error) {
            console.error("Pharmaceutical decryption error:", error);

            decryptedOutput.textContent = "Decryption failed.";
            pharmaStatus.textContent =
                "Decryption failed. Check the encrypted data and verified key.";
        } finally {
            operationInProgress = false;
            updatePharmaButtons();
        }
    });

    /* React whenever BB84 verification changes */
    window.addEventListener("bb84-key-updated", function () {
        const keyStatus = getKeyStatus();

        if (!keyStatus.ready) {
            clearPharmaResults(keyStatus.message);
        } else {
            updatePharmaButtons();

            pharmaStatus.textContent =
                "Verified demonstration key ready for encryption.";
        }
    });

    /* Initial button state */
    const initialStatus = getKeyStatus();
    pharmaStatus.textContent = initialStatus.message;
    updatePharmaButtons();

} else {
    console.error(
        "Pharmaceutical UI elements are missing. Check the IDs in index.html."
    );
}
