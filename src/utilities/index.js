/**
 * Wraps a Promise with a Timeout
 *
 * @param {Tag} tag - Tag Object to Write
 * @param {number} - Timeout Length (ms)
 * @param {Error|string} - Error to Emit if Timeout Occurs
 * @returns {Promise}
 * @memberof Controller
 */
const promiseTimeout = (promise, ms, error = new Error("ASYNC Function Call Timed Out!!!")) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => reject(error), ms);
        promise.then(resolve).catch(reject);
    });
};

/**
 * Delays X ms
 *
 * @param {number} ms - Delay Length (ms)
 * @returns {Promise}
 */
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));


// Helper Funcs to process strings
const bufferToString = buff => {
    let newBuff = Buffer.from(buff)
    const len = newBuff.readUInt32LE();
    return newBuff.slice(4, len + 4).toString();
};

const stringToBuffer = (str, len = 88) => {
    const buf = Buffer.alloc(len);
    str = str.slice(0, len - 6);
    buf.writeUInt32LE(str.length);
    Buffer.from(str).copy(buf, 4);
    return buf;
};

const objToString = obj => {
    return String.fromCharCode(...obj.DATA.slice(0,obj.LEN));
};

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

module.exports = { promiseTimeout, delay, stringToBuffer, bufferToString, objToString, stringToObj };
