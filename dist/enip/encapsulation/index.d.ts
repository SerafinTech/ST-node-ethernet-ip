export type CommonPacketData = {
    /**
     * - Type of Item Encapsulated
     */
    TypeID: number;
    /**
     * - CIP Data Buffer
     */
    data: Buffer;
};
export type EncapsulationData = {
    /**
     * - Ecapsulation Command Code
     */
    commandCode: number;
    /**
     * - Encapsulation Command String Interpretation
     */
    command: string;
    /**
     * - Length of Encapsulated Data
     */
    length: number;
    /**
     * - Session ID
     */
    session: number;
    /**
     * - Status Code
     */
    statusCode: number;
    /**
     * - Status Code String Interpretation
     */
    status: string;
    /**
     * - Options (Typically 0x00)
     */
    options: number;
    /**
     * - Encapsulated Data Buffer
     */
    data: Buffer;
};
export namespace header {
    /**
     * Builds an ENIP Encapsolated Packet
     *
     * @param {number} cmd - Command to Send
     * @param {number} [session=0x00] - Session ID
     * @param {Buffer|Array} [data=[]] - Data to Send
     * @returns {Buffer} - Generated Buffer to be Sent to Target
     */
    function build(cmd: number, session?: number, data?: any[] | Buffer): Buffer;
    /**
     * Parses an Encapsulated Packet Received from ENIP Target
     *
     * @param {Buffer} buf - Incoming Encapsulated Buffer from Target
     * @returns {EncapsulationData} - Parsed Encapsulation Data Object
     */
    function parse(buf: Buffer): EncapsulationData;
}
export namespace CPF {
    namespace ItemIDs {
        const Null: number;
        const ListIdentity: number;
        const ConnectionBased: number;
        const ConnectedTransportPacket: number;
        const UCMM: number;
        const ListServices: number;
        const SockaddrO2T: number;
        const SockaddrT2O: number;
        const SequencedAddrItem: number;
    }
    /**
     * Checks if Command is a Valid Encapsulation Command
     *
     * @param {Number} ecapsulation command
     * @returns {boolean} test result
     */
    function isCmd(cmd: any): boolean;
    /**
     * Builds a Common Packet Formatted Buffer to be
     * Encapsulated.
     *
     * @param {Array} dataItems - Array of CPF Data Items
     * @returns {Buffer} CPF Buffer to be Encapsulated
     */
    function build(dataItems: any[]): Buffer;
    /**
     * Parses Incoming Common Packet Formatted Buffer
     * and returns an Array of Objects.
     *
     * @param {Buffer} buf - Common Packet Formatted Data Buffer
     * @returns {Array} Array of Common Packet Data Objects
     */
    function parse(buf: Buffer): any[];
}
/**
 * Checks if Command is a Valid Encapsulation Command
 *
 * @param {Number} ecapsulation command
 * @returns {boolean} test result
 */
export function validateCommand(cmd: any): boolean;
export namespace commands {
    export const NOP: number;
    const ListServices_1: number;
    export { ListServices_1 as ListServices };
    const ListIdentity_1: number;
    export { ListIdentity_1 as ListIdentity };
    export const ListInterfaces: number;
    export const RegisterSession: number;
    export const UnregisterSession: number;
    export const SendRRData: number;
    export const SendUnitData: number;
    export const IndicateStatus: number;
    export const Cancel: number;
}
/**
 * Parses Encapulation Status Code to Human Readable Error Message.
 *
 * @param {number} status - Status Code
 * @returns {string} Human Readable Error Message
 */
export function parseStatus(status: number): string;
/**
 * Returns a Register Session Request String
 *
 * @returns {string} register session string
 */
export function registerSession(): string;
/**
 * Returns an Unregister Session Request String
 *
 * @param {number} session - Encapsulation Session ID
 * @returns {string} unregister seeion strings
 */
export function unregisterSession(session: number): string;
/**
 * Returns a UCMM Encapsulated Packet String
 *
 * @param {number} session - Encapsulation Session ID
 * @param {Buffer} data - Data to be Sent via UCMM
 * @param {number} [timeout=10] - Timeout (sec)
 * @returns {string} UCMM Encapsulated Message String
 */
export function sendRRData(session: number, data: Buffer, timeout?: number): string;
/**
 * Returns a Connected Message Datagram (Transport Class 3) String
 *
 * @param {number} session - Encapsulation Session ID
 * @param {Buffer} data - Data to be Sent via Connected Message
 * @param {number} ConnectionID - Connection ID from FWD_OPEN
 * @param {number} SequenceNumber - Sequence Number of Datagram
 * @returns {string} Connected Message Datagram String
 */
export function sendUnitData(session: number, data: Buffer, ConnectionID: number, SequnceNumber: any): string;
//# sourceMappingURL=index.d.ts.map