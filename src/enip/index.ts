import { Socket, isIPv4 } from 'net';
import { EIP_PORT } from '../config';
import * as encapsulation from './encapsulation';
import * as CIP from './cip';
const { promiseTimeout } = require("../utilities");
import { lookup } from 'dns';

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
type enipTCP = {
    establishing: boolean;
    established: boolean;
}

type enipSession = {
    id: number,
    establishing: boolean,
    established: boolean,
}

type enipConnection = {
    id: number,
    establishing: boolean,
    established: boolean,
    seq_num: number
}

type enipError = {code: number, msg: string}

class ENIP extends Socket {
    state: {
        TCP: enipTCP,
        session: enipSession,
        connection: enipConnection,
        error: enipError
    }

    constructor() {
        super();

        this.state = {
            TCP: { establishing: false, established: false },
            session: { id: null, establishing: false, established: false },
            connection: { id: null, establishing: false, established: false, seq_num: 0 },
            error: { code: null, msg: null }
        };

        // Initialize Event Handlers for Underlying Socket Class
        this._initializeEventHandlers();
    }

    // region Property Accessors
    /**
     * Returns an Object
     *  - <number> error code
     *  - <string> human readable error
     *
     * @readonly
     * @memberof ENIP
     */
    get error() {
        return this.state.error;
    }

    /**
     * Session Establishment In Progress
     *
     * @readonly
     * @memberof ENIP
     */
    get establishing() {
        return this.state.session.establishing;
    }
    /**
     * Session Established Successfully
     *
     * @readonly
     * @memberof ENIP
     */
    get established() {
        return this.state.session.established;
    }

    /**
     * Get ENIP Session ID
     *
     * @readonly
     * @memberof ENIP
     */
    get session_id() {
        return this.state.session.id;
    }

    /**
     * Various setters for Connection parameters
     *
     * @memberof ENIP
     */
    set establishing_conn(newEstablish) {
        if (typeof(newEstablish) !== "boolean") {
            throw new Error("Wrong type passed when setting connection: establishing parameter");
        }
        this.state.connection.establishing = newEstablish;
    }

    set established_conn(newEstablished) {
        if (typeof(newEstablished) !== "boolean") {
            throw new Error("Wrong type passed when setting connection: established parameter");
        }
        this.state.connection.established = newEstablished;
    }

    set id_conn(newID) {
        if (typeof(newID) !== "number") {
            throw new Error("Wrong type passed when setting connection: id parameter");
        }
        this.state.connection.id = newID;
    }

    set seq_conn(newSeq) {
        if (typeof(newSeq) !== "number") {
            throw new Error("Wrong type passed when setting connection: seq_numparameter");
        }
        this.state.connection.seq_num = newSeq;
    }

    /**
     * Various getters for Connection parameters
     *
     * @memberof ENIP
     */
    get establishing_conn() {
        return this.state.connection.establishing;
    }

    get established_conn() {
        return this.state.connection.established;
    }

    get id_conn() {
        return this.state.connection.id;
    }

    get seq_conn() {
        return this.state.connection.seq_num;
    }
    // endregion

    // region Public Method Definitions
    connect(port: unknown, host?: unknown, connectionListener?: unknown): any
    /**
     * Initializes Session with Desired IP Address or FQDN
     * and Returns a Promise with the Established Session ID
     *
     * @override
     * @param IP_ADDR - IPv4 Address (can also accept a FQDN, provided port forwarding is configured correctly.)
     * @returns Session Id
     */
    async connect(IP_ADDR: string, timeoutSP: number = 10000): Promise<number> {
        if (!IP_ADDR) {
            throw new Error("Controller <class> requires IP_ADDR <string>!!!");
        }
        await new Promise<void>((resolve, reject) => {
            lookup(IP_ADDR, (err, addr) => {
                if (err) reject(new Error("DNS Lookup failed for IP_ADDR " + IP_ADDR));

                if (!isIPv4(addr)) {
                    reject(new Error("Invalid IP_ADDR <string> passed to Controller <class>"));
                }
                resolve();
            });
        });

        const { registerSession } = encapsulation;

        this.state.session.establishing = true;
        this.state.TCP.establishing = true;

        const connectErr = new Error(
            "TIMEOUT occurred while attempting to establish TCP connection with Controller."
        );

        // Connect to Controller and Then Send Register Session Packet
        await promiseTimeout(
            new Promise<void>((resolve, reject)=> {
                let socket = super.connect(
                    EIP_PORT,
                    IP_ADDR,
                    () => {
                        this.state.TCP.establishing = false;
                        this.state.TCP.established = true;

                        this.write(registerSession());
                        resolve();
                    }
                );

                socket.on("error", () => {
                    reject(new Error("SOCKET error"));
                });
            }),
            timeoutSP,
            connectErr
        );

        const sessionErr = new Error(
            "TIMEOUT occurred while attempting to establish Ethernet/IP session with Controller."
        );

        // Wait for Session to be Registered
        const sessid = await promiseTimeout(
            new Promise(resolve => {
                this.on("Session Registered", sessid => {
                    resolve(sessid);
                });

                this.on("Session Registration Failed", error => {
                    this.state.error.code = error;
                    this.state.error.msg = "Failed to Register Session";
                    resolve(null);
                });
            }),
            timeoutSP,
            sessionErr
        );

        // Clean Up Local Listeners
        this.removeAllListeners("Session Registered");
        this.removeAllListeners("Session Registration Failed");

        // Return Session ID
        return sessid;
    }

    /**
     * Writes Ethernet/IP Data to Socket as an Unconnected Message
     * or a Transport Class 1 Datagram
     *
     * NOTE: Cant Override Socket Write due to net.Socket.write
     *        implementation. =[. Thus, I am spinning up a new Method to
     *        handle it. Dont Use Enip.write, use this function instead.
     *
     * @param data - Data Buffer to be Encapsulated
     * @param connected - Connected communication
     * @param timeout - Timeout (sec)
     * @param cb - Callback to be Passed to Parent.Write()
     */
    write_cip(data: Buffer, connected: boolean = false, timeout: number = 10, cb: () => void = null) {
        const { sendRRData, sendUnitData } = encapsulation;
        const { session, connection } = this.state;

        if (session.established) {
            if(connected === true) {
                if (connection.established === true) {
                    connection.seq_num += 1;
                    if (connection.seq_num > 0xffff) connection.seq_num = 0;
                }
                else {
                    throw new Error ("Connected message request, but no connection established. Forgot forwardOpen?");
                }
            }
            const packet = connected
                ? sendUnitData(session.id, data, connection.id, connection.seq_num)
                : sendRRData(session.id, data, timeout);

            if (cb) {
                this.write(packet, cb);
            } else {
                this.write(packet);
            }
        }
    }

    /**
     * Sends Unregister Session Command and Destroys Underlying TCP Socket
     *
     * @override
     * @param {Exception} exception - Gets passed to 'error' event handler
     * @memberof ENIP
     */
    destroy(exception?: Error): this {
        const { unregisterSession } = encapsulation;
        const unregisteredSession = unregisterSession(this.state.session.id);
        
        const onClose = () => {
            this.state.session.established = false;
            super.destroy(exception);
        };
        
        // Only write to the socket if is not closed. 
        if (exception !== undefined && exception.name !== "EPIPE" ) {
            this.write(unregisteredSession, onClose);    
        } else {            
            onClose();
        }

        return this;
    }
    // endregion

    // region Private Method Definitions
    _initializeEventHandlers() {
        this.on("data", this._handleDataEvent);
        this.on("close", this._handleCloseEvent);
    }
    //endregion

    // region Event Handlers

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
     * @param data - Data Received from Socket.on('data', ...)
     */
    _handleDataEvent(data: Buffer): void {
        const { header, CPF, commands } = encapsulation;

        const encapsulatedData = header.parse(data);
        const { statusCode, status, commandCode } = encapsulatedData;

        if (statusCode !== 0) {
            console.log(`Error <${statusCode}>:`, status);

            this.state.error.code = statusCode;
            this.state.error.msg = status;

            this.emit("Session Registration Failed", this.state.error);
        } else {
            this.state.error.code = null;
            this.state.error.msg = null;
            /* eslint-disable indent */
            switch (commandCode) {
                case commands.RegisterSession:
                    this.state.session.establishing = false;
                    this.state.session.established = true;
                    this.state.session.id = encapsulatedData.session;
                    this.emit("Session Registered", this.state.session.id);
                    break;

                case commands.UnregisterSession:
                    this.state.session.established = false;
                    this.emit("Session Unregistered");
                    break;

                case commands.SendRRData: {
                    let buf1 = Buffer.alloc(encapsulatedData.length - 6); // length of Data - Interface Handle <UDINT> and Timeout <UINT>
                    encapsulatedData.data.copy(buf1, 0, 6);

                    const srrd = CPF.parse(buf1);
                    this.emit("SendRRData Received", srrd);
                    break;
                }
                case commands.SendUnitData: {
                    let buf2 = Buffer.alloc(encapsulatedData.length - 6); // length of Data - Interface Handle <UDINT> and Timeout <UINT>
                    encapsulatedData.data.copy(buf2, 0, 6);

                    const sud = CPF.parse(buf2);
                    this.emit("SendUnitData Received", sud);
                    break;
                }
                default:
                    this.emit("Unhandled Encapsulated Command Received", encapsulatedData);
            }
            /* eslint-enable indent */
        }
    }

    /**
     * Socket.on('close',...) Event Handler
     *
     * @memberof ENIP
     */
    _handleCloseEvent() {
        this.state.session.established = false;
        this.state.TCP.established = false;
    }
    // endregion
}

export { ENIP, CIP, encapsulation, enipConnection, enipSession, enipError, enipTCP};
