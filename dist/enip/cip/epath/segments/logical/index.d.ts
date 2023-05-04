export namespace types {
    const ClassID: number;
    const InstanceID: number;
    const MemberID: number;
    const ConnPoint: number;
    const AttributeID: number;
    const Special: number;
    const ServiceID: number;
}
/**
 * Builds Single Logical Segment Buffer
 *
 * @param {number} type - Valid Logical Segment Type
 * @param {number} address - Logical Segment Address
 * @param {boolean} [padded=true] - Padded or Packed EPATH format
 * @returns {buffer}
 */
export function build(type: number, address: number, padded?: boolean): Buffer;
//# sourceMappingURL=index.d.ts.map