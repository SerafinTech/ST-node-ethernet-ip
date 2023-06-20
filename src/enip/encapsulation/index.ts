const commands = {
    NOP: 0x00,
    ListServices: 0x04,
    ListIdentity: 0x63,
    ListInterfaces: 0x64,
    RegisterSession: 0x65, // Begin Session Command
    UnregisterSession: 0x66, // Close Session Command
    SendRRData: 0x6f, // Send Unconnected Data Command
    SendUnitData: 0x70, // Send Connnected Data Command
    IndicateStatus: 0x72,
    Cancel: 0x73
};

// region Validation Helper Functions

/**
 * Parses Encapulation Status Code to Human Readable Error Message.
 *
 * @param status - Status Code
 * @returns Human Readable Error Message
 */
const parseStatus = (status: number): string => {
    if (typeof status !== "number") throw new Error("parseStatus accepts type <Number> only!");

    /* eslint-disable indent */
    switch (status) {
        case 0x00:
            return "SUCCESS";
        case 0x01:
            return "FAIL: Sender issued an invalid ecapsulation command.";
        case 0x02:
            return "FAIL: Insufficient memory resources to handle command.";
        case 0x03:
            return "FAIL: Poorly formed or incorrect data in encapsulation packet.";
        case 0x64:
            return "FAIL: Originator used an invalid session handle.";
        case 0x65:
            return "FAIL: Target received a message of invalid length.";
        case 0x69:
            return "FAIL: Unsupported encapsulation protocol revision.";
        default:
            return `FAIL: General failure <${status}> occured.`;
    }
    /* eslint-enable indent */
};

/**
 * Checks if Command is a Valid Encapsulation Command
 *
 * @param cmd - Encapsulation command
 * @returns test result
 */
const validateCommand = (cmd: number): boolean => {
    for (let key of Object.keys(commands)) {
        if (cmd === commands[key]) return true;
    }
    return false;
};
// endregion

// region Compact Packet Format

type CommonPacketData = {
    TypeID: number, 
    data: Buffer,   
    length: number 
}

let CPF = {
    ItemIDs:{
        Null: 0x00,
        ListIdentity: 0x0c,
        ConnectionBased: 0xa1,
        ConnectedTransportPacket: 0xb1,
        UCMM: 0xb2,
        ListServices: 0x100,
        SockaddrO2T: 0x8000,
        SockaddrT2O: 0x8001,
        SequencedAddrItem: 0x8002
    },

    /**
     * Checks if Command is a Valid Encapsulation Command
     *
     * @param cmd - Encapsulation command
     * @returns test result
     */
    isCmd: (cmd: number): boolean => {
        for (let key of Object.keys(CPF.ItemIDs)) {
            if (cmd === CPF.ItemIDs[key]) return true;
        }
        return false; 
    },

    /**
     * Builds a Common Packet Formatted Buffer to be
     * Encapsulated.
     *
     * @param dataItems - Array of CPF Data Items
     * @returns CPF Buffer to be Encapsulated
     */
    build: (dataItems: CommonPacketData[]): Buffer => {
        // Write Item Count and Initialize Buffer
        let buf = Buffer.alloc(2);
        buf.writeUInt16LE(dataItems.length, 0);

        for (let item of dataItems) {
            const { TypeID, data } = item;

            if (!CPF.isCmd(TypeID)) throw new Error("Invalid CPF Type ID!");

            let buf1 = Buffer.alloc(4);
            let buf2 = Buffer.from(data);

            buf1.writeUInt16LE(TypeID, 0);
            buf1.writeUInt16LE(buf2.length, 2);

            buf = buf2.length > 0 ? Buffer.concat([buf, buf1, buf2]) : Buffer.concat([buf, buf1]);
        }

        return buf;
    },

    /**
    * Parses Incoming Common Packet Formatted Buffer
    * and returns an Array of Objects.
    *
    * @param {Buffer} buf - Common Packet Formatted Data Buffer
    * @returns {Array} Array of Common Packet Data Objects
    */
    parse: (buf: Buffer): CommonPacketData[] => {
        const itemCount = buf.readUInt16LE(0);

        let ptr = 2;
        let arr: CommonPacketData[] = [];

        for (let i = 0; i < itemCount; i++) {
            // Get Type ID
            const TypeID = buf.readUInt16LE(ptr);
            ptr += 2;

            // Get Data Length
            const length = buf.readUInt16LE(ptr);
            ptr += 2;

            // Get Data from Data Buffer
            const data = Buffer.alloc(length);
            buf.copy(data, 0, ptr, ptr + length);

            // Append Gathered Data Object to Return Array
            arr.push({ TypeID, length, data});

            ptr += length;
        }

        return arr;
    }
};

// endregion

// region Header Assemble Method Definitions

type EncapsulationData = {
    commandCode: number,    // Ecapsulation Command Code
    command: string,        // Encapsulation Command String Interpretation
    length: number,         // Length of Encapsulated Data
    session: number,        // Session ID
    statusCode: number,     // Status Code
    status: string,         // Status Code String Interpretation
    options: number,        // Options (Typically 0x00)
    data: Buffer            // Encapsulated Data Buffer
}

let header = {
    /**
     * Builds an ENIP Encapsolated Packet
     *
     * @param cmd - Command to Send
     * @param session - Session ID
     * @param data - Data to Send
     * @returns  Generated Buffer to be Sent to Target
     */
    build: (cmd: number, session: number = 0x00, data: Buffer | [] = []): Buffer => {
        // Validate requested command
        if (!validateCommand(cmd)) throw new Error("Invalid Encapsulation Command!");

        const buf = Buffer.from(data);
        
        // Initialize header buffer to appropriate length
        let header = Buffer.alloc(24 + buf.length, 0);

        // Build header from encapsulation data
        header.writeUInt16LE(cmd, 0);
        header.writeUInt16LE(buf.length, 2);
        header.writeUInt32LE(session, 4);       
        buf.copy(header, 24);

        return header;
    },
    
    /**
     * Parses an Encapsulated Packet Received from ENIP Target
     *
     * @param buf - Incoming Encapsulated Buffer from Target
     * @returns Parsed Encapsulation Data Object
     */
    parse: (buf: Buffer): EncapsulationData => {
        if (!Buffer.isBuffer(buf)) throw new Error("header.parse accepts type <Buffer> only!");

        const received = {
            commandCode: buf.readUInt16LE(0),
            command: null,
            length: buf.readUInt16LE(2),
            session: buf.readUInt32LE(4),
            statusCode: buf.readUInt32LE(8),
            status: null,
            options: buf.readUInt32LE(20),
            data: null
        };

        // Get Returned Encapsulated Data
        let dataBuffer = Buffer.alloc(received.length);
        buf.copy(dataBuffer, 0, 24);

        received.data = dataBuffer;
        received.status = parseStatus(received.statusCode);

        for (let key of Object.keys(commands)) {
            if (received.commandCode === commands[key]) {
                received.command = key;
                break;
            }
        }

        return received;
    },
    

};

// endregion

// region Common Command Helper Build Funtions

/**
 * Returns a Register Session Request String
 *
 * @returns register session buffer
 */
const registerSession = (): Buffer => {
    const { RegisterSession } = commands;
    const { build } = header;
    const cmdBuf = Buffer.alloc(4);
    cmdBuf.writeUInt16LE(0x01, 0); // Protocol Version (Required to be 1)
    cmdBuf.writeUInt16LE(0x00, 2); // Opton Flags (Reserved for Future List)

    // Build Register Session Buffer and return it
    return build(RegisterSession, 0x00, cmdBuf);
};

/**
 * Returns an Unregister Session Request String
 *
 * @param session - Encapsulation Session ID
 * @returns unregister session buffer
 */
const unregisterSession = (session: number):Buffer => {
    const { UnregisterSession } = commands;
    const { build } = header;

    // Build Unregister Session Buffer
    return build(UnregisterSession, session);
};

/**
 * Returns a UCMM Encapsulated Packet String
 *
 * @param session - Encapsulation Session ID
 * @param data - Data to be Sent via UCMM
 * @param timeout - Timeout (sec)
 * @returns UCMM Encapsulated Message Buffer
 */
const sendRRData = (session: number, data: Buffer, timeout: number = 10): Buffer => {
    const { SendRRData } = commands;

    let timeoutBuf = Buffer.alloc(6);
    timeoutBuf.writeUInt32LE(0x00, 0); // Interface Handle ID (Shall be 0 for CIP)
    timeoutBuf.writeUInt16LE(timeout, 4); // Timeout (sec)

    // Enclose in Common Packet Format
    let buf = CPF.build([
        { TypeID: CPF.ItemIDs.Null, data: Buffer.from([]), length: undefined},
        { TypeID: CPF.ItemIDs.UCMM, data: data, length: undefined}
    ]);

    // Join Timeout Data with
    buf = Buffer.concat([timeoutBuf, buf]);

    // Build SendRRData Buffer
    return header.build(SendRRData, session, buf);
};

/**
 * Returns a Connected Message Datagram (Transport Class 3) String
 *
 * @param {number} session - Encapsulation Session ID
 * @param {Buffer} data - Data to be Sent via Connected Message
 * @param {number} ConnectionID - Connection ID from FWD_OPEN
 * @param {number} SequenceNumber - Sequence Number of Datagram
 * @returns Connected Message Datagram Buffer
 */
const sendUnitData = (session: number, data: Buffer, ConnectionID: number, SequnceNumber: number): Buffer => {
    const { SendUnitData } = commands;

    let timeoutBuf = Buffer.alloc(6);
    timeoutBuf.writeUInt32LE(0x00, 0); // Interface Handle ID (Shall be 0 for CIP)
    timeoutBuf.writeUInt16LE(0x00, 4); // Timeout (sec) (Shall be 0 for Connected Messages)

    // Enclose in Common Packet Format
    const seqAddrBuf = Buffer.alloc(4);
    seqAddrBuf.writeUInt32LE(ConnectionID, 0);
    const seqNumberBuf = Buffer.alloc(2);
    seqNumberBuf.writeUInt16LE(SequnceNumber, 0);
    const ndata = Buffer.concat([
        seqNumberBuf,
        data
    ]);

    let buf = CPF.build([
        {
            TypeID: CPF.ItemIDs.ConnectionBased,
            data: seqAddrBuf,
            length: undefined
        },
        {
            TypeID: CPF.ItemIDs.ConnectedTransportPacket,
            data: ndata,
            length: undefined
        }
    ]);

    // Join Timeout Data with
    buf = Buffer.concat([timeoutBuf, buf]);

    // Build SendRRData Buffer
    return header.build(SendUnitData, session, buf);
};
// endregion

export {
    header,
    CPF,
    validateCommand,
    commands,
    parseStatus,
    registerSession,
    unregisterSession,
    sendRRData,
    sendUnitData,
    EncapsulationData,
    CommonPacketData
};
