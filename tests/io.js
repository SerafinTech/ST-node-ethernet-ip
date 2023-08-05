const { IO } = require("../dist/index.js")
let scanner = new IO.Scanner();

let config = {
    configInstance: {
      assembly: 120,
      size: 0
    },
    inputInstance: {
      assembly: 111,
      size: 22
    },
    outputInstance: {
        assembly: 103,
        size: 1
    }
};

let conn = scanner.addConnection(config, 50, '192.168.121.11')

setInterval(() => { console.log(conn.connected)}, 1000)