/**
 * ============================================================================
 * การตั้งค่าการเชื่อมต่อระบบ (KBS Attendance Dashboard)
 * ============================================================================
 * หลังจาก Deploy ไฟล์ gas/Code.gs เป็น Google Apps Script Web App แล้ว
 * สามารถนำ URL (/exec) มาวางใน GAS_API_URL ด้านล่าง แล้ว Push ขึ้น GitHub/Vercel
 * หรือตั้งค่าผ่าน Environment Variable ชื่อ GAS_API_URL ใน Vercel Dashboard
 * (หรือกรอกผ่านหน้า "สำหรับแอดมิน > 5. ตั้งค่าเชื่อมต่อ Google Sheets")
 * ============================================================================
 */
window.KBS_ATTENDANCE_CONFIG = {
  GAS_API_URL: 'https://script.google.com/macros/s/AKfycbztBW7aa5PlgBnX6YjGu2PVLCjtw2BGtbxHbLi3DcjtqwwXOscsWoWZqKJZeF93ZDxlaw/exec',
  SPREADSHEET_ID: '1AuOkjvEAy2JTS6DqDt1hUZMlVV6TO1EFcxclfVOfAfs',
  SCHOOL_NAME: 'โรงเรียนกาญจนาภิเษกวิทยาลัย กระบี่',
  TERM_LABEL: 'ภาคเรียนที่ 2/2569',
  PRIMARY_ADMIN_CORES: ['ศรายุทธ พงค์ทองเมือง']
};
