/**
 * Wraps a Promise with a Timeout
 *
 * @param {Tag} tag - Tag Object to Write
 * @param {number} - Timeout Length (ms)
 * @param {Error|string} - Error to Emit if Timeout Occurs
 * @returns {Promise}
 * @memberof Controller
 */
export function promiseTimeout(promise: any, ms: any, error?: Error): Promise<any>;
/**
 * Delays X ms
 *
 * @param {number} ms - Delay Length (ms)
 * @returns {Promise}
 */
export function delay(ms: number): Promise<any>;
export function stringToBuffer(str: any, len?: number): Buffer;
export function bufferToString(buff: any): string;
export function objToString(obj: any): string;
export function stringToObj(str: any, len?: number): {
    LEN: any;
    DATA: any[];
};
//# sourceMappingURL=index.d.ts.map