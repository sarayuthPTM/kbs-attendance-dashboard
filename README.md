# ระบบแดชบอร์ดสรุปวันลาและการลงเวลาปฏิบัติราชการ (KBS Attendance Dashboard)

เว็บแอปพลิเคชันสำหรับโรงเรียนกาญจนาภิเษกวิทยาลัย กระบี่ พัฒนาด้วยสถาปัตยกรรม **Vercel + GitHub + Google Sheets** เพื่อให้แอดมินสามารถ **เลือกเปิด-ปิดเดือนที่ครูมองเห็นได้** และเก็บการตั้งค่าทั้งหมดไว้ใน Google Sheets โดยตรง

## โครงสร้างไฟล์

- `index.html` — หน้าเว็บแดชบอร์ด (Tailwind CSS โทนสีกรมท่า-ทอง, ฟอนต์ Prompt + Sarabun, Chart.js, รองรับมือถือและพิมพ์ A4)
- `app.js` — ระบบคำนวณวันลา/มาสาย/สแกนนิ้ว, ปฏิทินรายเดือน, แผงควบคุมแอดมิน และตัวเชื่อม `/api/gas` + Google Sheets
- `config.js` — ค่าเริ่มต้นของระบบ (สามารถใส่ `GAS_API_URL` ที่นี่หรือใช้ Environment Variable บน Vercel)
- `api/gas.js` — Vercel Serverless Function (`/api/gas`) ทำหน้าที่ Proxy เชื่อมต่อ Google Apps Script ป้องกันปัญหา CORS และซ่อน URL ปลายทาง
- `vercel.json` — การตั้งค่า Hosting, Headers และ Rewrites สำหรับ Vercel
- `teacher-auth-seed.js` — รายชื่อบุคลากรทั้ง 133 คน และ SHA-256 Hash สำหรับยืนยันตัวตน (ไม่เก็บเลขบัตรประชาชนดิบ)
- `sheet-fallback.js` — ข้อมูล Snapshot เบื้องต้นจากชีต (ใช้แสดงผลทันทีก่อนเชื่อม GAS URL)
- `gas/Code.gs` & `gas/appsscript.json` — Google Apps Script API เชื่อม Google Sheet `1AuOkjvEAy2JTS6DqDt1hUZMlVV6TO1EFcxclfVOfAfs` (สร้างแท็บ `_Dashboard_Settings`, `_Staff_Pins`, `_Correction_Requests` อัตโนมัติ)

## ขั้นตอนการติดตั้งและใช้งาน (Google Sheets + GitHub + Vercel)

### 1. Deploy Google Apps Script (ฐานข้อมูล Google Sheets)
1. เปิด Google Sheets เป้าหมาย แล้วไปที่ **ส่วนขยาย (Extensions) > Apps Script**
2. นำโค้ดจาก `gas/Code.gs` และ `gas/appsscript.json` ไปวางและบันทึก
3. กด **Deploy > New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
4. คัดลอก Web App URL (`/exec`) เก็บไว้

### 2. อัปโหลดขึ้น GitHub และ Deploy บน Vercel
1. สร้าง Repository ใหม่บน GitHub (เช่น `kbs-attendance-dashboard`)
2. Push โฟลเดอร์นี้ขึ้น GitHub:
   ```bash
   git remote add origin https://github.com/sarayuthPTM/kbs-attendance-dashboard.git
   git push -u origin main
   ```
3. ไปที่ [Vercel](https://vercel.com) > **Add New Project** > เลือก Repository จาก GitHub
4. ในหน้า **Environment Variables** ของ Vercel เพิ่มตัวแปร:
   - Name: `GAS_API_URL`
   - Value: `<วาง Web App URL (/exec) จากขั้นตอนที่ 1>`
5. กด **Deploy**

### 3. การใช้งานฝั่งแอดมิน (`สำหรับแอดมิน` | PIN เริ่มต้น: `123456`)
- **แท็บ 1 (เลือกเปิด-ปิดเดือนให้ครูเห็น):** กดสวิตช์เปิด-ปิดแต่ละเดือน (`ต.ค. 69` – `มี.ค. 70`) ข้อมูลจะถูกบันทึกลงแท็บ `_Dashboard_Settings` ใน Google Sheets ทันที
- **แท็บ 2 (แดชบอร์ดภาพรวมทั้งโรงเรียน):** กรองดูสถิติทั้งหมด คลิกรายชื่อเพื่อดูปฏิทิน หรือ Export CSV
- **แท็บ 3 (จัดการรหัสยืนยันตัวตนครู):** กำหนด PIN 4 หลักให้บุคลากรที่ยังไม่มีเลขบัตรฯ ใน `e-Profile` (32 คน) บันทึกลงแท็บ `_Staff_Pins`
- **แท็บ 4 (คำร้องขอแก้ไข):** ตรวจสอบและจัดการคำร้องจากแท็บ `_Correction_Requests`
- **แท็บ 5 (ตั้งค่า Google Sheets & Vercel):** เปลี่ยน Admin PIN และทดสอบการเชื่อมต่อ `/api/gas`
