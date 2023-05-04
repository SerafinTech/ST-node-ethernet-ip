export type UCMMSendTimeout = {
    time_ticks: number;
    ticks: number;
};
/**
 * @typedef UCMMSendTimeout
 * @type {Object}
 * @property {number} time_ticks
 * @property {number} ticks
 */
/**
 * Gets the Best Available Timeout Values
 *
 * @param {number} timeout - Desired Timeout in ms
 * @returns {UCMMSendTimeout}
 */
export function generateEncodedTimeout(timeout: number): UCMMSendTimeout;
/**
 * Builds an Unconnected Send Packet Buffer
 *
 * @param {buffer} message_request - Message Request Encoded Buffer
 * @param {buffer} path - Padded EPATH Buffer
 * @param {number} [timeout=2000] - timeout
 * @returns {buffer}
 */
export function build(message_request: Buffer, path: Buffer, timeout?: number): Buffer;
//# sourceMappingURL=index.d.ts.map