const { CIP } = require("../enip");
const { MessageRouter } = CIP;
const { WRITE_TAG, WRITE_TAG_FRAGMENTED } = MessageRouter.services;
const Tag = require("../tag");
const Template = require("./template");
const {bufferToString, stringToBuffer} = require("../utilities");

class Structure extends Tag {
    constructor (tagname, taglist, program = null, datatype = null, keepAlive = 0) {
        super(tagname, program, datatype, keepAlive);
        this._taglist = taglist;
        this._template = taglist.getTemplateByTag(tagname, program);
        if (this._template) super.type = CIP.DataTypes.Types.STRUCT;
    }

    get value () {
        if (!this._template) {
            return super.value;
        } else {
            if(super.value) {
                return this.parseValue(super.value);
            } else {
                return null;
            }
        }
    }

    parseValue (data) {
        if (this._template._name === "ASCIISTRING82" || this._template._name === "STRING") {
            return bufferToString(data);
        } else {
            return this._parseReadData(data, this._template);
        }
    }

    set value (newValue) {
        if (!this._template) {
            super.value = newValue;
        } else {
            if (this._template._name === "ASCIISTRING82" || this._template._name === "STRING") {
                super.value = stringToBuffer(newValue, this._template._attributes.StructureSize);
            } else {
                super.value = this._parseWriteData (newValue, this._template);
            }
        }
    }

    generateWriteMessageRequest(value = null, size = 0x01) {
        const { STRUCT } = CIP.DataTypes.Types;
        
        if(!this._template) {
            return super.generateReadMessageRequest(value, size);
        } else {
            const { tag } = this.state;
            const buf = Buffer.alloc(6);
            buf.writeUInt16LE(STRUCT, 0);
            buf.writeUInt16LE(this._template._attributes.StructureHandle, 2);
            buf.writeUInt16LE(size, 4);
            
            return MessageRouter.build(WRITE_TAG, tag.path, Buffer.concat([buf, super.value]));  
        }
    }

    generateWriteMessageRequestFrag(offset = 0, value = null, size = 0x01) {
        const { STRUCT } = CIP.DataTypes.Types;

        if(!this._template) {
            return super.generateWriteMessageRequest(value, size);
        } else {
            const { tag } = this.state;
            const buf = Buffer.alloc(10);
            buf.writeUInt16LE(STRUCT, 0);
            buf.writeUInt16LE(this._template._attributes.StructureHandle, 2);
            buf.writeUInt16LE(size, 4);
            buf.writeUInt32LE(offset, 6);
            
            return MessageRouter.build(WRITE_TAG_FRAGMENTED, tag.path, Buffer.concat([buf, value]));  
        }
    }

    _parseReadData (data, template) {
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
                            array.push(data.readUInt32LE(member.offset + i));
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
                            array.push(this._parseReadData(data.slice(member.offset + i), memberTemplate));
                        }
                        structValues[member.name] = array;
                    } else {
                        structValues[member.name] = this._parseReadData(data.slice(member.offset), memberTemplate);
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

    _parseWriteData (structValues, template) {
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
                            data.writeUInt32LE(structValues[member.name][i], member.offset + (i * 4));
                        }
                    } else {
                        data.writeUInt32LE(structValues[member.name],member.offset);
                    }
                    break;
                case BOOL:
                    data.writeUInt8(data.readUInt8(member.offset) | (structValues[member.name] ? 1 : 0 << member.info));
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

}



module.exports = { Structure, Template};