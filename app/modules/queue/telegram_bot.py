import logging
import asyncio
from telegram import Bot
from telegram.ext import Application, CommandHandler
from sqlalchemy import select
from app.core.db import SessionLocal
from app.modules.admin.models import SystemSetting
from app.modules.queue.models import UserTelegramConfig

logger = logging.getLogger(__name__)

_bot_app = None
bot = None

async def get_bot_token():
    async with SessionLocal(expire_on_commit=False) as db:
        res = await db.execute(select(SystemSetting).where(SystemSetting.key == "telegram_bot_token"))
        setting = res.scalar_one_or_none()
        if setting and setting.value:
            return setting.value.strip()
    return None

async def stop_bot_app():
    global _bot_app, bot
    if _bot_app:
        try:
            if _bot_app.updater:
                await _bot_app.updater.stop()
            await _bot_app.stop()
            await _bot_app.shutdown()
            logger.info("[TelegramBot] Stopped centralized bot.")
        except Exception as e:
            logger.error(f"[TelegramBot] Error stopping bot: {e}")
        finally:
            _bot_app = None
            bot = None

async def handle_start(update, context):
    chat_id = update.effective_chat.id
    text = update.message.text
    
    parts = text.split(" ")
    if len(parts) > 1:
        token = parts[1].strip().upper()
        async with SessionLocal(expire_on_commit=False) as db:
            res = await db.execute(select(UserTelegramConfig).where(UserTelegramConfig.connect_token == token))
            config = res.scalar_one_or_none()
            
            if config:
                config.telegram_chat_id = str(chat_id)
                await db.commit()
                await context.bot.send_message(
                    chat_id=chat_id,
                    text="🎉 <b>Liên kết thành công!</b>\nTừ giờ mình sẽ nhắc nhở bạn học từ vựng mỗi ngày trên các dự án thuộc hệ thống nhé!",
                    parse_mode="HTML"
                )
            else:
                await context.bot.send_message(chat_id=chat_id, text="❌ Mã liên kết không hợp lệ hoặc đã hết hạn.")
    else:
        await context.bot.send_message(
            chat_id=chat_id,
            text="👋 Chào mừng bạn đến với <b>Central Bot</b>!\nVui lòng nhấp vào nút 'Liên kết Telegram' trên trang Cá nhân của các dự án liên kết để bắt đầu.",
            parse_mode="HTML"
        )

async def start_telegram_bot():
    global _bot_app, bot
    if _bot_app:
        await stop_bot_app()

    # Polling wait to ensure database tables are created first
    await asyncio.sleep(5)

    token = await get_bot_token()
    if not token:
        logger.warning("[TelegramBot] Centralized Bot Token not configured. Polling disabled.")
        return None

    try:
        # Delete webhook first to avoid conflicts
        _temp_bot = Bot(token=token)
        await _temp_bot.delete_webhook(drop_pending_updates=True)
        
        app = Application.builder().token(token).build()
        bot = app.bot
        
        app.add_handler(CommandHandler("start", handle_start))
        
        await app.initialize()
        await app.start()
        await app.updater.start_polling(poll_interval=10.0)
        
        _bot_app = app
        logger.info("[TelegramBot] Centralized Bot initialized with POLLING.")
        return app
    except Exception as e:
        logger.error(f"[TelegramBot] Failed to initialize centralized Telegram Bot polling: {e}")
        return None
