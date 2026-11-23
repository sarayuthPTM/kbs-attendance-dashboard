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
  const DEFAULT_ADMIN_PIN = APP_CFG.DEFAULT_ADMIN_PIN || '123456';
  const LS_SETTINGS_KEY = 'KBS_ATT_SETTINGS_LOCAL_V2';
  const LS_CUSTOM_PINS_KEY = 'KBS_ATT_CUSTOM_PINS_LOCAL_V2';
  const LS_TEACHER_AUTH_KEY = 'KBS_ATT_TEACHER_REMEMBER_V1';
  const SS_TEACHER_AUTH_KEY = 'KBS_ATT_TEACHER_SESSION_V1';
  const SS_ADMIN_HASH_KEY = 'KBS_ATT_ADMIN_SESSION_HASH_V1';

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
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 400">
      <defs>
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fef08a"/>
          <stop offset="35%" stop-color="#facc15"/>
          <stop offset="70%" stop-color="#eab308"/>
          <stop offset="100%" stop-color="#ca8a04"/>
        </linearGradient>
        <linearGradient id="blueRibbon" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#172554"/>
          <stop offset="50%" stop-color="#1e40af"/>
          <stop offset="100%" stop-color="#172554"/>
        </linearGradient>
      </defs>
      <path d="M160 12 L255 150 L240 205 L268 200 L276 265 C270 335 220 382 160 388 C100 382 50 335 44 265 L52 200 L80 205 L65 150 Z"
            fill="#ffffff" stroke="#ffffff" stroke-width="18" stroke-linejoin="round"/>
      <g stroke="url(#goldGrad)" stroke-width="6.5" stroke-linecap="round">
        <line x1="160" y1="150" x2="160" y2="22"/>
        <line x1="160" y1="150" x2="136" y2="28"/>
        <line x1="160" y1="150" x2="114" y2="42"/>
        <line x1="160" y1="150" x2="94" y2="62"/>
        <line x1="160" y1="150" x2="78" y2="86"/>
        <line x1="160" y1="150" x2="66" y2="114"/>
        <line x1="160" y1="150" x2="58" y2="144"/>
        <line x1="160" y1="150" x2="184" y2="28"/>
        <line x1="160" y1="150" x2="206" y2="42"/>
        <line x1="160" y1="150" x2="226" y2="62"/>
        <line x1="160" y1="150" x2="242" y2="86"/>
        <line x1="160" y1="150" x2="254" y2="114"/>
        <line x1="160" y1="150" x2="262" y2="144"/>
      </g>
      <polygon points="160,35 148,110 172,110" fill="url(#goldGrad)" stroke="#92400e" stroke-width="1.5"/>
      <ellipse cx="160" cy="118" rx="28" ry="8" fill="url(#goldGrad)" stroke="#92400e" stroke-width="1.5"/>
      <ellipse cx="160" cy="132" rx="38" ry="10" fill="url(#goldGrad)" stroke="#92400e" stroke-width="1.5"/>
      <ellipse cx="160" cy="148" rx="48" ry="12" fill="url(#goldGrad)" stroke="#92400e" stroke-width="1.8"/>
      <circle cx="160" cy="252" r="68" fill="url(#goldGrad)" stroke="#92400e" stroke-width="2.5"/>
      <path d="M122 252 C122 218, 198 218, 198 252 C198 286, 122 286, 122 252 Z" fill="none" stroke="#78350f" stroke-width="5"/>
      <path d="M142 225 C165 215, 185 245, 160 270 C135 285, 155 305, 182 285" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round"/>
      <path d="M55 215 L82 215 L82 270 C82 322 118 352 160 352 C202 352 238 322 238 270 L238 215 L265 215 L265 272 C265 340 216 380 160 380 C104 380 55 340 55 272 Z"
            fill="url(#blueRibbon)" stroke="url(#goldGrad)" stroke-width="4.5" stroke-linejoin="round"/>
    </svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  // -------------------- 3. APPLICATION STATE --------------------
  const seedStaff = Array.isArray(window.KBS_ATTENDANCE_STAFF_SEED) ? window.KBS_ATTENDANCE_STAFF_SEED : [];
  const seedMap = new Map(seedStaff.map(s => [s.key, s]));
  const seedCidHashes = window.KBS_ATTENDANCE_CID_HASHES || {};
  const seedCidCoreSet = new Set(Object.values(seedCidHashes));
  const fallbackData = window.KBS_ATTENDANCE_FALLBACK_DATA || null;

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

  const state = {
    mode: 'teacher', // 'teacher' | 'admin'
    adTab: 'months', // 'months' | 'overview' | 'pins' | 'requests' | 'settings'
    dataSource: fallbackData ? 'snapshot' : 'none',
    vercelProxyAvailable: false,
    syncedAt: fallbackData ? fallbackData.syncedAt : '',
    terms: initialTerms,
    months: initialMonths,
    staffCatalog: buildInitialCatalog(),
    adminSelectedTermId: '0',
    adminRecordsByTerm: fallbackData && fallbackData.records ? { '0': fallbackData.records } : {},
    adminRecords: null,
    settings: {
      visibleTerms: { '0': true },
      visibleMonths: buildDefaultVisibleMonths('0', initialMonths),
      announcement: '',
      gasUrl: (APP_CFG.GAS_API_URL || '').trim(),
      adminPinHash: sha256Hex('kbs-att-admin:' + DEFAULT_ADMIN_PIN),
      updatedAt: ''
    },
    customPinHashes: {}, // staffKey -> sha256Hex('cid:' + normalizedCidOrCode)
    customPinKeysFromGas: new Set(),
    customPinCoresFromGas: new Set(),
    corrections: [],
    currentTeacher: null, // { key, coreName, name, position, group, department, avatarUrl, terms: [...] }
    teacherAuthSession: null, // { staffKey, coreName, cidHash }
    teacherSelectedTermId: null,
    teacherSelectedMonthTab: 'all', // 'all' | monthId
    teacherCalendarMonthId: null,
    adminSessionHash: null,
    charts: {
      tdMonthly: null,
      tdBreakdown: null,
      adMonthly: null,
      adIssues: null
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
  function calcMonthStats(monthData) {
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

    for (const raw of monthData.days) {
      const v = String(raw || '').trim();
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

  function sumStats(record, monthIds) {
    const total = calcMonthStats(null);
    total.otherLeaveCount = 0;
    total.otherLeaveDays = 0;
    for (const mId of monthIds) {
      const mData = record && record.months ? record.months[mId] : null;
      const ms = calcMonthStats(mData);
      Object.keys(ms).forEach(k => {
        total[k] = (total[k] || 0) + ms[k];
      });
    }
    return total;
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

    // บน Vercel (หรือเซิร์ฟเวอร์ที่มี /api/gas): ใช้ Proxy ก่อน เพื่อหลีกเลี่ยง CORS และรองรับ Vercel Env Var
    if (isHttpOrigin()) {
      try {
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
      } catch (proxyErr) {
        if (!gasUrl) throw proxyErr;
      }
    }

    if (!gasUrl) throw new Error('ยังไม่ได้ตั้งค่า Google Apps Script URL');
    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body
    });
    if (!res.ok) throw new Error(`GAS HTTP ${res.status}`);
    const data = await res.json();
    if (!data || data.success === false) {
      throw new Error((data && data.error) || 'GAS ตอบกลับไม่สำเร็จ');
    }
    return data;
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
            visibleMonths: { ...state.settings.visibleMonths, ...(parsed.visibleMonths || {}) }
          };
        }
      }
      const rawPins = localStorage.getItem(LS_CUSTOM_PINS_KEY);
      if (rawPins) {
        state.customPinHashes = JSON.parse(rawPins) || {};
      }
    } catch (e) {}
  }

  async function saveSettingsToCloud(partialUpdate = {}) {
    state.settings = {
      ...state.settings,
      ...partialUpdate,
      updatedAt: new Date().toISOString()
    };
    saveSettingsLocal();

    if (hasGasEndpoint() && state.adminSessionHash) {
      await callGasApi('saveAdminSettings', {
        adminPinHash: state.adminSessionHash,
        newAdminPinHash: partialUpdate.adminPinHash || undefined,
        settings: {
          visibleTerms: state.settings.visibleTerms,
          visibleMonths: state.settings.visibleMonths,
          announcement: state.settings.announcement
        }
      });
    }
  }

  function applySettingsFromServer(serverSettings) {
    if (!serverSettings || typeof serverSettings !== 'object') return;
    state.settings = {
      ...state.settings,
      visibleTerms: serverSettings.visibleTerms
        ? { ...state.settings.visibleTerms, ...serverSettings.visibleTerms }
        : state.settings.visibleTerms,
      visibleMonths: serverSettings.visibleMonths
        ? { ...state.settings.visibleMonths, ...serverSettings.visibleMonths }
        : state.settings.visibleMonths,
      announcement: serverSettings.announcement !== undefined ? serverSettings.announcement : state.settings.announcement,
      updatedAt: serverSettings.updatedAt || state.settings.updatedAt
    };
    saveSettingsLocal();
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
      if (Array.isArray(res.staffCatalog) && res.staffCatalog.length) {
        const nextCustomKeys = new Set();
        state.staffCatalog = res.staffCatalog.map(item => {
          const core = item.coreName || stripNamePrefix(item.name);
          const seed = seedMap.get(item.key);
          if (item.hasCustomPin) nextCustomKeys.add(item.key);
          return {
            ...item,
            coreName: core,
            department: item.department || (seed && seed.department) || (item.group === 'ลูกจ้างห้องเรียนกีฬา' ? 'ห้องเรียนกีฬา' : 'เจ้าหน้าที่ / อื่นๆ'),
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
    if (subEl) {
      subEl.textContent = openTerms.length
        ? `โรงเรียนกาญจนาภิเษกวิทยาลัย กระบี่ • เปิดให้ดู ${openTerms.map(t => t.termName).join(', ')}`
        : 'โรงเรียนกาญจนาภิเษกวิทยาลัย กระบี่ • ระบบข้อมูลรายภาคเรียน/ปี';
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

  function switchMode(mode) {
    state.mode = mode;
    const btnTeacher = $('btn-mode-teacher');
    const btnAdmin = $('btn-mode-admin');
    if (mode === 'teacher') {
      btnTeacher.className = 'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all bg-gradient-to-r from-amber-400 to-amber-300 text-slate-950 shadow';
      btnAdmin.className = 'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-slate-200 hover:text-white';
    } else {
      btnAdmin.className = 'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all bg-gradient-to-r from-amber-400 to-amber-300 text-slate-950 shadow';
      btnTeacher.className = 'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-slate-200 hover:text-white';
    }
    renderActiveModeView();
  }

  function renderActiveModeView() {
    $('view-teacher-login').classList.add('hidden');
    $('view-teacher-dashboard').classList.add('hidden');
    $('view-admin-login').classList.add('hidden');
    $('view-admin-dashboard').classList.add('hidden');

    if (state.mode === 'teacher') {
      if (state.currentTeacher) {
        $('view-teacher-dashboard').classList.remove('hidden');
        renderTeacherDashboard();
      } else {
        $('view-teacher-login').classList.remove('hidden');
        renderTeacherLoginView();
      }
    } else {
      if (state.adminSessionHash && state.adminSessionHash === state.settings.adminPinHash) {
        $('view-admin-dashboard').classList.remove('hidden');
        renderAdminDashboard();
      } else {
        $('view-admin-login').classList.remove('hidden');
      }
    }
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

    // ดึงข้อมูลสดจาก Google Sheets (รองรับทุกภาคเรียน/ปีที่แอดมินเปิดให้ดู)
    if (hasGasEndpoint()) {
      const res = await callGasApi('getTeacherAttendance', {
        cid: normalized || undefined,
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
        const termsPayload = Array.isArray(res.terms) && res.terms.length
          ? res.terms
          : (res.record ? [{
              termId: state.terms[0] ? state.terms[0].termId : '0',
              termName: state.terms[0] ? state.terms[0].termName : 'ข้อมูลลงเวลา',
              months: res.months || state.months,
              record: res.record
            }] : []);
        setAuthenticatedTeacher(person, termsPayload, { cidHash: res.cidHash || cidHash }, isRemembered);
        if (!silent) toast(`ยินดีต้อนรับ ${person.name}`);
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
    setAuthenticatedTeacher(person, fallbackTerm, { cidHash }, isRemembered);
    if (!silent) toast(`ยินดีต้อนรับ ${person.name}`);
  }

  function setAuthenticatedTeacher(person, teacherTerms, authHashes, remember) {
    state.currentTeacher = {
      key: person.key,
      coreName: person.coreName || stripNamePrefix(person.name),
      seq: person.seq,
      name: person.name,
      position: person.position,
      group: person.group,
      department: person.department || person.group,
      avatarUrl: person.avatarUrl || '',
      terms: teacherTerms || []
    };
    state.teacherAuthSession = {
      staffKey: person.key,
      coreName: state.currentTeacher.coreName,
      cidHash: authHashes.cidHash
    };

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
    sessionStorage.removeItem(SS_TEACHER_AUTH_KEY);
    localStorage.removeItem(LS_TEACHER_AUTH_KEY);
    const cidInp = $('teacher-cid-input');
    if (cidInp) cidInp.value = '';
    renderActiveModeView();
  }

  // -------------------- 9. TEACHER DASHBOARD RENDERING --------------------
  function renderTeacherDashboard() {
    const t = state.currentTeacher;
    if (!t) return;

    // Avatar
    const av = $('td-avatar');
    if (t.avatarUrl) {
      av.innerHTML = `<img src="${esc(t.avatarUrl)}" alt="${esc(t.name)}" class="w-full h-full object-cover" onerror="this.remove()">`;
    } else {
      const initial = (t.name || '?').replace(/^(นาย|นางสาว|นาง|ว่าที่\s*ร\.?ต\.?\s*หญิง|ว่าที่\s*ร\.?ต\.?)\s*/, '').charAt(0) || '?';
      av.textContent = initial;
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

  function renderCalendarForContainer(record, activeMonthId, availableMonths, titleEl, switcherEl, gridEl, legendEl, onSwitchMonth, allTermMonths = null) {
    const searchPool = allTermMonths || state.months;
    const mMeta = searchPool.find(m => m.id === activeMonthId) || availableMonths[0];
    if (!mMeta) return;

    titleEl.textContent = `ปฏิทินการลงเวลา: เดือน${mMeta.label}`;
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
      const meta = getCodeMeta(displayCode);

      const cellBg = displayCode
        ? meta.badgeCls
        : (isWeekend ? 'bg-slate-100/80 text-slate-400 border-slate-200/70' : 'bg-white text-slate-400 border-slate-200');

      const badgeLabel = isMergeCont ? `↳ ${meta.short}` : (meta.short || (isWeekend ? 'หยุด' : '-'));
      const tooltipText = isMergeCont
        ? `วันที่ ${day} ${mMeta.label}: ต่อเนื่องจากการลา (${mergeSourceCode}) — ${meta.label}`
        : `วันที่ ${day} ${mMeta.label}: ${meta.label}`;

      html += `
        <button
          type="button"
          data-day="${day}"
          data-tip="${esc(tooltipText)}"
          class="cal-day-btn h-14 sm:h-16 rounded-xl border p-1.5 flex flex-col justify-between items-start text-left transition hover:scale-[1.03] hover:shadow-md ${cellBg} ${isMergeCont ? 'opacity-80 border-dashed' : ''}"
        >
          <span class="text-[11px] font-bold leading-none ${isWeekend && !displayCode ? 'text-rose-400' : ''}">${day}</span>
          <span class="w-full text-center text-[11px] sm:text-xs font-extrabold truncate">${displayCode ? esc(badgeLabel) : (isWeekend ? '<span class="text-[9px] font-normal">หยุด</span>' : '')}</span>
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
      legendEl.innerHTML = CODE_LEGEND.map(item => `
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
    $('td-print-area').innerHTML = `
      <div class="border-b-2 border-black pb-3 mb-4 flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold">รายงานสรุปข้อมูลวันลาและการลงเวลาปฏิบัติราชการ (${esc(termName || 'ภาคเรียน')})</h1>
          <p class="text-sm">โรงเรียนกาญจนาภิเษกวิทยาลัย กระบี่ • สำนักงานเขตพื้นที่การศึกษามัธยมศึกษาตรัง กระบี่</p>
        </div>
        <div class="text-right text-xs">
          <p>พิมพ์เมื่อ: ${esc(nowStr)}</p>
          <p>เดือนที่เปิดแสดงผล: ${openMonths.length} เดือน</p>
        </div>
      </div>

      <div class="mb-4 p-3 border border-slate-400 rounded text-sm grid grid-cols-2 gap-2">
        <div><strong>ชื่อ-สกุล:</strong> ${esc(record.name)}</div>
        <div><strong>ตำแหน่ง:</strong> ${esc(record.position)}</div>
        <div><strong>กลุ่มบุคลากร:</strong> ${esc(record.group)}</div>
        <div><strong>กลุ่มสาระฯ / ฝ่าย:</strong> ${esc(record.department || '-')}</div>
      </div>

      <table class="w-full border-collapse border border-slate-500 text-xs mb-5">
        <thead>
          <tr class="bg-slate-200">
            <th class="border border-slate-500 p-2 text-left">เดือน</th>
            <th class="border border-slate-500 p-2 text-center">มาปกติ</th>
            <th class="border border-slate-500 p-2 text-center">ราชการ</th>
            <th class="border border-slate-500 p-2 text-center">ลากิจ (ครั้ง/วัน)</th>
            <th class="border border-slate-500 p-2 text-center">ลาป่วย (ครั้ง/วัน)</th>
            <th class="border border-slate-500 p-2 text-center">ลาคลอด/บวช/ภริยา</th>
            <th class="border border-slate-500 p-2 text-center">รวมวันลา</th>
            <th class="border border-slate-500 p-2 text-center">ไม่สแกนเข้า</th>
            <th class="border border-slate-500 p-2 text-center">ไม่สแกนออก</th>
            <th class="border border-slate-500 p-2 text-center">สาย</th>
            <th class="border border-slate-500 p-2 text-center">ขาด</th>
            <th class="border border-slate-500 p-2 text-center">ขอออก</th>
          </tr>
        </thead>
        <tbody>
          ${openMonths.map(m => {
            const s = calcMonthStats(record.months[m.id]);
            return `
              <tr>
                <td class="border border-slate-500 p-1.5 font-semibold">${esc(m.label)}</td>
                <td class="border border-slate-500 p-1.5 text-center">${s.present}</td>
                <td class="border border-slate-500 p-1.5 text-center">${s.duty}</td>
                <td class="border border-slate-500 p-1.5 text-center">${s.personalCount} / ${formatNumber(s.personalDays)}</td>
                <td class="border border-slate-500 p-1.5 text-center">${s.sickCount} / ${formatNumber(s.sickDays)}</td>
                <td class="border border-slate-500 p-1.5 text-center">${s.otherLeaveCount} / ${formatNumber(s.otherLeaveDays)}</td>
                <td class="border border-slate-500 p-1.5 text-center font-bold">${s.totalLeaveCount} / ${formatNumber(s.totalLeaveDays)}</td>
                <td class="border border-slate-500 p-1.5 text-center">${s.noIn}</td>
                <td class="border border-slate-500 p-1.5 text-center">${s.noOut}</td>
                <td class="border border-slate-500 p-1.5 text-center">${s.late}</td>
                <td class="border border-slate-500 p-1.5 text-center">${s.absent}</td>
                <td class="border border-slate-500 p-1.5 text-center">${s.earlyOut}</td>
              </tr>
            `;
          }).join('')}
          <tr class="bg-slate-100 font-bold">
            <td class="border border-slate-500 p-1.5">รวมสุทธิ (${openMonths.length} เดือนที่เปิด)</td>
            <td class="border border-slate-500 p-1.5 text-center">${tot.present}</td>
            <td class="border border-slate-500 p-1.5 text-center">${tot.duty}</td>
            <td class="border border-slate-500 p-1.5 text-center">${tot.personalCount} / ${formatNumber(tot.personalDays)}</td>
            <td class="border border-slate-500 p-1.5 text-center">${tot.sickCount} / ${formatNumber(tot.sickDays)}</td>
            <td class="border border-slate-500 p-1.5 text-center">${tot.otherLeaveCount} / ${formatNumber(tot.otherLeaveDays)}</td>
            <td class="border border-slate-500 p-1.5 text-center">${tot.totalLeaveCount} / ${formatNumber(tot.totalLeaveDays)}</td>
            <td class="border border-slate-500 p-1.5 text-center">${tot.noIn}</td>
            <td class="border border-slate-500 p-1.5 text-center">${tot.noOut}</td>
            <td class="border border-slate-500 p-1.5 text-center">${tot.late}</td>
            <td class="border border-slate-500 p-1.5 text-center">${tot.absent}</td>
            <td class="border border-slate-500 p-1.5 text-center">${tot.earlyOut}</td>
          </tr>
        </tbody>
      </table>
      <p class="text-xs text-slate-600">* เอกสารนี้สร้างจากระบบสรุปวันลาและการลงเวลาปฏิบัติราชการ กลุ่มบริหารงานบุคคล โรงเรียนกาญจนาภิเษกวิทยาลัย กระบี่</p>
    `;
  }

  // -------------------- 10. ADMIN AUTH & CONTROL PANEL --------------------
  async function loginAdmin(pin) {
    const hash = sha256Hex('kbs-att-admin:' + String(pin || '').trim());
    if (hasGasEndpoint()) {
      try {
        state.adminSessionHash = hash;
        await loadAdminRecords(false);
        sessionStorage.setItem(SS_ADMIN_HASH_KEY, hash);
        renderActiveModeView();
        return;
      } catch (err) {
        state.adminSessionHash = null;
        if (String(err.message || '').includes('ไม่ถูกต้อง')) {
          throw err;
        }
      }
    }
    if (hash !== state.settings.adminPinHash) {
      throw new Error('รหัส PIN ผู้ดูแลระบบไม่ถูกต้อง');
    }
    state.adminSessionHash = hash;
    sessionStorage.setItem(SS_ADMIN_HASH_KEY, hash);
    await loadAdminRecords(false);
    renderActiveModeView();
  }

  function getAdminTermObj() {
    return state.terms.find(t => t.termId === state.adminSelectedTermId) || state.terms[state.terms.length - 1] || state.terms[0];
  }

  async function loadAdminRecords(forceRefresh = false, requestedTermId = null) {
    const targetTermId = requestedTermId || state.adminSelectedTermId || '';
    if (hasGasEndpoint() && state.adminSessionHash) {
      try {
        const res = await callGasApi('getAdminAllData', {
          adminPinHash: state.adminSessionHash,
          termId: targetTermId || undefined,
          forceRefresh
        });
        if (Array.isArray(res.terms) && res.terms.length) {
          state.terms = res.terms;
        }
        if (res.activeTermId) {
          state.adminSelectedTermId = res.activeTermId;
        }
        if (Array.isArray(res.records)) {
          const mapped = res.records.map(r => {
            const seed = seedMap.get(r.key);
            return {
              ...r,
              department: (seed && seed.department) || (r.group === 'ลูกจ้างห้องเรียนกีฬา' ? 'ห้องเรียนกีฬา' : 'เจ้าหน้าที่ / อื่นๆ')
            };
          });
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
        if (forceRefresh || String(err.message || '').includes('ไม่ถูกต้อง')) throw err;
      }
    }
    if (!state.adminRecords && fallbackData && Array.isArray(fallbackData.records)) {
      state.adminRecords = fallbackData.records;
      state.adminRecordsByTerm['0'] = fallbackData.records;
    }
  }

  function logoutAdmin() {
    state.adminSessionHash = null;
    state.adminRecords = null;
    sessionStorage.removeItem(SS_ADMIN_HASH_KEY);
    switchMode('teacher');
  }

  function switchAdminTab(tabName) {
    state.adTab = tabName;
    document.querySelectorAll('.ad-tab-btn').forEach(btn => {
      const t = btn.getAttribute('data-ad-tab');
      if (t === tabName) {
        btn.className = 'ad-tab-btn px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap bg-white text-kbs-navy shadow flex items-center gap-1.5';
      } else {
        btn.className = 'ad-tab-btn px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap bg-white/10 text-white hover:bg-white/20 flex items-center gap-1.5';
      }
    });
    ['months', 'overview', 'pins', 'requests', 'settings'].forEach(p => {
      const panel = $(`ad-panel-${p}`);
      if (panel) panel.classList.toggle('hidden', p !== tabName);
    });
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
              class="term-switch-btn relative inline-flex h-7 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${isOpen ? 'bg-emerald-500' : 'bg-slate-300'}"
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
      btn.addEventListener('click', async () => {
        const tId = btn.getAttribute('data-toggle-term');
        const nextTerms = { ...(state.settings.visibleTerms || {}) };
        nextTerms[tId] = !isTermVisible(tId);
        btn.disabled = true;
        try {
          await saveSettingsToCloud({ visibleTerms: nextTerms });
          const tObj = state.terms.find(x => x.termId === tId);
          toast(`${nextTerms[tId] ? 'เปิดทั้งภาคเรียน/ปี' : 'ปิดทั้งภาคเรียน/ปี'} "${tObj ? tObj.termName : tId}" แล้ว`);
          renderAllActiveViews();
        } catch (err) {
          toast('บันทึกไม่สำเร็จ: ' + err.message, 'error');
        } finally {
          btn.disabled = false;
        }
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
              class="month-switch-btn relative inline-flex h-7 w-13 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${isOpen ? 'bg-emerald-500' : 'bg-slate-300'}"
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
      btn.addEventListener('click', async () => {
        const mId = btn.getAttribute('data-toggle-month');
        const scopedKey = `${selectedTerm.termId}::${mId}`;
        const nextVis = { ...(state.settings.visibleMonths || {}) };
        nextVis[scopedKey] = !isMonthVisible(selectedTerm.termId, mId);
        btn.disabled = true;
        try {
          await saveSettingsToCloud({ visibleMonths: nextVis });
          const mObj = termMonths.find(x => x.id === mId);
          toast(`${nextVis[scopedKey] ? 'เปิดให้ครูดู' : 'ปิดการมองเห็น'} เดือน${mObj ? mObj.label : mId} แล้ว`);
          renderAllActiveViews();
        } catch (err) {
          toast('บันทึกไม่สำเร็จ: ' + err.message, 'error');
        } finally {
          btn.disabled = false;
        }
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
    `;
    if ([...scopeEl.options].some(o => o.value === prevScope)) scopeEl.value = prevScope;

    // Populate departments
    const deptEl = $('ad-dept-filter');
    const prevDept = deptEl.value || 'all';
    const depts = [...new Set(records.map(r => r.department || (seedMap.get(r.key) && seedMap.get(r.key).department) || 'อื่นๆ'))];
    deptEl.innerHTML = `<option value="all">ทุกกลุ่มสาระฯ / ฝ่าย</option>` + depts.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('');
    if ([...deptEl.options].some(o => o.value === prevDept)) deptEl.value = prevDept;

    const scopeVal = scopeEl.value;
    let monthIds = [];
    if (scopeVal === 'visible') monthIds = openMonthsInTerm.map(m => m.id);
    else if (scopeVal === 'all') monthIds = termMonths.map(m => m.id);
    else monthIds = [scopeVal];

    const groupVal = $('ad-group-filter').value;
    const deptVal = deptEl.value;
    const q = ($('ad-search-staff-input').value || '').trim().toLowerCase();

    const filtered = records.filter(r => {
      const dept = r.department || (seedMap.get(r.key) && seedMap.get(r.key).department) || 'อื่นๆ';
      if (groupVal !== 'all' && r.group !== groupVal) return false;
      if (deptVal !== 'all' && dept !== deptVal) return false;
      if (q && !r.name.toLowerCase().includes(q) && !(r.position || '').toLowerCase().includes(q)) return false;
      return true;
    });

    // Aggregate school KPIs
    let totalPresent = 0, totalDuty = 0, totalLeaveDays = 0, totalLeaveCount = 0;
    let totalLate = 0, totalNoIn = 0, totalNoOut = 0, totalAbsent = 0, totalEarlyOut = 0;
    const computedRows = filtered.map(r => {
      const st = sumStats(r, monthIds);
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
        <p class="text-[11px] text-slate-500 mt-1.5">ขอบเขต ${monthIds.length} เดือน</p>
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
          <div class="text-[11px] text-slate-500">${esc(record.position)} <span class="text-slate-400">• ${esc(record.group)}</span></div>
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
    renderAdminOverviewCharts(filtered, computedRows, monthIds, termMonths);
  }

  function renderAdminOverviewCharts(filteredRecords, computedRows, selectedMonthIds, termMonths) {
    const monthlyCanvas = $('ad-chart-monthly');
    const issuesCanvas = $('ad-chart-issues');
    if (state.charts.adMonthly) state.charts.adMonthly.destroy();
    if (state.charts.adIssues) state.charts.adIssues.destroy();

    const activeMonths = (termMonths || state.months).filter(m => m.hasData || selectedMonthIds.includes(m.id));
    const labels = activeMonths.map(m => m.shortLabel);
    const lateData = activeMonths.map(m => filteredRecords.reduce((acc, r) => acc + calcMonthStats(r.months[m.id]).late, 0));
    const noScanData = activeMonths.map(m => filteredRecords.reduce((acc, r) => {
      const s = calcMonthStats(r.months[m.id]);
      return acc + s.noIn + s.noOut;
    }, 0));
    const leaveData = activeMonths.map(m => filteredRecords.reduce((acc, r) => acc + calcMonthStats(r.months[m.id]).totalLeaveDays, 0));

    state.charts.adMonthly = new Chart(monthlyCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'มาสาย (ครั้ง)', data: lateData, backgroundColor: '#f59e0b', borderRadius: 5 },
          { label: 'ไม่สแกนเข้า/ออก (ครั้ง)', data: noScanData, backgroundColor: '#6366f1', borderRadius: 5 },
          { label: 'วันลาสะสม (วัน)', data: leaveData, backgroundColor: '#f43f5e', borderRadius: 5 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { font: { family: 'Prompt', size: 11 } } } },
        scales: { y: { beginAtZero: true } }
      }
    });

    const top10 = [...computedRows]
      .map(x => ({
        name: x.record.name.replace(/^(นาย|นางสาว|นาง|ว่าที่\s*ร\.?ต\.?\s*หญิง|ว่าที่\s*ร\.?ต\.?)\s*/, ''),
        score: x.stats.late + x.stats.noIn + x.stats.noOut + x.stats.absent + x.stats.totalLeaveDays
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    state.charts.adIssues = new Chart(issuesCanvas, {
      type: 'bar',
      data: {
        labels: top10.map(x => x.name),
        datasets: [{ label: 'รวมรายการ (วันลา+สาย+ไม่สแกน+ขาด)', data: top10.map(x => x.score), backgroundColor: '#1e3a8a', borderRadius: 5 }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true } }
      }
    });
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
        </div>
      `;
      renderCalendarForContainer(
        rec,
        currentModalMonth,
        termMonths,
        $('modal-cal-title'),
        $('modal-cal-switcher'),
        $('modal-cal-grid'),
        null,
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

  // ---- Admin Tab 3: Staff CID & Access Code Manager ----
  function renderAdminPinsTab() {
    let seedCount = 0, customCount = 0, missingCount = 0;
    const enriched = state.staffCatalog.map(s => {
      const core = s.coreName || stripNamePrefix(s.name);
      const hasCustom = Boolean(state.customPinHashes[s.key] || state.customPinKeysFromGas.has(s.key) || state.customPinCoresFromGas.has(core) || s.hasCustomPin);
      const hasSeed = Boolean(s.hasSeedPin || seedCidCoreSet.has(core) || (seedMap.get(s.key) && seedMap.get(s.key).hasSeedPin));
      let status = 'missing';
      if (hasCustom) { status = 'custom'; customCount++; }
      else if (hasSeed) { status = 'seed'; seedCount++; }
      else { missingCount++; }
      return { ...s, status };
    });

    $('ad-pins-stats').innerHTML = `
      <div class="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200"><div class="text-xs text-emerald-700 font-semibold">มีเลขบัตรประชาชนใน E-Profile</div><div class="text-xl font-bold text-emerald-900 mt-0.5">${seedCount} คน</div></div>
      <div class="p-3.5 rounded-2xl bg-blue-50 border border-blue-200"><div class="text-xs text-blue-700 font-semibold">กำหนดเลขบัตร / รหัสเองแล้ว</div><div class="text-xl font-bold text-blue-900 mt-0.5">${customCount} คน</div></div>
      <div class="p-3.5 rounded-2xl bg-amber-50 border border-amber-200"><div class="text-xs text-amber-800 font-semibold">ยังไม่มีเลขบัตร / รหัสเข้าใช้</div><div class="text-xl font-bold text-amber-950 mt-0.5">${missingCount} คน</div></div>
    `;

    const filter = $('ad-pin-filter-select').value;
    const q = ($('ad-pin-search-input').value || '').trim().toLowerCase();
    const list = enriched.filter(s => {
      if (filter !== 'all' && s.status !== filter) return false;
      if (q && !s.name.toLowerCase().includes(q) && !(s.position || '').toLowerCase().includes(q)) return false;
      return true;
    });

    $('ad-pins-table-body').innerHTML = list.map(s => {
      const badge = s.status === 'custom'
        ? '<span class="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">กำหนดเลขบัตร/รหัสเองแล้ว</span>'
        : (s.status === 'seed'
          ? '<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">เลขบัตรฯ 13 หลัก (E-Profile)</span>'
          : '<span class="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">ยังไม่มีเลขบัตร / รหัส</span>');

      return `
        <tr class="hover:bg-slate-50">
          <td class="px-3 py-2.5 text-slate-500">${s.seq}</td>
          <td class="px-3 py-2.5 font-semibold text-slate-800">${esc(s.name)}</td>
          <td class="px-3 py-2.5 text-slate-500">${esc(s.position)} • ${esc(s.group)}</td>
          <td class="px-3 py-2.5">${badge}</td>
          <td class="px-3 py-2.5 text-right space-x-1.5 whitespace-nowrap">
            <button type="button" data-set-pin="${esc(s.key)}" class="btn-set-staff-pin px-2.5 py-1 rounded-lg bg-kbs-navy hover:bg-kbs-navyDark text-white text-[11px] font-semibold">กำหนดเลขบัตร/รหัส</button>
            ${s.status === 'custom' ? `<button type="button" data-reset-pin="${esc(s.key)}" class="btn-reset-staff-pin px-2 py-1 rounded-lg border border-slate-300 text-slate-600 text-[11px]">ล้างรหัส</button>` : ''}
          </td>
        </tr>
      `;
    }).join('');

    document.querySelectorAll('.btn-set-staff-pin').forEach(btn => {
      btn.addEventListener('click', () => promptSetStaffPin(btn.getAttribute('data-set-pin')));
    });
    document.querySelectorAll('.btn-reset-staff-pin').forEach(btn => {
      btn.addEventListener('click', () => clearStaffCustomPin(btn.getAttribute('data-reset-pin')));
    });
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

    if (hasGasEndpoint() && state.adminSessionHash) {
      await callGasApi('saveStaffPins', {
        adminPinHash: state.adminSessionHash,
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
      if (hasGasEndpoint() && state.adminSessionHash) {
        await callGasApi('saveStaffPins', { adminPinHash: state.adminSessionHash, pins: gasPins });
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
        if (hasGasEndpoint() && state.adminSessionHash) {
          await callGasApi('updateCorrectionStatus', {
            adminPinHash: state.adminSessionHash,
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

  // ---- Admin Tab 5: System Settings ----
  function renderAdminSettingsTab() {
    $('ad-gas-url-input').value = state.settings.gasUrl || '';
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
    const scopeVal = $('ad-scope-select').value;
    let monthIds = [];
    if (scopeVal === 'visible') monthIds = selectedTerm ? getVisibleMonthsList(selectedTerm.termId).map(m => m.id) : [];
    else if (scopeVal === 'all') monthIds = termMonths.map(m => m.id);
    else monthIds = [scopeVal];

    const headers = ['ลำดับ', 'ชื่อ-สกุล', 'ตำแหน่ง', 'กลุ่ม', 'มาปกติ', 'ไปราชการ', 'ลากิจ(ครั้ง)', 'ลากิจ(วัน)', 'ลาป่วย(ครั้ง)', 'ลาป่วย(วัน)', 'ลาอื่นๆ(ครั้ง)', 'ลาอื่นๆ(วัน)', 'รวมลา(ครั้ง)', 'รวมลา(วัน)', 'ไม่สแกนเข้า', 'ไม่สแกนออก', 'สาย', 'ขาดราชการ', 'ขอออก'];
    const lines = [headers.join(',')];
    for (const r of records) {
      const s = sumStats(r, monthIds);
      const row = [
        r.seq, `"${(r.name || '').replace(/"/g, '""')}"`, `"${(r.position || '').replace(/"/g, '""')}"`, `"${(r.group || '').replace(/"/g, '""')}"`,
        s.present, s.duty, s.personalCount, s.personalDays, s.sickCount, s.sickDays, s.otherLeaveCount, s.otherLeaveDays,
        s.totalLeaveCount, s.totalLeaveDays, s.noIn, s.noOut, s.late, s.absent, s.earlyOut
      ];
      lines.push(row.join(','));
    }
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KBS_Attendance_Summary_${scopeVal}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // -------------------- 12. EVENT BINDINGS & INIT --------------------
  function bindEvents() {
    $('btn-mode-teacher').addEventListener('click', () => switchMode('teacher'));
    $('btn-mode-admin').addEventListener('click', () => switchMode('admin'));
    $('btn-back-to-teacher').addEventListener('click', () => switchMode('teacher'));

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

    // Admin login
    $('btn-toggle-admin-pin').addEventListener('click', () => {
      const inp = $('admin-pin-input');
      inp.type = inp.type === 'password' ? 'text' : 'password';
    });
    $('form-admin-login').addEventListener('submit', async e => {
      e.preventDefault();
      const pin = $('admin-pin-input').value;
      const errBox = $('admin-login-error');
      const btn = $('btn-admin-login');
      errBox.classList.add('hidden');
      setButtonLoading(btn, true, 'กำลังเข้าสู่ระบบ...');
      try {
        await loginAdmin(pin);
        $('admin-pin-input').value = '';
      } catch (err) {
        errBox.textContent = err.message;
        errBox.classList.remove('hidden');
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

    // Admin Tab 1 quick month toggles (scoped to selected term)
    $('btn-open-months-with-data').addEventListener('click', async () => {
      const btn = $('btn-open-months-with-data');
      const selectedTerm = getAdminTermObj();
      if (!selectedTerm) return;
      setButtonLoading(btn, true, 'กำลังบันทึก...');
      try {
        const nextVis = { ...(state.settings.visibleMonths || {}) };
        (selectedTerm.months || []).forEach(m => { nextVis[`${selectedTerm.termId}::${m.id}`] = Boolean(m.hasData); });
        await saveSettingsToCloud({ visibleMonths: nextVis });
        toast(`เปิดเฉพาะเดือนที่มีข้อมูลใน ${selectedTerm.termName} แล้ว`);
        renderAllActiveViews();
      } finally { setButtonLoading(btn, false); }
    });

    $('btn-open-all-months').addEventListener('click', async () => {
      const btn = $('btn-open-all-months');
      const selectedTerm = getAdminTermObj();
      if (!selectedTerm) return;
      setButtonLoading(btn, true, 'กำลังบันทึก...');
      try {
        const nextVis = { ...(state.settings.visibleMonths || {}) };
        (selectedTerm.months || []).forEach(m => { nextVis[`${selectedTerm.termId}::${m.id}`] = true; });
        await saveSettingsToCloud({ visibleMonths: nextVis });
        toast(`เปิดทุกเดือนใน ${selectedTerm.termName} แล้ว`);
        renderAllActiveViews();
      } finally { setButtonLoading(btn, false); }
    });

    $('btn-close-all-months').addEventListener('click', async () => {
      const btn = $('btn-close-all-months');
      const selectedTerm = getAdminTermObj();
      if (!selectedTerm) return;
      setButtonLoading(btn, true, 'กำลังบันทึก...');
      try {
        const nextVis = { ...(state.settings.visibleMonths || {}) };
        (selectedTerm.months || []).forEach(m => { nextVis[`${selectedTerm.termId}::${m.id}`] = false; });
        await saveSettingsToCloud({ visibleMonths: nextVis });
        toast(`ปิดทุกเดือนใน ${selectedTerm.termName} แล้ว`);
        renderAllActiveViews();
      } finally { setButtonLoading(btn, false); }
    });

    $('btn-save-announcement').addEventListener('click', async () => {
      const btn = $('btn-save-announcement');
      const txt = $('ad-announcement-input').value.trim();
      setButtonLoading(btn, true, 'กำลังบันทึก...');
      try {
        await saveSettingsToCloud({ announcement: txt });
        toast('บันทึกข้อความประกาศเรียบร้อยแล้ว');
        renderAllActiveViews();
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
    ['ad-scope-select', 'ad-group-filter', 'ad-dept-filter'].forEach(id => {
      $(id).addEventListener('change', renderAdminOverviewTab);
    });
    $('ad-search-staff-input').addEventListener('input', renderAdminOverviewTab);
    $('btn-ad-export-csv').addEventListener('click', exportAdminCsv);
    $('btn-ad-print-all').addEventListener('click', () => window.print());
    $('btn-close-staff-modal').addEventListener('click', () => $('modal-staff-detail').classList.add('hidden'));
    $('modal-staff-detail').addEventListener('click', e => {
      if (e.target === $('modal-staff-detail')) $('modal-staff-detail').classList.add('hidden');
    });
    $('modal-correction-request').addEventListener('click', e => {
      if (e.target === $('modal-correction-request')) $('modal-correction-request').classList.add('hidden');
    });

    // Admin Tab 3 PINs
    $('ad-pin-filter-select').addEventListener('change', renderAdminPinsTab);
    $('ad-pin-search-input').addEventListener('input', renderAdminPinsTab);
    $('btn-batch-assign-missing-pins').addEventListener('click', batchAssignMissingPins);

    // Admin Tab 5 Settings
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

    $('btn-change-admin-pin').addEventListener('click', async () => {
      const p1 = $('ad-new-pin-input').value.trim();
      const p2 = $('ad-confirm-pin-input').value.trim();
      if (p1.length < 4) { toast('รหัส PIN ใหม่ต้องมีอย่างน้อย 4 ตัวอักษร', 'warning'); return; }
      if (p1 !== p2) { toast('รหัส PIN ยืนยันไม่ตรงกัน', 'error'); return; }
      const btn = $('btn-change-admin-pin');
      setButtonLoading(btn, true, 'กำลังเปลี่ยน PIN...');
      try {
        const newHash = sha256Hex('kbs-att-admin:' + p1);
        await saveSettingsToCloud({ adminPinHash: newHash });
        state.adminSessionHash = newHash;
        sessionStorage.setItem(SS_ADMIN_HASH_KEY, newHash);
        $('ad-new-pin-input').value = '';
        $('ad-confirm-pin-input').value = '';
        toast('เปลี่ยนรหัส PIN แอดมินเรียบร้อยแล้ว');
      } finally {
        setButtonLoading(btn, false);
      }
    });
  }

  // -------------------- 13. BOOTSTRAP --------------------
  async function boot() {
    $('header-logo-img').src = createDefaultKvkEmblemDataUri();
    loadSettingsLocal();
    bindEvents();

    // ลองเชื่อมต่อ Google Sheets ผ่าน /api/gas (Vercel) หรือ config.js ทันทีที่เปิดหน้า
    await refreshPublicCatalogFromGas(false);

    // Restore teacher session if saved
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

    // Restore admin session if active in this tab
    const savedAdminHash = sessionStorage.getItem(SS_ADMIN_HASH_KEY);
    if (savedAdminHash) {
      state.adminSessionHash = savedAdminHash;
      try {
        await loadAdminRecords(false);
      } catch (e) {
        if (savedAdminHash !== state.settings.adminPinHash) {
          state.adminSessionHash = null;
          sessionStorage.removeItem(SS_ADMIN_HASH_KEY);
        }
      }
    }

    updateSyncBadge();
    renderActiveModeView();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
