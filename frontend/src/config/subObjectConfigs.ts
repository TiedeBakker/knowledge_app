export interface ParameterConfig {
  code: string;
  label: string;
  id: string;
  defaultValue?: string;
  type?: 'text' | 'markdown' | 'file'; // Standaard is 'text' als dit ontbreekt
}

export interface SubObjectTypeConfig {
  typeKey: string;
  tabLabel: string;
  isBatch: boolean;
  relation1Id: string;
  relation2Id: string;
  objectTypeId: string;
  requiredParameters: ParameterConfig[];
  optionalParameters: ParameterConfig[];
}

export const SUB_OBJECT_CONFIGS: SubObjectTypeConfig[] = [
  {
    typeKey: 'tekstitem',
    tabLabel: '📝 Tekstitem',
    isBatch: true,
    relation1Id: '01a03afa-fa76-76de-a973-18d94bc873e3',
    relation2Id: '019fcdd3-721a-7512-b755-cddd67f43eb6',
    objectTypeId: '01a144fd-8c55-7d92-baa1-0a0716ce60fb',
    requiredParameters: [
      { 
        code: 'tekstblok', 
        label: 'Tekstblok HTML', 
        id: '01a0d3ba-c761-755a-b6c4-537c29a5e902', 
        defaultValue: '<p>Tekstblok</p>',
        type: 'markdown' 
      }
    ],
    optionalParameters: []
  },
  {
    typeKey: 'boek',
    tabLabel: '📚 Boek',
    isBatch: false,
    relation1Id: '01a014fc-6b2a-7447-b643-740bc09ad213',
    relation2Id: '019fcdd3-721a-7512-b755-cddd67f43eb6',
    objectTypeId: '019fcd20-b1ae-703f-9f24-4ec5fb070853',
    requiredParameters: [
      { code: 'titel', label: 'Titel', id: '019fc8a4-acc9-70a9-942c-102b841e80a4', type: 'text' },
      { code: 'auteurs', label: 'Auteurs', id: '01a15622-90fa-7701-8095-fafa2323b698', type: 'text' }
    ],
    optionalParameters: [
      { 
        code: 'digitale_vindplaats', 
        label: 'Digitale vindplaats', 
        id: '01a01502-63bb-73a3-89bb-43ecc89c2201', 
        type: 'file' // Maakt gebruik van de bestandsbrowser / URL-conversie
      },
      { 
        code: 'ondertitel', 
        label: 'Ondertitel', 
        id: '019fc8a4-e6ff-7426-a21c-ad228f031ad2', 
        type: 'text' 
      }
    ]
  },
  {
    typeKey: 'digdoc',
    tabLabel: '📚 Digitaal document',
    isBatch: false,
    relation1Id: '01a014fc-6b2a-7447-b643-740bc09ad213',
    relation2Id: '019fcdd3-721a-7512-b755-cddd67f43eb6',
    objectTypeId: '019fcd20-b1ae-703f-9f24-4ec5fb070853',
    requiredParameters: [
      { code: 'titel', label: 'Titel', id: '019fc8a4-acc9-70a9-942c-102b841e80a4', type: 'text' }
    ],
    optionalParameters: [
      { 
        code: 'digitale_vindplaats', 
        label: 'Digitale vindplaats', 
        id: '01a01502-63bb-73a3-89bb-43ecc89c2201', 
        type: 'file' // Maakt gebruik van de bestandsbrowser / URL-conversie
      },
      { 
        code: 'ondertitel', 
        label: 'Ondertitel', 
        id: '019fc8a4-e6ff-7426-a21c-ad228f031ad2', 
        type: 'text' 
      },
       { 
        code: 'auteurs', 
        label: 'Auteurs', 
        id: '01a15622-90fa-7701-8095-fafa2323b698',
        type: 'text' }
    ]
  },
  {
    typeKey: 'tijdlijnitem',
    tabLabel: '📚 Tijdlijn punt',
    isBatch: false,
    relation1Id: '01a014fc-6b2a-7447-b643-740bc09ad213',
    relation2Id: '019fcdd3-721a-7512-b755-cddd67f43eb6',
    objectTypeId: '01a0f456-eda8-7f2a-814c-9b07d9b66b0c',
    requiredParameters: [
      { code: 'tijdlijn item', label: 'Tijdlijn punt', id: '01a0d3ba-c761-755a-b6c4-537c29a5e902', defaultValue: '<p>dd-mm-yyyy:</p>', type: 'markdown' }
    ],
    optionalParameters: [
      { 
        code: 'digitale_vindplaats',                            // geen functie
        label: 'Document',                           // label bij invoerveld
        id: '01a01502-63bb-73a3-89bb-43ecc89c2201',             // parameter_id
        type: 'file' // Maakt gebruik van de bestandsbrowser / URL-conversie
      }
    ]
  }
];