/**
 * Wraps a Promise with a Timeout
 *
 * @param promise - Promise to add timeout to
 * @param ms - Timeout Length (ms)
 * @param error - Error to Emit if Timeout Occurs
 * @returns promise that rejects if not completed by timeout length
 */
const promiseTimeout = (promise: Promise<any>, ms: number, error: Error | string = new Error("ASYNC Function Call Timed Out!!!")): Promise<any> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => reject(error), ms);
        promise.then(resolve).catch(reject);
    });
};

/**
 * Delays X ms
 *
 * @param ms - Delay Length (ms)
 * @returns Promise resolved after delay length
 */
const delay = (ms: number):Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

 /**
  * Helper Funcs to process strings
  * 
  * @param buff - Buffer with encoded string length
  * @returns String
  */
const bufferToString = (buff: Buffer): string => {
    let newBuff = Buffer.from(buff);
    const len = newBuff.readUInt32LE();
    return newBuff.subarray(4, len + 4).toString();
};

/**
 * Helper Funcs to process strings
 * 
 * @param str - Text string
 * @param len - Buffer Length to be encode string on to
 * @returns Buffer
 */
const stringToBuffer = (str: string, len: number = 88) => {
    const buf = Buffer.alloc(len);
    str = str.slice(0, len - 6);
    buf.writeUInt32LE(str.length);
    Buffer.from(str).copy(buf, 4);
    return buf;
};

type structureString = {
    DATA: Buffer,
    LEN: number
}
/**
 * Convert string stucture object to string
 * 
 * @param obj - string structure object
 * @returns 
 */
const objToString = (obj: structureString): string => {
    return String.fromCharCode(...obj.DATA.subarray(0,obj.LEN));
};

/**
 * Convert string to string structure object
 * 
 * @param str - String to encode
 * @param len - Buffer length
 * @returns 
 */
const stringToObj = (str, len = 82) => {
    const array = Array(len).fill(0);
    [...str].forEach( (c, k) => {
        array[k] = c.charCodeAt();
    });

    return {
        LEN: str.length,
        DATA: array
    };
};

export { promiseTimeout, delay, stringToBuffer, bufferToString, objToString, stringToObj };
