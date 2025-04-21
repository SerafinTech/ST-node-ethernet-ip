const {extController} = require('../dist/index.js')


let c = new extController('192.168.1.10', 0, 50)

c.connect()

c.on('TagChanged', (tag, prevValue) => {
    console.log(tag.name, 'changed from', prevValue, '=>', tag.value)
})

let tagTests = [
    {
        name: 'TestUDT2[0]',
        program: 'MainProgram'
    },
    {
        name: 'TestUDT22[0]',
        program: 'MainProgram'
    },
    {
        name: 'string1'
    },
    {
        name: 'string2'
    }
]

tagTests.forEach(tagTest => {
    c.addTag(tagTest.name, tagTest.program, tagTest.arrayDims, tagTest.arraySize)
})

c.on('Connected', thisCont => {
    console.log('Connected',thisCont.ipAddress)
})

c.on('Disconnected', () => {
    console.log('Disconnected')
})

c.on('Error', e => {
    console.log(e)
})

c.on('TagUnknown', t => {
    console.log('TagUnknown', t.name)
    //Remove Unknown Tag
    c.removeTag(t.name, t.program)
})



