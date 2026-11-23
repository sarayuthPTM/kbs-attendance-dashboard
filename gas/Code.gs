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
var SEED_PIN_HASHES = {
  "staff_4": "0205f69ba3159f0846e61fe5e57d47a4dce00ab01b6ab7988db7f0e3b6746fdb",
  "staff_5": "cb5ac4ac074dd95ec6893fd1fe66768383343649bec8ce3cca2550a7285346b4",
  "staff_6": "485b1066c5612ae2e8bf28793a34d41263b0d9168580bec31d9706d130a8c1b6",
  "staff_7": "9a0641213f776f07b42dca898afd90291d30d4ea66d121976f1ad51ce2337a73",
  "staff_8": "a35999fa29cabe563c36d73b4b477045d319071a2981977ab9d3edcf8a5f72b0",
  "staff_9": "34949d5c7d0642e5a9d94d2e0c3fc1b5a14a38d8aa64e45de473d3e6a39da5b7",
  "staff_10": "24bbbd7530a7ad77e26f17a90f0226ddd868bd64987b9a1cf748af1643ff70fd",
  "staff_11": "f42d3d46176585d72de351d833b67adde8516ec2950532b5f1a26bf0c7d00d51",
  "staff_12": "a3174eb6759f34e34f3d1ea83e7dd2fcdf3ab27e1542786934b683652ba7e347",
  "staff_13": "db159432487d22fdf123295397b0e6a4e9ffce3ab981eaf88a252b420dea2440",
  "staff_14": "0c9db57468a1c8d325d0abd8cb216c5ed185172f6bc465c2463d7dd621125465",
  "staff_15": "6a5efe50daaaaa40187c91202e6ea7ac79378b9c4774e7b6e5d9bae7b5acf3c0",
  "staff_16": "2b90a0e31b4b11667b4693399f8d3adabc810e37397db7c3ffa2051b3fa6b3c7",
  "staff_17": "bc08d765290f211937ed75f3444a73673f1252010f968bc25a7a5ea74c207477",
  "staff_18": "3176a5b05aa1647f0ba47387d7aedbc0f2dbda8b60571646254338ceaff599eb",
  "staff_19": "b16d064cf32c4ed1554d1690617df5a0a6daa7611bc89e35d484af0827157b2b",
  "staff_20": "e3ed04c44c867a89aae1a46bb7897b8d69997e1374d9c2c44176c8ad053661fe",
  "staff_21": "3eae0b2ecb9cdf0642253197ea840ded23936916b1fe3671a7cc9fe2f98f7613",
  "staff_22": "e97f7e56544b1e8eab7914d9a2b993d4cc48e0549f9d8510bacc7119210d58c5",
  "staff_23": "38b675295909848d78266bf25f6d4a62d472888bfb7b4377a4fcbf3857d954a4",
  "staff_24": "98b55526acec3b7ded15f4f3e15b0521e55ce45db9d2ddfcf46edaab00769815",
  "staff_25": "752305c876130221407a1b2ae59a0e114b565c7d86ba0622cc25aedc4caf0520",
  "staff_26": "b6f661c6afccb43817fe9a6b26fd1eeaf84e116361f86e8e39cd7bc020281801",
  "staff_27": "43c5ad5c546f9eb8ba6a0ee6ce339666bf435fb4f5fbb896b3250dbc099a9671",
  "staff_28": "cca28a0934c886c495a96c73a4c294b2910b13da023e4d4e2bb40583faee01d3",
  "staff_29": "ef1cf32469a733f897f426f03076e9f8958130e69e0ca0f46386f3e556c4e966",
  "staff_30": "da8df44124d9203ba30379ff1943ffd50b866a6fc8859d2c60dfe29a022191ad",
  "staff_31": "f8bef0a8a4e453fd61d6ee07323266168ba414384b134f255057a0fd9f02d449",
  "staff_32": "fca2b80d830a5e5671e64d5b7057bf440ec7a601cb6a7fb9d207a013320bbc47",
  "staff_33": "911fca30e00c3b9cc2d183113b6a1b56c745766d3ca4ee43522690093340e16b",
  "staff_34": "32dfe66787080aa31076bb2494b96b3482cc9d30c075d5d77ed280ead2f68931",
  "staff_35": "85510c3517c831b384a98339e17dccc3eca8b2967a50b98eeee81f9edf5c814b",
  "staff_36": "213b362a746757936dcc498345db7ac94a86e13aad8b45594599dd0e10195120",
  "staff_37": "8896fc048a2574d3ee3be1818b8bbacab672bfd99ff92f2cf20911b663977a75",
  "staff_38": "c860422e10b56647fc6ad817f79154b573a5f68ced99a74b166185facd40b27e",
  "staff_39": "1069a406d2782048642100eb8ebf836c6403094ed20ddf96557cfcea13d68567",
  "staff_40": "f327ac38117f90f021c914b15fc8c3e7d9a4ab89fb781150d0af5068e52a4bc2",
  "staff_41": "716c0f712a213e40ff4d44ebaf6f30b37673b5517dd05ac33d2ded938568feea",
  "staff_42": "d14177390fc06b740d48bda1cb55b5bce61bfbc2d1237f42954bf98a1ab7b006",
  "staff_43": "d6633400f571fc410d6b9e9d39917006b45fed7b6773d41e7982c54b44d89387",
  "staff_44": "74f0ad7e8c0a01e086d1f5fa449c8868f7df1e4922d2542055cdd61683d6ae70",
  "staff_45": "69adcdddb215683239f188c23539cdb32503427fd7419a793b1affe18538c466",
  "staff_46": "0168bd31e21f125ae1f4e959a4ff903842ae6bc7f7f411aa457a0efae842db41",
  "staff_47": "b635e0ed6f373fce53bb9898cf9e6e97308df2faebe1a19490f915526c297291",
  "staff_48": "270b374e35a945ddb925f4385173bb606207160e9f0c0035f9fe3e805287c486",
  "staff_49": "7ea2877e1b8e62c5f10fbc1be8b9d0564de160e72553cb4250778e52b3ec088d",
  "staff_50": "59bd9d6309e17d122d4620b796ecedd379403283972e2154e1be2f17923fa734",
  "staff_51": "94bdce001f36db2aa48eaa3af82ad47d8ac24edfee5537443bfd96fc81cfaf1b",
  "staff_52": "8a3bae686dc7a73e91160b95b06461816534f2d96c0238171b6ddb5a71cfd0e0",
  "staff_53": "63efcb5f8eb15f4b7ecad1576e4a30b4eb29621a44533b4e086282e2a060eac9",
  "staff_54": "efe5846f8dfacb2406ef17465cf6ca237ec8e940521079a6902d7165bc825e2f",
  "staff_55": "56eb59222e8b0ee192fd513e01ff1801154585d9ad650e185e0a414d382f4ee9",
  "staff_56": "88fc610ba119960dea386ca00a8e0061f235b1a76fff00f523ac06fb71ffce35",
  "staff_58": "f24dc34b1155925dc4bcae4c522d8aff5fe808f55b43efe93890af1f8b7a234b",
  "staff_59": "9bdacff66c0a4dd4416c248c6fc9ecacd3c8831715f29364f5182155815750b1",
  "staff_60": "4e2868c323e8eb2b6386092a2381b0665ec7108620e2a460c7cb4e2e68cf7452",
  "staff_61": "906950ca2ad2d112fd0b0e968450fab196837a91c68333587ef3b54ba67ccd7e",
  "staff_62": "6fda025aad167739180bf7ea2116c742ff650384574ab6bc0e596c42b55a7f15",
  "staff_63": "730484a60edc84b3131ea0385d07f83792b6b3d09528a02c0cacc7ec8c404473",
  "staff_64": "e5adf94aeacbd7b30fcc26c1938b0440944b19c07067ea17c08dbd052882423a",
  "staff_65": "8930e868570c96a96ed46a1448864e77837390235fd1058334c0c035c588efc8",
  "staff_66": "20e18f19bee046169e5ab41dd8fb97f9c884238a5ce3be2b15b3e673f8f407d3",
  "staff_67": "a260eba2a8145b479b2b91c21ed489666157e7f547b57a971b285bb5df71e4be",
  "staff_68": "24b475fa8e36fe7ccefda5b73f943f60119b3d7446703683bc51f6f3db57acf5",
  "staff_69": "e8279eda85a15de67700f17f72dbaca31b87030ba510ee6f4ce8be210d988e0a",
  "staff_70": "247f1021335fde81fb03f2c73c43ab99f2a0bebda3cac239bc938c8b87ec9793",
  "staff_71": "ccbeb8ce8e4d1a9c02cc631202528db6bb30d3e051973d0b3c7dd1a0eb5b0049",
  "staff_72": "5fee48a0cc80ad8c3d9466b7607a9b1e1355db95f0fddeb4003fda2df22ee51d",
  "staff_73": "1dd656b406d7702e38bac973921ff7883959936bd9d35c3285067d49c849e3d5",
  "staff_74": "1535b04d92daa3027f6edb65ecfaabc3af66d92a0b7710670cfe2b5352d19f14",
  "staff_75": "85bc1f01d3497d0c05d65f6cc700cbf87c1c9cd01b19ff553b1bc708ab6efc6a",
  "staff_76": "b785eaebb062a77dd9702ad0ed754c5a0ff1ddddf4e071e156f9071e8add37fe",
  "staff_77": "e7f48822722ccbe93525dcefa5d3f39fd6d5f2cbca3947aeb57b6d9cd393824d",
  "staff_78": "6317392d233b54df43660a5c97463ab7dab8ad24cf12e31cfbf4350fe415d119",
  "staff_79": "c034e858fde0834adb64a2d00aa5edc7d9899fccfe533cd44c41e1c6b0184764",
  "staff_80": "429b5b957a6bfd5ec10a8d4401c37d598e92305636fe9fdc1821852f495d625a",
  "staff_81": "504972bd2f59bf107a25258c155c49920d602bf18c0384888b5fe1e9e34e4314",
  "staff_82": "0df76a8759faec676bdba7aa73e09938baf2d5374ae0d20dd41e7e1a46f4ddb8",
  "staff_83": "b39b87acd38400b44270db984946dd0eeb7616981271fdb3d491df1adb80ddbd",
  "staff_84": "ef84153f934a8c3870bc7486ea04435a166e862447d0646cf3b8a9dda7fb7e12",
  "staff_85": "5fa3aee42f9727739cb580870157c9da639794c90d2cf93f6d2816d9eb33b9d3",
  "staff_86": "46bdfe5770b72111ecc2f432e0f0cbc3f290bbbfd87f74dcd168919e3dcd5505",
  "staff_87": "4f9e992dad41841bfd9424c1b2f46607d154686d8622d7f2114f32b93e3ae255",
  "staff_88": "65d8806a60423b460415b2740f2ca9665cd797c28ccabf44866c1e277e2a08f1",
  "staff_89": "34061015a6734f34bdbadb0501f1a11c53b56a6b75793b5f4e3de9e212999fc5",
  "staff_90": "42a2609c9cfd81904c8f28b774f989ecdfd0915c6b8c226f1dcda11c743610e1",
  "staff_91": "9d93637ce10f909161ad408abfb5665a15da47fa2755eeff5a3158ae5333e17c",
  "staff_92": "cc0598b90c6c255c143c89c749b906ec9a36676f75fa46d1f3f1e7f0fa6a9196",
  "staff_93": "91ad5f334a21f45c43983f1ffd9358854ba1a07c7b0eb12af46a12167c6a85ab",
  "staff_94": "af5c17dd7cdf6616c81347d149f46346addf81e3c4bab7c9af7384fbe13a9c3c",
  "staff_95": "40c7a09a1a04caa8c371e838da6bca453a6ead07ab80828130a45fbd6279b99e",
  "staff_96": "8532fa05cc698692d81383516a0d6dd69573a75523d1c1db8bb2a1183bdb3649",
  "staff_97": "37f29168516aacf5e57d379031a83aa7c6fc107369e3b57f051f6473a3a3c384",
  "staff_104": "2fde8025ab997f30a820a9cc8fced4ff400f12dc6a7553be4fffbfe1f387db4f",
  "staff_106": "4fcb32aab4eb72c1d6abe5637b6273c13e43363c5f0eb07d565e75209118559f",
  "staff_121": "24d1066cf8a0330fb73e4b14a4738b2fbf00706b789b3afd3cb3045e46a81155",
  "staff_122": "0caa55d46903dc13efa8e340b1864324fbc6659f030baa68c5085720adb3ad01",
  "staff_123": "47ddc1ff23d28f7ac34451d48adc719c64ee14b5159b7f6a275a832048eac1e4",
  "staff_124": "1a4fce4dc73f52a6a41d1108ca66f8673ca04bfef3e83f245073577957fb4c46",
  "staff_125": "91093f40160deb275a39b1021c73871653083646a28bcbb9a3e84cc233fefdb0",
  "staff_126": "4238833d0151160a516777786d3a3f3646c4d9860cdb6330ee23fd7fc603a0c1"
};
var SEED_NAME_PIN_HASHES = {
  "เกียรติมงคล พูดเพราะ": "44ac5055589bcb436257ecc4bd8fc9c6481cd63879c2eac4280a62322d50bfbe",
  "คนึงนิตย์ แฉล้มรักษ์": "7d08678d5bc921af5ee2762e2c2713064c2f6ee322bb148dd8db26cd3499f54c",
  "วัชระ เปียกบุตร": "581f56b20838823838db40337d28906ee8bb450b489409639cac9331cee0a332",
  "ศรายุทธ พงค์ทองเมือง": "79fb5b8278e5e2ac98991744a5272105cd0ad1d10ef1d415e0925a388cfc30ff",
  "สุธิดา ธนบัตร": "dc2f4c83886f913e37648a4d824f771838f17c60b29f8f81cb19b3bec7e5a971",
  "เปรมฤดี จูหลง": "9ad133b4038f138dc015d8e3d93774a4991cfcd8517d5655b48dd60383e0077b",
  "ณัฐปภัสร์ จันท์เสถียร": "126066f06f139f0ecb8027d8d3f0090168f25ff62ee8e1a74c76fabfc21c7897",
  "รติกาล กลับคง": "e59eab74a1c59e7a143acf45e5dd27b2d26529d06d8a3aa7d4c6733bcee9730a",
  "มูฮัมหมัดฟาเดล ยาลาแว": "4506206cc0bb23cc4ba05976686f6751c5fc755266fed8556115a5ccc7a11f6d",
  "สิริรัตน์ ส่งศรี": "20b8c49368d8aac0cd35650debb9d7872b4fdcb24193a53b8326cffc75554045",
  "อนุรัตน์ นาคสง่า": "d4f5c4060562730d15ba33b301535cf85815e3bf6804b286f1c73c1348adc371",
  "ทัศนีย์ ธรรมทักษ์": "a8d5ca0078fcaabff0f7398f0cbf128c4a31359ea0ebace5a4e34dda143af657",
  "พรพัฒน์ ขวัญนิมิตร": "8da22b6143f97a42f1d49b1e63e6e857cdc01e734d2a4e786188ed926d25bd23",
  "ฟ้ารุ่ง ขวัญเพ็ชร": "8fcb6bf06797d3e140422a9dc446f9fde139be8109e0f954cb2eaff6e6789a41",
  "จันทนา สักคุณา": "a9dc056d52a231e9ee93b50949b1b2800d1ac055dcf44a99011fb80ce7617c9b",
  "นัทธมน ณัฎฐเดช": "123ea89d3ba8e48679a3e6b024ea0c698149c051eb807f26849fcabe1ef2fb7d",
  "ยุพิน ทองแก้ว": "e1abe4268021166d627d90748d8885eff9f0b5697711ee43398f4098f4f5d4a3",
  "รุ่งนภา สุชาฎา": "574da1600b48910ae3df82d2f6edb5e3180b4ce540af9e1f6553c6226296098c",
  "อนุชา หัทยา": "69186bf6e1f79667ce3c1c37703b97250d919b08bf2dd3693bc8cc8cefbd8856",
  "วาทินี เสล่ราษฎร์": "c04c6f19df8fc1b3dcb46c125c5bf603f274d6aa69c7ec3104c1ce34799447fb",
  "อารมณ์ หยีหาสัน": "887c8ce96847eecef3a634c703fa6ffa19e2846cef3734257c8333345994be95",
  "กานต์ชนก กานต์นภัทร": "8dc5a354ecb18b68f225862e3fcd47fa886b21fdf29c34623461a3b99517afaa",
  "สุทิศา ปานแดง": "ccdb96e51f5a9293294f7016af906e0dc5a7d4d496111c4505e6335e99a07c51",
  "ธีติมา มูรติการ": "8cfd7f1a106286246ae22b234f1e8ac53e6e221bf70f3ee34abccd8b0bb037db",
  "ดัยนา หัทยา": "6d5a374967b95d67e439792ce3e7f709acf65b9254e993f5b13acc7d30c33745",
  "ด้าโอด ลูกเด็น": "b8f53440e0e7c3c7a5556d3fd543f610b3d461839e6531a0c8ed3a5d81d28c94",
  "เสาวภาค จันทร์คง": "60eb2c488a34f0cc69c22792c0b8d940309d5982c518000790b3d01f371e6966",
  "สมจารี คันธชาติกุล": "079c80e5a7cb2f1173c6f50abcddc8c8b2d522783bc16e87d1b10035a9d4ec8c",
  "อภิสิทธิ์ ทองสีนุช": "6edc0d43248bca1b9771ac58dd5d34d719bcf09ef25188d2b511faec342152df",
  "บดี กังงา": "0daddb3dbd87b137cc96dd8a75ed889ebd0f667c360ad70becd3d18e438ed6f6",
  "พรศักดิ์ เจียวก๊ก": "f66c6f7cbf03d45d6009b2bb2043effb8697e0057610c7148b51f8b9b7c146bf",
  "ยาใจ มาชู (เสียชีวิต)": "4d64a7a1e9280766971530447565be732e8f177ed9938e77c420a266c141430b",
  "ปิยะมาศ ผกาวรรณ": "32772a3d883748030fb637b99c75e5a571c8d7d5ff5f293a4d3dcc20de025653",
  "พรทิพย์ คงมาก": "1226c018f84064b00b07885632aa6bf2cb7baf6422e3c4149e613de2755f1dbf",
  "ธนพร สระทองแยง": "910f69b88b9562d81087a684d3e75c91bfa53363c25d4f3d000f904725f4d5e0",
  "สุทธวรรณ รักการ": "d2821b3a088efc372062d305611931c6798c54a43f7ae1ac399dd1b7308994bd",
  "อมรรัตน์ ทวีพงศ์ศักดิ์": "53e2495482e54a1a5aedf8a537107135e9477172838339f88e9a60f77bcde67d",
  "กัญญารัตน์ เพ็งจันทร์": "e467d56882292ac9180dc688f9c0d020ee481916c18bbe324b5481810e459072",
  "นภิสรา อุษณีษ์พันธุ์": "76babd3ed93d3c1699c5e8b24117640cb88d8cc96af51a1223a7fd76d9a795af",
  "สายน้ำผึ้ง หมึกดำ": "8ce94d96dd5279f2fee20a4c5be9188eff7f93aa718a200ef6d837296a337605",
  "ทิพย์เกษร แก้วกาญจน์": "da02eb0ad6d431b3b0da533e417b54712998242dbcf72e797b5ca78dd6717e64",
  "ศศิกร สงขาว": "7faae52af920652b7faacffdc2c8ecd98fbe068db6d2b9c29db3a35e66c07fd5",
  "อรสา สมาพงษ์": "99fd103c2626b01e633005597542a2e48c216f8b9ac1d992f9be4a6769c44fea",
  "ชญานิษฐ์ เอ่งฉ้วน": "3111c14e8d9dd6c63f84b9ac82a2b957117254e6e4bb9b9ff0c67708a012c4bb",
  "ลัดดา จันทรดี": "faa69a661fef852be59789095d509986920ed0fdf71d42ea7a23f8b7dac616ee",
  "หทัยรัตน์ ศรีวรเดชไพศาล": "1031c35d222f97e694363bfdef1354465cfd8da8e14b0343df92063397f1f682",
  "ศศิญา จูฑามาตย์": "a50389e8c5456006da8a2968e638de181350b69f82833d2c094398a492f68c17",
  "ปาริชาติ ดำด้วง": "eb55aee9e5efd4078c04b6c4b0d46b2142205e3ec799ee215998da88efa7e4fd",
  "ฐิติยาภรณ์ หล่อสุพรรณพร": "50c61c8c99194a5942f979caf33d9f861066c073c20df2297c64ea53c79a5f71",
  "วีรญา ช้างน้ำ": "a64a3ad16d13e8206a3b2434bbe9b19e354e3996ed7a82264a68dd4a4f6e7b28",
  "ปริญญา สมแก้ว": "e8e4bff0bfc52ad404baed44ea011130b4b03de7fe74b9ba4351962fc71e1cc1",
  "วิภาวี สิทธิการ": "68858aeb33d640f817476d422625e6393a9d707441731380c254d78797ff786c",
  "นันท์นภัส กิติบุญญา": "a0a6cfda5e16061a5e5e618c52416098478d656eaf211d291394778025578d4f",
  "สุชาดา เพชรสุก": "566836127357606e24038ff618de8585c2d2251e88391856cd3c293584de2c0c",
  "อัจฉรา นุ่นชูผล": "8698c0a282f130c2a75458a67338aab5366eeab6dd8dd8f7fb675cf751bcbd37",
  "อภิวัฒน์ กาพย์เกิด": "a225674ebb577c70ab6ce7978dbb5e44100d82dc0cd00e84f6a412bd42eed482",
  "ว่าที่ร้อยตรีหญิงชญานี ชัยสวัสดิ์": "45d77ec282b09482b3d8360e0f3d8cbbb6b9775e96475377cb11326dd3a3f193",
  "เริงสรรค์ ยะลา": "9c5684e37b64e72aa4e5bd9c27b94811e8460b23e755707e33aee86c7c5da9ff",
  "ชลธิชา บัวแต่ง": "838ef02ce636998bd77d4c5adbaebf3de1d1e3964295aef644ed844a2e903fa9",
  "กานต์ลดา สายนุ้ย": "62c388482161e404dc60a563986dc895f6fd82c5b77cc18a01b8bab0761a4a0e",
  "สุนันทา รักราวี": "567ac7436f6f8b5cda9d26d1e680db07290bdee4a05de557ce506a16f1acd778",
  "จุไรรัตน์ เรืองอ่อน": "6a604279376fb7dd9d6bbc2e7cfb4dcc8733d2e0a2fe9b441cc01e8a46a54725",
  "ศุภิสรา ยาวส่ง": "5d23b047c28d92b583167e52323a7e338d068db12a3667b2f8c6819c926d3d5d",
  "ชนกนันท์ จันทร์สงค์": "b3f43af1faab25385192ca2b3016275ce73a3781e8a5a6cc54491e48e42f44a4",
  "ชนะชัย สุวรรณชล": "b7156819a0740d29cd670da9522c56118889d802679454749d9f5838fdf3f974",
  "ภาวิณี ช่วยพัทลุง": "b9245c3cd8331e523f565331f2a9404bf4328291c348ce89369dfbe4e67fea10",
  "ธัญญา กัลยกรกุล": "b812eebdb5cfcc70447f80bd63f1817312e07ceac09d6bdb9a335000c8a69919",
  "วาสนา หนูมาก": "b57d7f73fc31e23567b72740a3e22497c753cd622559f2a8c1abc4b8aac3cfd0",
  "สรารัตน์ โพชสาลี": "38642e1ff2ef65e65ed2dc61483de94cf5c8cac63f3984281bdf7777871a2098",
  "กนกรัตน์ เลี่ยนเส้ง": "88fe8af819a0a295c6ce409fdc407dcb4f44b203ebb516e49c6331821a1d2d3f",
  "ปิยะวรรณ จันทร์ประกอบ": "220236619c30f59b30ff8379acc0bb4549f72597b3e111497467c0095ea286a6",
  "ธนพร ธนาวุฑฒ์": "7ccbcef2429fadb57a8e724fd0ff0feaf66ddae6d2b2f9493e6b0a56a1f1dabc",
  "ธีรยุทธ เหล่ชาย": "1ebb1bc252bd95b366373ba1ff8bf2de78289f1d6c2febc9a974cb80dd656d60",
  "ชลธิชา หนูชูแก้ว": "a1ad88a09a0489e43fc4cb92cdbf90c17c4532899a28c4488e086e0448f26dc1",
  "สมิตา ไชยสาลี": "928d89a22e34f13cb5385c6ef87728db9e8bb554c24f87b958cc70109ad8b026",
  "ปภัสรา รักฤทธิ์": "fe0299f1fa280202a0f9f9b0887f588e9a8446224939e595b7154c3eea0acb3f",
  "มานิตย์ บัวเพชร": "2d10d78a5008343980806935d1428161db23c275c667114fd1ba2196f617dcf9",
  "ปัทมา ญาณแก้ว": "a0958ed1182910e627cdfe67d811ad13375985256fdbab05e1e88625bef6e9cc",
  "ณัฐธิดา แก้วสาระ": "0416024bd866e4c905bf0d345ed80b346e8ecd7b0fb74a6d0ae61f9815550b5e",
  "มาติณห์ สัญจร": "64a6c7c07f6029509a75bccb1e30b3b7c43ae81487d251f5e05896c6aa7d3577",
  "วิทยา เต็มบางงอน": "911ef5b1790d4cab816dde9c30dbbdf2737bc52207ceed50cb4c8cefc32f39aa",
  "จีรพจน์ ทองขาว": "0a0e6fa666ce98112c36807d990593a6001316828ad7087101353bf791c15a46",
  "ณรงค์ศักดิ์ จงจิตร": "96a924743062eec94f04f5735cdea65b5cf11a77939a3a8e9eab7e0e1e95169a",
  "วรวรรณ เพ็ชรฤทธิ์": "3295e92ad7f5f814aff603013b49f3ca2af7109b5af7ec434739734186912c93",
  "ธนากร ชื่นบุตร": "bde5ba25448cd7f316d4e11f25c3bc4c017f9f6f3d8bbeb0af02ccb12e67a2f0",
  "อุไร สังหาร": "a2d4efd75c85a4a40a1a755fa0ffe9cc03df56e3775cc82b5ef3f7c23f6d4f01",
  "วันเฉลิม กัณหะกุล": "66310e598659f7170af0017364d16b3bc5dcc47b4e1c495435d02eeca1843b94",
  "รัชนีวรรณ ชาตรี": "fd2664150ef0993765a5c091f756dd9aa94ebc779b8c757a32849fbae3febb1d",
  "พิมพ์ปวีณ์ เศรษสระ": "50e6bb31600032da6dbb190ac57bec98627bd64ae5caf00c595658f735e384e9",
  "ชัยวัฒน์ ริยาพันธ์": "93c4d0f4366ca70121cd47c082c0d9c48553fb1b4a03f2122f6e8bdd8f16d213",
  "รมิตา จุลนันโท": "c01eb5eab294fffa610679183d0f7f22e5763da6dcf991a7f88f2265440e0f1b",
  "โกษิต ดาวกระจ่าง": "b8815f17d77ac51938e7f377f9786c9980876c35520a47593d09625422adbe6d",
  "อรฤดี เพ็งลำ": "73141f908f7485ddd68f8d6dee9c0a8a7bdf41f13a24362531b11dd0a3212fce",
  "นัฒพล เทียบแก้ว": "8f940ea54c76b428282623aa948ce510415836dd3733fad774da53ccb634b9be",
  "วิชชา ไชยกุล": "d4aeffdbde62f468b7354a40c6189537524c858d1dc2a83a4b4fa5f7157d9ca9",
  "จุมพล เพ็ชรพวง": "6bbaa31083d9ffcbd629fb7a4e25725412ef3cc9216ad9086cef262f226206ce",
  "ศราวุธ เกื้อขาว": "92c24d45836c3d1bf698416caa5fe76653d4cc0a84583a86f1bd926d0b826271",
  "ศรีสุดา สุวรรณโชติ": "b3aceb07f4c67dcfb8b262c6bb877931171c69be1cfa51ecbf6f56247bdb457c",
  "อลิษา แท่นดี": "26c0f4fc528876de6479e489f47005b0e040fde1304c697e6681fd24dad296d3",
  "เสาวนีย์ ชลธี": "23d4ac9d18693acff3b4364fbb75b5e4ed230262481630d42cec395bd81ab86a",
  "กรรณิกา คงภักดี": "800e0a64f46018051d64bfba05107d6bd7ccf622516c20e8b86dd5d76f538d64",
  "คณิน คำกิ่ง": "7925e1698d4744467ef6ee84c56390af1f84367afbcf0c96d4f3aeb3545f2f7e",
  "สกาวเดือน เศษคง": "1ae7c3b362b8fa4f81186136d80febc0ce1c2edaeab1763f9fd10262195d22ca",
  "ธนากร หนูอิน": "de3721b003046a283f206c3a89fee505e2f07acc9f830dd81790d5d4f7c444fa",
  "สราวุธ แก้วสร": "f0a930283ce944b72a5564b499b6a99639e7a480a38e73865b085e2eb8e44afc",
  "ญาณปรีชา ภูขะมา": "4b84b3c380141dd77b308bf6191054108ecccb489e77181c2e19c656024edc96",
  "เอกสิทธิ์ สมันบุตร": "f0b515dc2b619834e21635cd034cefa73a078c1cdd1353316f8d5c8a88e68279",
  "วณิชยา ลิ่มสกุล": "7d7f90cd40bb898e2d832ab51b7ed8b9d310d87557a26e372737eecbe1998bdf",
  "ศุภณัฐ กัณหกุล": "20d70bb056c56f4dfa9ada9d9323f8c1798c953103b30849f02d7e7cf1a53153",
  "เกียรติชานนท์ เสียงดัง": "cdb43d4197027b203fbe9df9616f97a1527e70b6bef33f75618af99877123964",
  "ทินภัทร อนุการ": "190c7f9e6b345e6e181bd9e45cfe87a7e0b6a034223f76c2ba89c666362e195f"
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
        }
      }
    }
    var payload = { hashes: hashes, depts: depts };
    try {
      var serialized = JSON.stringify(payload);
      if (serialized.length < 95000) cache.put(CONFIG.CACHE_EPROFILE_KEY, serialized, CONFIG.CACHE_EPROFILE_TTL);
    } catch (e) {}
    return payload;
  } catch (err) {
    return { hashes: {}, depts: {} };
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
  var sheet = ss.getSheetByName(CONFIG.TAB_PINS);
  if (!sheet || sheet.getLastRow() <= 1) return { byKey: byKey, byCore: byCore };
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getDisplayValues();
  for (var i = 0; i < rows.length; i++) {
    var k = String(rows[i][0] || '').trim();
    var name = String(rows[i][1] || '').trim();
    var h = String(rows[i][2] || '').trim();
    if (k && h) {
      byKey[k] = h;
      if (name) byCore[stripNamePrefix(name)] = h;
    }
  }
  return { byKey: byKey, byCore: byCore };
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
  var catalogMap = {};
  var catalogList = [];
  for (var ti = tabsDatasets.length - 1; ti >= 0; ti--) {
    var td = tabsDatasets[ti];
    for (var ri = 0; ri < td.records.length; ri++) {
      var rec = td.records[ri];
      var core = rec.coreName || stripNamePrefix(rec.name);
      if (!catalogMap[core]) {
        var hasCustom = Boolean(customPins.byKey[rec.key] || customPins.byCore[core]);
        var hasSeed = Boolean(SEED_PIN_HASHES[rec.key] || SEED_NAME_PIN_HASHES[core] || (liveEprof.hashes && liveEprof.hashes[core]));
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

function verifyTeacherPin(ss, staffKey, coreName, pin4, pinHashInput, namePinHashInput, forceRefresh) {
  var customPins = readCustomPinsFromSheet(ss);
  var liveEprof = loadLiveEprofileMap(forceRefresh);
  var keyExpected = customPins.byKey[staffKey] || SEED_PIN_HASHES[staffKey] || '';
  var coreExpected = customPins.byCore[coreName] || (liveEprof.hashes && liveEprof.hashes[coreName]) || SEED_NAME_PIN_HASHES[coreName] || '';

  if (!keyExpected && !coreExpected) {
    return { ok: false, error: 'ยังไม่ได้กำหนดรหัสยืนยันตัวตนสำหรับรายชื่อนี้ กรุณาติดต่อแอดมิน' };
  }

  var keyAttempt = pin4 ? sha256Hex(staffKey + ':' + pin4) : String(pinHashInput || '').trim();
  var coreAttempt = pin4 ? sha256Hex('name:' + coreName + ':' + pin4) : String(namePinHashInput || '').trim();

  if ((keyExpected && keyAttempt && keyAttempt === keyExpected) || (coreExpected && coreAttempt && coreAttempt === coreExpected)) {
    return { ok: true };
  }
  if (!pin4 && !pinHashInput && !namePinHashInput) {
    return { ok: false, error: 'กรุณากรอกรหัสยืนยันตัวตน 4 หลัก' };
  }
  return { ok: false, error: 'รหัสยืนยันตัวตนไม่ถูกต้อง' };
}

function handleGetTeacherAttendance(payload, forceRefresh) {
  var staffKey = String(payload.staffKey || '').trim();
  var coreName = stripNamePrefix(payload.coreName || payload.staffName || '');
  if (!staffKey && !coreName) return { success: false, error: 'กรุณาระบุรหัสบุคลากร' };

  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var tabsInfo = discoverAttendanceTabs(ss);
  var tabsDatasets = tabsInfo.map(function(ti) { return parseTabDataset(ti, forceRefresh); });

  // หาชื่อจริง/coreName หากส่งมาเฉพาะ staffKey
  if (!coreName) {
    for (var ti = 0; ti < tabsDatasets.length; ti++) {
      for (var ri = 0; ri < tabsDatasets[ti].records.length; ri++) {
        if (tabsDatasets[ti].records[ri].key === staffKey) {
          coreName = tabsDatasets[ti].records[ri].coreName;
          break;
        }
      }
      if (coreName) break;
    }
  }

  var auth = verifyTeacherPin(ss, staffKey, coreName, String(payload.pin4 || '').trim(), payload.pinHash, payload.namePinHash, forceRefresh);
  if (!auth.ok) return { success: false, error: auth.error };

  var settings = readSettingsFromSheet(ss, tabsDatasets);
  var visTerms = settings.visibleTerms || {};
  var visMonths = settings.visibleMonths || {};

  var teacherTerms = [];
  var latestFoundProfile = null;

  for (var tIdx = 0; tIdx < tabsDatasets.length; tIdx++) {
    var td = tabsDatasets[tIdx];
    if (!visTerms[td.termId]) continue; // ปิดภาคเรียน/ปีนี้ไว้ ไม่ส่งให้ครู

    var rec = null;
    for (var rIdx = 0; rIdx < td.records.length; rIdx++) {
      if (td.records[rIdx].coreName === coreName || td.records[rIdx].key === staffKey) {
        rec = td.records[rIdx];
        break;
      }
    }
    if (!rec) continue;
    latestFoundProfile = rec;

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
        months: filteredMonths
      }
    });
  }

  var syncedAt = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  var fallbackLatest = teacherTerms.length ? teacherTerms[teacherTerms.length - 1] : null;

  return {
    success: true,
    source: 'gas_live',
    spreadsheetTitle: ss.getName(),
    syncedAt: syncedAt,
    settings: {
      visibleTerms: settings.visibleTerms,
      visibleMonths: settings.visibleMonths,
      announcement: settings.announcement,
      updatedAt: settings.updatedAt
    },
    terms: teacherTerms,
    months: fallbackLatest ? fallbackLatest.months : [],
    record: fallbackLatest ? fallbackLatest.record : (latestFoundProfile ? {
      key: latestFoundProfile.key,
      name: latestFoundProfile.name,
      position: latestFoundProfile.position,
      group: latestFoundProfile.group,
      months: {}
    } : null)
  };
}

function handleSubmitCorrection(payload) {
  var staffKey = String(payload.staffKey || '').trim();
  var coreName = stripNamePrefix(payload.coreName || payload.staffName || '');
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var auth = verifyTeacherPin(ss, staffKey, coreName, String(payload.pin4 || '').trim(), payload.pinHash, payload.namePinHash, forceRefresh);
  if (!auth.ok) return { success: false, error: auth.error };

  var sheet = getOrCreateHelperSheet(ss, CONFIG.TAB_CORRECTIONS, [
    'RequestId', 'StaffKey', 'StaffName', 'MonthId', 'MonthLabel', 'Day', 'Reason', 'Status', 'CreatedAtTs', 'CreatedAtText'
  ]);
  var reqId = 'req_' + Date.now();
  var nowTs = Date.now();
  var nowText = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'dd/MM/yyyy HH:mm');
  var monthLabelFull = payload.termName ? (payload.monthLabel + ' (' + payload.termName + ')') : String(payload.monthLabel || '');
  sheet.appendRow([
    reqId,
    staffKey,
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
