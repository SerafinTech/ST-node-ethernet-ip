export = Controller;
declare class Controller extends ENIP {
    constructor(connectedMessaging?: boolean);
    OTconnectionID: number;
    TOconnectionID: number;
    configInstance: {};
    outputInstance: {};
    inputInstance: {};
    tryingToConnect: boolean;
    state: {
        controller: {
            name: any;
            serial_number: any;
            slot: any;
            time: any;
            path: any;
            version: any;
            status: any;
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
    readonly get scanning(): boolean;
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
    readonly get properties(): any;
    /**
     * Fetches the last timestamp retrieved from the controller
     * in human readable form
     *
     * @readonly
     * @memberof Controller
     */
    readonly get time(): any;
    /**
     * Initializes Session with Desired IP Address
     * Sends forwardOpen to IO device to initialize Ethernet/ip class 1 communication
     *
     * @override
     * @param {string} IP_ADDR - IPv4 Address (can also accept a FQDN, provided port forwarding is configured correctly.)
     * @param {number} SLOT - Controller Slot Number (0 if CompactLogix)
     * @param {object} configInstance - configInstance parameters
     * @param {number} configInstance.assembly - config assembly instance value
     * @param {number} configInstance.size - config data size
     * @param {object} outputInstance - outputInstance parameters
     * @param {number} outputInstance.assembly - output assembly instance value
     * @param {number} outputInstance.size - output data size
     * @param {object} inputInstance - inputInstance parameters
     * @param {number} inputInstance.assembly - input assembly instance value
     * @param {number} inputInstance.size - config data size
     * @returns {Promise}
     * @memberof ENIP
     */
    override connect(IP_ADDR: string, SLOT: number, configInstance: {
        assembly: number;
        size: number;
    }, outputInstance: {
        assembly: number;
        size: number;
    }, inputInstance: {
        assembly: number;
        size: number;
    }): Promise<any>;
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
     * Generates path to IO assembly instances
     */
    _ioPath(): Buffer;
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
    override write_cip(data: buffer, timeout?: number, cb?: Function): void;
    /**
     * Reads Controller Identity Object
     *
     * @memberof Controller
     * @returns {Promise}
     */
    readControllerProps(): Promise<any>;
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
}
import { ENIP } from "../../enip";
import TagGroup = require("../../tag-group");
import Queue = require("task-easy");
//# sourceMappingURL=index.d.ts.map