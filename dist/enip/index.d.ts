/// <reference types="node" />
/**
 * Low Level Ethernet/IP
 *
 * @class ENIP
 * @extends {Socket}
 * @fires ENIP#Session Registration Failed
 * @fires ENIP#Session Registered
 * @fires ENIP#Session Unregistered
 * @fires ENIP#SendRRData Received
 * @fires ENIP#SendUnitData Received
 * @fires ENIP#Unhandled Encapsulated Command Received
 */
export class ENIP extends Socket {
    constructor();
    state: {
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
    /**
     * Returns an Object
     *  - <number> error code
     *  - <string> human readable error
     *
     * @readonly
     * @memberof ENIP
     */
    get error(): {
        code: any;
        msg: any;
    };
    /**
     * Session Establishment In Progress
     *
     * @readonly
     * @memberof ENIP
     */
    get establishing(): boolean;
    /**
     * Session Established Successfully
     *
     * @readonly
     * @memberof ENIP
     */
    get established(): boolean;
    /**
     * Get ENIP Session ID
     *
     * @readonly
     * @memberof ENIP
     */
    get session_id(): any;
    /**
     * Various setters for Connection parameters
     *
     * @memberof ENIP
     */
    set establishing_conn(arg: boolean);
    /**
     * Various getters for Connection parameters
     *
     * @memberof ENIP
     */
    get establishing_conn(): boolean;
    set established_conn(arg: boolean);
    get established_conn(): boolean;
    set id_conn(arg: any);
    get id_conn(): any;
    set seq_conn(arg: number);
    get seq_conn(): number;
    /**
     * Initializes Session with Desired IP Address or FQDN
     * and Returns a Promise with the Established Session ID
     *
     * @override
     * @param {string} IP_ADDR - IPv4 Address (can also accept a FQDN, provided port forwarding is configured correctly.)
     * @returns {Promise}
     * @memberof ENIP
     */

    // @ts-ignore: overload incompatible
    override connect(IP_ADDR: string, timeoutSP?: number): Promise<any>;
    /**
     * Writes Ethernet/IP Data to Socket as an Unconnected Message
     * or a Transport Class 1 Datagram
     *
     * NOTE: Cant Override Socket Write due to net.Socket.write
     *        implementation. =[. Thus, I am spinning up a new Method to
     *        handle it. Dont Use Enip.write, use this function instead.
     *
     * @param {buffer} data - Data Buffer to be Encapsulated
     * @param {boolean} [connected=false]
     * @param {number} [timeout=10] - Timeout (sec)
     * @param {function} [cb=null] - Callback to be Passed to Parent.Write()
     * @memberof ENIP
     */
    write_cip(data: Buffer, connected?: boolean, timeout?: number, cb?: Function): void;
    /**
     * Sends Unregister Session Command and Destroys Underlying TCP Socket
     *
     * @override
     * @param {Exception} exception - Gets passed to 'error' event handler
     * @memberof ENIP
     */
    override destroy(exception: Error): this;
    _initializeEventHandlers(): void;
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
     * Socket.on('data) Event Handler
     *
     * @param {Buffer} - Data Received from Socket.on('data', ...)
     * @memberof ENIP
     */
    _handleDataEvent(data: any): void;
    /**
     * Socket.on('close',...) Event Handler
     *
     * @param {Boolean} hadError
     * @memberof ENIP
     */
    _handleCloseEvent(hadError: boolean): void;
}
import CIP = require("./cip");
import encapsulation = require("./encapsulation");
import { Socket } from "net";
export { CIP, encapsulation };
//# sourceMappingURL=index.d.ts.map