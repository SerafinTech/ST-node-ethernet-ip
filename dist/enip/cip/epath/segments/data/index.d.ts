export namespace Types {
    const Simple: number;
    const ANSI_EXTD: number;
}
/**
 * Builds EPATH Data Segment
 *
 * @param {string|buffer} data
 * @param {boolean} [ANSI=true] Declare if ANSI Extended or Simple
 * @returns {buffer}
 */
export function build(data: string | Buffer, ANSI?: boolean): Buffer;
//# sourceMappingURL=index.d.ts.map