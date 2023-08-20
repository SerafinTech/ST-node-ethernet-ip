import net from "net";
import Controller from "../controller";
import { EventEmitter } from "events";
import Tag from "../tag";

type cmAllValues = {
    [index: string]: any
}

type cmAllControllersValues = {
    [index: string] : cmAllValues;
}

class ControllerManager{
    controllers: extController[]
    /**
     * Controller Manager manages PLC connections and tags.  Automatically scans and writes tags that have values changed. Reconnects automatically.
     */
    constructor() {
        this.controllers = [];
    }

    /**
     * Adds controller to be managed by controller manager
     * 
     * @param ipAddress - controller IP address
     * @param slot - Slot number or custom path
     * @param rpi - How often to scan tag value in ms
     * @param connected - Use connected messaging 
     * @param retrySP - How long to wait to retry broken connection in ms
     * @param opts - custom options for future use
     * @returns Extended Controller object
     */
    addController(ipAddress: string, slot : number | Buffer = 0, rpi: number = 100, connected: boolean = true, retrySP: number = 3000, opts: any = {}): extController {
        const contLength = this.controllers.push(new extController(ipAddress, slot, rpi, connected, retrySP, opts));
        return this.controllers[contLength - 1];
    }

    
    /**
     * Returns all current controller tags
     * 
     * @returns tag values indexed by controller ip address and tag name
     */
    getAllValues(): cmAllControllersValues {
        let allTags: cmAllControllersValues = {};
        this.controllers.forEach(controller => {
            let tags = {};
            controller.tags.forEach(tag => {
                tags[tag.tag.name] = tag.tag.value;
            });
            allTags[controller.ipAddress] = tags;
        }); 
        return allTags;
    }
}


export declare interface extController {
    reconnect: boolean;
    ipAddress: string;
    slot: number | Buffer;
    opts: any;
    rpi: any;
    PLC: Controller;
    tags: any[];
    connected: boolean;
    conncom: any;
    retryTimeSP: number;
    on(event: string, listener: Function): this;
    on(event: 'Connected', listener: (this: this) => {}): this; 
    on(event: 'TagChanged', listener: (tag: Tag, previousValue: any) => {}): this;
    on(event: 'TagInit', listener: (tag: Tag) => {}): this;
    on(event: 'Disconnected', listener: () => {}): this;
}

export class extController extends EventEmitter{
    
    /**
     * Extended Controller Class To Manage Rebuilding Tags after as disconnect / reconnect event
     * 
     * @param ipAddress - controller IP address
     * @param slot - Slot number or custom path
     * @param rpi - How often to scan tag value in ms
     * @param connected - Use connected messaging 
     * @param retrySP - How long to wait to retry broken connection in ms
     * @param opts - custom options for future use
     */
    constructor(ipAddress: string, slot: number | Buffer = 0, rpi: number = 100, connCom: boolean = true, retrySP: number = 3000, opts: any = {}) {
        super();
        this.reconnect = true;
        this.ipAddress = ipAddress;
        this.slot = slot;
        this.opts = opts;
        this.rpi = rpi;
        this.PLC = null;
        this.tags = [];
        this.connected = false;
        this.conncom = connCom;
        this.retryTimeSP = retrySP;
    }

    /**
     * Connect To Controller
     */
    connect(reconnect = true) {
        this.reconnect = reconnect;
        this.PLC = new Controller(this.conncom);
        this.PLC.rpi = this.rpi;
        this.PLC.connect(this.ipAddress, this.slot).then(async () => {
            this.connected = true;
            this.PLC.scan_rate = this.rpi;
      
            this.tags.forEach(tag => {
                tag.tag = this.PLC.newTag(tag.tagname, tag.program, true, tag.arrayDims, tag.arraySize);
                this.addTagEvents(tag.tag);
            });

            this.PLC.scan().catch(e => {this.errorHandle(e);});
            this.emit("Connected", this);
      
        }).catch((e: Error) => {this.errorHandle(e);});
    }

    /**
     * Add Tag Events to emit from controller 
     * 
     * @param tag 
     */
    addTagEvents(tag: Tag) {
        tag.on("Changed", (chTag, prevValue) => {
            this.emit("TagChanged", tag, prevValue);
        });
        tag.on("Initialized", () => {
            this.emit("TagInit", tag);
        });
    }

    /**
     * Handle Controller Error during connect or while scanning
     * 
     * @param e - Error emitted
     */
    errorHandle(e: Error) {
        this.emit("Error", e);

        if(e.message && (e.message.slice(0,7) === "TIMEOUT" || e.message.slice(0,6) === "SOCKET")) {

            this.connected = false;
            this.PLC.destroy();
            this.emit("Disconnected");
            if(this.reconnect) {setTimeout(() => {this.connect();}, this.retryTimeSP);}
        }
    }
    
    /**
     * Add tag to controller scan list.
     * 
     * @param tagname - Tag Name 
     * @param program - Program Name
     * @param arrayDims - Array Dimensions
     * @param arraySize - Array Size
     * @returns Tag object
     */
    addTag(tagname: string, program: string = null, arrayDims: number = 0, arraySize: number = 0x01):Tag {
        let tagItem = this.tags.find(tag => {
            return tag.tagname === tagname && tag.program === program;
        })
        if (tagItem) {
            return tagItem.tag
        } else {
            let tag;
            if (this.connected) {
                tag = this.PLC.newTag(tagname, program, true, arrayDims, arraySize);
                this.addTagEvents(tag);
            }
            this.tags.push({
                tagname: tagname,
                program: program,
                arrayDims: arrayDims,
                arraySize: arraySize,
                tag: tag
            });
            return tag;
        }
    }

    /**
     * Disconnect Controller Completely
     * 
     * @returns Promise resolved after disconnect of controller
     */
    disconnect(): Promise<void> {
        return new Promise<void>((resolve) => {
            this.connected = false;
            this.reconnect = false;
            this.PLC.disconnect().then(() => {
                this.emit("Disconnected");
                resolve();
            }).catch(() => {
                net.Socket.prototype.destroy.call(this.PLC);
                this.emit("Disconnected");
                resolve();
            });    
        });
    }

}

export default ControllerManager;
export {Tag};
