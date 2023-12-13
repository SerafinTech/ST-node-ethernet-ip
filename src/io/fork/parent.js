import { fork } from 'child_process';
import path from 'path';

const program = path.resolve(__dirname,'./child.js');

const options = {
    stdio: [0, 1, 2, 'ipc'],
};

class forkConnection {
    constructor(port, address, config, rpi, localAddress, child) {
        this.inputData = Buffer.alloc(config.inputInstance.size);
        this.outputData = Buffer.alloc(config.outputInstance.size);
        this.lastOutputData = Buffer.alloc(config.outputInstance.size);
        this.address = address;
        this.rpi = rpi;
        this.connected = false;
        this.runCommand = true;
        this.child = child;
        
        if (this.child.connected) {
            this.child.send({
                type: 'newConnection',
                data: {
                    config: config,
                    rpi: rpi,
                    address: address,
                    localAddress: localAddress,
                    port: port
                },
                address: this.address
            })
        }     
        
        let that = this;
        this.scan = setInterval(() => {
            this._checkChanges(that)
        }, rpi);

    }

    set run(val) {
        this.runCommand = val;
        if (this.child.connected) {
            this.child.send({
                type: 'run',
                data: val,
                address: this.address
            });
        } else {
            this.connected = false;
        }   
    }

    get run() {
        return this.runCommand
    }

    _checkChanges(that) {
        if (Buffer.compare(that.outputData, that.lastOutputData) !== 0) {
            that.outputData.copy(that.lastOutputData);

            if (that.child.connected) {
                that.child.send({
                    type: 'outputData',
                    address: that.address,
                    data: that.outputData
                })
            } else {
                that.connected = false;
            }        
        }
    }

    close() {
        this.runCommand = false;
        clearInterval(this.scan)

        if (this.child.connected) {
            this.child.send({
                type: 'closeConn',
                address: this.address
            })
        } else {
            this.connected = false;
        }
        
    }
    
}

class forkScanner {
    constructor(port=2222, localAddress='0.0.0.0' ) {
        this.port = port;
        this.localAddress = localAddress;
        this.child = fork(program, [this.port, this.localAddress], options);
        this.connections = {};
        this.child.on('message', mess => {
            this._onMessage(mess, this);
        });
    }

    addConnection(config, rpi, address, port=2222) {
        let conn = new forkConnection(port, address, config, rpi, this.localAddress, this.child);
        this.connections[conn.address] = conn
        return this.connections[conn.address];
    }

    _onMessage(message, that) {
        if (message.type === 'inputData') {
            this.connections[message.address].inputData = Buffer.from(message.data)
        }

        if (message.type === 'status') {
            this.connections[message.address].connected = !!message.data
        }
    }

    close(cb) {
        if (this.child.connected) {
            this.child.send({
                type: 'closeScanner'
            });
        } 
        cb(); 
    }
}

module.exports = forkScanner;