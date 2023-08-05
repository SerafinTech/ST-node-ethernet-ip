import TCPController from "../../tcp";
import SerialNumber from "./sna";
const EventEmitter = require("events");
import InputMap from "./inputmap";
import OuputMap from "./outputmap";

class Connection extends EventEmitter {
    constructor(port=2222, address, config, rpi=10) {
        super();
        this.tcpController = new TCPController(true, config.configInstance, config.outputInstance, config.inputInstance);
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
    
        this._connectTCP();

        this.inputMap = new InputMap();
        this.outputMap = new OuputMap();
        this.run = true;

        setInterval(this._checkStatus.bind(this), 1000);
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

    _connectTCP() {
        this.OTsequenceNum = 0;
        this.TOsequenceNum = 0;
        this.cipCount = 0;
        this.tcpController = new TCPController(true, this.config.configInstance, this.config.outputInstance, this.config.inputInstance);
        this.tcpController.rpi = this.rpi;
        this.tcpController.timeout_sp = 2000;
        this.tcpController.connect(this.address, 0)
            .then ( () => {
                this.OTid = this.tcpController.OTconnectionID;
                this.TOid = this.tcpController.TOconnectionID;
            })
            .catch(() => {
                this.lastDataTime = 0;
                this.connected = false;
                setTimeout(() => this._connectTCP(), this.rpi * 20);
            });
    }

    _checkStatus() {
        if (Date.now() - this.lastDataTime > this.tcpController.rpi * 4) {
            if (this.connected) {
                this.emit("disconnected", null);
                this.TOid = 0;
            }
            if (!this.tcpController.state.TCP.establishing && this.connected && this.run) setTimeout(() => this._connectTCP(), this.rpi * 20);
            this.connected = false;
      
        } else {
            if(!this.connected) {
                this.emit("connected", null);
            }
            this.connected = true;
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