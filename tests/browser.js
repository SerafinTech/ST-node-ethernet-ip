let Browser = require('../dist/index').Browser

let b = new Browser()

b.on('New Device', (d) => {
    console.log(d)
})