import { fork } from 'child_process';
import path from 'path';

const program = path.resolve(__dirname,'./child.js');

const parameters = [];
const options = {
    stdio: ['pipe', 'pipe', 'pipe', 'ipc']
};

const child = fork(program, parameters, options)

class forkConnection {
    constructor(config, rpi, address, child) {
        this.inputData = Buffer.alloc(config.inputInstance.size);
        this.outputData = Buffer.alloc(config.outputInstance.size);
        this.lastOutputData = Buffer.alloc(config.outputInstance.size);
        this.address = address;
        this.rpi = rpi;
        this.connected = false;
        this.lastRun = true;
        this.run = true;
        this.child = child;
        this.scan = setInterval(this._checkChanges, rpi);

    }

    _checkChanges() {
        if (Buffer.compare(this.outputData, this.lastOutputData) !== 0) {
            this.outputData.copy(this.lastOutputData);
            this.child.send({
                type: 'outputData',
                address: this.address,
                data: this.outputData
            })
        }

        if(this.lastRun !== this.run) {
            this.child.send({
                type: 'run',
                data: this.run,
                address: this.address
            })
        }
    }
    
}

class forkScanner {
    constructor(port=2222, localAddress='0.0.0.0' ) {
        parameters.push(port.toString());
        parameters.push(localAddress);
        this.child = fork(program, parameters, options);
        this.connections = {};
        this.child.on('message', this._onMessage);
    }

    addConnection(config, rpi, address, port=2222) {
        let conn = new forkConnection(port, address, config, rpi, this.localAddress);
        this.connections[conn.address] = conn
        return this.connections[conn.address];
    }

    _onMessage(message) {
        if (message.type === 'inputData') {
            this.connections[message.address].inputData = Buffer.from(message.data)
        }

        if (message.type === 'status') {
            this.connections[message.address].connected = !!message.data
        }
    }

    close() {
        this.child.send({
            type: 'close'
       }) 
    }
}

module.exports = forkScanner;