const {Controller} = require("../dist/index.js")

let c = new Controller(false);

//Ethernet IP Device Get Parameter (E1 Plus Overload Relay)
c.connect('192.168.1.11', Buffer.from([]), false).then(async () => {

    let paramNum = 1;

    //Get parameter value
    let value = await c.getAttributeSingle(0x0f,paramNum,1).catch(e => {console.log(e)});

    //Get parameter name
    let name = await c.getAttributeSingle(0x0f,paramNum,7).catch(e => {console.log(e)});
    
    console.log(name.slice(1).toString(), value);
            
   
})