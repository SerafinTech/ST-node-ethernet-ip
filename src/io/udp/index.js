const dgram = require("dgram");
const Connection = require("./connection");

class Controller {
    constructor(port=2222) {
        this.socket = dgram.createSocket("udp4");
        this.socket.bind(port);
    
        this.connections = [];

        this._setupMessageEvent();
    }

    addConnection(config, rpi, address, port=2222) {
        let conn = new Connection(port, address, config, rpi);
        return this.connections[this.connections.push(conn) - 1];
    }

    _setupMessageEvent() {
        this.socket.on("message", data => {
            this._messageRouter(data);
        });
    }

    _messageRouter(data) {
        this.connections.forEach(conn => {
            conn.parseData(data, this.socket);
        });
    }
}

module.exports = Controller;