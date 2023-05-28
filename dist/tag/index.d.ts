export = Tag;
declare class Tag extends EventEmitter {
    /**
     * Returns the total number of Tag Instances
     * that have been Created
     *
     * @readonly
     * @static
     * @returns {number} instances
     * @memberof Tag
     */
    static get instances(): number;
    /**
     * Determines if a Tagname is Valid
     *
     * @static
     * @param {string} tagname
     * @returns {boolean}
     * @memberof Tag
     */
    static isValidTagname(tagname: string): boolean;
    constructor(tagname: any, program?: any, datatype?: any, keepAlive?: number, arrayDims?: number, arraySize?: number);
    state: {
        tag: {
            name: any;
            type: any;
            arrayDims: number;
            bitIndex: number;
            value: any;
            controllerValue: any;
            path: Buffer;
            program: any;
            stage_write: boolean;
        };
        read_size: number;
        error: {
            code: any;
            status: any;
        };
        timestamp: Date;
        instance: string;
        keepAlive: number;
    };
    /**
     * Returns the Tag Instance ID
     *
     * @readonly
     * @returns {string} Instance ID
     * @memberof Tag
     */
    get instance_id(): string;
    /**
     * Sets Tagname if Valid
     *
     * @memberof Tag
     * @property {string} New Tag Name
     */
    set name(arg: string);
    /**
     * Gets Tagname
     *
     * @memberof Tag
     * @returns {string} tagname
     */
    get name(): string;
    /**
     * Sets Tag Datatype if Valid
     *
     * @memberof Tag
     * @property {number} Valid Datatype Code
     */
    set type(arg: string);
    /**
     * Gets Tag Datatype
     *
     * @memberof Tag
     * @returns {string} datatype
     */
    get type(): string;
    /**
     * Gets Tag Bit Index
     * - Returns null if no bit index has been assigned
     *
     * @memberof Tag
     * @returns {number} bitIndex
     */
    get bitIndex(): number;
    /**
     * Sets Tag Read Size
     *
     * @memberof Tag
     * @property {number} read size
     */
    set read_size(arg: number);
    /**
     * Gets Tag Read Size
     *
     * @memberof Tag
     * @returns {number} read size
     */
    get read_size(): number;
    /**
     * Sets Tag Value
     *
     * @memberof Tag
     * @property {number|string|boolean|object} new value
     */
    set value(arg: any);
    /**
     * Gets Tag value
     * - Returns null if no value has been read
     *
     * @memberof Tag
     * @returns {number|string|boolean|object} value
     */
    get value(): any;
    /**
     * Sets Controller Tag Value and Emits Changed Event
     *
     * @memberof Tag
     * @property {number|string|boolean|object} new value
     */
    set controller_value(arg: any);
    /**
     * Sets Controller Tag Value and Emits Changed Event
     *
     * @memberof Tag
     * @returns {number|string|boolean|object} new value
     */
    get controller_value(): any;
    /**
     * Gets Timestamp in a Human Readable Format
     *
     * @readonly
     * @memberof Tag
     * @returns {string}
     */
    get timestamp(): string;
    /**
     * Gets Javascript Date Object of Timestamp
     *
     * @readonly
     * @memberof Tag
     * @returns {Date}
     */
    get timestamp_raw(): Date;
    /**
     * Gets Error
     *
     * @readonly
     * @memberof Tag
     * @returns {object|null} error
     */
    get error(): any;
    /**
     * Returns a Padded EPATH of Tag
     *
     * @readonly
     * @returns {buffer} Padded EPATH
     * @memberof Tag
     */
    get path(): Buffer;
    /**
     * Returns a whether or not a write is staging
     *
     * @returns {boolean}
     * @memberof Tag
     */
    get write_ready(): boolean;
    /**
     * Generates Read Tag Message
     *
     * @param {number} [size=null]
     * @returns {buffer} - Read Tag Message Service
     * @memberof Tag
     */
    generateReadMessageRequest(size?: number): Buffer;
    /**
     * Generates Fragmented Read Tag Message
     *
     * @param {number} [offset=0]
     * @param {number} [size=null]
     * @returns {buffer} - Read Tag Message Service
     * @memberof Tag
     */
    generateReadMessageRequestFrag(offset?: number, size?: number): Buffer;
    /**
     *  Parses Good Read Request Messages
     *
     * @param {buffer} Data Returned from Successful Read Tag Request
     * @memberof Tag
     */
    parseReadMessageResponse(data: any): void;
    /**
     *  Parses Good Read Request Messages Using A Mask For A Specified Bit Index
     *
     * @param {buffer} Data Returned from Successful Read Tag Request
     * @memberof Tag
     */
    parseReadMessageResponseValueForBitIndex(data: any): void;
    /**
     *  Parses Good Read Request Messages For Atomic Data Types
     *
     * @param {buffer} Data Returned from Successful Read Tag Request
     * @memberof Tag
     */
    parseReadMessageResponseValueForAtomic(data: any): void;
    /**
     * Generates Write Tag Message
     *
     * @param {number|boolean|object|string} [newValue=null] - If Omitted, Tag.value will be used
     * @param {number} [size=0x01]
     * @returns {buffer} - Write Tag Message Service
     * @memberof Tag
     */
    generateWriteMessageRequest(value?: any, size?: number): Buffer;
    /**
     * Generates Write Tag Message For A Bit Index
     *
     * @param {number|boolean|object|string} value
     * @param {number} size
     * @returns {buffer} - Write Tag Message Service
     * @memberof Tag
     */
    generateWriteMessageRequestForBitIndex(value: number | boolean | object | string): Buffer;
    /**
     * Generates Write Tag Message For Atomic Types
     *
     * @param {number|boolean|object|string} value
     * @param {number} size
     * @returns {buffer} - Write Tag Message Service
     * @memberof Tag
     */
    generateWriteMessageRequestForAtomic(value: number | boolean | object | string, size: number): Buffer;
    /**
     * Unstages Value Edit by Updating controllerValue
     * after the Successful Completion of
     * a Tag Write
     *
     * @memberof Tag
     */
    unstageWriteRequest(): void;
    override on(eventName: "Changed" | "Initialized" | "KeepAlive" | "New Device", listener: (...args: any[]) => void): this;
}
import { EventEmitter } from "events";
//# sourceMappingURL=index.d.ts.map