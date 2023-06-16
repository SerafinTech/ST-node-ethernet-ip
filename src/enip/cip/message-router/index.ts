const services = {
    GET_INSTANCE_ATTRIBUTE_LIST: 0x55,
    GET_ATTRIBUTES: 0x03,
    GET_ATTRIBUTE_ALL: 0x01,
    GET_ATTRIBUTE_SINGLE: 0x0e,
    GET_ENUM_STRING: 0x4b,
    RESET: 0x05,
    START: 0x06,
    STOP: 0x07,
    CREATE: 0x08,
    DELETE: 0x09,
    MULTIPLE_SERVICE_PACKET: 0x0a,
    APPLY_ATTRIBUTES: 0x0d,
    SET_ATTRIBUTE_SINGLE: 0x10,
    FIND_NEXT: 0x11,
    READ_TAG: 0x4c,
    WRITE_TAG: 0x4d,
    READ_TAG_FRAGMENTED: 0x52,
    WRITE_TAG_FRAGMENTED: 0x53,
    READ_MODIFY_WRITE_TAG: 0x4e,
    FORWARD_OPEN: 0x54,
    FORWARD_CLOSE: 0x4E,
    GET_FILE_DATA: 0x4f
};

/**
 * Builds a Message Router Request Buffer
 *
 * @param service - CIP Service Code
 * @param path - CIP Padded EPATH (Vol 1 - Appendix C)
 * @param data - Service Specific Data to be Sent
 * @returns Message Router Request Buffer
 */
const build = (service: number, path: Buffer, data: Buffer): Buffer => {
    const pathBuf = Buffer.from(path);
    const dataBuf = Buffer.from(data);

    const pathLen = Math.ceil(pathBuf.length / 2);
    const buf = Buffer.alloc(2 + pathLen * 2 + dataBuf.length);

    buf.writeUInt8(service, 0); // Write Service Code to Buffer <USINT>
    buf.writeUInt8(pathLen, 1); // Write Length of EPATH (16 bit word length)

    pathBuf.copy(buf, 2); // Write EPATH to Buffer
    dataBuf.copy(buf, 2 + pathLen * 2); // Write Service Data to Buffer

    return buf;
};

type MessageRouter = {
    service: number,
    generalStatusCode: number,
    extendedStatusLength: number,
    extendedStatus: [number],
    data: Buffer
}

/**
 * Parses a Message Router Request Buffer
 *
 * @param buf - Message Router Request Buffer
 * @returns Decoded Message Router Object
 */
const parse = (buf: Buffer): MessageRouter => {
    let MessageRouter = {
        service: buf.readUInt8(0),
        generalStatusCode: buf.readUInt8(2),
        extendedStatusLength: buf.readUInt8(3),
        extendedStatus: null,
        data: null
    };

    // Build Extended Status Array
    let arr = [];
    for (let i = 0; i < MessageRouter.extendedStatusLength; i++) {
        arr.push(buf.readUInt16LE(i * 2 + 4));
    }
    MessageRouter.extendedStatus = arr;

    // Get Starting Point of Message Router Data
    const dataStart = MessageRouter.extendedStatusLength * 2 + 4;

    // Initialize Message Router Data Buffer
    let data = Buffer.alloc(buf.length - dataStart);

    // Copy Data to Message Router Data Buffer
    buf.copy(data, 0, dataStart);
    MessageRouter.data = data;

    return MessageRouter;
};

export { build, parse, services };
