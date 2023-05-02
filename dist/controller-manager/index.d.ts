export = ControllerManager;
declare class ControllerManager extends EventEmitter {
    constructor();
    controllers: any[];
    addController(ipAddress: any, slot?: number, rpi?: number, connected?: boolean, retrySP?: number, opts?: {}): any;
    getAllValues(): {};
}
import { EventEmitter } from "events";
//# sourceMappingURL=index.d.ts.map