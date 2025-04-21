const { IO } = require("../dist/index.js")
let scanner = new IO.ForkScanner();
let testConfigData = '0304010001000000000000000001010001\
000000000000000001030001000000000000000001030001000000000\
0000000010300010000000000000000010300010000000000000000010\
30001000000000000000001030001000000000000000001';

let configData = Buffer.from(testConfigData, 'hex')

let config = {
    configInstance: {
      assembly: 199,
      size: 98,
      data: configData
    },
    inputInstance: {
      assembly: 100,
      size: 446
    },
    outputInstance: {
        assembly: 150,
        size: 302
    }
};

let conn = scanner.addConnection(config, 50, '192.168.1.250')

setInterval(() => { console.log(conn.connected)}, 1000)