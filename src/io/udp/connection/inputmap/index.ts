type inputMapItem = {
    size: number,
    byte: number,
    offset: number,
    name: string,
    value: any
}

class InputMap {
    mapping: inputMapItem[]
    /**
     * Helper to decode input buffer to process value  
     */
    constructor() {
        this.mapping = [];
    }

    /**
     * Add a bit value to decode
     * 
     * @param byte - Which byte to start at
     * @param offset - Number of bits to offset
     * @param name - Unique name to reference value
     */
    addBit(byte: number, offset: number, name: string) {
        this.mapping.push({
            size: 1,
            byte: byte,
            offset: offset,
            name: name,
            value: false
        });

    }

    /**
     * Add a 16 bit integer value to decode
     * 
     * @param byte - Number off bytes to offset
     * @param name - Unique name to reference value
     */
    addInt(byte: number, name: string): void {
        this.mapping.push({
            size: 16,
            byte: byte,
            offset: null,
            name: name,
            value: 0
        });

    }

    /**
     * Reads input buffer and decodes each map process value
     * 
     * @param data - Device input buffer
     */
    _readMap(data: Buffer): void {
        this.mapping.forEach(map => {
            switch (map.size) {
            case 1:
                map.value = Boolean(data[map.byte] & (1 << map.offset));
                break;
            case 16:
                map.value = data.readUInt16LE(map.byte);
                break;
            }
        });
    }

    /**
     * Get a process value from a input buffer
     * 
     * @param name - Name of map item
     * @param buf - Device input buffer
     * @returns Process value
     */
    getValue(name: string, buf: Buffer): any {
        this._readMap(buf);
        return this.mapping.find(map => map.name === name).value;
    
    }

    /**
     * Get array of names assigned to mappings
     * 
     * @returns Array of names
     */
    getNames(): string[] {
        return this.mapping.map(item => item.name);
    }

}

export default InputMap;