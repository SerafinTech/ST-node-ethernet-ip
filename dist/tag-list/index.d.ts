export = TagList;
declare class TagList {
    tags: any[];
    templates: {};
    /**
     * Generates the CIP message to request a list of tags
     *
     * @param {number} [instanceID = 0] - instance id to start getting a list of object tags
     * @param {string} program - (optional) name of the program to search
     * @returns {buffer}
     */
    _generateListMessageRequest(instanceID?: number, program?: string): Buffer;
    /**
     * Parse CIP response into tag data
     *
     * @param {buffer} data - Buffer data to parse
     * @param {string} program - (optional) name of the program tag is from (optional)
     * @returns {number} Last instance id parsed
     */
    _parseAttributeListResponse(data: Buffer, program: string): number;
    _getTagTypeNames(): void;
    _parseTagType(tagType: any): {
        code: number;
        sintPos: number;
        typeName: any;
        structure: boolean;
        arrayDims: number;
        reserved: boolean;
    };
    /**
     * Parse CIP response into tag data
     *
     * @param {node-ethernet-ip.Controller} PLC - Controller to get tags from
     * @param {string} [program = null] - (optional) name of the program tag is from (optional)
     * @returns {Promise}
     */
    getControllerTags(PLC: any, program?: string): Promise<any>;
    /**
     * Gets Controller Program Names
     *
     * @returns {array[string]}
     */
    get programs(): any;
    getTag(tagName: any, program?: any): any;
    getTemplateByTag(tagName: any, program?: any): any;
    _getAllTemplates(PLC: any): Promise<any>;
}
//# sourceMappingURL=index.d.ts.map