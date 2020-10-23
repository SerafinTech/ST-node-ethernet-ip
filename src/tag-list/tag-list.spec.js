const TagList = require("./index");

const responseData = Buffer.from("e70e00001e00486f774c6f6e6743616e596f754d616b65416e496e74656765724e616d65c400d1180000060054696d657232838ffa1b00000c004d61703a4c6f63616c454e4269103f2000000800496e746567657236c400202400000e004d61703a436f6e74726f6c6c65726910822500000900416e616c6f674f6e65ca00e92b00000800496e746567657233c4006831000006004269744f6e65c100b435000010004c6f6e67496e74656765724e616d6531c3003d3800000800496e746567657235c4002e3f0000280054686973496e74656765724e616d6549734576656e4c6f6e6765725468616e546865466972737431c400a54100000f004c6f6e67537472696e674e616d6531ce8f734a00000700537472696e6732ce8fec5000000a00546865496e7465676572c30024590000130050726f6772616d3a4d61696e50726f6772616d6810b96600002800546869734973416e6f746865724d6178696d756d4c656e6774685461674e616d6531313131313131c4004b7c00000800496e746567657234c400f8820000140050726f6772616d3a4d61696e50726f6772616d326810978a0000060042697454776fc100b09b00000700537472696e6731ce8f0ab400000700537472696e6733ce8f23b7000009004d61703a4c6f63616c6910", "hex");

describe("Tag List", () => {
    describe("Generate List Message Requests Method", () => {
        it("Generates Appropriate Output Instance 0", () => {
            const tagList = new TagList();

            expect(tagList._generateListMessageRequest(0)).toMatchSnapshot();
        });
    });

    describe("Parse Tag List Response Message", () => {
        it("Generates Appropriate Output", () => {
            const tagList = new TagList();

            tagList._parseAttributeListResponse(responseData);

            expect(tagList.tags).toMatchSnapshot();
        });
    });

    describe("Get Program Names", () => {
        it("Generates Appropriate Output", () => {
            const tagList = new TagList();

            tagList._parseAttributeListResponse(responseData);

            expect(tagList.programs).toMatchSnapshot();
        });
    });
});