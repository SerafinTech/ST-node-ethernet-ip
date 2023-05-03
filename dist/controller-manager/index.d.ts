export = ControllerManager;
declare class ControllerManager extends EventEmitter {
    constructor();
    controllers: any[];
    addController(ipAddress: any, slot?: number, rpi?: number, connected?: boolean, retrySP?: number, opts?: {}): extController;
    getAllValues(): {};
}

declare class extController extends EventEmitter {
    constructor(ipaddress: string, slot?: number, connected?: boolean, retrySP?: number, options?: {});
    connect(): void;
    addTag(tagname: string, program?: string, arrayDims?: number, arraySize?: number): Tag;
    disconnect(): Promise<any>;
    override on(eventName: "Connected" | "TagChanged" | "TagInit" | "Error" | "Disconnected", listener: (...args: any[]) => void): this;
} 
import { EventEmitter } from "events";
import Tag = require("../tag");
//# sourceMappingURL=index.d.ts.map