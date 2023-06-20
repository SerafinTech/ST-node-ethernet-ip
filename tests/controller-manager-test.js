const {ControllerManager} = require('../built/index.js')

let cm = new ControllerManager()

let c = cm.addController('192.168.121.10')

c.connect()
c.on('TagChanged', (tag, prevValue) => {
    console.log(tag.name, ' changed from ', prevValue, ' => ', tag.value)
})

let tagTests = [
    {
        name: 'TestUDT2[0]',
        program: 'MainProgram'
    },
    {
        name: 'TestUDT2[0].UDT1',
        program: 'MainProgram',
        arrayDims: 1,
        arraySize: 5
    },
    {
        name: 'TestUDT2[0].UDT1[0].STRING1',
        program: 'MainProgram',
        newValue: 'Test Completed'

    },

]

c.on('Connected', (thisCont) => {
    console.log('Connected',thisCont.ipAddress)
    tagTests.forEach(tagTest => {
        let tag = c.addTag(tagTest.name, tagTest.program, tagTest.arrayDims, tagTest.arraySize)
        tag.on('Initialized', (tg) => {
            console.log('Tag Init => ', tg.name, tg.value)
            if(tagTest.newValue) {           
                setTimeout(() => {
                    console.log('Tag Write => ', tg.name, tagTest.newValue)
                    tag.value = tagTest.newValue
                }, 1000)
            }
            console.log(cm.getAllValues())   
        })
    })
    
})

c.on('Disconnected', () => {
    console.log('Disconnected')
})

