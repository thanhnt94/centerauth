import asyncio
import sys
import os
import json

# Ensure CentralAuth is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.db import SessionLocal, engine, Base
from app.modules.clients.models import Client
from app.modules.queue.models import TelegramMessageTemplate
import app.modules.identity.models
import app.modules.admin.models
from sqlalchemy import select

async def main():
    print("[+] Connecting to CentralAuth database...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as db:
        telegram_settings_template = json.dumps({
            "reminder_time": {"type": "time", "default": "08:00", "label": "Giờ thông báo công việc buổi sáng"},
            "wrapup_time": {"type": "time", "default": "21:00", "label": "Giờ tổng kết năng suất buổi tối"},
            "is_active": {"type": "boolean", "default": True, "label": "Bật thông báo nhắc nhở công việc & thói quen"},
            "focus_summary_enabled": {"type": "boolean", "default": True, "label": "Báo cáo tổng kết thời gian Pomodoro tập trung"}
        })

        client_ids = ["timehack-v1", "timehack"]
        for cid in client_ids:
            client_res = await db.execute(select(Client).where(Client.client_id == cid))
            timehack_client = client_res.scalar_one_or_none()

            if not timehack_client:
                print(f"[+] Registering TimeHack client '{cid}' in CentralAuth...")
                timehack_client = Client(
                    name="TimeHack",
                    client_id=cid,
                    client_secret="timehack_secret_123",
                    app_url="https://time.inmind.site",
                    redirect_uri="https://time.inmind.site/auth-center/callback,http://localhost:5050/auth-center/callback",
                    app_icon="fas fa-hourglass-half",
                    app_description="Hệ thống Quản lý Thời gian, Pomodoro & Thói quen Toàn diện",
                    app_color_theme="violet",
                    is_active=True,
                    is_visible_on_portal=(cid == "timehack-v1" or cid == "timehack"),
                    available_roles="free_user,vip_user,mod,admin,guest",
                    telegram_settings_template=telegram_settings_template
                )
                db.add(timehack_client)
            else:
                print(f"[+] Updating existing TimeHack client '{cid}'...")
                timehack_client.name = "TimeHack"
                timehack_client.client_secret = "timehack_secret_123"
                timehack_client.app_url = "https://time.inmind.site"
                timehack_client.redirect_uri = "https://time.inmind.site/auth-center/callback,http://localhost:5050/auth-center/callback"
                timehack_client.app_icon = "fas fa-hourglass-half"
                timehack_client.app_description = "Hệ thống Quản lý Thời gian, Pomodoro & Thói quen Toàn diện"
                timehack_client.app_color_theme = "violet"
                timehack_client.is_active = True
                timehack_client.telegram_settings_template = telegram_settings_template

        # 2. Seed Telegram Message Templates for TimeHack
        for cid in ["timehack-v1", "timehack"]:
            result = await db.execute(
                select(TelegramMessageTemplate).where(TelegramMessageTemplate.client_id == cid)
            )
            existing = result.scalars().all()
            existing_types = {t.message_type for t in existing}

            timehack_templates = [
                {
                    "client_id": cid,
                    "message_type": "task_reminder",
                    "label": "Nhắc nhở công việc đến hạn",
                    "template_text": "<b>⏰ [TimeHack] Nhắc Nhở Công Việc Đến Hạn</b>\n\n📌 <b>Nhiệm vụ:</b> {task_title}\n⏳ <b>Thời hạn:</b> {due_time}\n\n👉 <a href=\"https://time.inmind.site\">Mở TimeHack để hoàn thành</a>"
                },
                {
                    "client_id": cid,
                    "message_type": "daily_wrapup",
                    "label": "Tổng kết năng suất ngày",
                    "template_text": "<b>📊 [TimeHack] Tổng Kết Năng Suất Ngày Hôm Nay</b>\nChào <b>{username}</b>, dưới đây là kết quả của bạn:\n\n✅ <b>Công việc hoàn thành:</b> {tasks_done}/{tasks_total}\n⚡ <b>Thói quen duy trì:</b> {habits_done}/{habits_total}\n⏱️ <b>Thời gian tập trung:</b> {focus_minutes} phút\n\n👉 <a href=\"https://time.inmind.site\">Xem biểu đồ chi tiết</a>"
                },
                {
                    "client_id": cid,
                    "message_type": "habit_reminder",
                    "label": "Nhắc nhở duy trì thói quen",
                    "template_text": "<b>⚡ [TimeHack] Nhắc Nhở Thói Quen</b>\n\nChào <b>{username}</b>, bạn còn thói quen <b>{habit_title}</b> chưa đánh dấu hoàn thành hôm nay. Hãy tiếp tục giữ chuỗi Streak nhé! 🔥\n\n👉 <a href=\"https://time.inmind.site\">Mở TimeHack ngay</a>"
                }
            ]

            for item in timehack_templates:
                if item["message_type"] not in existing_types:
                    print(f"[+] Creating Telegram template '{item['message_type']}' for {cid}...")
                    tpl = TelegramMessageTemplate(
                        client_id=item["client_id"],
                        message_type=item["message_type"],
                        label=item["label"],
                        template_text=item["template_text"]
                    )
                    db.add(tpl)

        await db.commit()
        print("[+] Successfully registered TimeHack in CentralAuth (Client & Telegram Templates)!")

if __name__ == "__main__":
    asyncio.run(main())
