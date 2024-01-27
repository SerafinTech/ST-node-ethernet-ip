const {extController} = require('../dist/index.js')


let c = new extController('192.168.1.10', 0, 50)

c.connect()
c.on('TagChanged', (tag, prevValue) => {
    console.log(tag.name, ' changed from ', prevValue, ' => ', tag.value)
})

let tagTests = [
    {
        name: 'TestUDT2[0]',
        program: 'MainProgram'
    },
]

tagTests.forEach(tagTest => {
    let tag = c.addTag(tagTest.name, tagTest.program, tagTest.arrayDims, tagTest.arraySize)
})

c.on('Connected', (thisCont) => {
    console.log('Connected',thisCont.ipAddress)
})

c.on('Disconnected', () => {
    console.log('Disconnected')
})

c.on('Error', e => {
    console.log(e)
})



