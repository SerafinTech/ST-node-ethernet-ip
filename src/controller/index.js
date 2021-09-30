const { ENIP, CIP } = require("../enip");
const dateFormat = require("dateformat");
const TagGroup = require("../tag-group");
const { delay, promiseTimeout } = require("../utilities");
const TagList = require("../tag-list");
const {Structure} = require("../structure")
const Queue = require("task-easy");
const Tag = require("../tag");

const compare = (obj1, obj2) => {
    if (obj1.priority > obj2.priority) return true;
    else if (obj1.priority < obj2.priority) return false;
    else return obj1.timestamp.getTime() < obj2.timestamp.getTime();
};

class Controller extends ENIP {

    /**
     * 
     * @param {boolean} [connectedMessaging=true] whether to use connected or unconnected messaging
     * @param {object} [opts]
     * @param {number} [opts.unconnectedSendTimeout=2000]
     */
    constructor(connectedMessaging = true, opts = {}) {
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
                faulted: false,
                minorRecoverableFault: false,
                minorUnrecoverableFault: false,
                majorRecoverableFault: false,
                majorUnrecoverableFault: false,
                io_faulted: false
            },
            subs: new TagGroup(compare),
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
     * @memberof Controller
     * @returns {number} ms
     */
    get scan_rate() {
        return this.state.scan_rate;
    }

    /**
     * Sets the Subsciption Group Scan Rate
     *
     * @memberof Controller
     */
    set scan_rate(rate) {
        if (typeof rate !== "number") throw new Error("scan_rate must be of Type <number>");
        this.state.scan_rate = Math.trunc(rate);
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
     * @override
     * @param {string} IP_ADDR - IPv4 Address (can also accept a FQDN, provided port forwarding is configured correctly.)
     * @param {number} SLOT - Controller Slot Number (0 if CompactLogix)
     * @returns {Promise}
     * @memberof ENIP
     */
    async connect(IP_ADDR, SLOT = 0) {
        const { PORT } = CIP.EPATH.segments;
        const BACKPLANE = 1;

        this.state.controller.slot = SLOT;
        this.state.controller.path = PORT.build(BACKPLANE, SLOT);

        const sessid = await super.connect(IP_ADDR);
        if (!sessid) throw new Error("Failed to Register Session with Controller");
        
        this._initializeControllerEventHandlers(); // Connect sendRRData Event

        if (this.state.connectedMessaging === true) {
            const connid = await this.forwardOpen();
            if(!connid) throw new Error("Failed to Establish Forward Open Connection with Controller");
        }

        // Fetch Controller Properties and Wall Clock
        await this.readControllerProps();

        await this.getControllerTagList(this.state.tagList)
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
        const MR = CIP.MessageRouter.build(FORWARD_OPEN, cmPath, []);

        // Create connection parameters
        const params = CIP.ConnectionManager.build_connectionParameters(owner["Exclusive"], connectionType["PointToPoint"],priority["Low"],fixedVar["Variable"],500);
        this.state.fwd_open_serial = getRandomInt(32767);
        const forwardOpenData = CIP.ConnectionManager.build_forwardOpen(this.state.rpi * 1000, params, 1000 , 32, this.state.fwd_open_serial);

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
        const MR = CIP.MessageRouter.build(FORWARD_CLOSE, cmPath, []);

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
    write_cip(data, timeout = 10, cb = null) {
        const { UnconnectedSend } = CIP;
        let msg;
        const connected = super.established_conn;
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
        const MR = CIP.MessageRouter.build(GET_ATTRIBUTE_ALL, identityPath, []);

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

    /**
     * Reads the Controller Wall Clock Object
     *
     * @memberof Controller
     * @returns {Promise}
     */
    async readWallClock() {
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
        const MR = CIP.MessageRouter.build(GET_ATTRIBUTE_SINGLE, identityPath, []);

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

        const date = new Date(...wallClockArray);
        this.state.controller.time = date;
    }

    /**
     * Write to PLC Wall Clock
     *
     * @param {Date} [date=new Date()]
     * @memberof Controller
     * @returns {Promise}
     */
    async writeWallClock(date = new Date()) {
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
     * @param {Tag} tag - Tag Object to Write
     * @param {number} [size=null]
     * @returns {Promise}
     * @memberof Controller
     */
    readTag(tag, size = null) {
        return this.workers.read.schedule(this._readTag.bind(this), [tag, size], {
            priority: 1,
            timestamp: new Date()
        });
    }

    /**
     * Writes value to Tag
     *
     * @param {Tag} tag - Tag Object to Write
     * @param {number|boolean|object|string} [value=null] - If Omitted, Tag.value will be used
     * @param {number} [size=0x01]
     * @returns {Promise}
     * @memberof Controller
     */
    writeTag(tag, value = null, size = 0x01) {
        if(tag.writeObjToValue) { tag.writeObjToValue() }
        return this.workers.write.schedule(this._writeTag.bind(this), [tag, value, size], {
            priority: 1,
            timestamp: new Date()
        });
    }

    /**
     * Reads All Tags in the Passed Tag Group
     *
     * @param {TagGroup} group
     * @returns {Promise}
     * @memberof Controller
     */
    readTagGroup(group) {
        return this.workers.group.schedule(this._readTagGroup.bind(this), [group], {
            priority: 1,
            timestamp: new Date()
        });
    }

    /**
     * Writes to Tag Group Tags
     *
     * @param {TAgGroup} group
     * @returns {Promise}
     * @memberof Controller
     */
    writeTagGroup(group) {
        return this.workers.group.schedule(this._writeTagGroup.bind(this), [group], {
            priority: 1,
            timestamp: new Date()
        });
    }

    /**
     * Adds Tag to Subscription Group
     *
     * @param {Tagany} tag
     * @memberof Controller
     */
    subscribe(tag) {
        this.state.subs.add(tag);
    }

    /**
     * Begin Scanning Subscription Group
     *
     * @memberof Controller
     */
    async scan() {
        this.state.scanning = true;

        while (this.state.scanning) {
            await this.workers.group
                .schedule(this._readTagGroup.bind(this), [this.state.subs], {
                    priority: 10,
                    timestamp: new Date()
                })
                .catch(e => {
                    return Promise.reject(e)
                });

            await this.workers.group
                .schedule(this._writeTagGroup.bind(this), [this.state.subs], {
                    priority: 10,
                    timestamp: new Date()
                })
                .catch(e => {
                    return Promise.reject(e)
                });

            await delay(this.state.scan_rate);
        }

        return Promise.resolve()
    }

    /**
     * Pauses Scanning of Subscription Group
     *
     * @memberof Controller
     */
    pauseScan() {
        this.state.scanning = false;
    }

    /**
     * Iterates of each tag in Subscription Group
     *
     * @param {function} callback
     * @memberof Controller
     */
    forEach(callback) {
        this.state.subs.forEach(callback);
    }

    async getControllerTagList(tagList, program = null) {
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

    /**
     * Reads Value of Tag and Type from Controller
     *
     * @param {Tag} tag - Tag Object to Write
     * @param {number} [size=null]
     * @returns {Promise}
     * @memberof Controller
     */
    async _readTag(tag, size = null) {
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
                        this._readTag(tag).catch(reject)
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
     * @param {Tag} tag - Tag Object to Write
     * @param {number} [size=null]
     * @returns {Promise}
     * @memberof Controller
     */
    async _readTagFragmented(tag, size = null) {

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
     * @param {Tag} tag - Tag Object to Write
     * @param {number|boolean|object|string} [value=null] - If Omitted, Tag.value will be used
     * @param {number} [size=0x01]
     * @returns {Promise}
     * @memberof Controller
     */
    async _writeTag(tag, value = null, size = 0x01) {
        if (tag.state.tag.value.length > (480 - tag.path.length))
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
     * @param {Tag} tag - Tag Object to Write
     * @param {number|boolean|object|string} [value=null] - If Omitted, Tag.value will be used
     * @param {number} [size=0x01]
     * @returns {Promise}
     * @memberof Controller
     */
    async _writeTagFragmented(tag, value = null, size = 0x01) {
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
     * @param {TagGroup} group
     * @returns {Promise}
     * @memberof Controller
     */
    async _readTagGroup(group) {
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
     * @param {TagGroup} group
     * @returns {Promise}
     * @memberof Controller
     */
    async _writeTagGroup(group) {
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

                group.parseWriteMessageRequests(data, msg.tag_ids);
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


    get tagList() {
        return this.state.tagList.tags.filter(tag => (!tag.type.reserved))
    }

    get templateList() {
        return this.state.tagList.templates
    }

    async getTagArraySize(tag) {
        let i = 1;
        while (true) {
            tag.state.read_size = i
            await this.readTag(tag) 
            if (tag.state.read_size !== i) 
                break;
            i++
        }

        return tag.state.read_size
    }

    newTag(tagname, program = null, subscribe = true, arrayDims = 0, arraySize = 0x01) {
        let template = this.state.tagList.getTemplateByTag(tagname, program); 
        let tag = null
        if (template) {
            tag = new Structure(tagname, this.state.tagList, program, null, 0, arrayDims, arraySize)
            if (subscribe)
                this.subscribe(tag)
            return tag
        } else {
            tag = new Tag(tagname, program, null, 0, arrayDims, arraySize)
            if (subscribe)
                this.subscribe(tag)
            return tag
        }
    }

    getTagByName(name) {
        return Object.values(this.state.subs.state.tags).find(({state}) => state.tag.name === name) 
    }
}

function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}

module.exports = Controller;
