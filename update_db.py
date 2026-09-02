import asyncio
import os
import sys

# Ensure CentralAuth is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.db import engine, Base
import app.modules.queue.models
from app.modules.chat.models import AICache
from sqlalchemy import text

async def main():
    print("Connecting to database...")
    async with engine.begin() as conn:
        print("Checking columns in clients table...")
        try:
            res = await conn.execute(text("PRAGMA table_info(clients)"))
            columns = [row[1] for row in res.fetchall()]
            
            if "available_roles" not in columns:
                print("Adding available_roles column to clients...")
                await conn.execute(text("ALTER TABLE clients ADD COLUMN available_roles VARCHAR(500) DEFAULT 'free_user,vip_user,mod,admin,guest'"))
                print("available_roles column added successfully.")
            else:
                print("available_roles column already exists.")

            if "telegram_settings_template" not in columns:
                print("Adding telegram_settings_template column to clients...")
                await conn.execute(text("ALTER TABLE clients ADD COLUMN telegram_settings_template TEXT"))
                print("telegram_settings_template column added successfully.")
            else:
                print("telegram_settings_template column already exists.")
                
        try:
            await conn.execute(text("DELETE FROM clients WHERE client_id = 'timehack'"))
            print("Cleaned up legacy duplicate 'timehack' client record.")
        except Exception as e:
            print(f"Note on duplicate timehack cleanup: {e}")

        print("Checking columns in user_telegram_configs table...")
        try:
            res = await conn.execute(text("PRAGMA table_info(user_telegram_configs)"))
            tg_columns = [row[1] for row in res.fetchall()]
            if "settings" not in tg_columns:
                print("Adding settings column to user_telegram_configs...")
                await conn.execute(text("ALTER TABLE user_telegram_configs ADD COLUMN settings TEXT"))
                print("settings column added successfully.")
            else:
                print("settings column already exists.")
        except Exception as e:
            print(f"Error checking/adding settings column: {e}")
            
        print("Checking columns in media_assets table...")
        try:
            res = await conn.execute(text("PRAGMA table_info(media_assets)"))
            media_columns = [row[1] for row in res.fetchall()]
            if "source_info" not in media_columns:
                print("Adding source_info column to media_assets...")
                await conn.execute(text("ALTER TABLE media_assets ADD COLUMN source_info VARCHAR(512)"))
                print("source_info column added successfully.")
            else:
                print("source_info column already exists.")
        except Exception as e:
            print(f"Error checking/adding source_info column: {e}")
            
        print("Checking columns in ai_caches table...")
        try:
            res = await conn.execute(text("PRAGMA table_info(ai_caches)"))
            cache_columns = [row[1] for row in res.fetchall()]
            if "linked_cards" not in cache_columns:
                print("Adding linked_cards column to ai_caches...")
                await conn.execute(text("ALTER TABLE ai_caches ADD COLUMN linked_cards TEXT DEFAULT '[]'"))
                print("linked_cards column added successfully.")
            else:
                print("linked_cards column already exists.")
        except Exception as e:
            print(f"Error checking/adding linked_cards column: {e}")
            
        print("Checking/creating telegram_message_templates table...")
        try:
            await conn.run_sync(Base.metadata.create_all)
            print("Database tables ensured/created successfully.")
        except Exception as e:
            print(f"Error ensuring tables: {e}")
            
    print("Database updates completed.")

if __name__ == "__main__":
    asyncio.run(main())
