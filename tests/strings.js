const {Controller, Tag,  Structure} = require("../dist/index.js")

let c = new Controller(true);

(async function (){
    await c.connect('192.168.1.10');
    //let tag = new Structure('TestString', c.state.tagList, 'MainProgram')
    let tag = c.newTag('TestString', 'MainProgram')
    await c.readTag(tag)

    console.log(tag.value)

    tag.value = 'America... F*** YEAH!'

    await c.writeTag(tag)

    console.log(tag.value)
})();