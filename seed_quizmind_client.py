import asyncio
import sys
import os
import json

# Ensure CentralAuth is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.db import SessionLocal
from app.modules.clients.models import Client
from app.modules.queue.models import TelegramMessageTemplate
from sqlalchemy import select

async def main():
    print("[+] Connecting to CentralAuth database...")
    async with SessionLocal() as db:
        # 1. Check / Seed Client for QuizMind
        client_res = await db.execute(select(Client).where(Client.client_id == "quizmind"))
        quizmind_client = client_res.scalar_one_or_none()

        telegram_settings_template = json.dumps({
            "reminder_time": {"type": "time", "default": "20:00", "label": "Giờ nhắc làm quiz bài tập"},
            "is_active": {"type": "boolean", "default": True, "label": "Bật nhắc nhở học bài hàng ngày"},
            "streak_guard_enabled": {"type": "boolean", "default": True, "label": "Cảnh báo bảo vệ chuỗi Streak"},
            "weekly_summary_enabled": {"type": "boolean", "default": True, "label": "Báo cáo tóm tắt tiến độ tuần"}
        })

        if not quizmind_client:
            print("[+] Registering QuizMind as authorized SSO client...")
            quizmind_client = Client(
                name="QuizMind",
                client_id="quizmind",
                client_secret="quizmind-secret-key-2026",
                app_url="https://quiz.inmind.site",
                redirect_uri="https://quiz.inmind.site/auth-center/callback,http://localhost:5080/auth-center/callback",
                app_icon="fas fa-brain",
                app_description="Hệ thống trắc nghiệm và lộ trình học tập thông minh",
                app_color_theme="indigo",
                is_active=True,
                is_visible_on_portal=True,
                available_roles="free_user,vip_user,mod,admin,guest",
                telegram_settings_template=telegram_settings_template
            )
            db.add(quizmind_client)
        else:
            print("[+] Updating existing QuizMind client details...")
            quizmind_client.redirect_uri = "https://quiz.inmind.site/auth-center/callback,http://localhost:5080/auth-center/callback"
            quizmind_client.app_url = "https://quiz.inmind.site"
            quizmind_client.is_active = True
            quizmind_client.telegram_settings_template = telegram_settings_template

        # 2. Check / Seed Telegram Message Templates for QuizMind
        result = await db.execute(
            select(TelegramMessageTemplate).where(TelegramMessageTemplate.client_id == "quizmind")
        )
        existing = result.scalars().all()
        existing_types = {t.message_type for t in existing}

        quizmind_templates = [
            {
                "client_id": "quizmind",
                "message_type": "study_reminder",
                "label": "Nhắc nhở làm quiz hàng ngày",
                "template_text": "👋 <b>Xin chào {username}!</b>\n\nHôm nay bạn có mục tiêu hoàn thành lộ trình câu hỏi trắc nghiệm. Hãy dành ra 5 phút để luyện tập giữ vững kiến thức nhé! 🧠\n\n👉 <a href=\"https://quiz.inmind.site\">Nhấn vào đây để làm bài ngay</a>"
            },
            {
                "client_id": "quizmind",
                "message_type": "streak_guard",
                "label": "Cảnh báo đứt Streak",
                "template_text": "⚠️ <b>CẢNH BÁO MẤT STREAK QUIZMIND!</b>\n\n{username} ơi, chuỗi học tập trắc nghiệm của bạn sắp bị đứt! Hãy làm ít nhất 1 bài kiểm tra trước 23:59 hôm nay để bảo vệ streak nhé! 🔥\n\n👉 <a href=\"https://quiz.inmind.site\">Làm Quiz ngay để giữ Streak</a>"
            },
            {
                "client_id": "quizmind",
                "message_type": "weekly_summary",
                "label": "Báo cáo tổng kết tuần",
                "template_text": "📊 <b>BÁO CÁO KẾT QUẢ QUIZMIND TUẦN QUA</b>\n\nChúc mừng {username} đã hoàn thành tuần luyện tập!\n- Số câu hỏi đã hoàn thành: <b>{learned_count}</b> câu\n- Độ chính xác trung bình: <b>{accuracy}%</b>\n- Chuỗi streak hiện tại: <b>{streak}</b> ngày\n\nTiếp tục giữ vững phong độ trong tuần tới nhé! 🚀"
            }
        ]

        for item in quizmind_templates:
            if item["message_type"] not in existing_types:
                print(f"[+] Creating default Telegram template for {item['message_type']}...")
                tpl = TelegramMessageTemplate(
                    client_id=item["client_id"],
                    message_type=item["message_type"],
                    label=item["label"],
                    template_text=item["template_text"]
                )
                db.add(tpl)

        await db.commit()
        print("[+] QuizMind client and Telegram templates successfully registered in CentralAuth!")

if __name__ == "__main__":
    asyncio.run(main())
