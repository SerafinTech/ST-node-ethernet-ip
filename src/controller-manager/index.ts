import net from "net";
import Controller from "../controller";
import { EventEmitter } from "events";

class ControllerManager extends EventEmitter {
    controllers: extController[]
    /**
     * Controller Manager manages PLC connections and tags.  Automatically scans and writes tags that have values changed. Reconnects automatically.
     */
    constructor() {
        super();
        this.controllers = [];
    }

    //Add controller
    addController(ipAddress, slot = 0, rpi = 100, connected = true, retrySP = 3000, opts = {}) {
        const contLength = this.controllers.push(new extController(ipAddress, slot, rpi, connected, retrySP, opts));
        return this.controllers[contLength - 1];
    }

    //Get All Values. Changing these Values
    getAllValues() {
        let allTags = {};
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

class extController extends EventEmitter{
    reconnect: boolean;
    ipAddress: string;
    slot: number;
    opts: any;
    rpi: any;
    PLC: Controller;
    tags: any[];
    connected: boolean;
    conncom: any;
    retryTimeSP: number;
    constructor(ipAddress, slot = 0, rpi = 100, connCom = true, retrySP = 3000, opts = {}) {
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

    connect() {
        this.reconnect = true;
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
      
        }).catch(e => {this.errorHandle(e);});
    }

    addTagEvents(tag) {
        tag.on("Changed", (chTag, prevValue) => {
            this.emit("TagChanged", tag, prevValue);
        });
        tag.on("Initialized", () => {
            this.emit("TagInit", tag);
        });
    }

    errorHandle(e) {
        this.emit("Error", e);

        if(e.message && (e.message.slice(0,7) === "TIMEOUT" || e.message.slice(0,6) === "SOCKET")) {

            this.connected = false;
            this.PLC.destroy();
            this.emit("Disconnected");
            if(this.reconnect) {setTimeout(() => {this.connect();}, this.retryTimeSP);}
        }
    }
  
    addTag(tagname, program = null, arrayDims = 0, arraySize = 0x01) {
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

    disconnect() {
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
