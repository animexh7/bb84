
function generateRandomBases(length) {
    if (!Number.isInteger(length) || length < 0) {
        throw new Error("Length must be a non-negative integer.");
    }

    const bases = [];

    for (let i = 0; i < length; i++) {
        bases.push(Math.random() < 0.5 ? "Z" : "X");
    }

    return bases;
}

function measurePhoton(photon, guessedBasis) {
    if (
        !photon ||
        (photon.bit !== 0 && photon.bit !== 1) ||
        (photon.basis !== "Z" && photon.basis !== "X")
    ) {
        throw new Error("Invalid photon. Check its bit and basis.");
    }

    if (guessedBasis !== "Z" && guessedBasis !== "X") {
        throw new Error("Basis must be Z or X.");
    }

    if (photon.basis === guessedBasis) {
        return photon.bit;
    }

    // Different bases produce a random measurement result.
    return Math.random() < 0.5 ? 0 : 1;
}

function compareKeys(labKey, plantKey, sampleFraction = 0.5) {
    if (!Array.isArray(labKey) || !Array.isArray(plantKey)) {
        throw new Error("Keys must be arrays.");
    }

    if (labKey.length !== plantKey.length) {
        throw new Error("Key lengths must match.");
    }

    // Validate that every key element is a binary bit.
    if (
        !labKey.every(bit => bit === 0 || bit === 1) ||
        !plantKey.every(bit => bit === 0 || bit === 1)
    ) {
        throw new Error("Keys must contain only 0s and 1s.");
    }

    if (
        typeof sampleFraction !== "number" ||
        !Number.isFinite(sampleFraction) ||
        sampleFraction < 0 ||
        sampleFraction > 1
    ) {
        throw new Error("Sample fraction must be between 0 and 1.");
    }

    const length = labKey.length;
    const threshold = 11;

    if (length === 0) {
        return {
            sampledBits: 0,
            mismatches: 0,
            qber: null,
            threshold,
            secureEnough: false,
            message: "No sifted bits available.",
            remainingLabKey: [],
            remainingPlantKey: []
        };
    }

    // Randomly select positions for key comparison.
    const indices = Array.from({ length }, (_, i) => i);

    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    // Keep at least one bit for the remaining key.
    const maxSampleSize = Math.max(0, length - 1);
    const requestedSampleSize = Math.floor(length * sampleFraction);
    const sampleSize = Math.min(requestedSampleSize, maxSampleSize);

    const sampleIndices = indices.slice(0, sampleSize);
    const sampledPositions = new Set(sampleIndices);

    let mismatches = 0;

    for (const index of sampleIndices) {
        if (labKey[index] !== plantKey[index]) {
            mismatches++;
        }
    }

    const qber =
        sampleSize > 0 ? (mismatches / sampleSize) * 100 : null;

    const remainingLabKey = labKey.filter(
        (_, index) => !sampledPositions.has(index)
    );

    const remainingPlantKey = plantKey.filter(
        (_, index) => !sampledPositions.has(index)
    );

    const enoughSampleData = sampleSize >= 10;
    const hasRemainingKey = remainingLabKey.length > 0;
    const keysMatch = remainingLabKey.every(
        (bit, index) => bit === remainingPlantKey[index]
    );

    const secureEnough =
        enoughSampleData &&
        hasRemainingKey &&
        qber !== null &&
        qber <= threshold &&
        keysMatch;

    let message;

    if (length === 1) {
        message = "Insufficient key bits for comparison.";
    } else if (!enoughSampleData) {
        message = "Sample too small to verify security.";
    } else if (!hasRemainingKey) {
        message = "No key bits remain after sampling.";
    } else if (qber > threshold) {
        message = "Possible eavesdropping detected. Key rejected.";
    } else if (!keysMatch) {
        message = "Remaining keys do not match. Key rejected.";
    } else {
        message = "Low QBER detected. Further security checks are required.";
    }

    return {
        sampledBits: sampleSize,
        mismatches,
        qber,
        threshold,
        secureEnough,
        message,
        remainingLabKey,
        remainingPlantKey
    };
}
