class InputMap {
  constructor() {
    this.mapping = []
  }

  addBit(byte, offset, name) {
    this.mapping.push({
      size: 1,
      byte: byte,
      offset: offset,
      name: name,
      value: false
    });

  }

  addInt(byte, name) {
    this.mapping.push({
      size: 16,
      byte: byte,
      name: name,
      value: 0
    });

  }

  _readMap(data) {
    this.mapping.forEach(map => {
      switch (map.size) {
        case 1:
          map.value = Boolean(data[map.byte] & (1 << map.offset));
          break;
        case 16:
          map.value = data.readUInt16LE(map.byte);
          break;
      }
    })
  }

  getValue(name, buf) {
    this._readMap(buf)
    return this.mapping.find(map => map.name === name).value;
    
  }

  getNames() {
    return this.mapping.map(item => item.name)
  }

 }

module.exports = InputMap;