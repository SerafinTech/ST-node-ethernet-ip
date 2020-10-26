const EthernetIP = require("../enip"); 
const dgram = require("dgram");
const { EventEmitter } = require("events");


class Browser extends EventEmitter{
    constructor(originatorPort=51687, originatorIPaddress="0.0.0.0", autoBrowse=true, updateRate=3000, disconnectMultiplier=4) {
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

        this.listIdentityRequest = EthernetIP.encapsulation.header.build(EthernetIP.encapsulation.commands.ListIdentity);
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
            this.socket.send(this.listIdentityRequest, 44818, "255.255.255.255", (e) => {
                if (e) throw e;
                this.emit("Broadcast Request", null);
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
            this._addDevice(device);
        });
   
    }

    _parseListIdentityResponse(msg) {

        const messageData = EthernetIP.encapsulation.header.parse(msg);
    
        const cpf = EthernetIP.encapsulation.CPF.parse(messageData.data);
        const data = cpf[0].data;
        let response = {};
        let ptr = 0;

        response.EncapsulationVersion = data.readUInt16LE(ptr);
        ptr += 2;
        response.socketAddress = {};
        response.socketAddress.sin_family = data.readUInt16BE(ptr);
        ptr += 2;
        response.socketAddress.sin_port = data.readUInt16BE(ptr);
        ptr += 2;
        response.socketAddress.sin_addr = data.readUInt8(ptr).toString() + "." + data.readUInt8(ptr + 1).toString() + "." + data.readUInt8(ptr + 2).toString() + "." + data.readUInt8(ptr + 3).toString();
        ptr += 4;
        response.socketAddress.sin_zero = data.slice(ptr,ptr + 8);
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

module.exports = Browser;