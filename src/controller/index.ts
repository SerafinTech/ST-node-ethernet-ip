import { CIP } from "../enip";
import {ENIP, enipConnection, enipError, enipTCP, enipSession} from "../enip";
import dateFormat from "dateformat";
import TagGroup from "../tag-group";
import { delay, promiseTimeout } from "../utilities";
import TagList, { tagListTag, tagListTemplates } from "../tag-list";
import { Structure } from "../structure";
import Queue from "task-easy";
import Tag from "../tag";
import type {CommonPacketData} from '../enip/encapsulation'

const compare = (obj1: any, obj2: any) => {
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
        tagList: TagList,
    }

    workers: {
        read: any;
        write: any;
        group: any;
    }
    /**
     * PLC Controller class
     * 
     * @param connectedMessaging whether to use connected or unconnected messaging
     * @param opts future options
     * @param opts.unconnectedSendTimeout unconnected send timeout option
     */
    constructor(connectedMessaging: boolean = true, opts: any = {}) {
        super();

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
            unconnectedSendTimeout: opts.unconnectedSendTimeout || 2000,
            tagList: new TagList(),
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
     * @returns scan rate in ms
     */
    get scan_rate(): number {
        return this.state.scan_rate;
    }

    /**
     * Sets the Subsciption Group Scan Rate
     *
     */
    set scan_rate(rate: number) {
        if (typeof rate !== "number") throw new Error("scan_rate must be of Type <number>");
        this.state.scan_rate = Math.trunc(rate);
    }

    /**
     * Returns the Timeout Setpoint
     *
     * @returns Timeout setpoint in ms
     */
    get timeout_sp(): number {
        return this.state.timeout_sp;
    }

    /**
     * Sets the Timeout Setpoint
     *
     */
    set timeout_sp(sp: number) {
        if (typeof sp !== "number") throw new Error("timeout_sp must be of Type <number>");
        this.state.timeout_sp = Math.trunc(sp);
    }

    /**
     * Returns the Rpi
     *
     * @returns rpi setpoint in ms
     */
    get rpi() {
        return this.state.rpi;
    }

    /**
     * Sets the Rpi
     *
     */
    set rpi(sp: number) {
        if (typeof sp !== "number") throw new Error("Rpi must be of Type <number>");
        if (sp < 8) throw new Error("Rpi a minimum of 8ms");
        this.state.rpi = Math.trunc(sp);
    }

    /**
     * Get the status of Scan Group
     *
     * @returns true or false
     */
    get scanning(): boolean {
        return this.state.scanning;
    }

    /**
     * Returns the connected / unconnected messaging mode
     *
     * @returns true, if connected messaging; false, if unconnected messaging
     */
    get connectedMessaging(): boolean {
        return this.state.connectedMessaging;
    }

    /**
     * Sets the Mode to connected / unconnected messaging
     *
     */
    set connectedMessaging(conn: boolean) {
        if (typeof conn !== "boolean") throw new Error("connectedMessaging must be of type <boolean>");
        this.state.connectedMessaging= conn;
    }

    /**
     * Gets the Controller Properties Object
     *
     * @readonly
     * @memberof Controller
     * @returns Controller properties object
     */
    get properties(): controllerState {
        return this.state.controller;
    }

    /**
     * Fetches the last timestamp retrieved from the controller
     * in human readable form
     *
     * @readonly
     */
    get time(): string {
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
    async connect(IP_ADDR: string, SLOT: number | Buffer = 0, SETUP: boolean = true): Promise<void> {
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

        const sessid = await super.connect(IP_ADDR);
        if (!sessid) throw new Error("Failed to Register Session with Controller");
        
        this._initializeControllerEventHandlers(); // Connect sendRRData Event

        if (this.state.connectedMessaging === true) {
            const connid = await this.forwardOpen();
            if(!connid) throw new Error("Failed to Establish Forward Open Connection with Controller");
        }

        if (SETUP) { 
            await this.readControllerProps();
            await this.getControllerTagList(this.state.tagList);
        }
    }

    /**
     * Run a GET_ATTRIBUTE_SINGLE on any class, instance, attribute.
     * For attribute of a class set instance to 0x00.
     * 
     * @param classID 
     * @param instance 
     * @param attribute 
     * @returns attribute buffer
     */
    async getAttributeSingle(classID: number, instance: number, attribute: number): Promise<Buffer> {
        const { GET_ATTRIBUTE_SINGLE } = CIP.MessageRouter.services;
        const { LOGICAL } = CIP.EPATH.segments;
       
        const identityPath = Buffer.concat([
            LOGICAL.build(LOGICAL.types.ClassID, classID), 
            LOGICAL.build(LOGICAL.types.InstanceID, instance), 
            LOGICAL.build(LOGICAL.types.AttributeID, attribute) 
        ]);

        const MR = CIP.MessageRouter.build(GET_ATTRIBUTE_SINGLE, identityPath, Buffer.from([]));

        super.write_cip(MR, super.established_conn);

        const readPropsErr = new Error("TIMEOUT occurred while reading Param.");

        // Wait for Response
        const data = await promiseTimeout(
            new Promise((resolve, reject) => {
                this.on("Get Attribute Single", (err, data) => {
                    if (err) reject(err);
                    resolve(data);
                });
            }),
            this.state.timeout_sp,
            readPropsErr
        );
        this.removeAllListeners("Get Attribute Single");
        return data
    }

    /**
     * Run a SET_ATTRIBUTE_SINGLE on any class, instance, attribute. You have to know the size of the buffer 
     * of the data you are setting attribute to.  For attribute of a class set instance to 0x00.
     * 
     * @param classID - CIP Class ID
     * @param instance - CIP Instance ID
     * @param attribute - Attribute Number
     * @param newValue - New value to set to as a Buffer
     * @returns 
     */
    async setAttributeSingle(classID: number, instance: number, attribute: number, newValue: Buffer): Promise<void> {
        const { SET_ATTRIBUTE_SINGLE } = CIP.MessageRouter.services;
        const { LOGICAL } = CIP.EPATH.segments;

        const identityPath = Buffer.concat([
            LOGICAL.build(LOGICAL.types.ClassID, classID), 
            LOGICAL.build(LOGICAL.types.InstanceID, instance), 
            LOGICAL.build(LOGICAL.types.AttributeID, attribute) 
        ]);

        const MR = CIP.MessageRouter.build(SET_ATTRIBUTE_SINGLE, identityPath, newValue);

        super.write_cip(MR, super.established_conn);

        const readPropsErr = new Error("TIMEOUT occurred while setting Param.");

        // Wait for Response
        const data = await promiseTimeout(
            new Promise((resolve, reject) => {
                this.on("Set Attribute Single", (err, data) => {
                    if (err) reject(err);
                    resolve(data);
                });
            }),
            this.state.timeout_sp,
            readPropsErr
        );
        this.removeAllListeners("Set Attribute Single");
        return data
    }

    /**
     * Gets file data block used for retrieving eds file from some devices
     * 
     * @param classID - CIP Class ID
     * @param instance - CIP Instance ID
     * @param blockNum - Block Number
     * @returns File data
     */
    async getFileData(classID: number, instance: number, blockNum: number): Promise<Buffer> {
        const { GET_FILE_DATA } = CIP.MessageRouter.services;
        const { LOGICAL } = CIP.EPATH.segments;

        const identityPath = Buffer.concat([
            LOGICAL.build(LOGICAL.types.ClassID, classID), 
            LOGICAL.build(LOGICAL.types.InstanceID, instance), 
        ]);

        const MR = CIP.MessageRouter.build(GET_FILE_DATA, identityPath, Buffer.from([blockNum]));

        super.write_cip(MR, super.established_conn);

        const readPropsErr = new Error("TIMEOUT occurred while getting file data.");

        // Wait for Response
        const data = await promiseTimeout(
            new Promise((resolve, reject) => {
                this.on("Get File Data", (err, data) => {
                    if (err) reject(err);
                    resolve(data);
                });
            }),
            this.state.timeout_sp,
            readPropsErr
        );
        this.removeAllListeners("Get File Data");
        return data
    }

    /**
     * Disconnects the PLC instance gracefully by issuing forwardClose, UnregisterSession
     * and then destroying the socket
     * and Returns a Promise indicating a success or failure or the disconnection
     *
     * @memberof Controller
     * @returns Promise that is resolved after disconnection
     */
    async disconnect(): Promise<string> {
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
     * @returns Promise resolving to OT connection ID
     */
    async forwardOpen(): Promise<number> {
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
        const params = CIP.ConnectionManager.build_connectionParameters(owner["Exclusive"], connectionType["PointToPoint"],priority["Low"],fixedVar["Variable"],500);
        this.state.fwd_open_serial = getRandomInt(32767);
        const forwardOpenData = CIP.ConnectionManager.build_forwardOpen(this.state.rpi * 3000, params, 1000 , 512, this.state.fwd_open_serial);

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
            portPath
        ]);

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
        return OTconnID;
    }

    /**
     * Writes a forwardClose Request and retrieves the connection ID used for
     * connected messages.
     * 
     * @returns Promise resolving OT connection ID
     */
    async forwardClose(): Promise<number> {
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
     * @param data - Message Router Packet Buffer
     * @param connected - Use Connected Messaging
     * @param timeout - Timeout (sec)
     * @param cb - Callback to be Passed to Parent.Write()
     */
    write_cip(data: Buffer, connected?: boolean, timeout: number = 10, cb: any = null): void {
        const { UnconnectedSend } = CIP;
        let msg: Buffer;
        if (!connected) {
            connected = super.established_conn;
        }
        if (connected === false) {
            msg = UnconnectedSend.build(data, this.state.controller.path, this.state.unconnectedSendTimeout);
        } else {
            msg = data;
        }
        super.write_cip(msg, connected, timeout, cb);
    }

    /**
     * Reads Controller Identity Object
     *
     * @returns Promise resolved when completed reading and storing controller properties
     */
    async readControllerProps(): Promise<void> {
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

        const nameBuf = Buffer.alloc(data.readUInt8(14));
        data.copy(nameBuf, 0, 15);

        this.state.controller.name = nameBuf.toString("utf8");

        const major = data.readUInt8(6);
        const minor = data.readUInt8(7);
        this.state.controller.version = `${major}.${minor}`;

        let status = data.readUInt16LE(8);
        this.state.controller.status = status;

        status &= 0x0ff0;
        this.state.controller.run = (status & 0x00f0) === 0x0060 ? true : false;
        this.state.controller.program = (status & 0x00f0) === 0x0070 ? true : false;
        this.state.controller.faulted = (status & 0x0f00) === 0 ? false : true;
        this.state.controller.minorRecoverableFault = (status & 0x0100) === 0 ? false : true;
        this.state.controller.minorUnrecoverableFault = (status & 0x0200) === 0 ? false : true;
        this.state.controller.majorRecoverableFault = (status & 0x0400) === 0 ? false : true;
        this.state.controller.majorUnrecoverableFault = (status & 0x0800) === 0 ? false : true;

        status &= 0x0f00;
        this.state.controller.io_faulted = status >> 4 === 2 ? true : false;
        this.state.controller.faulted = status >> 4 === 2 ? true : this.state.controller.faulted;
    }

    /**
     * Reads the Controller Wall Clock Object (L8 Named Controllers Only)
     *
     * @returns Promise resolved when completed reading wall clock
     */
    async readWallClock(): Promise<void> {
        if (this.state.controller.name.search("L8") === -1)
            throw new Error("WallClock Utilities are not supported by this controller type");

        const { GET_ATTRIBUTE_SINGLE } = CIP.MessageRouter.services;
        const { LOGICAL } = CIP.EPATH.segments;

        // Build Identity Object Logical Path Buffer
        const identityPath = Buffer.concat([
            LOGICAL.build(LOGICAL.types.ClassID, 0x8b), // WallClock Object (0x8B)
            LOGICAL.build(LOGICAL.types.InstanceID, 0x01), // Instance ID (0x01)
            LOGICAL.build(LOGICAL.types.AttributeID, 0x05) // Local Time Attribute ID
        ]);

        // Message Router to Embed in UCMM
        const MR = CIP.MessageRouter.build(GET_ATTRIBUTE_SINGLE, identityPath, Buffer.from([]));

        this.write_cip(MR);

        const readPropsErr = new Error("TIMEOUT occurred while reading Controller Clock.");

        // Wait for Response
        const data = await promiseTimeout(
            new Promise((resolve, reject) => {
                this.on("Get Attribute Single", (err, data) => {
                    if (err) reject(err);
                    resolve(data);
                });
            }),
            this.state.timeout_sp,
            readPropsErr
        );

        this.removeAllListeners("Get Attribute Single");

        // Parse Returned Buffer
        let wallClockArray = [];
        for (let i = 0; i < 7; i++) {
            wallClockArray.push(data.readUInt32LE(i * 4));
        }

        // Massage Data to JS Date Friendly Format
        wallClockArray[6] = Math.trunc(wallClockArray[6] / 1000); // convert to ms from us
        wallClockArray[1] -= 1; // month is 0-based

        const date = new Date(wallClockArray[0], wallClockArray[1],wallClockArray[2],wallClockArray[3],wallClockArray[4],wallClockArray[5],wallClockArray[6]);
        this.state.controller.time = date;
    }

    /**
     * Write to PLC Wall Clock
     *
     * @param date - Date Object
     * @returns Promise resolved after writing new Date to controller
     */
    async writeWallClock(date: Date = new Date()): Promise<void> {
        if (this.state.controller.name.search("L8") === -1)
            throw new Error("WallClock Utilities are not supported by this controller type");

        const { SET_ATTRIBUTE_SINGLE } = CIP.MessageRouter.services;
        const { LOGICAL } = CIP.EPATH.segments;
        const arr = [];

        arr.push(date.getFullYear());
        arr.push(date.getMonth() + 1);
        arr.push(date.getDate());
        arr.push(date.getHours());
        arr.push(date.getMinutes());
        arr.push(date.getSeconds());
        arr.push(date.getMilliseconds() * 1000);

        let buf = Buffer.alloc(28);
        for (let i = 0; i < 7; i++) {
            buf.writeUInt32LE(arr[i], 4 * i);
        }

        // Build Identity Object Logical Path Buffer
        const identityPath = Buffer.concat([
            LOGICAL.build(LOGICAL.types.ClassID, 0x8b), // WallClock Object (0x8B)
            LOGICAL.build(LOGICAL.types.InstanceID, 0x01), // Instance ID (0x01)
            LOGICAL.build(LOGICAL.types.AttributeID, 0x05) // Local Time Attribute ID
        ]);

        // Message Router to Embed in UCMM
        const MR = CIP.MessageRouter.build(SET_ATTRIBUTE_SINGLE, identityPath, buf);

        this.write_cip(MR);

        const writeClockErr = new Error("TIMEOUT occurred while writing Controller Clock.");

        // Wait for Response
        await promiseTimeout(
            new Promise((resolve, reject) => {
                this.on("Set Attribute Single", (err, data) => {
                    if (err) reject(err);
                    resolve(data);
                });
            }),
            this.state.timeout_sp,
            writeClockErr
        );

        this.removeAllListeners("Set Attribute Single");

        this.state.controller.time = date;
    }

    /**
     * Reads Value of Tag and Type from Controller
     *
     * @param tag - Tag Object to Write
     * @param size - Size used for writing array
     * @returns Promise resolved after read completed
     */
    readTag(tag: Tag | Structure, size = null): Promise<void> {
        return this.workers.read.schedule(this._readTag.bind(this), [tag, size], {
            priority: 1,
            timestamp: new Date()
        });
    }

    /**
     * Writes value to Tag
     *
     * @param tag - Tag Object to Write
     * @param value - If Omitted, Tag.value will be used
     * @param size - Used for writing arrays
     * @returns Promise resolved after complete writing
     */
    writeTag(tag: Tag | Structure, value = null, size = 0x01) {

        if(tag instanceof Structure) { tag.writeObjToValue(); }
        return this.workers.write.schedule(this._writeTag.bind(this), [tag, value, size], {
            priority: 1,
            timestamp: new Date()
        });
    }

    /**
     * Reads All Tags in the Passed Tag Group
     *
     * @param group - Tag Group instance
     * @returns Promise resolved on completion of reading group
     */
    readTagGroup(group: TagGroup): Promise<void> {
        return this.workers.group.schedule(this._readTagGroup.bind(this), [group], {
            priority: 1,
            timestamp: new Date()
        });
    }

    /**
     * Writes to Tag Group Tags
     *
     * @param group - Tag Group instance
     * @returns Promise resolved after reading tag group
     */
    writeTagGroup(group: TagGroup): Promise<void> {
        return this.workers.group.schedule(this._writeTagGroup.bind(this), [group], {
            priority: 1,
            timestamp: new Date()
        });
    }

    /**
     * Adds Tag to Subscription Group
     *
     * @param tag - Tag instance
     */
    subscribe(tag: Tag | Structure): void {
        this.state.subs.add(tag);
    }

    /**
     * Begin Scanning Subscription Group
     *
     * @returns Promise resolved after scanning state goes to false
     */
    async scan(): Promise<void> {
        this.state.scanning = true;

        while (this.state.scanning) {
            await this.workers.group
                .schedule(this._readTagGroup.bind(this), [this.state.subs], {
                    priority: 10,
                    timestamp: new Date()
                })
                .catch(e => {
                    return Promise.reject(e);
                });

            await this.workers.group
                .schedule(this._writeTagGroup.bind(this), [this.state.subs], {
                    priority: 10,
                    timestamp: new Date()
                })
                .catch(e => {
                    return Promise.reject(e);
                });

            await delay(this.state.scan_rate);
        }

        return Promise.resolve();
    }

    /**
     * Pauses Scanning of Subscription Group
     *
     */
    pauseScan(): void {
        this.state.scanning = false;
    }

    /**
     * Iterates of each tag in Subscription Group
     *
     * @param callback - Call back function with a Tag instance as a parameter
     */
    forEach(callback: (tag: Tag | Structure) => {}): void {
        this.state.subs.forEach(callback);
    }

    /**
     * 
     * @param tagList - Tag list instance to store tagnames from PLC
     * @param program - Program name
     * @returns Promise resolved when completed
     */
    async getControllerTagList(tagList: TagList, program: string = null): Promise<void> {
        const getTagListErr = new Error("TIMEOUT occurred while reading tag list");
        // Wait for Response
        return await promiseTimeout(
            tagList.getControllerTags(this, program),
            this.state.timeout_sp * 4,
            getTagListErr
        );   
    }   
    // endregion

    // region Private Methods
    /**
     * Initialized Controller Specific Event Handlers
     *
     */
    _initializeControllerEventHandlers(): void {
        this.on("SendRRData Received", this._handleSendRRDataReceived);
        this.on("SendUnitData Received", this._handleSendUnitDataReceived);
    }

    /**
     * Remove Controller Specific Event Handlers
     *
     */
    _removeControllerEventHandlers(): void {
        this.removeAllListeners("SendRRData Received");
        this.removeAllListeners("SendUnitData Received");
    }

    /**
     * Reads Value of Tag and Type from Controller
     *
     * @param tag - Tag Object to Write
     * @param size - Number of tags to read used for arrays
     * @returns Promise resolved when complete
     */
    async _readTag(tag: Tag | Structure, size: number = null): Promise<void> {
        const MR = tag.generateReadMessageRequest(size);

        this.write_cip(MR);

        const readTagErr = new Error(`TIMEOUT occurred while writing Reading Tag: ${tag.name}.`);

        // Wait for Response
        const data = await promiseTimeout(
            new Promise((resolve, reject) => {
                this.on("Read Tag", async (err, data) => {
                    if (err && err.generalStatusCode !== 6 && !(err.generalStatusCode === 255 && err.extendedStatus.toString() === [8453].toString())) {
                        reject(err);
                        return;                     
                    }

                    if(err && err.generalStatusCode === 255 && err.extendedStatus.toString() === [8453].toString()) {
                        tag.state.read_size--;
                        this._readTag(tag).catch(reject);
                    } else if (err && err.generalStatusCode === 6) {
                        await this._readTagFragmented(tag, size).catch(reject);
                        resolve(null);
                    } else {
                        resolve(data);
                    }                    
                });
            }),
            this.state.timeout_sp,
            readTagErr
        );

        this.removeAllListeners("Read Tag");    
        if (data) tag.parseReadMessageResponse(data);       
    }

    /**
     * Reads Data of Tag from Controller To Big To Fit In One Packet
     *
     * @param tag - Tag Object to Write
     * @param size - Number of tags to read used for arrays
     * @returns Promise resolved when complete
     */
    async _readTagFragmented(tag: Tag | Structure, size: number = null): Promise<void> {
        
        let offset = 0;
        let MR = tag.generateReadMessageRequestFrag(offset, size);
        this.write_cip(MR);
        
        const typeSize = (tag.type === "STRUCT") ? 4 : 2;

        const readTagErr = new Error(`TIMEOUT occurred while writing Reading Tag: ${tag.name}.`);

        let retData = Buffer.alloc(0);
        
        const data = await promiseTimeout(
            new Promise((resolve, reject) => {
                this.on("Read Tag Fragmented", (err, data) => {
                    if (err && err.generalStatusCode !== 6) {
                        reject(err);
                        return;
                    }
                    
                    const dataLength = data.length;
                    if (offset > 0) data = data.slice(typeSize);
                    offset += dataLength - typeSize;

                    if (err && err.generalStatusCode === 6) {   
                        retData = Buffer.concat([retData, data]);

                        MR = tag.generateReadMessageRequestFrag(offset, size);
                        this.write_cip(MR);
                    } else {
                        retData = Buffer.concat([retData, data]);
                        resolve(retData);
                    }
                    
                });
            }),
            this.state.timeout_sp,
            readTagErr
        );
        
        this.removeAllListeners("Read Tag Fragmented");

        tag.parseReadMessageResponse(data);
    }

    /**
     * Writes value to Tag
     *
     * @param tag - Tag Object to Write
     * @param value - If Omitted, Tag.value will be used
     * @param size - Number of tags to read used for arrays
     * @returns Promise resolved when complete
     */
    async _writeTag(tag: Tag | Structure, value: any = null, size: number = 0x01): Promise<void> {
        if (tag.state.tag.value.length > (480 - tag.path.length) && (tag instanceof Structure))
            return this._writeTagFragmented(tag, value, size);

        const MR = tag.generateWriteMessageRequest(value, size);

        this.write_cip(MR);
        
        const writeTagErr = new Error(`TIMEOUT occurred while writing Writing Tag: ${tag.name}.`);

        // Wait for Response
        await promiseTimeout(
            new Promise((resolve, reject) => {

                // Full Tag Writing
                this.on("Write Tag", (err, data) => {
                    if (err) reject(err);
                    
                    tag.unstageWriteRequest();
                    resolve(data);
                });

                // Masked Bit Writing
                this.on("Read Modify Write Tag", (err, data) => {
                    
                    if (err) reject(err);
                    
                    tag.unstageWriteRequest();
                    resolve(data);
                });
            }),
            this.state.timeout_sp,
            writeTagErr
        );

        this.removeAllListeners("Write Tag");
        this.removeAllListeners("Read Modify Write Tag");
    }

    /**
     * Writes value to Tag To Big To Fit In One Packet
     *
     * @param tag - Tag Object to Write. Used only for Structures.
     * @param value - If Omitted, Tag.value will be used
     * @param size - Number of tags to read used for arrays
     * @returns Promise resolved when complete
     */
    async _writeTagFragmented(tag: Structure, value: any = null, size: number = 0x01): Promise<void> {
        if(value) tag.value = value;
        let offset = 0;
        const maxPacket = 480 - tag.path.length;
        let valueFragment = tag.state.tag.value.slice(offset, maxPacket);
        let MR = tag.generateWriteMessageRequestFrag(offset, valueFragment, size);

        this.write_cip(MR);
        let numWrites = 0;
        let totalWrites = Math.ceil(tag.state.tag.value.length / maxPacket);
        const writeTagErr = new Error(`TIMEOUT occurred while writing Writing Tag: ${tag.name}.`);

        // Wait for Response
        await promiseTimeout(
            new Promise((resolve, reject) => {

                // Full Tag Writing
                this.on("Write Tag Fragmented", (err, data) => {
                    if (err) return reject(err);
                    offset += maxPacket;
                    numWrites ++;
                    if (numWrites < totalWrites) {
                        valueFragment = tag.state.tag.value.slice(offset, maxPacket + offset);
                        MR = tag.generateWriteMessageRequestFrag(offset, valueFragment, size);
                        this.write_cip(MR);
                    } else {
                        tag.unstageWriteRequest();
                        return resolve(data);
                    }            
                });
            }),
            this.state.timeout_sp,
            writeTagErr
        );

        this.removeAllListeners("Write Tag Fragmented");
    }
    /**
     * Reads All Tags in the Passed Tag Group
     *
     * @param group - Tag group instance
     * @returns Promise resolved when complete
     */
    async _readTagGroup(group: TagGroup): Promise<void> {
        const messages = group.generateReadMessageRequests();

        const readTagGroupErr = new Error("TIMEOUT occurred while writing Reading Tag Group.");

        // Send Each Multi Service Message
        for (let msg of messages) {
            this.write_cip(msg.data);
            // Wait for Controller to Respond
            const data = await promiseTimeout(
                new Promise((resolve, reject) => {
                    this.on("Multiple Service Packet", async (err, data) => {
                        if (err && err.generalStatusCode !== 6) reject(err);
                        for (let i = 0; i < data.length; i++) {
                            if (data[i].generalStatusCode === 6) {
                                await this._readTagFragmented(group.state.tags[msg.tag_ids[i]]).catch(reject);
                            }
                        }
                        
                        resolve(data);
                    });
                }),
                this.state.timeout_sp,
                readTagGroupErr
            );

            this.removeAllListeners("Multiple Service Packet");

            // Parse Messages
            group.parseReadMessageResponses(data, msg.tag_ids);
        }
    }

    /**
     * Writes to Tag Group Tags
     *
     * @param group - Tag Group instance
     * @returns Promise resolved when complete
     */
    async _writeTagGroup(group: TagGroup): Promise<void> {
        const messages = group.generateWriteMessageRequests();

        const writeTagGroupErr = new Error("TIMEOUT occurred while Writing Tag Group.");

        // Send Each Multi Service Message
        for (let msg of messages) {
            if (msg.data) {
                this.write_cip(msg.data);
                // Wait for Controller to Respond
                const data = await promiseTimeout(
                    new Promise((resolve, reject) => {
                        this.on("Multiple Service Packet", (err, data) => {
                            if (err) reject(err);
                            resolve(data);
                        });
                    }),
                    this.state.timeout_sp,
                    writeTagGroupErr
                );

                this.removeAllListeners("Multiple Service Packet");

                group.parseWriteMessageRequests(msg.tag_ids);
            } else {
                await this.writeTag(msg.tag).catch(e => {throw e;});
            }
        }
    }
    // endregion

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
     * @param srrd - Array of Common Packet Formatted Objects
     */
    _handleSendRRDataReceived(srrd: CommonPacketData[]): void {
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
            FORWARD_CLOSE,
            GET_FILE_DATA
        } = CIP.MessageRouter.services;

        let error = generalStatusCode !== 0 ? { generalStatusCode, extendedStatus } : null;

        // Route Incoming Message Responses
        /* eslint-disable indent */
        switch (service - 0x80) {
            case GET_FILE_DATA:
                this.emit("Get File Data", error, data);
                break;
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

    /**
     * Handles SendUnitData Event Emmitted by Parent and Routes
     * incoming Message
     *
     * @param sud - Array of Common Packet Formatted Objects
     */
    _handleSendUnitDataReceived(sud: CommonPacketData[]) {
        let sudnew = sud[1].data.subarray(2); // First 2 bytes are Connection sequence number
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
            FORWARD_CLOSE,
            GET_FILE_DATA
        } = CIP.MessageRouter.services;

        let error = generalStatusCode !== 0 ? { generalStatusCode, extendedStatus } : null;

        // Route Incoming Message Responses
        /* eslint-disable indent */
        switch (service - 0x80) {
            case GET_FILE_DATA:
                this.emit("Get File Data", error, data);
                break;
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

    // endregion

    /**
     * Get tag list tags that are not reserved tags
     * 
     * @returns Array of tag list items
     */
    get tagList(): tagListTag[] {
        return this.state.tagList.tags.filter(tag => (!tag.type.reserved));
    }

    /**
     * Get tag list templates
     * 
     * @returns List of templates indexed by tag name hash
     */
    get templateList(): tagListTemplates {
        return this.state.tagList.templates;
    }

    /**
     * Gets an arrays size (Not optimized)
     * 
     * @param tag - Tag instance
     * @returns 
     */
    async getTagArraySize(tag: Tag | Structure) {
        let i = 1;
        do {
            tag.state.read_size = i;
            try {
                await this.readTag(tag);
                i++; 
            }
            catch {
            } 
            
        }
        while (tag.state.read_size === (i-1));
        
        tag.state.tag.value = null;
        tag.state.tag.controllerValue = null;
        return tag.state.read_size;
    }

    /**
     * Helper function to add new tag to PLC tag group
     * 
     * @param tagname - Tag or Structure name 
     * @param program - PLC program name. null = Controller scope
     * @param subscribe - enable read and write when scanning
     * @param arrayDims - array dimension number
     * @param arraySize - array size
     * @returns tag or structure instance
     */
    newTag(tagname: string, program: string = null, subscribe: boolean = true, arrayDims: number = 0, arraySize: number = 0x01): Tag | Structure {
        let template = this.state.tagList.getTemplateByTag(tagname, program); 
        let tag = null;
        if (template) {
            tag = new Structure(tagname, this.state.tagList, program, null, 0, arrayDims, arraySize);
            if (subscribe)
                this.subscribe(tag);
            return tag;
        } else {
            tag = new Tag(tagname, program, null, 0, arrayDims, arraySize);
            if (subscribe)
                this.subscribe(tag);
            return tag;
        }
    }

    /**
     * Get tag or structure instance by name
     * 
     * @param name 
     * @returns 
     */
    getTagByName(name: string): Tag | Structure {
        return Object.values(this.state.subs.state.tags).find((tag) => tag.state.tag.name === name); 
    }
}

function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}

export default Controller;
