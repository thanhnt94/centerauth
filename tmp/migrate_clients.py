import sqlite3
import os

# Database path
CENTRAL_AUTH_DB = r"c:\Code\Ecosystem\Storage\database\CentralAuth.db"

def migrate_clients():
    print(f"Connecting to CentralAuth database: {CENTRAL_AUTH_DB}")
    if not os.path.exists(CENTRAL_AUTH_DB):
        print("Database not found!")
        return

    conn = sqlite3.connect(CENTRAL_AUTH_DB)
    cursor = conn.cursor()

    try:
        # 1. Check existing columns
        cursor.execute("PRAGMA table_info(clients)")
        columns = [row[1] for row in cursor.fetchall()]
        
        # 2. Add missing columns
        new_columns = [
            ("app_icon", "VARCHAR(50) DEFAULT 'fas fa-rocket'"),
            ("app_description", "VARCHAR(255)"),
            ("app_color_theme", "VARCHAR(50) DEFAULT 'indigo'"),
            ("is_visible_on_portal", "BOOLEAN DEFAULT 1 NOT NULL")
        ]
        
        for col_name, col_type in new_columns:
            if col_name not in columns:
                print(f"Adding '{col_name}' column to 'clients' table...")
                cursor.execute(f"ALTER TABLE clients ADD COLUMN {col_name} {col_type}")
                print(f"Successfully added '{col_name}'.")
            else:
                print(f"'{col_name}' column already exists.")

        conn.commit()
        print("Migration finished successfuly.")
    except Exception as e:
        print(f"An error occurred: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_clients()
