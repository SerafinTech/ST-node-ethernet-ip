import * as EthernetIP from "../enip"; 
import dgram, { Socket } from "dgram";
import { EventEmitter } from "events";

const listIdentityRequest = EthernetIP.encapsulation.header.build(EthernetIP.encapsulation.commands.ListIdentity);

type browserDevice = {
    EncapsulationVersion: number,
    socketAddress: {
        sin_family: number,
        sin_port: number,
        sin_addr: string,
        sin_zero: Buffer
    },
    vendorID: number,
    deviceType: number,
    productCode: number,
    revision: string,
    status: number,
    serialNumber: string,
    productName: string,
    state: number,
    timestamp: number
}

export declare interface Browser extends EventEmitter {
    socket: Socket;
    originatorIPaddress: string;
    autoBrowse: boolean;
    updateRate: number;
    disconnectMultiplier: number;
    deviceList: browserDevice[];
    updateInterval: NodeJS.Timer;
    on(event: 'New Device', listener: (device: browserDevice) => {}): this;
    on(event: 'Broadcast Request', listener: () => {}): this;
    on(event: 'Device Disconnected', listener: (device: browserDevice) => {}): this;
    on(event: 'Device List Updated', listener: (deviceList: browserDevice[]) => {}): this;
    on(event: string, listener: Function): this;
}

export class Browser extends EventEmitter{
    constructor(originatorPort: number=51687, originatorIPaddress: string="0.0.0.0", autoBrowse: boolean=true, updateRate: number=3000, disconnectMultiplier: number=4) {
        super();
        this.socket = dgram.createSocket("udp4");
        this.originatorIPaddress = originatorIPaddress;
        this.autoBrowse = autoBrowse;
        this.updateRate = updateRate;
        this.disconnectMultiplier = disconnectMultiplier;
        this.deviceList = [];

        this.socket.bind(originatorPort, originatorIPaddress, () => {
            this.socket.setBroadcast(true);
            if(this.autoBrowse) this.start();
        });

        this._setupSocketEvents();

        this.updateInterval = null;

    }

    start() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        this.deviceList.forEach( (dev, i) => {
            this.deviceList[i].timestamp = Date.now();
        });

        this.updateInterval = setInterval(() => {
            this.checkStatus();
            this.socket.send(listIdentityRequest, 44818, "255.255.255.255", (e) => {
                if (e) throw e;
                this.emit("Broadcast Request");
            });
        }, this.updateRate);
    }

    stop() {
        clearInterval(this.updateInterval);
    }

    checkStatus() {

        let deviceDisconnected = false;
        this.deviceList.forEach(device => {
            if ( (Date.now() - device.timestamp) > (this.updateRate * this.disconnectMultiplier) ) {
                this.emit("Device Disconnected", device);
                deviceDisconnected = true;
            }
        });

        this.deviceList = this.deviceList.filter(device => (Date.now() - device.timestamp) <= (this.updateRate * this.disconnectMultiplier));
        if (deviceDisconnected) this.emit("Device List Updated", this.deviceList);

    }

    _setupSocketEvents() {
        this.socket.on("message", msg => {
            const device = this._parseListIdentityResponse(msg);            
            if(Object.keys(device).length !== 0)
                this._addDevice(device);    // Device is added only if device is not empty object
        });
   
    }

    _parseListIdentityResponse(msg) {

        let response: browserDevice = {
            EncapsulationVersion: undefined,
            socketAddress: {
                sin_family: undefined,
                sin_port: undefined,
                sin_addr: undefined,
                sin_zero: undefined
            },
            vendorID: undefined,
            deviceType: undefined,
            productCode: undefined,
            revision: undefined,
            status: undefined,
            serialNumber: undefined,
            productName: undefined,
            state: undefined,
            timestamp: undefined
        };

        const messageData = EthernetIP.encapsulation.header.parse(msg);
        
        // Check if messageData is not undefined
        if (messageData !== undefined) {
            // Check if messageData.data is not undefined
            if (messageData.data !== undefined) {
                // Check if messageData.data has a congruent length
                if (messageData.data.length >= 2) {            
                    const cpf = EthernetIP.encapsulation.CPF.parse(messageData.data);
                    // Check if cpf is not undefined
                    if (cpf !== undefined) {
                        // Check if cpf is an array
                        if (Array.isArray(cpf)) {
                            // Check if cpf[0] is not undefined
                            if (cpf[0] !== undefined) {
                                const data = cpf[0].data;
                                let ptr = 0;
                                
                                response.EncapsulationVersion = data.readUInt16LE(ptr);
                                ptr += 2;
                                response.socketAddress.sin_family = data.readUInt16BE(ptr);
                                ptr += 2;
                                response.socketAddress.sin_port = data.readUInt16BE(ptr);
                                ptr += 2;
                                response.socketAddress.sin_addr = data.readUInt8(ptr).toString() + "." + data.readUInt8(ptr + 1).toString() + "." + data.readUInt8(ptr + 2).toString() + "." + data.readUInt8(ptr + 3).toString();
                                ptr += 4;
                                response.socketAddress.sin_zero = data.slice(ptr, ptr + 8);
                                ptr += 8;
                                response.vendorID = data.readUInt16LE(ptr);
                                ptr += 2;
                                response.deviceType = data.readUInt16LE(ptr);
                                ptr += 2;
                                response.productCode = data.readUInt16LE(ptr);
                                ptr += 2;
                                response.revision = data.readUInt8(ptr).toString() + "." + data.readUInt8(ptr + 1).toString();
                                ptr += 2;
                                response.status = data.readUInt16LE(ptr);
                                ptr += 2;
                                response.serialNumber = "0x" + data.readUInt32LE(ptr).toString(16);
                                ptr += 4;
                                response.productName = data.slice(ptr + 1, ptr + 1 + data.readUInt8(ptr)).toString();
                                ptr += (1 + data.readUInt8(ptr));
                                response.state = data.readUInt8(ptr);
                            }
                        }
                    }
                }
            }
        }

        return response;
    }

    _addDevice(device) {
        const index = this.deviceList.findIndex(item => item.socketAddress.sin_addr === device.socketAddress.sin_addr);
    
        device.timestamp = Date.now();
    
        if(index > -1) {
            this.deviceList[index] = device;
        } else {
            this.deviceList.push(device);
            this.emit("New Device", device);
            this.emit("Device List Updated", this.deviceList);
        }
    }

}

export default Browser;
