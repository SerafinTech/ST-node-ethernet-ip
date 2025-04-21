const eip = require('../dist/index.js');
const commTags = require('./plc_comm_tags.json');
const deepEqual = require('deep-equal');


if (process.argv.length > 2 ) {
    testSuite(process.argv[2]);
} else {
    console.log('Missing IP address argument.');
}

function testSuite(ipAddress){ 
    const PLC = new eip.Controller(true);
    let testsFailed = 0;
    let testsPassed = 0;
    PLC.connect(ipAddress, 0, true)
        .then(async () => {
            
            //Read Write Value Tag Test
            for (let test of commTags.tests) {
                let tag = PLC.newTag(test.tagDef.tagName, test.tagDef.program, false, test.tagDef.arrayDims, test.tagDef.arraySize);

                try {
                    await PLC.readTag(tag);
                    if (deepEqual(tag.value, test.startValue)) {
                        console.log('Read Tag ->', tag.name, ':', tag.value, 'Pass');
                        testsPassed++;

                    } else {
                        console.log('Read Tag ->', tag.name, ':', tag.value, 'Should Be: ', test.startValue, 'Fail');
                        testsFailed++;
                    }

                    if (test.testValue != null) {

                        tag.value = test.testValue

                        await PLC.writeTag(tag)
                        console.log('Write Tag ->', tag.name, ':', tag.value);
                        
                        await PLC.readTag(tag);
                        if (deepEqual(tag.value, test.testValue)) {
                            console.log('Read Tag ->', tag.name, ':', tag.value, 'Pass');
                            testsPassed++;

                        } else {
                            console.log('Read Tag ->', tag.name, ':', tag.value, 'Should Be: ', test.testValue, 'Fail');
                            testsFailed++;
                        }
                    }

                } catch (e) {
                    console.log(e, 'Fail');
                    testsFailed++;
                }
                
            }

            console.log(testsPassed, 'Tests Passed.');
            console.log(testsFailed, 'Tests Failed.');

            process.exit(0);
            
        })
        .catch(e => {
            console.log(e);
            process.exit(0);
        })
}
