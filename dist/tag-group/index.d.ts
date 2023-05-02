export = TagGroup;

declare class TagGroup extends EventEmitter {
    constructor();
    state: {
        tags: {};
        path: Buffer;
        timestamp: Date;
    };
    /**
     * Fetches the Number of Tags
     *
     * @readonly
     * @returns {number}
     * @memberof TagGroup
     */
    get length(): number;
    /**
     * Adds Tag to Group
     *
     * @param {Tag} tag - Tag to Add to Group
     * @memberof TagGroup
     */
    add(tag: Tag): void;
    /**
     * Removes Tag from Group
     *
     * @param {Tag} tag - Tag to be Removed from Group
     * @memberof TagGroup
     */
    remove(tag: Tag): void;
    /**
     * Iterable, Allows user to Iterate of each Tag in Group
     *
     * @param {function} callback - Accepts Tag Class
     * @memberof TagGroup
     */
    forEach(callback: Function): void;
    /**
     * Generates Array of Messages to Compile into a Multiple
     * Service Request
     *
     * @returns {Array} - Array of Read Tag Message Services
     * @memberof TagGroup
     */
    generateReadMessageRequests(): any[];
    /**
     * Parse Incoming Multi Service Request Messages
     *
     * @param {Array} responses
     * @param {Arrayany} ids
     * @memberof TagGroup
     */
    parseReadMessageResponses(responses: any[], ids: any[]): void;
    /**
     * Generates Array of Messages to Compile into a Multiple
     * Service Request
     *
     * @returns {Array} - Array of Read Tag Message Services
     * @memberof TagGroup
     */
    generateWriteMessageRequests(): any[];
    /**
     * Parse Incoming Multi Service Request Messages
     *
     * @param {Array} responses
     * @param {Arrayany} ids
     * @memberof TagGroup
     */
    parseWriteMessageRequests(responses: any[], ids: any[]): void;
}
import { EventEmitter } from "events";
import Tag = require("../tag");
//# sourceMappingURL=index.d.ts.map