/**
 * ============================================================================
 * ระบบแดชบอร์ดสรุปวันลาและการลงเวลาปฏิบัติราชการ (KBS Attendance Dashboard)
 * โรงเรียนกาญจนาภิเษกวิทยาลัย กระบี่
 * Google Apps Script REST API — 100% Google Sheets Database Engine
 * (เก็บทั้งข้อมูลลงเวลา การตั้งค่าเปิด-ปิดเดือน PIN ครู และคำร้องแก้ไขใน Google Sheets)
 * ============================================================================
 */

var CONFIG = {
  SPREADSHEET_ID: '1AuOkjvEAy2JTS6DqDt1hUZMlVV6TO1EFcxclfVOfAfs',
  SHEET_NAME: 'ข้อมูลลงเวลา 2/69',
  TAB_SETTINGS: '_Dashboard_Settings',
  TAB_PINS: '_Staff_Pins',
  TAB_CORRECTIONS: '_Correction_Requests',
  TIMEZONE: 'Asia/Bangkok',
  CACHE_KEY_FULL: 'kbs_attendance_full_v2',
  CACHE_TTL_SECONDS: 300, // 5 นาที (ใช้ forceRefresh เพื่อดึงสดทันที)
  DEFAULT_ADMIN_PIN: '123456'
};

var MONTHS_META = [
  { id: '2569-10', label: 'ตุลาคม 2569', shortLabel: 'ต.ค. 69', yearBE: 2569, yearCE: 2026, month: 10, daysInMonth: 31, startCol: 3 },
  { id: '2569-11', label: 'พฤศจิกายน 2569', shortLabel: 'พ.ย. 69', yearBE: 2569, yearCE: 2026, month: 11, daysInMonth: 30, startCol: 34 },
  { id: '2569-12', label: 'ธันวาคม 2569', shortLabel: 'ธ.ค. 69', yearBE: 2569, yearCE: 2026, month: 12, daysInMonth: 31, startCol: 65 },
  { id: '2570-01', label: 'มกราคม 2570', shortLabel: 'ม.ค. 70', yearBE: 2570, yearCE: 2027, month: 1, daysInMonth: 31, startCol: 96 },
  { id: '2570-02', label: 'กุมภาพันธ์ 2570', shortLabel: 'ก.พ. 70', yearBE: 2570, yearCE: 2027, month: 2, daysInMonth: 28, startCol: 127 },
  { id: '2570-03', label: 'มีนาคม 2570', shortLabel: 'มี.ค. 70', yearBE: 2570, yearCE: 2027, month: 3, daysInMonth: 31, startCol: 158 }
];

// Hash (SHA-256 of "staffKey:last4IdCard") สำหรับยืนยันตัวตนฝั่งเซิร์ฟเวอร์ (ไม่เก็บเลขบัตรดิบ)
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

function readSettingsFromSheet(ss, monthsSummary) {
  var defaultVisible = {};
  if (Array.isArray(monthsSummary)) {
    monthsSummary.forEach(function(m) { defaultVisible[m.id] = Boolean(m.hasData); });
  }
  var settings = {
    visibleMonths: defaultVisible,
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
    if (key === 'visibleMonths' && val) {
      try { settings.visibleMonths = JSON.parse(val); } catch (e) {}
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
  var map = {};
  var sheet = ss.getSheetByName(CONFIG.TAB_PINS);
  if (!sheet || sheet.getLastRow() <= 1) return map;
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getDisplayValues();
  for (var i = 0; i < rows.length; i++) {
    var k = String(rows[i][0] || '').trim();
    var h = String(rows[i][2] || '').trim();
    if (k && h) map[k] = h;
  }
  return map;
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
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME) || ss.getSheets()[0];
  return {
    success: true,
    service: 'KBS Attendance Dashboard GAS API',
    spreadsheetId: CONFIG.SPREADSHEET_ID,
    spreadsheetTitle: ss.getName(),
    sheetTitle: sheet.getName(),
    lastRow: sheet.getLastRow(),
    timestamp: Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss')
  };
}

function parseSpreadsheetDataset(forceRefresh) {
  var cache = CacheService.getScriptCache();
  if (!forceRefresh) {
    var cached = cache.get(CONFIG.CACHE_KEY_FULL);
    if (cached) {
      try { return JSON.parse(cached); } catch (e) {}
    }
  }

  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME) || ss.getSheets()[0];
  var lastRow = sheet.getLastRow();
  var lastCol = Math.min(206, Math.max(189, sheet.getLastColumn()));
  var values = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();

  // อ่านข้อมูลการ Merge เซลล์ในตารางรายวัน (คอลัมน์ D..GG = 4..189 ในระบบ 1-based)
  var rowMergesMap = {};
  if (lastRow >= 4) {
    var mergedRanges = sheet.getRange(4, 4, lastRow - 3, 186).getMergedRanges();
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

    if (colB === 'ลูกจ้างห้องเรียนกีฬา') {
      currentGroup = 'ลูกจ้างห้องเรียนกีฬา';
      continue;
    }
    if (!colA || isNaN(Number(colA)) || !colB) continue;

    var staffKey = 'staff_' + (r + 1);
    var monthsData = {};
    var rMerges = rowMergesMap[r] || [];

    for (var mi = 0; mi < MONTHS_META.length; mi++) {
      var meta = MONTHS_META[mi];
      var days = [];
      for (var d = 0; d < meta.daysInMonth; d++) {
        days.push(String(row[meta.startCol + d] || '').trim());
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
      rowNumber: r + 1,
      seq: Number(colA),
      name: colB,
      position: colC,
      group: currentGroup,
      months: monthsData
    });
  }

  var monthsSummary = MONTHS_META.map(function(meta) {
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

  var dataset = {
    source: 'gas_live',
    spreadsheetId: CONFIG.SPREADSHEET_ID,
    spreadsheetTitle: ss.getName(),
    sheetTitle: sheet.getName(),
    syncedAt: Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss'),
    months: monthsSummary,
    records: records
  };

  try {
    var serialized = JSON.stringify(dataset);
    if (serialized.length < 95000) {
      cache.put(CONFIG.CACHE_KEY_FULL, serialized, CONFIG.CACHE_TTL_SECONDS);
    }
  } catch (e) {}

  return dataset;
}

function handleGetPublicCatalog(forceRefresh) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var dataset = parseSpreadsheetDataset(forceRefresh);
  var customPins = readCustomPinsFromSheet(ss);
  var settings = readSettingsFromSheet(ss, dataset.months);

  var staffCatalog = dataset.records.map(function(rec) {
    return {
      key: rec.key,
      rowNumber: rec.rowNumber,
      seq: rec.seq,
      name: rec.name,
      position: rec.position,
      group: rec.group,
      hasCustomPin: Boolean(customPins[rec.key]),
      hasSeedPin: Boolean(SEED_PIN_HASHES[rec.key])
    };
  });

  return {
    success: true,
    source: 'gas_live',
    spreadsheetId: dataset.spreadsheetId,
    spreadsheetTitle: dataset.spreadsheetTitle,
    sheetTitle: dataset.sheetTitle,
    syncedAt: dataset.syncedAt,
    months: dataset.months,
    staffCatalog: staffCatalog,
    settings: {
      visibleMonths: settings.visibleMonths,
      announcement: settings.announcement,
      updatedAt: settings.updatedAt
    }
  };
}

function verifyTeacherPin(ss, staffKey, pin4, pinHashInput) {
  var computedHash = pin4 ? sha256Hex(staffKey + ':' + pin4) : String(pinHashInput || '').trim();
  if (!computedHash) return { ok: false, error: 'กรุณากรอกรหัสยืนยันตัวตน 4 หลัก' };

  var customPins = readCustomPinsFromSheet(ss);
  var expectedHash = customPins[staffKey] || SEED_PIN_HASHES[staffKey] || '';
  if (!expectedHash) {
    return { ok: false, error: 'ยังไม่ได้กำหนดรหัสยืนยันตัวตนสำหรับรายชื่อนี้ กรุณาติดต่อแอดมิน' };
  }
  if (computedHash !== expectedHash) {
    return { ok: false, error: 'รหัสยืนยันตัวตนไม่ถูกต้อง' };
  }
  return { ok: true, pinHash: computedHash };
}

function handleGetTeacherAttendance(payload, forceRefresh) {
  var staffKey = String(payload.staffKey || '').trim();
  if (!staffKey) return { success: false, error: 'กรุณาระบุรหัสบุคลากร' };

  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var auth = verifyTeacherPin(ss, staffKey, String(payload.pin4 || '').trim(), payload.pinHash);
  if (!auth.ok) return { success: false, error: auth.error };

  var dataset = parseSpreadsheetDataset(forceRefresh);
  var settings = readSettingsFromSheet(ss, dataset.months);
  var found = null;
  for (var i = 0; i < dataset.records.length; i++) {
    if (dataset.records[i].key === staffKey) {
      found = dataset.records[i];
      break;
    }
  }
  if (!found) return { success: false, error: 'ไม่พบข้อมูลบุคลากรในชีต' };

  // กรองฝั่งเซิร์ฟเวอร์: ส่งเฉพาะเดือนที่แอดมินเปิดให้ครูเห็น
  var filteredMonths = {};
  var vis = settings.visibleMonths || {};
  Object.keys(found.months).forEach(function(mId) {
    if (vis[mId]) filteredMonths[mId] = found.months[mId];
  });

  return {
    success: true,
    source: 'gas_live',
    spreadsheetTitle: dataset.spreadsheetTitle,
    sheetTitle: dataset.sheetTitle,
    syncedAt: dataset.syncedAt,
    months: dataset.months,
    settings: {
      visibleMonths: settings.visibleMonths,
      announcement: settings.announcement,
      updatedAt: settings.updatedAt
    },
    record: {
      key: found.key,
      rowNumber: found.rowNumber,
      seq: found.seq,
      name: found.name,
      position: found.position,
      group: found.group,
      months: filteredMonths
    }
  };
}

function handleSubmitCorrection(payload) {
  var staffKey = String(payload.staffKey || '').trim();
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var auth = verifyTeacherPin(ss, staffKey, String(payload.pin4 || '').trim(), payload.pinHash);
  if (!auth.ok) return { success: false, error: auth.error };

  var sheet = getOrCreateHelperSheet(ss, CONFIG.TAB_CORRECTIONS, [
    'RequestId', 'StaffKey', 'StaffName', 'MonthId', 'MonthLabel', 'Day', 'Reason', 'Status', 'CreatedAtTs', 'CreatedAtText'
  ]);
  var reqId = 'req_' + Date.now();
  var nowTs = Date.now();
  var nowText = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'dd/MM/yyyy HH:mm');
  sheet.appendRow([
    reqId,
    staffKey,
    String(payload.staffName || ''),
    String(payload.monthId || ''),
    String(payload.monthLabel || ''),
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
  var dataset = parseSpreadsheetDataset(forceRefresh);
  var settings = readSettingsFromSheet(ss, dataset.months);
  var customPins = readCustomPinsFromSheet(ss);
  var corrections = readCorrectionsFromSheet(ss);

  return {
    success: true,
    source: dataset.source,
    spreadsheetId: dataset.spreadsheetId,
    spreadsheetTitle: dataset.spreadsheetTitle,
    sheetTitle: dataset.sheetTitle,
    syncedAt: dataset.syncedAt,
    months: dataset.months,
    records: dataset.records,
    settings: {
      visibleMonths: settings.visibleMonths,
      announcement: settings.announcement,
      updatedAt: settings.updatedAt
    },
    customPinKeys: Object.keys(customPins),
    corrections: corrections
  };
}

function handleSaveAdminSettings(payload) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  if (!verifyAdminAuth(ss, payload)) {
    return { success: false, error: 'รหัส PIN แอดมินไม่ถูกต้อง' };
  }
  var updates = {
    updatedAt: new Date().toISOString()
  };
  if (payload.newAdminPinHash) {
    updates.adminPinHash = String(payload.newAdminPinHash).trim();
  }
  if (payload.settings) {
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
  var incoming = payload.pins || {}; // [{ key, name, pinHash }] or { staffKey: hash }
  var nowStr = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');

  var existingRows = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues()
    : [];

  var entries = Array.isArray(incoming)
    ? incoming
    : Object.keys(incoming).map(function(k) { return { key: k, name: '', pinHash: incoming[k] }; });

  entries.forEach(function(item) {
    var k = String(item.key || '').trim();
    if (!k) return;
    var foundRow = -1;
    for (var i = 0; i < existingRows.length; i++) {
      if (String(existingRows[i][0]).trim() === k) {
        foundRow = i + 2;
        break;
      }
    }
    if (item.pinHash) {
      if (foundRow > 0) {
        sheet.getRange(foundRow, 3, 1, 2).setValues([[String(item.pinHash), nowStr]]);
      } else {
        sheet.appendRow([k, String(item.name || ''), String(item.pinHash), nowStr]);
        existingRows.push([k]);
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
