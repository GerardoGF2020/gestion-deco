// Datos iniciales: catálogo ferial (pabellón Azul) + compra de ejemplo de Petite Affaire.
// Los ids son determinísticos y updatedAt fijo, así dos dispositivos que importan el seed
// no generan duplicados al sincronizar.

export function normTel(raw) {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length === 12 && d.startsWith('591')) d = '54' + d.slice(1); // typo detectado en el catálogo (+591…)
  if (d.startsWith('54')) {
    d = d.slice(2);
    if (d.length === 11 && d[0] === '9') return '+54' + d;
  }
  if (d.startsWith('0')) d = d.slice(1);
  if (d.length === 12 && d.slice(2, 4) === '15') d = d.slice(0, 2) + d.slice(4); // área + 15 + número
  if (d.length === 11 && d[0] === '9') return '+54' + d;
  if (d.length === 10) return '+549' + d;       // celular con característica
  if (d.length === 8) return '+5411' + d;       // fijo de CABA sin característica
  return '+' + d;
}

export function normInsta(raw) {
  const v = String(raw ?? '').trim();
  if (!v || /^n\/?a$/i.test(v)) return null;
  return v.replace(/^@/, '');
}

const CAT_MAP = { Mobiliario: 'Muebles' };

function P(id, nombre, stand, categoria, subs, prods, tels, ig, mats = [], kw = []) {
  let cat = CAT_MAP[categoria] || categoria;
  let subcategorias = [...subs];
  if (cat === 'Aromas') { cat = 'Decoración'; if (!subcategorias.includes('Aromas')) subcategorias.unshift('Aromas'); }
  return {
    id, nombre, stand: String(stand), pabellon: 'Azul', categoria: cat,
    subcategorias, materiales: mats, productos: prods, palabrasClave: kw,
    telefonos: tels.map(normTel).filter(Boolean), instagram: normInsta(ig),
    estado: 'sin_contactar', favorito: false, notas: '',
    updatedAt: 1, updatedBy: 'seed',
  };
}

const CATALOGO = [
  P('abril-home-deco', 'Abril Home Deco', 126, 'Decoración', ['Macetas', 'Jardinería'], ['Macetas rotomoldeadas en varios tamaños y modelos para interior y exterior'], ['3516156817'], '@abrilhomedeco', ['Plástico rotomoldeado', 'Liviano', 'Resistente'], ['macetas rotomoldeadas', 'jardinería', 'macetones', 'plantas de interior', 'macetas livianas']),
  P('al-telar', 'Al Telar', 261, 'Textil', ['Alfombras', 'Almohadones', 'Mantas'], ['Alfombras artesanales de algodón', 'Tusor', 'Almohadones', 'Mantas', 'Cobertores'], ['01136024172', '1135867819'], '@al.telar', ['Algodón artesanal', 'Tusor'], ['alfombras de algodón', 'textiles de telar', 'almohadones tusor']),
  P('alamada', 'Alamada', 267, 'Muebles', ['Iluminación', 'Living'], ['Sillones', 'Mesas ratonas', 'Lámparas de pie', 'Percheros metálicos', 'Estanterías flotantes'], ['+5491150152542'], '@casa.alamada', ['Metal', 'Tapicería textil'], ['muebles de diseño', 'mobiliario moderno']),
  P('alcarpintero', 'Alcarpintero', 268, 'Decoración', ['Bazar', 'Madera', 'Herrería'], ['Fanales con estructura de hierro', 'Centros de mesa', 'Tablas de cocina', 'Organizadores'], ['+5491154200863'], '@Alcarpintero', ['Madera de álamo', 'Hierro', 'Vidrio'], ['carpintería artesanal', 'fanales de madera']),
  P('alchemyst', 'Alchemyst Design Studio', 278, 'Decoración', ['Empapelados', 'Textil'], ['Empapelados de autor', 'Murales artísticos', 'Mantas estampadas'], ['5491169952113'], '@alchemystba', ['Papel vinílico mural', 'Géneros textiles'], ['empapelados de diseño', 'murales decorativos']),
  P('aldea-lobos', 'Aldea Lobos', 148, 'Iluminación', ['Veladores', 'Lámparas'], ['Lámparas de mesa', 'Veladores de diseño', 'Lámparas de techo', 'Pantallas textiles'], ['+5491128747827'], '@aldea.lobos', ['Cerámica texturada', 'Metal'], ['lámparas de mesa', 'veladores modernos']),
  P('alejandro-sialle', 'Alejandro Sialle', 226, 'Decoración', ['Platería', 'Regalería'], ['Copetineros', 'Mates cincelados', 'Portarretratos', 'Cajas de madera y metal'], ['01175368400'], '@alejandrosialle', [], ['platería criolla', 'artesanías en alpaca']),
  P('alhambra', 'Alhambra', 134, 'Textil', ['Telas', 'Tapicería'], ['Telas para tapicería', 'Géneros chevron/zigzag'], ['1142023905'], '@alhambra.telas', [], ['telas de tapicería']),
  P('alina-hegi', 'Alina Hegi', 276, 'Muebles', ['Decoración Étnica'], ['Sillones y mecedoras de ratán', 'Vasijas de terracota', 'Antigüedades asiáticas'], ['5491122702009'], '@alinahegi', [], ['muebles de ratán']),
  P('allegra-home', 'Allegra Home', 149, 'Textil', ['Mantelería', 'Bazar de Mesa'], ['Manteles antimanchas', 'Servilletas', 'Portacubiertos', 'Toallas', 'Cortinas de baño'], ['3482604191'], '@allegrahome', [], ['mantelería antimanchas', 'servilletas de algodón']),
  P('alma-dusha', 'Alma Dusha', 287, 'Decoración', ['Herrería'], ['Cartelería calada láser', 'Candelabros', 'Canastos de chapa', 'Petit muebles', 'Fogoneros'], ['5491121828720'], '@alma_dusha'),
  P('alparamis', 'Alparamis', 277, 'Decoración', ['Navidad', 'Regalería'], ['Muñecos navideños', 'Gnomos nórdicos', 'Árboles de navidad luminosos', 'Adornos'], ['+54-11-7078-4001'], '@alparamiskids_mayorista'),
  P('amazonica', 'Amazónica', 136, 'Cerámica', ['Bazar Ilustrado'], ['Vajilla ilustrada', 'Abanicos de autor', 'Pins metálicos esmaltados', 'Cuadros'], ['1158405921'], '@soyAmazonica'),
  P('ara-designs', 'ARA Designs', 280, 'Sanitarios', ['Bachas', 'Baño'], ['Bachas orgánicas de apoyo', 'Bachas con desagüe oculto', 'Pies metálicos'], ['+5491124006175'], '@aradesigns.color'),
  P('arak-madu', 'Arak Madu S.R.L.', 240, 'Decoración', ['Cestería', 'Fibras Naturales'], ['Maceteros cilíndricos forrados en soga', 'Espejos con marco de rafia', 'Hojas de pared'], ['+5491123344037'], '@arak_madu'),
  P('arko-supply', 'Arko Supply', 259, 'Muebles', ['Exterior', 'Jardín'], ['Juegos de living para exterior', 'Mesas de comedor de jardín', 'Reposeras para piscina'], ['1136565070'], '@arko.supply'),
  P('arte-a-mano-puro', 'Arte a Mano Puro', 213, 'Textil', ['Telar', 'Almohadones'], ['Almohadones tejidos', 'Mantas artesanales', 'Pie de cama', 'Géneros en texturas'], ['01169341155'], '@arteamano_purotextil'),
  P('artistica-galileo', 'Artística Galileo', 117, 'Iluminación', ['Decoración'], ['Lámparas colgantes LED sinuosas', 'Veladores de cerámica', 'Difusores aromáticos', 'Jarrones'], ['5491132514083'], '@artisticagalileo'),
  P('atrevete-home-deco', 'Atrévete Home & Deco', 209, 'Textil', ['Bazar de Mesa', 'Navidad'], ['Platos de sitio ilustrados', 'Servilletas', 'Estrellas de hierro', 'Manteles', 'Caminos de mesa'], ['1126325322'], '@atrevete_home_deco'),
  P('aurora-house', 'Aurora House', 212, 'Iluminación', ['Lámparas', 'Mimbre'], ['Lámparas colgantes cónicas grandes', 'Veladores con pantallas de esterilla', 'Lámparas de escritorio articuladas'], ['1168768690'], '@aurorahouse.ar'),
  P('avc-interiores', 'AVC Interiores', 110, 'Muebles', ['Living', 'Comedor'], ['Sillones modulares', 'Mesas ratonas', 'Mesas auxiliares', 'Banquetas tapizadas'], ['5491161255635'], '@avc.interiores'),
  P('bait-pisos-deco', 'Bait Pisos & Deco', 128, 'Revestimientos', ['Pisos', 'Paneles'], ['Placas de PVC símil mármol', 'Wall panels', 'Pisos SPC', 'Revestimientos de exterior'], ['1152725140'], '@baitpisos'),
  P('bello-export', 'Bello Export', 160, 'Bazar', ['Asado', 'Regalos Corporativos'], ['Bolsos materos', 'Sets para asado', 'Tablas gourmet', 'Cuchillería artesanal'], ['543534118426'], '@belloexport'),
  P('berry-design', 'Berry Design', 200, 'Decoración', ['Empapelados', 'Textil'], ['Empapelados y murales', 'Alfombras vinílicas', 'Telas estampadas', 'Tote bags'], ['1150571898'], '@berry_design'),
  P('blossom-market', 'Blossom Market', 262, 'Decoración', ['Florería', 'Vidrio'], ['Floreros de vidrio soplado/ámbar', 'Flores artificiales', 'Esculturas decorativas', 'Cuencos'], ['5491131663868'], '@blossommarkett'),
  P('blume-design', 'Blume Design', 129, 'Textil', ['Almohadones', 'Camas'], ['Almohadones bordados y estampados', 'Fundas de almohadón con vivo', 'Mantas'], ['541169582829'], '@blumedesigndeco'),
  P('bonn-deco', 'Bonn Deco', 132, 'Decoración', ['Espejos', 'Cuadros'], ['Espejos con arco de medio punto', 'Espejos de pie rectangulares', 'Espejos ovalados para vanitory', 'Cuadros'], ['49814564'], '@bonndeco_'),
  P('borlas-chic', 'Borlas Chic', 247, 'Bazar', ['Cristalería', 'Decoración'], ['Jarras de vidrio estriado', 'Copas y vasos de color', 'Compoteras', 'Borlas decorativas', 'Platos de sitio', 'Manteles'], ['+5493564588716'], '@borlaschic'),
  P('borot', 'Borot', 121, 'Mobiliario', ['Organización', 'Pegboards'], ['Paneles organizadores perforados (Pegboards)', 'Estantes encastrables', 'Ganchos portaherramientas'], ['1166662657'], '@borot.ok'),
  P('bosco', 'Bosco', 272, 'Decoración', ['Macetas', 'Aromas'], ['Macetas rotomoldeadas esféricas', 'Difusores Botany', 'Canastos plásticos simil mimbre', 'Floreros'], ['0341-495-8700'], '@boscoargentina'),
  P('botany-buenos-aires', 'Botany Buenos Aires', 227, 'Decoración', ['Aromas', 'Cosmética'], ['Home spray', 'Velas de cera de soja', 'Difusores de varillas', 'Esencias', 'Jabón líquido'], ['1122807278'], '@botany.bsas'),
  P('brimpex-iluminacion', 'Brimpex Iluminación', 206, 'Iluminación', ['Veladores', 'Apliques'], ['Lámparas de mesa cónicas orientables', 'Veladores de hongo', 'Apliques de pared extensible acordeón'], ['46522800'], 'N/A'),
  P('broderi-manteles', 'Broderi Manteles Impermeables', 111, 'Textil', ['Mantelería', 'Playa'], ['Manteles de gabardina impermeable', 'Lonas circulares para playa', 'Lonas de picnic'], ['1162966000'], '@broderi.manteles'),
  P('cadmia', 'Cadmia', 151, 'Textil', ['Almohadones', 'Telas'], ['Almohadones botánicos', 'Fundas bicolor', 'Géneros textiles por metro exclusivos'], ['+5491124712225'], '@cadmiahome'),
  P('casa-manica', 'Casa Manica', 230, 'Textil', ['Alfombras', 'Tapices'], ['Alfombras orientales tradicionales', 'Tapices de pared', 'Alfombras alto tránsito'], ['3512373016'], '@casamanica'),
  P('casa-nunez', 'Casa Nuñez', 282, 'Muebles', ['Exterior', 'Línea Nardi'], ['Sillones para exterior Nardi', 'Sofás esquineros outdoor', 'Sillones altos con apoyapiés', 'Mesas de centro'], ['01145818117'], '@casanunez'),
  P('casi-un-angel-deco', 'Casi Un Ángel Deco', 222, 'Decoración', ['Arte Textil', 'Esculturas'], ['Esculturas textiles de nudos y borlas gigantes', 'Jarrones de cerámica texturada', 'Cuencos de madera', 'Canastos'], ['5492215736756'], '@casiunangel_deco'),
  P('chapita-deco', 'Chapita Deco', 251, 'Decoración', ['Herrería', 'Jardín'], ['Mandalas calados de pared', 'Fanales de chapa con diseños', 'Tutores y estacas florales para plantas'], ['5493562565475'], '@chapitadeco'),
  P('claudia-adorno', 'Claudia Adorno', 201, 'Bazar', ['Madera', 'Textiles', 'Baño'], ['Tablas de corte y presentación con asas', 'Cuencos y cubiertos de madera', 'Repasadores bordados', 'Accesorios de baño'], ['1147272626'], '@claudiaadornooficial'),
  P('cocomax', 'Cocomax', 154, 'Muebles', ['Sillas', 'Exterior'], ['Sillas parisinas tipo bistró', 'Sillas de policarbonato de colores', 'Sofás y camastros de ratán', 'Sombrillas a rayas'], ['5491141604702'], '@twbuenosaires'),
  P('comba', 'Comba', 161, 'Accesorios de Baño', ['Organización', 'Muebles Auxiliares'], ['Toalleros repisa de pared', 'Dispensers de jabón', 'Canastos de ropa de bambú', 'Percheros escalera', 'Tachos de baño'], ['1140511353'], '@comba.home'),
  P('compania-de-brujas', 'Compañía de Brujas', 260, 'Textil', ['Mantelería', 'Dormitorio'], ['Manteles con flecos y borlas', 'Pies de cama', 'Almohadones bordados', 'Fundas de edredón', 'Bolsitas aromáticas'], ['91140261662'], '@companiadebrujas'),
  P('component-new-house', 'Component New House', 263, 'Decoración', ['Bazar', 'Muebles'], ['Campanas y fanales de vidrio', 'Velas en cuencos de madera', 'Jarrones de vidrio esfumado', 'Mesas bajas', 'Espejos'], ['45845953'], '@component_yz'),
  P('contemporary-deco', 'Contemporary Deco', 152, 'Decoración', ['Candelabros', 'Bazar Metálico'], ['Candelabros metálicos de diseño', 'Floreros de aluminio de color', 'Bandejas', 'Bowls', 'Mesas ratonas orgánicas'], ['1155050097'], '@contemporarydeco'),
  P('craft-iluminacion', 'Craft Iluminación', 125, 'Iluminación', ['Veladores', 'Lámparas'], ['Lámparas de mesa con cúpula metálica', 'Veladores con esferas de cristal', 'Lámparas con base cromada tipo gota', 'Lámparas de pie'], ['5491166337427'], '@craft_dec2'),
  P('credrink', 'Credrink', 253, 'Bazar', ['Termos', 'Vasos Térmicos'], ['Termos de acero inoxidable con manija', 'Vasos térmicos con sorbete tipo tumbler', 'Mates térmicos con bombilla'], ['+5493329593024'], 'N/A'),
  P('crista-mas', 'Crista Más', 257, 'Iluminación', ['Luminarias Artísticas', 'Madera'], ['Lámparas escultóricas esferoidales', 'Veladores con cilindros de madera apilados', 'Lámparas de pie trípode'], ['01154641928'], '@crista+mas'),
  P('cristal-san-martin', 'Cristal San Martín', 133, 'Bazar', ['Cristalería', 'Copas'], ['Copas de vino de cristal', 'Vasos de whisky labrados pesados', 'Copones para cocktails', 'Servicio de tallado y grabado'], ['47548014'], '@cristalsanmartin.arg'),
  P('cueros-especiales', 'Cueros Especiales', 215, 'Muebles', ['Tapicería en Cuero', 'Living'], ['Sillones Chesterfield capitoné', 'Sofás esquineros de cuero vacuno', 'Sillones individuales'], ['1164486916'], '@cueros_especiales'),
  P('cura-te-alma', 'Cura Té Alma', 124, 'Gastronomía', ['Té Gourmet', 'Yerba Mate', 'Regalería'], ['Blends de té en hebras', 'Blends de yerba mate con flores y frutas', 'Tisanas', 'Estuches de regalo'], ['3584223958'], '@curatealma'),
  P('datelux', 'Datelux', 114, 'Iluminación', ['Lámparas Colgantes', 'Apliques'], ['Lámparas colgantes circulares/cilíndricas', 'Colgantes tipo tulipa orgánica en racimo', 'Apliques de pared'], ['48551212'], '@dateluxok'),
  P('decosas', 'Decosas', 103, 'Bazar', ['Organización', 'Estilo Industrial'], ['Cajoncitos organizadores de madera', 'Paneras de tela con asas', 'Pequeños muebles industriales', 'Estanterías'], ['+5491144077038'], '@decosas_'),
  P('desde-asia', 'Desde Asia', 214, 'Muebles', ['Decoración Oriental', 'Iluminación'], ['Sillas de comedor de ratán', 'Lámparas colgantes de fibra negra', 'Jarrones de madera torneada', 'Banquetas'], ['+5491131674471'], '@desde_asia'),
  P('disegno-primo', 'Disegno Primo', 157, 'Herrajes', ['Cortinería', 'Barrales'], ['Sistemas de barrales para cortinas', 'Terminales y soportes decorativos', 'Colgantes con mariposas', 'Percheros de hierro'], ['1126730866'], '@disegnoprimo'),
  P('diversa-ceramica', 'Diversa Cerámica', 208, 'Cerámica', ['Arte Sacro', 'Iluminación'], ['Macetas cilíndricas rayadas', 'Esculturas de arte sacro y espiritual', 'Lámparas de cerámica', 'Cuencos'], ['+5492494248952'], '@diversa_ceramica'),
  P('ebony', 'Ebony', 248, 'Muebles', ['Comedor', 'Alta Gama'], ['Mesas de comedor con tapa de mármol', 'Mesas con base de madera estriada', 'Sillas tapizadas', 'Sillones individuales', 'Banquetas'], ['01145857857'], '@ebonymueblesok'),
  P('eclectica-diseno', 'Ecléctica Diseño', 141, 'Bazar', ['Madera Torneada', 'Cuero'], ['Cucharas y utensilios de madera torneada', 'Bolsos tipo canasta de cuero trenzado', 'Cuencos torneados', 'Piezas de barro'], ['3516312332'], '@eclectica.diseno'),
  P('el-mueble', 'El Mueble S.R.L.', 243, 'Muebles', ['Ebanistería', 'Diseño de Autor'], ['Mesas bajas/ratonas tipo hongo', 'Butacas con curvas de madera maciza', 'Mesas auxiliares orgánicas'], ['1168781969'], '@elmueblesrl'),
  P('elsata', 'Elsata', 115, 'Cerámica', ['Vajilla', 'Decoración'], ['Vajilla con flores y bordes ondeados', 'Cuencos martillados', 'Arbolitos navideños de cerámica', 'Macetas geométricas', 'Figuras de rinocerontes'], ['+54-113438-6000'], '@elsatavajilla'),
  P('emilia-zeta', 'Emilia Zeta', 203, 'Cerámica', ['Objetos Escultóricos', 'Florería'], ['Figuras de rinocerontes en blanco y negro', 'Floreros acanalados verticales', 'Macetas poliédricas', 'Vajilla'], ['5491134055806'], '@emiliazetahome'),
  P('estilo-domingo', 'Estilo Domingo', 269, 'Decoración', ['Navidad', 'Madera'], ['Estrellas caladas iluminadas', 'Pesebres de madera', 'Aldeas navideñas', 'Casitas y arbolitos para armar'], ['3472546816'], '@estilo.domingo'),
  P('etnica-ideas', 'Etnica Ideas', 127, 'Decoración', ['Holística', 'Lámparas de Sal'], ['Lámparas de sal del Himalaya (Khewla)', 'Sahumerios', 'Cartas de tarot', 'Sales aromáticas', 'Sahumos'], ['+5491164976706'], '@etnicaideas'),
  P('eukene-deco', 'Eukene Deco', 156, 'Decoración', ['Flores Textiles', 'Aromas'], ['Ramos de flores textiles combinados', 'Difusores aromáticos con flores para colgar', 'Tarjetas perfumadas'], ['1123554342'], '@eukenedeco'),
  P('ferchetto', 'Ferchetto', 283, 'Bazar', ['Cristalería', 'Vasos de Autor'], ['Vasos de vidrio soplado con forma de botella cortada para fernet/tragos'], ['+5493834909067'], '@ferchetto.ok'),
  P('forevents', 'Forevents', 207, 'Muebles', ['Eventos', 'Exterior', 'Gastronomía'], ['Mesas redondas con pie cónico', 'Sillas metálicas de varilla', 'Sombrillas para exterior', 'Sillones modulares'], ['1164331266'], '@forevents_'),
  P('galpon', 'Galpón', 244, 'Muebles', ['Living', 'Ebanistería'], ['Sillones de 3 cuerpos', 'Poltronas giratorias en bouclé', 'Vajilleros con puertas de vidrio', 'Mesas ratonas orgánicas'], ['3564508778'], '@galponmuebles'),
  P('ganeshas', "Ganesha's", 223, 'Bazar', ['Bandejas', 'Regalería Ilustrada'], ['Bandejas estampadas con leopardos y palmeras', 'Cuencos de madera con ensaladeras ilustradas', 'Cajas decorativas', 'Especieros'], ['1159060581'], '@ganeshas.argentina'),
  P('gcf-design', 'GCF Design', 155, 'Decoración', ['Empapelados', 'Murales'], ['Murales botánicos de gran formato', 'Empapelados de selva y follaje', 'Murales industriales'], ['1131742347'], '@gcfdesign'),
  P('grumsdelg', 'Grumsdelg', 120, 'Muebles', ['Iluminación', 'Decoración'], ['Mesas de comedor orgánicas', 'Consolas de madera maciza', 'Espejos con marco ancho', 'Lámparas con pantalla estampada', 'Cuadros con mariposas'], ['3515057582'], '@grumsdelg'),
  P('gurru-chaga', 'Gurru & Chaga', 265, 'Decoración', ['Cuadros', 'Cerámica'], ['Cuadros enmarcados de mariposas y escarabajos', 'Lámparas con pantallas ilustradas', 'Objetos de vidrio pintado', 'Jarrones'], ['+5491158641671'], '@gurruychaga'),
  P('hakken', 'Häkken', 112, 'Bazar', ['Cocina', 'Tablas de Corte'], ['Tablas de fibras de madera antibacterianas', 'Cuchillos de cocina y asado', 'Contenedores plegables herméticos'], ['+541131909300'], '@hakken.design'),
  P('hebras-handmade', 'Hebras Handmade', 159, 'Iluminación', ['Lámparas Tejidas', 'Artesanal'], ['Lámparas colgantes tejidas a mano', 'Pantallas con guardas a rayas y flecos', 'Lámparas de pie cilíndricas'], ['2215700991'], '@hebras_handmade'),
  P('hedan', 'Hedan Estudio de Diseño', 270, 'Decoración', ['Tufting', 'Arte Textil'], ['Cuadros en relieve con técnica tufting', 'Murales textiles geométricos', 'Lienzos con trazos orgánicos en relieve'], ['01150641144'], '@HEDAN.decor'),
  P('hogar-actual', 'Hogar Actual', 143, 'Bazar', ['Organización', 'Lavandería'], ['Secaplatos sobre bacha de 2 niveles', 'Especieros giratorios', 'Tenders para ropa de torre y plegables', 'Baldes con mopa', 'Tachos de basura'], ['1139479990'], '@hogaractual.arg'),
  P('hometh', 'Hometh', 158, 'Textil', ['Alfombras', 'Fibras'], ['Alfombras bouclé grano de arroz', 'Alfombras de yute teñidas y crudas', 'Tapetes pesados'], ['1164319411'], '@homethweb'),
  P('improm', 'Improm SA', 245, 'Bazar', ['Botellas Térmicas', 'Outdoor'], ['Botellas térmicas de acero inoxidable', 'Vasos térmicos tipo mug', 'Mochilas Leaf Country', 'Sets de asado Poncho Pampa'], ['01139854693'], 'N/A'),
  P('intermobili', 'Intermobili', 211, 'Muebles', ['Exterior de Lujo', 'Pérgolas'], ['Sofás de exterior curvos (Talenti, Vondom)', 'Pérgolas bioclimáticas', 'Outdoor kitchens', 'Plantas artificiales premium'], ['49819000'], '@intermobilik'),
  P('joseph-joseph', 'Joseph Joseph', 246, 'Bazar', ['Organización', 'Cocina'], ['Tablas de planchar compactas de pared', 'Cestos de ropa compartimentados', 'Tachos de reciclaje', 'Organizadores de bacha'], ['+591158759820'], '@joseph_josepharg'),
  P('junko', 'Junko', 118, 'Decoración', ['Plantas Artificiales', 'Florería'], ['Plantas artificiales de gran porte (Alocasias, Higueras)', 'Floreros acanalados crudos', 'Cuadros botánicos', 'Velas aromáticas'], ['5491121713672'], '@junko_deco'),
  P('kala-aromas', 'Kala Aromas', 242, 'Decoración', ['Aromas', 'Cosmética'], ['Difusores en frascos cerámicos', 'Velas en cuencos de cerámica (Saffron, Honey Nectarine)', 'Frascos con campana'], ['1142494398'], '@kalaaromas'),
  P('la-pasionaria', 'La Pasionaria', 142, 'Aromas', ['Cosmética', 'Cuidado Personal'], ['Velas con campana de cristal', 'Home sprays ambarinos', 'Jabones aromáticos', 'Productos para cuidado de la piel'], ['03414432731'], '@lapasionariaargentina'),
  P('lampsilver', 'Lampsilver', 275, 'Iluminación', ['Escultóricas', 'Herrería'], ['Lámpara colgante orgánica MOON', 'Lámparas colgantes circulares de varillas negras', 'Lámparas de pie'], ['1162446973'], '@lampsilver'),
  P('leder', 'Leder', 100, 'Muebles', ['Cueros Naturales', 'Alfombras'], ['Sillones en cuero suela', 'Sillas BKF con cuero vacuno con pelo', 'Alfombras de piel de oveja', 'Mesas de tronco', 'Almohadones'], ['1151845878'], '@Leder_hd'),
  P('lola-deco', 'Lola Deco', 274, 'Muebles', ['Sillones', 'Tapicería'], ['Sofás de líneas rectas con fundas de lino', 'Butacas curvas tapizadas en bouclé', 'Respaldos de cama', 'Textiles'], ['1131575391'], '@loladecoarg'),
  P('luces-candles-home', 'Luces Candles & Home', 131, 'Decoración', ['Velas', 'Aromas'], ['Velas de soja en cuencos cerámicos', 'Difusores de varillas en botellas de vidrio', 'Home sprays', 'Jabones líquidos'], ['2346595343'], '@lucescandleshome'),
  P('ma-va-cuadros', 'Ma-Va Cuadros', 108, 'Decoración', ['Cuadros', 'Espejos'], ['Cuadros abstractos sobre arpillera con relieve blanco', 'Dípticos orgánicos neutros', 'Espejos decorativos'], ['5492914439953'], '@mavacuadros'),
  P('maki-warmi', 'Maki Warmi', 264, 'Textil', ['Alfombras', 'Almohadones'], ['Almohadones redondos de lana con pompones', 'Alfombras de telar a medida', 'Mantas de telar', 'Tapices'], ['1157530020'], '@maki_warmi'),
  P('mamachitas', 'Mamachitas', 279, 'Textil', ['Terapéutico', 'Ilustración'], ['Almohaditas terapéuticas de semillas y lavanda', 'Muñecas de lienzo serigrafiadas', 'Saquitos aromáticos'], ['2944231149'], '@mamachitas.ar'),
  P('mambo-arte-en-uso', 'Mambo Arte en Uso', 281, 'Muebles', ['Arte', 'Objetos Escultóricos'], ['Aparadores de madera tallados en espiga', 'Biombos con tramas en relieve azul y dorado', 'Lámparas escultóricas'], ['3515218946'], '@mambo.arte'),
  P('mantas-de-llama', 'Mantas de Llama', 216, 'Textil', ['Fibras Naturales', 'Mantas'], ['Mantas de pura fibra natural con correas de cuero', 'Chales', 'Pies de cama con flecos', 'Almohadones'], ['47665996'], '@mantasdellama'),
  P('marana-deco', 'Maraña Deco', 130, 'Iluminación', ['Veladores', 'Colgantes'], ['Lámparas colgantes curvas con interior dorado', 'Veladores cilíndricos con globo de vidrio', 'Apliques', 'Candelabros'], ['+541165052654'], '@maraniadeco'),
  P('marhaba-home', 'Marhaba Home', 135, 'Textil', ['Alfombras Persas', 'Yute'], ['Alfombras persas tradicionales importadas', 'Alfombras de yute en telar', 'Colección de alfombras 100% recicladas'], ['3518733702'], '@marhaba.argentina'),
  P('mba-uniformes', 'MBA Uniformes', 229, 'Textil', ['Gastronomía', 'Indumentaria'], ['Delantales gastronómicos con cuero', 'Chaquetillas de chef', 'Uniformes para hotelería y empresas'], ['3515643243'], '@MBA_UNIFORMES'),
  P('mekk-home', 'Mëkk Home', 220, 'Bazar', ['Cristalería', 'Vajilla'], ['Copas de champagne y vino facetadas', 'Vajilla en tono arena', 'Individuales de rafia', 'Floreros de burbujas'], ['+5491161233189'], '@mekk.home'),
  P('merli', 'Merlí', 233, 'Textil', ['Infantil', 'Almohadones'], ['Almohadones con forma de flor', 'Almohadones casita', 'Banderines de tela', 'Muñecos de apego', 'Bolsos materos'], ['01147127632'], '@merlitextilinfantil'),
  P('mg-muebles-objetos', 'MG Muebles & Objetos', 101, 'Muebles', ['Living', 'Iluminación'], ['Mesas ratonas nido cilíndricas', 'Mesas auxiliares doradas', 'Sillones individuales de hierro y cuero', 'Lámparas escultóricas'], ['1151561685'], '@mg_mueblesyobjetos'),
  P('mideko-collection', 'Mideko Collection', 140, 'Decoración', ['Muebles Industriales', 'Objetos'], ['Baúles/bancos capitoné con ruedas de fundición', 'Libros decorativos huecos tipo caja', 'Relojes de mesa de hierro', 'Banquetas altas'], ['01145233711'], '@mideko_collection_ar'),
  P('mirador', 'Mirador', 225, 'Muebles', ['Tallados', 'Cestería'], ['Consolas con tallas florales ornamentadas', 'Banquetas altas de ratán trenzado', 'Vasijas envueltas en soga', 'Canastos'], ['45525055'], '@miradorporelmundo'),
  P('new-candles', 'New Candles', 204, 'Decoración', ['Velas', 'Aromas'], ['Velas de soja en frasco con tapa de madera', 'Difusores de varillas', 'Home sprays', 'Velas con forma de flor', 'Línea de citronella'], ['5491152645371'], '@newcandlesaromas'),
  P('ofelia-home-deco', 'Ofelia Home Deco', 271, 'Accesorios del Hogar', ['Organización', 'Regalería'], ['Bandejas apoyalaptop con almohadón', 'Bolsitos de mano estampados', 'Bolsas de lienzo navideñas'], ['1157829597'], '@ofeliahomedeco'),
  P('oma-objetos', 'Oma Objetos', 249, 'Decoración', ['Velas', 'Candelabros'], ['Candelabros de piedra rústica', 'Velas cilíndricas bicolor', 'Oil lamps (lámparas de aceite)', 'Candelabros torneados de madera'], ['+5491153202300'], '@oma_objeto'),
  P('orakke', 'Orakke', 122, 'Decoración', ['Tejido Artesanal', 'Cestería'], ['Canastos contenedores tejidos rígidos con asas', 'Individuales de mesa tejidos', 'Servilleteros tubulares', 'Posavasos florales'], ['1140343703'], '@orakkedeco'),
  P('ortiga', 'Ortiga', 241, 'Vajilla', ['Porcelana', 'Cristalería de Color'], ['Platos ilustrados botánicos con bordes a rayas', 'Copas con tallo esférico torneado de color', 'Vasos de color', 'Cubiertos'], ['5491135914398'], '@ortigacasa'),
  P('oxido-pampas', 'Oxido Pampas', 144, 'Aire Libre', ['Fogoneros', 'Asadores', 'Fundición'], ['Fogoneros circulares de chapa', 'Asadores criollos de cruz', 'Provoleteras de hierro fundido', 'Sartenes y planchas'], ['+5492494632550'], '@oxidopampasmayorista'),
  P('pachi-deco-home', 'Pachi Deco Home', 123, 'Textil', ['Telar', 'Tintes Naturales'], ['Almohadones en degradé dip-dye', 'Mantas de telar con rayas', 'Esculturas de pared en madera de ramas'], ['03513890157'], '@Pachi_decohome'),
  P('park-design', 'Park Design', 267, 'Bazar', ['Cristalería Francesa', 'Cubertería'], ['Copas y vasos con relieve de abeja', 'Jarras de vidrio clásicas', 'Molinillos de pimienta blancos', 'Cubiertos con mango marfil'], ['+541152184776'], '@parkdesign_argentina'),
  P('peonia-retono', 'Peonia & Retoño', 119, 'Textil', ['Cerámica', 'Navidad'], ['Caminos de mesa navideños bordados', 'Servilleteros festivos', 'Fanales con base de madera', 'Floreros de vidrio ilustrados'], ['1125948975'], '@retonomayorista'),
  P('petite-affaire', 'Petite Affaire', 113, 'Textil', ['Platos de Sitio', 'Bazar de Mesa'], ['Platos de sitio circulares florales y vichy', 'Servilletas estampadas', 'Repasadores vintage', 'Servilletas bordadas'], ['01177146038'], '@petite_affaire'),
  P('petris', 'Petris', 217, 'Cerámica', ['Vajilla Artesanal', 'Florería'], ['Cuencos ensaladeros mate', 'Pocillos/dips apilables', 'Floreros cilíndricos y esféricos', 'Tazas acanaladas', 'Bandejas organizadoras'], ['01142105434'], '@petris.home'),
  P('piano-nobile', 'Piano Nobile', 104, 'Muebles', ['Comedor', 'Living'], ['Sofás curvos claros', 'Mesas ratonas de madera', 'Sillas de comedor con respaldo de esterilla', 'Mesas redondas'], ['01121061416'], '@nobilepiano'),
  P('plug-iluminacion', 'Plug Iluminación', 273, 'Iluminación', ['Lámparas Colgantes', 'Vidrio Soplado'], ['Lámparas colgantes en racimo de vidrio ámbar', 'Lámparas de pie trípode con esferas opalinas', 'Apliques de pared'], ['5493412243484'], '@plugiluminacion'),
  P('primitivo-urbano', 'Primitivo Urbano', 219, 'Textil', ['Muebles', 'Jacquard'], ['Mantas jacquard étnicas', 'Almohadones de terciopelo', 'Pies de cama', 'Butacas curvas tapizadas en bouclé'], ['+541147557081'], '@primitivourbano'),
  P('refill-lab', 'Refill Lab', 266, 'Aromas', ['Cosmética Sustentable', 'Refill'], ['Estaciones de recarga / Refill de fragancias', 'Jabones líquidos en dispensadores', 'Difusores', 'Home sprays'], ['1147187739'], '@refill_lab'),
  P('rhie', 'Rhié', 221, 'Decoración', ['Velas', 'Difusores'], ['Velas en vasos de vidrio tonalizado (ámbar, verde, humo)', 'Difusores de varillas cilíndricos Leah', 'Sales aromáticas'], ['01173738716'], '@rhie.aromas'),
  P('rocas-company', 'Rocas Company', 239, 'Marroquinería', ['Bolsos', 'Calzado Cruelty-Free'], ['Bolsos tote grandes trenzados', 'Carteras con neceser colgante', 'Calzado y accesorios veganos'], ['5492235299302'], '@rocascompany'),
  P('roots', 'Roots Cuadros Decorativos', 250, 'Decoración', ['Cuadros', 'Fotografía XL'], ['Cuadros fotográficos en blanco y negro de faros', 'Obras abstractas texturadas', 'Cuadros XL'], ['5491140897028'], '@rootsdesign.ba'),
  P('ruben-andreatta', 'Rubén Andreatta', 109, 'Iluminación', ['Lámparas Clásicas', 'Esculturas'], ['Lámparas de mesa plateadas con base de cristal labrado', 'Esculturas cromadas en espiral', 'Veladores cilíndricos', 'Arañas'], ['1156629000'], '@rubenandreatta.iluminacion'),
  P('selema', 'Selema', 210, 'Muebles', ['Comedor', 'Lenga Patagónica'], ['Mesas con base de varillado curvo de lenga y tapa de mármol', 'Sillas de comedor ergonómicas tapizadas', 'Mobiliario a medida'], ['03416621480'], '@selemamuebles'),
  P('silva-co', 'Silva & Co', 254, 'Iluminación', ['Lámparas de Madera', 'LED'], ['Lámparas de mesa trípode de madera', 'Colgantes lineales de madera maciza con LED integrado', 'Veladores'], ['5493525509346'], '@silvaandco.ar'),
  P('sincretico', 'Sincrético', 231, 'Textil', ['Comercio Justo', 'Piedra Natural'], ['Mantas y pies de cama con flecos largos', 'Alfombras de punto', 'Portavelas cúbicos de piedra natural', 'Cuencos'], ['1125998372'], '@sincreticodeco'),
  P('siri-productos', 'Sirí Productos', 138, 'Bazar', ['Cocina', 'Picadas'], ['Fraperas metálicas ovaladas', 'Tablas de picadas con cuencos', 'Bandejas organizadoras de madera', 'Frascos Yerba y Azúcar con tapa de madera'], ['+541167443312'], '@siriproductos'),
  P('sirota-disenos', 'Sirota Diseños', 116, 'Textil', ['Tapicería', 'Cortinería'], ['Sofás curvos tapizados en pana/bouclé', 'Telas pata de gallo', 'Géneros rústicos', 'Telas blackout para cortinas'], ['11-4568-0856'], '@sirotadisenos'),
  P('surabaya-arg', 'Surabaya Arg.', 102, 'Muebles', ['Raíces de Teca', 'Iluminación Étnica'], ['Lámparas colgantes de fibra negra con flecos', 'Mesas de centro de raíz de teca con cristal', 'Bancos esculpidos en tronco'], ['5491170075051'], '@surabayadeco'),
  P('texsao', 'Texsao', 105, 'Textil', ['Sillones a Medida', 'Mobiliario'], ['Sofás modulares esquineros curvos', 'Mesas ratonas nido orgánicas', 'Butacas giratorias en bouclé', 'Cortinas'], ['1149414721'], '@texsao.sa'),
  P('thestampa', 'Thestampa', 147, 'Marroquinería', ['Accesorios Materos', 'Lienzo'], ['Bolsos materos rígidos (The Mate Tote Bag)', 'Fundas térmicas acolchadas para mate', 'Neceseres'], ['1150130162'], '@thestampa'),
  P('tienda-de-costumbres', 'Tienda de Costumbres', 202, 'Textil', ['Telar Criollo', 'Alfombras'], ['Almohadones tejidos con guardas geométricas y zig-zag', 'Caminos de mesa andinos', 'Alfombras de lana a medida'], ['01166092892'], '@tiendadecostumbres'),
  P('todoflor', 'Todoflor', 106, 'Decoración', ['Flores Artificiales', 'Navidad'], ['Árboles cónicos luminosos LED', 'Plantas artificiales de olivo', 'Ramos de lirios blancos', 'Floreros de cerámica'], ['45846004'], '@todoflorweb'),
  P('tribeca', 'Tribeca', 227, 'Muebles', ['Exterior', 'Piedra Natural'], ['Sillones de exterior envolventes', 'Mesas con tapas de piedra natural', 'Sillas bistró blancas', 'Sillas de madera curva'], ['+5491127201973'], '@tribecamuebles'),
  P('valdense-rieles', 'Valdense Rieles', 137, 'Accesorios para Cortinas', ['Rieles', 'Sistemas'], ['Rieles curvos de aluminio', 'Rieles europeos y americanos', 'Perfiles y guías', 'Cintas fruncidoras'], ['2664154064'], 'N/A'),
  P('velvet-deco', 'Velvet Deco', 150, 'Decoración', ['Figuras Escultóricas', 'Florería'], ['Conejos cromados de repisa', 'Floreros de vidrio carey', 'Libros decorativos Tom Ford', 'Difusores aromáticos', 'Velas cilíndricas'], ['541148594670'], '@velvet_deco'),
  P('victoria-campos', 'Victoria Campos', 153, 'Iluminación', ['Cerámica y Estaño', 'Lámparas'], ['Lámparas de mesa con base de cerámica y estaño repujado', 'Jarrones con dijes de estaño', 'Esferas decorativas', 'Ceniceros', 'Floreros'], ['0111567982206'], '@victoriacamposdecoylamparas'),
];

// Compra de ejemplo (venía anidada dentro del proveedor). Pasa a ser un registro propio del módulo Compras.
const COMPRAS = [
  {
    id: 'compra-NP2-0000-00024866',
    proveedorId: 'petite-affaire',
    notaPedido: 'NP2-0000-00024866',
    fecha: '2026-08-21',
    total: 810123.14,
    estado: 'pedida',
    items: [
      [1, 'Abrazo - Pack Papel', 19950.41],
      [1, 'Amalfi - Pack Papel', 22971.90],
      [1, 'Bolso Riviera con estampa', 56000.00],
      [1, 'Holder Amalfi', 24000.00],
      [1, 'Holder Tavola', 24000.00],
      [1, 'Individual Gabardina Tavola Set x4', 64000.00],
      [1, 'Kit Riviera', 42000.00],
      [1, 'Kit Santé Cocina', 45000.00],
      [1, 'Liberté - Pack Papel', 19950.41],
      [1, 'Mantel Gabardina Riviera 2.50x1.55 mts', 90300.00],
      [1, 'Necessaire Riviera', 32000.00],
      [2, 'Paño Nido de Abeja Sardine', 52000.00],
      [2, 'Plato de Sitio Arpillera Aqua', 52000.00],
      [2, 'Plato de Sitio Arpillera Natural', 52000.00],
      [2, 'Plato de Sitio Gabardina Riviera', 42000.00],
      [1, 'Santé Pack Papel', 19950.41],
      [1, 'Servilletas Santé Set x4', 40000.00],
      [2, 'Set de mesa Tavola Pronta', 112000.00],
    ].map(([cantidad, descripcion, subtotal]) => ({ cantidad, descripcion, subtotal })),
    updatedAt: 1,
    updatedBy: 'seed',
  },
];

export function buildSeed() {
  return {
    proveedores: CATALOGO.map(p => ({ ...p })),
    compras: COMPRAS.map(c => ({ ...c, items: c.items.map(i => ({ ...i })) })),
  };
}
