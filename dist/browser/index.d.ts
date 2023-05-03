/// <reference types="node" />
export = Browser;

declare class Browser extends EventEmitter {
    constructor(originatorPort?: number, originatorIPaddress?: string, autoBrowse?: boolean, updateRate?: number, disconnectMultiplier?: number);
    socket: dgram.Socket;
    originatorIPaddress: string;
    autoBrowse: boolean;
    updateRate: number;
    disconnectMultiplier: number;
    deviceList: any[];
    updateInterval: NodeJS.Timer;
    listIdentityRequest: Buffer;
    start(): void;
    stop(): void;
    checkStatus(): void;
    _setupSocketEvents(): void;
    _parseListIdentityResponse(msg: any): {
        EncapsulationVersion: any;
        socketAddress: {
            sin_family: any;
            sin_port: any;
            sin_addr: string;
            sin_zero: any;
        };
        vendorID: any;
        deviceType: any;
        productCode: any;
        revision: string;
        status: any;
        serialNumber: string;
        productName: any;
        state: any;
    };
    _addDevice(device: any): void;
    override on(eventName: "Broadcast Request" | "Device Disconnected" | "Device List Updated" | "New Device", listener: (...args: any[]) => void): this;
}
import { EventEmitter } from "events";
import dgram = require("dgram");
//# sourceMappingURL=index.d.ts.map