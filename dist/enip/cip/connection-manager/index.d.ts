export type UCMMSendTimeout = {
    time_ticks: number;
    ticks: number;
};
/**
 * Builds the data portion of a forwardOpen packet
 *
 * @param {number} [timeOutMs=500] - How many ticks until a timeout is thrown
 * @param {number} [timeOutMult=32] - A multiplier used for the Timeout
 * @param {number} [otRPI=8000] - O->T Request packet interval in milliseconds.
 * @param {number} [serialOrig=0x1337] - Originator Serial Number (SerNo of the PLC)
 * @returns {Buffer} data portion of the forwardOpen packet
 */
export function build_forwardOpen(otRPI?: number, netConnParams?: number, timeOutMs?: number, timeOutMult?: number, connectionSerial?: number): Buffer;
/**
 * Builds the data portion of a forwardClose packet
 *
 * @param {number} [timeOutMs=501] - How many ms until a timeout is thrown
 * @param {number} [vendorOrig=0x3333] - Originator vendorID (Vendor of the PLC)
 * @param {number} [serialOrig=0x1337] - Originator Serial Number (SerNo of the PLC)
 * @returns {Buffer} data portion of the forwardClose packet
 */
export function build_forwardClose(timeOutMs?: number, vendorOrig?: number, serialOrig?: number, connectionSerial?: number): Buffer;
/**
 * Build for Object specific connection parameters (Vol.1 - Table 3-5.8)
 */
export function build_connectionParameters(owner: any, type: any, priority: any, fixedVar: any, size: any): number;
export const connSerial: 4919;
/**
 * lookup table for Time Tick Value (Vol.1 - Table 3-5.11)
 */
export const timePerTick: {
    1: number;
};
/**
 * lookup table for Timeout multiplier (Vol.1 - 3-5.4.1.4)
 */
export const timeOutMultiplier: {
    4: number;
    8: number;
    16: number;
    32: number;
    64: number;
    128: number;
    256: number;
    512: number;
};
export namespace priority {
    const Low: number;
    const High: number;
    const Scheduled: number;
    const Urgent: number;
}
export namespace owner {
    const Exclusive: number;
    const Multiple: number;
}
export namespace connectionType {
    const Null: number;
    const Multicast: number;
    const PointToPoint: number;
    const Reserved: number;
}
export namespace fixedVar {
    const Fixed: number;
    const Variable: number;
}
//# sourceMappingURL=index.d.ts.map