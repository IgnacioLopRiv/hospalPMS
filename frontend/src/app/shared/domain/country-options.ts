export interface CountryOption {
  code: string;
  nationality: string;
  countryName: string;
  callingCode: string;
}


const countryData: Array<[string, string, string]> = [
  ['AF', 'Afgana', '+93'], ['AL', 'Albanesa', '+355'], ['DE', 'Alemana', '+49'],
  ['AD', 'Andorrana', '+376'], ['AO', 'Angoleña', '+244'], ['AI', 'Anguilense', '+1'],
  ['AG', 'Antiguana', '+1'], ['SA', 'Saudí', '+966'], ['DZ', 'Argelina', '+213'],
  ['AR', 'Argentina', '+54'], ['AM', 'Armenia', '+374'], ['AW', 'Arubeña', '+297'],
  ['AU', 'Australiana', '+61'], ['AT', 'Austriaca', '+43'], ['AZ', 'Azerbaiyana', '+994'],
  ['BS', 'Bahameña', '+1'], ['BD', 'Bangladesí', '+880'], ['BB', 'Barbadense', '+1'],
  ['BH', 'Bareiní', '+973'], ['BE', 'Belga', '+32'], ['BZ', 'Beliceña', '+501'],
  ['BJ', 'Beninesa', '+229'], ['BM', 'Bermudeña', '+1'], ['BY', 'Bielorrusa', '+375'],
  ['BO', 'Boliviana', '+591'], ['BA', 'Bosnia', '+387'], ['BW', 'Botsuana', '+267'],
  ['BR', 'Brasileña', '+55'], ['BN', 'Bruneana', '+673'], ['BG', 'Búlgara', '+359'],
  ['BF', 'Burkinesa', '+226'], ['BI', 'Burundesa', '+257'], ['BT', 'Butanesa', '+975'],
  ['CV', 'Caboverdiana', '+238'], ['KH', 'Camboyana', '+855'], ['CM', 'Camerunesa', '+237'],
  ['CA', 'Canadiense', '+1'], ['QA', 'Catarí', '+974'], ['TD', 'Chadiana', '+235'],
  ['CL', 'Chilena', '+56'], ['CN', 'China', '+86'], ['CY', 'Chipriota', '+357'],
  ['CO', 'Colombiana', '+57'], ['KM', 'Comorense', '+269'], ['CG', 'Congoleña', '+242'],
  ['KP', 'Norcoreana', '+850'], ['KR', 'Surcoreana', '+82'], ['CI', 'Marfileña', '+225'],
  ['CR', 'Costarricense', '+506'], ['HR', 'Croata', '+385'], ['CU', 'Cubana', '+53'],
  ['DK', 'Danesa', '+45'], ['DM', 'Dominiquesa', '+1'], ['EC', 'Ecuatoriana', '+593'],
  ['EG', 'Egipcia', '+20'], ['SV', 'Salvadoreña', '+503'], ['AE', 'Emiratí', '+971'],
  ['ER', 'Eritrea', '+291'], ['SK', 'Eslovaca', '+421'], ['SI', 'Eslovena', '+386'],
  ['ES', 'Española', '+34'], ['US', 'Estadounidense', '+1'], ['EE', 'Estonia', '+372'],
  ['SZ', 'Suazi', '+268'], ['ET', 'Etíope', '+251'], ['PH', 'Filipina', '+63'],
  ['FI', 'Finlandesa', '+358'], ['FJ', 'Fiyiana', '+679'], ['FR', 'Francesa', '+33'],
  ['GA', 'Gabonesa', '+241'], ['GM', 'Gambiana', '+220'], ['GE', 'Georgiana', '+995'],
  ['GH', 'Ghanesa', '+233'], ['GI', 'Gibraltareña', '+350'], ['GD', 'Granadina', '+1'],
  ['GR', 'Griega', '+30'], ['GL', 'Groenlandesa', '+299'], ['GP', 'Guadalupeña', '+590'],
  ['GU', 'Guameña', '+1'], ['GT', 'Guatemalteca', '+502'], ['GF', 'Guayanesa francesa', '+594'],
  ['GG', 'Guerneseyense', '+44'], ['GN', 'Guineana', '+224'], ['GQ', 'Ecuatoguineana', '+240'],
  ['GW', 'Guineana de Guinea-Bisáu', '+245'], ['GY', 'Guyanesa', '+592'], ['HT', 'Haitiana', '+509'],
  ['HN', 'Hondureña', '+504'], ['HK', 'Hongkonesa', '+852'], ['HU', 'Húngara', '+36'],
  ['IN', 'India', '+91'], ['ID', 'Indonesia', '+62'], ['IQ', 'Iraquí', '+964'],
  ['IR', 'Iraní', '+98'], ['IE', 'Irlandesa', '+353'], ['IS', 'Islandesa', '+354'],
  ['IL', 'Israelí', '+972'], ['IT', 'Italiana', '+39'], ['JM', 'Jamaicana', '+1'],
  ['JP', 'Japonesa', '+81'], ['JE', 'Jerseyana', '+44'], ['JO', 'Jordana', '+962'],
  ['KZ', 'Kazaja', '+7'], ['KE', 'Keniana', '+254'], ['KG', 'Kirguisa', '+996'],
  ['KI', 'Kiribatiana', '+686'], ['KW', 'Kuwaití', '+965'], ['LA', 'Laosiana', '+856'],
  ['LS', 'Lesotense', '+266'], ['LV', 'Letona', '+371'], ['LB', 'Libanesa', '+961'],
  ['LR', 'Liberiana', '+231'], ['LY', 'Libia', '+218'], ['LI', 'Liechtensteiniana', '+423'],
  ['LT', 'Lituana', '+370'], ['LU', 'Luxemburguesa', '+352'], ['MO', 'Macaense', '+853'],
  ['MK', 'Macedonia', '+389'], ['MG', 'Malgache', '+261'], ['MY', 'Malasia', '+60'],
  ['MW', 'Malauí', '+265'], ['MV', 'Maldiva', '+960'], ['ML', 'Maliense', '+223'],
  ['MT', 'Maltesa', '+356'], ['MA', 'Marroquí', '+212'], ['MQ', 'Martiniquesa', '+596'],
  ['MU', 'Mauriciana', '+230'], ['MR', 'Mauritana', '+222'], ['YT', 'Mayotesa', '+262'],
  ['MX', 'Mexicana', '+52'], ['FM', 'Micronesia', '+691'], ['MD', 'Moldava', '+373'],
  ['MC', 'Monegasca', '+377'], ['MN', 'Mongola', '+976'], ['ME', 'Montenegrina', '+382'],
  ['MS', 'Montserratense', '+1'], ['MZ', 'Mozambiqueña', '+258'], ['MM', 'Birmana', '+95'],
  ['NA', 'Namibia', '+264'], ['NR', 'Nauruana', '+674'], ['NP', 'Nepalí', '+977'],
  ['NI', 'Nicaragüense', '+505'], ['NE', 'Nigerina', '+227'], ['NG', 'Nigeriana', '+234'],
  ['NU', 'Niuana', '+683'], ['NO', 'Noruega', '+47'], ['NC', 'Neocaledonia', '+687'],
  ['NZ', 'Neozelandesa', '+64'], ['OM', 'Omaní', '+968'], ['NL', 'Neerlandesa', '+31'],
  ['PK', 'Pakistaní', '+92'], ['PW', 'Palauana', '+680'], ['PS', 'Palestina', '+970'],
  ['PA', 'Panameña', '+507'], ['PG', 'Papú', '+675'], ['PY', 'Paraguaya', '+595'],
  ['PE', 'Peruana', '+51'], ['PN', 'Pitcairnesa', '+64'], ['PF', 'Polinesia francesa', '+689'],
  ['PL', 'Polaca', '+48'], ['PT', 'Portuguesa', '+351'], ['PR', 'Puertorriqueña', '+1'],
  ['GB', 'Británica', '+44'], ['CF', 'Centroafricana', '+236'], ['CZ', 'Checa', '+420'],
  ['DO', 'Dominicana', '+1'], ['RE', 'Reunionense', '+262'], ['RW', 'Ruandesa', '+250'],
  ['RO', 'Rumana', '+40'], ['RU', 'Rusa', '+7'], ['EH', 'Saharaui', '+212'],
  ['WS', 'Samoana', '+685'], ['AS', 'Samoana americana', '+1'], ['BL', 'Sanbartolomense', '+590'],
  ['KN', 'Sancristobaleña', '+1'], ['SM', 'Sanmarinense', '+378'], ['MF', 'Sanmartinense', '+590'],
  ['PM', 'Sanpedrina', '+508'], ['VC', 'Sanvicentina', '+1'], ['SH', 'Santaelenense', '+290'],
  ['LC', 'Santalucense', '+1'], ['ST', 'Santomense', '+239'], ['SN', 'Senegalesa', '+221'],
  ['RS', 'Serbia', '+381'], ['SC', 'Seychellense', '+248'], ['SL', 'Sierraleonesa', '+232'],
  ['SG', 'Singapurense', '+65'], ['SX', 'Sintmaartense', '+1'], ['SY', 'Siria', '+963'],
  ['SO', 'Somalí', '+252'], ['LK', 'Ceilanesa', '+94'], ['ZA', 'Sudafricana', '+27'],
  ['SD', 'Sudanesa', '+249'], ['SS', 'Sur-sudanesa', '+211'], ['SE', 'Sueca', '+46'],
  ['CH', 'Suiza', '+41'], ['SR', 'Surinamesa', '+597'], ['TH', 'Tailandesa', '+66'],
  ['TW', 'Taiwanesa', '+886'], ['TZ', 'Tanzana', '+255'], ['TJ', 'Tayika', '+992'],
  ['IO', 'Británica del Índico', '+246'], ['TF', 'Francesa de Tierras Australes', '+262'],
  ['TL', 'Timorense', '+670'], ['TG', 'Togolesa', '+228'], ['TK', 'Tokelauana', '+690'],
  ['TO', 'Tongana', '+676'], ['TT', 'Trinitense', '+1'], ['TN', 'Tunecina', '+216'],
  ['TM', 'Turcomana', '+993'], ['TC', 'Turcocaiqueña', '+1'], ['TR', 'Turca', '+90'],
  ['TV', 'Tuvaluana', '+688'], ['UA', 'Ucraniana', '+380'], ['UG', 'Ugandesa', '+256'],
  ['UY', 'Uruguaya', '+598'], ['UZ', 'Uzbeca', '+998'], ['VU', 'Vanuatuense', '+678'],
  ['VA', 'Vaticana', '+39'], ['VE', 'Venezolana', '+58'], ['VN', 'Vietnamita', '+84'],
  ['WF', 'Wallisiana', '+681'], ['YE', 'Yemení', '+967'], ['DJ', 'Yibutiana', '+253'],
  ['ZM', 'Zambiana', '+260'], ['ZW', 'Zimbabuense', '+263'], ['AX', 'Alandesa', '+358'],
];

const regionNames = new Intl.DisplayNames(['es'], { type: 'region' });
const latinAmericanCountryCodes = new Set([
  'ar', 'bo', 'br', 'cl', 'co', 'cr', 'cu', 'do', 'ec', 'gf', 'gt',
  'ht', 'hn', 'mx', 'ni', 'pa', 'pe', 'pr', 'py', 'sv', 'uy', 've',
]);

export const COUNTRY_OPTIONS: CountryOption[] = countryData
  .map(([code, nationality, callingCode]) => ({
    code: code.toLowerCase(),
    nationality,
    countryName: regionNames.of(code) ?? nationality,
    callingCode,
  }))
  .sort((a, b) => {
    if (a.code === 'cl') {
      return b.code === 'cl' ? 0 : -1;
    }
    if (b.code === 'cl') {
      return 1;
    }

    const aIsLatinAmerican = latinAmericanCountryCodes.has(a.code);
    const bIsLatinAmerican = latinAmericanCountryCodes.has(b.code);
    if (aIsLatinAmerican !== bIsLatinAmerican) {
      return aIsLatinAmerican ? -1 : 1;
    }

    return a.nationality.localeCompare(b.nationality, 'es');
  });
