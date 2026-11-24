# Comment — รอบถัดไป (ต้องเสร็จก่อนส่งอาจารย์)

สถานะ: ยังไม่เปิดอ่าน/เขียน รอทีม UI ยืนยันแบบ แม้ไฟล์ Figma ปัจจุบันมี frame `93:92` ชื่อ comment ก็ยังยึดคำขอให้ทำรอบถัดไป

ใช้ `scoreId` จาก Firestore document ID และ `tr.dataset.scoreId` ที่เตรียมไว้ ห้ามใช้ rank, UID หรือคะแนนเป็น ID เพราะเปลี่ยนลำดับ/มีหลายรอบได้

Data contract ที่เสนอ: `scores/{scoreId}/comments/{commentId}` → `{ uid, playerName, text, createdAt }` ความยาว text 1–500, timestamp จาก server, ชื่อเทียบกับ profile, parent score ต้องมีอยู่ สมาชิกอ่านได้ เจ้าของ UID สร้างได้ ในรอบนี้ default deny ทุก action แล้ว

Acceptance ก่อนส่ง:

- คลิกแถวคะแนนหรือกด Enter/Space บนปุ่มเปิดรายละเอียดที่เข้าถึงได้ เปิดรายการ Comment ของ scoreId นั้น
- Like/Love ไม่ส่ง click ต่อไปเปิด Comment โดยไม่ตั้งใจ
- สองบัญชีอ่าน/เขียนข้อความและเห็น real-time เฉพาะคะแนนนั้น
- ปิด modal คืน focus ให้แถวเดิม มี Escape, loading, empty, error และ retry
- ข้อความถูก escape, จำกัดความยาว, UID/name/timestamp และ parent existence ผ่าน Rules
- คะแนน A และ B ไม่แสดงข้อความปนกัน แม้เป็นผู้เล่นเดียวกัน
- เพิ่ม Rules tests: unauthenticated, impersonation, schema pollution, oversize, missing parent
- เพิ่ม browser test สองบัญชีและบันทึกผลใน TEST-REPORT

ยังไม่ถือว่าผ่านเกณฑ์ส่งงานฉบับสุดท้ายจน checklist นี้ผ่าน
