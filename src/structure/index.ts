import { CIP } from "../enip";
const { MessageRouter } = CIP;
const { WRITE_TAG, WRITE_TAG_FRAGMENTED } = MessageRouter.services;
import Tag from "../tag";
import Template from "./template";
import { bufferToString, stringToBuffer } from "../utilities";
import equals from "deep-equal";
import type TagList from '../tag-list'

export declare interface Structure extends Tag {
    _valueObj: any;
    _taglist: any;
    _template: Template;
}

export class Structure extends Tag {
    
    /**
     * Structure Class to handle structure tags
     * 
     * @param tagname - Tagname
     * @param taglist - Tag list of PLC. Needs to be retrieved first.
     * @param program - Program name. Leave undefined for Controller scope
     * @param datatype - Data type code if it needs to be explicitly defined (Not commonly used)
     * @param keepAlive - Time interval in mS to set stage_write to true to keep connection alive.  0 = disabled.
     * @param arrayDims - Dimensions of an array tag
     * @param arraySize - Size of array
     */
    constructor (tagname: string, taglist: TagList, program: string = null, datatype: number = null, keepAlive: number = 0, arrayDims: number = 0, arraySize: number = 0x01) {
        super(tagname, program, datatype, keepAlive, arrayDims, arraySize);
        this._valueObj = null;
        this._taglist = taglist;
        this._template = taglist.getTemplateByTag(tagname, program);
        if (this._template) super.type = CIP.DataTypes.Types.STRUCT;
    }

    /**
     * Gets structure tag value as an object containing all members 
     */
    get value (): any {
        if (!this._template) {
            return super.value;
        } else {
            if (super.value) {
                if (this._valueObj) {
                    return this._valueObj;
                } else {
                    this._valueObj = this.parseValue(super.value);
                    return this._valueObj;
                }               
            } else {
                return null;
            }
        }
    }

    /**
     * Parses either single or array of structures
     * 
     * @param data - tag value as a data buffer
     * @returns tag value as an object containing all members
     */
    parseValue (data: Buffer): any {
        if (this.state.tag.arrayDims > 0) {
            return this._parseReadDataArray(data);
        } else {
            return this._parseReadData(data, this._template);
        }
        
    }

    /**
     * Sets structure tag value as an object containing all members 
     */
    set value (newValue: any) {
        if (!this._template) {
            super.value = newValue;
        } else {
            if (this.state.tag.arrayDims > 0) {
                super.value = this._parseWriteDataArray(newValue);
                this._valueObj = this.parseValue(super.value);
            } else {
                super.value = this._parseWriteData (newValue, this._template);
                this._valueObj = this.parseValue(super.value);
            }
        }
    }

    /**
     * Write current value as object to value as buffer
     */
    writeObjToValue(): void {
        if (this.state.tag.arrayDims > 0) {
            super.value = this._parseWriteDataArray(this._valueObj);
        } else {
            super.value = this._parseWriteData (this._valueObj, this._template);
        }             
    }

    /**
     * Generates write message to write current structure value to PLC
     * 
     * @param value 
     * @param size 
     * @returns Write message request
     */
    generateWriteMessageRequest(value = null, size: number = 0x01): Buffer {
        const { STRUCT } = CIP.DataTypes.Types;
        
        if(!this._template) {
            return super.generateWriteMessageRequest(value, size);
        } else {
            const { tag } = this.state;
            const buf = Buffer.alloc(6);
            buf.writeUInt16LE(STRUCT, 0);
            buf.writeUInt16LE(this._template._attributes.StructureHandle, 2);
            if (Array.isArray(this.value)) {
                buf.writeUInt16LE(this.value.length, 4);
            } else {
                buf.writeUInt16LE(size, 4);
            }        
            
            return MessageRouter.build(WRITE_TAG, tag.path, Buffer.concat([buf, super.value]));  
        }
    }

    /**
     * Generates write message to write current structure value to PLC
     * 
     * @param offset - Offset of data already written 
     * @param value - Fragment of value of structure as a buffer
     * @param size - size of the data
     * @returns message
     */
    generateWriteMessageRequestFrag(offset: number = 0, value: Buffer = null, size: number = 0x01) {
        const { STRUCT } = CIP.DataTypes.Types;

        if(!this._template) {
            return super.generateWriteMessageRequest(value, size);
        } else {
            const { tag } = this.state;
            const buf = Buffer.alloc(10);
            buf.writeUInt16LE(STRUCT, 0);
            buf.writeUInt16LE(this._template._attributes.StructureHandle, 2);
            if (Array.isArray(this.value)) {
                buf.writeUInt16LE(this.value.length, 4);
            } else {
                buf.writeUInt16LE(size, 4);
            }
            buf.writeUInt32LE(offset, 6);

            return MessageRouter.build(WRITE_TAG_FRAGMENTED, tag.path, Buffer.concat([buf, value]));  
        }
    }

    /**
     * Parse structure data read from PLC
     * 
     * @param data - data from PLC
     * @param template - Template that forms the data structure
     * @returns Structure tag value as an object
     */
    _parseReadData (data: Buffer, template: Template): any {
        if (template._members.length === 2 && template._members[0].name === "LEN" && template._members[1].name === "DATA")
            return bufferToString(data);

        let structValues = {};
        
        const {SINT, INT, DINT, REAL, LINT, BIT_STRING, BOOL, STRUCT } = CIP.DataTypes.Types;

        template._members.forEach(member => {
            
            /* eslint-disable indent */
            switch (member.type.structure ? STRUCT : member.type.code) {
                case SINT:
                    if (member.type.arrayDims > 0) {
                        structValues[member.name] = [];
                        for (let i = 0; i < member.info; i++) {
                            structValues[member.name].push(data.readUInt8(member.offset + i));
                        }
                    } else {
                        structValues[member.name] = data.readUInt8(member.offset);
                    } 
                    break;
                case INT:
                    if (member.type.arrayDims > 0) {
                        let array = [];
                        for (let i = 0; i < member.info * 2; i+=2) {
                            array.push(data.readInt16LE(member.offset + i));
                        }
                        structValues[member.name] = array;
                    } else {
                        structValues[member.name] = data.readInt16LE(member.offset);
                    }
                    break;
                case DINT:
                    if (member.type.arrayDims > 0) {
                        let array = [];
                        for (let i = 0; i < member.info * 4; i+=4) {
                            array.push(data.readInt32LE(member.offset + i));
                        }
                        structValues[member.name] = array;
                    } else {
                        structValues[member.name] = data.readInt32LE(member.offset);
                    }
                    break;
                case REAL:
                    if (member.type.arrayDims > 0) {
                        let array = [];
                        for (let i = 0; i < member.info * 4; i+=4) {
                            array.push(data.readFloatLE(member.offset + i));
                        }
                        structValues[member.name] = array;
                    } else {
                        structValues[member.name] = data.readFloatLE(member.offset);
                    }
                    break;
                case LINT:
                    if (member.type.arrayDims > 0) {
                        let array = [];
                        for (let i = 0; i < member.info * 8; i+=8) {
                            array.push(data.readBigInt64LE(member.offset + i));
                        }
                        structValues[member.name] = array;
                    } else {
                        structValues[member.name] = data.readBigInt64LE(member.offset);
                    }
                    break;
                case BIT_STRING:
                    if (member.type.arrayDims > 0) {
                        let array = [];
                        for (let i = 0; i < member.info * 4; i+=4) {
                            let bitString32bitValue = data.readUInt32LE(member.offset + i);
                            for (let j = 0; j < 32; j++) {
                                array.push(!!(bitString32bitValue >> j & 0x01));
                            }
                        }
                        structValues[member.name] = array;
                    } else {
                        structValues[member.name] = data.readUInt32LE(member.offset);
                    }
                    break;
                case BOOL:
                    structValues[member.name] = !!(data.readUInt8(member.offset) & (1 << member.info));
                    break;
                case STRUCT: {
                    const memberTemplate = this._taglist.templates[member.type.code];
                    const memberStructSize = memberTemplate._attributes.StructureSize;
                    if (member.type.arrayDims > 0) { 
                        let array = [];
                        for (let i = 0; i < member.info * memberStructSize; i+=memberStructSize) {
                            array.push(this._parseReadData(data.subarray(member.offset + i), memberTemplate));
                        }
                        structValues[member.name] = array;
                    } else {
                        structValues[member.name] = this._parseReadData(data.subarray(member.offset), memberTemplate);
                    }
                    break;
                }
                default:
                    throw new Error(
                        "Data Type other than SINT, INT, DINT, LINT, BOOL, STRUCT or BIT_STRING returned "
                    );
            }
            /* eslint-enable indent */   
        });
        return structValues;
    }

    /**
     * Parses and array of structure tag data read from PLC
     * @param data - data from PLC 
     * @returns Array of structure tag values as objects
     */
    _parseReadDataArray(data: Buffer): any[] {
        let array = [];
        for (let i = 0; i < data.length; i+=this._template._attributes.StructureSize) {
            array.push(this._parseReadData(data.subarray(i),this._template));
        }
        return array;
    }

    /**
     * Creates data to send to PLC to write structure value
     * 
     * @param structValues - Structure tag value as an object / string 
     * @param template - Template of Structure tag
     * @returns Data to be sent to PLC
     */
    _parseWriteData (structValues: any, template: Template): Buffer {
        if (template._members.length === 2 && template._members[0].name === "LEN" && template._members[1].name === "DATA")
            return stringToBuffer(structValues, template._attributes.StructureSize);

        const data = Buffer.alloc(template._attributes.StructureSize);

        const {SINT, INT, DINT, REAL, LINT, BIT_STRING, BOOL, STRUCT } = CIP.DataTypes.Types;
        
        template._members.forEach(member => {
            /* eslint-disable indent */
            switch (member.type.structure ? STRUCT : member.type.code) {
                case SINT:
                    if (member.type.arrayDims > 0) {
                        for (let i = 0; i < member.info; i++) {
                            data.writeUInt8(structValues[member.name][i], member.offset + i);
                        }
                    } else {
                        data.writeUInt8(structValues[member.name], member.offset);
                    } 
                    break;
                case INT:
                    if (member.type.arrayDims > 0) {
                        for (let i = 0; i < member.info; i++) {
                            data.writeInt16LE(structValues[member.name][i], member.offset + (i * 2));
                        }
                    } else {
                        data.writeInt16LE(structValues[member.name],member.offset);
                    }
                    break;
                case DINT:
                    if (member.type.arrayDims > 0) {
                        for (let i = 0; i < member.info; i++) {
                            data.writeInt32LE(structValues[member.name][i], member.offset + (i * 4));
                        }
                    } else {
                        data.writeInt32LE(structValues[member.name],member.offset);
                    }
                    break;
                case REAL:
                    if (member.type.arrayDims > 0) {
                        for (let i = 0; i < member.info; i++) {
                            data.writeFloatLE(structValues[member.name][i], member.offset + (i * 4));
                        }
                    } else {
                        data.writeFloatLE(structValues[member.name],member.offset);
                    }
                    break;
                case LINT:
                    if (member.type.arrayDims > 0) {
                        for (let i = 0; i < member.info; i++) {
                            data.writeBigInt64LE(structValues[member.name][i], member.offset + (i * 8));
                        }
                    } else {
                        data.writeBigInt64LE(structValues[member.name],member.offset);
                    }
                    break;
                case BIT_STRING:
                    if (member.type.arrayDims > 0) {
                        for (let i = 0; i < member.info; i++) {
                            let bitString32bitValue = 0;
                            for (let j = i*32; j < (i+1)*32; j++) {
                                if (j > structValues[member.name].length) break;
                                bitString32bitValue |= (structValues[member.name][j] & 1) << j;
                            }
                            data.writeUInt32LE(bitString32bitValue >>> 0, member.offset + (i * 4));
                        }
                    } else {
                        data.writeUInt32LE(structValues[member.name],member.offset);
                    }
                    break;
                case BOOL:
                    if (structValues[member.name]) {
                        data.writeUInt8(data.readUInt8(member.offset) | 1<<member.info, member.offset);
                    } else {
                        data.writeUInt8(data.readUInt8(member.offset) & ~(1<<member.info), member.offset);
                    }
                    break;
                case STRUCT: {
                    const memberTemplate = this._taglist.templates[member.type.code];
                    const memberStructSize = memberTemplate._attributes.StructureSize;
                    if (member.type.arrayDims > 0) { 
                        for (let i = 0; i < member.info; i++) {
                            const templateData = this._parseWriteData(structValues[member.name][i], memberTemplate);
                            for (let pairs of templateData.entries()) {
                                data[member.offset + (i * memberStructSize) + pairs[0]] = pairs[1];
                            }
                        }
                    } else {
                        const templateData = this._parseWriteData(structValues[member.name], memberTemplate);
                        for (let pairs of templateData.entries()) {
                            data[member.offset + pairs[0]] = pairs[1];
                        }
                    }
                    break;
                }
                default:
                    throw new Error(
                        "Data Type other than SINT, INT, DINT, LINT, BOOL, STRUCT or BIT_STRING returned "
                    );
            }
            /* eslint-enable indent */   
        });
        return data;
    }

    /**
     * Creates data to send to PLC to write and array of structure values 
     * 
     * @param newValue - array of sture values that are objects / strings
     * @returns data message to be sent to PLC
     */
    _parseWriteDataArray (newValue: any[]) {
        let buf = Buffer.alloc(0);

        newValue.forEach(value => {
            buf = Buffer.concat([buf, this._parseWriteData(value, this._template)]);
        });
        
        return buf;
    }
    
    /**
     * Get current value on the PLC controller
     */
    get controller_value(): Buffer {
        return this.state.tag.controllerValue;
    }

    /**
     *  Set controller value and update object value
     *  @param newValue - Structure tag value as a buffer
     */
    set controller_value(newValue: any) {
        if (!equals(newValue, this.state.tag.controllerValue)) {
            let lastValue = null;
            if(this.state.tag.controllerValue !== null) 
                lastValue = Buffer.from(this.state.tag.controllerValue);
                   
            this.state.tag.controllerValue = Buffer.from(newValue);

            const { stage_write } = this.state.tag;
            if (!stage_write) {
                this.state.tag.value = newValue;
                this._valueObj = this.parseValue(super.value);
            }

            this.state.timestamp = new Date();


            if (lastValue !== null) this.emit("Changed", this, this.parseValue(lastValue));
            else this.emit("Initialized", this);
        } else {
            if (this.state.keepAlive > 0) {
                const now = new Date();
                if (now.getTime() - this.state.timestamp.getTime() >= this.state.keepAlive * 1000) {
                    this.state.tag.controllerValue = newValue;

                    const { stage_write } = this.state.tag;
                    if (!stage_write) this.state.tag.value = newValue;
                    this.state.timestamp = now;

                    this.emit("KeepAlive", this);
                }
            }
        }
    }

}



export { Template};