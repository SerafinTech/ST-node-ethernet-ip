const { EventEmitter } = require("events");
const crypto = require("crypto");
const { CIP } = require("../enip");
const { MessageRouter } = CIP;
const { READ_TAG, WRITE_TAG, READ_MODIFY_WRITE_TAG, READ_TAG_FRAGMENTED } = MessageRouter.services;
const { Types, getTypeCodeString, isValidTypeCode } = require("../enip/cip/data-types");
const dateFormat = require("dateformat");
const equals = require("deep-equal");

// Static Class Property - Tracks Instances
let instances = 0;
class Tag extends EventEmitter {
    constructor(tagname, program = null, datatype = null, keepAlive = 0, arrayDims = 0, arraySize = 0x01) {
        super();

        if (!Tag.isValidTagname(tagname)) throw new Error("Tagname Must be of Type <string>");
        if (!isValidTypeCode(datatype) && datatype !== null)
            throw new Error("Datatype must be a Valid Type Code <number>");
        if (typeof keepAlive !== "number")
            throw new Error(
                `Tag expected keepAlive of type <number> instead got type <${typeof keepAlive}>`
            );
        if (keepAlive < 0)
            throw new Error(`Tag expected keepAlive to be greater than 0, got ${keepAlive}`);

        // Increment Instances
        instances += 1;

        // Split by "." for memebers
        // Split by "[" or "]" for array indexes
        // Split by "," for array indexes with more than 1 dimension
        // Filter for length > 0 to remove empty elements (happens if tag ends with array index)
        let pathArr = tagname.split(/[.[\],]/).filter(segment => segment.length > 0);

        let bitIndex = null;

        // Check for bit index (tag ends in .int) - this only applies to SINT, INT, DINT or array elements of
        // Split by "." to only check udt members and bit index.
        let memArr = tagname.split(".");
        let isBitIndex = (memArr.length > 1) & (memArr[memArr.length - 1] % 1 === 0);

        // Check if BIT_STRING data type was passed in
        let isBitString = datatype === Types.BIT_STRING && pathArr[pathArr.length - 1] % 1 === 0;

        // Tag can not be both a bit index and BIT_STRING
        if (isBitString && isBitIndex)
            throw "Tag cannot be defined as a BIT_STRING and have a bit index";

        if (isBitString) {
            // BIT_STRING need to be converted to array with bit index
            // tag[x] converts to tag[(x-x%32)/32].x%32
            // e.g. tag[44] turns into tag[1].12
            bitIndex = parseInt(pathArr[pathArr.length - 1]) % 32;
            pathArr[pathArr.length - 1] = (
                (parseInt(pathArr[pathArr.length - 1]) - bitIndex) /
                32
            ).toString();
        } else {
            if (isBitIndex) {
                // normal bit index handling
                bitIndex = parseInt(pathArr.pop(-1));
                if ((bitIndex < 0) | (bitIndex > 31))
                    throw new Error(`Tag bit index must be between 0 and 31, received ${bitIndex}`);
            }
        }

        let bufArr = [];

        // Push Program Path to Buffer if Present
        if (program) bufArr.push(CIP.EPATH.segments.DATA.build(`Program:${program}`));

        // Build EPATH Buffer
        for (let path of pathArr) {
            bufArr.push(CIP.EPATH.segments.DATA.build(path));
        }

        const pathBuf = Buffer.concat(bufArr);

        //buffer for instance id
        let bitIndexBuf = Buffer.alloc(1);
        if (bitIndex === null) bitIndexBuf.writeInt8(32);
        else bitIndexBuf.writeInt8(bitIndex);

        let instanceBuf = Buffer.concat([pathBuf, bitIndexBuf]);

        this.state = {
            tag: {
                name: tagname,
                type: datatype,
                arrayDims: arrayDims,
                bitIndex: bitIndex,
                value: null,
                controllerValue: null,
                path: pathBuf,
                program: program,
                stage_write: false
            },
            read_size: arraySize,
            error: { code: null, status: null },
            timestamp: new Date(),
            instance: hash(instanceBuf),
            keepAlive: keepAlive
        };
    }

    // region Property Accessors
    /**
     * Returns the total number of Tag Instances
     * that have been Created
     *
     * @readonly
     * @static
     * @returns {number} instances
     * @memberof Tag
     */
    static get instances() {
        return instances;
    }

    /**
     * Returns the Tag Instance ID
     *
     * @readonly
     * @returns {string} Instance ID
     * @memberof Tag
     */
    get instance_id() {
        return this.state.instance;
    }

    /**
     * Gets Tagname
     *
     * @memberof Tag
     * @returns {string} tagname
     */
    get name() {
        const { program, name } = this.state.tag;

        if (program === null) {
            return name;
        } else {
            return `Program:${program}.${name}`;
        }
    }

    /**
     * Sets Tagname if Valid
     *
     * @memberof Tag
     * @property {string} New Tag Name
     */
    set name(name) {
        if (!Tag.isValidTagname(name)) throw new Error("Tagname Must be of Type <string>");
        this.state.tag.name = name;
    }

    /**
     * Gets Tag Datatype
     *
     * @memberof Tag
     * @returns {string} datatype
     */
    get type() {
        return getTypeCodeString(this.state.tag.type);
    }

    /**
     * Gets Tag Bit Index
     * - Returns null if no bit index has been assigned
     *
     * @memberof Tag
     * @returns {number} bitIndex
     */
    get bitIndex() {
        return this.state.tag.bitIndex;
    }

    /**
     * Sets Tag Datatype if Valid
     *
     * @memberof Tag
     * @property {number} Valid Datatype Code
     */
    set type(type) {
        if (!isValidTypeCode(type)) throw new Error("Datatype must be a Valid Type Code <number>");
        this.state.tag.type = type;
    }

    /**
     * Gets Tag Read Size
     *
     * @memberof Tag
     * @returns {number} read size
     */
    get read_size() {
        return this.state.read_size;
    }

    /**
     * Sets Tag Read Size
     *
     * @memberof Tag
     * @property {number} read size
     */
    set read_size(size) {
        if (typeof type !== "number")
            throw new Error("Read Size must be a Valid Type Code <number>");
        this.state.read_size = size;
    }

    /**
     * Gets Tag value
     * - Returns null if no value has been read
     *
     * @memberof Tag
     * @returns {number|string|boolean|object} value
     */
    get value() {
        if (Array.isArray(this.state.tag.value)) {
            let prevValue = [...this.state.tag.value]
            setTimeout(() => {
                if (!equals(prevValue, this.state.tag.value))
                    this.state.tag.stage_write = true;
            }, 0)
        }
        
        return this.state.tag.value;
    }

    /**
     * Sets Tag Value
     *
     * @memberof Tag
     * @property {number|string|boolean|object} new value
     */
    set value(newValue) {
        if (!equals(newValue, this.state.tag.value))
            this.state.tag.stage_write = true;
        
        this.state.tag.value = newValue;
    }

    /**
     * Sets Controller Tag Value and Emits Changed Event
     *
     * @memberof Tag
     * @property {number|string|boolean|object} new value
     */
    set controller_value(newValue) {
        if (!equals(newValue,this.state.tag.controllerValue)) {
            let lastValue = null
            lastValue = this.state.tag.controllerValue;
            this.state.tag.controllerValue = newValue;

            const { stage_write } = this.state.tag;
            if (!stage_write) this.state.tag.value = newValue;

            this.state.timestamp = new Date();

            if (lastValue !== null) this.emit("Changed", this, lastValue);
            else this.emit("Initialized", this);
        } else {
            if (this.state.keepAlive > 0) {
                const now = new Date();
                if (now - this.state.timestamp >= this.state.keepAlive * 1000) {
                    this.state.tag.controllerValue = newValue;

                    const { stage_write } = this.state.tag;
                    if (!stage_write) this.state.tag.value = newValue;
                    this.state.timestamp = now;

                    this.emit("KeepAlive", this);
                }
            }
        }
    }

    /**
     * Sets Controller Tag Value and Emits Changed Event
     *
     * @memberof Tag
     * @returns {number|string|boolean|object} new value
     */
    get controller_value() {
        return this.state.tag.controllerValue;
    }

    /**
     * Gets Timestamp in a Human Readable Format
     *
     * @readonly
     * @memberof Tag
     * @returns {string}
     */
    get timestamp() {
        return dateFormat(this.state.timestamp, "mm/dd/yyyy-HH:MM:ss.l");
    }

    /**
     * Gets Javascript Date Object of Timestamp
     *
     * @readonly
     * @memberof Tag
     * @returns {Date}
     */
    get timestamp_raw() {
        return this.state.timestamp;
    }

    /**
     * Gets Error
     *
     * @readonly
     * @memberof Tag
     * @returns {object|null} error
     */
    get error() {
        return this.state.error.code ? this.state.error : null;
    }

    /**
     * Returns a Padded EPATH of Tag
     *
     * @readonly
     * @returns {buffer} Padded EPATH
     * @memberof Tag
     */
    get path() {
        return this.state.tag.path;
    }

    /**
     * Returns a whether or not a write is staging
     *
     * @returns {boolean}
     * @memberof Tag
     */
    get write_ready() {
        return this.state.tag.stage_write;
    }
    // endregion

    // region Public Methods
    /**
     * Generates Read Tag Message
     *
     * @param {number} [size=null]
     * @returns {buffer} - Read Tag Message Service
     * @memberof Tag
     */
    generateReadMessageRequest(size = null) {
        if (size) this.state.read_size = size;

        const { tag } = this.state;

        // Build Message Router to Embed in UCMM
        let buf = Buffer.alloc(2);
        buf.writeUInt16LE(this.state.read_size, 0);

        // Build Current Message
        return MessageRouter.build(READ_TAG, tag.path, buf);
    }

    /**
     * Generates Fragmented Read Tag Message
     *
     * @param {number} [offset=0]
     * @param {number} [size=null]
     * @returns {buffer} - Read Tag Message Service
     * @memberof Tag
     */
    generateReadMessageRequestFrag(offset = 0, size = null) {
        if (size) this.state.read_size = size;

        const { tag } = this.state;

        // Build Message Router to Embed in UCMM
        let buf = Buffer.alloc(6);
        buf.writeUInt16LE(this.state.read_size, 0);
        buf.writeUInt32LE(offset, 2);

        // Build Current Message
        return MessageRouter.build(READ_TAG_FRAGMENTED, tag.path, buf);
    }

    /**
     *  Parses Good Read Request Messages
     *
     * @param {buffer} Data Returned from Successful Read Tag Request
     * @memberof Tag
     */
    parseReadMessageResponse(data) {
        // Set Type of Tag Read
        const type = data.readUInt16LE(0);
        this.state.tag.type = type;
        
        if (this.state.tag.bitIndex !== null) 
        {
            this.parseReadMessageResponseValueForBitIndex(data);
        } else if(type === Types.STRUCT) {
            this.controller_value = data.slice(4);
        } else {
            this.parseReadMessageResponseValueForAtomic(data);
        }
    }

    /**
     *  Parses Good Read Request Messages Using A Mask For A Specified Bit Index
     *
     * @param {buffer} Data Returned from Successful Read Tag Request
     * @memberof Tag
     */
    parseReadMessageResponseValueForBitIndex(data) {
        const { tag } = this.state;
        const { SINT, INT, DINT, BIT_STRING } = Types;

        // Read Tag Value
        /* eslint-disable indent */
        switch (this.state.tag.type) {
            case SINT:
                this.controller_value =
                    (data.readInt8(2) & (1 << tag.bitIndex)) == 0 ? false : true;
                break;
            case INT:
                this.controller_value =
                    (data.readInt16LE(2) & (1 << tag.bitIndex)) == 0 ? false : true;
                break;
            case DINT:
            case BIT_STRING:
                this.controller_value =
                    (data.readInt32LE(2) & (1 << tag.bitIndex)) == 0 ? false : true;
                break;
            default:
                throw new Error(
                    "Data Type other than SINT, INT, DINT, or BIT_STRING returned when a Bit Index was requested"
                );
        }
        /* eslint-enable indent */
    }

    /**
     *  Parses Good Read Request Messages For Atomic Data Types
     *
     * @param {buffer} Data Returned from Successful Read Tag Request
     * @memberof Tag
     */
    parseReadMessageResponseValueForAtomic(data) {
        const { SINT, INT, DINT, REAL, BOOL, LINT, BIT_STRING } = Types;

        const { read_size } = this.state;

        // Read Tag Value
        /* eslint-disable indent */
        switch (this.state.tag.type) {
            case SINT:
                if (data.length > 3) {
                    const array = [];
                    for (let i = 0; i < data.length - 2; i++) {
                        array.push(data.readInt8(i + 2));
                    }
                    this.controller_value = array;
                } else {
                    this.controller_value = data.readInt8(2);
                }
                break;
            case INT:
                if (data.length > 4) {
                    const array = [];
                    for (let i = 0; i < (data.length - 2) / 2; i++) {
                        array.push(data.readInt16LE(i * 2 + 2));
                    }
                    this.controller_value = array;
                } else {
                    this.controller_value = data.readInt16LE(2);
                }
                break;
            case DINT:
                if (data.length > 6) {
                    const array = [];
                    for (let i = 0; i < (data.length - 2) / 4; i++) {
                        array.push(data.readInt32LE(i * 4 + 2));
                    }
                    this.controller_value = array;
                } else {
                    this.controller_value = data.readInt32LE(2);
                }
                break;
            case REAL:
                if (data.length > 6) {
                    const array = [];
                    for (let i = 0; i < (data.length - 2) / 4; i++) {
                        array.push(data.readFloatLE(i * 4 + 2));
                    }
                    this.controller_value = array;
                } else {
                    this.controller_value = data.readFloatLE(2);
                }
                break;
            case BOOL:
                this.controller_value = !!data.readUInt8(2);
                break;
            case BIT_STRING:
                const array = [];
                for (let b = 0; b < read_size; b++) {
                    for (let i = 0; i < 32; i++) {
                        array.push(!!(data.readUInt32LE(b * 4 + 2) >> i & 0x01));
                    }
                }
                this.controller_value = array;
                break;
            case LINT:
                if(typeof data.writeBigInt64LE !== "function") {
                    throw new Error("This version of Node.js does not support big integers. Upgrade to >= 12.0.0");
                }
                if (data.length > 10) {
                    const array = [];
                    for (let i = 0; i < (data.length - 2) / 8; i++) {
                        array.push(data.readBigInt64LE(i * 8 + 2));
                    }
                    this.controller_value = array;
                } else {
                    this.controller_value = data.readBigInt64LE(2);
                }
                break;
            default:
                throw new Error(
                    `Unrecognized Type Passed Read from Controller: ${this.state.tag.type}`
                );
        }
        /* eslint-enable indent */
    }

    /**
     * Generates Write Tag Message
     *
     * @param {number|boolean|object|string} [newValue=null] - If Omitted, Tag.value will be used
     * @param {number} [size=0x01]
     * @returns {buffer} - Write Tag Message Service
     * @memberof Tag
     */
    generateWriteMessageRequest(value = null, size = 0x01) {
        if (value !== null) this.state.tag.value = value;

        const { tag } = this.state;

        if (tag.type === null)
            throw new Error(
                `Tag ${
                    tag.name
                } has not been initialized. Try reading the tag from the controller first or manually providing a valid CIP datatype.`
            );

        if (tag.bitIndex !== null) return this.generateWriteMessageRequestForBitIndex(tag.value);
        else return this.generateWriteMessageRequestForAtomic(tag.value, size);
    }

    /**
     * Generates Write Tag Message For A Bit Index
     *
     * @param {number|boolean|object|string} value
     * @param {number} size
     * @returns {buffer} - Write Tag Message Service
     * @memberof Tag
     */
    generateWriteMessageRequestForBitIndex(value) {
        const { tag } = this.state;
        const { SINT, INT, DINT, BIT_STRING } = Types;

        // Build Message Router to Embed in UCMM
        let buf = null;

        /* eslint-disable indent */
        switch (tag.type) {
            case SINT:
                buf = Buffer.alloc(4);
                buf.writeInt16LE(1); //mask length
                buf.writeUInt8(value ? 1 << tag.bitIndex : 0, 2); // or mask
                buf.writeUInt8(value ? 255 : 255 & ~(1 << tag.bitIndex), 3); // and mask
                break;
            case INT:
                buf = Buffer.alloc(6);
                buf.writeInt16LE(2); //mask length
                buf.writeUInt16LE(value ? 1 << tag.bitIndex : 0, 2); // or mask
                buf.writeUInt16LE(value ? 65535 : 65535 & ~(1 << tag.bitIndex), 4); // and mask
                break;
            case DINT:
            case BIT_STRING:
                buf = Buffer.alloc(10);
                buf.writeInt16LE(4); //mask length
                buf.writeInt32LE(value ? 1 << tag.bitIndex : 0, 2); // or mask
                buf.writeInt32LE(value ? -1 : -1 & ~(1 << tag.bitIndex), 6); // and mask
                break;
            default:
                throw new Error(
                    "Bit Indexes can only be used on SINT, INT, DINT, or BIT_STRING data types."
                );
        }

        // Build Current Message
        return MessageRouter.build(READ_MODIFY_WRITE_TAG, tag.path, buf);
    }

    /**
     * Generates Write Tag Message For Atomic Types
     *
     * @param {number|boolean|object|string} value
     * @param {number} size
     * @returns {buffer} - Write Tag Message Service
     * @memberof Tag
     */
    generateWriteMessageRequestForAtomic(value, size) {
        const { tag } = this.state;
        const { SINT, INT, DINT, REAL, BOOL, LINT } = Types;
        // Build Message Router to Embed in UCMM
        let buf = Buffer.alloc(4);
        let valBuf = null;

        buf.writeUInt16LE(tag.type, 0);

        if (Array.isArray(value)) {
            buf.writeUInt16LE(value.length, 2);
        } else {
            buf.writeUInt16LE(size, 2);
        }

        /* eslint-disable indent */
        switch (tag.type) {
            case SINT:
                if (Array.isArray(value)) {
                    valBuf = Buffer.alloc(value.length);
                    for (var i = 0; i < value.length; i++) {
                        valBuf.writeUInt8(value[i], i);
                    }
                } else {
                    valBuf = Buffer.alloc(1);
                    valBuf.writeInt8(tag.value);                    
                }
                buf = Buffer.concat([buf, valBuf]);
                break;
            case INT:
                if (Array.isArray(value)) {
                    valBuf = Buffer.alloc(2 * value.length);
                    for (var i = 0; i < value.length; i++) {
                        valBuf.writeInt16LE(value[i], i * 2);
                    }
                } else {
                    valBuf = Buffer.alloc(2);
                    valBuf.writeInt16LE(tag.value);                    
                }
                buf = Buffer.concat([buf, valBuf]);
                break;
            case DINT:
                if (Array.isArray(value)) {
                    valBuf = Buffer.alloc(4 * value.length);
                    for (var i = 0; i < value.length; i++) {
                        valBuf.writeUInt32LE(value[i], i * 4);
                    }
                } else {
                    valBuf = Buffer.alloc(4);
                    valBuf.writeInt32LE(tag.value);                    
                }
                buf = Buffer.concat([buf, valBuf]);               
                break;
            case REAL:
                if (Array.isArray(value)) {
                    valBuf = Buffer.alloc(4 * value.length);
                    for (var i = 0; i < value.length; i++) {
                        valBuf.writeFloatLE(value[i], i * 4);
                    }
                } else {
                    valBuf = Buffer.alloc(4);
                    valBuf.writeFloatLE(tag.value);                    
                }
                buf = Buffer.concat([buf, valBuf]);
                break;
            case BOOL:
                valBuf = Buffer.alloc(1);
                if (!tag.value) valBuf.writeInt8(0x00);
                else valBuf.writeInt8(0x01);

                buf = Buffer.concat([buf, valBuf]);
                break;
            case LINT:
                valBuf = Buffer.alloc(8);
                if(typeof valBuf.writeBigInt64LE !== "function") {
                    throw new Error("This version of Node.js does not support big integers. Upgrade to >= 12.0.0");
                }
                if (Array.isArray(value)) {
                    valBuf = Buffer.alloc(8 * value.length);
                    for (var i = 0; i < value.length; i++) {
                        valBuf.writeBigInt64LE(value[i], i * 8);
                    }
                } else {
                    valBuf = Buffer.alloc(8);
                    valBuf.writeBigInt64LE(tag.value);                    
                }
                buf = Buffer.concat([buf, valBuf]);
                break;
            default:
                throw new Error(`Unrecognized Type to Write to Controller: ${tag.type}`);
        }

        // Build Current Message
        return MessageRouter.build(WRITE_TAG, tag.path, buf);
    }

    /**
     * Unstages Value Edit by Updating controllerValue
     * after the Successful Completion of 
     * a Tag Write
     *
     * @memberof Tag
     */
    unstageWriteRequest() {
        const { tag } = this.state;
        tag.stage_write = false;
        tag.controllerValue = tag.value;
    }
    // endregion

    /**
     * Determines if a Tagname is Valid
     *
     * @static
     * @param {string} tagname
     * @returns {boolean}
     * @memberof Tag
     */
    static isValidTagname(tagname) {
        if (typeof tagname !== "string") return false;

        // regex components
        const nameRegex = captureIndex => {
            return `(_?[a-zA-Z]|_\\d)(?:(?=(_?[a-zA-Z0-9]))\\${captureIndex})*`;
        };
        const multDimArrayRegex = "(\\[\\d+(,\\d+){0,2}])";
        const arrayRegex = "(\\[\\d+])";
        const bitIndexRegex = "(\\.\\d{1,2})";

        // user regex for user tags
        const userRegex = new RegExp(
            "^(Program:" +
            nameRegex(3) +
            "\\.)?" + // optional program name
            nameRegex(5) +
            multDimArrayRegex +
            "?" + // tag name
            "(\\." +
            nameRegex(10) +
            arrayRegex +
            "?)*" + // option member name
                bitIndexRegex +
                "?$"
        ); // optional bit index
        // full user regex
        // ^(Program:(_?[a-zA-Z]|_\d)(?:(?=(_?[a-zA-Z0-9]))\3)*\.)?(_?[a-zA-Z]|_\d)(?:(?=(_?[a-zA-Z0-9]))\5)*(\[\d+(,\d+){0,2}])?(\.(_?[a-zA-Z]|_\d)(?:(?=(_?[a-zA-Z0-9]))\10)*(\[\d+])?)*(\.\d{1,2})?$

        // module regex for module tags
        const moduleRegex = new RegExp(
            "^" +
            nameRegex(2) + // module name
            "(:\\d{1,2})?" + // optional slot num (not required for rack optimized connections)
            ":[IOC]" + // input/output/config
            "(\\." +
            nameRegex(6) +
            arrayRegex +
            "?)?" + // optional member with optional array index
                bitIndexRegex +
                "?$"
        ); // optional bit index
        // full module regex
        // ^(_?[a-zA-Z]|_\d)(?:(?=(_?[a-zA-Z0-9]))\2)*(:\d{1,2})?:[IOC](\.(_?[a-zA-Z]|_\d)(?:(?=(_?[a-zA-Z0-9]))\6)*(\[\d+])?)?(\.\d{1,2})?$

        if (!userRegex.test(tagname) && !moduleRegex.test(tagname)) return false;

        // check segments
        if (tagname.split(/[:.[\],]/).filter(segment => segment.length > 40).length > 0)
            return false; // check that all segments are <= 40 char

        // passed all tests
        return true;
    }
}

/**
 * Generates Unique ID for Each Instance
 * based on the Generated EPATH
 *
 * @param {buffer} input - EPATH of Tag
 * @returns {string} hash
 */
const hash = input => {
    return crypto
        .createHash("md5")
        .update(input)
        .digest("hex");
};

module.exports = Tag;
