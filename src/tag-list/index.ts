import { CIP } from "../enip";
import { Template } from "../structure";
import type Controller from '../controller'

type tagListTagType = {
    code: number,
    sintPos: number,
    typeName: string,
    structure: boolean,
    arrayDims: number,
    reserved: boolean
}

type tagListTag = {
    id: number,
    name: string,
    type: tagListTagType,
    program: string
}

type tagListTemplates = {
    [index: string]: Template;
}

class TagList {
    tags: tagListTag[];
    templates: tagListTemplates;

    /**
     * TagList Class for retrieving a list of all tags on a PLC
     */
    constructor () {
        this.tags = [];
        this.templates = {};
    }

    /**
     * Generates the CIP message to request a list of tags
     *
     * @param instanceID- instance id to start getting a list of object tags
     * @param program - (optional) name of the program to search 
     * @returns message to be sent to PLC
     */
    _generateListMessageRequest(instanceID: number = 0, program?: string) {

        const { LOGICAL, DATA } = CIP.EPATH.segments;

        let pathArray = [];

        if (program) { pathArray.push(DATA.build("Program:" + program)); }

        pathArray.push(LOGICAL.build(LOGICAL.types.ClassID, 0x6b)); //Symbol Class ID
    
        if (instanceID === 0) {
            pathArray.push(Buffer.from([0x25, 0x00, 0x00, 0x00])); //Start at Instance 0;
        } else {
            pathArray.push( LOGICAL.build(LOGICAL.types.InstanceID, instanceID));
        }

        const requestData = Buffer.from([0x02, 0x00, 0x01, 0x00, 0x02, 0x00]); // 2 Attributes - Attribute 1 and Attribute 2
        const request = CIP.MessageRouter.build( CIP.MessageRouter.services.GET_INSTANCE_ATTRIBUTE_LIST, Buffer.concat(pathArray), requestData);

        return request;
    }

    /**
     * Parse CIP response into tag data
     *
     * @param data - Buffer data to parse
     * @param program - (optional) name of the program tag is from (optional)
     * @returns Last instance id parsed
     */
    _parseAttributeListResponse(data: Buffer, program?: string): number {
        let instanceID: number;
        let pointer = 0;

        while (pointer < data.length) {
            instanceID = data.readUInt32LE(pointer); //Parse instance ID
            pointer += 4;

            const nameLength = data.readUInt16LE(pointer); // Parse tag Name Length
            pointer += 2;

            const tagName = data.slice(pointer, pointer + nameLength).toString(); // Parse tag Name
            pointer += nameLength;

            const tagType = data.readUInt16LE(pointer); // Parse tag type
            pointer += 2;

            const lastTag = this.tags.findIndex(tag => {
                return (tag.id === instanceID && tag.program === program); 
            });

            const tagObj = {
                id: instanceID,
                name: tagName,
                type: this._parseTagType(tagType),
                program: program
            };
            
            if (lastTag !== -1) {
                this.tags[lastTag] = tagObj;
            } else {
                this.tags.push(tagObj);
            }          
        }
        return instanceID; // Return last instance id
    }

    /**
     * Get and store tag type name from code for all tags
     */
    _getTagTypeNames () {
        for (const tag of this.tags) {
            tag.type.typeName = CIP.DataTypes.getTypeCodeString(tag.type.code);
            if(!tag.type.typeName && this.templates[tag.type.code]) {
                tag.type.typeName = this.templates[tag.type.code]._name;
            }
        }
    }

    /**
     * 
     * @param tagType - tag type numerical value
     * @returns tag list type object
     */
    _parseTagType(tagType: number): tagListTagType {

        let typeCode = null;
        let sintPos = null;
        if ((tagType & 0x00ff) === 0xc1) {
            typeCode = 0x00c1;
            sintPos = (tagType & 0x0f00) >> 8;
        } else {
            typeCode = tagType & 0x0fff;
        }
        
        const structure = !!(tagType & 0x8000);
        const reserved = !!(tagType & 0x1000);
        const arrayDims = (tagType & 0x6000) >> 13;
        
        return {
            code: typeCode,
            sintPos: sintPos,
            typeName: null,
            structure: structure,
            arrayDims: arrayDims,
            reserved: reserved
        };
    }

    /**
     * Parse CIP response into tag data
     *
     * @param PLC - Controller to get tags from
     * @param program - (optional) name of the program tag is from (optional)
     * @returns Promise resolves taglist array
     */
    getControllerTags(PLC: Controller, program: string = null): Promise<tagListTag[]> {
        return new Promise( (resolve, reject) => {

            const getListAt = (instanceID = 0) => { // Create function that we can call back in recursion

                const cipData = this._generateListMessageRequest(instanceID, program); // Create CIP Request
        
                PLC.write_cip(cipData); // Write CIP data to PLC
                
                // Response Handler
                PLC.on("Get Instance Attribute List", async (err, data) => {

                    PLC.removeAllListeners("Get Instance Attribute List");  // Make sure we don't handle future calls in this instance

                    // Check For actual error (Skip too much data)
                    if (err && err.generalStatusCode !== 6) {
                        
                        const errData = {
                            func: "getControllerTags",
                            instanceID: instanceID,
                            program: program,
                            cipReq: cipData,
                        };

                        if (Array.isArray(err.ext)) {
                            err.ext.push(errData);
                        } else {
                            err.ext = [errData];
                        }

                        reject(err);
                        return;
                    }

                    // If too much data, call function again starting at last instance + 1
                    if (err && err.generalStatusCode === 6) {

                        const lastInstance = this._parseAttributeListResponse(data, program); // Parse response data
                        getListAt(lastInstance + 1);

                    } else {

                        this._parseAttributeListResponse(data, program); // pArse response data

                        // If program is not defined fetch tags for existing programs
                        if (!program) {
                            for (let prg of this.programs) {
                                await this.getControllerTags(PLC, prg).catch(reject);
                            }

                            await this._getAllTemplates(PLC).catch(reject); // Get All templates for structures
                            
                        } 
                        this._getTagTypeNames();
                        resolve(this.tags);
                    }
                });
            };

            getListAt(0); // Call first time

        });
    }

    /**
     * Gets Controller Program Names
     * 
     * @returns array of program names
     */
    get programs(): string[] {
        return this.tags.filter(tag => tag.name.slice(0, 8) === "Program:").map(tag => {
            return tag.name.slice(8, tag.name.length);
        });
    }

    /**
     * Gets tag info from tag name and program name
     * 
     * @param tagName 
     * @param program 
     * @returns 
     */
    getTag(tagName: string, program: string = null): tagListTag {
        return this.tags.find(tag => tag.name === tagName && tag.program === program);
    }

    /**
     * 
     * @param tagName 
     * @param program 
     * @returns tag template or null if none
     */
    getTemplateByTag(tagName: string, program: string = null): Template {        
        const tagArray = tagName.split(".");
        const tag = this.tags.find(tag => tag.name.toLowerCase().replace(/\[.*/, "") === tagArray[0].toLowerCase().replace(/\[.*/, "") && String(tag.program).toLowerCase() === String(program).toLowerCase());

        if (tag) {
            let finalTemplate = this.templates[tag.type.code];
            let tagArrayPointer = 1;
            while (finalTemplate && tagArrayPointer < tagArray.length) {
                const memberName = String(tagArray[tagArrayPointer]).replace(/\[.*/, ""); //removes array indication
                const nextTag = finalTemplate._members.find(member => member.name === memberName);
                if(nextTag) {
                    finalTemplate = this.templates[nextTag.type.code];
                } else {
                    finalTemplate = null;
                }
                tagArrayPointer++;
            } 
            return finalTemplate;
        } else {
            return null;
        }
        
    }

    /**
     * Get all templates from a PLC
     * 
     * @param PLC 
     * @returns Promise that resolves after all templates are retrieved from PLC
     */
    _getAllTemplates (PLC: Controller): Promise<void> {
        return new Promise (async (resolve, reject) => {
            for (const tag of this.tags) {
                if (tag.type.structure && !this.templates[tag.type.code]) {

                    try {
                        const template = new Template();
                        await template.getTemplate(PLC, tag.type.code);
                        this.templates[tag.type.code] = template;
                    } catch (e) { /* ignore template fetching errors */ }              

                }
            }

            let foundTemplate = true;

            while(foundTemplate) {
                foundTemplate = false;

                for (const temp in this.templates) {
                    for (const member of this.templates[temp]._members) {
                        if (member.type.structure && !this.templates[member.type.code]) {
                            foundTemplate = true;
                            const template = new Template();
                            await template.getTemplate(PLC, member.type.code).catch(reject); 
                            this.templates[member.type.code] = template; 
                        }
                    }
                }
            }

            resolve();
        });
    }
  
}

export default TagList;
export {tagListTag, tagListTemplates, tagListTagType}