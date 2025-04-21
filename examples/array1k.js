const {Controller, Tag, EthernetIP, Structure} = require("../dist/index.js")

let c = new Controller();

(async function (){
    await c.connect('192.168.1.10');
    let tag= new Tag('array1kREAL', 'MainProgram', undefined, 0, 1, 1000)
    await c.readTag(tag, 1000)
    
    console.log(tag.value)
    tag.value[999] = 1.23
    console.log(tag.value)
    await c.writeTag(tag)
    console.log(c.state.tagList)

    let tag2 = new Structure('BigStruct', c.state.tagList, 'MainProgram')

    await c.readTag(tag2)
    tag2.value.STUFF1[0] = 1;
    await console.log(tag2.value)

    await c.writeTag(tag2)
})();