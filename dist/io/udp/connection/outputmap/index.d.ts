export = OutputMap;
declare class OutputMap {
    mapping: any[];
    addBit(byte: any, offset: any, name: any, value?: boolean): void;
    addInt(byte: any, name: any, value?: number): void;
    _writeMap(data: any): any;
    setValue(name: any, value: any, data: any): any;
    getNames(): any[];
}
//# sourceMappingURL=index.d.ts.map