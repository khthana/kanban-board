# Domain Glossary

Use these terms consistently in code and discussion.

- **Board** — workspace ที่มี User หนึ่งคนเป็น owner ภายในมี Column และ Label และมี Member
- **Column** — stage ของ workflow ที่เรียงลำดับภายใน Board (เช่น To Do) ภายในมี Card
- **Card** — งานหนึ่งชิ้นภายใน Column มี title, description (optional), assignee, due date, labels และ `position`
- **Member** — User ที่เข้าถึง Board ได้ role เป็น **owner** (ผู้สร้าง — ลบ board / จัดการสมาชิกได้) หรือ **member** (CRUD column/card ได้ทั้งหมด แต่ลบ board ไม่ได้)
- **Assignee** — Member คนเดียวที่รับผิดชอบ Card (คนละความหมายกับผู้สร้าง card)
- **Position** — ค่า ordering แบบ fractional float แทรกระหว่าง A(1.0) กับ B(2.0) ได้ 1.5 ไม่ใช่ index ต่อเนื่อง
- **Current User** — ในโหมด mock คือ identity ที่เลือกผ่าน user-switcher ใช้เป็น "เราเป็นใคร" ในการตรวจ auth/authz
- **Overdue** — Card ที่ due date เลยวันปัจจุบันไปแล้ว
