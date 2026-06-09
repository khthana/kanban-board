# Domain Glossary

Use these terms consistently in code and discussion.

- **Board** — workspace ที่มี User หนึ่งคนเป็น owner ภายในมี Column และ Label และมี Member
- **Column** — stage ของ workflow ที่เรียงลำดับภายใน Board (เช่น To Do) ภายในมี Card
- **Card** — งานหนึ่งชิ้นภายใน Column มี title, description (optional), assignee(s), due date, labels, category และ `position`
- **Category** — Label ตัวที่ถูกเลือกเป็น "ตัวหลัก" ของ Card (ชี้ด้วย `category_label_id`) แสดงบนหน้าการ์ดเป็นชื่อพิมพ์ใหญ่ + จุดสี Card ยังมี Label อื่น ๆ (many-to-many) ได้ แต่บนหน้าการ์ดโชว์เฉพาะ Category ส่วน Label ที่เหลือจัดการ/ดูได้ใน CardPanel เท่านั้น
- **Card Accent** — สีของ Card ที่ใช้ทาจุด (dot), ตัวอักษร Category และแถบ progress = สีของ Label ที่เป็น Category (ไม่ใช่ field สีแยกต่างหาก) เมื่อ Card ไม่มี Category จะใช้สีกลาง (เทา) — คนละตัวกับ [Column] Accent
- **Member** — User ที่เข้าถึง Board ได้ role เป็น **owner** (ผู้สร้าง — ลบ board / จัดการสมาชิกได้) หรือ **member** (CRUD column/card ได้ทั้งหมด แต่ลบ board ไม่ได้)
- **Assignee** — Member ที่รับผิดชอบ Card มีได้ **หลายคน** (เก็บใน join `card_assignees`) คนละความหมายกับผู้สร้าง card บนหน้าการ์ดแสดงเป็น avatar ซ้อนกัน
- **Position** — ค่า ordering แบบ fractional float แทรกระหว่าง A(1.0) กับ B(2.0) ได้ 1.5 ไม่ใช่ index ต่อเนื่อง
- **Current User** — ในโหมด mock คือ identity ที่เลือกผ่าน user-switcher ใช้เป็น "เราเป็นใคร" ในการตรวจ auth/authz
- **Overdue** — Card ที่ due date เลยวันปัจจุบันไปแล้ว
- **Accent** — สีเดียว (optional) ที่ใช้ "ธีม" ทั้ง Column ไม่ใช่แค่แถบ header: ป้ายชื่อคอลัมน์ (chip), wash สีจางบนพื้นทั้งคอลัมน์, ตัวเลขนับ Card, และปุ่มเพิ่ม Card เมื่อ Column ไม่มี Accent จะใช้สีกลาง (เทา) เป็นค่าเริ่มต้น — แทนความหมายเดิมที่ Accent ทาเฉพาะพื้นหลังแถบ header
