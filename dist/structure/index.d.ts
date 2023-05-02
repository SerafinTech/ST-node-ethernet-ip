export class Structure extends Tag {
    constructor(tagname: any, taglist: any, program?: any, datatype?: any, keepAlive?: number, arrayDims?: number, arraySize?: number);
    _valueObj: {};
    _taglist: any;
    _template: any;
    parseValue(data: any): {};
    writeObjToValue(): void;
    generateWriteMessageRequestFrag(offset?: number, value?: any, size?: number): any;
    _parseReadData(data: any, template: any): {};
    _parseReadDataArray(data: any): {}[];
    _parseWriteData(structValues: any, template: any): Buffer;
    _parseWriteDataArray(newValue: any): Buffer;
}
import Template = require("./template");
import Tag = require("../tag");
export { Template };
//# sourceMappingURL=index.d.ts.map