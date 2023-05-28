export namespace Types {
    const BOOL: number;
    const SINT: number;
    const INT: number;
    const DINT: number;
    const LINT: number;
    const USINT: number;
    const UINT: number;
    const UDINT: number;
    const REAL: number;
    const LREAL: number;
    const STIME: number;
    const DATE: number;
    const TIME_AND_DAY: number;
    const DATE_AND_STRING: number;
    const STRING: number;
    const WORD: number;
    const DWORD: number;
    const BIT_STRING: number;
    const LWORD: number;
    const STRING2: number;
    const FTIME: number;
    const LTIME: number;
    const ITIME: number;
    const STRINGN: number;
    const SHORT_STRING: number;
    const TIME: number;
    const EPATH: number;
    const ENGUNIT: number;
    const STRINGI: number;
    const STRUCT: number;
}
/**
 * Checks if an Inputted Integer is a Valid Type Code (Vol1 Appendix C)
 *
 * @param {number} num - Integer to be Tested
 * @returns {boolean}
 */
export function isValidTypeCode(num: number): boolean;
/**
 * Retrieves Human Readable Version of an Inputted Type Code
 *
 * @param {number} num - Type Code to Request Human Readable version
 * @returns {string} Type Code String Interpretation
 */
export function getTypeCodeString(num: number): string;
//# sourceMappingURL=index.d.ts.map