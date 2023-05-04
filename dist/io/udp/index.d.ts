/// <reference types="node" />
export = Controller;
declare class Controller {
    constructor(port?: number);
    socket: dgram.Socket;
    connections: any[];
    addConnection(config: any, rpi: any, address: any, port?: number): any;
    _setupMessageEvent(): void;
    _messageRouter(data: any): void;
}
import dgram = require("dgram");
//# sourceMappingURL=index.d.ts.map