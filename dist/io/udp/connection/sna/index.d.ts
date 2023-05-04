export function SerialNumber(value: any, size: any): SerialNumber;
declare function SerialNumber(value: any, size: any): SerialNumber;
declare class SerialNumber {
    constructor(value: any, size: any);
    serialBits: any;
    serialBytes: number;
    _value: any;
    _modulo: number;
    _half: number;
    _maxAdd: number;
    number: number;
    eq(that: any): boolean;
    ne(that: any): boolean;
    lt(that: any): boolean;
    gt(that: any): boolean;
    le(that: any): boolean;
    ge(that: any): boolean;
    add(that: any): number;
    getNumber(options: any): string | number;
    getSpace(bytes: any): any;
    toString(): string;
}
export {};
//# sourceMappingURL=index.d.ts.map