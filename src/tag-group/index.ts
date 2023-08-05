import { CIP } from "../enip";
const { LOGICAL } = CIP.EPATH.segments;
const { MessageRouter } = CIP;
const { MULTIPLE_SERVICE_PACKET } = MessageRouter.services;
import equals from "deep-equal";
import type Tag from "../tag";

type tagGroupState = {
    tags: object,
    path: Buffer,
    timestamp: Date
}

type readMessageRequests = {
    data: Buffer,
    tag_ids: string[]
}

type writeTagMessageRequests = {
    data: Buffer,
    tag: Tag,
    tag_ids: string[]
}

class TagGroup {
    state: tagGroupState;
    /**
     * Tag Group Class used for reading and writing multiple tags at once
     */
    constructor() {      
        const pathBuf = Buffer.concat([
            LOGICAL.build(LOGICAL.types.ClassID, 0x02), // Message Router Class ID (0x02)
            LOGICAL.build(LOGICAL.types.InstanceID, 0x01) // Instance ID (0x01)
        ]);

        this.state = {
            tags: {},
            path: pathBuf,
            timestamp: new Date()
        };
    }

    /**
     * Fetches the Number of Tags
     *
     * @readonly
     * @returns Number of tags
     */
    get length(): number {
        return Object.keys(this.state.tags).length;
    }
    // endregion

    /**
     * Adds Tag to Group
     *
     * @param tag - Tag to Add to Group
     */
    add(tag: Tag): void {
        if (!this.state.tags[tag.instance_id]) this.state.tags[tag.instance_id] = tag;
    }

    /**
     * Removes Tag from Group
     *
     * @param tag - Tag to be Removed from Group
     */
    remove(tag: Tag) {
        if (this.state.tags[tag.instance_id]) delete this.state.tags[tag.instance_id];
    }

    /**
     * Iterable, Allows user to Iterate of each Tag in Group
     *
     * @param callback - Accepts Tag Class
     */
    forEach(callback: (tag: Tag) => {}) {
        for (let key of Object.keys(this.state.tags)) callback(this.state.tags[key]);
    }

    /**
     * Generates Array of Messages to Compile into a Multiple
     * Service Request
     *
     * @returns Array of Read Tag Message Services
     */
    generateReadMessageRequests(): readMessageRequests[] {
        const { tags } = this.state;

        // Initialize Variables
        let messages = [];
        let msgArr = [];
        let tagIds = [];
        let messageLength = 0;

        // Loop Over Tags in List
        for (let key of Object.keys(tags)) {
            const tag = tags[key];

            // Build Current Message
            let msg = tag.generateReadMessageRequest();

            messageLength += msg.length + 2;

            tagIds.push(tag.instance_id);
            msgArr.push(msg);

            // If Current Message Length is > 350 Bytes then Assemble Message and Move to Next Message
            if (messageLength >= 300) {
                let buf = Buffer.alloc(2 + 2 * msgArr.length);
                buf.writeUInt16LE(msgArr.length, 0);

                let ptr = 2;
                let offset = buf.length;

                for (let i = 0; i < msgArr.length; i++) {
                    buf.writeUInt16LE(offset, ptr);
                    ptr += 2;
                    offset += msgArr[i].length;
                }

                buf = Buffer.concat([buf, ...msgArr]);
                buf = MessageRouter.build(MULTIPLE_SERVICE_PACKET, this.state.path, buf);

                messages.push({ data: buf, tag_ids: tagIds });
                messageLength = 0;
                msgArr = [];
                tagIds = [];
            }
        }

        // Assemble and Push Last Message
        if (msgArr.length > 0) {
            let buf = Buffer.alloc(2 + 2 * msgArr.length);
            buf.writeUInt16LE(msgArr.length, 0);

            let ptr = 2;
            let offset = buf.length;

            for (let i = 0; i < msgArr.length; i++) {
                buf.writeUInt16LE(offset, ptr);
                ptr += 2;
                offset += msgArr[i].length;
            }

            buf = Buffer.concat([buf, ...msgArr]);
            buf = MessageRouter.build(MULTIPLE_SERVICE_PACKET, this.state.path, buf);

            messages.push({ data: buf, tag_ids: tagIds });
        }

        return messages;
    }

    /**
     * Parse Incoming Multi Service Request Messages
     *
     * @param responses - response from controller
     * @param ids - Tag ids

     */
    parseReadMessageResponses(responses: any[], ids: string[]) {
        for (let i = 0; i < ids.length; i++) {
            if(responses[i].generalStatusCode === 0)
                this.state.tags[ids[i]].parseReadMessageResponse(responses[i].data);
        }
    }

    /**
     * Generates Array of Messages to Compile into a Multiple
     * Service Request
     *
     * @returns Array of Write Tag Message Services
     */
    generateWriteMessageRequests(): writeTagMessageRequests[] {
        const { tags } = this.state;

        // Initialize Variables
        let messages = [];
        let msgArr = [];
        let tagIds = [];
        let messageLength = 0;

        // Loop Over Tags in List
        for (let key of Object.keys(tags)) {
            const tag = tags[key];

            if (tag.value !== null && tag.type === "STRUCT")
                tag.writeObjToValue();

            if (tag.value !== null && !equals(tag.state.tag.value, tag.controller_value)) {
                // Build Current Message
                let msg = tag.generateWriteMessageRequest();
                
                if (tag.type !== "STRUCT") {
                    messageLength += msg.length + 2;

                    tagIds.push(tag.instance_id);
                    msgArr.push(msg);

                    // If Current Message Length is > 350 Bytes then Assemble Message and Move to Next Message
                    if (messageLength >= 350) {
                        let buf = Buffer.alloc(2 + 2 * msgArr.length);
                        buf.writeUInt16LE(msgArr.length, 0);

                        let ptr = 2;
                        let offset = buf.length;

                        for (let i = 0; i < msgArr.length; i++) {
                            buf.writeUInt16LE(offset, ptr);
                            ptr += 2;
                            offset += msgArr[i].length;
                        }

                        buf = Buffer.concat([buf, ...msgArr]);
                        buf = MessageRouter.build(MULTIPLE_SERVICE_PACKET, this.state.path, buf);

                        messages.push({ data: buf, tag: null, tag_ids: tagIds });
                        messageLength = 0;
                        msgArr = [];
                        tagIds = [];
                    }
                } else {
                    messages.push({data: null, tag: tag, tagIds: null});  // Single tag pushed to indicate need to write single STRUCT tag
                }
            }
        }

        // Assemble and Push Last Message
        if (msgArr.length > 0) {
            let buf = Buffer.alloc(2 + 2 * msgArr.length);
            buf.writeUInt16LE(msgArr.length, 0);

            let ptr = 2;
            let offset = buf.length;

            for (let i = 0; i < msgArr.length; i++) {
                buf.writeUInt16LE(offset, ptr);
                ptr += 2;
                offset += msgArr[i].length;
            }

            buf = Buffer.concat([buf, ...msgArr]);
            buf = MessageRouter.build(MULTIPLE_SERVICE_PACKET, this.state.path, buf);

            messages.push({ data: buf, tag: null, tag_ids: tagIds });
        }

        return messages;
    }

    /**
     * Parse Incoming Multi Service Request Messages
     *
     * @param ids
     */
    parseWriteMessageRequests(ids: string[]) {
        for (let id of ids) {
            this.state.tags[id].unstageWriteRequest();
        }
    }
    // endregion

    // region Private Methods

    // endregion

    // region Event Handlers

    // endregion
}

export default TagGroup;
