import asyncio
import sys
import os

# Ensure CentralAuth is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.db import SessionLocal
from app.modules.queue.models import TelegramMessageTemplate
from sqlalchemy import select

async def main():
    print("Connecting to database...")
    async with SessionLocal() as db:
        # Check existing templates
        result = await db.execute(select(TelegramMessageTemplate).where(TelegramMessageTemplate.client_id == "vocaburn"))
        existing = result.scalars().all()
        
        # We want to seed: study_reminder, streak_guard, weekly_summary
        default_templates = [
            {
                "client_id": "vocaburn",
                "message_type": "study_reminder",
                "label": "Nhắc nhở học tập hàng ngày",
                "template_text": "👋 <b>Xin chào {username}!</b>\n\nHôm nay bạn có <b>{due_count}</b> từ cần ôn tập. Hãy dành ra 5 phút để hoàn thành mục tiêu học tập nhé! 🚀\n\n👉 <a href=\"http://localhost:5173\">Nhấn vào đây để học ngay</a>"
            },
            {
                "client_id": "vocaburn",
                "message_type": "streak_guard",
                "label": "Cảnh báo đứt Streak",
                "template_text": "⚠️ <b>CẢNH BÁO MẤT STREAK!</b>\n\n{username} ơi, chuỗi học tập của bạn sắp bị đứt rồi! Hãy hoàn thành ít nhất 1 thẻ học trước 23:59 hôm nay để bảo vệ streak nhé! 🔥\n\n👉 <a href=\"http://localhost:5173\">Học ngay để giữ streak</a>"
            },
            {
                "client_id": "vocaburn",
                "message_type": "weekly_summary",
                "label": "Báo cáo tóm tắt tuần",
                "template_text": "📊 <b>BÁO CÁO HỌC TẬP TUẦN QUA</b>\n\nChúc mừng {username} đã hoàn thành tuần học tập!\n- Số từ mới đã học: <b>{learned_count}</b> từ\n- Số thẻ đã ôn tập: <b>{review_count}</b> lượt\n- Chuỗi streak hiện tại: <b>{streak}</b> ngày\n\nCố gắng duy trì phong độ trong tuần tới nhé! 💪"
            }
        ]
        
        existing_types = {t.message_type for t in existing}
        for item in default_templates:
            if item["message_type"] not in existing_types:
                print(f"Creating default template for {item['message_type']}...")
                tpl = TelegramMessageTemplate(
                    client_id=item["client_id"],
                    message_type=item["message_type"],
                    label=item["label"],
                    template_text=item["template_text"]
                )
                db.add(tpl)
                
        await db.commit()
        print("Successfully seeded all default Telegram templates!")

if __name__ == "__main__":
    asyncio.run(main())
