/**
 * Matrix JS SDK Bundle with Crypto Support
 * This file exports the Matrix SDK for use in browser environments
 */

// Import the Matrix SDK
import * as matrixcs from 'matrix-js-sdk';

// Export everything from matrix-js-sdk
export * from 'matrix-js-sdk';

// Also export as a named export for convenience
export { matrixcs };

// Make it available globally as window.matrixcs
if (typeof window !== 'undefined') {
    window.matrixcs = matrixcs;
}

// Export default
export default matrixcs;
