// Interceptor (e.g. a counterfeiter on the line): intercept-and-resend attack

function generateInterceptorBases(numberOfBits) {
    const bases = [];

    for (let i = 0; i < numberOfBits; i++) {
        bases.push(Math.random() < 0.5 ? "Z" : "X");
    }

    return bases;
}

function interceptAndResend(photons) {
    // The interceptor chooses random measurement bases
    const interceptorBases = generateInterceptorBases(photons.length);

    const interceptorBits = [];

    // The interceptor measures each photon
    for (let i = 0; i < photons.length; i++) {
        const measuredBit = measurePhoton(
            photons[i],
            interceptorBases[i]
        );

        interceptorBits.push(measuredBit);
    }

    // The interceptor creates new photons and forwards them to the plant
    const forwardedPhotons = encodePhoton(
        interceptorBits,
        interceptorBases
    );

    return {
        interceptorBases: interceptorBases,
        interceptorBits: interceptorBits,
        forwardedPhotons: forwardedPhotons
    };
}
