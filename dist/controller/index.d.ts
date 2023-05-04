export = Controller;
declare class Controller extends ENIP {
    /**
     *
     * @param {boolean} [connectedMessaging=true] whether to use connected or unconnected messaging
     * @param {object} [opts]
     * @param {number} [opts.unconnectedSendTimeout=2000]
     */
    constructor(connectedMessaging?: boolean, opts?: {
        unconnectedSendTimeout?: number;
    });
    state: {
        controller: {
            name: any;
            serial_number: any;
            slot: any;
            time: any;
            path: any;
            version: any;
            status: any;
            run: boolean;
            program: boolean;
            faulted: boolean;
            minorRecoverableFault: boolean;
            minorUnrecoverableFault: boolean;
            majorRecoverableFault: boolean;
            majorUnrecoverableFault: boolean;
            io_faulted: boolean;
        };
        subs: TagGroup;
        scanning: boolean;
        scan_rate: number;
        connectedMessaging: boolean;
        timeout_sp: number;
        rpi: number;
        fwd_open_serial: number;
        unconnectedSendTimeout: number;
        tagList: TagList;
        TCP: {
            establishing: boolean;
            established: boolean;
        };
        session: {
            id: any;
            establishing: boolean;
            established: boolean;
        };
        connection: {
            id: any;
            establishing: boolean;
            established: boolean;
            seq_num: number;
        };
        error: {
            code: any;
            msg: any;
        };
    };
    workers: {
        read: Queue<any>;
        write: Queue<any>;
        group: Queue<any>;
    };
    /**
     * Sets the Subsciption Group Scan Rate
     *
     * @memberof Controller
     */
    set scan_rate(arg: number);
    /**
     * Returns the Scan Rate of Subscription Tags
     *
     * @memberof Controller
     * @returns {number} ms
     */
    get scan_rate(): number;
    /**
     * Sets the Timeout Setpoint
     *
     * @memberof Controller
     */
    set timeout_sp(arg: number);
    /**
     * Returns the Timeout Setpoint
     *
     * @memberof Controller
     * @returns {number} ms
     */
    get timeout_sp(): number;
    /**
     * Sets the Rpi
     *
     * @memberof Controller
     */
    set rpi(arg: number);
    /**
     * Returns the Rpi
     *
     * @memberof Controller
     * @returns {number} ms
     */
    get rpi(): number;
    /**
     * Get the status of Scan Group
     *
     * @readonly
     * @memberof Controller
     */
    get scanning(): boolean;
    /**
     * Sets the Mode to connected / unconnected messaging
     *
     * @memberof Controller
     */
    set connectedMessaging(arg: boolean);
    /**
     * Returns the connected / unconnected messaging mode
     *
     * @memberof Controller
     * @returns {boolean} true, if connected messaging; false, if unconnected messaging
     */
    get connectedMessaging(): boolean;
    /**
     * Gets the Controller Properties Object
     *
     * @readonly
     * @memberof Controller
     * @returns {object}
     */
    get properties(): any;
    /**
     * Fetches the last timestamp retrieved from the controller
     * in human readable form
     *
     * @readonly
     * @memberof Controller
     */
    get time(): any;

    override connect(IP_ADDR: string, SLOT?: number | undefined): Promise<any>;
    /**
     * Disconnects the PLC instance gracefully by issuing forwardClose, UnregisterSession
     * and then destroying the socket
     * and Returns a Promise indicating a success or failure or the disconnection
     *
     * @memberof Controller
     * @returns {Promise}
     */
    disconnect(): Promise<any>;
    /**
     * Writes a forwardOpen Request and retrieves the connection ID used for
     * connected messages.
     * @memberof Controller
     * @returns {Promise}
     */
    forwardOpen(): Promise<any>;
    /**
     * Writes a forwardClose Request and retrieves the connection ID used for
     * connected messages.
     */
    forwardClose(): Promise<any>;
    /**
     * Writes Ethernet/IP Data to Socket as an Unconnected Message
     * or a Transport Class 1 Datagram
     *
     * NOTE: Cant Override Socket Write due to net.Socket.write
     *        implementation. =[. Thus, I am spinning up a new Method to
     *        handle it. Dont Use Enip.write, use this function instead.
     *
     * @override
     * @param {buffer} data - Message Router Packet Buffer
     * @param {boolean} [connected=false]
     * @param {number} [timeout=10] - Timeout (sec)
     * @param {function} [cb=null] - Callback to be Passed to Parent.Write()
     * @memberof ENIP
     */
    override write_cip(data: Buffer, connected?: boolean, timeout?: number, cb?: Function): void;
    /**
     * Reads Controller Identity Object
     *
     * @memberof Controller
     * @returns {Promise}
     */
    readControllerProps(): Promise<any>;
    /**
     * Reads the Controller Wall Clock Object
     *
     * @memberof Controller
     * @returns {Promise}
     */
    readWallClock(): Promise<any>;
    /**
     * Write to PLC Wall Clock
     *
     * @param {Date} [date=new Date()]
     * @memberof Controller
     * @returns {Promise}
     */
    writeWallClock(date?: Date): Promise<any>;
    /**
     * Reads Value of Tag and Type from Controller
     *
     * @param {Tag} tag - Tag Object to Write
     * @param {number} [size=null]
     * @returns {Promise}
     * @memberof Controller
     */
    readTag(tag: Tag, size?: number): Promise<any>;
    /**
     * Writes value to Tag
     *
     * @param {Tag} tag - Tag Object to Write
     * @param {number|boolean|object|string} [value=null] - If Omitted, Tag.value will be used
     * @param {number} [size=0x01]
     * @returns {Promise}
     * @memberof Controller
     */
    writeTag(tag: Tag, value?: number | boolean | object | string, size?: number): Promise<any>;
    /**
     * Reads All Tags in the Passed Tag Group
     *
     * @param {TagGroup} group
     * @returns {Promise}
     * @memberof Controller
     */
    readTagGroup(group: TagGroup): Promise<any>;
    /**
     * Writes to Tag Group Tags
     *
     * @param {TAgGroup} group
     * @returns {Promise}
     * @memberof Controller
     */
    writeTagGroup(group: TagGroup): Promise<any>;
    /**
     * Adds Tag to Subscription Group
     *
     * @param {Tagany} tag
     * @memberof Controller
     */
    subscribe(tag: Tag): void;
    /**
     * Begin Scanning Subscription Group
     *
     * @memberof Controller
     */
    scan(): Promise<void>;
    /**
     * Pauses Scanning of Subscription Group
     *
     * @memberof Controller
     */
    pauseScan(): void;
    /**
     * Iterates of each tag in Subscription Group
     *
     * @param {function} callback
     * @memberof Controller
     */
    forEach(callback: Function): void;
    getControllerTagList(tagList: any, program?: any): Promise<any>;
    /**
     * Initialized Controller Specific Event Handlers
     *
     * @memberof Controller
     */
    _initializeControllerEventHandlers(): void;
    /**
     * Remove Controller Specific Event Handlers
     *
     * @memberof Controller
     */
    _removeControllerEventHandlers(): void;
    /**
     * Reads Value of Tag and Type from Controller
     *
     * @param {Tag} tag - Tag Object to Write
     * @param {number} [size=null]
     * @returns {Promise}
     * @memberof Controller
     */
    _readTag(tag: Tag, size?: number): Promise<any>;
    /**
     * Reads Data of Tag from Controller To Big To Fit In One Packet
     *
     * @param {Tag} tag - Tag Object to Write
     * @param {number} [size=null]
     * @returns {Promise}
     * @memberof Controller
     */
    _readTagFragmented(tag: Tag, size?: number): Promise<any>;
    /**
     * Writes value to Tag
     *
     * @param {Tag} tag - Tag Object to Write
     * @param {number|boolean|object|string} [value=null] - If Omitted, Tag.value will be used
     * @param {number} [size=0x01]
     * @returns {Promise}
     * @memberof Controller
     */
    _writeTag(tag: Tag, value?: number | boolean | object | string, size?: number): Promise<any>;
    /**
     * Writes value to Tag To Big To Fit In One Packet
     *
     * @param {Tag} tag - Tag Object to Write
     * @param {number|boolean|object|string} [value=null] - If Omitted, Tag.value will be used
     * @param {number} [size=0x01]
     * @returns {Promise}
     * @memberof Controller
     */
    _writeTagFragmented(tag: Tag, value?: number | boolean | object | string, size?: number): Promise<any>;
    /**
     * Reads All Tags in the Passed Tag Group
     *
     * @param {TagGroup} group
     * @returns {Promise}
     * @memberof Controller
     */
    _readTagGroup(group: TagGroup): Promise<any>;
    /**
     * Writes to Tag Group Tags
     *
     * @param {TagGroup} group
     * @returns {Promise}
     * @memberof Controller
     */
    _writeTagGroup(group: TagGroup): Promise<any>;
    /**
     * @typedef EncapsulationData
     * @type {Object}
     * @property {number} commandCode - Ecapsulation Command Code
     * @property {string} command - Encapsulation Command String Interpretation
     * @property {number} length - Length of Encapsulated Data
     * @property {number} session - Session ID
     * @property {number} statusCode - Status Code
     * @property {string} status - Status Code String Interpretation
     * @property {number} options - Options (Typically 0x00)
     * @property {Buffer} data - Encapsulated Data Buffer
     */
    /*****************************************************************/
    /**
     * @typedef MessageRouter
     * @type {Object}
     * @property {number} service - Reply Service Code
     * @property {number} generalStatusCode - General Status Code (Vol 1 - Appendix B)
     * @property {number} extendedStatusLength - Length of Extended Status (In 16-bit Words)
     * @property {Array} extendedStatus - Extended Status
     * @property {Buffer} data - Status Code
     */
    /*****************************************************************/
    /**
     * Handles SendRRData Event Emmitted by Parent and Routes
     * incoming Message
     *
     * @param {Array} srrd - Array of Common Packet Formatted Objects
     * @memberof Controller
     */
    _handleSendRRDataReceived(srrd: any[]): void;
    _handleSendUnitDataReceived(sud: any): void;
    get tagList(): any[];
    get templateList(): {};
    getTagArraySize(tag: any): Promise<any>;
    newTag(tagname: any, program?: any, subscribe?: boolean, arrayDims?: number, arraySize?: number): Tag;
    getTagByName(name: any): any;
}
import { ENIP } from "../enip";
import TagGroup = require("../tag-group");
import TagList = require("../tag-list");
import Queue = require("task-easy");
import Tag = require("../tag");
//# sourceMappingURL=index.d.ts.map