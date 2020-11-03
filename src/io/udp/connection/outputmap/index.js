class OutputMap {
  constructor() {
    this.mapping = []
  }

  addBit(byte, offset, name, value = false) {
    this.mapping.push({
      size: 1,
      byte: byte,
      offset: offset,
      name: name,
      value: value
    });

  }

  addInt(byte, name, value = 0) {
    this.mapping.push({
      size: 16,
      byte: byte,
      name: name,
      value: value
    });

  }

  _writeMap(data) {
    this.mapping.forEach(map => {
      switch (map.size) {
        case 1:
          (map.value) ? data[map.byte] |= (1 << map.offset) : data[map.byte] &= ~(1 << map.offset);
          break;
        case 16:
          data.writeUInt16LE(map.value, map.byte);
          break;
      }
    })

    return data
  }

  setValue(name, value, data) {
    this.mapping[this.mapping.findIndex(map => map.name === name)].value = value;
    return this._writeMap(data);
  }

  getNames() {
    return this.mapping.map(item => item.name)
  }

 }

module.exports = OutputMap;