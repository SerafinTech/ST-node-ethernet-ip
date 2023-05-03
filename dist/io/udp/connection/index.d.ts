export = Connection;
declare class Connection extends EventEmitter {
    constructor(port: number, address: any, config: any, rpi?: number);
    tcpController: TCPController;
    connected: boolean;
    config: any;
    lastDataTime: number;
    rpi: number;
    address: any;
    port: number;
    OTid: number;
    TOid: number;
    OTsize: any;
    TOsize: any;
    OTsequenceNum: number;
    TOsequenceNum: number;
    cipCount: number;
    outputData: Buffer;
    inputData: Buffer;
    inputMap: InputMap;
    outputMap: OuputMap;
    generateDataMessage(): Buffer;
    send(socket: any): void;
    parseData(data: any, socket: any): void;
    _connectTCP(): void;
    _checkStatus(): void;
    addInputBit(byteOffset: any, bitOffset: any, name: any): void;
    addInputInt(byteOffset: any, name: any): void;
    addOutputBit(byteOffset: any, bitOffset: any, name: any): void;
    addOutputInt(byteOffset: any, name: any): void;
    listDataNames(): {
        inputs: any[];
        outputs: any[];
    };
    getValue(name: any): any;
    setValue(name: any, value: any): void;
    override on(eventName: "disconnected" | "connected" , listener: (...args: any[]) => void): this;
}
import EventEmitter = require("events");
import TCPController = require("../../tcp");
import InputMap = require("./inputmap");
import OuputMap = require("./outputmap");
//# sourceMappingURL=index.d.ts.map