export = InputMap;
declare class InputMap {
    mapping: any[];
    addBit(byte: any, offset: any, name: any): void;
    addInt(byte: any, name: any): void;
    _readMap(data: any): void;
    getValue(name: any, buf: any): any;
    getNames(): any[];
}
//# sourceMappingURL=index.d.ts.map