/**
 * ============================================================================
 * KBS Attendance & Leave Dashboard Application Logic
 * ระบบแดชบอร์ดสรุปวันลาและการลงเวลาปฏิบัติราชการ (ภาคเรียนที่ 2/2569)
 * โรงเรียนกาญจนาภิเษกวิทยาลัย กระบี่
 * ============================================================================
 */
(function () {
  'use strict';

  // -------------------- 1. CONSTANTS & STORAGE KEYS --------------------
  const APP_CFG = window.KBS_ATTENDANCE_CONFIG || {};
  const PRIMARY_ADMIN_CORES = Array.isArray(APP_CFG.PRIMARY_ADMIN_CORES) && APP_CFG.PRIMARY_ADMIN_CORES.length
    ? APP_CFG.PRIMARY_ADMIN_CORES
    : ['ศรายุทธ พงค์ทองเมือง'];
  const LS_SETTINGS_KEY = 'KBS_ATT_SETTINGS_LOCAL_V2';
  const LS_CUSTOM_PINS_KEY = 'KBS_ATT_CUSTOM_PINS_LOCAL_V2';
  const LS_TEACHER_AUTH_KEY = 'KBS_ATT_TEACHER_REMEMBER_V1';
  const SS_TEACHER_AUTH_KEY = 'KBS_ATT_TEACHER_SESSION_V1';

  const DEFAULT_MONTHS_META = [
    { id: '2569-10', label: 'ตุลาคม 2569', shortLabel: 'ต.ค. 69', yearBE: 2569, yearCE: 2026, month: 10, daysInMonth: 31, startCol: 3 },
    { id: '2569-11', label: 'พฤศจิกายน 2569', shortLabel: 'พ.ย. 69', yearBE: 2569, yearCE: 2026, month: 11, daysInMonth: 30, startCol: 34 },
    { id: '2569-12', label: 'ธันวาคม 2569', shortLabel: 'ธ.ค. 69', yearBE: 2569, yearCE: 2026, month: 12, daysInMonth: 31, startCol: 65 },
    { id: '2570-01', label: 'มกราคม 2570', shortLabel: 'ม.ค. 70', yearBE: 2570, yearCE: 2027, month: 1, daysInMonth: 31, startCol: 96 },
    { id: '2570-02', label: 'กุมภาพันธ์ 2570', shortLabel: 'ก.พ. 70', yearBE: 2570, yearCE: 2027, month: 2, daysInMonth: 28, startCol: 127 },
    { id: '2570-03', label: 'มีนาคม 2570', shortLabel: 'มี.ค. 70', yearBE: 2570, yearCE: 2027, month: 3, daysInMonth: 31, startCol: 158 }
  ];

  const CODE_LEGEND = [
    { code: '/', label: 'มาปฏิบัติราชการปกติ', badgeCls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    { code: 'ร', label: 'ไปราชการ', badgeCls: 'bg-sky-100 text-sky-800 border-sky-200' },
    { code: 'ส', label: 'มาสาย', badgeCls: 'bg-amber-100 text-amber-800 border-amber-300' },
    { code: 'มข', label: 'ไม่สแกนนิ้วเข้า (no in)', badgeCls: 'bg-purple-100 text-purple-800 border-purple-200' },
    { code: 'มอ', label: 'ไม่สแกนนิ้วออก (no out)', badgeCls: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    { code: 'ส/มอ', label: 'สาย + ไม่สแกนออก', badgeCls: 'bg-orange-100 text-orange-800 border-orange-300' },
    { code: 'ข / ขย', label: 'ขออนุญาตออก (รวม ข/มอ)', badgeCls: 'bg-teal-100 text-teal-800 border-teal-200' },
    { code: 'ก / กช / กบ', label: 'ลากิจ (กช/กบ = 0.5 วัน)', badgeCls: 'bg-pink-100 text-pink-800 border-pink-200' },
    { code: 'ป / ปช / ปบ', label: 'ลาป่วย (ปช/ปบ = 0.5 วัน)', badgeCls: 'bg-rose-100 text-rose-800 border-rose-200' },
    { code: 'ค / บ / ภ', label: 'ลาคลอด / ลาบวช / ลาช่วยภริยาฯ', badgeCls: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200' },
    { code: '-', label: 'ขาดราชการ', badgeCls: 'bg-red-600 text-white border-red-700' }
  ];

  // -------------------- 2. PURE JS SHA-256 (WORKS ON file:// AND https://) --------------------
  function sha256Hex(str) {
    const utf8 = unescape(encodeURIComponent(String(str)));
    const words = [];
    for (let i = 0; i < utf8.length; i++) {
      words[i >> 2] |= (utf8.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
    }
    const bitLen = utf8.length * 8;
    words[bitLen >> 5] |= 0x80 << (24 - (bitLen % 32));
    words[((bitLen + 64 >> 9) << 4) + 15] = bitLen;

    const K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    let H = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ];
    const rotr = (n, x) => (x >>> n) | (x << (32 - n));

    for (let i = 0; i < words.length; i += 16) {
      const W = new Array(64);
      for (let t = 0; t < 16; t++) W[t] = words[i + t] | 0;
      for (let t = 16; t < 64; t++) {
        const s0 = rotr(7, W[t - 15]) ^ rotr(18, W[t - 15]) ^ (W[t - 15] >>> 3);
        const s1 = rotr(17, W[t - 2]) ^ rotr(19, W[t - 2]) ^ (W[t - 2] >>> 10);
        W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let t = 0; t < 64; t++) {
        const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + S1 + ch + K[t] + W[t]) | 0;
        const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + temp1) | 0;
        d = c; c = b; b = a; a = (temp1 + temp2) | 0;
      }
      H = [
        (H[0] + a) | 0, (H[1] + b) | 0, (H[2] + c) | 0, (H[3] + d) | 0,
        (H[4] + e) | 0, (H[5] + f) | 0, (H[6] + g) | 0, (H[7] + h) | 0
      ];
    }
    return H.map(v => (v >>> 0).toString(16).padStart(8, '0')).join('');
  }

  function createDefaultKvkEmblemDataUri() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <defs>
        <radialGradient id="s3bg" cx="0.35" cy="0.3" r="0.75">
          <stop offset="0%" stop-color="#1E3A8A"/>
          <stop offset="60%" stop-color="#0F172A"/>
          <stop offset="100%" stop-color="#060B19"/>
        </radialGradient>
        <linearGradient id="s3gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#FEF3C7"/>
          <stop offset="50%" stop-color="#F59E0B"/>
          <stop offset="100%" stop-color="#B45309"/>
        </linearGradient>
        <linearGradient id="s3cyan" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#E0F2FE"/>
          <stop offset="100%" stop-color="#60A5FA"/>
        </linearGradient>
      </defs>
      <circle cx="256" cy="256" r="232" fill="url(#s3bg)" stroke="url(#s3gold)" stroke-width="12"/>
      <circle cx="256" cy="256" r="210" fill="none" stroke="#60A5FA" stroke-opacity="0.2" stroke-width="2"/>
      <path d="M132 256 A124 124 0 1 1 256 380" fill="none" stroke="url(#s3cyan)" stroke-width="18" stroke-linecap="round" opacity="0.88"/>
      <path d="M170 256 A86 86 0 1 1 324 308" fill="none" stroke="url(#s3gold)" stroke-width="18" stroke-linecap="round"/>
      <path d="M210 256 A46 46 0 1 1 256 302" fill="none" stroke="#FFFFFF" stroke-width="16" stroke-linecap="round"/>
      <path d="M236 256 L262 282 L348 184" fill="none" stroke="url(#s3gold)" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="206" y="408" width="100" height="10" rx="5" fill="url(#s3gold)"/>
    </svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  // -------------------- 3. APPLICATION STATE --------------------
  const seedStaff = Array.isArray(window.KBS_ATTENDANCE_STAFF_SEED) ? window.KBS_ATTENDANCE_STAFF_SEED : [];
  const seedMap = new Map(seedStaff.map(s => [s.key, s]));
  const seedCidHashes = window.KBS_ATTENDANCE_CID_HASHES || {};
  const seedCidCoreSet = new Set(Object.values(seedCidHashes));
  const fallbackData = window.KBS_ATTENDANCE_FALLBACK_DATA || null;

  const EPROFILE_DEPT_ORDER = [
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
    'เจ้าหน้าที่ อื่นๆ',
    'ห้องเรียนกีฬา'
  ];

  function resolveStaffDepartment(item) {
    if (!item) return 'เจ้าหน้าที่ อื่นๆ';
    const core = item.coreName || stripNamePrefix(item.name);
    const catHit = (typeof state !== 'undefined' && Array.isArray(state.staffCatalog))
      ? state.staffCatalog.find(s => (core && s.coreName === core) || (item.key && s.key === item.key))
      : null;
    const seedHit = seedMap.get(item.key) || (core ? seedStaff.find(s => s.coreName === core) : null);
    const raw = item.department || (catHit && catHit.department) || (seedHit && seedHit.department) || '';
    if (raw === 'เจ้าหน้าที่ / อื่นๆ') return 'เจ้าหน้าที่ อื่นๆ';
    if (raw) return raw;
    return item.group === 'ลูกจ้างห้องเรียนกีฬา' ? 'ห้องเรียนกีฬา' : 'เจ้าหน้าที่ อื่นๆ';
  }

  function getDepartmentRankMap() {
    const order = (typeof state !== 'undefined' && Array.isArray(state.eprofileTabs) && state.eprofileTabs.length)
      ? [...state.eprofileTabs, 'ห้องเรียนกีฬา']
      : EPROFILE_DEPT_ORDER;
    return new Map(order.map((name, idx) => [name, idx]));
  }

  function getOrderedDepartmentCounts(list) {
    const counts = new Map();
    (list || []).forEach(item => {
      const dept = resolveStaffDepartment(item);
      counts.set(dept, (counts.get(dept) || 0) + 1);
    });
    const rankMap = getDepartmentRankMap();
    return [...counts.entries()].sort((a, b) => {
      const ra = rankMap.has(a[0]) ? rankMap.get(a[0]) : 999;
      const rb = rankMap.has(b[0]) ? rankMap.get(b[0]) : 999;
      if (ra !== rb) return ra - rb;
      return a[0].localeCompare(b[0], 'th');
    });
  }

  function stripNamePrefix(s) {
    return String(s || '')
      .replace(/^(ว่าที่\s*ร้อยตรี\s*หญิง|ว่าที่\s*ร้อยตรี|ว่าที่\s*ร\.?\s*ต\.?\s*หญิง|ว่าที่\s*ร\.?\s*ต\.?|นางสาว|นาง|นาย|น\.ส\.|ดร\.|Mr\.?|Mrs\.?|Ms\.?|Miss)\s*/i, '')
      .replace(/\s+/g, ' ')
      .replace('วิภารัตน์ ลูกอ้อน', 'วิภารัตน์ ลูกอ้น')
      .trim()
      .toLowerCase();
  }

  const initialMonths = (fallbackData && fallbackData.months)
    ? fallbackData.months
    : DEFAULT_MONTHS_META.map(m => ({ ...m, recordedCells: 0, activeDays: 0, hasData: false }));

  const initialTerms = [{
    termId: '0',
    termName: (fallbackData && fallbackData.sheetTitle) || 'ข้อมูลลงเวลา 2/69',
    sortOrder: 25692,
    staffCount: (fallbackData && fallbackData.records) ? fallbackData.records.length : seedStaff.length,
    months: initialMonths
  }];

  const DEFAULT_SITE_CONFIG = {
    siteTitle: 'ระบบสรุปวันลาและการลงเวลาปฏิบัติราชการ',
    siteSubtitle: '',
    schoolName: (APP_CFG && APP_CFG.SCHOOL_NAME) || 'โรงเรียนกาญจนาภิเษกวิทยาลัย กระบี่',
    loginTagline: 'กลุ่มบริหารงานบุคคล • KBS Smart HR',
    footerText: 'กลุ่มบริหารงานบุคคล โรงเรียนกาญจนาภิเษกวิทยาลัย กระบี่ • เชื่อมโยงข้อมูลจาก Google Sheets (Vercel + GitHub)',
    themePreset: 'kbs_navy',
    primaryColor: '#1e3a8a',
    accentColor: '#d97706',
    fontFamily: 'Prompt',
    fontSizeScale: 'normal',
    allowTeacherPrint: true,
    allowTeacherCorrection: true,
    showLoginOpenMonths: true,
    attendanceSheetUrl: `https://docs.google.com/spreadsheets/d/${(APP_CFG && APP_CFG.SPREADSHEET_ID) || '1AuOkjvEAy2JTS6DqDt1hUZMlVV6TO1EFcxclfVOfAfs'}/edit`,
    eprofileSheetUrl: 'https://docs.google.com/spreadsheets/d/1-N4DD6OaR4j8kNubJjRyShffuN3rXZqrfjjwwN9ly_A/edit',
    appsScriptUrl: 'https://script.google.com/home/projects/1GnHRtiMBLEih5RRb5mOUf7MdBK2xHXlg9zycmOGZvBAcKWvd16Y_fuM6/edit'
  };

  const THEME_PRESETS = [
    { id: 'kbs_navy', name: 'กรมท่า – ทอง (KBS)', primary: '#1e3a8a', accent: '#d97706' },
    { id: 'emerald_gold', name: 'เขียวมรกต – ทอง', primary: '#065f46', accent: '#d97706' },
    { id: 'royal_purple', name: 'ม่วงราชพฤกษ์ – ทอง', primary: '#5b21b6', accent: '#d97706' },
    { id: 'sky_amber', name: 'ฟ้าคราม – ส้มอำพัน', primary: '#0369a1', accent: '#ea580c' },
    { id: 'crimson_gold', name: 'แดงเลือดนก – ทอง', primary: '#991b1b', accent: '#d97706' },
    { id: 'slate_blue', name: 'เทาไทเทเนียม – ฟ้า', primary: '#334155', accent: '#2563eb' }
  ];

  function getSiteConfig() {
    return { ...DEFAULT_SITE_CONFIG, ...((state.settings && state.settings.siteConfig) || {}) };
  }

  function sanitizeHexColor(val, fallback) {
    return /^#[0-9a-fA-F]{6}$/.test(String(val || '').trim()) ? String(val).trim().toLowerCase() : fallback;
  }

  function sanitizeSafeExternalUrl(val, fallback) {
    const s = String(val || '').trim();
    return /^https?:\/\//i.test(s) ? s : fallback;
  }

  function hexToRgbArray(hex) {
    const clean = sanitizeHexColor(hex, '#1e3a8a').slice(1);
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16)
    ];
  }

  function shiftHexRgb(hex, factor) {
    const [r, g, b] = hexToRgbArray(hex);
    const adj = c => Math.max(0, Math.min(255, Math.round(factor < 1 ? c * factor : c + (255 - c) * (factor - 1))));
    const nr = adj(r), ng = adj(g), nb = adj(b);
    const toHex = n => n.toString(16).padStart(2, '0');
    return {
      hex: `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`,
      rgb: `${nr} ${ng} ${nb}`
    };
  }

  function applySiteConfigToDom(overrideCfg = null) {
    const cfg = overrideCfg ? { ...DEFAULT_SITE_CONFIG, ...overrideCfg } : getSiteConfig();
    const primary = sanitizeHexColor(cfg.primaryColor, DEFAULT_SITE_CONFIG.primaryColor);
    const accent = sanitizeHexColor(cfg.accentColor, DEFAULT_SITE_CONFIG.accentColor);
    const primaryRgb = hexToRgbArray(primary).join(' ');
    const primaryDark = shiftHexRgb(primary, 0.55);
    const primaryMid = shiftHexRgb(primary, 1.15);
    const accentRgb = hexToRgbArray(accent).join(' ');
    const accentLight = shiftHexRgb(accent, 1.35);
    const accentSoft = shiftHexRgb(accent, 1.86);

    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--kbs-navy-rgb', primaryRgb);
    rootStyle.setProperty('--kbs-navy-dark-rgb', primaryDark.rgb);
    rootStyle.setProperty('--kbs-navy-mid-rgb', primaryMid.rgb);
    rootStyle.setProperty('--kbs-gold-rgb', accentRgb);
    rootStyle.setProperty('--kbs-gold-light-rgb', accentLight.rgb);
    rootStyle.setProperty('--kbs-gold-soft-rgb', accentSoft.rgb);
    rootStyle.setProperty('--kbs-navy', primary);
    rootStyle.setProperty('--kbs-navy-dark', primaryDark.hex);
    rootStyle.setProperty('--kbs-navy-mid', primaryMid.hex);
    rootStyle.setProperty('--kbs-gold', accent);
    rootStyle.setProperty('--kbs-gold-light', accentLight.hex);

    const allowedFonts = ['Prompt', 'Sarabun', 'Kanit', 'Noto Sans Thai', 'IBM Plex Sans Thai'];
    const fontName = allowedFonts.includes(cfg.fontFamily) ? cfg.fontFamily : 'Prompt';
    rootStyle.setProperty('--kbs-font', `'${fontName}', 'Prompt', sans-serif`);
    if (document.body) {
      document.body.style.fontFamily = `'${fontName}', 'Prompt', sans-serif`;
    }

    const scalePx = cfg.fontSizeScale === 'compact' ? '14px' : (cfg.fontSizeScale === 'large' ? '17.5px' : '16px');
    document.documentElement.style.fontSize = scalePx;

    const metaTheme = $('meta-theme-color');
    if (metaTheme) metaTheme.setAttribute('content', primary);

    const titleTxt = (cfg.siteTitle || DEFAULT_SITE_CONFIG.siteTitle).trim();
    const schoolTxt = (cfg.schoolName || DEFAULT_SITE_CONFIG.schoolName).trim();
    if ($('header-site-title')) $('header-site-title').textContent = titleTxt;
    document.title = `${titleTxt} | ${schoolTxt}`;
    if ($('login-tagline-text')) $('login-tagline-text').textContent = (cfg.loginTagline || DEFAULT_SITE_CONFIG.loginTagline).trim();
    if ($('site-footer')) $('site-footer').textContent = (cfg.footerText || DEFAULT_SITE_CONFIG.footerText).trim();

    if ($('login-open-months-card')) {
      $('login-open-months-card').classList.toggle('hidden', cfg.showLoginOpenMonths === false);
    }
    if ($('td-btn-print')) {
      $('td-btn-print').classList.toggle('hidden', cfg.allowTeacherPrint === false);
    }
    if ($('td-btn-request-correction')) {
      $('td-btn-request-correction').classList.toggle('hidden', cfg.allowTeacherCorrection === false);
    }

    const attUrl = sanitizeSafeExternalUrl(cfg.attendanceSheetUrl, DEFAULT_SITE_CONFIG.attendanceSheetUrl);
    const eprofUrl = sanitizeSafeExternalUrl(cfg.eprofileSheetUrl, DEFAULT_SITE_CONFIG.eprofileSheetUrl);
    const gasEditUrl = sanitizeSafeExternalUrl(cfg.appsScriptUrl, DEFAULT_SITE_CONFIG.appsScriptUrl);
    if ($('link-open-attendance-sheet')) $('link-open-attendance-sheet').href = attUrl;
    if ($('link-open-eprofile-sheet')) $('link-open-eprofile-sheet').href = eprofUrl;
    if ($('link-open-apps-script')) $('link-open-apps-script').href = gasEditUrl;
  }

  const state = {
    mode: 'teacher', // 'teacher' | 'admin'
    adTab: 'overview', // 'overview' | 'months' | 'pins' | 'requests' | 'settings'
    dataSource: fallbackData ? 'snapshot' : 'none',
    vercelProxyAvailable: false,
    syncedAt: fallbackData ? fallbackData.syncedAt : '',
    terms: initialTerms,
    months: initialMonths,
    eprofileTabs: [...EPROFILE_DEPT_ORDER],
    staffCatalog: buildInitialCatalog(),
    adminSelectedTermId: '0',
    adminRecordsByTerm: fallbackData && fallbackData.records ? { '0': fallbackData.records } : {},
    adminRecords: null,
    settings: {
      visibleTerms: { '0': true },
      visibleMonths: buildDefaultVisibleMonths('0', initialMonths),
      announcement: '',
      gasUrl: (APP_CFG.GAS_API_URL || '').trim(),
      adminCores: [...PRIMARY_ADMIN_CORES],
      siteConfig: { ...DEFAULT_SITE_CONFIG },
      updatedAt: ''
    },
    adminCores: [...PRIMARY_ADMIN_CORES],
    primaryAdminCores: [...PRIMARY_ADMIN_CORES],
    customPinHashes: {}, // staffKey -> sha256Hex('cid:' + normalizedCidOrCode)
    customPinKeysFromGas: new Set(),
    customPinCoresFromGas: new Set(),
    corrections: [],
    currentTeacher: null, // { key, coreName, name, position, group, department, avatarUrl, isAdmin, isPrimaryAdmin, terms: [...] }
    teacherAuthSession: null, // { staffKey, coreName, cidHash }
    teacherSelectedTermId: null,
    teacherSelectedMonthTab: 'all', // 'all' | monthId
    teacherCalendarMonthId: null,
    adminCidHash: null,
    charts: {
      tdMonthly: null,
      tdBreakdown: null,
      adMonthly: null,
      adIssues: null,
      adTopAbsent: null,
      adTopLeave: null,
      adTopLate: null,
      adTopNoOut: null
    }
  };

  function buildInitialCatalog() {
    if (seedStaff.length > 0) return seedStaff.map(s => ({ ...s }));
    if (fallbackData && Array.isArray(fallbackData.records)) {
      return fallbackData.records.map(r => ({
        key: r.key,
        coreName: stripNamePrefix(r.name),
        rowNumber: r.rowNumber,
        seq: r.seq,
        name: r.name,
        position: r.position,
        group: r.group,
        department: r.department || r.group,
        avatarUrl: '',
        hasSeedPin: Boolean(seedCidCoreSet.has(stripNamePrefix(r.name)))
      }));
    }
    return [];
  }

  function buildDefaultVisibleMonths(termId = '0', monthsList = null) {
    const out = {};
    const months = monthsList || ((fallbackData && fallbackData.months) ? fallbackData.months : DEFAULT_MONTHS_META);
    months.forEach(m => {
      out[`${termId}::${m.id}`] = Boolean(m.hasData);
    });
    if (!Object.values(out).some(Boolean) && months.length > 0) {
      out[`${termId}::${months[0].id}`] = true;
    }
    return out;
  }

  // -------------------- 4. DOM HELPERS & UTILITIES --------------------
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  function setButtonLoading(btn, loading, loadingText) {
    if (!btn) return;
    if (loading) {
      if (!btn.dataset.origHtml) btn.dataset.origHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-inline"></span><span>${esc(loadingText || 'กำลังดำเนินการ...')}</span>`;
    } else {
      btn.disabled = false;
      if (btn.dataset.origHtml) {
        btn.innerHTML = btn.dataset.origHtml;
      }
      refreshIcons();
    }
  }

  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  function toast(title, icon = 'success') {
    if (window.Swal) {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon,
        title,
        showConfirmButton: false,
        timer: 2600,
        timerProgressBar: true
      });
    }
  }

  function formatNumber(n) {
    const num = Number(n || 0);
    return Number.isInteger(num) ? String(num) : num.toFixed(1).replace(/\.0$/, '');
  }

  function isTermVisible(termId) {
    const vt = state.settings.visibleTerms || {};
    if (vt[termId] !== undefined) return Boolean(vt[termId]);
    return termId === '0';
  }

  function isMonthVisible(termId, monthId) {
    const vm = state.settings.visibleMonths || {};
    const scopedKey = `${termId}::${monthId}`;
    if (vm[scopedKey] !== undefined) return Boolean(vm[scopedKey]);
    if (termId === '0' && vm[monthId] !== undefined) return Boolean(vm[monthId]);
    return false;
  }

  function getOpenTermsList() {
    return state.terms.filter(tm => isTermVisible(tm.termId));
  }

  function getVisibleMonthsList(termId = null) {
    if (termId) {
      const tm = state.terms.find(x => x.termId === termId);
      if (!tm || !isTermVisible(tm.termId)) return [];
      return (tm.months || []).filter(m => isMonthVisible(tm.termId, m.id));
    }
    // ถ้าไม่ระบุ termId ให้รวมเดือนที่เปิดในภาคเรียนที่กำลังเลือก (หรือเทอมแรกที่เปิด)
    const openTerms = getOpenTermsList();
    if (openTerms.length === 0) return [];
    const targetTerm = openTerms.find(t => t.termId === state.teacherSelectedTermId) || openTerms[openTerms.length - 1];
    return (targetTerm.months || []).filter(m => isMonthVisible(targetTerm.termId, m.id));
  }

  function getAllOpenMonthsCount() {
    let total = 0;
    getOpenTermsList().forEach(tm => {
      total += (tm.months || []).filter(m => isMonthVisible(tm.termId, m.id)).length;
    });
    return total;
  }

  function getCodeMeta(rawCode) {
    const v = String(rawCode || '').trim();
    if (!v) return { type: 'empty', label: 'ไม่มีข้อมูล / วันหยุด', short: '', badgeCls: 'bg-slate-50 text-slate-300 border-slate-100' };
    if (v === '/') return { type: 'present', label: 'มาปฏิบัติราชการปกติ', short: '/', badgeCls: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    if (v === 'ร') return { type: 'duty', label: 'ไปราชการ', short: 'ร', badgeCls: 'bg-sky-100 text-sky-800 border-sky-200' };
    if (v === '-') return { type: 'absent', label: 'ขาดราชการ', short: '-', badgeCls: 'bg-red-600 text-white border-red-700' };
    if (v === 'ส') return { type: 'late', label: 'มาสาย', short: 'ส', badgeCls: 'bg-amber-100 text-amber-800 border-amber-300' };
    if (v === 'ส/มอ') return { type: 'late_no_out', label: 'มาสาย + ไม่สแกนนิ้วออก', short: 'ส/มอ', badgeCls: 'bg-orange-100 text-orange-800 border-orange-300' };
    if (v === 'ส/ขย') return { type: 'late_early', label: 'มาสาย + ขออนุญาตออก', short: 'ส/ขย', badgeCls: 'bg-orange-100 text-orange-800 border-orange-300' };
    if (v === 'มข') return { type: 'no_in', label: 'ไม่สแกนนิ้วเข้า (no in)', short: 'มข', badgeCls: 'bg-purple-100 text-purple-800 border-purple-200' };
    if (v === 'มอ') return { type: 'no_out', label: 'ไม่สแกนนิ้วออก (no out)', short: 'มอ', badgeCls: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
    if (v === 'ข' || v === 'ขย' || v === 'ข/มอ') {
      const extra = v === 'ข/มอ' ? 'ขออนุญาตออก + ไม่สแกนออก' : 'ขออนุญาตออก';
      return { type: 'early_out', label: extra, short: v, badgeCls: 'bg-teal-100 text-teal-800 border-teal-200' };
    }
    if (v.startsWith('ก')) {
      const days = v.startsWith('ก/') ? v.slice(2) + ' วัน' : (v === 'กช' ? 'ครึ่งวันเช้า' : v === 'กบ' ? 'ครึ่งวันบ่าย' : '1 วัน');
      return { type: 'leave_personal', label: `ลากิจ (${days})`, short: v, badgeCls: 'bg-pink-100 text-pink-800 border-pink-200' };
    }
    if (v.startsWith('ป')) {
      const days = v.startsWith('ป/') ? v.slice(2) + ' วัน' : (v === 'ปช' ? 'ครึ่งวันเช้า' : v === 'ปบ' ? 'ครึ่งวันบ่าย' : '1 วัน');
      return { type: 'leave_sick', label: `ลาป่วย (${days})`, short: v, badgeCls: 'bg-rose-100 text-rose-800 border-rose-200' };
    }
    if (v.startsWith('ค')) {
      const days = v.startsWith('ค/') ? v.slice(2) + ' วัน' : '1 วัน';
      return { type: 'leave_maternity', label: `ลาคลอด (${days})`, short: v, badgeCls: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200' };
    }
    if (v.startsWith('บ')) {
      const days = v.startsWith('บ/') ? v.slice(2) + ' วัน' : '1 วัน';
      return { type: 'leave_ordain', label: `ลาบวช (${days})`, short: v, badgeCls: 'bg-amber-100 text-amber-900 border-amber-300' };
    }
    if (v.startsWith('ภ')) {
      const days = v.startsWith('ภ/') ? v.slice(2) + ' วัน' : '1 วัน';
      return { type: 'leave_paternity', label: `ลาไปช่วยเหลือภริยาฯ (${days})`, short: v, badgeCls: 'bg-cyan-100 text-cyan-800 border-cyan-200' };
    }
    return { type: 'other', label: v, short: v, badgeCls: 'bg-slate-200 text-slate-700 border-slate-300' };
  }

  // -------------------- 5. EXACT ATTENDANCE CALCULATION ENGINE --------------------
  function calcMonthStats(monthData, startDay = 1, endDay = 31) {
    const stats = {
      present: 0,
      duty: 0,
      personalCount: 0, personalDays: 0,
      sickCount: 0, sickDays: 0,
      maternityCount: 0, maternityDays: 0,
      ordainCount: 0, ordainDays: 0,
      paternityCount: 0, paternityDays: 0,
      totalLeaveCount: 0, totalLeaveDays: 0,
      noIn: 0,
      noOut: 0,
      late: 0,
      absent: 0,
      earlyOut: 0
    };
    if (!monthData || !Array.isArray(monthData.days)) return stats;

    const minIdx = Math.max(0, Number(startDay || 1) - 1);
    const maxIdx = Math.min(monthData.days.length - 1, Number(endDay || monthData.days.length) - 1);
    for (let idx = minIdx; idx <= maxIdx; idx++) {
      const v = String(monthData.days[idx] || '').trim();
      if (!v) continue;
      if (v === '/') { stats.present++; continue; }
      if (v === 'ร') { stats.duty++; continue; }

      if (v.startsWith('ก')) {
        stats.personalCount++;
        if (v.startsWith('ก/')) stats.personalDays += parseFloat(v.slice(2)) || 0;
        else if (v === 'ก') stats.personalDays += 1;
        else if (v === 'กช' || v === 'กบ') stats.personalDays += 0.5;
      } else if (v.startsWith('ป')) {
        stats.sickCount++;
        if (v.startsWith('ป/')) stats.sickDays += parseFloat(v.slice(2)) || 0;
        else if (v === 'ป') stats.sickDays += 1;
        else if (v === 'ปช' || v === 'ปบ') stats.sickDays += 0.5;
      } else if (v.startsWith('ค')) {
        stats.maternityCount++;
        if (v.startsWith('ค/')) stats.maternityDays += parseFloat(v.slice(2)) || 0;
        else if (v === 'ค') stats.maternityDays += 1;
      } else if (v.startsWith('บ')) {
        stats.ordainCount++;
        if (v.startsWith('บ/')) stats.ordainDays += parseFloat(v.slice(2)) || 0;
        else if (v === 'บ') stats.ordainDays += 1;
      } else if (v.startsWith('ภ')) {
        stats.paternityCount++;
        if (v.startsWith('ภ/')) stats.paternityDays += parseFloat(v.slice(2)) || 0;
        else if (v === 'ภ') stats.paternityDays += 1;
      }

      if (v === 'มข') stats.noIn++;
      if (v === 'มอ' || v === 'ส/มอ') stats.noOut++;
      if (v === 'ส' || v === 'ส/มอ' || v === 'ส/ขย') stats.late++;
      if (v === '-') stats.absent++;
      if (v === 'ข' || v === 'ขย' || v === 'ข/มอ') stats.earlyOut++;
    }

    stats.otherLeaveCount = stats.maternityCount + stats.ordainCount + stats.paternityCount;
    stats.otherLeaveDays = stats.maternityDays + stats.ordainDays + stats.paternityDays;
    stats.totalLeaveCount = stats.personalCount + stats.sickCount + stats.otherLeaveCount;
    stats.totalLeaveDays = stats.personalDays + stats.sickDays + stats.otherLeaveDays;
    return stats;
  }

  function sumStats(record, monthIdsOrSpecs) {
    const total = calcMonthStats(null);
    total.otherLeaveCount = 0;
    total.otherLeaveDays = 0;
    for (const item of (monthIdsOrSpecs || [])) {
      const isObj = typeof item === 'object' && item !== null;
      const mId = isObj ? item.id : item;
      const startDay = isObj && item.startDay ? item.startDay : 1;
      const endDay = isObj && item.endDay ? item.endDay : 31;
      const mData = record && record.months ? record.months[mId] : null;
      const ms = calcMonthStats(mData, startDay, endDay);
      Object.keys(ms).forEach(k => {
        total[k] = (total[k] || 0) + ms[k];
      });
    }
    return total;
  }

  function toIsoDate(yearCE, monthNum, dayNum) {
    return `${String(yearCE).padStart(4, '0')}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
  }

  function formatThaiShortDate(isoStr) {
    const m = String(isoStr || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return isoStr || '';
    const thMonths = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const yBE = Number(m[1]) + 543;
    const mn = thMonths[Number(m[2])] || m[2];
    const d = Number(m[3]);
    return `${d} ${mn} ${String(yBE).slice(-2)}`;
  }

  function getAdminOverviewScopeSpecs(selectedTerm, termMonths) {
    const months = Array.isArray(termMonths) ? termMonths : [];
    const scopeEl = $('ad-scope-select');
    const useDateCb = $('ad-use-date-range');
    const dateBar = $('ad-date-range-bar');
    const startEl = $('ad-date-start');
    const endEl = $('ad-date-end');
    const labelEl = $('ad-date-range-label');

    const scopeVal = scopeEl ? scopeEl.value : 'all';
    const isDateRange = Boolean((useDateCb && useDateCb.checked) || scopeVal === 'custom_range');
    if (dateBar) dateBar.classList.toggle('hidden', !isDateRange);

    if (months.length > 0 && startEl && endEl) {
      const firstM = months[0];
      const lastM = months[months.length - 1];
      const termMin = toIsoDate(firstM.yearCE, firstM.month, 1);
      const termMax = toIsoDate(lastM.yearCE, lastM.month, lastM.daysInMonth);
      startEl.min = termMin;
      startEl.max = termMax;
      endEl.min = termMin;
      endEl.max = termMax;

      const dataMonths = months.filter(m => m.hasData);
      const defFirst = dataMonths.length ? dataMonths[0] : firstM;
      const defLast = dataMonths.length ? dataMonths[dataMonths.length - 1] : lastM;
      if (!startEl.value || startEl.value < termMin || startEl.value > termMax) {
        startEl.value = toIsoDate(defFirst.yearCE, defFirst.month, 1);
      }
      if (!endEl.value || endEl.value < termMin || endEl.value > termMax) {
        endEl.value = toIsoDate(defLast.yearCE, defLast.month, defLast.daysInMonth);
      }
      if (endEl.value < startEl.value) {
        endEl.value = startEl.value;
      }
    }

    if (isDateRange && startEl && endEl && startEl.value && endEl.value) {
      const sIso = startEl.value;
      const eIso = endEl.value;
      const specs = [];
      for (const m of months) {
        const mStartIso = toIsoDate(m.yearCE, m.month, 1);
        const mEndIso = toIsoDate(m.yearCE, m.month, m.daysInMonth);
        if (mEndIso < sIso || mStartIso > eIso) continue;
        const startDay = sIso > mStartIso ? Number(sIso.slice(8, 10)) : 1;
        const endDay = eIso < mEndIso ? Number(eIso.slice(8, 10)) : m.daysInMonth;
        specs.push({ id: m.id, startDay, endDay });
      }
      const d1 = new Date(sIso + 'T00:00:00');
      const d2 = new Date(eIso + 'T00:00:00');
      const diffDays = Math.max(1, Math.round((d2 - d1) / 86400000) + 1);
      const text = `${formatThaiShortDate(sIso)} – ${formatThaiShortDate(eIso)} (${diffDays} วัน)`;
      if (labelEl) labelEl.textContent = text;
      return { specs, scopeLabel: `ช่วง ${text}`, isDateRange: true, startStr: sIso, endStr: eIso };
    }

    const openMonthsInTerm = selectedTerm ? getVisibleMonthsList(selectedTerm.termId) : [];
    let ids = [];
    if (scopeVal === 'visible') ids = openMonthsInTerm.map(m => m.id);
    else if (scopeVal === 'all' || scopeVal === 'custom_range') ids = months.map(m => m.id);
    else ids = [scopeVal];

    return {
      specs: ids.map(id => {
        const mo = months.find(x => x.id === id);
        return { id, startDay: 1, endDay: mo ? mo.daysInMonth : 31 };
      }),
      scopeLabel: `ขอบเขต ${ids.length} เดือน`,
      isDateRange: false,
      startStr: '',
      endStr: ''
    };
  }

  // -------------------- 6. GOOGLE SHEETS (GAS & VERCEL /api/gas) CONNECTORS --------------------
  function isHttpOrigin() {
    return location.protocol === 'http:' || location.protocol === 'https:';
  }

  function hasGasEndpoint() {
    return Boolean((state.settings.gasUrl || '').trim() || state.vercelProxyAvailable);
  }

  async function callGasApi(action, payload = {}) {
    const gasUrl = (state.settings.gasUrl || '').trim();
    const body = JSON.stringify({ action, ...payload });

    // ยิงตรงเข้า Google Apps Script ก่อนเมื่อมี URL (ลดการวิ่งอ้อมเซิร์ฟเวอร์ Vercel ต่างประเทศ ทำให้เร็วขึ้น 2-3 เท่า)
    if (gasUrl && /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(gasUrl)) {
      try {
        const directRes = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body,
          redirect: 'follow'
        });
        if (directRes.ok) {
          const directData = await directRes.json();
          if (directData && directData.success !== undefined) {
            if (!directData.success) throw new Error(directData.error || 'GAS ตอบกลับไม่สำเร็จ');
            return directData;
          }
        }
      } catch (directErr) {
        if (!isHttpOrigin() || directErr.message === 'GAS ตอบกลับไม่สำเร็จ' || (directErr.message && !/fetch|network|cors/i.test(directErr.message))) {
          if (!isHttpOrigin()) throw directErr;
          if (!/Failed to fetch|NetworkError|Load failed|CORS/i.test(directErr.message || '')) {
            throw directErr;
          }
        }
      }
    }

    // Fallback ผ่าน Vercel Proxy /api/gas (กรณีไม่ได้ใส่ URL ใน config.js หรือเครือข่ายบล็อก)
    if (isHttpOrigin()) {
      const headers = { 'Content-Type': 'application/json' };
      if (gasUrl) headers['x-gas-url'] = gasUrl;
      const proxyRes = await fetch('/api/gas', { method: 'POST', headers, body });
      if (proxyRes.status !== 404) {
        const proxyData = await proxyRes.json();
        if (proxyData && proxyData.notConfigured && !gasUrl) {
          throw new Error(proxyData.error || 'ยังไม่ได้ตั้งค่า GAS_API_URL');
        }
        if (proxyData && proxyData.success !== undefined) {
          state.vercelProxyAvailable = true;
          if (!proxyData.success) throw new Error(proxyData.error || 'GAS ตอบกลับไม่สำเร็จ');
          return proxyData;
        }
      }
    }

    throw new Error('ไม่สามารถเชื่อมต่อ Google Apps Script API ได้');
  }

  function saveSettingsLocal() {
    try {
      localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(state.settings));
      localStorage.setItem(LS_CUSTOM_PINS_KEY, JSON.stringify(state.customPinHashes));
    } catch (e) {}
  }

  function loadSettingsLocal() {
    try {
      const raw = localStorage.getItem(LS_SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          state.settings = {
            ...state.settings,
            ...parsed,
            gasUrl: parsed.gasUrl || (APP_CFG.GAS_API_URL || '').trim(),
            visibleTerms: { ...state.settings.visibleTerms, ...(parsed.visibleTerms || {}) },
            visibleMonths: { ...state.settings.visibleMonths, ...(parsed.visibleMonths || {}) },
            siteConfig: { ...DEFAULT_SITE_CONFIG, ...(parsed.siteConfig || {}) }
          };
        }
      }
      const rawPins = localStorage.getItem(LS_CUSTOM_PINS_KEY);
      if (rawPins) {
        state.customPinHashes = JSON.parse(rawPins) || {};
      }
    } catch (e) {}
  }

  let settingsSaveChain = Promise.resolve();
  let pendingSettingsSaveCount = 0;
  let pendingSiteConfigPayload = false;
  let pendingAdminCoresPayload = false;

  function setMonthsSaveStatusBadge(mode, text) {
    const el = $('ad-months-save-status');
    if (!el) return;
    if (!mode) {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    if (mode === 'saving') {
      el.className = 'px-3 py-1.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-1.5';
      el.innerHTML = `<span class="spinner-inline !w-3 !h-3"></span><span>${esc(text || 'กำลังบันทึกลงชีต...')}</span>`;
    } else if (mode === 'saved') {
      el.className = 'px-3 py-1.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1';
      el.textContent = text || '✓ บันทึกลงชีตแล้ว';
    } else {
      el.className = 'px-3 py-1.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700 border border-red-300 inline-flex items-center gap-1';
      el.textContent = text || '⚠️ บันทึกลงชีตไม่สำเร็จ';
    }
  }

  function saveSettingsToCloud(partialUpdate = {}) {
    state.settings = {
      ...state.settings,
      ...partialUpdate,
      siteConfig: partialUpdate.siteConfig
        ? { ...getSiteConfig(), ...partialUpdate.siteConfig }
        : getSiteConfig(),
      updatedAt: new Date().toISOString()
    };
    saveSettingsLocal();
    applySiteConfigToDom();
    updateSyncBadge();

    if (!(hasGasEndpoint() && state.adminCidHash)) {
      return Promise.resolve({ success: true, localOnly: true });
    }

    if (partialUpdate.siteConfig !== undefined) pendingSiteConfigPayload = true;
    if (partialUpdate.adminCores !== undefined) pendingAdminCoresPayload = true;

    pendingSettingsSaveCount++;
    setMonthsSaveStatusBadge('saving', 'กำลังบันทึกลง Google Sheets...');

    const task = settingsSaveChain.catch(() => {}).then(async () => {
      try {
        const sendSiteCfg = pendingSiteConfigPayload;
        const sendAdminCores = pendingAdminCoresPayload;
        pendingSiteConfigPayload = false;
        pendingAdminCoresPayload = false;

        const res = await callGasApi('saveAdminSettings', {
          adminCidHash: state.adminCidHash,
          settings: {
            visibleTerms: state.settings.visibleTerms,
            visibleMonths: state.settings.visibleMonths,
            announcement: state.settings.announcement,
            siteConfig: sendSiteCfg ? state.settings.siteConfig : undefined,
            adminCores: sendAdminCores ? state.settings.adminCores : undefined
          }
        });
        pendingSettingsSaveCount = Math.max(0, pendingSettingsSaveCount - 1);
        if (pendingSettingsSaveCount === 0) {
          if (res && res.settings && typeof res.settings === 'object') {
            applySettingsFromServer(res.settings);
          }
          setMonthsSaveStatusBadge('saved', '✓ บันทึกลงชีตแล้ว');
        }
        return res;
      } catch (err) {
        pendingSettingsSaveCount = Math.max(0, pendingSettingsSaveCount - 1);
        setMonthsSaveStatusBadge('error', '⚠️ บันทึกล้มเหลว ลองกดใหม่อีกครั้ง');
        throw err;
      }
    });

    settingsSaveChain = task.catch(() => {});
    return task;
  }

  function applySettingsFromServer(serverSettings) {
    if (!serverSettings || typeof serverSettings !== 'object') return;
    if (pendingSettingsSaveCount > 0) return;
    state.settings = {
      ...state.settings,
      visibleTerms: (serverSettings.visibleTerms && Object.keys(serverSettings.visibleTerms).length)
        ? { ...serverSettings.visibleTerms }
        : state.settings.visibleTerms,
      visibleMonths: (serverSettings.visibleMonths && Object.keys(serverSettings.visibleMonths).length)
        ? { ...serverSettings.visibleMonths }
        : state.settings.visibleMonths,
      announcement: serverSettings.announcement !== undefined ? serverSettings.announcement : state.settings.announcement,
      siteConfig: (serverSettings.siteConfig && typeof serverSettings.siteConfig === 'object')
        ? { ...DEFAULT_SITE_CONFIG, ...serverSettings.siteConfig }
        : getSiteConfig(),
      updatedAt: serverSettings.updatedAt || state.settings.updatedAt
    };
    saveSettingsLocal();
    applySiteConfigToDom();
  }

  async function refreshPublicCatalogFromGas(forceRefresh = false) {
    try {
      const res = await callGasApi('getPublicCatalog', { forceRefresh });
      state.dataSource = 'gas_live';
      state.syncedAt = res.syncedAt || new Date().toISOString();
      if (Array.isArray(res.terms) && res.terms.length) {
        state.terms = res.terms;
        if (!state.terms.some(t => t.termId === state.adminSelectedTermId)) {
          state.adminSelectedTermId = state.terms[state.terms.length - 1].termId;
        }
      }
      if (Array.isArray(res.months) && res.months.length) {
        state.months = res.months;
      }
      if (res.settings) {
        applySettingsFromServer(res.settings);
      }
      if (Array.isArray(res.eprofileTabs) && res.eprofileTabs.length) {
        state.eprofileTabs = res.eprofileTabs;
      }
      if (Array.isArray(res.staffCatalog) && res.staffCatalog.length) {
        const nextCustomKeys = new Set();
        state.staffCatalog = res.staffCatalog.map(item => {
          const core = item.coreName || stripNamePrefix(item.name);
          const seed = seedMap.get(item.key);
          if (item.hasCustomPin) nextCustomKeys.add(item.key);
          return {
            ...item,
            coreName: core,
            department: resolveStaffDepartment({ ...item, coreName: core }),
            avatarUrl: (seed && seed.avatarUrl) || '',
            hasSeedPin: Boolean(item.hasSeedPin || (seed && seed.hasSeedPin) || seedCidCoreSet.has(core))
          };
        });
        state.customPinKeysFromGas = nextCustomKeys;
      }
      updateSyncBadge();
      renderAllActiveViews();
    } catch (err) {
      console.warn('[KBS-Attendance] โหลด Catalog จาก Google Sheets ไม่สำเร็จ:', err.message);
      updateSyncBadge();
    }
  }

  // -------------------- 7. HEADER & NAVIGATION --------------------
  function updateSyncBadge() {
    const badge = $('header-sync-badge');
    const visBadge = $('header-visible-months-badge');
    const subEl = $('header-term-subtitle');
    const openTerms = getOpenTermsList();
    const visibleCount = getAllOpenMonthsCount();
    const siteCfg = getSiteConfig();
    if (subEl) {
      const customSub = (siteCfg.siteSubtitle || '').trim();
      if (customSub) {
        subEl.textContent = customSub;
      } else {
        const sch = (siteCfg.schoolName || DEFAULT_SITE_CONFIG.schoolName).trim();
        subEl.textContent = openTerms.length
          ? `${sch} • เปิดให้ดู ${openTerms.map(t => t.termName).join(', ')}`
          : `${sch} • ระบบข้อมูลรายภาคเรียน/ปี`;
      }
    }
    if (visBadge) {
      visBadge.innerHTML = `<i data-lucide="calendar-check" class="w-3.5 h-3.5"></i><span>เปิด ${openTerms.length} เทอม (${visibleCount} เดือน)</span>`;
    }
    if (badge) {
      const dotCls = state.dataSource === 'gas_live' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400';
      const label = state.dataSource === 'gas_live'
        ? (state.vercelProxyAvailable ? 'Vercel + Google Sheets สด' : 'Google Sheets สด')
        : 'Snapshot (ยังไม่เชื่อม GAS)';
      badge.innerHTML = `<span class="w-2 h-2 rounded-full ${dotCls}"></span><span>${label}</span>`;
    }
    refreshIcons();
  }

  function updateHeaderModeSwitcher() {
    const wrap = $('mode-switcher-wrap');
    const btnTeacher = $('btn-mode-teacher');
    const btnAdmin = $('btn-mode-admin');
    if (!wrap || !btnTeacher || !btnAdmin) return;

    if (!state.currentTeacher) {
      wrap.classList.add('hidden');
      btnAdmin.classList.add('hidden');
      return;
    }

    wrap.classList.remove('hidden');
    const isAdmin = Boolean(state.currentTeacher.isAdmin);
    btnAdmin.classList.toggle('hidden', !isAdmin);

    if (state.mode === 'admin' && isAdmin) {
      btnAdmin.className = 'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all bg-gradient-to-r from-amber-400 to-amber-300 text-slate-950 shadow';
      btnTeacher.className = 'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-slate-200 hover:text-white';
    } else {
      btnTeacher.className = 'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all bg-gradient-to-r from-amber-400 to-amber-300 text-slate-950 shadow';
      btnAdmin.className = (isAdmin ? '' : 'hidden ') + 'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-slate-200 hover:text-white';
    }
  }

  async function switchMode(mode) {
    if (mode === 'admin') {
      if (!(state.currentTeacher && state.currentTeacher.isAdmin)) {
        state.mode = 'teacher';
        renderActiveModeView();
        return;
      }
      state.mode = 'admin';
      renderActiveModeView();
      if (!state.adminRecords && state.adminCidHash) {
        try {
          await loadAdminRecords(false);
          renderAdminDashboard();
        } catch (err) {
          toast('โหลดข้อมูลแอดมินไม่สำเร็จ: ' + err.message, 'error');
        }
      }
      return;
    }
    state.mode = 'teacher';
    renderActiveModeView();
  }

  function renderActiveModeView() {
    $('view-teacher-login').classList.add('hidden');
    $('view-teacher-dashboard').classList.add('hidden');
    $('view-admin-dashboard').classList.add('hidden');

    if (state.mode === 'admin' && state.currentTeacher && state.currentTeacher.isAdmin) {
      $('view-admin-dashboard').classList.remove('hidden');
      renderAdminDashboard();
    } else {
      state.mode = 'teacher';
      if (state.currentTeacher) {
        $('view-teacher-dashboard').classList.remove('hidden');
        renderTeacherDashboard();
      } else {
        $('view-teacher-login').classList.remove('hidden');
        renderTeacherLoginView();
      }
    }
    updateHeaderModeSwitcher();
    refreshIcons();
  }

  function renderAllActiveViews() {
    updateSyncBadge();
    renderActiveModeView();
  }

  // -------------------- 8. TEACHER LOGIN & SEARCH --------------------
  function renderTeacherLoginView() {
    const annBanner = $('teacher-announcement-banner');
    const annText = $('teacher-announcement-text');
    const msg = (state.settings.announcement || '').trim();
    if (msg) {
      annBanner.classList.remove('hidden');
      annText.textContent = msg;
    } else {
      annBanner.classList.add('hidden');
    }

    const pillsEl = $('teacher-open-months-pills');
    const openTerms = getOpenTermsList();
    const openPills = [];
    openTerms.forEach(tm => {
      const ms = (tm.months || []).filter(m => isMonthVisible(tm.termId, m.id));
      if (ms.length > 0) {
        openPills.push(`
          <div class="w-full sm:w-auto inline-flex flex-wrap items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
            <span class="font-bold text-kbs-navy">${esc(tm.termName)}:</span>
            ${ms.map(m => `<span class="px-2 py-0.5 rounded-lg bg-white border border-emerald-200 text-emerald-700 font-semibold">${esc(m.shortLabel)}</span>`).join('')}
          </div>
        `);
      }
    });
    if (openPills.length === 0) {
      pillsEl.innerHTML = `<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500 text-xs font-medium">ยังไม่เปิดให้เข้าชมภาคเรียนหรือเดือนใดในขณะนี้</span>`;
    } else {
      pillsEl.innerHTML = openPills.join('');
    }
  }

  function normalizeCidOrCode(raw) {
    return String(raw || '').replace(/[\s-]/g, '').toUpperCase();
  }

  function formatCidInputValue(raw) {
    const str = String(raw || '');
    if (/[a-zA-Zก-๙]/.test(str)) {
      return str.replace(/\s+/g, '').toUpperCase().slice(0, 17);
    }
    const d = str.replace(/\D/g, '').slice(0, 13);
    const parts = [];
    if (d.length > 0) parts.push(d.slice(0, 1));
    if (d.length > 1) parts.push(d.slice(1, 5));
    if (d.length > 5) parts.push(d.slice(5, 10));
    if (d.length > 10) parts.push(d.slice(10, 12));
    if (d.length > 12) parts.push(d.slice(12, 13));
    return parts.join('-');
  }

  async function authenticateTeacher(rawInput, isRemembered = false, silent = false) {
    let normalized = '';
    let cidHash = '';

    if (typeof rawInput === 'object' && rawInput && rawInput.cidHash) {
      cidHash = String(rawInput.cidHash).trim();
    } else {
      normalized = normalizeCidOrCode(rawInput);
      if (!normalized) {
        throw new Error('กรุณากรอกเลขประจำตัวประชาชน 13 หลัก หรือรหัสเข้าใช้งาน');
      }
      if (/^\d+$/.test(normalized) && normalized.length !== 13) {
        throw new Error('กรุณากรอกเลขประจำตัวประชาชนให้ครบ 13 หลัก (หรือกรอกรหัสเข้าใช้งานจากแอดมิน)');
      }
      if (!/^\d+$/.test(normalized) && normalized.length < 4) {
        throw new Error('รหัสเข้าใช้งานต้องมีอย่างน้อย 4 ตัวอักษร');
      }
      cidHash = sha256Hex('cid:' + normalized);
    }

    // ดึงข้อมูลสดจาก Google Sheets (ส่งเฉพาะ cidHash ที่เข้ารหัส SHA-256 แล้ว)
    if (hasGasEndpoint()) {
      const res = await callGasApi('getTeacherAttendance', {
        cidHash
      });
      if (res.terms || res.record) {
        state.dataSource = 'gas_live';
        state.syncedAt = res.syncedAt || state.syncedAt;
        if (res.settings) applySettingsFromServer(res.settings);
        const staffInfo = res.profile || res.staff || {};
        const catalogHit = state.staffCatalog.find(s =>
          (staffInfo.key && s.key === staffInfo.key) ||
          (staffInfo.coreName && s.coreName === staffInfo.coreName)
        );
        const person = catalogHit
          ? { ...catalogHit, ...staffInfo, avatarUrl: catalogHit.avatarUrl || '' }
          : {
              key: staffInfo.key || (res.record && res.record.key) || 'staff',
              coreName: staffInfo.coreName || stripNamePrefix(staffInfo.name || (res.record && res.record.name)),
              seq: staffInfo.seq || (res.record && res.record.seq) || 0,
              name: staffInfo.name || (res.record && res.record.name) || 'บุคลากร',
              position: staffInfo.position || (res.record && res.record.position) || '',
              group: staffInfo.group || (res.record && res.record.group) || '',
              department: staffInfo.department || staffInfo.group || '',
              avatarUrl: ''
            };
        person.isAdmin = Boolean(res.isAdmin || staffInfo.isAdmin);
        person.isPrimaryAdmin = Boolean(res.isPrimaryAdmin || staffInfo.isPrimaryAdmin);
        const termsPayload = Array.isArray(res.terms) && res.terms.length
          ? res.terms
          : (res.record ? [{
              termId: state.terms[0] ? state.terms[0].termId : '0',
              termName: state.terms[0] ? state.terms[0].termName : 'ข้อมูลลงเวลา',
              months: res.months || state.months,
              record: res.record
            }] : []);
        setAuthenticatedTeacher(person, termsPayload, { cidHash: res.cidHash || cidHash }, isRemembered);
        if (!silent) toast(`ยินดีต้อนรับ ${person.name}${person.isAdmin ? ' (สิทธิ์ผู้ดูแลระบบ)' : ''}`);
        return;
      }
    }

    // โหมด Snapshot ออฟไลน์ (กรณีไม่ได้เชื่อม GAS)
    let matchedCore = seedCidHashes[cidHash] || '';
    let matchedKey = '';
    if (!matchedCore) {
      for (const [k, h] of Object.entries(state.customPinHashes)) {
        if (h === cidHash) {
          matchedKey = k;
          break;
        }
      }
    }
    const person = state.staffCatalog.find(s =>
      (matchedCore && (s.coreName === matchedCore || stripNamePrefix(s.name) === matchedCore)) ||
      (matchedKey && s.key === matchedKey)
    );
    if (!person) {
      throw new Error('ไม่พบเลขบัตรประชาชนหรือรหัสนี้ในระบบ (โปรดตรวจสอบเลข 13 หลักให้ถูกต้อง หรือติดต่อแอดมินกลุ่มบริหารงานบุคคล)');
    }

    const coreName = person.coreName || stripNamePrefix(person.name);
    const offlinePerson = {
      ...person,
      isPrimaryAdmin: PRIMARY_ADMIN_CORES.includes(coreName),
      isAdmin: PRIMARY_ADMIN_CORES.includes(coreName) || (state.adminCores || []).includes(coreName)
    };
    const sourceRecords = state.adminRecords || (fallbackData && fallbackData.records) || [];
    const rec = sourceRecords.find(r => r.key === person.key || stripNamePrefix(r.name) === coreName);
    if (!rec) {
      throw new Error('ไม่พบข้อมูลการลงเวลาในระบบ กรุณาติดต่อแอดมินเพื่อเชื่อมต่อ Google Sheets');
    }
    const fallbackTerm = [{
      termId: '0',
      termName: (state.terms[0] && state.terms[0].termName) || 'ข้อมูลลงเวลา 2/69',
      months: state.terms[0] ? state.terms[0].months : state.months,
      record: rec
    }];
    setAuthenticatedTeacher(offlinePerson, fallbackTerm, { cidHash }, isRemembered);
    if (!silent) toast(`ยินดีต้อนรับ ${offlinePerson.name}${offlinePerson.isAdmin ? ' (สิทธิ์ผู้ดูแลระบบ)' : ''}`);
  }

  function setAuthenticatedTeacher(person, teacherTerms, authHashes, remember) {
    const coreName = person.coreName || stripNamePrefix(person.name);
    const isPrimary = Boolean(person.isPrimaryAdmin || PRIMARY_ADMIN_CORES.includes(coreName));
    const isAdmin = Boolean(person.isAdmin || isPrimary);

    state.currentTeacher = {
      key: person.key,
      coreName,
      seq: person.seq,
      name: person.name,
      position: person.position,
      group: person.group,
      department: person.department || person.group,
      avatarUrl: person.avatarUrl || '',
      isAdmin,
      isPrimaryAdmin: isPrimary,
      terms: teacherTerms || []
    };
    state.teacherAuthSession = {
      staffKey: person.key,
      coreName,
      cidHash: authHashes.cidHash
    };
    state.adminCidHash = isAdmin ? authHashes.cidHash : null;
    if (!isAdmin) {
      state.mode = 'teacher';
    }

    const openTerms = getOpenTermsList();
    const activeTerm = openTerms.length ? openTerms[openTerms.length - 1] : null;
    state.teacherSelectedTermId = activeTerm ? activeTerm.termId : null;
    const openMonths = activeTerm ? getVisibleMonthsList(activeTerm.termId) : [];
    state.teacherSelectedMonthTab = 'all';
    state.teacherCalendarMonthId = openMonths.length ? openMonths[openMonths.length - 1].id : null;

    sessionStorage.setItem(SS_TEACHER_AUTH_KEY, JSON.stringify(state.teacherAuthSession));
    if (remember) {
      localStorage.setItem(LS_TEACHER_AUTH_KEY, JSON.stringify(state.teacherAuthSession));
    }
    updateSyncBadge();
    renderActiveModeView();
  }

  function logoutTeacher() {
    state.currentTeacher = null;
    state.teacherAuthSession = null;
    state.adminCidHash = null;
    state.adminRecords = null;
    state.adminRecordsByTerm = fallbackData && fallbackData.records ? { '0': fallbackData.records } : {};
    state.mode = 'teacher';
    sessionStorage.removeItem(SS_TEACHER_AUTH_KEY);
    localStorage.removeItem(LS_TEACHER_AUTH_KEY);
    const cidInp = $('teacher-cid-input');
    if (cidInp) cidInp.value = '';
    renderActiveModeView();
  }

  // -------------------- 9. TEACHER DASHBOARD RENDERING --------------------
  function buildBeautifulAvatarSvg(t) {
    const isAdminOrExec = Boolean((t && t.isAdmin) || (t && /ผู้บริหาร|ผู้อำนวยการ|รอง/.test(`${t.department || ''} ${t.position || ''}`)));
    const pCol = sanitizeHexColor(getSiteConfig().primaryColor, '#1e3a8a');
    const pDark = shiftHexRgb(pCol, 0.55).hex;
    const badgeIcon = isAdminOrExec
      ? `<circle cx="49" cy="49" r="9.5" fill="${pCol}" stroke="#ffffff" stroke-width="2"/>
         <path d="M49 43.2l1.65 3.35 3.7.54-2.67 2.6.63 3.68-3.31-1.74-3.31 1.74.63-3.68-2.67-2.6 3.7-.54z" fill="#fbbf24"/>`
      : `<circle cx="49" cy="49" r="9.5" fill="#059669" stroke="#ffffff" stroke-width="2"/>
         <path d="M44.8 49.2l2.8 2.8 5.6-5.8" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" class="w-full h-full block">
        <defs>
          <linearGradient id="kbsAvBg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fde68a"/>
            <stop offset="52%" stop-color="#fbbf24"/>
            <stop offset="100%" stop-color="#d97706"/>
          </linearGradient>
          <linearGradient id="kbsAvSuit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${pCol}"/>
            <stop offset="100%" stop-color="${pDark}"/>
          </linearGradient>
          <linearGradient id="kbsAvSkin" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="100%" stop-color="#f1f5f9"/>
          </linearGradient>
        </defs>
        <rect width="64" height="64" fill="url(#kbsAvBg)"/>
        <circle cx="32" cy="30" r="24" fill="none" stroke="#ffffff" stroke-opacity="0.32" stroke-width="1.5"/>
        <circle cx="32" cy="30" r="18" fill="#ffffff" fill-opacity="0.16"/>
        <path d="M12 64c1.2-12.4 9.2-19.5 20-19.5S50.8 51.6 52 64z" fill="url(#kbsAvSuit)"/>
        <path d="M26.5 45.2L32 54l5.5-8.8c-1.7-.5-3.6-.7-5.5-.7s-3.8.2-5.5.7z" fill="#ffffff" fill-opacity="0.92"/>
        <path d="M32 47.5l2 5.2-2 4.3-2-4.3z" fill="#f59e0b"/>
        <circle cx="32" cy="27.5" r="10.8" fill="url(#kbsAvSkin)" stroke="${pCol}" stroke-opacity="0.18" stroke-width="1.2"/>
        <path d="M21.2 26.5c.8-6.4 5.4-10.2 10.8-10.2 5.6 0 10.2 3.8 10.8 10.2-2.2-2.7-5.5-4.1-10.8-4.1-4.8 0-8.2 1.3-10.8 4.1z" fill="${pDark}" fill-opacity="0.88"/>
        <path d="M8 8Q32 2 56 8L56 18Q32 10 8 18Z" fill="#ffffff" fill-opacity="0.18"/>
        ${badgeIcon}
      </svg>
    `;
  }

  function renderTeacherDashboard() {
    const t = state.currentTeacher;
    if (!t) return;

    // Avatar
    const av = $('td-avatar');
    const fallbackSvg = buildBeautifulAvatarSvg(t);
    if (t.avatarUrl) {
      av.innerHTML = `<img src="${esc(t.avatarUrl)}" alt="${esc(t.name)}" class="w-full h-full object-cover">`;
      const img = av.querySelector('img');
      if (img) {
        img.addEventListener('error', () => {
          av.innerHTML = fallbackSvg;
        });
      }
    } else {
      av.innerHTML = fallbackSvg;
    }
    $('td-group-badge').textContent = t.group;
    $('td-dept-badge').textContent = t.department || '-';
    $('td-name').textContent = t.name;
    $('td-position').textContent = `${t.position} • ลำดับที่ ${t.seq}`;

    // Announcement
    const msg = (state.settings.announcement || '').trim();
    if (msg) {
      $('td-announcement-box').classList.remove('hidden');
      $('td-announcement-msg').textContent = msg;
    } else {
      $('td-announcement-box').classList.add('hidden');
    }

    const openTerms = getOpenTermsList().filter(tm => {
      const hasTermInPayload = (t.terms || []).some(tt => tt.termId === tm.termId);
      const ms = getVisibleMonthsList(tm.termId);
      return hasTermInPayload && ms.length > 0;
    });

    if (openTerms.length === 0) {
      $('td-empty-months-state').classList.remove('hidden');
      $('td-dashboard-content').classList.add('hidden');
      return;
    }

    $('td-empty-months-state').classList.add('hidden');
    $('td-dashboard-content').classList.remove('hidden');

    if (!state.teacherSelectedTermId || !openTerms.some(tm => tm.termId === state.teacherSelectedTermId)) {
      state.teacherSelectedTermId = openTerms[openTerms.length - 1].termId;
    }

    const activeTermObj = openTerms.find(tm => tm.termId === state.teacherSelectedTermId) || openTerms[0];
    const activeTeacherTerm = (t.terms || []).find(tt => tt.termId === activeTermObj.termId) || t.terms[0];
    const activeRecord = activeTeacherTerm.record || activeTeacherTerm;
    const openMonths = getVisibleMonthsList(activeTermObj.termId);

    // Render Term Switcher Pills
    const termPillsEl = $('td-term-pills');
    if (termPillsEl) {
      termPillsEl.innerHTML = openTerms.map(tm => {
        const active = tm.termId === activeTermObj.termId;
        return `<button type="button" data-td-term="${esc(tm.termId)}" class="td-term-pill-btn px-3 py-1.5 rounded-xl text-xs font-bold transition ${active ? 'bg-kbs-gold text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">${esc(tm.termName)}</button>`;
      }).join('');
      termPillsEl.querySelectorAll('.td-term-pill-btn').forEach(b => {
        b.addEventListener('click', () => {
          state.teacherSelectedTermId = b.getAttribute('data-td-term');
          state.teacherSelectedMonthTab = 'all';
          const ms = getVisibleMonthsList(state.teacherSelectedTermId);
          state.teacherCalendarMonthId = ms.length ? ms[ms.length - 1].id : null;
          renderTeacherDashboard();
        });
      });
    }

    const openIds = openMonths.map(m => m.id);
    if (state.teacherSelectedMonthTab !== 'all' && !openIds.includes(state.teacherSelectedMonthTab)) {
      state.teacherSelectedMonthTab = 'all';
    }
    if (!state.teacherCalendarMonthId || !openIds.includes(state.teacherCalendarMonthId)) {
      state.teacherCalendarMonthId = openMonths[openMonths.length - 1].id;
    }

    $('td-open-months-banner').textContent = `${activeTermObj.termName} — แสดงเฉพาะ ${openMonths.length} เดือนที่แอดมินเปิดให้เข้าดู (${openMonths.map(m => m.shortLabel).join(', ')})`;

    // Month tabs
    const tabsEl = $('td-month-tabs');
    const tabItems = [
      { id: 'all', label: `รวมทุกเดือนที่เปิด (${openMonths.length} เดือน)` },
      ...openMonths.map(m => ({ id: m.id, label: m.label }))
    ];
    tabsEl.innerHTML = tabItems.map(tb => {
      const active = state.teacherSelectedMonthTab === tb.id;
      return `<button type="button" data-td-month="${esc(tb.id)}" class="td-month-tab-btn px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${active ? 'bg-kbs-navy text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">${esc(tb.label)}</button>`;
    }).join('');

    tabsEl.querySelectorAll('.td-month-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-td-month');
        state.teacherSelectedMonthTab = val;
        if (val !== 'all') state.teacherCalendarMonthId = val;
        renderTeacherDashboard();
      });
    });

    const scopeMonthIds = state.teacherSelectedMonthTab === 'all' ? openIds : [state.teacherSelectedMonthTab];
    const stats = sumStats(activeRecord, scopeMonthIds);

    // 4 KPI Cards
    const totalWorkDays = stats.present + stats.duty;
    const denominator = totalWorkDays + stats.totalLeaveDays + stats.absent;
    const attRate = denominator > 0 ? Math.round((totalWorkDays / denominator) * 100) : 100;
    const scanIssues = stats.noIn + stats.noOut + stats.late + stats.earlyOut;

    $('td-kpi-grid').innerHTML = `
      <div class="rounded-3xl bg-white/95 backdrop-blur border border-slate-200/90 border-l-4 border-l-emerald-500 p-4 sm:p-5 shadow-md hover:-translate-y-0.5 hover:shadow-lg transition-all">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-slate-500">มาปฏิบัติงาน &amp; ไปราชการ</span>
          <span class="w-9 h-9 rounded-2xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center"><i data-lucide="check-circle-2" class="w-4 h-4"></i></span>
        </div>
        <p class="text-2xl sm:text-3xl font-bold text-slate-900 mt-2 tabular-nums">${totalWorkDays} <span class="text-xs font-medium text-slate-500">วัน</span></p>
        <p class="text-[11px] text-emerald-700 font-medium mt-1.5">มาปกติ ${stats.present} วัน • ไปราชการ ${stats.duty} วัน (${attRate}%)</p>
      </div>
      <div class="rounded-3xl bg-white/95 backdrop-blur border border-slate-200/90 border-l-4 border-l-rose-500 p-4 sm:p-5 shadow-md hover:-translate-y-0.5 hover:shadow-lg transition-all">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-slate-500">วันลาสะสม (เฉพาะเดือนที่เปิด)</span>
          <span class="w-9 h-9 rounded-2xl bg-rose-100/80 text-rose-700 flex items-center justify-center"><i data-lucide="calendar-heart" class="w-4 h-4"></i></span>
        </div>
        <p class="text-2xl sm:text-3xl font-bold text-slate-900 mt-2 tabular-nums">${formatNumber(stats.totalLeaveDays)} <span class="text-xs font-medium text-slate-500">วัน (${stats.totalLeaveCount} ครั้ง)</span></p>
        <p class="text-[11px] text-slate-600 mt-1.5">ลากิจ ${formatNumber(stats.personalDays)} วัน • ลาป่วย ${formatNumber(stats.sickDays)} วัน • อื่นๆ ${formatNumber(stats.otherLeaveDays)} วัน</p>
      </div>
      <div class="rounded-3xl bg-white/95 backdrop-blur border border-slate-200/90 border-l-4 border-l-amber-500 p-4 sm:p-5 shadow-md hover:-translate-y-0.5 hover:shadow-lg transition-all">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-slate-500">การสแกนนิ้ว / สาย / ขอออก</span>
          <span class="w-9 h-9 rounded-2xl bg-amber-100/80 text-amber-700 flex items-center justify-center"><i data-lucide="fingerprint" class="w-4 h-4"></i></span>
        </div>
        <p class="text-2xl sm:text-3xl font-bold text-slate-900 mt-2 tabular-nums">${scanIssues} <span class="text-xs font-medium text-slate-500">รายการ</span></p>
        <p class="text-[11px] text-amber-800 font-medium mt-1.5">สาย ${stats.late} • ไม่สแกนเข้า ${stats.noIn} • ออก ${stats.noOut} • ขอออก ${stats.earlyOut}</p>
      </div>
      <div class="rounded-3xl bg-white/95 backdrop-blur border border-slate-200/90 border-l-4 ${stats.absent > 0 ? 'border-l-red-600' : 'border-l-slate-300'} p-4 sm:p-5 shadow-md hover:-translate-y-0.5 hover:shadow-lg transition-all">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-slate-500">ขาดราชการ (-)</span>
          <span class="w-9 h-9 rounded-2xl ${stats.absent > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'} flex items-center justify-center"><i data-lucide="alert-triangle" class="w-4 h-4"></i></span>
        </div>
        <p class="text-2xl sm:text-3xl font-bold ${stats.absent > 0 ? 'text-red-600' : 'text-slate-900'} mt-2 tabular-nums">${stats.absent} <span class="text-xs font-medium text-slate-500">ครั้ง</span></p>
        <p class="text-[11px] text-slate-500 mt-1.5">${stats.absent > 0 ? 'พบรายการขาดราชการ โปรดตรวจสอบ' : 'ไม่พบรายการขาดราชการ'}</p>
      </div>
    `;

    // Calendar section
    renderCalendarForContainer(
      activeRecord,
      state.teacherCalendarMonthId,
      openMonths,
      $('td-calendar-month-title'),
      $('td-calendar-month-switcher'),
      $('td-calendar-grid'),
      $('td-code-legend'),
      newId => {
        state.teacherCalendarMonthId = newId;
        renderTeacherDashboard();
      },
      activeTermObj.months
    );

    // Charts
    renderTeacherCharts(activeRecord, openMonths, stats);

    // Summary Table
    renderTeacherSummaryTable(activeRecord, openMonths, scopeMonthIds);

    // Print area
    renderTeacherPrintArea({ ...t, months: activeRecord.months }, openMonths, activeTermObj.termName);

    refreshIcons();
  }

  const THAI_WEEKDAYS_FULL = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
  const THAI_WEEKDAYS_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  const THAI_DAY_DOT_CLASSES = [
    'bg-rose-500',
    'bg-amber-400',
    'bg-pink-500',
    'bg-emerald-500',
    'bg-orange-500',
    'bg-sky-500',
    'bg-purple-500'
  ];
  const THAI_MONTHS_FULL = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  function getTodayThaiInfo() {
    const now = new Date();
    const yearCE = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const weekdayIdx = now.getDay();
    const yearBE = yearCE + 543;
    const monthName = THAI_MONTHS_FULL[month - 1] || '';
    const weekdayFull = THAI_WEEKDAYS_FULL[weekdayIdx] || '';
    const weekdayShort = THAI_WEEKDAYS_SHORT[weekdayIdx] || '';
    return {
      yearCE,
      yearBE,
      month,
      day,
      weekdayIdx,
      weekdayFull,
      weekdayShort,
      dotCls: THAI_DAY_DOT_CLASSES[weekdayIdx] || 'bg-kbs-navy',
      fullDateLabel: `${weekdayFull}ที่ ${day} ${monthName} ${yearBE}`,
      shortDateLabel: `${weekdayFull} ${day} ${monthName.slice(0, 3)}. ${String(yearBE).slice(-2)}`
    };
  }

  function renderCalendarForContainer(record, activeMonthId, availableMonths, titleEl, switcherEl, gridEl, legendEl, onSwitchMonth, allTermMonths = null) {
    const searchPool = allTermMonths || state.months;
    const mMeta = searchPool.find(m => m.id === activeMonthId) || availableMonths[0];
    if (!mMeta) return;

    const today = getTodayThaiInfo();
    const isCurrentMonth = (mMeta.yearCE === today.yearCE && mMeta.month === today.month);

    titleEl.innerHTML = `
      <span class="inline-flex flex-wrap items-center gap-2">
        <span>ปฏิทินการลงเวลา: เดือน${esc(mMeta.label)}</span>
        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-kbs-navy text-[11px] font-bold">
          <span class="w-2 h-2 rounded-full ${today.dotCls} animate-pulse"></span>
          <span>วันนี้: ${esc(today.fullDateLabel)}</span>
        </span>
      </span>
    `;
    if (switcherEl) {
      switcherEl.innerHTML = availableMonths.map(m => `
        <button type="button" data-cal-m="${esc(m.id)}" class="cal-sw-btn px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${m.id === mMeta.id ? 'bg-kbs-gold text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">
          ${esc(m.shortLabel)}
        </button>
      `).join('');
      switcherEl.querySelectorAll('.cal-sw-btn').forEach(b => {
        b.addEventListener('click', () => onSwitchMonth(b.getAttribute('data-cal-m')));
      });
    }

    const mData = (record.months && record.months[mMeta.id]) || { days: [], merges: [] };
    const firstWeekday = new Date(mMeta.yearCE, mMeta.month - 1, 1).getDay(); // 0=Sun..6=Sat
    const merges = Array.isArray(mData.merges) ? mData.merges : [];

    let html = '';
    for (let blank = 0; blank < firstWeekday; blank++) {
      html += `<div class="h-14 sm:h-16 rounded-xl bg-slate-50/40"></div>`;
    }

    for (let day = 1; day <= mMeta.daysInMonth; day++) {
      const rawCode = (mData.days && mData.days[day - 1]) ? String(mData.days[day - 1]).trim() : '';
      let displayCode = rawCode;
      let isMergeCont = false;
      let mergeSourceCode = '';
      if (!rawCode) {
        const mg = merges.find(x => day >= x.startDay && day <= x.endDay);
        if (mg) {
          isMergeCont = true;
          mergeSourceCode = mg.code;
          displayCode = mg.code;
        }
      }

      const weekday = (firstWeekday + (day - 1)) % 7;
      const isWeekend = weekday === 0 || weekday === 6;
      const isTodayCell = isCurrentMonth && day === today.day;
      const meta = getCodeMeta(displayCode);

      const cellBg = displayCode
        ? meta.badgeCls
        : (isTodayCell
            ? 'bg-gradient-to-br from-blue-50 via-white to-amber-50 text-kbs-navyDark border-kbs-navy'
            : (isWeekend ? 'bg-slate-100/80 text-slate-400 border-slate-200/70' : 'bg-white text-slate-400 border-slate-200'));

      const todayRingCls = isTodayCell
        ? 'ring-2 ring-kbs-navy ring-offset-1 shadow-md border-kbs-navy'
        : '';

      const badgeLabel = isMergeCont ? `↳ ${meta.short}` : (meta.short || (isWeekend ? 'หยุด' : '-'));
      const dayPrefix = isTodayCell ? `★ วันนี้ (${today.fullDateLabel}) — ` : '';
      const tooltipText = isMergeCont
        ? `${dayPrefix}วันที่ ${day} ${mMeta.label}: ต่อเนื่องจากการลา (${mergeSourceCode}) — ${meta.label}`
        : `${dayPrefix}วันที่ ${day} ${mMeta.label}: ${meta.label}`;

      html += `
        <button
          type="button"
          data-day="${day}"
          data-tip="${esc(tooltipText)}"
          class="cal-day-btn h-14 sm:h-16 rounded-xl border p-1.5 flex flex-col justify-between items-start text-left transition hover:scale-[1.03] hover:shadow-md ${cellBg} ${todayRingCls} ${isMergeCont ? 'opacity-80 border-dashed' : ''}"
        >
          <div class="w-full flex items-center justify-between gap-1">
            <span class="text-[11px] font-bold leading-none ${isTodayCell ? 'text-kbs-navyDark underline decoration-amber-500 decoration-2' : (isWeekend && !displayCode ? 'text-rose-400' : '')}">${day}</span>
            ${isTodayCell ? `<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-kbs-navy text-white text-[8px] sm:text-[9px] font-bold leading-none shadow-sm"><span class="w-1.5 h-1.5 rounded-full ${today.dotCls}"></span><span>วันนี้</span></span>` : ''}
          </div>
          <span class="w-full text-center text-[11px] sm:text-xs font-extrabold truncate">${displayCode ? esc(badgeLabel) : (isTodayCell ? `<span class="text-[10px] font-bold text-kbs-navy">${esc(today.weekdayFull)}</span>` : (isWeekend ? '<span class="text-[9px] font-normal">หยุด</span>' : ''))}</span>
        </button>
      `;
    }
    gridEl.innerHTML = html;

    gridEl.querySelectorAll('.cal-day-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tip = btn.getAttribute('data-tip');
        if (window.Swal) {
          Swal.fire({
            title: 'รายละเอียดประจำวัน',
            text: tip,
            icon: 'info',
            confirmButtonColor: '#1e3a8a',
            confirmButtonText: 'ปิด'
          });
        }
      });
    });

    if (legendEl) {
      const todayLegendChip = `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border-2 border-kbs-navy bg-blue-50 text-kbs-navy font-bold shadow-xs">
          <span class="w-2 h-2 rounded-full ${today.dotCls}"></span>
          <span>★ วันนี้ (${esc(today.weekdayFull)}ที่ ${today.day})</span>
        </span>
      `;
      legendEl.innerHTML = todayLegendChip + CODE_LEGEND.map(item => `
        <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border ${item.badgeCls}">
          <strong>${esc(item.code)}</strong>
          <span>${esc(item.label)}</span>
        </span>
      `).join('');
    }
  }

  function renderTeacherCharts(record, openMonths, scopeStats) {
    const monthlyCtx = $('td-chart-monthly');
    const breakdownCtx = $('td-chart-breakdown');
    if (state.charts.tdMonthly) state.charts.tdMonthly.destroy();
    if (state.charts.tdBreakdown) state.charts.tdBreakdown.destroy();

    const labels = openMonths.map(m => m.shortLabel);
    const presentArr = openMonths.map(m => calcMonthStats(record.months[m.id]).present + calcMonthStats(record.months[m.id]).duty);
    const leaveArr = openMonths.map(m => calcMonthStats(record.months[m.id]).totalLeaveDays);
    const issueArr = openMonths.map(m => {
      const s = calcMonthStats(record.months[m.id]);
      return s.late + s.noIn + s.noOut + s.absent;
    });

    state.charts.tdMonthly = new Chart(monthlyCtx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'มาปฏิบัติงาน (วัน)', data: presentArr, backgroundColor: '#10b981', borderRadius: 6 },
          { label: 'วันลา (วัน)', data: leaveArr, backgroundColor: '#f43f5e', borderRadius: 6 },
          { label: 'สาย/ไม่สแกน/ขาด (ครั้ง)', data: issueArr, backgroundColor: '#f59e0b', borderRadius: 6 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { font: { family: 'Prompt', size: 11 } } } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });

    state.charts.tdBreakdown = new Chart(breakdownCtx, {
      type: 'doughnut',
      data: {
        labels: ['มาปกติ', 'ไปราชการ', 'ลากิจ/ป่วย/อื่น (วัน)', 'มาสาย', 'ไม่สแกนเข้า/ออก', 'ขาดราชการ'],
        datasets: [{
          data: [
            scopeStats.present,
            scopeStats.duty,
            scopeStats.totalLeaveDays,
            scopeStats.late,
            scopeStats.noIn + scopeStats.noOut,
            scopeStats.absent
          ],
          backgroundColor: ['#10b981', '#0ea5e9', '#f43f5e', '#f59e0b', '#6366f1', '#dc2626'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { font: { family: 'Prompt', size: 11 }, boxWidth: 12 } } }
      }
    });
  }

  function renderTeacherSummaryTable(record, openMonths, scopeMonthIds) {
    const tbody = $('td-summary-table-body');
    const rowsHtml = openMonths
      .filter(m => scopeMonthIds.includes(m.id))
      .map(m => {
        const s = calcMonthStats(record.months[m.id]);
        return `
          <tr class="hover:bg-slate-50">
            <td class="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">${esc(m.label)}</td>
            <td class="px-3 py-3 text-center text-emerald-700 font-semibold">${s.present}</td>
            <td class="px-3 py-3 text-center text-sky-700 font-semibold">${s.duty}</td>
            <td class="px-3 py-3 text-center">${s.personalCount} / ${formatNumber(s.personalDays)}</td>
            <td class="px-3 py-3 text-center">${s.sickCount} / ${formatNumber(s.sickDays)}</td>
            <td class="px-3 py-3 text-center">${s.otherLeaveCount} / ${formatNumber(s.otherLeaveDays)}</td>
            <td class="px-3 py-3 text-center font-bold bg-blue-50/70 text-kbs-navy">${s.totalLeaveCount} ครั้ง / ${formatNumber(s.totalLeaveDays)} วัน</td>
            <td class="px-3 py-3 text-center ${s.noIn ? 'text-purple-700 font-bold' : 'text-slate-400'}">${s.noIn}</td>
            <td class="px-3 py-3 text-center ${s.noOut ? 'text-indigo-700 font-bold' : 'text-slate-400'}">${s.noOut}</td>
            <td class="px-3 py-3 text-center ${s.late ? 'text-amber-700 font-bold' : 'text-slate-400'}">${s.late}</td>
            <td class="px-3 py-3 text-center ${s.absent ? 'text-red-600 font-bold' : 'text-slate-400'}">${s.absent}</td>
            <td class="px-3 py-3 text-center ${s.earlyOut ? 'text-teal-700 font-bold' : 'text-slate-400'}">${s.earlyOut}</td>
          </tr>
        `;
      }).join('');

    const tot = sumStats(record, scopeMonthIds);
    const totalRow = `
      <tr class="bg-amber-50/80 font-bold text-slate-900 border-t-2 border-amber-200">
        <td class="px-4 py-3">รวมทั้งหมด (${scopeMonthIds.length} เดือนที่แสดง)</td>
        <td class="px-3 py-3 text-center text-emerald-700">${tot.present}</td>
        <td class="px-3 py-3 text-center text-sky-700">${tot.duty}</td>
        <td class="px-3 py-3 text-center">${tot.personalCount} / ${formatNumber(tot.personalDays)}</td>
        <td class="px-3 py-3 text-center">${tot.sickCount} / ${formatNumber(tot.sickDays)}</td>
        <td class="px-3 py-3 text-center">${tot.otherLeaveCount} / ${formatNumber(tot.otherLeaveDays)}</td>
        <td class="px-3 py-3 text-center bg-blue-100/80 text-kbs-navy">${tot.totalLeaveCount} ครั้ง / ${formatNumber(tot.totalLeaveDays)} วัน</td>
        <td class="px-3 py-3 text-center">${tot.noIn}</td>
        <td class="px-3 py-3 text-center">${tot.noOut}</td>
        <td class="px-3 py-3 text-center">${tot.late}</td>
        <td class="px-3 py-3 text-center ${tot.absent ? 'text-red-600' : ''}">${tot.absent}</td>
        <td class="px-3 py-3 text-center">${tot.earlyOut}</td>
      </tr>
    `;
    tbody.innerHTML = rowsHtml + totalRow;
  }

  function renderTeacherPrintArea(record, openMonths, termName = '') {
    const tot = sumStats(record, openMonths.map(m => m.id));
    const nowStr = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
    const logoUri = createDefaultKvkEmblemDataUri();
    const siteCfg = getSiteConfig();
    const pCol = sanitizeHexColor(siteCfg.primaryColor, '#1e3a8a');
    const aCol = sanitizeHexColor(siteCfg.accentColor, '#d97706');
    const pMid = shiftHexRgb(pCol, 1.15).hex;
    const schoolLabel = siteCfg.schoolName || DEFAULT_SITE_CONFIG.schoolName;
    $('td-print-area').innerHTML = `
      <div class="font-doc rounded-lg overflow-hidden border mb-3" style="border-color: ${pCol}; background: linear-gradient(90deg, ${pCol} 0%, ${pMid} 100%); color: #ffffff; border-bottom: 4px solid ${aCol};">
        <div class="px-4 py-3 flex items-center justify-between gap-4">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-12 h-12 rounded-xl bg-white p-1 flex-shrink-0 flex items-center justify-center shadow">
              <img src="${logoUri}" alt="ตราโรงเรียน" class="w-full h-full object-contain">
            </div>
            <div class="min-w-0">
              <h1 class="text-[19pt] font-bold leading-tight text-white">รายงานสรุปข้อมูลวันลาและการลงเวลาปฏิบัติราชการ (${esc(termName || 'ภาคเรียน')})</h1>
              <p class="text-[14pt] leading-snug mt-0.5 text-[#fde68a]">${esc(schoolLabel)} • สำนักงานเขตพื้นที่การศึกษามัธยมศึกษาตรัง กระบี่</p>
            </div>
          </div>
          <div class="text-right text-[13pt] whitespace-nowrap flex-shrink-0 leading-snug bg-white/10 rounded px-3 py-1.5 border border-white/25">
            <p><span class="text-[#fde68a]">พิมพ์เมื่อ:</span> ${esc(nowStr)}</p>
            <p><span class="text-[#fde68a]">เดือนที่เปิดแสดงผล:</span> ${openMonths.length} เดือน</p>
          </div>
        </div>
      </div>

      <div class="font-doc mb-4 px-4 py-2.5 rounded border border-[#93c5fd] text-[15pt] leading-snug grid grid-cols-2 gap-x-6 gap-y-1" style="background-color: #eff6ff; border-left: 5px solid #1e3a8a;">
        <div><strong class="text-[#1e3a8a]">ชื่อ-สกุล:</strong> <span class="text-slate-900 font-bold">${esc(record.name)}</span></div>
        <div><strong class="text-[#1e3a8a]">ตำแหน่ง:</strong> <span class="text-slate-900">${esc(record.position)}</span></div>
        <div><strong class="text-[#1e3a8a]">กลุ่มบุคลากร:</strong> <span class="text-slate-900">${esc(record.group)}</span></div>
        <div><strong class="text-[#1e3a8a]">กลุ่มสาระฯ / ฝ่าย:</strong> <span class="text-slate-900">${esc(record.department || '-')}</span></div>
      </div>

      <table class="font-doc w-full border-collapse border border-[#94a3b8] text-[13.5pt] leading-tight mb-4">
        <thead>
          <tr style="background-color: #1e3a8a; color: #ffffff;">
            <th class="border border-[#475569] px-2 py-2 text-left whitespace-nowrap">เดือน</th>
            <th class="border border-[#475569] px-1.5 py-2 text-center whitespace-nowrap">มาปกติ</th>
            <th class="border border-[#475569] px-1.5 py-2 text-center whitespace-nowrap">ราชการ</th>
            <th class="border border-[#475569] px-1.5 py-2 text-center">ลากิจ<br>(ครั้ง/วัน)</th>
            <th class="border border-[#475569] px-1.5 py-2 text-center">ลาป่วย<br>(ครั้ง/วัน)</th>
            <th class="border border-[#475569] px-1.5 py-2 text-center">ลาคลอด/<br>บวช/ภริยา</th>
            <th class="border border-[#475569] px-1.5 py-2 text-center whitespace-nowrap">รวมวันลา</th>
            <th class="border border-[#475569] px-1.5 py-2 text-center">ไม่สแกน<br>เข้า</th>
            <th class="border border-[#475569] px-1.5 py-2 text-center">ไม่สแกน<br>ออก</th>
            <th class="border border-[#475569] px-1.5 py-2 text-center whitespace-nowrap">สาย</th>
            <th class="border border-[#475569] px-1.5 py-2 text-center whitespace-nowrap">ขาด</th>
            <th class="border border-[#475569] px-1.5 py-2 text-center whitespace-nowrap">ขอออก</th>
          </tr>
        </thead>
        <tbody>
          ${openMonths.map((m, idx) => {
            const s = calcMonthStats(record.months[m.id]);
            const rowBg = idx % 2 === 1 ? '#f8fafc' : '#ffffff';
            return `
              <tr style="background-color: ${rowBg};">
                <td class="border border-[#94a3b8] px-2 py-1.5 font-bold whitespace-nowrap text-[#1e3a8a]">${esc(m.label)}</td>
                <td class="border border-[#94a3b8] px-1.5 py-1.5 text-center font-bold text-[#047857]">${s.present}</td>
                <td class="border border-[#94a3b8] px-1.5 py-1.5 text-center font-bold text-[#0369a1]">${s.duty}</td>
                <td class="border border-[#94a3b8] px-1.5 py-1.5 text-center whitespace-nowrap">${s.personalCount} / ${formatNumber(s.personalDays)}</td>
                <td class="border border-[#94a3b8] px-1.5 py-1.5 text-center whitespace-nowrap">${s.sickCount} / ${formatNumber(s.sickDays)}</td>
                <td class="border border-[#94a3b8] px-1.5 py-1.5 text-center whitespace-nowrap">${s.otherLeaveCount} / ${formatNumber(s.otherLeaveDays)}</td>
                <td class="border border-[#94a3b8] px-1.5 py-1.5 text-center font-bold whitespace-nowrap text-[#be123c]" style="background-color: #fff1f2;">${s.totalLeaveCount} / ${formatNumber(s.totalLeaveDays)}</td>
                <td class="border border-[#94a3b8] px-1.5 py-1.5 text-center text-[#6d28d9]">${s.noIn}</td>
                <td class="border border-[#94a3b8] px-1.5 py-1.5 text-center text-[#4338ca]">${s.noOut}</td>
                <td class="border border-[#94a3b8] px-1.5 py-1.5 text-center font-bold text-[#b45309]">${s.late}</td>
                <td class="border border-[#94a3b8] px-1.5 py-1.5 text-center font-bold text-[#dc2626]">${s.absent}</td>
                <td class="border border-[#94a3b8] px-1.5 py-1.5 text-center text-[#0f766e]">${s.earlyOut}</td>
              </tr>
            `;
          }).join('')}
          <tr class="font-bold" style="background-color: #fef3c7; color: #1e3a8a;">
            <td class="border border-[#94a3b8] px-2 py-1.5 whitespace-nowrap">รวมสุทธิ (${openMonths.length} เดือนที่เปิด)</td>
            <td class="border border-[#94a3b8] px-1.5 py-1.5 text-center text-[#047857]">${tot.present}</td>
            <td class="border border-[#94a3b8] px-1.5 py-1.5 text-center text-[#0369a1]">${tot.duty}</td>
            <td class="border border-[#94a3b8] px-1.5 py-1.5 text-center whitespace-nowrap">${tot.personalCount} / ${formatNumber(tot.personalDays)}</td>
            <td class="border border-[#94a3b8] px-1.5 py-1.5 text-center whitespace-nowrap">${tot.sickCount} / ${formatNumber(tot.sickDays)}</td>
            <td class="border border-[#94a3b8] px-1.5 py-1.5 text-center whitespace-nowrap">${tot.otherLeaveCount} / ${formatNumber(tot.otherLeaveDays)}</td>
            <td class="border border-[#94a3b8] px-1.5 py-1.5 text-center whitespace-nowrap text-[#be123c]">${tot.totalLeaveCount} / ${formatNumber(tot.totalLeaveDays)}</td>
            <td class="border border-[#94a3b8] px-1.5 py-1.5 text-center text-[#6d28d9]">${tot.noIn}</td>
            <td class="border border-[#94a3b8] px-1.5 py-1.5 text-center text-[#4338ca]">${tot.noOut}</td>
            <td class="border border-[#94a3b8] px-1.5 py-1.5 text-center text-[#b45309]">${tot.late}</td>
            <td class="border border-[#94a3b8] px-1.5 py-1.5 text-center text-[#dc2626]">${tot.absent}</td>
            <td class="border border-[#94a3b8] px-1.5 py-1.5 text-center text-[#0f766e]">${tot.earlyOut}</td>
          </tr>
        </tbody>
      </table>
      <p class="font-doc text-[13.5pt] text-[#475569]">* เอกสารนี้สร้างจากระบบสรุปวันลาและการลงเวลาปฏิบัติราชการ กลุ่มบริหารงานบุคคล โรงเรียนกาญจนาภิเษกวิทยาลัย กระบี่</p>
    `;
  }

  // -------------------- 10. ADMIN AUTH & CONTROL PANEL --------------------
  function getAdminTermObj() {
    return state.terms.find(t => t.termId === state.adminSelectedTermId) || state.terms[state.terms.length - 1] || state.terms[0];
  }

  async function loadAdminRecords(forceRefresh = false, requestedTermId = null) {
    const targetTermId = requestedTermId || state.adminSelectedTermId || '';
    if (hasGasEndpoint() && state.adminCidHash) {
      try {
        const res = await callGasApi('getAdminAllData', {
          adminCidHash: state.adminCidHash,
          termId: targetTermId || undefined,
          forceRefresh
        });
        if (Array.isArray(res.terms) && res.terms.length) {
          state.terms = res.terms;
        }
        if (res.activeTermId) {
          state.adminSelectedTermId = res.activeTermId;
        }
        if (Array.isArray(res.primaryAdminCores) && res.primaryAdminCores.length) {
          state.primaryAdminCores = res.primaryAdminCores;
        }
        if (Array.isArray(res.adminCores)) {
          state.adminCores = res.adminCores;
          state.settings.adminCores = res.adminCores;
        }
        if (Array.isArray(res.eprofileTabs) && res.eprofileTabs.length) {
          state.eprofileTabs = res.eprofileTabs;
        }
        if (Array.isArray(res.records)) {
          const mapped = res.records.map(r => ({
            ...r,
            department: resolveStaffDepartment(r)
          }));
          state.adminRecords = mapped;
          if (state.adminSelectedTermId) {
            state.adminRecordsByTerm[state.adminSelectedTermId] = mapped;
          }
          if (Array.isArray(res.months) && res.months.length) state.months = res.months;
          if (res.settings) applySettingsFromServer(res.settings);
          if (Array.isArray(res.customPinKeys)) state.customPinKeysFromGas = new Set(res.customPinKeys);
          if (Array.isArray(res.customPinCores)) state.customPinCoresFromGas = new Set(res.customPinCores);
          if (Array.isArray(res.corrections)) {
            state.corrections = res.corrections;
            renderRequestsBadge();
          }
          state.dataSource = 'gas_live';
          state.syncedAt = res.syncedAt || new Date().toISOString();
          updateSyncBadge();
          return;
        }
      } catch (err) {
        console.warn('[KBS-Attendance] โหลดข้อมูลแอดมินจาก GAS ไม่สำเร็จ:', err.message);
        if (forceRefresh || String(err.message || '').includes('สิทธิ์')) throw err;
      }
    }
    if (!state.adminRecords && fallbackData && Array.isArray(fallbackData.records)) {
      state.adminRecords = fallbackData.records;
      state.adminRecordsByTerm['0'] = fallbackData.records;
    }
  }

  function logoutAdmin() {
    switchMode('teacher');
  }

  const ADMIN_TAB_META = {
    overview: {
      title: '1. แดชบอร์ดภาพรวมทั้งโรงเรียน',
      desc: 'สรุปสถิติ KPI กราฟเปรียบเทียบ และอันดับขาด/ลา/สาย/ไม่สแกนออก ของบุคลากรทุกคน'
    },
    months: {
      title: '2. เปิด-ปิดปี/เทอม และเดือน',
      desc: 'กำหนดภาคเรียน/ปีและรายเดือนที่อนุญาตให้ครูเข้าดูข้อมูล พร้อมประกาศแจ้งเตือน'
    },
    pins: {
      title: '3. จัดการรหัสยืนยันตัวตนครู',
      desc: 'ตรวจสอบสถานะเลขบัตรประชาชนจาก E-Profile และกำหนดรหัสเข้าใช้เฉพาะบุคคล'
    },
    requests: {
      title: '4. คำร้องขอแก้ไข',
      desc: 'ตรวจสอบและอัปเดตสถานะคำร้องขอแก้ไขข้อมูลการลงเวลาที่ครูส่งเข้ามา'
    },
    settings: {
      title: '5. ตั้งค่าเว็บ & ฐานข้อมูล',
      desc: 'ปรับแต่งชื่อเว็บ ท้ายเว็บ สีธีม ตัวอักษร สิทธิ์การใช้งาน และลิงก์เข้าสู่ฐานข้อมูล'
    }
  };

  function toggleAdminSidebarDrawer(open) {
    const sidebar = $('ad-sidebar');
    const backdrop = $('ad-sidebar-backdrop');
    if (!sidebar || !backdrop) return;
    if (open) {
      sidebar.classList.remove('-translate-x-full');
      backdrop.classList.remove('hidden');
    } else {
      sidebar.classList.add('-translate-x-full');
      backdrop.classList.add('hidden');
    }
  }

  function switchAdminTab(tabName) {
    state.adTab = tabName;
    document.querySelectorAll('.ad-tab-btn').forEach(btn => {
      const t = btn.getAttribute('data-ad-tab');
      if (t === tabName) {
        btn.className = 'ad-tab-btn w-full px-3.5 py-2.5 rounded-2xl text-xs font-bold text-left bg-white text-kbs-navyDark shadow-lg border-l-4 border-amber-400 flex items-center gap-2.5 transition';
      } else {
        btn.className = 'ad-tab-btn w-full px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-left text-blue-100 hover:bg-white/10 hover:text-white flex items-center gap-2.5 transition';
      }
    });
    const meta = ADMIN_TAB_META[tabName] || ADMIN_TAB_META.overview;
    if ($('ad-active-tab-title')) $('ad-active-tab-title').textContent = meta.title;
    if ($('ad-active-tab-desc')) $('ad-active-tab-desc').textContent = meta.desc;

    ['overview', 'months', 'pins', 'requests', 'settings'].forEach(p => {
      const panel = $(`ad-panel-${p}`);
      if (panel) panel.classList.toggle('hidden', p !== tabName);
    });
    toggleAdminSidebarDrawer(false);
    renderAdminDashboard();
  }

  function renderAdminDashboard() {
    const syncText = state.dataSource === 'gas_live'
      ? `เชื่อมต่อ Google Sheets สดแล้ว (อัปเดตล่าสุด: ${state.syncedAt || '-'})`
      : `กำลังใช้ข้อมูล Snapshot (${state.syncedAt ? new Date(state.syncedAt).toLocaleString('th-TH') : '-'}) • แนะนำตั้งค่า GAS URL ในแท็บ 5 เพื่อซิงค์สดอัตโนมัติ`;
    $('ad-sync-status').textContent = syncText;

    if (state.adTab === 'months') renderAdminMonthsTab();
    else if (state.adTab === 'overview') renderAdminOverviewTab();
    else if (state.adTab === 'pins') renderAdminPinsTab();
    else if (state.adTab === 'requests') renderAdminRequestsTab();
    else if (state.adTab === 'settings') renderAdminSettingsTab();

    refreshIcons();
  }

  // ---- Admin Tab 1: Term & Month Visibility Controller ----
  function renderAdminMonthsTab() {
    const termGrid = $('ad-terms-toggle-grid');
    const selectedTerm = getAdminTermObj();
    if (selectedTerm) state.adminSelectedTermId = selectedTerm.termId;

    // 1. Term / Year Visibility Cards
    termGrid.innerHTML = state.terms.map(tm => {
      const isOpen = isTermVisible(tm.termId);
      const isSelected = selectedTerm && tm.termId === selectedTerm.termId;
      const openMCount = (tm.months || []).filter(m => isMonthVisible(tm.termId, m.id)).length;
      return `
        <div class="rounded-2xl border-2 p-4 transition-all ${isSelected ? 'ring-2 ring-amber-400 ' : ''}${isOpen ? 'border-kbs-navy bg-blue-50/40 shadow-md' : 'border-slate-200 bg-slate-50/70 opacity-90'}">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <span class="text-[10px] font-bold uppercase tracking-wider ${isOpen ? 'text-emerald-700' : 'text-rose-600'}">
                ${isOpen ? '● เปิดปี/เทอมนี้อยู่' : '○ ปิดปี/เทอมนี้ไว้'}
              </span>
              <h4 class="text-base font-bold text-slate-900 truncate">${esc(tm.termName)}</h4>
              <p class="text-[11px] text-slate-500 mt-0.5">${tm.staffCount || '-'} คน • ${(tm.months || []).length} เดือน (เปิด ${openMCount})</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked="${isOpen}"
              data-toggle-term="${esc(tm.termId)}"
              class="term-switch-btn relative inline-flex h-7 flex-shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${isOpen ? 'bg-emerald-500' : 'bg-slate-300'}"
              style="width: 52px;"
            >
              <span class="pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ${isOpen ? 'translate-x-6' : 'translate-x-0'}"></span>
            </button>
          </div>
          <div class="mt-3 pt-2.5 border-t border-slate-200/70 flex items-center justify-between gap-2">
            <button type="button" data-select-term="${esc(tm.termId)}" class="btn-select-term w-full py-1.5 px-3 rounded-xl text-xs font-bold transition ${isSelected ? 'bg-kbs-navy text-white' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'}">
              ${isSelected ? 'กำลังจัดการเดือนของเทอมนี้' : 'คลิกเพื่อเลือกจัดการรายเดือน'}
            </button>
          </div>
        </div>
      `;
    }).join('');

    termGrid.querySelectorAll('.term-switch-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tId = btn.getAttribute('data-toggle-term');
        const nextTerms = { ...(state.settings.visibleTerms || {}) };
        const nextState = !isTermVisible(tId);
        nextTerms[tId] = nextState;
        const tObj = state.terms.find(x => x.termId === tId);
        const savePromise = saveSettingsToCloud({ visibleTerms: nextTerms });
        renderAdminMonthsTab();
        toast(`${nextState ? 'เปิดทั้งภาคเรียน/ปี' : 'ปิดทั้งภาคเรียน/ปี'} "${tObj ? tObj.termName : tId}" แล้ว`);
        savePromise.catch(err => {
          toast('บันทึกลง Google Sheets ไม่สำเร็จ: ' + err.message, 'error');
        });
      });
    });

    termGrid.querySelectorAll('.btn-select-term').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tId = btn.getAttribute('data-select-term');
        state.adminSelectedTermId = tId;
        if (state.adminRecordsByTerm[tId]) {
          state.adminRecords = state.adminRecordsByTerm[tId];
        } else {
          await loadAdminRecords(false, tId);
        }
        renderAdminMonthsTab();
      });
    });

    // 2. Month Visibility Cards for Selected Term
    const grid = $('ad-months-toggle-grid');
    if (!selectedTerm) {
      grid.innerHTML = '';
      return;
    }
    $('ad-selected-term-label').textContent = selectedTerm.termName;
    const termMonths = selectedTerm.months || [];

    grid.innerHTML = termMonths.map(m => {
      const isOpen = isMonthVisible(selectedTerm.termId, m.id);
      const dataBadge = m.hasData
        ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">บันทึกแล้ว ${m.activeDays} วัน (${m.recordedCells.toLocaleString()} รายการ)</span>`
        : `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">ยังไม่มีข้อมูลในชีต</span>`;

      return `
        <div class="rounded-2xl border-2 p-4 transition-all ${isOpen ? 'border-kbs-navy bg-blue-50/40 shadow-md' : 'border-slate-200 bg-white opacity-90'}">
          <div class="flex items-start justify-between gap-3">
            <div>
              <span class="text-[11px] font-bold uppercase tracking-wider ${isOpen ? 'text-kbs-navy' : 'text-slate-400'}">${esc(m.shortLabel)}</span>
              <h4 class="text-base font-bold text-slate-900">${esc(m.label)}</h4>
              <div class="mt-1.5">${dataBadge}</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked="${isOpen}"
              data-toggle-month="${esc(m.id)}"
              class="month-switch-btn relative inline-flex h-7 flex-shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${isOpen ? 'bg-emerald-500' : 'bg-slate-300'}"
              style="width: 52px;"
            >
              <span class="pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ${isOpen ? 'translate-x-6' : 'translate-x-0'}"></span>
            </button>
          </div>
          <div class="mt-3 pt-2.5 border-t border-slate-200/70 flex items-center justify-between text-xs">
            <span class="font-semibold ${isOpen ? 'text-emerald-700' : 'text-slate-500'}">
              ${isOpen ? '● ครูสามารถเข้าดูเดือนนี้ได้' : '○ ซ่อนจากหน้าจอครู'}
            </span>
            <span class="text-[11px] text-slate-400">${m.daysInMonth} วัน</span>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.month-switch-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mId = btn.getAttribute('data-toggle-month');
        const scopedKey = `${selectedTerm.termId}::${mId}`;
        const nextVis = { ...(state.settings.visibleMonths || {}) };
        const nextState = !isMonthVisible(selectedTerm.termId, mId);
        nextVis[scopedKey] = nextState;
        const mObj = termMonths.find(x => x.id === mId);
        const savePromise = saveSettingsToCloud({ visibleMonths: nextVis });
        renderAdminMonthsTab();
        toast(`${nextState ? 'เปิดให้ครูดู' : 'ปิดการมองเห็น'} เดือน${mObj ? mObj.label : mId} แล้ว`);
        savePromise.catch(err => {
          toast('บันทึกลง Google Sheets ไม่สำเร็จ: ' + err.message, 'error');
        });
      });
    });

    const openList = getVisibleMonthsList(selectedTerm.termId);
    const termOpenNote = isTermVisible(selectedTerm.termId) ? 'เปิดเทอมนี้อยู่' : '⚠️ ปิดเทอมนี้ทั้งปี/เทอมอยู่ (ครูจะยังไม่เห็นแม้เปิดเดือน)';
    $('ad-live-preview-note').innerHTML = `
      <i data-lucide="info" class="w-4 h-4 text-kbs-navy flex-shrink-0"></i>
      <span><strong>${esc(selectedTerm.termName)}</strong> (${termOpenNote}): เปิดให้ดู <strong>${openList.length} เดือน</strong> ${openList.length ? `(${openList.map(m => m.shortLabel).join(', ')})` : ''}</span>
    `;

    const annInput = $('ad-announcement-input');
    if (document.activeElement !== annInput) {
      annInput.value = state.settings.announcement || '';
    }
    refreshIcons();
  }

  // ---- Admin Tab 2: School-wide Overview ----
  function renderAdminOverviewTab() {
    const termSelectEl = $('ad-term-select');
    const selectedTerm = getAdminTermObj();
    if (termSelectEl) {
      termSelectEl.innerHTML = state.terms.map(tm => `
        <option value="${esc(tm.termId)}">${esc(tm.termName)} ${isTermVisible(tm.termId) ? '' : '(ปิดอยู่)'}</option>
      `).join('');
      if (selectedTerm) termSelectEl.value = selectedTerm.termId;
    }

    const termMonths = (selectedTerm && selectedTerm.months) || state.months;
    const records = (selectedTerm && state.adminRecordsByTerm[selectedTerm.termId]) || state.adminRecords || [];
    const scopeEl = $('ad-scope-select');
    const prevScope = scopeEl.value || 'all';
    const openMonthsInTerm = selectedTerm ? getVisibleMonthsList(selectedTerm.termId) : [];
    scopeEl.innerHTML = `
      <option value="all">ทุกเดือนในภาคเรียนนี้ (${termMonths.length} เดือน)</option>
      <option value="visible">เฉพาะเดือนที่เปิดให้ครูดู (${openMonthsInTerm.length} เดือน)</option>
      ${termMonths.map(m => `<option value="${esc(m.id)}">เฉพาะเดือน${esc(m.label)}</option>`).join('')}
      <option value="custom_range">กำหนดช่วงวันที่ (วันไหน ถึง วันไหน)</option>
    `;
    if ([...scopeEl.options].some(o => o.value === prevScope)) scopeEl.value = prevScope;

    // Populate departments (ordered per KBS E-Profile)
    const deptEl = $('ad-dept-filter');
    const prevDept = deptEl.value || 'all';
    const orderedDepts = getOrderedDepartmentCounts(records);
    deptEl.innerHTML = `<option value="all">ทุกกลุ่มสาระฯ / ผู้บริหาร (${records.length})</option>` +
      orderedDepts.map(([d, cnt]) => `<option value="${esc(d)}">${esc(d)} (${cnt} คน)</option>`).join('');
    if ([...deptEl.options].some(o => o.value === prevDept)) deptEl.value = prevDept;

    const scopeInfo = getAdminOverviewScopeSpecs(selectedTerm, termMonths);
    const monthSpecs = scopeInfo.specs;

    const groupVal = $('ad-group-filter').value;
    const deptVal = deptEl.value;
    const q = ($('ad-search-staff-input').value || '').trim().toLowerCase();

    const clearDeptBtn = $('btn-ad-clear-dept');
    if (clearDeptBtn) clearDeptBtn.classList.toggle('hidden', deptVal === 'all');

    const groupRecords = records.filter(r => groupVal === 'all' || r.group === groupVal);
    const deptBuckets = new Map();
    groupRecords.forEach(r => {
      const dept = resolveStaffDepartment(r);
      const st = sumStats(r, monthSpecs);
      if (!deptBuckets.has(dept)) {
        deptBuckets.set(dept, { count: 0, leaveDays: 0, late: 0, absent: 0 });
      }
      const b = deptBuckets.get(dept);
      b.count++;
      b.leaveDays += st.totalLeaveDays;
      b.late += st.late;
      b.absent += st.absent;
    });

    const orderedSummaryDepts = getOrderedDepartmentCounts(groupRecords);
    const deptSummaryRows = orderedSummaryDepts.map(([dept]) => ({
      dept,
      ...(deptBuckets.get(dept) || { count: 0, leaveDays: 0, late: 0, absent: 0 })
    }));

    const deptGridEl = $('ad-dept-summary-grid');
    if (deptGridEl) {
      deptGridEl.innerHTML = deptSummaryRows.map(b => {
        const dept = b.dept;
        const isActive = deptVal === dept;
        const isExec = dept === 'ผู้บริหาร';
        return `
          <button type="button" data-filter-dept="${esc(dept)}" class="ad-dept-card text-left rounded-2xl border p-3 transition-all ${isActive ? 'bg-kbs-navy text-white border-kbs-navy shadow-md ring-2 ring-amber-400' : (isExec ? 'bg-amber-50/70 hover:bg-amber-100/80 border-amber-200 text-slate-900' : 'bg-slate-50/80 hover:bg-blue-50/70 border-slate-200 text-slate-900')}">
            <div class="flex items-center justify-between gap-1">
              <span class="text-[11px] font-bold truncate">${esc(dept)}</span>
              <span class="px-1.5 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${isActive ? 'bg-amber-400 text-slate-950' : 'bg-white border border-slate-200 text-kbs-navy'}">${b.count}</span>
            </div>
            <p class="text-[10px] mt-1 truncate ${isActive ? 'text-blue-100' : 'text-slate-500'}">
              ลา ${formatNumber(b.leaveDays)}ว • สาย ${b.late} • ขาด ${b.absent}
            </p>
          </button>
        `;
      }).join('');
      deptGridEl.querySelectorAll('.ad-dept-card').forEach(btn => {
        btn.addEventListener('click', () => {
          const picked = btn.getAttribute('data-filter-dept');
          deptEl.value = (deptEl.value === picked) ? 'all' : picked;
          renderAdminOverviewTab();
        });
      });
    }

    const filtered = records.filter(r => {
      const dept = resolveStaffDepartment(r);
      if (groupVal !== 'all' && r.group !== groupVal) return false;
      if (deptVal !== 'all' && dept !== deptVal) return false;
      if (q && !r.name.toLowerCase().includes(q) && !(r.position || '').toLowerCase().includes(q) && !dept.toLowerCase().includes(q)) return false;
      return true;
    });

    // Aggregate school KPIs
    let totalPresent = 0, totalDuty = 0, totalLeaveDays = 0, totalLeaveCount = 0;
    let totalLate = 0, totalNoIn = 0, totalNoOut = 0, totalAbsent = 0, totalEarlyOut = 0;
    const computedRows = filtered.map(r => {
      const st = sumStats(r, monthSpecs);
      totalPresent += st.present;
      totalDuty += st.duty;
      totalLeaveDays += st.totalLeaveDays;
      totalLeaveCount += st.totalLeaveCount;
      totalLate += st.late;
      totalNoIn += st.noIn;
      totalNoOut += st.noOut;
      totalAbsent += st.absent;
      totalEarlyOut += st.earlyOut;
      return { record: r, stats: st };
    });

    $('ad-kpi-grid').innerHTML = `
      <div class="rounded-3xl bg-white/95 border border-slate-200 border-l-4 border-l-kbs-navy p-4 sm:p-5 shadow-md hover:-translate-y-0.5 transition-all">
        <span class="text-xs font-semibold text-slate-500">บุคลากรในตัวกรอง</span>
        <p class="text-2xl sm:text-3xl font-bold text-kbs-navy mt-1 tabular-nums">${filtered.length} <span class="text-xs font-medium text-slate-500">คน</span></p>
        <p class="text-[11px] text-slate-500 mt-1.5">มาปกติ ${totalPresent.toLocaleString()} • ราชการ ${totalDuty.toLocaleString()} วัน</p>
      </div>
      <div class="rounded-3xl bg-white/95 border border-slate-200 border-l-4 border-l-rose-500 p-4 sm:p-5 shadow-md hover:-translate-y-0.5 transition-all">
        <span class="text-xs font-semibold text-slate-500">วันลารวม</span>
        <p class="text-2xl sm:text-3xl font-bold text-rose-600 mt-1 tabular-nums">${formatNumber(totalLeaveDays)} <span class="text-xs font-medium text-slate-500">วัน (${totalLeaveCount} ครั้ง)</span></p>
        <p class="text-[11px] text-slate-500 mt-1.5">${esc(scopeInfo.scopeLabel)}</p>
      </div>
      <div class="rounded-3xl bg-white/95 border border-slate-200 border-l-4 border-l-amber-500 p-4 sm:p-5 shadow-md hover:-translate-y-0.5 transition-all">
        <span class="text-xs font-semibold text-slate-500">มาสาย &amp; ไม่สแกนนิ้ว</span>
        <p class="text-2xl sm:text-3xl font-bold text-amber-600 mt-1 tabular-nums">${(totalLate + totalNoIn + totalNoOut).toLocaleString()} <span class="text-xs font-medium text-slate-500">ครั้ง</span></p>
        <p class="text-[11px] text-slate-500 mt-1.5">สาย ${totalLate} • มข ${totalNoIn} • มอ ${totalNoOut} • ขอออก ${totalEarlyOut}</p>
      </div>
      <div class="rounded-3xl bg-white/95 border border-slate-200 border-l-4 border-l-red-600 p-4 sm:p-5 shadow-md hover:-translate-y-0.5 transition-all">
        <span class="text-xs font-semibold text-slate-500">ขาดราชการรวม (-)</span>
        <p class="text-2xl sm:text-3xl font-bold text-red-600 mt-1 tabular-nums">${totalAbsent.toLocaleString()} <span class="text-xs font-medium text-slate-500">ครั้ง</span></p>
        <p class="text-[11px] text-slate-500 mt-1.5">คลิกรายชื่อในตารางเพื่อดูรายวัน</p>
      </div>
    `;

    $('ad-table-count-badge').textContent = `แสดง ${computedRows.length} คน`;

    $('ad-staff-table-body').innerHTML = computedRows.map(({ record, stats }) => `
      <tr data-ad-staff="${esc(record.key)}" class="ad-staff-row hover:bg-blue-50/70 cursor-pointer transition">
        <td class="px-3 py-2.5 text-center text-slate-500 font-medium">${record.seq}</td>
        <td class="px-3 py-2.5">
          <div class="font-semibold text-slate-900">${esc(record.name)}</div>
          <div class="text-[11px] text-slate-500">${esc(record.position)} <span class="text-kbs-navy font-medium">• ${esc(resolveStaffDepartment(record))}</span></div>
        </td>
        <td class="px-2 py-2.5 text-center text-emerald-700 font-semibold">${stats.present}</td>
        <td class="px-2 py-2.5 text-center text-sky-700">${stats.duty}</td>
        <td class="px-2 py-2.5 text-center">${stats.personalCount}/${formatNumber(stats.personalDays)}</td>
        <td class="px-2 py-2.5 text-center">${stats.sickCount}/${formatNumber(stats.sickDays)}</td>
        <td class="px-2 py-2.5 text-center">${stats.otherLeaveCount}/${formatNumber(stats.otherLeaveDays)}</td>
        <td class="px-2 py-2.5 text-center font-bold bg-blue-50/60 text-kbs-navy">${stats.totalLeaveCount}/${formatNumber(stats.totalLeaveDays)}</td>
        <td class="px-2 py-2.5 text-center ${stats.noIn ? 'text-purple-700 font-bold' : 'text-slate-300'}">${stats.noIn}</td>
        <td class="px-2 py-2.5 text-center ${stats.noOut ? 'text-indigo-700 font-bold' : 'text-slate-300'}">${stats.noOut}</td>
        <td class="px-2 py-2.5 text-center ${stats.late ? 'text-amber-700 font-bold' : 'text-slate-300'}">${stats.late}</td>
        <td class="px-2 py-2.5 text-center ${stats.absent ? 'text-red-600 font-bold' : 'text-slate-300'}">${stats.absent}</td>
        <td class="px-2 py-2.5 text-center ${stats.earlyOut ? 'text-teal-700 font-bold' : 'text-slate-300'}">${stats.earlyOut}</td>
      </tr>
    `).join('');

    document.querySelectorAll('.ad-staff-row').forEach(tr => {
      tr.addEventListener('click', () => {
        const key = tr.getAttribute('data-ad-staff');
        openAdminStaffDetailModal(key);
      });
    });

    // Charts
    const printChartStats = renderAdminOverviewCharts(filtered, computedRows, monthSpecs, termMonths, scopeInfo.isDateRange);

    state.lastAdminOverviewSnapshot = {
      termName: selectedTerm ? selectedTerm.termName : '',
      scopeLabel: scopeInfo.scopeLabel,
      groupVal,
      deptVal,
      kpi: {
        staffCount: filtered.length,
        totalPresent,
        totalDuty,
        totalLeaveDays,
        totalLeaveCount,
        totalLate,
        totalNoIn,
        totalNoOut,
        totalAbsent,
        totalEarlyOut
      },
      deptSummaryRows,
      computedRows,
      monthlySummary: printChartStats.monthlySummary,
      rankedTop3: printChartStats.rankedTop3
    };
    renderAdminPrintArea(false);
  }

  function renderAdminPrintTop3Card(cardCfg) {
    const rows = cardCfg.items || [];
    const maxVal = Math.max(...rows.map(x => x.value), 1);
    const medalColors = [
      { bg: cardCfg.accent, text: '#ffffff' },
      { bg: cardCfg.accentMid, text: '#ffffff' },
      { bg: cardCfg.accentSoft, text: cardCfg.accentText }
    ];
    return `
      <div class="rounded-lg overflow-hidden border print-break-inside-avoid" style="border-color: ${cardCfg.borderColor}; background-color: #ffffff;">
        <div class="px-2.5 py-1.5 flex items-center justify-between gap-2" style="background-color: ${cardCfg.headerBg}; border-bottom: 2px solid ${cardCfg.accent};">
          <span class="text-[12.5pt] font-bold" style="color: ${cardCfg.accentText};">${esc(cardCfg.title)}</span>
          <span class="text-[10.5pt] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style="background-color: #ffffff; color: ${cardCfg.accentText}; border: 1px solid ${cardCfg.borderColor};">${esc(cardCfg.badge)}</span>
        </div>
        <div class="p-2 space-y-1.5">
          ${rows.length ? rows.map((item, idx) => {
            const pct = Math.max(8, Math.round((item.value / maxVal) * 100));
            const medal = medalColors[idx] || medalColors[2];
            const deptName = item.department ? `${item.department}` : (item.group || '');
            return `
              <div class="rounded px-2 py-1" style="background-color: ${idx === 0 ? cardCfg.rowHighlight : '#f8fafc'}; border: 1px solid #e2e8f0;">
                <div class="flex items-center justify-between gap-2 leading-tight">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <span class="inline-flex items-center justify-center w-5 h-5 rounded-full text-[11pt] font-bold flex-shrink-0" style="background-color: ${medal.bg}; color: ${medal.text};">${idx + 1}</span>
                    <div class="min-w-0 truncate">
                      <span class="text-[12pt] font-bold text-slate-900">${esc(item.fullName)}</span>
                      ${deptName ? `<span class="text-[10pt] text-slate-500"> (${esc(deptName)})</span>` : ''}
                    </div>
                  </div>
                  <span class="text-[11.5pt] font-bold whitespace-nowrap flex-shrink-0" style="color: ${cardCfg.accentText};">${esc(item.valueLabel)}</span>
                </div>
                <div class="mt-1 h-1.5 w-full rounded-full overflow-hidden" style="background-color: #e2e8f0;">
                  <div class="h-full rounded-full" style="width: ${pct}%; background-color: ${idx === 0 ? cardCfg.accent : (idx === 1 ? cardCfg.accentMid : cardCfg.accentLight)};"></div>
                </div>
              </div>
            `;
          }).join('') : `<div class="py-3 text-center text-[11.5pt] text-slate-500">${esc(cardCfg.emptyText)}</div>`}
        </div>
      </div>
    `;
  }

  function renderAdminPrintMonthlyCard(monthlyRows) {
    const rows = monthlyRows || [];
    const maxTotal = Math.max(...rows.map(m => m.late + m.noScan + m.leaveDays + m.absent), 1);
    return `
      <div class="rounded-lg overflow-hidden border border-[#93c5fd] print-break-inside-avoid" style="background-color: #ffffff;">
        <div class="px-2.5 py-1.5 flex items-center justify-between gap-2" style="background-color: #eff6ff; border-bottom: 2px solid #1e3a8a;">
          <span class="text-[12.5pt] font-bold text-[#1e3a8a]">สถิติภาพรวมรายเดือนทั้งโรงเรียน</span>
          <span class="text-[10pt] font-bold px-2 py-0.5 rounded-full bg-white text-[#1e3a8a] border border-[#bfdbfe]">${rows.length} เดือน</span>
        </div>
        <div class="p-2 space-y-1.5">
          ${rows.length ? rows.map(m => {
            const pLate = Math.round((m.late / maxTotal) * 100);
            const pNoScan = Math.round((m.noScan / maxTotal) * 100);
            const pLeave = Math.round((m.leaveDays / maxTotal) * 100);
            const pAbsent = Math.round((m.absent / maxTotal) * 100);
            return `
              <div class="rounded px-2 py-1 bg-[#f8fafc] border border-[#e2e8f0]">
                <div class="flex items-center justify-between gap-2 leading-tight text-[11.5pt]">
                  <strong class="text-[#1e3a8a] whitespace-nowrap">${esc(m.label)}</strong>
                  <span class="text-[10.5pt] whitespace-nowrap">
                    <span class="text-[#b45309] font-bold">สาย ${m.late}</span> •
                    <span class="text-[#4338ca] font-bold">ไม่สแกน ${m.noScan}</span> •
                    <span class="text-[#be123c] font-bold">ลา ${formatNumber(m.leaveDays)}ว</span> •
                    <span class="text-[#dc2626] font-bold">ขาด ${m.absent}</span>
                  </span>
                </div>
                <div class="mt-1 h-2 w-full rounded-full overflow-hidden flex bg-[#e2e8f0]">
                  ${pLate > 0 ? `<div style="width: ${pLate}%; background-color: #f59e0b;"></div>` : ''}
                  ${pNoScan > 0 ? `<div style="width: ${pNoScan}%; background-color: #6366f1;"></div>` : ''}
                  ${pLeave > 0 ? `<div style="width: ${pLeave}%; background-color: #f43f5e;"></div>` : ''}
                  ${pAbsent > 0 ? `<div style="width: ${pAbsent}%; background-color: #dc2626;"></div>` : ''}
                </div>
              </div>
            `;
          }).join('') : `<div class="py-3 text-center text-[11.5pt] text-slate-500">ไม่มีข้อมูลรายเดือนในช่วงที่เลือก</div>`}
          <div class="flex flex-wrap items-center gap-3 pt-0.5 text-[10pt] text-slate-700">
            <span class="inline-flex items-center gap-1"><span class="inline-block w-2.5 h-2.5 rounded-sm" style="background-color:#f59e0b;"></span>มาสาย</span>
            <span class="inline-flex items-center gap-1"><span class="inline-block w-2.5 h-2.5 rounded-sm" style="background-color:#6366f1;"></span>ไม่สแกน</span>
            <span class="inline-flex items-center gap-1"><span class="inline-block w-2.5 h-2.5 rounded-sm" style="background-color:#f43f5e;"></span>วันลาสะสม</span>
            <span class="inline-flex items-center gap-1"><span class="inline-block w-2.5 h-2.5 rounded-sm" style="background-color:#dc2626;"></span>ขาดราชการ</span>
          </div>
        </div>
      </div>
    `;
  }

  function renderAdminPrintArea(_settleAnimations = false) {
    const el = $('ad-print-area');
    const snap = state.lastAdminOverviewSnapshot;
    if (!el || !snap) return;

    const k = snap.kpi;
    const nowStr = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
    const logoUri = createDefaultKvkEmblemDataUri();
    const r3 = snap.rankedTop3 || {};

    const totalIssuesCard = {
      title: 'บุคลากรที่มีรายการรวมสูงสุด (3 อันดับแรก)',
      badge: r3.allIssues ? `พบ ${r3.allIssues.totalPeople} คน • รวม ${formatNumber(r3.allIssues.totalSum)} รายการ` : 'ไม่มีรายการ',
      items: r3.allIssues ? r3.allIssues.top3 : [],
      emptyText: 'ไม่พบรายการในช่วงที่เลือก',
      accent: '#1e3a8a',
      accentMid: '#2563eb',
      accentLight: '#60a5fa',
      accentSoft: '#dbeafe',
      accentText: '#1e3a8a',
      headerBg: '#eff6ff',
      borderColor: '#93c5fd',
      rowHighlight: '#eff6ff'
    };

    const rankedCards = [
      {
        title: 'ขาดราชการมากสุด (ขาด / -) • 3 อันดับแรก',
        badge: r3.absent ? `พบ ${r3.absent.totalPeople} คน • รวม ${r3.absent.totalSum.toLocaleString()} ครั้ง` : 'ไม่มีรายการ (ครั้ง)',
        items: r3.absent ? r3.absent.top3 : [],
        emptyText: 'ไม่พบรายการขาดราชการในช่วงที่เลือก',
        accent: '#dc2626',
        accentMid: '#ef4444',
        accentLight: '#f87171',
        accentSoft: '#fee2e2',
        accentText: '#b91c1c',
        headerBg: '#fef2f2',
        borderColor: '#fca5a5',
        rowHighlight: '#fef2f2'
      },
      {
        title: 'ลามากสุด (ลากิจ + ป่วย + อื่น) • 3 อันดับแรก',
        badge: r3.leave ? `พบ ${r3.leave.totalPeople} คน • รวม ${formatNumber(r3.leave.totalSum)} วัน` : 'ไม่มีรายการ (วัน)',
        items: r3.leave ? r3.leave.top3 : [],
        emptyText: 'ไม่พบรายการวันลาในช่วงที่เลือก',
        accent: '#db2777',
        accentMid: '#ec4899',
        accentLight: '#f472b6',
        accentSoft: '#fce7f3',
        accentText: '#be185d',
        headerBg: '#fdf2f8',
        borderColor: '#f9a8d4',
        rowHighlight: '#fdf2f8'
      },
      {
        title: 'มาสายมากสุด (ส) • 3 อันดับแรก',
        badge: r3.late ? `พบ ${r3.late.totalPeople} คน • รวม ${r3.late.totalSum.toLocaleString()} ครั้ง` : 'ไม่มีรายการ (ครั้ง)',
        items: r3.late ? r3.late.top3 : [],
        emptyText: 'ไม่พบรายการมาสายในช่วงที่เลือก',
        accent: '#d97706',
        accentMid: '#f59e0b',
        accentLight: '#fbbf24',
        accentSoft: '#fef3c7',
        accentText: '#b45309',
        headerBg: '#fffbeb',
        borderColor: '#fcd34d',
        rowHighlight: '#fffbeb'
      },
      {
        title: 'ไม่สแกนออกมากสุด (มอ) • 3 อันดับแรก',
        badge: r3.noOut ? `พบ ${r3.noOut.totalPeople} คน • รวม ${r3.noOut.totalSum.toLocaleString()} ครั้ง` : 'ไม่มีรายการ (ครั้ง)',
        items: r3.noOut ? r3.noOut.top3 : [],
        emptyText: 'ไม่พบรายการไม่สแกนออกในช่วงที่เลือก',
        accent: '#4f46e5',
        accentMid: '#6366f1',
        accentLight: '#818cf8',
        accentSoft: '#e0e7ff',
        accentText: '#4338ca',
        headerBg: '#eef2ff',
        borderColor: '#a5b4fc',
        rowHighlight: '#eef2ff'
      }
    ];

    const siteCfg = getSiteConfig();
    const pCol = sanitizeHexColor(siteCfg.primaryColor, '#1e3a8a');
    const aCol = sanitizeHexColor(siteCfg.accentColor, '#d97706');
    const pMid = shiftHexRgb(pCol, 1.15).hex;
    const schoolLabel = siteCfg.schoolName || DEFAULT_SITE_CONFIG.schoolName;

    el.innerHTML = `
      <div class="font-doc rounded-lg overflow-hidden border mb-3" style="border-color: ${pCol}; background: linear-gradient(90deg, ${pCol} 0%, ${pMid} 100%); color: #ffffff; border-bottom: 4px solid ${aCol};">
        <div class="px-4 py-2.5 flex items-center justify-between gap-4">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-12 h-12 rounded-xl bg-white p-1 flex-shrink-0 flex items-center justify-center shadow">
              <img src="${logoUri}" alt="ตราโรงเรียน" class="w-full h-full object-contain">
            </div>
            <div class="min-w-0">
              <h1 class="text-[18.5pt] font-bold leading-tight text-white">รายงานสรุปสถิติวันลาและการลงเวลาปฏิบัติราชการภาพรวมทั้งโรงเรียน</h1>
              <p class="text-[13.5pt] leading-snug mt-0.5 text-[#fde68a]">${esc(schoolLabel)} • สำนักงานเขตพื้นที่การศึกษามัธยมศึกษาตรัง กระบี่</p>
            </div>
          </div>
          <div class="text-right text-[12pt] whitespace-nowrap flex-shrink-0 leading-snug bg-white/10 rounded px-2.5 py-1 border border-white/25">
            <p><strong class="text-[#fde68a]">ภาคเรียน:</strong> ${esc(snap.termName || '-')}</p>
            <p><strong class="text-[#fde68a]">ช่วงข้อมูล:</strong> ${esc(snap.scopeLabel)}</p>
            <p><strong class="text-[#fde68a]">พิมพ์เมื่อ:</strong> ${esc(nowStr)}</p>
          </div>
        </div>
      </div>

      <!-- ส่วนที่ 1: ข้อมูลสถิติด้านบน -->
      <div class="font-doc mb-2.5 px-3 py-1.5 rounded border border-[#93c5fd] text-[13pt] flex flex-wrap items-center justify-between gap-2" style="background-color: #eff6ff; border-left: 5px solid #1e3a8a;">
        <span><strong class="text-[#1e3a8a]">ตัวกรองกลุ่ม:</strong> ${esc(snap.groupVal === 'all' ? 'ทั้งหมด' : snap.groupVal)}</span>
        <span><strong class="text-[#1e3a8a]">กลุ่มสาระฯ / ฝ่าย:</strong> ${esc(snap.deptVal === 'all' ? 'ทุกกลุ่มสาระฯ / ผู้บริหาร' : snap.deptVal)}</span>
      </div>

      <div class="font-doc grid grid-cols-4 gap-2 mb-3 print-break-inside-avoid">
        <div class="rounded-lg p-2 border border-[#93c5fd]" style="background-color: #eff6ff; border-left: 4px solid #1e3a8a;">
          <div class="text-[11.5pt] text-[#1e3a8a] font-bold">บุคลากรในตัวกรอง</div>
          <div class="text-[18pt] font-bold leading-tight text-[#1e3a8a]">${k.staffCount} คน</div>
          <div class="text-[11pt] text-[#334155]">มาปกติ ${k.totalPresent.toLocaleString()} • ราชการ ${k.totalDuty.toLocaleString()}</div>
        </div>
        <div class="rounded-lg p-2 border border-[#fda4af]" style="background-color: #fff1f2; border-left: 4px solid #e11d48;">
          <div class="text-[11.5pt] text-[#be123c] font-bold">วันลารวม</div>
          <div class="text-[18pt] font-bold leading-tight text-[#be123c]">${formatNumber(k.totalLeaveDays)} วัน</div>
          <div class="text-[11pt] text-[#334155]">รวม ${k.totalLeaveCount.toLocaleString()} ครั้ง</div>
        </div>
        <div class="rounded-lg p-2 border border-[#fcd34d]" style="background-color: #fffbeb; border-left: 4px solid #d97706;">
          <div class="text-[11.5pt] text-[#b45309] font-bold">มาสาย &amp; ไม่สแกนนิ้ว</div>
          <div class="text-[18pt] font-bold leading-tight text-[#b45309]">${(k.totalLate + k.totalNoIn + k.totalNoOut).toLocaleString()} ครั้ง</div>
          <div class="text-[11pt] text-[#334155]">สาย ${k.totalLate} • มข ${k.totalNoIn} • มอ ${k.totalNoOut} • ขอออก ${k.totalEarlyOut}</div>
        </div>
        <div class="rounded-lg p-2 border border-[#fca5a5]" style="background-color: #fef2f2; border-left: 4px solid #dc2626;">
          <div class="text-[11.5pt] text-[#b91c1c] font-bold">ขาดราชการรวม (-)</div>
          <div class="text-[18pt] font-bold leading-tight text-[#dc2626]">${k.totalAbsent.toLocaleString()} ครั้ง</div>
          <div class="text-[11pt] text-[#334155]">สรุปภาพรวมทั้งโรงเรียน</div>
        </div>
      </div>

      <!-- สรุปแยกตามกลุ่มสาระฯ / ผู้บริหาร (E-Profile) -->
      <div class="font-doc mb-3 print-break-inside-avoid">
        <h2 class="text-[14.5pt] font-bold mb-1 text-[#1e3a8a] flex items-center gap-1.5">
          <span class="inline-block w-1.5 h-4 rounded-full" style="background-color: #f59e0b;"></span>
          <span>สรุปสถิติแยกตามกลุ่มสาระฯ / ผู้บริหาร (KBS E-Profile)</span>
        </h2>
        <table class="w-full border-collapse border border-[#94a3b8] text-[12pt] leading-tight">
          <thead>
            <tr style="background-color: #1e3a8a; color: #ffffff;">
              <th class="border border-[#475569] px-2 py-1 text-left">กลุ่มสาระฯ / ฝ่าย</th>
              <th class="border border-[#475569] px-2 py-1 text-center whitespace-nowrap">จำนวน (คน)</th>
              <th class="border border-[#475569] px-2 py-1 text-center whitespace-nowrap">วันลารวม (วัน)</th>
              <th class="border border-[#475569] px-2 py-1 text-center whitespace-nowrap">มาสาย (ครั้ง)</th>
              <th class="border border-[#475569] px-2 py-1 text-center whitespace-nowrap">ขาดราชการ (ครั้ง)</th>
            </tr>
          </thead>
          <tbody>
            ${snap.deptSummaryRows.map((b, idx) => `
              <tr style="background-color: ${idx % 2 === 1 ? '#f8fafc' : '#ffffff'};">
                <td class="border border-[#94a3b8] px-2 py-1 font-bold text-[#0f172a]">${esc(b.dept)}</td>
                <td class="border border-[#94a3b8] px-2 py-1 text-center font-bold text-[#1e3a8a]">${b.count}</td>
                <td class="border border-[#94a3b8] px-2 py-1 text-center font-bold ${b.leaveDays > 0 ? 'text-[#be123c]' : 'text-slate-500'}">${formatNumber(b.leaveDays)}</td>
                <td class="border border-[#94a3b8] px-2 py-1 text-center font-bold ${b.late > 0 ? 'text-[#b45309]' : 'text-slate-500'}">${b.late}</td>
                <td class="border border-[#94a3b8] px-2 py-1 text-center font-bold ${b.absent > 0 ? 'text-[#dc2626]' : 'text-slate-500'}">${b.absent}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- สถิติภาพรวมรายเดือน + 3 อันดับแรกสูงสุด -->
      <div class="font-doc grid grid-cols-2 gap-2.5 mb-2.5 print-break-inside-avoid">
        ${renderAdminPrintMonthlyCard(snap.monthlySummary)}
        ${renderAdminPrintTop3Card(totalIssuesCard)}
      </div>

      <div class="font-doc grid grid-cols-2 gap-2.5 mb-4 print-break-inside-avoid">
        ${rankedCards.map(renderAdminPrintTop3Card).join('')}
      </div>

      <!-- ส่วนที่ 2: ตารางข้อมูลบุคลากรทั้งหมด -->
      <div class="font-doc print-break-before">
        <div class="px-3 py-1.5 rounded-lg mb-2 flex items-baseline justify-between gap-2" style="background: linear-gradient(90deg, #1e3a8a 0%, #2563eb 100%); color: #ffffff; border-bottom: 3px solid #f59e0b;">
          <h2 class="text-[15.5pt] font-bold text-white">ตารางสรุปข้อมูลบุคลากรทั้งหมด (${snap.computedRows.length} คน)</h2>
          <span class="text-[12pt] whitespace-nowrap text-[#fde68a]">${esc(snap.termName)} • ${esc(snap.scopeLabel)}</span>
        </div>
        <table class="w-full border-collapse border border-[#94a3b8] text-[11.5pt] leading-tight mb-3">
          <thead>
            <tr style="background-color: #1e3a8a; color: #ffffff;">
              <th class="border border-[#475569] px-1.5 py-1.5 text-center whitespace-nowrap">#</th>
              <th class="border border-[#475569] px-2 py-1.5 text-left">ชื่อ-สกุล / ตำแหน่ง / กลุ่มสาระฯ</th>
              <th class="border border-[#475569] px-1 py-1.5 text-center whitespace-nowrap">มาปกติ</th>
              <th class="border border-[#475569] px-1 py-1.5 text-center whitespace-nowrap">ราชการ</th>
              <th class="border border-[#475569] px-1 py-1.5 text-center whitespace-nowrap">ลากิจ</th>
              <th class="border border-[#475569] px-1 py-1.5 text-center whitespace-nowrap">ลาป่วย</th>
              <th class="border border-[#475569] px-1 py-1.5 text-center whitespace-nowrap">ลาอื่น</th>
              <th class="border border-[#475569] px-1 py-1.5 text-center whitespace-nowrap">รวมลา</th>
              <th class="border border-[#475569] px-1 py-1.5 text-center whitespace-nowrap">มข</th>
              <th class="border border-[#475569] px-1 py-1.5 text-center whitespace-nowrap">มอ</th>
              <th class="border border-[#475569] px-1 py-1.5 text-center whitespace-nowrap">สาย</th>
              <th class="border border-[#475569] px-1 py-1.5 text-center whitespace-nowrap">ขาด</th>
              <th class="border border-[#475569] px-1 py-1.5 text-center whitespace-nowrap">ขอออก</th>
            </tr>
          </thead>
          <tbody>
            ${snap.computedRows.map(({ record, stats }, idx) => `
              <tr style="background-color: ${idx % 2 === 1 ? '#f8fafc' : '#ffffff'};">
                <td class="border border-[#94a3b8] px-1.5 py-1 text-center text-slate-600">${record.seq}</td>
                <td class="border border-[#94a3b8] px-2 py-1">
                  <div class="font-bold leading-tight text-[#0f172a]">${esc(record.name)}</div>
                  <div class="text-[10.5pt] text-[#475569] leading-tight">${esc(record.position)} • <span class="text-[#1e3a8a]">${esc(resolveStaffDepartment(record))}</span></div>
                </td>
                <td class="border border-[#94a3b8] px-1 py-1 text-center font-bold text-[#047857]">${stats.present}</td>
                <td class="border border-[#94a3b8] px-1 py-1 text-center font-bold text-[#0369a1]">${stats.duty}</td>
                <td class="border border-[#94a3b8] px-1 py-1 text-center whitespace-nowrap">${stats.personalCount}/${formatNumber(stats.personalDays)}</td>
                <td class="border border-[#94a3b8] px-1 py-1 text-center whitespace-nowrap">${stats.sickCount}/${formatNumber(stats.sickDays)}</td>
                <td class="border border-[#94a3b8] px-1 py-1 text-center whitespace-nowrap">${stats.otherLeaveCount}/${formatNumber(stats.otherLeaveDays)}</td>
                <td class="border border-[#94a3b8] px-1 py-1 text-center font-bold whitespace-nowrap text-[#be123c]" style="background-color: #fff1f2;">${stats.totalLeaveCount}/${formatNumber(stats.totalLeaveDays)}</td>
                <td class="border border-[#94a3b8] px-1 py-1 text-center ${stats.noIn ? 'font-bold text-[#6d28d9]' : 'text-slate-400'}">${stats.noIn}</td>
                <td class="border border-[#94a3b8] px-1 py-1 text-center ${stats.noOut ? 'font-bold text-[#4338ca]' : 'text-slate-400'}">${stats.noOut}</td>
                <td class="border border-[#94a3b8] px-1 py-1 text-center ${stats.late ? 'font-bold text-[#b45309]' : 'text-slate-400'}">${stats.late}</td>
                <td class="border border-[#94a3b8] px-1 py-1 text-center font-bold ${stats.absent ? 'text-[#dc2626]' : 'text-slate-400'}">${stats.absent}</td>
                <td class="border border-[#94a3b8] px-1 py-1 text-center ${stats.earlyOut ? 'font-bold text-[#0f766e]' : 'text-slate-400'}">${stats.earlyOut}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <p class="text-[12pt] text-[#475569]">* หมายเหตุ: มข = ไม่สแกนเข้า, มอ = ไม่สแกนออก (รายการควบ เช่น ส/มอ นับเข้าทั้งช่องสายและไม่สแกนออก) • ค่าลากิจ/ป่วย/อื่น แสดงเป็น ครั้ง/วัน</p>
      </div>
    `;
  }

  const barValueLabelsPlugin = {
    id: 'barValueLabels',
    afterDatasetsDraw(chart, _args, pluginOpts) {
      if (!pluginOpts || !pluginOpts.enabled) return;
      const { ctx } = chart;
      const meta = chart.getDatasetMeta(0);
      if (!meta || !meta.data) return;
      ctx.save();
      ctx.font = '600 11px Prompt, Sarabun, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = pluginOpts.color || '#334155';
      const labelsList = pluginOpts.labels || [];
      meta.data.forEach((bar, i) => {
        const text = labelsList[i];
        if (!text) return;
        ctx.fillText(text, bar.x + 8, bar.y);
      });
      ctx.restore();
    }
  };

  function stripRankName(name) {
    return String(name || '').replace(/^(ว่าที่\s*ร้อยตรี\s*หญิง|ว่าที่\s*ร้อยตรี|ว่าที่\s*ร\.?\s*ต\.?\s*หญิง|ว่าที่\s*ร\.?\s*ต\.?|นางสาว|นาง|นาย|น\.ส\.|ดร\.)\s*/i, '').trim();
  }

  function buildRankedMetricList(computedRows, limit, scoreFn, valueLabelFn) {
    return computedRows
      .map(x => ({
        key: x.record.key,
        fullName: x.record.name,
        shortName: stripRankName(x.record.name),
        position: x.record.position,
        group: x.record.group,
        department: resolveStaffDepartment(x.record),
        value: Number(scoreFn(x.stats) || 0),
        valueLabel: valueLabelFn(x.stats)
      }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);
  }

  function renderRankedBarChart(chartKey, canvasId, wrapId, emptyId, summaryId, items, cfg) {
    if (state.charts[chartKey]) {
      state.charts[chartKey].destroy();
      state.charts[chartKey] = null;
    }
    const canvas = $(canvasId);
    const wrap = $(wrapId);
    const emptyEl = $(emptyId);
    const summaryEl = $(summaryId);

    const totalPeople = items.length;
    const totalSum = items.reduce((acc, x) => acc + x.value, 0);
    if (summaryEl) {
      summaryEl.textContent = totalPeople
        ? `พบ ${totalPeople} คน • รวม ${cfg.isDecimal ? formatNumber(totalSum) : totalSum.toLocaleString()} ${cfg.unit}`
        : `ไม่มีรายการ (${cfg.unit})`;
    }

    if (!totalPeople) {
      if (wrap) wrap.classList.add('hidden');
      if (emptyEl) emptyEl.classList.remove('hidden');
      return;
    }

    if (emptyEl) emptyEl.classList.add('hidden');
    if (wrap) {
      wrap.classList.remove('hidden');
      wrap.style.height = Math.max(260, items.length * 32 + 44) + 'px';
    }

    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, canvas.parentElement ? canvas.parentElement.clientWidth || 420 : 420, 0);
    grad.addColorStop(0, cfg.colorStart);
    grad.addColorStop(1, cfg.colorEnd);

    const labelsWithRank = items.map((x, idx) => `${idx + 1}. ${x.shortName}`);
    const maxVal = Math.max(...items.map(x => x.value), 1);

    state.charts[chartKey] = new Chart(canvas, {
      type: 'bar',
      plugins: [barValueLabelsPlugin],
      data: {
        labels: labelsWithRank,
        datasets: [{
          label: cfg.datasetLabel,
          data: items.map(x => x.value),
          backgroundColor: items.map((_x, idx) => (idx < 3 ? grad : cfg.colorMuted)),
          hoverBackgroundColor: cfg.colorStart,
          borderRadius: 8,
          borderSkipped: false,
          barThickness: 18
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { right: 78, left: 4, top: 4, bottom: 2 } },
        onHover: (evt, els) => {
          if (evt && evt.native && evt.native.target) {
            evt.native.target.style.cursor = els.length ? 'pointer' : 'default';
          }
        },
        onClick: (_evt, els) => {
          if (!els || !els.length) return;
          const idx = els[0].index;
          if (items[idx]) openAdminStaffDetailModal(items[idx].key);
        },
        plugins: {
          legend: { display: false },
          barValueLabels: {
            enabled: true,
            color: cfg.textColor,
            labels: items.map(x => x.valueLabel)
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.94)',
            titleFont: { family: 'Prompt', size: 12, weight: 'bold' },
            bodyFont: { family: 'Sarabun', size: 12 },
            padding: 10,
            cornerRadius: 10,
            callbacks: {
              title: ctxItems => {
                const it = items[ctxItems[0].dataIndex];
                return it ? it.fullName : '';
              },
              label: ctxItem => {
                const it = items[ctxItem.dataIndex];
                return it ? `${cfg.datasetLabel}: ${it.valueLabel}` : '';
              },
              afterLabel: ctxItem => {
                const it = items[ctxItem.dataIndex];
                return it ? `${it.position} • ${it.group} (คลิกเพื่อดูปฏิทิน)` : '';
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            suggestedMax: maxVal * 1.18,
            grid: { color: 'rgba(148, 163, 184, 0.2)', borderDash: [4, 4] },
            border: { display: false },
            ticks: { font: { family: 'Prompt', size: 10 }, color: '#64748b' }
          },
          y: {
            grid: { display: false },
            border: { display: false },
            ticks: { font: { family: 'Prompt', size: 11, weight: '600' }, color: '#1e293b' }
          }
        }
      }
    });
  }

  function renderAdminOverviewCharts(filteredRecords, computedRows, selectedSpecs, termMonths, isDateRange = false) {
    const monthlyCanvas = $('ad-chart-monthly');
    const issuesCanvas = $('ad-chart-issues');
    if (state.charts.adMonthly) state.charts.adMonthly.destroy();
    if (state.charts.adIssues) state.charts.adIssues.destroy();

    const specMap = new Map((selectedSpecs || []).map(sp => {
      const id = typeof sp === 'object' ? sp.id : sp;
      return [id, typeof sp === 'object' ? sp : { id, startDay: 1, endDay: 31 }];
    }));

    const activeMonths = (termMonths || state.months).filter(m =>
      isDateRange ? specMap.has(m.id) : (m.hasData || specMap.has(m.id))
    );
    const labels = activeMonths.map(m => {
      const sp = specMap.get(m.id);
      if (isDateRange && sp && (sp.startDay > 1 || sp.endDay < m.daysInMonth)) {
        return `${m.shortLabel} (${sp.startDay}-${sp.endDay})`;
      }
      return m.shortLabel;
    });
    const getSpecForMonth = m => specMap.get(m.id) || { id: m.id, startDay: 1, endDay: m.daysInMonth || 31 };

    const lateData = activeMonths.map(m => {
      const sp = getSpecForMonth(m);
      return filteredRecords.reduce((acc, r) => acc + calcMonthStats(r.months[m.id], sp.startDay, sp.endDay).late, 0);
    });
    const noScanData = activeMonths.map(m => {
      const sp = getSpecForMonth(m);
      return filteredRecords.reduce((acc, r) => {
        const s = calcMonthStats(r.months[m.id], sp.startDay, sp.endDay);
        return acc + s.noIn + s.noOut;
      }, 0);
    });
    const leaveData = activeMonths.map(m => {
      const sp = getSpecForMonth(m);
      return filteredRecords.reduce((acc, r) => acc + calcMonthStats(r.months[m.id], sp.startDay, sp.endDay).totalLeaveDays, 0);
    });

    state.charts.adMonthly = new Chart(monthlyCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'มาสาย (ครั้ง)', data: lateData, backgroundColor: '#f59e0b', borderRadius: 6 },
          { label: 'ไม่สแกนเข้า/ออก (ครั้ง)', data: noScanData, backgroundColor: '#6366f1', borderRadius: 6 },
          { label: 'วันลาสะสม (วัน)', data: leaveData, backgroundColor: '#f43f5e', borderRadius: 6 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { family: 'Prompt', size: 11 }, usePointStyle: true, pointStyle: 'circle' } },
          tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.92)', cornerRadius: 10, padding: 10 }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: 'Prompt', size: 11 } } },
          y: { beginAtZero: true, grid: { color: 'rgba(148, 163, 184, 0.2)', borderDash: [4, 4] } }
        }
      }
    });

    const rankLimit = Number($('ad-rank-limit-select') ? $('ad-rank-limit-select').value : 10) || 10;

    const makeAllRanked = (scoreFn, valueLabelFn) => buildRankedMetricList(computedRows, computedRows.length, scoreFn, valueLabelFn);

    const allIssuesList = makeAllRanked(
      s => s.late + s.noIn + s.noOut + s.absent + s.totalLeaveDays,
      s => `${formatNumber(s.late + s.noIn + s.noOut + s.absent + s.totalLeaveDays)} รายการ`
    );
    const topIssues = allIssuesList.slice(0, Math.max(rankLimit, 10));

    renderRankedBarChart('adIssues', 'ad-chart-issues', null, null, null, topIssues, {
      datasetLabel: 'รวมทุกรายการ',
      unit: 'รายการ',
      colorStart: '#1e3a8a',
      colorEnd: '#3b82f6',
      colorMuted: '#93c5fd',
      textColor: '#1e3a8a'
    });

    const allAbsentList = makeAllRanked(s => s.absent, s => `${s.absent} ครั้ง`);
    const topAbsent = allAbsentList.slice(0, rankLimit);
    renderRankedBarChart('adTopAbsent', 'ad-chart-top-absent', 'ad-rank-wrap-absent', 'ad-top-absent-empty', 'ad-top-absent-summary', topAbsent, {
      datasetLabel: 'ขาดราชการ',
      unit: 'ครั้ง',
      colorStart: '#dc2626',
      colorEnd: '#fb7185',
      colorMuted: '#fda4af',
      textColor: '#b91c1c'
    });

    const allLeaveList = makeAllRanked(
      s => s.totalLeaveDays,
      s => `${formatNumber(s.totalLeaveDays)} วัน (${s.totalLeaveCount} ครั้ง)`
    );
    const topLeave = allLeaveList.slice(0, rankLimit);
    renderRankedBarChart('adTopLeave', 'ad-chart-top-leave', 'ad-rank-wrap-leave', 'ad-top-leave-empty', 'ad-top-leave-summary', topLeave, {
      datasetLabel: 'วันลารวม',
      unit: 'วัน',
      isDecimal: true,
      colorStart: '#db2777',
      colorEnd: '#f472b6',
      colorMuted: '#f9a8d4',
      textColor: '#be185d'
    });

    const allLateList = makeAllRanked(s => s.late, s => `${s.late} ครั้ง`);
    const topLate = allLateList.slice(0, rankLimit);
    renderRankedBarChart('adTopLate', 'ad-chart-top-late', 'ad-rank-wrap-late', 'ad-top-late-empty', 'ad-top-late-summary', topLate, {
      datasetLabel: 'มาสาย',
      unit: 'ครั้ง',
      colorStart: '#d97706',
      colorEnd: '#fbbf24',
      colorMuted: '#fcd34d',
      textColor: '#b45309'
    });

    const allNoOutList = makeAllRanked(s => s.noOut, s => `${s.noOut} ครั้ง`);
    const topNoOut = allNoOutList.slice(0, rankLimit);
    renderRankedBarChart('adTopNoOut', 'ad-chart-top-noout', 'ad-rank-wrap-noout', 'ad-top-noout-empty', 'ad-top-noout-summary', topNoOut, {
      datasetLabel: 'ไม่สแกนออก (มอ)',
      unit: 'ครั้ง',
      colorStart: '#4f46e5',
      colorEnd: '#818cf8',
      colorMuted: '#c7d2fe',
      textColor: '#4338ca'
    });

    const summarizeRank = arr => ({
      totalPeople: arr.length,
      totalSum: arr.reduce((acc, x) => acc + x.value, 0),
      top3: arr.slice(0, 3)
    });

    const absentData = activeMonths.map(m => {
      const sp = getSpecForMonth(m);
      return filteredRecords.reduce((acc, r) => acc + calcMonthStats(r.months[m.id], sp.startDay, sp.endDay).absent, 0);
    });

    return {
      monthlySummary: activeMonths.map((m, idx) => ({
        label: labels[idx] || m.shortLabel,
        late: lateData[idx] || 0,
        noScan: noScanData[idx] || 0,
        leaveDays: leaveData[idx] || 0,
        absent: absentData[idx] || 0
      })),
      rankedTop3: {
        allIssues: summarizeRank(allIssuesList),
        absent: summarizeRank(allAbsentList),
        leave: summarizeRank(allLeaveList),
        late: summarizeRank(allLateList),
        noOut: summarizeRank(allNoOutList)
      }
    };
  }

  function openAdminStaffDetailModal(staffKey) {
    const selectedTerm = getAdminTermObj();
    const termMonths = (selectedTerm && selectedTerm.months) || state.months;
    const records = (selectedTerm && state.adminRecordsByTerm[selectedTerm.termId]) || state.adminRecords || [];
    const rec = records.find(r => r.key === staffKey);
    if (!rec) return;
    $('modal-staff-name').textContent = rec.name;
    $('modal-staff-pos').textContent = `${rec.position} • ${rec.group} (${selectedTerm ? selectedTerm.termName : ''})`;

    const body = $('modal-staff-body');
    const firstMonth = termMonths.find(m => m.hasData) || termMonths[0];
    let currentModalMonth = firstMonth ? firstMonth.id : '';

    const renderModalContent = () => {
      const stAll = sumStats(rec, termMonths.map(m => m.id));
      body.innerHTML = `
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div class="p-3 rounded-xl bg-emerald-50 border border-emerald-200"><div class="text-slate-500">มาปกติ / ราชการ</div><div class="text-lg font-bold text-emerald-700">${stAll.present} / ${stAll.duty}</div></div>
          <div class="p-3 rounded-xl bg-rose-50 border border-rose-200"><div class="text-slate-500">รวมวันลา (ทั้งเทอม)</div><div class="text-lg font-bold text-rose-700">${stAll.totalLeaveCount} ครั้ง / ${formatNumber(stAll.totalLeaveDays)} วัน</div></div>
          <div class="p-3 rounded-xl bg-amber-50 border border-amber-200"><div class="text-slate-500">สาย / ไม่สแกนเข้า-ออก</div><div class="text-lg font-bold text-amber-800">${stAll.late} / ${stAll.noIn + stAll.noOut}</div></div>
          <div class="p-3 rounded-xl bg-red-50 border border-red-200"><div class="text-slate-500">ขาดราชการ / ขอออก</div><div class="text-lg font-bold text-red-700">${stAll.absent} / ${stAll.earlyOut}</div></div>
        </div>
        <div class="rounded-2xl border border-slate-200 p-4">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h4 id="modal-cal-title" class="text-sm font-bold text-kbs-navyDark"></h4>
            <div id="modal-cal-switcher" class="flex items-center gap-1 flex-wrap"></div>
          </div>
          <div class="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-500 mb-1.5">
            <div class="text-rose-600">อา.</div><div>จ.</div><div>อ.</div><div>พ.</div><div>พฤ.</div><div>ศ.</div><div class="text-slate-400">ส.</div>
          </div>
          <div id="modal-cal-grid" class="grid grid-cols-7 gap-1.5"></div>
          <div id="modal-cal-legend" class="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap gap-1.5 text-[11px]"></div>
        </div>
      `;
      renderCalendarForContainer(
        rec,
        currentModalMonth,
        termMonths,
        body.querySelector('#modal-cal-title'),
        body.querySelector('#modal-cal-switcher'),
        body.querySelector('#modal-cal-grid'),
        body.querySelector('#modal-cal-legend'),
        newId => {
          currentModalMonth = newId;
          renderModalContent();
        },
        termMonths
      );
    };

    renderModalContent();
    $('modal-staff-detail').classList.remove('hidden');
    refreshIcons();
  }

  // ---- Admin Tab 3: Staff CID, Access Code & Admin Role Manager ----
  function renderAdminPinsTab() {
    let seedCount = 0, customCount = 0, missingCount = 0, adminCount = 0;
    const primarySet = new Set(state.primaryAdminCores || PRIMARY_ADMIN_CORES);
    const adminSet = new Set([...(state.adminCores || []), ...primarySet]);

    const enriched = state.staffCatalog.map(s => {
      const core = s.coreName || stripNamePrefix(s.name);
      const department = resolveStaffDepartment(s);
      const hasCustom = Boolean(state.customPinHashes[s.key] || state.customPinKeysFromGas.has(s.key) || state.customPinCoresFromGas.has(core) || s.hasCustomPin);
      const hasSeed = Boolean(s.hasSeedPin || seedCidCoreSet.has(core) || (seedMap.get(s.key) && seedMap.get(s.key).hasSeedPin));
      const isPrimaryAdmin = primarySet.has(core);
      const isAdmin = isPrimaryAdmin || adminSet.has(core);
      if (isAdmin) adminCount++;
      let status = 'missing';
      if (hasCustom) { status = 'custom'; customCount++; }
      else if (hasSeed) { status = 'seed'; seedCount++; }
      else { missingCount++; }
      return { ...s, core, department, status, isAdmin, isPrimaryAdmin };
    });

    const deptFilterEl = $('ad-pin-dept-filter');
    if (deptFilterEl) {
      const prevDept = deptFilterEl.value || 'all';
      const orderedDepts = getOrderedDepartmentCounts(enriched);
      deptFilterEl.innerHTML = `<option value="all">ทุกกลุ่มสาระฯ / ผู้บริหาร (${enriched.length} คน)</option>` +
        orderedDepts.map(([d, cnt]) => `<option value="${esc(d)}">${esc(d)} (${cnt} คน)</option>`).join('');
      if ([...deptFilterEl.options].some(o => o.value === prevDept)) deptFilterEl.value = prevDept;
    }

    $('ad-pins-stats').innerHTML = `
      <div class="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200"><div class="text-xs text-emerald-700 font-semibold">มีเลขบัตรประชาชนใน E-Profile</div><div class="text-xl font-bold text-emerald-900 mt-0.5">${seedCount} คน</div></div>
      <div class="p-3.5 rounded-2xl bg-blue-50 border border-blue-200"><div class="text-xs text-blue-700 font-semibold">กำหนดเลขบัตร / รหัสเองแล้ว</div><div class="text-xl font-bold text-blue-900 mt-0.5">${customCount} คน</div></div>
      <div class="p-3.5 rounded-2xl bg-amber-50 border border-amber-200"><div class="text-xs text-amber-800 font-semibold">ยังไม่มีเลขบัตร / รหัสเข้าใช้</div><div class="text-xl font-bold text-amber-950 mt-0.5">${missingCount} คน</div></div>
      <div class="p-3.5 rounded-2xl bg-purple-50 border border-purple-200"><div class="text-xs text-purple-800 font-semibold">ผู้มีสิทธิ์แอดมิน</div><div class="text-xl font-bold text-purple-950 mt-0.5">${adminCount} คน</div></div>
    `;

    const deptVal = deptFilterEl ? deptFilterEl.value : 'all';
    const filter = $('ad-pin-filter-select').value;
    const q = ($('ad-pin-search-input').value || '').trim().toLowerCase();
    const rankMap = getDepartmentRankMap();

    const list = enriched
      .filter(s => {
        if (deptVal !== 'all' && s.department !== deptVal) return false;
        if (filter === 'admin' && !s.isAdmin) return false;
        else if (filter !== 'all' && filter !== 'admin' && s.status !== filter) return false;
        if (q && !s.name.toLowerCase().includes(q) && !(s.position || '').toLowerCase().includes(q) && !s.department.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        const ra = rankMap.has(a.department) ? rankMap.get(a.department) : 999;
        const rb = rankMap.has(b.department) ? rankMap.get(b.department) : 999;
        if (ra !== rb) return ra - rb;
        return (a.rowNumber || a.seq || 0) - (b.rowNumber || b.seq || 0);
      });

    if (list.length === 0) {
      $('ad-pins-table-body').innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-xs text-slate-400">ไม่พบรายชื่อที่ตรงกับเงื่อนไข</td></tr>`;
      return;
    }

    const deptGroupCounts = new Map();
    list.forEach(s => deptGroupCounts.set(s.department, (deptGroupCounts.get(s.department) || 0) + 1));

    let lastDept = '';
    const htmlRows = [];
    list.forEach((s, idx) => {
      if (s.department !== lastDept) {
        lastDept = s.department;
        const isExec = s.department === 'ผู้บริหาร';
        htmlRows.push(`
          <tr class="${isExec ? 'bg-amber-50/90 border-y border-amber-200' : 'bg-blue-50/80 border-y border-blue-200/80'}">
            <td colspan="5" class="px-3 py-2 text-xs font-bold ${isExec ? 'text-amber-950' : 'text-kbs-navyDark'}">
              <span class="inline-flex items-center gap-2">
                <span class="w-2 h-2 rounded-full ${isExec ? 'bg-amber-500' : 'bg-kbs-navy'}"></span>
                <span>${esc(s.department)}</span>
                <span class="px-2 py-0.5 rounded-full bg-white/90 border border-slate-200 text-[10px] font-bold text-slate-700">${deptGroupCounts.get(s.department)} คน</span>
              </span>
            </td>
          </tr>
        `);
      }

      const badge = s.status === 'custom'
        ? '<span class="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">กำหนดเลขบัตร/รหัสเองแล้ว</span>'
        : (s.status === 'seed'
          ? '<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">เลขบัตรฯ 13 หลัก (E-Profile)</span>'
          : '<span class="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">ยังไม่มีเลขบัตร / รหัส</span>');

      const adminBadge = s.isPrimaryAdmin
        ? '<span class="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-bold">แอดมินหลัก</span>'
        : (s.isAdmin
          ? '<span class="px-2 py-0.5 rounded-full bg-purple-100 border border-purple-200 text-purple-800 text-[10px] font-bold">แอดมิน</span>'
          : '');

      const roleBtn = s.isPrimaryAdmin
        ? '<span class="px-2 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">สิทธิ์ถาวร</span>'
        : `<button type="button" data-toggle-admin="${esc(s.key)}" class="btn-toggle-staff-admin px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${s.isAdmin ? 'bg-purple-100 hover:bg-rose-100 text-purple-900 hover:text-rose-800 border border-purple-200' : 'bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-900 border border-slate-200'}">${s.isAdmin ? 'ถอดสิทธิ์แอดมิน' : 'ให้สิทธิ์แอดมิน'}</button>`;

      htmlRows.push(`
        <tr class="hover:bg-slate-50">
          <td class="px-3 py-2.5 text-slate-500">${idx + 1}</td>
          <td class="px-3 py-2.5 font-semibold text-slate-800">${esc(s.name)}</td>
          <td class="px-3 py-2.5 text-slate-600">${esc(s.position)} <span class="text-kbs-navy font-semibold">• ${esc(s.department)}</span></td>
          <td class="px-3 py-2.5"><div class="flex flex-wrap items-center gap-1">${badge}${adminBadge}</div></td>
          <td class="px-3 py-2.5 text-right space-x-1.5 whitespace-nowrap">
            ${roleBtn}
            <button type="button" data-set-pin="${esc(s.key)}" class="btn-set-staff-pin px-2.5 py-1 rounded-lg bg-kbs-navy hover:bg-kbs-navyDark text-white text-[11px] font-semibold">กำหนดเลขบัตร/รหัส</button>
            ${s.status === 'custom' ? `<button type="button" data-reset-pin="${esc(s.key)}" class="btn-reset-staff-pin px-2 py-1 rounded-lg border border-slate-300 text-slate-600 text-[11px]">ล้างรหัส</button>` : ''}
          </td>
        </tr>
      `);
    });

    $('ad-pins-table-body').innerHTML = htmlRows.join('');

    document.querySelectorAll('.btn-toggle-staff-admin').forEach(btn => {
      btn.addEventListener('click', () => toggleStaffAdminRole(btn.getAttribute('data-toggle-admin')));
    });
    document.querySelectorAll('.btn-set-staff-pin').forEach(btn => {
      btn.addEventListener('click', () => promptSetStaffPin(btn.getAttribute('data-set-pin')));
    });
    document.querySelectorAll('.btn-reset-staff-pin').forEach(btn => {
      btn.addEventListener('click', () => clearStaffCustomPin(btn.getAttribute('data-reset-pin')));
    });
  }

  async function toggleStaffAdminRole(staffKey) {
    const person = state.staffCatalog.find(s => s.key === staffKey);
    if (!person) return;
    const core = person.coreName || stripNamePrefix(person.name);
    const primarySet = new Set(state.primaryAdminCores || PRIMARY_ADMIN_CORES);
    if (primarySet.has(core)) {
      toast('ไม่สามารถถอดสิทธิ์แอดมินหลักได้', 'warning');
      return;
    }

    const current = Array.isArray(state.adminCores) ? [...state.adminCores] : [...PRIMARY_ADMIN_CORES];
    const hasAdmin = current.includes(core);

    const confirmRes = await Swal.fire({
      title: hasAdmin ? 'ยืนยันถอดสิทธิ์แอดมิน?' : 'ยืนยันการให้สิทธิ์แอดมิน?',
      text: `${person.name} จะ${hasAdmin ? 'ถูกถอดสิทธิ์แอดมิน (เข้าได้เฉพาะหน้าครู/บุคลากร)' : 'สามารถเข้าถึงหน้าจัดการแอดมินได้ทันทีหลังล็อกอินด้วยเลขบัตรฯ'}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: hasAdmin ? 'ถอดสิทธิ์แอดมิน' : 'ให้สิทธิ์แอดมิน',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: hasAdmin ? '#dc2626' : '#1e3a8a'
    });
    if (!confirmRes.isConfirmed) return;

    const nextCores = hasAdmin
      ? current.filter(c => c !== core)
      : [...current, core];

    state.adminCores = nextCores;
    await saveSettingsToCloud({ adminCores: nextCores });
    toast(`${hasAdmin ? 'ถอดสิทธิ์แอดมินของ' : 'เพิ่มสิทธิ์แอดมินให้'} ${person.name} เรียบร้อยแล้ว`);
    renderAdminPinsTab();
  }

  async function promptSetStaffPin(staffKey) {
    const person = state.staffCatalog.find(s => s.key === staffKey);
    if (!person) return;
    const { value: codeInput } = await Swal.fire({
      title: `กำหนดเลขบัตรฯ / รหัสเข้าใช้`,
      text: `สำหรับ: ${person.name}`,
      input: 'text',
      inputPlaceholder: 'กรอกเลขบัตรฯ 13 หลัก หรือรหัสเฉพาะตัว เช่น KBS' + String(person.rowNumber || person.seq).padStart(3, '0'),
      inputAttributes: { maxlength: 20 },
      showCancelButton: true,
      confirmButtonText: 'บันทึก',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#1e3a8a',
      inputValidator: v => {
        const normalized = normalizeCidOrCode(v);
        if (!normalized) return 'กรุณากรอกเลขบัตรประชาชน 13 หลัก หรือรหัสเข้าใช้งาน';
        if (/^\d+$/.test(normalized) && normalized.length !== 13) {
          return 'หากเป็นตัวเลขล้วน กรุณากรอกเลขบัตรประชาชนให้ครบ 13 หลัก';
        }
        if (normalized.length < 4) return 'รหัสเข้าใช้งานต้องมีอย่างน้อย 4 ตัวอักษร';
      }
    });
    if (!codeInput) return;

    const normalized = normalizeCidOrCode(codeInput);
    const hash = sha256Hex('cid:' + normalized);
    await saveCustomStaffPin(staffKey, hash);
    toast(`บันทึกรหัสเข้าใช้สำหรับ ${person.name} เรียบร้อยแล้ว`);
    renderAdminPinsTab();
  }

  async function saveCustomStaffPin(staffKey, hash) {
    const person = state.staffCatalog.find(s => s.key === staffKey);
    if (hash) {
      state.customPinHashes[staffKey] = hash;
      state.customPinKeysFromGas.add(staffKey);
    } else {
      delete state.customPinHashes[staffKey];
      state.customPinKeysFromGas.delete(staffKey);
    }
    saveSettingsLocal();

    if (hasGasEndpoint() && state.adminCidHash) {
      await callGasApi('saveStaffPins', {
        adminCidHash: state.adminCidHash,
        pins: [{ key: staffKey, name: person ? person.name : '', pinHash: hash || '' }]
      });
    }
  }

  async function clearStaffCustomPin(staffKey) {
    await saveCustomStaffPin(staffKey, null);
    toast('ล้างรหัสแบบกำหนดเองแล้ว');
    renderAdminPinsTab();
  }

  async function batchAssignMissingPins() {
    const missing = state.staffCatalog.filter(s => {
      const core = s.coreName || stripNamePrefix(s.name);
      const hasCustom = Boolean(state.customPinHashes[s.key] || state.customPinKeysFromGas.has(s.key) || state.customPinCoresFromGas.has(core) || s.hasCustomPin);
      const hasSeed = Boolean(s.hasSeedPin || seedCidCoreSet.has(core) || (seedMap.get(s.key) && seedMap.get(s.key).hasSeedPin));
      return !hasCustom && !hasSeed;
    });
    if (missing.length === 0) {
      toast('บุคลากรทุกคนมีเลขบัตรฯ / รหัสเข้าใช้งานครบแล้ว');
      return;
    }

    const confirmRes = await Swal.fire({
      title: `สร้างรหัสเข้าใช้เฉพาะบุคคลให้ผู้ที่ยังไม่มี (${missing.length} คน)?`,
      html: `<p class="text-sm text-slate-600">ระบบจะสร้างรหัสประจำตัวไม่ซ้ำกันในรูปแบบ <strong>KBS + ลำดับแถว</strong> (เช่น <code>KBS104</code>, <code>KBS121</code>) เพื่อให้แต่ละท่านใช้กรอกในช่องเข้าสู่ระบบได้ทันทีแทนเลขบัตรฯ</p>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: `สร้างรหัสให้ทั้ง ${missing.length} คน`,
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#1e3a8a'
    });
    if (!confirmRes.isConfirmed) return;

    const btn = $('btn-batch-assign-missing-pins');
    setButtonLoading(btn, true, 'กำลังบันทึก...');
    try {
      const gasPins = [];
      const assignedList = [];
      for (const s of missing) {
        const code = 'KBS' + String(s.rowNumber || s.seq).padStart(3, '0');
        const hash = sha256Hex('cid:' + code);
        state.customPinHashes[s.key] = hash;
        state.customPinKeysFromGas.add(s.key);
        gasPins.push({ key: s.key, name: s.name, pinHash: hash });
        assignedList.push({ name: s.name, position: s.position, code });
      }
      saveSettingsLocal();
      if (hasGasEndpoint() && state.adminCidHash) {
        await callGasApi('saveStaffPins', { adminCidHash: state.adminCidHash, pins: gasPins });
      }
      renderAdminPinsTab();

      const rowsHtml = assignedList.map(x => `
        <tr class="border-b border-slate-100">
          <td class="py-1.5 pr-2 text-left">${esc(x.name)}</td>
          <td class="py-1.5 px-2 text-left text-slate-500">${esc(x.position)}</td>
          <td class="py-1.5 pl-2 text-right font-mono font-bold text-kbs-navy">${esc(x.code)}</td>
        </tr>
      `).join('');

      const resultModal = await Swal.fire({
        title: `สร้างรหัสสำเร็จ ${assignedList.length} คน`,
        width: 640,
        html: `
          <p class="text-xs text-slate-600 mb-3">โปรดแจ้งรหัสเข้าใช้ด้านล่างให้บุคลากรนำไปกรอกในช่องเข้าสู่ระบบ (หรือกดดาวน์โหลดเป็นไฟล์ CSV เก็บไว้)</p>
          <div class="max-h-64 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50">
            <table class="w-full text-xs">
              <thead><tr class="border-b border-slate-300 text-slate-600"><th class="text-left pb-1">ชื่อ-สกุล</th><th class="text-left pb-1">ตำแหน่ง</th><th class="text-right pb-1">รหัสเข้าใช้</th></tr></thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'ดาวน์โหลดไฟล์ CSV',
        cancelButtonText: 'ปิดหน้าต่าง',
        confirmButtonColor: '#059669'
      });

      if (resultModal.isConfirmed) {
        const csvLines = ['ชื่อ-สกุล,ตำแหน่ง,รหัสเข้าใช้งาน'];
        assignedList.forEach(x => {
          csvLines.push(`"${x.name.replace(/"/g, '""')}","${(x.position || '').replace(/"/g, '""')}","${x.code}"`);
        });
        const blob = new Blob(['\uFEFF' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'KBS_Access_Codes_Staff.csv';
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setButtonLoading(btn, false);
    }
  }

  // ---- Admin Tab 4: Correction Requests ----
  function renderRequestsBadge() {
    const pendingCount = state.corrections.filter(c => c.status !== 'resolved').length;
    const badge = $('ad-requests-badge');
    if (pendingCount > 0) {
      badge.textContent = String(pendingCount);
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  function renderAdminRequestsTab() {
    const listEl = $('ad-requests-list');
    if (state.corrections.length === 0) {
      listEl.innerHTML = `<div class="p-8 text-center text-xs text-slate-400">ยังไม่มีคำร้องขอตรวจสอบ/แก้ไขข้อมูลเข้ามา</div>`;
      return;
    }

    listEl.innerHTML = state.corrections.map(c => {
      const done = c.status === 'resolved';
      return `
        <div class="rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${done ? 'bg-slate-50 border-slate-200' : 'bg-amber-50/50 border-amber-200'}">
          <div class="space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-bold text-sm text-slate-900">${esc(c.staffName)}</span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${done ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-200 text-amber-900'}">${done ? 'ดำเนินการแล้ว' : 'รอตรวจสอบ'}</span>
            </div>
            <p class="text-xs font-semibold text-kbs-navy">วันที่ ${esc(c.day)} ${esc(c.monthLabel)}</p>
            <p class="text-xs text-slate-700">${esc(c.reason)}</p>
            <p class="text-[10px] text-slate-400">ส่งเมื่อ: ${esc(c.createdAtText || '')}</p>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <button type="button" data-toggle-req="${esc(c.id)}" data-cur="${done ? 'resolved' : 'pending'}" class="btn-toggle-req px-3 py-1.5 rounded-xl text-xs font-bold ${done ? 'border border-slate-300 text-slate-600' : 'bg-emerald-600 text-white hover:bg-emerald-700'}">
              ${done ? 'เปิดเรื่องใหม่' : 'ทำเครื่องหมายว่าแก้ไขแล้ว'}
            </button>
          </div>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.btn-toggle-req').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-toggle-req');
        const nextStatus = btn.getAttribute('data-cur') === 'resolved' ? 'pending' : 'resolved';
        if (hasGasEndpoint() && state.adminCidHash) {
          await callGasApi('updateCorrectionStatus', {
            adminCidHash: state.adminCidHash,
            id,
            status: nextStatus
          });
        }
        const target = state.corrections.find(x => x.id === id);
        if (target) target.status = nextStatus;
        renderRequestsBadge();
        renderAdminRequestsTab();
        toast('อัปเดตสถานะคำร้องแล้ว');
      });
    });
  }

  // ---- Admin Tab 5: System Settings & Site Customization ----
  function renderThemePresetButtons(activePresetId) {
    const wrap = $('ad-cfg-theme-presets');
    if (!wrap) return;
    wrap.innerHTML = THEME_PRESETS.map(p => {
      const isSelected = p.id === activePresetId;
      return `
        <button type="button" data-theme-preset="${esc(p.id)}" class="ad-theme-preset-btn text-left rounded-xl border p-2 transition flex items-center gap-2 ${isSelected ? 'border-kbs-navy bg-blue-50/70 ring-2 ring-kbs-navy/30' : 'border-slate-200 bg-white hover:bg-slate-50'}">
          <span class="flex items-center -space-x-1 flex-shrink-0">
            <span class="w-4 h-4 rounded-full border border-white shadow-xs" style="background-color: ${p.primary};"></span>
            <span class="w-4 h-4 rounded-full border border-white shadow-xs" style="background-color: ${p.accent};"></span>
          </span>
          <span class="text-[11px] font-bold text-slate-800 truncate">${esc(p.name)}</span>
        </button>
      `;
    }).join('');
    wrap.querySelectorAll('.ad-theme-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const presetId = btn.getAttribute('data-theme-preset');
        const found = THEME_PRESETS.find(x => x.id === presetId);
        if (!found) return;
        $('ad-cfg-primary-color').value = found.primary;
        $('ad-cfg-accent-color').value = found.accent;
        if ($('ad-cfg-primary-hex')) $('ad-cfg-primary-hex').textContent = found.primary;
        if ($('ad-cfg-accent-hex')) $('ad-cfg-accent-hex').textContent = found.accent;
        renderThemePresetButtons(found.id);
        applySiteConfigToDom({
          ...collectSiteConfigFormValues(),
          themePreset: found.id,
          primaryColor: found.primary,
          accentColor: found.accent
        });
      });
    });
  }

  function collectSiteConfigFormValues() {
    const pCol = $('ad-cfg-primary-color') ? sanitizeHexColor($('ad-cfg-primary-color').value, DEFAULT_SITE_CONFIG.primaryColor) : DEFAULT_SITE_CONFIG.primaryColor;
    const aCol = $('ad-cfg-accent-color') ? sanitizeHexColor($('ad-cfg-accent-color').value, DEFAULT_SITE_CONFIG.accentColor) : DEFAULT_SITE_CONFIG.accentColor;
    const matchedPreset = THEME_PRESETS.find(p => p.primary.toLowerCase() === pCol && p.accent.toLowerCase() === aCol);
    return {
      siteTitle: ($('ad-cfg-site-title') && $('ad-cfg-site-title').value.trim()) || DEFAULT_SITE_CONFIG.siteTitle,
      siteSubtitle: $('ad-cfg-site-subtitle') ? $('ad-cfg-site-subtitle').value.trim() : '',
      schoolName: ($('ad-cfg-school-name') && $('ad-cfg-school-name').value.trim()) || DEFAULT_SITE_CONFIG.schoolName,
      loginTagline: ($('ad-cfg-login-tagline') && $('ad-cfg-login-tagline').value.trim()) || DEFAULT_SITE_CONFIG.loginTagline,
      footerText: ($('ad-cfg-footer-text') && $('ad-cfg-footer-text').value.trim()) || DEFAULT_SITE_CONFIG.footerText,
      themePreset: matchedPreset ? matchedPreset.id : 'custom',
      primaryColor: pCol,
      accentColor: aCol,
      fontFamily: ($('ad-cfg-font-family') && $('ad-cfg-font-family').value) || DEFAULT_SITE_CONFIG.fontFamily,
      fontSizeScale: ($('ad-cfg-font-scale') && $('ad-cfg-font-scale').value) || DEFAULT_SITE_CONFIG.fontSizeScale,
      allowTeacherPrint: $('ad-cfg-allow-teacher-print') ? $('ad-cfg-allow-teacher-print').checked : true,
      allowTeacherCorrection: $('ad-cfg-allow-teacher-corr') ? $('ad-cfg-allow-teacher-corr').checked : true,
      showLoginOpenMonths: $('ad-cfg-show-login-months') ? $('ad-cfg-show-login-months').checked : true,
      attendanceSheetUrl: sanitizeSafeExternalUrl($('ad-cfg-attendance-url') && $('ad-cfg-attendance-url').value, DEFAULT_SITE_CONFIG.attendanceSheetUrl),
      eprofileSheetUrl: sanitizeSafeExternalUrl($('ad-cfg-eprofile-url') && $('ad-cfg-eprofile-url').value, DEFAULT_SITE_CONFIG.eprofileSheetUrl),
      appsScriptUrl: sanitizeSafeExternalUrl($('ad-cfg-script-url') && $('ad-cfg-script-url').value, DEFAULT_SITE_CONFIG.appsScriptUrl)
    };
  }

  function populateSiteConfigForm(cfg) {
    if ($('ad-cfg-site-title')) $('ad-cfg-site-title').value = cfg.siteTitle || DEFAULT_SITE_CONFIG.siteTitle;
    if ($('ad-cfg-site-subtitle')) $('ad-cfg-site-subtitle').value = cfg.siteSubtitle || '';
    if ($('ad-cfg-school-name')) $('ad-cfg-school-name').value = cfg.schoolName || DEFAULT_SITE_CONFIG.schoolName;
    if ($('ad-cfg-login-tagline')) $('ad-cfg-login-tagline').value = cfg.loginTagline || DEFAULT_SITE_CONFIG.loginTagline;
    if ($('ad-cfg-footer-text')) $('ad-cfg-footer-text').value = cfg.footerText || DEFAULT_SITE_CONFIG.footerText;

    const pCol = sanitizeHexColor(cfg.primaryColor, DEFAULT_SITE_CONFIG.primaryColor);
    const aCol = sanitizeHexColor(cfg.accentColor, DEFAULT_SITE_CONFIG.accentColor);
    if ($('ad-cfg-primary-color')) $('ad-cfg-primary-color').value = pCol;
    if ($('ad-cfg-accent-color')) $('ad-cfg-accent-color').value = aCol;
    if ($('ad-cfg-primary-hex')) $('ad-cfg-primary-hex').textContent = pCol;
    if ($('ad-cfg-accent-hex')) $('ad-cfg-accent-hex').textContent = aCol;

    if ($('ad-cfg-font-family')) $('ad-cfg-font-family').value = cfg.fontFamily || DEFAULT_SITE_CONFIG.fontFamily;
    if ($('ad-cfg-font-scale')) $('ad-cfg-font-scale').value = cfg.fontSizeScale || DEFAULT_SITE_CONFIG.fontSizeScale;

    if ($('ad-cfg-allow-teacher-print')) $('ad-cfg-allow-teacher-print').checked = cfg.allowTeacherPrint !== false;
    if ($('ad-cfg-allow-teacher-corr')) $('ad-cfg-allow-teacher-corr').checked = cfg.allowTeacherCorrection !== false;
    if ($('ad-cfg-show-login-months')) $('ad-cfg-show-login-months').checked = cfg.showLoginOpenMonths !== false;

    if ($('ad-cfg-attendance-url')) $('ad-cfg-attendance-url').value = cfg.attendanceSheetUrl || DEFAULT_SITE_CONFIG.attendanceSheetUrl;
    if ($('ad-cfg-eprofile-url')) $('ad-cfg-eprofile-url').value = cfg.eprofileSheetUrl || DEFAULT_SITE_CONFIG.eprofileSheetUrl;
    if ($('ad-cfg-script-url')) $('ad-cfg-script-url').value = cfg.appsScriptUrl || DEFAULT_SITE_CONFIG.appsScriptUrl;

    renderThemePresetButtons(cfg.themePreset || 'kbs_navy');
  }

  function renderAdminSettingsTab() {
    $('ad-gas-url-input').value = state.settings.gasUrl || '';
    const cfg = getSiteConfig();
    populateSiteConfigForm(cfg);
    applySiteConfigToDom(cfg);

    const proxyEl = $('ad-vercel-proxy-status');
    if (proxyEl) {
      proxyEl.textContent = state.vercelProxyAvailable
        ? 'พร้อมใช้งาน (เชื่อมต่อผ่าน /api/gas)'
        : (isHttpOrigin() ? 'ยังไม่พบ GAS_API_URL ใน Vercel หรือยังไม่ได้ทดสอบ' : 'เปิดแบบไฟล์ในเครื่อง (ใช้ GAS URL โดยตรง)');
    }
  }

  // -------------------- 11. EXPORT CSV & MODALS --------------------
  function exportAdminCsv() {
    const selectedTerm = getAdminTermObj();
    const termMonths = (selectedTerm && selectedTerm.months) || state.months;
    const records = (selectedTerm && state.adminRecordsByTerm[selectedTerm.termId]) || state.adminRecords || [];
    const scopeInfo = getAdminOverviewScopeSpecs(selectedTerm, termMonths);

    const groupVal = $('ad-group-filter') ? $('ad-group-filter').value : 'all';
    const deptVal = $('ad-dept-filter') ? $('ad-dept-filter').value : 'all';
    const exportList = records.filter(r => {
      const dept = resolveStaffDepartment(r);
      if (groupVal !== 'all' && r.group !== groupVal) return false;
      if (deptVal !== 'all' && dept !== deptVal) return false;
      return true;
    });

    const headers = ['ลำดับ', 'ชื่อ-สกุล', 'ตำแหน่ง', 'กลุ่มสาระฯ/ผู้บริหาร (E-Profile)', 'กลุ่ม', 'มาปกติ', 'ไปราชการ', 'ลากิจ(ครั้ง)', 'ลากิจ(วัน)', 'ลาป่วย(ครั้ง)', 'ลาป่วย(วัน)', 'ลาอื่นๆ(ครั้ง)', 'ลาอื่นๆ(วัน)', 'รวมลา(ครั้ง)', 'รวมลา(วัน)', 'ไม่สแกนเข้า', 'ไม่สแกนออก', 'สาย', 'ขาดราชการ', 'ขอออก'];
    const lines = [headers.join(',')];
    for (const r of exportList) {
      const s = sumStats(r, scopeInfo.specs);
      const dept = resolveStaffDepartment(r);
      const row = [
        r.seq, `"${(r.name || '').replace(/"/g, '""')}"`, `"${(r.position || '').replace(/"/g, '""')}"`, `"${dept.replace(/"/g, '""')}"`, `"${(r.group || '').replace(/"/g, '""')}"`,
        s.present, s.duty, s.personalCount, s.personalDays, s.sickCount, s.sickDays, s.otherLeaveCount, s.otherLeaveDays,
        s.totalLeaveCount, s.totalLeaveDays, s.noIn, s.noOut, s.late, s.absent, s.earlyOut
      ];
      lines.push(row.join(','));
    }
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const tag = scopeInfo.isDateRange ? `${scopeInfo.startStr}_to_${scopeInfo.endStr}` : $('ad-scope-select').value;
    a.download = `KBS_Attendance_Summary_${tag}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // -------------------- 12. EVENT BINDINGS & INIT --------------------
  function bindEvents() {
    $('btn-mode-teacher').addEventListener('click', () => switchMode('teacher'));
    $('btn-mode-admin').addEventListener('click', () => switchMode('admin'));

    // Teacher single CID / access code login
    const cidInput = $('teacher-cid-input');
    cidInput.addEventListener('input', () => {
      cidInput.value = formatCidInputValue(cidInput.value);
      $('teacher-login-error').classList.add('hidden');
    });

    $('btn-toggle-teacher-cid').addEventListener('click', () => {
      cidInput.type = cidInput.type === 'password' ? 'text' : 'password';
    });

    $('form-teacher-login').addEventListener('submit', async e => {
      e.preventDefault();
      const cidVal = cidInput.value;
      const remember = $('teacher-remember-checkbox').checked;
      const errBox = $('teacher-login-error');
      const btn = $('btn-teacher-login');
      errBox.classList.add('hidden');
      setButtonLoading(btn, true, 'กำลังตรวจสอบ...');
      try {
        await authenticateTeacher(cidVal, remember, false);
      } catch (err) {
        errBox.textContent = err.message;
        errBox.classList.remove('hidden');
      } finally {
        setButtonLoading(btn, false);
      }
    });

    // Teacher dashboard actions
    $('td-btn-logout').addEventListener('click', logoutTeacher);
    $('td-btn-print').addEventListener('click', () => window.print());
    $('td-btn-request-correction').addEventListener('click', () => {
      const activeTerm = state.terms.find(tm => tm.termId === state.teacherSelectedTermId) || getOpenTermsList()[0];
      const openMonths = activeTerm ? getVisibleMonthsList(activeTerm.termId) : [];
      if (!openMonths.length) {
        toast('ยังไม่มีเดือนที่เปิดให้แจ้งตรวจสอบ', 'warning');
        return;
      }
      $('corr-month-select').innerHTML = openMonths.map(m => `<option value="${esc(m.id)}">${esc(m.label)}</option>`).join('');
      if (state.teacherCalendarMonthId) $('corr-month-select').value = state.teacherCalendarMonthId;
      $('corr-day-input').value = '';
      $('corr-reason-input').value = '';
      $('modal-correction-request').classList.remove('hidden');
    });

    $('btn-close-correction-modal').addEventListener('click', () => $('modal-correction-request').classList.add('hidden'));
    $('btn-cancel-correction').addEventListener('click', () => $('modal-correction-request').classList.add('hidden'));
    $('form-correction-request').addEventListener('submit', async e => {
      e.preventDefault();
      if (!state.currentTeacher) return;
      const btn = $('btn-submit-correction');
      const activeTerm = state.terms.find(tm => tm.termId === state.teacherSelectedTermId) || getOpenTermsList()[0];
      const mId = $('corr-month-select').value;
      const mObj = ((activeTerm && activeTerm.months) || state.months).find(m => m.id === mId);
      const day = Number($('corr-day-input').value);
      const reason = $('corr-reason-input').value.trim();
      setButtonLoading(btn, true, 'กำลังส่งคำร้อง...');
      try {
        const docData = {
          staffKey: state.currentTeacher.key,
          coreName: state.currentTeacher.coreName,
          staffName: state.currentTeacher.name,
          cidHash: state.teacherAuthSession ? state.teacherAuthSession.cidHash : '',
          termName: activeTerm ? activeTerm.termName : '',
          monthId: mId,
          monthLabel: mObj ? mObj.label : mId,
          day,
          reason,
          status: 'pending',
          createdAtTs: Date.now(),
          createdAtText: new Date().toLocaleString('th-TH')
        };
        if (hasGasEndpoint()) {
          const res = await callGasApi('submitCorrection', docData);
          docData.id = res.id || ('req_' + Date.now());
          docData.createdAtText = res.createdAtText || docData.createdAtText;
        } else {
          docData.id = 'local_' + Date.now();
        }
        state.corrections.unshift(docData);
        $('modal-correction-request').classList.add('hidden');
        toast('ส่งคำร้องบันทึกลง Google Sheets เรียบร้อยแล้ว');
      } catch (err) {
        toast('ส่งคำร้องไม่สำเร็จ: ' + err.message, 'error');
      } finally {
        setButtonLoading(btn, false);
      }
    });

    // Admin top bar & tabs
    $('btn-ad-logout').addEventListener('click', logoutAdmin);
    $('btn-ad-refresh-gas').addEventListener('click', async () => {
      const btn = $('btn-ad-refresh-gas');
      if (!hasGasEndpoint()) {
        toast('กรุณากรอก GAS Web App URL ในแท็บ 5 หรือตั้งค่า GAS_API_URL บน Vercel ก่อนซิงค์สด', 'info');
        switchAdminTab('settings');
        return;
      }
      setButtonLoading(btn, true, 'กำลังซิงค์...');
      try {
        await loadAdminRecords(true);
        toast('ซิงค์ข้อมูลล่าสุดจาก Google Sheets เรียบร้อยแล้ว');
        renderAdminDashboard();
      } catch (err) {
        toast('ซิงค์ไม่สำเร็จ: ' + err.message, 'error');
      } finally {
        setButtonLoading(btn, false);
      }
    });

    document.querySelectorAll('.ad-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchAdminTab(btn.getAttribute('data-ad-tab')));
    });

    // Admin mobile sidebar drawer
    $('btn-ad-sidebar-toggle').addEventListener('click', () => toggleAdminSidebarDrawer(true));
    $('btn-ad-sidebar-close').addEventListener('click', () => toggleAdminSidebarDrawer(false));
    $('ad-sidebar-backdrop').addEventListener('click', () => toggleAdminSidebarDrawer(false));

    // Admin Tab 2 quick month toggles & sheet sync
    $('btn-sync-from-months-tab').addEventListener('click', async () => {
      const btn = $('btn-sync-from-months-tab');
      setButtonLoading(btn, true, 'กำลังซิงค์...');
      try {
        await refreshPublicCatalogFromGas(true);
        await loadAdminRecords(true);
        renderAllActiveViews();
        toast(`ดึงแท็บข้อมูลล่าสุดแล้ว (${state.terms.length} ภาคเรียน/ปี)`);
      } catch (err) {
        toast('ดึงข้อมูลไม่สำเร็จ: ' + err.message, 'error');
      } finally {
        setButtonLoading(btn, false);
      }
    });

    $('btn-open-months-with-data').addEventListener('click', async () => {
      const btn = $('btn-open-months-with-data');
      const selectedTerm = getAdminTermObj();
      if (!selectedTerm) return;
      const nextVis = { ...(state.settings.visibleMonths || {}) };
      (selectedTerm.months || []).forEach(m => { nextVis[`${selectedTerm.termId}::${m.id}`] = Boolean(m.hasData); });
      const p = saveSettingsToCloud({ visibleMonths: nextVis });
      renderAdminMonthsTab();
      toast(`เปิดเฉพาะเดือนที่มีข้อมูลใน ${selectedTerm.termName} แล้ว`);
      setButtonLoading(btn, true, 'กำลังบันทึก...');
      try {
        await p;
      } catch (err) {
        toast('บันทึกลง Google Sheets ไม่สำเร็จ: ' + err.message, 'error');
      } finally {
        setButtonLoading(btn, false);
      }
    });

    $('btn-open-all-months').addEventListener('click', async () => {
      const btn = $('btn-open-all-months');
      const selectedTerm = getAdminTermObj();
      if (!selectedTerm) return;
      const nextVis = { ...(state.settings.visibleMonths || {}) };
      (selectedTerm.months || []).forEach(m => { nextVis[`${selectedTerm.termId}::${m.id}`] = true; });
      const p = saveSettingsToCloud({ visibleMonths: nextVis });
      renderAdminMonthsTab();
      toast(`เปิดทุกเดือนใน ${selectedTerm.termName} แล้ว`);
      setButtonLoading(btn, true, 'กำลังบันทึก...');
      try {
        await p;
      } catch (err) {
        toast('บันทึกลง Google Sheets ไม่สำเร็จ: ' + err.message, 'error');
      } finally {
        setButtonLoading(btn, false);
      }
    });

    $('btn-close-all-months').addEventListener('click', async () => {
      const btn = $('btn-close-all-months');
      const selectedTerm = getAdminTermObj();
      if (!selectedTerm) return;
      const nextVis = { ...(state.settings.visibleMonths || {}) };
      (selectedTerm.months || []).forEach(m => { nextVis[`${selectedTerm.termId}::${m.id}`] = false; });
      const p = saveSettingsToCloud({ visibleMonths: nextVis });
      renderAdminMonthsTab();
      toast(`ปิดทุกเดือนใน ${selectedTerm.termName} แล้ว`);
      setButtonLoading(btn, true, 'กำลังบันทึก...');
      try {
        await p;
      } catch (err) {
        toast('บันทึกลง Google Sheets ไม่สำเร็จ: ' + err.message, 'error');
      } finally {
        setButtonLoading(btn, false);
      }
    });

    $('btn-save-announcement').addEventListener('click', async () => {
      const btn = $('btn-save-announcement');
      const txt = $('ad-announcement-input').value.trim();
      setButtonLoading(btn, true, 'กำลังบันทึก...');
      try {
        await saveSettingsToCloud({ announcement: txt });
        toast('บันทึกข้อความประกาศเรียบร้อยแล้ว');
        renderAllActiveViews();
      } catch (err) {
        toast('บันทึกประกาศไม่สำเร็จ: ' + err.message, 'error');
      } finally { setButtonLoading(btn, false); }
    });

    // Admin Tab 2 filters
    $('ad-term-select').addEventListener('change', async () => {
      const tId = $('ad-term-select').value;
      state.adminSelectedTermId = tId;
      if (state.adminRecordsByTerm[tId]) {
        state.adminRecords = state.adminRecordsByTerm[tId];
      } else {
        await loadAdminRecords(false, tId);
      }
      renderAdminOverviewTab();
    });
    $('ad-scope-select').addEventListener('change', () => {
      const val = $('ad-scope-select').value;
      const cb = $('ad-use-date-range');
      if (val === 'custom_range') {
        if (cb) cb.checked = true;
      } else {
        if (cb) cb.checked = false;
        const selectedTerm = getAdminTermObj();
        const termMonths = (selectedTerm && selectedTerm.months) || state.months;
        const mObj = termMonths.find(m => m.id === val);
        if (mObj) {
          $('ad-date-start').value = toIsoDate(mObj.yearCE, mObj.month, 1);
          $('ad-date-end').value = toIsoDate(mObj.yearCE, mObj.month, mObj.daysInMonth);
        }
      }
      renderAdminOverviewTab();
    });
    $('ad-use-date-range').addEventListener('change', () => {
      const checked = $('ad-use-date-range').checked;
      const scopeEl = $('ad-scope-select');
      if (checked) {
        const curVal = scopeEl.value;
        const selectedTerm = getAdminTermObj();
        const termMonths = (selectedTerm && selectedTerm.months) || state.months;
        const mObj = termMonths.find(m => m.id === curVal);
        if (mObj) {
          $('ad-date-start').value = toIsoDate(mObj.yearCE, mObj.month, 1);
          $('ad-date-end').value = toIsoDate(mObj.yearCE, mObj.month, mObj.daysInMonth);
        }
        scopeEl.value = 'custom_range';
      } else if (scopeEl.value === 'custom_range') {
        scopeEl.value = 'all';
      }
      renderAdminOverviewTab();
    });
    ['ad-date-start', 'ad-date-end', 'ad-group-filter', 'ad-dept-filter', 'ad-rank-limit-select'].forEach(id => {
      $(id).addEventListener('change', renderAdminOverviewTab);
    });
    $('btn-preset-half1').addEventListener('click', () => {
      const startVal = $('ad-date-start').value;
      if (!startVal) return;
      $('ad-date-start').value = startVal.slice(0, 8) + '01';
      $('ad-date-end').value = startVal.slice(0, 8) + '15';
      $('ad-use-date-range').checked = true;
      $('ad-scope-select').value = 'custom_range';
      renderAdminOverviewTab();
    });
    $('btn-preset-half2').addEventListener('click', () => {
      const startVal = $('ad-date-start').value;
      if (!startVal) return;
      const y = Number(startVal.slice(0, 4));
      const m = Number(startVal.slice(5, 7));
      const lastDay = new Date(y, m, 0).getDate();
      $('ad-date-start').value = startVal.slice(0, 8) + '16';
      $('ad-date-end').value = startVal.slice(0, 8) + String(lastDay).padStart(2, '0');
      $('ad-use-date-range').checked = true;
      $('ad-scope-select').value = 'custom_range';
      renderAdminOverviewTab();
    });
    $('ad-search-staff-input').addEventListener('input', renderAdminOverviewTab);
    $('btn-ad-clear-dept').addEventListener('click', () => {
      $('ad-dept-filter').value = 'all';
      renderAdminOverviewTab();
    });
    $('btn-ad-export-csv').addEventListener('click', exportAdminCsv);
    $('btn-ad-print-all').addEventListener('click', () => {
      renderAdminPrintArea(true);
      window.print();
    });
    window.addEventListener('beforeprint', () => {
      if (state.mode === 'admin' && state.lastAdminOverviewSnapshot) {
        renderAdminPrintArea(true);
      }
    });
    $('btn-close-staff-modal').addEventListener('click', () => $('modal-staff-detail').classList.add('hidden'));
    $('modal-staff-detail').addEventListener('click', e => {
      if (e.target === $('modal-staff-detail')) $('modal-staff-detail').classList.add('hidden');
    });
    $('modal-correction-request').addEventListener('click', e => {
      if (e.target === $('modal-correction-request')) $('modal-correction-request').classList.add('hidden');
    });

    // Admin Tab 3 PINs & E-Profile Departments
    $('ad-pin-dept-filter').addEventListener('change', renderAdminPinsTab);
    $('ad-pin-filter-select').addEventListener('change', renderAdminPinsTab);
    $('ad-pin-search-input').addEventListener('input', renderAdminPinsTab);
    $('btn-batch-assign-missing-pins').addEventListener('click', batchAssignMissingPins);

    // Admin Tab 5 Settings & Site Customization
    $('btn-toggle-db-urls').addEventListener('click', () => {
      $('ad-db-urls-panel').classList.toggle('hidden');
    });
    const previewLiveAppearance = () => {
      const pCol = $('ad-cfg-primary-color').value;
      const aCol = $('ad-cfg-accent-color').value;
      if ($('ad-cfg-primary-hex')) $('ad-cfg-primary-hex').textContent = pCol;
      if ($('ad-cfg-accent-hex')) $('ad-cfg-accent-hex').textContent = aCol;
      const draft = collectSiteConfigFormValues();
      renderThemePresetButtons(draft.themePreset);
      applySiteConfigToDom(draft);
      updateSyncBadge();
    };
    ['ad-cfg-primary-color', 'ad-cfg-accent-color', 'ad-cfg-font-family', 'ad-cfg-font-scale'].forEach(id => {
      $(id).addEventListener('change', previewLiveAppearance);
      $(id).addEventListener('input', previewLiveAppearance);
    });
    ['ad-cfg-site-title', 'ad-cfg-site-subtitle', 'ad-cfg-footer-text', 'ad-cfg-login-tagline'].forEach(id => {
      $(id).addEventListener('input', () => {
        applySiteConfigToDom(collectSiteConfigFormValues());
        updateSyncBadge();
      });
    });

    $('btn-save-site-config').addEventListener('click', async () => {
      const btn = $('btn-save-site-config');
      const nextCfg = collectSiteConfigFormValues();
      setButtonLoading(btn, true, 'กำลังบันทึก...');
      try {
        await saveSettingsToCloud({ siteConfig: nextCfg });
        if (state.currentTeacher) renderTeacherDashboard();
        if (state.mode === 'admin' && state.adTab === 'overview') renderAdminOverviewTab();
        toast('บันทึกการตั้งค่าเว็บและธีมเรียบร้อยแล้ว');
      } catch (err) {
        toast('บันทึกลงเครื่องแล้ว แต่ซิงค์ Cloud ไม่สำเร็จ: ' + err.message, 'warning');
      } finally {
        setButtonLoading(btn, false);
      }
    });

    $('btn-reset-site-config').addEventListener('click', async () => {
      const btn = $('btn-reset-site-config');
      const defCfg = { ...DEFAULT_SITE_CONFIG };
      populateSiteConfigForm(defCfg);
      setButtonLoading(btn, true, 'กำลังรีเซ็ต...');
      try {
        await saveSettingsToCloud({ siteConfig: defCfg });
        if (state.currentTeacher) renderTeacherDashboard();
        if (state.mode === 'admin' && state.adTab === 'overview') renderAdminOverviewTab();
        toast('รีเซ็ตการตั้งค่ากลับเป็นค่าเริ่มต้น (KBS) แล้ว');
      } catch (err) {
        toast('รีเซ็ตบนเครื่องแล้ว: ' + err.message, 'warning');
      } finally {
        setButtonLoading(btn, false);
      }
    });

    $('btn-test-gas').addEventListener('click', async () => {
      const url = $('ad-gas-url-input').value.trim();
      const box = $('ad-gas-test-result');
      const btn = $('btn-test-gas');
      if (!url && !isHttpOrigin()) { toast('กรุณากรอก URL ก่อนทดสอบ', 'warning'); return; }
      setButtonLoading(btn, true, 'กำลังทดสอบ...');
      box.classList.add('hidden');
      try {
        let data;
        if (isHttpOrigin()) {
          const headers = {};
          if (url) headers['x-gas-url'] = url;
          const r = await fetch('/api/gas?action=ping', { headers });
          if (r.status !== 404) data = await r.json();
        }
        if (!data && url) {
          const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}action=ping`);
          data = await res.json();
        }
        if (!data || !data.success) throw new Error((data && data.error) || 'เชื่อมต่อไม่สำเร็จ');
        box.className = 'rounded-xl p-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800';
        box.textContent = `เชื่อมต่อสำเร็จ! ชีต: ${data.spreadsheetTitle} / แท็บ: ${data.sheetTitle} (${data.lastRow} แถว)`;
        box.classList.remove('hidden');
      } catch (err) {
        box.className = 'rounded-xl p-3 text-xs bg-red-50 border border-red-200 text-red-700';
        box.textContent = `เชื่อมต่อไม่สำเร็จ: ${err.message}`;
        box.classList.remove('hidden');
      } finally {
        setButtonLoading(btn, false);
      }
    });

    $('btn-save-gas-url').addEventListener('click', async () => {
      const url = $('ad-gas-url-input').value.trim();
      const btn = $('btn-save-gas-url');
      setButtonLoading(btn, true, 'กำลังบันทึก...');
      try {
        await saveSettingsToCloud({ gasUrl: url });
        if (url || isHttpOrigin()) {
          await refreshPublicCatalogFromGas(true);
          await loadAdminRecords(true);
        }
        toast('บันทึก GAS URL และซิงค์ข้อมูลเรียบร้อยแล้ว');
        renderAdminDashboard();
      } catch (err) {
        toast('บันทึกไม่สำเร็จ: ' + err.message, 'error');
      } finally {
        setButtonLoading(btn, false);
      }
    });
  }

  // -------------------- 13. BOOTSTRAP --------------------
  async function boot() {
    const emblemUri = createDefaultKvkEmblemDataUri();
    $('header-logo-img').src = emblemUri;
    loadSettingsLocal();
    applySiteConfigToDom();
    bindEvents();

    // ลองเชื่อมต่อ Google Sheets ผ่าน GAS / /api/gas ทันทีที่เปิดหน้า
    await refreshPublicCatalogFromGas(false);

    // Restore teacher/admin session if saved
    const savedSess = sessionStorage.getItem(SS_TEACHER_AUTH_KEY) || localStorage.getItem(LS_TEACHER_AUTH_KEY);
    if (savedSess) {
      try {
        const parsedSess = JSON.parse(savedSess);
        if (parsedSess && parsedSess.cidHash) {
          await authenticateTeacher({ cidHash: parsedSess.cidHash }, false, true);
        }
      } catch (e) {
        sessionStorage.removeItem(SS_TEACHER_AUTH_KEY);
        localStorage.removeItem(LS_TEACHER_AUTH_KEY);
      }
    }

    updateSyncBadge();
    renderActiveModeView();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
