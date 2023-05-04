export = Template;
declare class Template {
    _attributes: {};
    _members: any[];
    _name: string;
    _buildGetTemplateAttributesCIP(templateID: any): Buffer;
    _parseReadTemplateAttributes(data: any): void;
    _buildGetTemplateCIP(offset: number, reqSize: any): Buffer;
    _parseReadTemplate(data: any): void;
    _getTemplateAttributes(PLC: any, templateID: any): Promise<any>;
    id: any;
    _getTemplate(PLC: any): Promise<any>;
    getTemplate(PLC: any, templateID: any): Promise<any>;
}
//# sourceMappingURL=index.d.ts.map