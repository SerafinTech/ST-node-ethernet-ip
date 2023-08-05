import { ENIP, CIP, enipConnection, enipError, enipTCP, enipSession } from "../../enip";
import dateFormat from "dateformat";
import TagGroup from "../../tag-group";
import { promiseTimeout } from "../../utilities";
import Queue from "task-easy";




const compare = (obj1, obj2) => {
    if (obj1.priority > obj2.priority) return true;
    else if (obj1.priority < obj2.priority) return false;
    else return obj1.timestamp.getTime() < obj2.timestamp.getTime();
};

type controllerState = {
    name: string,
    serial_number: number,
    slot: number,
    time: Date,
    path: Buffer,
    version: string,
    status: number,
    run: boolean,
    program: boolean,
    faulted: boolean,
    minorRecoverableFault: boolean,
    minorUnrecoverableFault: boolean,
    majorRecoverableFault: boolean,
    majorUnrecoverableFault: boolean,
    io_faulted: boolean
}

class Controller extends ENIP {
    OTconnectionID: number;
    TOconnectionID: number;
    configInstance: any;
    outputInstance: any;
    inputInstance: any;
    tryingToConnect: boolean;

    state: {
        TCP: enipTCP,
        session: enipSession,
        connection: enipConnection,
        error: enipError
        controller: controllerState,
        subs: TagGroup,
        scanning: boolean,
        scan_rate: number,
        connectedMessaging: boolean,
        timeout_sp: number,
        rpi: number,
        fwd_open_serial: number,
        unconnectedSendTimeout: number,
    }

    workers: {
        read: any;
        write: any;
        group: any;
    }
    constructor(connectedMessaging: boolean = true, configInstance: any, outputInstance: any, inputInstance: any) {
        super();

        this.OTconnectionID = 0;
        this.TOconnectionID = 0;
        this.configInstance = configInstance;
        this.outputInstance = outputInstance;
        this.inputInstance = inputInstance;
        this.tryingToConnect = false;

        this.state = {
            ...this.state,
            controller: {
                name: null,
                serial_number: null,
                slot: null,
                time: null,
                path: null,
                version: null,
                status: null,
                run: false,
                program: false,
                faulted: false,
                minorRecoverableFault: false,
                minorUnrecoverableFault: false,
                majorRecoverableFault: false,
                majorUnrecoverableFault: false,
                io_faulted: false
            },
            subs: new TagGroup(),
            scanning: false,
            scan_rate: 200, //ms,
            connectedMessaging,
            timeout_sp: 10000, //ms
            rpi: 10,
            fwd_open_serial: 0,
        };

        this.workers = {
            read: new Queue(compare),
            write: new Queue(compare),
            group: new Queue(compare),
        };
    }

    // region Property Definitions
    /**
     * Returns the Scan Rate of Subscription Tags
     *
     * @memberof Controller
     * @returns {number} ms
     */
    get scan_rate() {
        return this.state.scan_rate;
    }

    /**
     * Returns the Timeout Setpoint
     *
     * @memberof Controller
     * @returns {number} ms
     */
    get timeout_sp() {
        return this.state.timeout_sp;
    }

    /**
     * Sets the Timeout Setpoint
     *
     * @memberof Controller
     */
    set timeout_sp(sp) {
        if (typeof sp !== "number") throw new Error("timeout_sp must be of Type <number>");
        this.state.timeout_sp = Math.trunc(sp);
    }

    /**
     * Returns the Rpi
     *
     * @memberof Controller
     * @returns {number} ms
     */
    get rpi() {
        return this.state.rpi;
    }

    /**
     * Sets the Rpi
     *
     * @memberof Controller
     */
    set rpi(sp) {
        if (typeof sp !== "number") throw new Error("Rpi must be of Type <number>");
        if (sp < 8) throw new Error("Rpi a minimum of 8ms");
        this.state.rpi = Math.trunc(sp);
    }

    /**
     * Get the status of Scan Group
     *
     * @readonly
     * @memberof Controller
     */
    get scanning() {
        return this.state.scanning;
    }

    /**
     * Returns the connected / unconnected messaging mode
     *
     * @memberof Controller
     * @returns {boolean} true, if connected messaging; false, if unconnected messaging
     */
    get connectedMessaging() {
        return this.state.connectedMessaging;
    }

    /**
     * Sets the Mode to connected / unconnected messaging
     *
     * @memberof Controller
     */
    set connectedMessaging(conn) {
        if (typeof conn !== "boolean") throw new Error("connectedMessaging must be of type <boolean>");
        this.state.connectedMessaging= conn;
    }

    /**
     * Gets the Controller Properties Object
     *
     * @readonly
     * @memberof Controller
     * @returns {object}
     */
    get properties() {
        return this.state.controller;
    }

    /**
     * Fetches the last timestamp retrieved from the controller
     * in human readable form
     *
     * @readonly
     * @memberof Controller
     */
    get time() {
        return dateFormat(this.state.controller.time, "mmmm dd, yyyy - hh:MM:ss TT");
    }
    // endregion

    // region Public Method Definitions

    /**
     * Initializes Session with Desired IP Address
     * and Returns a Promise with the Established Session ID
     *
     * @param IP_ADDR - IPv4 Address (can also accept a FQDN, provided port forwarding is configured correctly.)
     * @param SLOT - Controller Slot Number (0 if CompactLogix), or a Buffer representing the whole routing path
     * @returns Promise that resolves after connection
     */
    async connect(IP_ADDR: string, SLOT: number | Buffer = 0, SETUP: boolean = true): Promise<number> {
               
        const { PORT } = CIP.EPATH.segments;
        const BACKPLANE = 1;

        if (typeof SLOT === "number") {
            this.state.controller.slot = SLOT;
            this.state.controller.path = PORT.build(BACKPLANE, SLOT);
        } else if (Buffer.isBuffer(SLOT)) {
            this.state.controller.path = SLOT;
        } else {
            throw new Error("Invalid slot parameter type, must be either a number or a Buffer");
        }

        await super.connect(IP_ADDR, this.timeout_sp);   
        
        this._initializeControllerEventHandlers(); // Connect sendRRData Event
        
        this.OTconnectionID = await this.forwardOpen();

        return this.OTconnectionID;
        
    }

    /**
     * Disconnects the PLC instance gracefully by issuing forwardClose, UnregisterSession
     * and then destroying the socket
     * and Returns a Promise indicating a success or failure or the disconnection
     *
     * @memberof Controller
     * @returns {Promise}
     */
    async disconnect() {
        if (super.established_conn === true) {
            const closeid = await this.forwardClose();
            if(!closeid) throw new Error("Failed to End Connected EIP Session with Forward Close Request");
        }

        super.destroy();

        this._removeControllerEventHandlers();
        return "disconnected";
    }


    /**
     * Writes a forwardOpen Request and retrieves the connection ID used for
     * connected messages.
     * @memberof Controller
     * @returns {Promise}
     */
    async forwardOpen() {
        const { FORWARD_OPEN } = CIP.MessageRouter.services;
        const { LOGICAL } = CIP.EPATH.segments;
        const { owner, connectionType, fixedVar, priority} = CIP.ConnectionManager;

        // Build Connection Manager Object Logical Path Buffer
        const cmPath = Buffer.concat([
            LOGICAL.build(LOGICAL.types.ClassID, 0x06), // Connection Manager Object (0x01)
            LOGICAL.build(LOGICAL.types.InstanceID, 0x01) // Instance ID (0x01)
        ]);

        // Message Router to Embed in UCMM
        const MR = CIP.MessageRouter.build(FORWARD_OPEN, cmPath, Buffer.from([]));

        // Create connection parameters
        const paramsOT = CIP.ConnectionManager.build_connectionParameters(owner.Exclusive, connectionType.PointToPoint, priority.Scheduled, fixedVar.Fixed, 6 + this.outputInstance.size);
        const paramsTO = CIP.ConnectionManager.build_connectionParameters(owner.Exclusive, connectionType.PointToPoint, priority.Scheduled, fixedVar.Fixed, 2 + this.inputInstance.size);
        

        this.state.fwd_open_serial = getRandomInt(32767);
        const forwardOpenData = CIP.ConnectionManager.build_forwardOpen(this.state.rpi * 1000, paramsOT, 1000 , 32, this.state.fwd_open_serial);

    

        const ioPath = this._ioPath();
        
        // This is the Connection Path data unit (Vol.1 Table 3-5.21)
        const connectionPath = Buffer.concat([
            Buffer.from([Math.ceil(ioPath.length/2)]), //Path size in WORDS
            ioPath
        ]);

        // Next 2 lines change the result of CIP.ConnectionManager.build_forwardOpen
        forwardOpenData.writeUInt8(1, 34);  // Change to Class 1 
        forwardOpenData.writeUInt16LE(paramsTO, 32); // Change T=>O connection parameters

        const forwardOpenPacket = Buffer.concat([
            MR,
            forwardOpenData,
            connectionPath
        ]);

        super.establishing_conn = true;
        super.established_conn = false;

        super.write_cip(forwardOpenPacket); // We need to bypass unconnected send for now

        const readPropsErr = new Error("TIMEOUT occurred while trying forwardOpen Request.");
        
        // Wait for Response
        const data = await promiseTimeout(
            new Promise((resolve, reject) => {
                this.on("Forward Open", (err, data) => {
                    if (err) reject(err);
                    resolve(data);
                });
            }),
            this.state.timeout_sp,
            readPropsErr
        );

        this.removeAllListeners("Forward Open");
        
        const OTconnID = data.readUInt32LE(0); // first 4 Bytes are O->T connection ID 
        
        super.id_conn = OTconnID;
        super.established_conn = true;
        super.establishing_conn = false;
        this.TOconnectionID = forwardOpenData.readUInt32LE(6);
        this.OTconnectionID = OTconnID;
        return OTconnID;       
    }

    /**
     * Generates path to IO assembly instances
     */
    _ioPath() {
        const LOGICAL = CIP.EPATH.segments.LOGICAL;
        const path = LOGICAL.build(LOGICAL.types.Special, 0x04);
        const vendorID = Buffer.from([0x00, 0x00]);
        const deviceType = Buffer.from([0x00, 0x00]);
        const productCode = Buffer.from([0x00, 0x00]);
        const compatMajorRevision = Buffer.from([0x00]);
        const minorRevision = Buffer.from([0x00]);

        const electronicKey = Buffer.concat([path, vendorID, deviceType, productCode, compatMajorRevision, minorRevision]);

        //Assembly Object Class
        const assemblyObjectClass = LOGICAL.build(LOGICAL.types.ClassID, 0x04);
        // Config Instance
        const configInstance = LOGICAL.build(LOGICAL.types.InstanceID, this.configInstance.assembly);
        // Output Instance
        const pointOT = LOGICAL.build(LOGICAL.types.ConnPoint, this.outputInstance.assembly);
        // Input Instance
        const pointTO = LOGICAL.build(LOGICAL.types.ConnPoint, this.inputInstance.assembly);

        const cipPath = Buffer.concat([assemblyObjectClass, configInstance, pointOT, pointTO]);

        return(Buffer.concat([electronicKey, cipPath]));
    }

    /**
     * Writes a forwardClose Request and retrieves the connection ID used for
     * connected messages.
     */
    async forwardClose() {
        const { FORWARD_CLOSE } = CIP.MessageRouter.services;
        const { LOGICAL } = CIP.EPATH.segments;

        // Build Connection Manager Object Logical Path Buffer
        const cmPath = Buffer.concat([
            LOGICAL.build(LOGICAL.types.ClassID, 0x06), // Connection Manager Object (0x01)
            LOGICAL.build(LOGICAL.types.InstanceID, 0x01) // Instance ID (0x01)
        ]);

        // Message Router to Embed in UCMM
        const MR = CIP.MessageRouter.build(FORWARD_CLOSE, cmPath, Buffer.from([]));

        const forwardCloseData = CIP.ConnectionManager.build_forwardClose(1000 , 0x3333, 0x1337, this.state.fwd_open_serial);

        // Build MR Path in order to send the message to the CPU
        const mrPath = Buffer.concat([
            LOGICAL.build(LOGICAL.types.ClassID, 0x02), // Message Router Object (0x02)
            LOGICAL.build(LOGICAL.types.InstanceID, 0x01) // Instance ID (0x01)
        ]);

        // Concatenate path to CPU and how to reach the message router
        const portPath = Buffer.concat([
            this.state.controller.path,
            mrPath
        ]);

        // This is the Connection Path data unit (Vol.1 Table 3-5.21)
        const connectionPath = Buffer.concat([
            Buffer.from([Math.ceil(portPath.length/2)]), //Path size in WORDS
            Buffer.from([0x00]), // Padding
            portPath
        ]);

        // Fully assembled packet
        const forwardClosePacket = Buffer.concat([
            MR,
            forwardCloseData,
            connectionPath
        ]);

        super.write_cip(forwardClosePacket); // We need to bypass unconnected send for now

        const readPropsErr = new Error("TIMEOUT occurred while trying forwardClose Request.");

        // Wait for Response
        const data = await promiseTimeout(
            new Promise((resolve, reject) => {
                this.on("Forward Close", (err, data) => {
                    if (err) reject(err);
                    resolve(data);
                });
            }),
            this.state.timeout_sp,
            readPropsErr
        );

        this.removeAllListeners("Forward Close");
        
        const OTconnID = data.readUInt32LE(0); // first 4 Bytes are O->T connection ID 
        super.id_conn = OTconnID;
        super.established_conn = false;
        super.establishing_conn = true;
        return OTconnID;
    }

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
    write_cip(data: Buffer, connected?: boolean, timeout: number = 10, cb: any = null) {
        const { UnconnectedSend } = CIP;
        let msg: Buffer;
        if (!connected) {
            connected = super.established_conn;
        }
        if (connected === false) {
            msg = UnconnectedSend.build(data, this.state.controller.path);
        } else {
            msg = data;
        }
        super.write_cip(msg, connected, timeout, cb);
    }

    /**
     * Reads Controller Identity Object
     *
     * @memberof Controller
     * @returns {Promise}
     */
    async readControllerProps() {
        const { GET_ATTRIBUTE_ALL } = CIP.MessageRouter.services;
        const { LOGICAL } = CIP.EPATH.segments;

        // Build Identity Object Logical Path Buffer
        const identityPath = Buffer.concat([
            LOGICAL.build(LOGICAL.types.ClassID, 0x01), // Identity Object (0x01)
            LOGICAL.build(LOGICAL.types.InstanceID, 0x01) // Instance ID (0x01)
        ]);

        // Message Router to Embed in UCMM
        const MR = CIP.MessageRouter.build(GET_ATTRIBUTE_ALL, identityPath, Buffer.from([]));

        this.write_cip(MR);

        const readPropsErr = new Error("TIMEOUT occurred while reading Controller Props.");

        // Wait for Response
        const data = await promiseTimeout(
            new Promise((resolve, reject) => {
                this.on("Get Attribute All", (err, data) => {
                    if (err) reject(err);
                    resolve(data);
                });
            }),
            this.state.timeout_sp,
            readPropsErr
        );

        this.removeAllListeners("Get Attribute All");

        // Parse Returned Buffer
        this.state.controller.serial_number = data.readUInt32LE(10);

        const nameBuf = Buffer.alloc(data.length - 15);
        data.copy(nameBuf, 0, 15);

        this.state.controller.name = nameBuf.toString("utf8");

        const major = data.readUInt8(6);
        const minor = data.readUInt8(7);
        this.state.controller.version = `${major}.${minor}`;

        let status = data.readUInt16LE(8);
        this.state.controller.status = status;

        status &= 0x0ff0;
        this.state.controller.faulted = (status & 0x0f00) === 0 ? false : true;
        this.state.controller.minorRecoverableFault = (status & 0x0100) === 0 ? false : true;
        this.state.controller.minorUnrecoverableFault = (status & 0x0200) === 0 ? false : true;
        this.state.controller.majorRecoverableFault = (status & 0x0400) === 0 ? false : true;
        this.state.controller.majorUnrecoverableFault = (status & 0x0800) === 0 ? false : true;

        status &= 0x0f00;
        this.state.controller.io_faulted = status >> 4 === 2 ? true : false;
        this.state.controller.faulted = status >> 4 === 2 ? true : this.state.controller.faulted;
    }

    // region Private Methods
    /**
     * Initialized Controller Specific Event Handlers
     *
     * @memberof Controller
     */
    _initializeControllerEventHandlers() {
        this.on("SendRRData Received", this._handleSendRRDataReceived);
        this.on("SendUnitData Received", this._handleSendUnitDataReceived);
    }

    /**
     * Remove Controller Specific Event Handlers
     *
     * @memberof Controller
     */
    _removeControllerEventHandlers() {
        this.removeAllListeners("SendRRData Received");
        this.removeAllListeners("SendUnitData Received");
    }

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
    _handleSendRRDataReceived(srrd) {
        const { service, generalStatusCode, extendedStatus, data } = CIP.MessageRouter.parse(
            srrd[1].data
        );

        const {
            GET_INSTANCE_ATTRIBUTE_LIST,
            GET_ATTRIBUTES,
            GET_ATTRIBUTE_SINGLE,
            GET_ATTRIBUTE_ALL,
            SET_ATTRIBUTE_SINGLE,
            READ_TAG,
            READ_TAG_FRAGMENTED,
            WRITE_TAG,
            WRITE_TAG_FRAGMENTED,
            READ_MODIFY_WRITE_TAG,
            MULTIPLE_SERVICE_PACKET,
            FORWARD_OPEN,
            FORWARD_CLOSE
        } = CIP.MessageRouter.services;

        let error = generalStatusCode !== 0 ? { generalStatusCode, extendedStatus } : null;

        // Route Incoming Message Responses
        /* eslint-disable indent */
        switch (service - 0x80) {
            case FORWARD_CLOSE:
                this.emit("Forward Close", error, data);
                this.emit("Read Modify Write Tag", error, data);
                break;
            case FORWARD_OPEN:
                this.emit("Forward Open", error, data);
                break;
            case GET_INSTANCE_ATTRIBUTE_LIST:
                this.emit("Get Instance Attribute List", error, data);
                break;
            case GET_ATTRIBUTES:
                this.emit("Get Attributes", error, data);
                break;
            case GET_ATTRIBUTE_SINGLE:
                this.emit("Get Attribute Single", error, data);
                break;
            case GET_ATTRIBUTE_ALL:
                this.emit("Get Attribute All", error, data);
                break;
            case SET_ATTRIBUTE_SINGLE:
                this.emit("Set Attribute Single", error, data);
                break;
            case READ_TAG:
                this.emit("Read Tag", error, data);
                break;
            case READ_TAG_FRAGMENTED:
                this.emit("Read Tag Fragmented", error, data);
                break;
            case WRITE_TAG:
                this.emit("Write Tag", error, data);
                break;
            case WRITE_TAG_FRAGMENTED:
                this.emit("Write Tag Fragmented", error, data);
                break;            
            case READ_MODIFY_WRITE_TAG:
                this.emit("Read Modify Write Tag", error, data);
                this.emit("Forward Close", error, data);
                break;
            case MULTIPLE_SERVICE_PACKET: {
                // If service errored then propogate error
                if (error && error.generalStatusCode !== 30) {
                    this.emit("Multiple Service Packet", error, data);
                    break;
                }

                // Get Number of Services to be Enclosed
                let services = data.readUInt16LE(0);
                let offsets = [];
                let responses = [];

                // Build Array of Buffer Offsets
                for (let i = 0; i < services; i++) {
                    offsets.push(data.readUInt16LE(i * 2 + 2));
                }

                // Gather Messages within Buffer
                for (let i = 0; i < offsets.length - 1; i++) {
                    const length = offsets[i + 1] - offsets[i];

                    let buf = Buffer.alloc(length);
                    data.copy(buf, 0, offsets[i], offsets[i + 1]);

                    // Parse Message Data
                    const msgData = CIP.MessageRouter.parse(buf);

                    if (msgData.generalStatusCode !== 0 && error.generalStatusCode !== 30) {
                        error = {
                            generalStatusCode: msgData.generalStatusCode,
                            extendedStatus: msgData.extendedStatus
                        };
                    }

                    responses.push(msgData);
                }

                // Handle Final Message
                const length = data.length - offsets[offsets.length - 1];

                let buf = Buffer.alloc(length);
                data.copy(buf, 0, offsets[offsets.length - 1]);

                const msgData = CIP.MessageRouter.parse(buf);

                if (msgData.generalStatusCode !== 0) {
                    error = {
                        generalStatusCode: msgData.generalStatusCode,
                        extendedStatus: msgData.extendedStatus
                    };
                }

                responses.push(msgData);

                this.emit("Multiple Service Packet", error, responses);
                break;
            }
            default:
                this.emit("Unknown Reply", { generalStatusCode: 0x99, extendedStatus: [] }, data);
                break;
        }
        /* eslint-enable indent */
    }

    _handleSendUnitDataReceived(sud) {
        let sudnew = sud[1].data.slice(2); // First 2 bytes are Connection sequence number
        const { service, generalStatusCode, extendedStatus, data } = CIP.MessageRouter.parse(
            sudnew
        );

        const {
            GET_ATTRIBUTE_SINGLE,
            GET_ATTRIBUTES,
            GET_ATTRIBUTE_ALL,
            GET_INSTANCE_ATTRIBUTE_LIST,
            SET_ATTRIBUTE_SINGLE,
            READ_TAG,
            READ_TAG_FRAGMENTED,
            WRITE_TAG,
            WRITE_TAG_FRAGMENTED,
            READ_MODIFY_WRITE_TAG,
            MULTIPLE_SERVICE_PACKET,
            FORWARD_OPEN,
            FORWARD_CLOSE

        } = CIP.MessageRouter.services;

        let error = generalStatusCode !== 0 ? { generalStatusCode, extendedStatus } : null;

        // Route Incoming Message Responses
        /* eslint-disable indent */
        switch (service - 0x80) {
            case FORWARD_CLOSE:
                this.emit("Forward Close", error, data);
                this.emit("Read Modify Write Tag", error, data);
                break;
            case FORWARD_OPEN:
                this.emit("Forward Open", error, data);
                break;
            case GET_ATTRIBUTES:
                this.emit("Get Attributes", error, data);
                break;
            case GET_ATTRIBUTE_SINGLE:
                this.emit("Get Attribute Single", error, data);
                break;
            case GET_ATTRIBUTE_ALL:
                this.emit("Get Attribute All", error, data);
                break;
            case SET_ATTRIBUTE_SINGLE:
                this.emit("Set Attribute Single", error, data);
                break;
            case GET_INSTANCE_ATTRIBUTE_LIST:
                this.emit("Get Instance Attribute List", error, data);
                break;
            case READ_TAG:
                this.emit("Read Tag", error, data);
                break;
            case READ_TAG_FRAGMENTED:
                this.emit("Read Tag Fragmented", error, data);
                break;
            case WRITE_TAG:
                this.emit("Write Tag", error, data);
                break;
            case WRITE_TAG_FRAGMENTED:
                this.emit("Write Tag Fragmented", error, data);
                break;            
            case READ_MODIFY_WRITE_TAG:
                this.emit("Read Modify Write Tag", error, data);
                this.emit("Forward Close", error, data);
                break;
            case MULTIPLE_SERVICE_PACKET: {
                // If service errored then propogate error
                if (error && error.generalStatusCode !== 30) {
                    this.emit("Multiple Service Packet", error, data);
                    break;
                }

                // Get Number of Services to be Enclosed
                let services = data.readUInt16LE(0);
                let offsets = [];
                let responses = [];

                // Build Array of Buffer Offsets
                for (let i = 0; i < services; i++) {
                    offsets.push(data.readUInt16LE(i * 2 + 2));
                }

                // Gather Messages within Buffer
                for (let i = 0; i < offsets.length - 1; i++) {
                    const length = offsets[i + 1] - offsets[i];

                    let buf = Buffer.alloc(length);
                    data.copy(buf, 0, offsets[i], offsets[i + 1]);

                    // Parse Message Data
                    const msgData = CIP.MessageRouter.parse(buf);

                    if (msgData.generalStatusCode !== 0) {
                        error = {
                            generalStatusCode: msgData.generalStatusCode,
                            extendedStatus: msgData.extendedStatus
                        };
                    }

                    responses.push(msgData);
                }

                // Handle Final Message
                const length = data.length - offsets[offsets.length - 1];

                let buf = Buffer.alloc(length);
                data.copy(buf, 0, offsets[offsets.length - 1]);

                const msgData = CIP.MessageRouter.parse(buf);

                if (msgData.generalStatusCode !== 0) {
                    error = {
                        generalStatusCode: msgData.generalStatusCode,
                        extendedStatus: msgData.extendedStatus
                    };
                }

                responses.push(msgData);

                this.emit("Multiple Service Packet", error, responses);
                break;
            }
            default:
                this.emit("Unknown Reply", { generalStatusCode: 0x99, extendedStatus: [] }, data);
                break;
        }
        /* eslint-enable indent */        
    }

    // _handleSessionRegistrationFailed(error) {
    //     // TODO: Implement Handler if Necessary
    // }
    // endregion
}

function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}

module.exports = Controller;
