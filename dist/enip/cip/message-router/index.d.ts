export type MessageRouter = {
    /**
     * - Reply Service Code
     */
    service: number;
    /**
     * - General Status Code (Vol 1 - Appendix B)
     */
    generalStatusCode: number;
    /**
     * - Length of Extended Status (In 16-bit Words)
     */
    extendedStatusLength: number;
    /**
     * - Extended Status
     */
    extendedStatus: any[];
    /**
     * - Status Code
     */
    data: Buffer;
};
/**
 * Builds a Message Router Request Buffer
 *
 * @param {number} service - CIP Service Code
 * @param {Buffer} path - CIP Padded EPATH (Vol 1 - Appendix C)
 * @param {Buffer} data - Service Specific Data to be Sent
 * @returns {Buffer} Message Router Request Buffer
 */
export function build(service: number, path: Buffer, data: Buffer): Buffer;
/**
 * @typedef MessageRouter
 * @type {Object}
 * @property {number} service - Reply Service Code
 * @property {number} generalStatusCode - General Status Code (Vol 1 - Appendix B)
 * @property {number} extendedStatusLength - Length of Extended Status (In 16-bit Words)
 * @property {Array} extendedStatus - Extended Status
 * @property {Buffer} data - Status Code
 */
/**
 * Parses a Message Router Request Buffer
 *
 * @param {Buffer} buf - Message Router Request Buffer
 * @returns {MessageRouter} Decoded Message Router Object
 */
export function parse(buf: Buffer): MessageRouter;
export namespace services {
    const GET_INSTANCE_ATTRIBUTE_LIST: number;
    const GET_ATTRIBUTES: number;
    const GET_ATTRIBUTE_ALL: number;
    const GET_ATTRIBUTE_SINGLE: number;
    const RESET: number;
    const START: number;
    const STOP: number;
    const CREATE: number;
    const DELETE: number;
    const MULTIPLE_SERVICE_PACKET: number;
    const APPLY_ATTRIBUTES: number;
    const SET_ATTRIBUTE_SINGLE: number;
    const FIND_NEXT: number;
    const READ_TAG: number;
    const WRITE_TAG: number;
    const READ_TAG_FRAGMENTED: number;
    const WRITE_TAG_FRAGMENTED: number;
    const READ_MODIFY_WRITE_TAG: number;
    const FORWARD_OPEN: number;
    const FORWARD_CLOSE: number;
}
//# sourceMappingURL=index.d.ts.map