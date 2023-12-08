import TCPController from "../../tcp";
import SerialNumber from "./sna";
const EventEmitter = require("events");
import InputMap from "./inputmap";
import OutputMap from "./outputmap";

class Connection extends EventEmitter {
    constructor(port=2222, address, config, rpi=10, localAddress) {
        super();
        //this.tcpController = new TCPController(true, config.configInstance, config.outputInstance, config.inputInstance);
        this.connected = false;
        this.config = config;
        this.lastDataTime = 0;
        this.rpi = rpi;

        this.address = address;
        this.port = port;
        this.OTid = 0;
        this.TOid = 0;
        this.OTsize = config.outputInstance.size;
        this.TOsize = config.inputInstance.size;

        this.OTsequenceNum = 0;
        this.TOsequenceNum = 0;
        this.cipCount = 0;
 
        this.outputData = Buffer.alloc(this.OTsize);
        this.inputData = Buffer.alloc(this.TOsize);
        let that = this;
        this.localAddress = localAddress;
        this.run = true;
        this._connectTCP(that);

        this.inputMap = new InputMap();
        this.outputMap = new OutputMap();
        
        setInterval(() => that._checkStatus(that), 1000);
    }

    generateDataMessage() {
        let ioEnipPacket = Buffer.alloc(24);
        let ptr = 0;

        ioEnipPacket.writeUInt16LE(2); // Item Count
        ptr += 2;
        ioEnipPacket.writeUInt16LE(0x8002, ptr); //Sequenced Address Item
        ptr += 2;
        ioEnipPacket.writeUInt16LE(8, ptr); // Item Length
        ptr += 2;
        ioEnipPacket.writeUInt32LE(this.OTid, ptr); //Connection ID
        ptr += 4;
        ioEnipPacket.writeUInt32LE(this.OTsequenceNum, ptr); // Sequence Numtber
        ptr += 4;
        ioEnipPacket.writeUInt16LE(0x00b1, ptr); //Connected Data Item
        ptr += 2;
        ioEnipPacket.writeUInt16LE(6 + this.outputData.length, ptr); // Item Length
        ptr += 2;
        ioEnipPacket.writeUInt16LE(this.cipCount, ptr); // cip count
        ptr += 2;
        ioEnipPacket.writeUInt32LE(1, ptr); // 32-bit header
  
        return Buffer.concat([ioEnipPacket, this.outputData]);
    }

    send(socket) {
        this.OTsequenceNum ++;
        if (this.OTsequenceNum > 0xFFFFFFFF) this.OTsequenceNum = 0;
        if (this.run) socket.send(this.generateDataMessage(), this.port, this.address);
    }

    parseData(data, socket) {
        if (data.readUInt32LE(6) === this.TOid) {
            this.lastDataTime = Date.now();
            const seqAddr = data.readUInt32LE(10);
            if ( new SerialNumber(seqAddr,32).gt(new SerialNumber(this.TOsequenceNum, 32)) ) {
                this.TOsequenceNum = seqAddr;

                this.cipCount++;
                if (this.cipCount > 0xFFFF) this.cipCount = 0;
                this.send(socket);
                this.inputData = data.slice(20, 20 + this.TOsize);
            }
        } 
    }

    _connectTCP(that) {
        that.OTsequenceNum = 0;
        that.TOsequenceNum = 0;
        that.cipCount = 0;
        that.tcpController = new TCPController(true, that.config.configInstance, that.config.outputInstance, that.config.inputInstance);
        that.tcpController.rpi = that.rpi;
        that.tcpController.timeout_sp = 2000;
        that.tcpController.connect(that.address, 0, that.localAddress)
            .then ( () => {
                that.OTid = that.tcpController.OTconnectionID;
                that.TOid = that.tcpController.TOconnectionID;
            })
            .catch(() => {
                that.lastDataTime = 0;
                that.connected = false;
                setTimeout(() => that._connectTCP(that), that.rpi * 20);
            });
    }

    _checkStatus(that) {
        if (Date.now() - that.lastDataTime > that.tcpController.rpi * 4) {
            if (that.connected) {
                that.emit("disconnected", null);
                that.TOid = 0;
            }
            if (!that.tcpController.state.TCP.establishing && that.connected && that.run) setTimeout(() => that._connectTCP(that), that.rpi * 20);
            that.connected = false;
      
        } else {
            if(!that.connected) {
                that.emit("connected", null);
            }
            that.connected = true;
        }
    }

    addInputBit(byteOffset, bitOffset, name) {
        this.inputMap.addBit(byteOffset, bitOffset, name);
    }

    addInputInt(byteOffset, name) {
        this.inputMap.addInt(byteOffset, name);
    }

    addOutputBit(byteOffset, bitOffset, name) {
        this.outputMap.addBit(byteOffset, bitOffset, name);
    }

    addOutputInt(byteOffset, name) {
        this.outputMap.addInt(byteOffset, name);
    }

    listDataNames() {
        return {
            inputs: this.inputMap.mapping.map(map => map.name),
            outputs: this.outputMap.mapping.map(map => map.name)
        };
    }

    getValue(name) {
        return this.inputMap.getValue(name, this.inputData);
    }

    setValue(name, value) {
        this.outputData = this.outputMap.setValue(name, value, this.outputData);
    }

}

module.exports = Connection;