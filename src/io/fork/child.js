const Scanner = require("../udp");

const scanner = new Scanner(parseInt(process.argv[2]), process.argv[3])
let connMap = {};
if (process.on) {
    process.on('SIGINT', () => {
        //Don't Exit
    })
    process.on('message', mess => {
        switch(mess.type) {
            case 'newConnection':
                if (mess.data.config.configInstance.data) {
                    mess.data.config.configInstance.data = Buffer.from(mess.data.config.configInstance.data)
                }
                let conn = scanner.addConnection(mess.data.config, mess.data.rpi, mess.data.address, mess.data.port)
                connMap[mess.address] = conn;
                conn.inputDataLast = Buffer.alloc(conn.TOsize)
                conn.lastConnected = false;
                conn.inputInterval = setInterval(() => {
                    if (Buffer.compare(conn.inputDataLast,conn.inputData) !== 0) {
                        conn.inputData.copy(conn.inputDataLast);
                        process.send({
                            type: 'inputData',
                            data: conn.inputData,
                            address: conn.address
                        })
                    }

                    if (conn.lastConnected !== conn.connected) {
                        conn.lastConnected = conn.connected;
                        process.send({
                            type: 'status',
                            data: conn.connected,
                            address: conn.address
                        })
                    }
                }, conn.rpi)
                break;
            case 'run':
                connMap[mess.address].run = mess.data;
                break;
            case 'outputData':
                connMap[mess.address].outputData = Buffer.from(mess.data)
                break;
            case 'closeConn':
                connMap[mess.address].run = false;
                clearInterval(connMap[mess.address].inputInterval)
                connMap[mess.address] = null;
                break;
            case 'closeScanner':
                scanner.connections = [];
                scanner.socket.close();
                process.exit();
                break;
        }
        
    })
}


