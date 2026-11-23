/**
 * ============================================================================
 * ระบบแดชบอร์ดสรุปวันลาและการลงเวลาปฏิบัติราชการ (KBS Attendance Dashboard)
 * โรงเรียนกาญจนาภิเษกวิทยาลัย กระบี่
 * Google Apps Script REST API — Multi-Term / Auto-Discover Tabs Engine
 * - ตรวจจับแท็บภาคเรียน/ปีใหม่ๆ ใน Google Sheet นี้อัตโนมัติ (เช่น 2/69, 1/70, 2/70, 1/71)
 * - อ่านชื่อเดือนและจำนวนวันจากแถวที่ 1 อัตโนมัติ
 * - แอดมินสามารถเปิด/ปิดได้ทั้งระดับ "ภาคเรียน/ปี" และระดับ "รายเดือน"
 * ============================================================================
 */

var CONFIG = {
  SPREADSHEET_ID: '1AuOkjvEAy2JTS6DqDt1hUZMlVV6TO1EFcxclfVOfAfs',
  EPROFILE_SPREADSHEET_ID: '1-N4DD6OaR4j8kNubJjRyShffuN3rXZqrfjjwwN9ly_A',
  EPROFILE_TABS: [
    'ผู้บริหาร',
    'แนะแนว/วัดผล',
    'วิทยาศาสตร์และเทคโนโลยี',
    'คณิตศาสตร์',
    'ภาษาไทย',
    'ภาษาต่างประเทศฯ',
    'สังคมศึกษาฯ',
    'สุขศึกษาและพละศึกษา',
    'การงานอาชีพ',
    'ศิลปะ',
    'เจ้าหน้าที่ อื่นๆ'
  ],
  TAB_SETTINGS: '_Dashboard_Settings',
  TAB_PINS: '_Staff_Pins',
  TAB_CORRECTIONS: '_Correction_Requests',
  TIMEZONE: 'Asia/Bangkok',
  CACHE_PREFIX: 'kbs_att_tab_v3_',
  CACHE_EPROFILE_KEY: 'kbs_eprofile_live_map_v1',
  CACHE_TTL_SECONDS: 300,
  CACHE_EPROFILE_TTL: 600,
  DEFAULT_ADMIN_PIN: '123456'
};

var THAI_MONTH_MAP = {
  'มกราคม': { month: 1, short: 'ม.ค.' },
  'กุมภาพันธ์': { month: 2, short: 'ก.พ.' },
  'มีนาคม': { month: 3, short: 'มี.ค.' },
  'เมษายน': { month: 4, short: 'เม.ย.' },
  'พฤษภาคม': { month: 5, short: 'พ.ค.' },
  'มิถุนายน': { month: 6, short: 'มิ.ย.' },
  'กรกฎาคม': { month: 7, short: 'ก.ค.' },
  'สิงหาคม': { month: 8, short: 'ส.ค.' },
  'กันยายน': { month: 9, short: 'ก.ย.' },
  'ตุลาคม': { month: 10, short: 'ต.ค.' },
  'พฤศจิกายน': { month: 11, short: 'พ.ย.' },
  'ธันวาคม': { month: 12, short: 'ธ.ค.' }
};

// Hash (SHA-256) สำหรับยืนยันตัวตนฝั่งเซิร์ฟเวอร์ (ไม่เก็บเลขบัตรดิบ)
var SEED_CID_HASHES = {
  "3b043672c162bfc6ca862170ddcd29afa503196956b28836806af40f1c510874": "เกียรติมงคล พูดเพราะ",
  "76f7f9f6ff77605feef3fb2383963c2005f50648589906e093ce854abf67f0b3": "คนึงนิตย์ แฉล้มรักษ์",
  "de7b2ceed0a31534f039dc1445846195a5d6022b4ea5d3ea43c7007868f0e10b": "วัชระ เปียกบุตร",
  "aaa637bfef7f797565e31cec6072b19c33c7cdd7335cb372392b1a8fc05e85b9": "ศรายุทธ พงค์ทองเมือง",
  "f9e479425da5701dc3145fffa23edb500b3398279d5455bbf15f9fdbc60a4bf1": "สุธิดา ธนบัตร",
  "7f8ad915318e2ebfe232d051f4cbbacf5352de96611927ae7727ab1d8ebf199a": "เปรมฤดี จูหลง",
  "44668e2d2173cb633fbe38655a12d5c78b76bca11645c63bf8d6e97a78189186": "ณัฐปภัสร์ จันท์เสถียร",
  "33ec0b822081514b4d18c383c23e34ae1a4639cb3534b3b69c2c5120a6fd301f": "รติกาล กลับคง",
  "e7406f2d6d3b6c804c3219fc1a08d9ceaa629f9c38f76cb6cbc68e635d3ae1f5": "มูฮัมหมัดฟาเดล ยาลาแว",
  "d72b47f2d2dcae1f26044ce6391908c7a785f19f4f5ae92375471a9e08bff15e": "สิริรัตน์ ส่งศรี",
  "36779d4883fda6e64006d456633d166deb1df36a23fb7fc5dc5a6d7046594e3f": "อนุรัตน์ นาคสง่า",
  "f4b589b6059e2f49703034017634328972a45cb177bc6bb01e4f451d0b7ba91e": "ทัศนีย์ ธรรมทักษ์",
  "146922beba8aaf0c1f09f613ac917b205771c8ece18c658834b7e28f8b37f808": "พรพัฒน์ ขวัญนิมิตร",
  "fa249deb6cb5855dd607818b328ecc984aeb361e2dc21393490d9ebe0cd7bb2b": "ฟ้ารุ่ง ขวัญเพ็ชร",
  "ca36f92dc36508ed5e139dbd1aad89534ce4a736d6bd81d59dc4c6214fc88069": "จันทนา สักคุณา",
  "494ea1632f541e101024d2eb379d45f9629001c8950049fd9775c071bec4cff4": "นัทธมน ณัฎฐเดช",
  "515a3741f37dbe293d2cc39bb1de1bcd1140497e9ed1c11a32df149def031819": "ยุพิน ทองแก้ว",
  "ca291978877aa5842f87e55a080e5cfc3a5138f99bbb8b9913aefe164972d669": "รุ่งนภา สุชาฎา",
  "9dfe20df900e5b2cc8cf0dbc96c6b818d490955e1c4bcb4e8c25427e986ce962": "อนุชา หัทยา",
  "55c687c2be8141c39739f7e19cf6ba23c0f53326068e8ca687df4531177b0ac4": "วาทินี เสล่ราษฎร์",
  "b87fd39660155c9cec6e88273ecdf0c8780bd0f76f03eb576f4ccd13be2684f2": "อารมณ์ หยีหาสัน",
  "c4da1df4293302f91273df9b6fcaf88f2b3ed15f6e91aca061415a4490e45e58": "กานต์ชนก กานต์นภัทร",
  "4b9089cc7063d3c87a35fa2560406eb1898ed811869f3d9ecfc6fbc683068b90": "สุทิศา ปานแดง",
  "651d891e75687ccdc67848744071fa908d6896e38968ee760f3b52374a2ada22": "ธีติมา มูรติการ",
  "55eb7b0b0034af8149f9e4c311f6fc492d2e6dd99274fd46958264a2f9bf09b9": "ดัยนา หัทยา",
  "9be68ee7abe7170f43e046b3a38e4c13143a224af8d5e115058428fff49f9dba": "ด้าโอด ลูกเด็น",
  "731436e4f0d1a7e65e615d66a4e505f5f16ff03c1d682e365f92ffac2eeba40e": "เสาวภาค จันทร์คง",
  "b9d6468e3669952bf329d5c1721288e8f5b3e0880cb34f7778115c1cd0313e19": "สมจารี คันธชาติกุล",
  "8aca94a426cf52d50999d32edef9ac23b950fdccde386974216fa3b73704315e": "อภิสิทธิ์ ทองสีนุช",
  "52a26afbb01b337c0e5ceec7170d2c60e6c786bce165b4f8478185496e7eccfa": "บดี กังงา",
  "e3af957a432f8879a8797db96bd89c394687f8af354ce23a2b3f9da1a6921cc7": "พรศักดิ์ เจียวก๊ก",
  "459053c780a5dfc576a516311355ad2c7728e2f838a8f302a8f1f5772acd9b5b": "ยาใจ มาชู (เสียชีวิต)",
  "16224fae9d6aaf24d4ab8039e205a4a7290e61f08d36956ca4c86bcd9db46c06": "ปิยะมาศ ผกาวรรณ",
  "f62d1e1d8967877f4231393c603113fe7b90198e883a93d4919a49c2ecbdf79d": "พรทิพย์ คงมาก",
  "a7dcc1bda09f81602c967f593bc962b97dd6c77862959ed06671a4c3f21feee4": "ธนพร สระทองแยง",
  "a95309db26f94e8b18a68a594975ec0caab0153e91f2f3dff9d1d012a6f531df": "สุทธวรรณ รักการ",
  "bff96e9523b8b9dfd0a5ac99782b6a69a974aaac7da017bf6e9b773bc3ebe97a": "อมรรัตน์ ทวีพงศ์ศักดิ์",
  "570fab5a6e5afa4361ebfcbb8e26dfcb8602592411bf89b8bd17cc51dba7bf36": "กัญญารัตน์ เพ็งจันทร์",
  "b2144edae73b44c6bc3270a468b8dd5cbd6c7574f35b478088e5ef62892354fa": "นภิสรา อุษณีษ์พันธุ์",
  "d4b0d0642e52d6331745bd4ae4d48623b28819c332c87f00655263fe6429f6f4": "สายน้ำผึ้ง หมึกดำ",
  "02137340591099bb0fcee8ecbe678f5987516ce9e32e18bce9835d3cb60e12e0": "ทิพย์เกษร แก้วกาญจน์",
  "f9a1d8dd00904c5eae5caada267e9d7137d6610695fe23c9a68ae064b5a07522": "ศศิกร สงขาว",
  "bc88aafb4ff8f4e2b9cffe9f22cff2760b20cfceb319f133b05dd5a65fb5454a": "อรสา สมาพงษ์",
  "48b3bd3e9980a0833713342b1366698a6f49c1b3934ed67a1ced6dc6c05d74e3": "ชญานิษฐ์ เอ่งฉ้วน",
  "784b3f069e6f2f459bb6f992d177b45976a55ed7578ddf8f0825cdd847e16149": "ลัดดา จันทรดี",
  "f4a74293c82d0b7d55b33f41badaf6b2a0b9ea0fa6c7b39441b26802d3e28c67": "หทัยรัตน์ ศรีวรเดชไพศาล",
  "167fb70bf76ec0f5eaea2fafb17b56d17717a981217e2cfadf6f1216beac3bdb": "ศศิญา จูฑามาตย์",
  "d5326000ffc117551617f57416f497a5c19db43b2a1a84db14e03bf6d8f40b0d": "ปาริชาติ ดำด้วง",
  "7e0ac94b8a77ad8ce8fa82395663b301d12ce052f23e440b66d1a3e8aa49189e": "ฐิติยาภรณ์ หล่อสุพรรณพร",
  "48e44e4992980a20dbf7b442619fd238eb8ed96aeb2c8d5204d3cf5fad5e987c": "วีรญา ช้างน้ำ",
  "7b723c205bb7d48275ede21e9376fde55e26c2d591021c636a03cee627b46f90": "ปริญญา สมแก้ว",
  "6cb5aa845b64fb842ebfea8062294a8e8b09b11d6919d7d4aa50952addfeca79": "วิภาวี สิทธิการ",
  "646cd4867805ba63389ce6f649545c5d988b258d47424a4312d2168f70aa2941": "นันท์นภัส กิติบุญญา",
  "83192f3c22f598f122bc3dad9f6c2a6cd0f3e82005436fa33a8daaa6d85eaad6": "สุชาดา เพชรสุก",
  "febbce77d44d4e8f6b0aeff65af82edadb997c12d61149519cc5bda745e9864a": "อัจฉรา นุ่นชูผล",
  "67ff2035f73a5b1daf14d0b9675a3701fa4967c4b03f54324f8e0e2e37281677": "อภิวัฒน์ กาพย์เกิด",
  "2744e629cbb744b25074a8c980030ef724d994754236fd6cad0bd107c70e1598": "ชญานี ชัยสวัสดิ์",
  "95f54c75a358f9a2a06c9b6e8aa150afabe89a3d468bc3aead2676ce1a159e43": "เริงสรรค์ ยะลา",
  "dd1067aa2edcedf4b4ba1de7dc2472053b20756c14068de56275a8223428b5e8": "ชลธิชา บัวแต่ง",
  "26bc9f93cfecede1f3085f7fb120a867e06bc8a92e396388121dd7174068805e": "กานต์ลดา สายนุ้ย",
  "4fd9f8e9915c7bb4bdf1c18855ca34b122113535d5e16b33b02967731bbb4e35": "สุนันทา รักราวี",
  "b43c22c4044330efa2bc8123e258f993459ae937a8ad6044dab69d20c20f33a6": "จุไรรัตน์ เรืองอ่อน",
  "c50f76f2528f3a38895d4b520b0e7fafa21e2a8057756da15da17c16468cfd77": "ศุภิสรา ยาวส่ง",
  "a3af9da9e0dde7e66869148c630db6e96a0f1b52d74e44652e41cfeb2000c3a2": "ชนกนันท์ จันทร์สงค์",
  "0821d2a994c346fd154739ff30ca808440649ed203201c57571409342314b23d": "ชนะชัย สุวรรณชล",
  "000fbf76a20b95ac34df1f3f73fc1990277e9ab728a43253ecee0fdbd934ec6e": "ภาวิณี ช่วยพัทลุง",
  "aaf3ffc672475d316200eb3e627dcc04a69a4decde31a273e3d0bd3afb06105e": "ธัญญา กัลยกรกุล",
  "159041ccd8023924cc97127fe427d340e143fffa4af18af0734f59809ffca0be": "วาสนา หนูมาก",
  "86891dc8f7939a0b9161caa06f489a21f68af179737128062c14f040084e13c2": "สรารัตน์ โพชสาลี",
  "369dd0c2255071d9f8cc262522f66e0716480b362f62fd499b73d411a972bd7c": "กนกรัตน์ เลี่ยนเส้ง",
  "1b39ef639a1ebdc92bcb16fa2890cfb9aa33aeb7ae177c7a8b1fa77791aa73ae": "ปิยะวรรณ จันทร์ประกอบ",
  "7e517008e591ad37fa989181bff36325ba0c8fd018d0221e7c806a883c65a4e5": "ธนพร ธนาวุฑฒ์",
  "ed88a860029ef7b9499d574718e8365eeb7c10f8850c1ba10adb5f2ae916019f": "ธีรยุทธ เหล่ชาย",
  "2b8326fe5e8c3d75cbbfe62b3a6f213c9ef45f267b7e434b581a82a84e0a2a47": "ชลธิชา หนูชูแก้ว",
  "894804d4a7fa654f294a1b4c65697719597a97cd26311547b13d9fc2a34bb9df": "สมิตา ไชยสาลี",
  "5f7765db64b31b4b3c79b34c159627bbff65f71d183e77621405be903ac85d69": "ปภัสรา รักฤทธิ์",
  "a19477abe64042cb05b1fb8522e4c0be096e5815436aae4f6add709f47858220": "มานิตย์ บัวเพชร",
  "4005b9e993a0ec0daa30026a13de9ac8593191bbce3322290bda0a52770cf21c": "ปัทมา ญาณแก้ว",
  "a739ce24c04d72b46be65c38c0fed984b7ab5ef9e0b2d4edca0df780f8baacf4": "ณัฐธิดา แก้วสาระ",
  "f4081e382f6bfba4a0b3d499f4bdd206f34a348342357336939ebe5d7582d700": "มาติณห์ สัญจร",
  "82a9a7921793fca7c726db40767ee889a94bba39167bd3d290e731ffc2f6e172": "วิทยา เต็มบางงอน",
  "9236ef634fb89d2e90b4b37a6752610e9608372123012c630ac8d24f7f841d3c": "จีรพจน์ ทองขาว",
  "0034446da1e16feefccb64a8025f7ce344e953a26e69a697d87df1ee47246ce9": "ณรงค์ศักดิ์ จงจิตร",
  "44e0a0a50f9227cf11dbbbad3f289568cebbe9e6a24402f6fae712eac5415b32": "วรวรรณ เพ็ชรฤทธิ์",
  "4f2710d0feb06ef9f8f38c14762df9664105ebd7ef62a1eca16c4702ab55c27a": "ธนากร ชื่นบุตร",
  "5ab05a1bd0ae1f1f15930d075924e999fb57d94f75d4a84062bc7b149e72f7cd": "อุไร สังหาร",
  "161a8cf836a53accaf71472f82826772cb896be7c016ac0c7355405802903b44": "วันเฉลิม กัณหะกุล",
  "200dc2bc2b53f91ef4b5a3fefe607798fc017473b41369d33153c728386aa082": "รัชนีวรรณ ชาตรี",
  "9fa7ab0b914923aefc662bd0ffd0d61eb559f6529e233b32d6f7433815e5fd88": "พิมพ์ปวีณ์ เศรษสระ",
  "21ee79c2ccc4245ecec538fd762ce3cfb7128fcb0110cfba1fe505018aa964be": "ชัยวัฒน์ ริยาพันธ์",
  "e2df7cbd4283fde1a42512c6a1048aec9953410c9f8183222e07f8a6efba69f5": "รมิตา จุลนันโท",
  "fe316aa3107c0cb1ccd4e6111871d15db297ab8a12056d2480a6c705c2b0cc3f": "โกษิต ดาวกระจ่าง",
  "011269cdc1dfac619ba701ad3a92ab1ef706302449bbf810caad4a271c977a57": "อรฤดี เพ็งลำ",
  "345d80c6ce7bc8b3ebc5a5f1964bd3cf7185ed51f69691c5dd5d89e3f83f4a1e": "นัฒพล เทียบแก้ว",
  "ea24c73a1786cb8c32ebb3d6bd6068fa648878d75e64943c82960589f1f56cf4": "วิชชา ไชยกุล",
  "a47a301198a7fe7ef82a714a4f3e6f8171d26697287b7a56b0b41844f918e8f5": "จุมพล เพ็ชรพวง",
  "8d2caf5a162122d354bdeabcc717533deedd0c49f7a104417f28ec1013d46ca1": "ศราวุธ เกื้อขาว",
  "b089469a3f55cd492e33525f666db3b2cb82958bc5af514fcc39dbc07d2617a1": "ศรีสุดา สุวรรณโชติ",
  "65e6b1b53e2a2f65a04432dc9b5b6982bc495a611c881e08da101c9a81cb51f3": "อลิษา แท่นดี",
  "7a1228e1f9c17bed95bc5f5f965a8b7212d7c5baf34b939bb0a1b27216e20a91": "เสาวนีย์ ชลธี",
  "f9bc3e73367db077b5de8b0bc7c3ccb4efb607fc1e43d4b819781fcb3909b6fe": "กรรณิกา คงภักดี",
  "d3b31405401bbdfeb627675a8c952a08d55758a7d6916cf4d3295a1cd48891aa": "คณิน คำกิ่ง",
  "1a3e68f118f0d6f1bb68af26ed95aa1fe160c89b854147f9519f4f354ee3de8f": "สกาวเดือน เศษคง",
  "d295e9ffc5d6b7c1b2928905371a33ce4c9560aa2572a29ffaed963d59960911": "ธนากร หนูอิน",
  "0b753d480230c7b33df76579f8723356dd5d48575d9775b05d6234df1c91bbd2": "สราวุธ แก้วสร",
  "2297ba41a193f08ac961b6a50f2b2e700416069989da263bbef5b3f1aa9de14b": "ญาณปรีชา ภูขะมา",
  "bc90437754c0f2a7f2b80f84790f32bfd907dc44d1dcc0bc85b829190a625322": "เอกสิทธิ์ สมันบุตร",
  "cacfa05d8034a8a441be27a33a81686dbf3f96deef96dede0d477f388cb53598": "วณิชยา ลิ่มสกุล",
  "e785431587599d45e961dde6014d97cdaaae34c1df5ef717c170233b72c223d0": "ศุภณัฐ กัณหกุล",
  "b7b29bce3bb8a40303f3436d10741798f8176f0a9d135ff69a56f9882727cc29": "เกียรติชานนท์ เสียงดัง",
  "a696f3f341f558d52958ef003e239bb2f87fdf639aca2bdda4949623d5d0d875": "ทินภัทร อนุการ",
  "39bd02f8e266636cb2c692922c26ba8aecbbca53bbbc7a44556ee47ebd1575fa": "วิภารัตน์ ลูกอ้น"
};

function createJsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sha256Hex(str) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(str), Utilities.Charset.UTF_8);
  var out = '';
  for (var i = 0; i < raw.length; i++) {
    var b = raw[i];
    if (b < 0) b += 256;
    var h = b.toString(16);
    out += (h.length === 1 ? '0' + h : h);
  }
  return out;
}

function stripNamePrefix(s) {
  return String(s || '')
    .replace(/^(ว่าที่\s*ร้อยตรี\s*หญิง|ว่าที่\s*ร้อยตรี|ว่าที่\s*ร\.?\s*ต\.?\s*หญิง|ว่าที่\s*ร\.?\s*ต\.?|นางสาว|นาง|นาย|น\.ส\.|ดร\.|Mr\.?|Mrs\.?|Ms\.?|Miss)\s*/i, '')
    .replace(/\s+/g, ' ')
    .replace('วิภารัตน์ ลูกอ้อน', 'วิภารัตน์ ลูกอ้น')
    .trim()
    .toLowerCase();
}

function loadLiveEprofileMap(forceRefresh) {
  var cache = CacheService.getScriptCache();
  if (!forceRefresh) {
    var cached = cache.get(CONFIG.CACHE_EPROFILE_KEY);
    if (cached) {
      try { return JSON.parse(cached); } catch (e) {}
    }
  }
  var hashes = {};
  var cidToCore = {};
  var depts = {};
  try {
    var eps = SpreadsheetApp.openById(CONFIG.EPROFILE_SPREADSHEET_ID);
    for (var ti = 0; ti < CONFIG.EPROFILE_TABS.length; ti++) {
      var tabName = CONFIG.EPROFILE_TABS[ti];
      var sh = eps.getSheetByName(tabName);
      if (!sh || sh.getLastRow() < 2) continue;
      var isStaff = (tabName === 'เจ้าหน้าที่ อื่นๆ');
      var maxCol = isStaff ? 6 : 8;
      var rows = sh.getRange(2, 1, sh.getLastRow() - 1, maxCol).getDisplayValues();
      for (var r = 0; r < rows.length; r++) {
        var row = rows[r];
        var rawName = String(row[1] || '').replace(/[\u200B\uFEFF]/g, '').trim();
        if (!rawName || rawName === 'ชื่อ - ชื่อสกุล' || rawName.indexOf('รวม') !== -1 || rawName === '-') continue;
        var core = stripNamePrefix(rawName);
        if (!depts[core]) depts[core] = tabName;
        var rawId = isStaff ? row[5] : row[7];
        var idDigits = String(rawId || '').replace(/[\u200B\uFEFF]/g, '').replace(/\D/g, '');
        if (idDigits.length >= 4) {
          hashes[core] = sha256Hex('name:' + core + ':' + idDigits.slice(-4));
          cidToCore[sha256Hex('cid:' + idDigits)] = core;
        }
      }
    }
    var payload = { hashes: hashes, cidToCore: cidToCore, depts: depts };
    try {
      var serialized = JSON.stringify(payload);
      if (serialized.length < 95000) cache.put(CONFIG.CACHE_EPROFILE_KEY, serialized, CONFIG.CACHE_EPROFILE_TTL);
    } catch (e) {}
    return payload;
  } catch (err) {
    return { hashes: {}, cidToCore: {}, depts: {} };
  }
}

function getOrCreateHelperSheet(ss, tabName, headers) {
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    sheet.appendRow(headers);
    var hr = sheet.getRange(1, 1, 1, headers.length);
    hr.setBackground('#1e3a8a');
    hr.setFontColor('#ffffff');
    hr.setFontWeight('bold');
    sheet.setFrozenRows(1);
    try { sheet.hideSheet(); } catch (e) {}
  }
  return sheet;
}

function detectMonthsFromHeaderRow(row1, totalCols, tabName) {
  var regex = /(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s*(\d{2,4})?/;
  var fallbackYearMatch = String(tabName || '').match(/\/\s*(\d{2,4})/);
  var baseYearBE = fallbackYearMatch
    ? (fallbackYearMatch[1].length === 2 ? 2500 + Number(fallbackYearMatch[1]) : Number(fallbackYearMatch[1]))
    : 2569;

  var months = [];
  var lastYearBE = baseYearBE;
  var prevMonthNum = 0;

  for (var c = 3; c < totalCols; c++) {
    var cell = String(row1[c] || '').trim();
    if (!cell) continue;
    var m = cell.match(regex);
    if (!m) continue;

    var info = THAI_MONTH_MAP[m[1]];
    if (!info) continue;

    var yearBE;
    if (m[2]) {
      yearBE = m[2].length === 2 ? (2500 + Number(m[2])) : Number(m[2]);
    } else {
      yearBE = (prevMonthNum > 0 && info.month < prevMonthNum) ? (lastYearBE + 1) : lastYearBE;
    }
    lastYearBE = yearBE;
    prevMonthNum = info.month;

    var yearCE = yearBE - 543;
    var daysInMonth = new Date(yearCE, info.month, 0).getDate();
    var mStr = info.month < 10 ? ('0' + info.month) : String(info.month);
    var id = yearBE + '-' + mStr;
    var shortYear = String(yearBE).slice(-2);

    months.push({
      id: id,
      label: m[1] + ' ' + yearBE,
      shortLabel: info.short + ' ' + shortYear,
      yearBE: yearBE,
      yearCE: yearCE,
      month: info.month,
      daysInMonth: daysInMonth,
      startCol: c
    });
  }
  return months;
}

function computeTabSortOrder(tabName, months) {
  var m = String(tabName || '').match(/(\d)\s*\/\s*(\d{2,4})/);
  if (m) {
    var sem = Number(m[1]);
    var yr = m[2].length === 2 ? 2500 + Number(m[2]) : Number(m[2]);
    return yr * 10 + sem;
  }
  if (months && months.length > 0) {
    return months[0].yearBE * 10 + (months[0].month >= 5 && months[0].month <= 9 ? 1 : 2);
  }
  return 0;
}

function discoverAttendanceTabs(ss) {
  var sheets = ss.getSheets();
  var found = [];
  for (var i = 0; i < sheets.length; i++) {
    var sh = sheets[i];
    var name = sh.getName();
    if (!name || name.charAt(0) === '_') continue;
    var lastRow = sh.getLastRow();
    var lastCol = sh.getLastColumn();
    if (lastRow < 4 || lastCol < 10) continue;

    var headerRows = sh.getRange(1, 1, 3, lastCol).getDisplayValues();
    var r3a = String((headerRows[2] && headerRows[2][0]) || '').trim();
    var r3b = String((headerRows[2] && headerRows[2][1]) || '').trim();
    if (r3a.indexOf('ลำดับ') === -1 && r3b.indexOf('ชื่อ') === -1) continue;

    var months = detectMonthsFromHeaderRow(headerRows[0] || [], lastCol, name);
    if (months.length === 0) continue;

    found.push({
      sheet: sh,
      id: String(sh.getSheetId()),
      name: name,
      sortOrder: computeTabSortOrder(name, months),
      monthsMeta: months
    });
  }
  found.sort(function(a, b) { return a.sortOrder - b.sortOrder; });
  return found;
}

function parseTabDataset(tabInfo, forceRefresh) {
  var cache = CacheService.getScriptCache();
  var cacheKey = CONFIG.CACHE_PREFIX + tabInfo.id;
  if (!forceRefresh) {
    var cached = cache.get(cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch (e) {}
    }
  }

  var sh = tabInfo.sheet;
  var lastRow = sh.getLastRow();
  var monthsMeta = tabInfo.monthsMeta;
  var maxDayEndCol = 3;
  for (var mi = 0; mi < monthsMeta.length; mi++) {
    var endC = monthsMeta[mi].startCol + 31;
    if (endC > maxDayEndCol) maxDayEndCol = endC;
  }
  var readCols = Math.min(sh.getLastColumn(), maxDayEndCol);
  var values = sh.getRange(1, 1, lastRow, readCols).getDisplayValues();

  // อ่านข้อมูลการ Merge เซลล์ในตารางรายวัน
  var rowMergesMap = {};
  if (lastRow >= 4 && readCols >= 4) {
    var mergedRanges = sh.getRange(4, 4, lastRow - 3, readCols - 3).getMergedRanges();
    for (var m = 0; m < mergedRanges.length; m++) {
      var rg = mergedRanges[m];
      var sRow = rg.getRow() - 1;
      var eRow = rg.getLastRow() - 1;
      var sCol = rg.getColumn() - 1;
      var eCol = rg.getLastColumn();
      if (eCol - sCol <= 1) continue;
      for (var rr = sRow; rr <= eRow; rr++) {
        var codeVal = String((values[rr] && values[rr][sCol]) || '').trim();
        if (!codeVal) continue;
        if (!rowMergesMap[rr]) rowMergesMap[rr] = [];
        rowMergesMap[rr].push({ startCol: sCol, endCol: eCol, code: codeVal });
      }
    }
  }

  var records = [];
  var currentGroup = 'ข้าราชการครูและบุคลากร';

  for (var r = 3; r < values.length; r++) {
    var row = values[r];
    var colA = String(row[0] || '').trim();
    var colB = String(row[1] || '').trim();
    var colC = String(row[2] || '').trim();

    if (colB === 'ลูกจ้างห้องเรียนกีฬา' || (colB && !colA && isNaN(Number(colA)) && colB.indexOf('ลูกจ้าง') !== -1)) {
      currentGroup = colB;
      continue;
    }
    if (!colA || isNaN(Number(colA)) || !colB) continue;

    var staffKey = 'staff_' + (r + 1);
    var coreName = stripNamePrefix(colB);
    var monthsData = {};
    var rMerges = rowMergesMap[r] || [];

    for (var mj = 0; mj < monthsMeta.length; mj++) {
      var meta = monthsMeta[mj];
      var days = [];
      for (var d = 0; d < meta.daysInMonth; d++) {
        var colIdx = meta.startCol + d;
        days.push(colIdx < row.length ? String(row[colIdx] || '').trim() : '');
      }
      var monthMerges = [];
      var mStart = meta.startCol;
      var mEnd = meta.startCol + meta.daysInMonth;
      for (var mgIdx = 0; mgIdx < rMerges.length; mgIdx++) {
        var mg = rMerges[mgIdx];
        var overlapStart = Math.max(mg.startCol, mStart);
        var overlapEnd = Math.min(mg.endCol, mEnd);
        if (overlapStart < overlapEnd) {
          monthMerges.push({
            startDay: (overlapStart - mStart) + 1,
            endDay: (overlapEnd - mStart),
            code: mg.code,
            isOrigin: mg.startCol >= mStart && mg.startCol < mEnd
          });
        }
      }
      monthsData[meta.id] = { days: days, merges: monthMerges };
    }

    records.push({
      key: staffKey,
      coreName: coreName,
      rowNumber: r + 1,
      seq: Number(colA),
      name: colB,
      position: colC,
      group: currentGroup,
      months: monthsData
    });
  }

  var monthsSummary = monthsMeta.map(function(meta) {
    var recordedCells = 0;
    var activeDays = 0;
    for (var d = 0; d < meta.daysInMonth; d++) {
      var dayHasData = false;
      for (var p = 0; p < records.length; p++) {
        if (records[p].months[meta.id].days[d]) {
          recordedCells++;
          dayHasData = true;
        }
      }
      if (dayHasData) activeDays++;
    }
    return {
      id: meta.id,
      label: meta.label,
      shortLabel: meta.shortLabel,
      yearBE: meta.yearBE,
      yearCE: meta.yearCE,
      month: meta.month,
      daysInMonth: meta.daysInMonth,
      startCol: meta.startCol,
      recordedCells: recordedCells,
      activeDays: activeDays,
      hasData: recordedCells > 0
    };
  });

  var tabDataset = {
    termId: tabInfo.id,
    termName: tabInfo.name,
    sortOrder: tabInfo.sortOrder,
    months: monthsSummary,
    records: records
  };

  try {
    var serialized = JSON.stringify(tabDataset);
    if (serialized.length < 95000) {
      cache.put(cacheKey, serialized, CONFIG.CACHE_TTL_SECONDS);
    }
  } catch (e) {}

  return tabDataset;
}

function readSettingsFromSheet(ss, tabsDatasets) {
  var defaultVisibleTerms = {};
  var defaultVisibleMonths = {};
  if (Array.isArray(tabsDatasets)) {
    tabsDatasets.forEach(function(td, idx) {
      // แท็บแรกเปิดเป็นค่าเริ่มต้น แท็บใหม่ที่เพิ่งสร้างให้รอแอดมินกดเปิด
      defaultVisibleTerms[td.termId] = (td.termId === '0' || idx === 0);
      td.months.forEach(function(m) {
        defaultVisibleMonths[td.termId + '::' + m.id] = (td.termId === '0' || idx === 0) ? Boolean(m.hasData) : false;
      });
    });
  }

  var settings = {
    visibleTerms: defaultVisibleTerms,
    visibleMonths: defaultVisibleMonths,
    announcement: '',
    adminPinHash: sha256Hex('kbs-att-admin:' + CONFIG.DEFAULT_ADMIN_PIN),
    updatedAt: ''
  };

  var sheet = ss.getSheetByName(CONFIG.TAB_SETTINGS);
  if (!sheet || sheet.getLastRow() <= 1) return settings;

  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getDisplayValues();
  for (var i = 0; i < rows.length; i++) {
    var key = String(rows[i][0] || '').trim();
    var val = String(rows[i][1] || '');
    if (key === 'visibleTerms' && val) {
      try {
        var parsedTerms = JSON.parse(val);
        Object.keys(parsedTerms).forEach(function(k) { settings.visibleTerms[k] = Boolean(parsedTerms[k]); });
      } catch (e) {}
    } else if (key === 'visibleMonths' && val) {
      try {
        var parsedMonths = JSON.parse(val);
        Object.keys(parsedMonths).forEach(function(k) {
          // รองรับทั้งรูปแบบเก่า "2569-10" และรูปแบบใหม่ "0::2569-10"
          if (k.indexOf('::') === -1 && tabsDatasets && tabsDatasets.length > 0) {
            settings.visibleMonths[tabsDatasets[0].termId + '::' + k] = Boolean(parsedMonths[k]);
          } else {
            settings.visibleMonths[k] = Boolean(parsedMonths[k]);
          }
        });
      } catch (e) {}
    } else if (key === 'announcement') {
      settings.announcement = val;
    } else if (key === 'adminPinHash' && val) {
      settings.adminPinHash = val.trim();
    } else if (key === 'updatedAt' && val) {
      settings.updatedAt = val.trim();
    }
  }
  return settings;
}

function writeSettingsToSheet(ss, updates) {
  var sheet = getOrCreateHelperSheet(ss, CONFIG.TAB_SETTINGS, ['Key', 'Value', 'UpdatedAt']);
  var nowStr = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  var keysToWrite = Object.keys(updates);

  var existingRows = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues()
    : [];

  keysToWrite.forEach(function(k) {
    var rawVal = updates[k];
    var strVal = (typeof rawVal === 'object' && rawVal !== null) ? JSON.stringify(rawVal) : String(rawVal == null ? '' : rawVal);
    var foundRow = -1;
    for (var i = 0; i < existingRows.length; i++) {
      if (String(existingRows[i][0]).trim() === k) {
        foundRow = i + 2;
        break;
      }
    }
    if (foundRow > 0) {
      sheet.getRange(foundRow, 2, 1, 2).setValues([[strVal, nowStr]]);
    } else {
      sheet.appendRow([k, strVal, nowStr]);
      existingRows.push([k]);
    }
  });
}

function readCustomPinsFromSheet(ss) {
  var byKey = {};
  var byCore = {};
  var byCidHash = {};
  var sheet = ss.getSheetByName(CONFIG.TAB_PINS);
  if (!sheet || sheet.getLastRow() <= 1) return { byKey: byKey, byCore: byCore, byCidHash: byCidHash };
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getDisplayValues();
  for (var i = 0; i < rows.length; i++) {
    var k = String(rows[i][0] || '').trim();
    var name = String(rows[i][1] || '').trim();
    var h = String(rows[i][2] || '').trim();
    if (k && h) {
      byKey[k] = h;
      if (name) {
        var c = stripNamePrefix(name);
        byCore[c] = h;
        byCidHash[h] = c;
      }
    }
  }
  return { byKey: byKey, byCore: byCore, byCidHash: byCidHash };
}

function readCorrectionsFromSheet(ss) {
  var sheet = ss.getSheetByName(CONFIG.TAB_CORRECTIONS);
  if (!sheet || sheet.getLastRow() <= 1) return [];
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).getDisplayValues();
  var list = [];
  for (var i = 0; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    list.push({
      id: rows[i][0],
      staffKey: rows[i][1],
      staffName: rows[i][2],
      monthId: rows[i][3],
      monthLabel: rows[i][4],
      day: Number(rows[i][5]) || rows[i][5],
      reason: rows[i][6],
      status: rows[i][7] || 'pending',
      createdAtTs: Number(rows[i][8]) || 0,
      createdAtText: rows[i][9] || ''
    });
  }
  list.sort(function(a, b) { return b.createdAtTs - a.createdAtTs; });
  return list;
}

function verifyAdminAuth(ss, payload) {
  var settings = readSettingsFromSheet(ss, null);
  var expected = settings.adminPinHash;
  if (payload.adminPinHash && String(payload.adminPinHash).trim() === expected) return true;
  if (payload.adminPin && sha256Hex('kbs-att-admin:' + String(payload.adminPin).trim()) === expected) return true;
  return false;
}

function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var action = String(params.action || 'ping').trim();
  return handleAction(action, params);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  var locked = lock.tryLock(25000);
  try {
    var payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (err) {
        return createJsonResponse({ success: false, error: 'รูปแบบ JSON ไม่ถูกต้อง' });
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }
    var action = String(payload.action || '').trim();
    return handleAction(action, payload);
  } catch (err) {
    return createJsonResponse({ success: false, error: err.message || String(err) });
  } finally {
    if (locked) lock.releaseLock();
  }
}

function handleAction(action, payload) {
  try {
    var forceRefresh = payload.forceRefresh === true || payload.forceRefresh === 'true';
    switch (action) {
      case 'ping':
        return createJsonResponse(handlePing());
      case 'getPublicCatalog':
        return createJsonResponse(handleGetPublicCatalog(forceRefresh));
      case 'getTeacherAttendance':
        return createJsonResponse(handleGetTeacherAttendance(payload, forceRefresh));
      case 'submitCorrection':
        return createJsonResponse(handleSubmitCorrection(payload));
      case 'getAdminAllData':
        return createJsonResponse(handleGetAdminAllData(payload, forceRefresh));
      case 'saveAdminSettings':
        return createJsonResponse(handleSaveAdminSettings(payload));
      case 'saveStaffPins':
        return createJsonResponse(handleSaveStaffPins(payload));
      case 'updateCorrectionStatus':
        return createJsonResponse(handleUpdateCorrectionStatus(payload));
      default:
        return createJsonResponse({ success: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return createJsonResponse({ success: false, error: err.message || String(err) });
  }
}

function handlePing() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var tabs = discoverAttendanceTabs(ss);
  return {
    success: true,
    service: 'KBS Attendance Dashboard Multi-Term GAS API',
    spreadsheetId: CONFIG.SPREADSHEET_ID,
    spreadsheetTitle: ss.getName(),
    sheetTitle: tabs.length ? tabs.map(function(t) { return t.name; }).join(', ') : 'ไม่พบแท็บข้อมูล',
    tabsCount: tabs.length,
    lastRow: tabs.length ? tabs[0].sheet.getLastRow() : 0,
    timestamp: Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss')
  };
}

function handleGetPublicCatalog(forceRefresh) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var tabsInfo = discoverAttendanceTabs(ss);
  var tabsDatasets = tabsInfo.map(function(ti) { return parseTabDataset(ti, forceRefresh); });
  var customPins = readCustomPinsFromSheet(ss);
  var liveEprof = loadLiveEprofileMap(forceRefresh);
  var settings = readSettingsFromSheet(ss, tabsDatasets);

  // รวมรายชื่อบุคลากรไม่ซ้ำจากทุกภาคเรียนที่พบ (คงลำดับตามแถวในชีต)
  var seedCidCoreSet = {};
  Object.keys(SEED_CID_HASHES).forEach(function(h) {
    seedCidCoreSet[SEED_CID_HASHES[h]] = true;
  });
  var catalogMap = {};
  var catalogList = [];
  for (var ti = tabsDatasets.length - 1; ti >= 0; ti--) {
    var td = tabsDatasets[ti];
    for (var ri = 0; ri < td.records.length; ri++) {
      var rec = td.records[ri];
      var core = rec.coreName || stripNamePrefix(rec.name);
      if (!catalogMap[core]) {
        var hasCustom = Boolean(customPins.byKey[rec.key] || customPins.byCore[core]);
        var hasSeed = Boolean(seedCidCoreSet[core] || (liveEprof.hashes && liveEprof.hashes[core]));
        var entry = {
          key: rec.key,
          coreName: core,
          rowNumber: rec.rowNumber,
          seq: rec.seq,
          name: rec.name,
          position: rec.position,
          group: rec.group,
          department: (liveEprof.depts && liveEprof.depts[core]) || '',
          hasCustomPin: hasCustom,
          hasSeedPin: hasSeed
        };
        catalogMap[core] = entry;
        catalogList.push(entry);
      }
    }
  }
  catalogList.sort(function(a, b) { return a.rowNumber - b.rowNumber; });

  var termsMeta = tabsDatasets.map(function(td) {
    return {
      termId: td.termId,
      termName: td.termName,
      sortOrder: td.sortOrder,
      staffCount: td.records.length,
      months: td.months
    };
  });

  var syncedAt = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  var latestTerm = termsMeta.length ? termsMeta[termsMeta.length - 1] : null;

  return {
    success: true,
    source: 'gas_live',
    spreadsheetId: CONFIG.SPREADSHEET_ID,
    spreadsheetTitle: ss.getName(),
    sheetTitle: latestTerm ? latestTerm.termName : '',
    syncedAt: syncedAt,
    terms: termsMeta,
    months: latestTerm ? latestTerm.months : [],
    staffCatalog: catalogList,
    settings: {
      visibleTerms: settings.visibleTerms,
      visibleMonths: settings.visibleMonths,
      announcement: settings.announcement,
      updatedAt: settings.updatedAt
    }
  };
}

function resolveCoreByCid(ss, cidInput, cidHashInput, forceRefresh) {
  var normalizedCid = String(cidInput || '').replace(/[\s-]/g, '').toUpperCase();
  var cidHash = normalizedCid ? sha256Hex('cid:' + normalizedCid) : String(cidHashInput || '').trim();
  if (!cidHash) {
    return { ok: false, error: 'กรุณากรอกเลขประจำตัวประชาชน 13 หลัก หรือรหัสเข้าใช้งาน' };
  }

  var customPins = readCustomPinsFromSheet(ss);
  if (customPins.byCidHash[cidHash]) {
    return { ok: true, coreName: customPins.byCidHash[cidHash], cidHash: cidHash };
  }

  var liveEprof = loadLiveEprofileMap(forceRefresh);
  if (liveEprof.cidToCore && liveEprof.cidToCore[cidHash]) {
    return { ok: true, coreName: liveEprof.cidToCore[cidHash], cidHash: cidHash };
  }

  if (SEED_CID_HASHES[cidHash]) {
    return { ok: true, coreName: SEED_CID_HASHES[cidHash], cidHash: cidHash };
  }

  return {
    ok: false,
    error: 'ไม่พบเลขบัตรประชาชนหรือรหัสนี้ในระบบ (โปรดตรวจสอบเลข 13 หลักให้ถูกต้อง หรือติดต่อแอดมินกลุ่มบริหารงานบุคคล)'
  };
}

function handleGetTeacherAttendance(payload, forceRefresh) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var tabsInfo = discoverAttendanceTabs(ss);
  var tabsDatasets = tabsInfo.map(function(ti) { return parseTabDataset(ti, forceRefresh); });

  var coreName = '';
  var cidHashOut = '';
  if (payload.cid || payload.cidHash) {
    var resolved = resolveCoreByCid(ss, payload.cid, payload.cidHash, forceRefresh);
    if (!resolved.ok) return { success: false, error: resolved.error };
    coreName = resolved.coreName;
    cidHashOut = resolved.cidHash;
  } else {
    return { success: false, error: 'กรุณากรอกเลขประจำตัวประชาชน 13 หลัก' };
  }

  var settings = readSettingsFromSheet(ss, tabsDatasets);
  var liveEprof = loadLiveEprofileMap(false);
  var visTerms = settings.visibleTerms || {};
  var visMonths = settings.visibleMonths || {};

  var teacherTerms = [];
  var latestFoundProfile = null;

  for (var tIdx = 0; tIdx < tabsDatasets.length; tIdx++) {
    var td = tabsDatasets[tIdx];
    var rec = null;
    for (var rIdx = 0; rIdx < td.records.length; rIdx++) {
      if (td.records[rIdx].coreName === coreName) {
        rec = td.records[rIdx];
        break;
      }
    }
    if (!rec) continue;
    latestFoundProfile = rec;
    if (!visTerms[td.termId]) continue; // ปิดภาคเรียน/ปีนี้ไว้ ไม่ส่งให้ครู

    // กรองส่งเฉพาะเดือนที่แอดมินเปิดในภาคเรียนนี้
    var filteredMonths = {};
    var openMonthsMeta = [];
    for (var mIdx = 0; mIdx < td.months.length; mIdx++) {
      var mMeta = td.months[mIdx];
      if (visMonths[td.termId + '::' + mMeta.id]) {
        filteredMonths[mMeta.id] = rec.months[mMeta.id];
        openMonthsMeta.push(mMeta);
      }
    }

    teacherTerms.push({
      termId: td.termId,
      termName: td.termName,
      sortOrder: td.sortOrder,
      months: td.months,
      openMonths: openMonthsMeta,
      record: {
        key: rec.key,
        coreName: rec.coreName,
        seq: rec.seq,
        name: rec.name,
        position: rec.position,
        group: rec.group,
        department: (liveEprof.depts && liveEprof.depts[coreName]) || rec.group,
        months: filteredMonths
      }
    });
  }

  if (!latestFoundProfile) {
    return { success: false, error: 'พบเลขบัตรในฐานข้อมูลทะเบียนประวัติ แต่ยังไม่พบรายชื่อในชีตลงเวลาปฏิบัติราชการ' };
  }

  var syncedAt = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  var fallbackLatest = teacherTerms.length ? teacherTerms[teacherTerms.length - 1] : null;

  return {
    success: true,
    source: 'gas_live',
    spreadsheetTitle: ss.getName(),
    syncedAt: syncedAt,
    cidHash: cidHashOut,
    profile: {
      key: latestFoundProfile.key,
      coreName: latestFoundProfile.coreName,
      seq: latestFoundProfile.seq,
      name: latestFoundProfile.name,
      position: latestFoundProfile.position,
      group: latestFoundProfile.group,
      department: (liveEprof.depts && liveEprof.depts[coreName]) || latestFoundProfile.group
    },
    settings: {
      visibleTerms: settings.visibleTerms,
      visibleMonths: settings.visibleMonths,
      announcement: settings.announcement,
      updatedAt: settings.updatedAt
    },
    terms: teacherTerms,
    months: fallbackLatest ? fallbackLatest.months : [],
    record: fallbackLatest ? fallbackLatest.record : {
      key: latestFoundProfile.key,
      name: latestFoundProfile.name,
      position: latestFoundProfile.position,
      group: latestFoundProfile.group,
      months: {}
    }
  };
}

function handleSubmitCorrection(payload) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var resolved = resolveCoreByCid(ss, payload.cid, payload.cidHash, false);
  if (!resolved.ok) return { success: false, error: resolved.error };

  var sheet = getOrCreateHelperSheet(ss, CONFIG.TAB_CORRECTIONS, [
    'RequestId', 'StaffKey', 'StaffName', 'MonthId', 'MonthLabel', 'Day', 'Reason', 'Status', 'CreatedAtTs', 'CreatedAtText'
  ]);
  var reqId = 'req_' + Date.now();
  var nowTs = Date.now();
  var nowText = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'dd/MM/yyyy HH:mm');
  var monthLabelFull = payload.termName ? (payload.monthLabel + ' (' + payload.termName + ')') : String(payload.monthLabel || '');
  sheet.appendRow([
    reqId,
    String(payload.staffKey || ''),
    String(payload.staffName || ''),
    String(payload.monthId || ''),
    monthLabelFull,
    Number(payload.day) || '',
    String(payload.reason || ''),
    'pending',
    nowTs,
    nowText
  ]);
  return { success: true, id: reqId, createdAtText: nowText };
}

function handleGetAdminAllData(payload, forceRefresh) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  if (!verifyAdminAuth(ss, payload)) {
    return { success: false, error: 'รหัส PIN แอดมินไม่ถูกต้อง' };
  }

  var tabsInfo = discoverAttendanceTabs(ss);
  var tabsDatasets = tabsInfo.map(function(ti) { return parseTabDataset(ti, forceRefresh); });
  var settings = readSettingsFromSheet(ss, tabsDatasets);
  var customPins = readCustomPinsFromSheet(ss);
  var corrections = readCorrectionsFromSheet(ss);

  var requestedTermId = String(payload.termId || '').trim();
  var activeDataset = null;
  if (requestedTermId) {
    for (var i = 0; i < tabsDatasets.length; i++) {
      if (tabsDatasets[i].termId === requestedTermId) {
        activeDataset = tabsDatasets[i];
        break;
      }
    }
  }
  if (!activeDataset && tabsDatasets.length > 0) {
    // เลือกแท็บล่าสุดที่มีข้อมูล หรือแท็บล่าสุด
    activeDataset = tabsDatasets[tabsDatasets.length - 1];
  }

  var termsMeta = tabsDatasets.map(function(td) {
    return {
      termId: td.termId,
      termName: td.termName,
      sortOrder: td.sortOrder,
      staffCount: td.records.length,
      months: td.months
    };
  });

  var syncedAt = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');

  return {
    success: true,
    source: 'gas_live',
    spreadsheetId: CONFIG.SPREADSHEET_ID,
    spreadsheetTitle: ss.getName(),
    sheetTitle: activeDataset ? activeDataset.termName : '',
    syncedAt: syncedAt,
    terms: termsMeta,
    activeTermId: activeDataset ? activeDataset.termId : '',
    months: activeDataset ? activeDataset.months : [],
    records: activeDataset ? activeDataset.records : [],
    settings: {
      visibleTerms: settings.visibleTerms,
      visibleMonths: settings.visibleMonths,
      announcement: settings.announcement,
      updatedAt: settings.updatedAt
    },
    customPinKeys: Object.keys(customPins.byKey),
    customPinCores: Object.keys(customPins.byCore),
    corrections: corrections
  };
}

function handleSaveAdminSettings(payload) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  if (!verifyAdminAuth(ss, payload)) {
    return { success: false, error: 'รหัส PIN แอดมินไม่ถูกต้อง' };
  }
  var updates = { updatedAt: new Date().toISOString() };
  if (payload.newAdminPinHash) {
    updates.adminPinHash = String(payload.newAdminPinHash).trim();
  }
  if (payload.settings) {
    if (payload.settings.visibleTerms !== undefined) updates.visibleTerms = payload.settings.visibleTerms;
    if (payload.settings.visibleMonths !== undefined) updates.visibleMonths = payload.settings.visibleMonths;
    if (payload.settings.announcement !== undefined) updates.announcement = payload.settings.announcement;
  }
  writeSettingsToSheet(ss, updates);
  return { success: true, message: 'บันทึกการตั้งค่าลง Google Sheets เรียบร้อยแล้ว' };
}

function handleSaveStaffPins(payload) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  if (!verifyAdminAuth(ss, payload)) {
    return { success: false, error: 'รหัส PIN แอดมินไม่ถูกต้อง' };
  }
  var sheet = getOrCreateHelperSheet(ss, CONFIG.TAB_PINS, ['StaffKey', 'StaffName', 'PinHash', 'UpdatedAt']);
  var incoming = payload.pins || [];
  var nowStr = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');

  var existingRows = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getDisplayValues()
    : [];

  var entries = Array.isArray(incoming)
    ? incoming
    : Object.keys(incoming).map(function(k) { return { key: k, name: '', pinHash: incoming[k] }; });

  entries.forEach(function(item) {
    var k = String(item.key || '').trim();
    var itemName = String(item.name || '').trim();
    var itemCore = stripNamePrefix(itemName);
    if (!k && !itemCore) return;

    var foundRow = -1;
    for (var i = 0; i < existingRows.length; i++) {
      var rk = String(existingRows[i][0]).trim();
      var rCore = stripNamePrefix(existingRows[i][1]);
      if ((k && rk === k) || (itemCore && rCore && rCore === itemCore)) {
        foundRow = i + 2;
        break;
      }
    }
    if (item.pinHash) {
      if (foundRow > 0) {
        sheet.getRange(foundRow, 3, 1, 2).setValues([[String(item.pinHash), nowStr]]);
      } else {
        sheet.appendRow([k, itemName, String(item.pinHash), nowStr]);
        existingRows.push([k, itemName]);
      }
    } else if (foundRow > 0) {
      sheet.getRange(foundRow, 3, 1, 2).setValues([['', nowStr]]);
    }
  });

  return { success: true, message: 'บันทึก PIN ครูลง Google Sheets เรียบร้อยแล้ว' };
}

function handleUpdateCorrectionStatus(payload) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  if (!verifyAdminAuth(ss, payload)) {
    return { success: false, error: 'รหัส PIN แอดมินไม่ถูกต้อง' };
  }
  var sheet = ss.getSheetByName(CONFIG.TAB_CORRECTIONS);
  if (!sheet || sheet.getLastRow() <= 1) return { success: false, error: 'ไม่พบคำร้อง' };

  var reqId = String(payload.id || '').trim();
  var status = String(payload.status || 'resolved').trim();
  var ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === reqId) {
      sheet.getRange(i + 2, 8).setValue(status);
      return { success: true };
    }
  }
  return { success: false, error: 'ไม่พบรหัสคำร้องนี้' };
}
