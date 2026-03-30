import sqlite3
import os

# Database path
CENTRAL_AUTH_DB = r"c:\Code\Ecosystem\Storage\database\CentralAuth.db"

def fix_admin():
    print(f"Connecting to CentralAuth database: {CENTRAL_AUTH_DB}")
    if not os.path.exists(CENTRAL_AUTH_DB):
        print("Database not found!")
        return

    conn = sqlite3.connect(CENTRAL_AUTH_DB)
    cursor = conn.cursor()

    try:
        # 1. Add is_admin column if missing
        cursor.execute("PRAGMA table_info(users)")
        columns = [row[1] for row in cursor.fetchall()]
        if "is_admin" not in columns:
            print("Adding 'is_admin' column...")
            cursor.execute("ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0 NOT NULL")
        else:
            print("'is_admin' column already exists.")

        # 2. Rename 'admin' to 'thanhnt' and set is_admin=1
        cursor.execute("SELECT id FROM users WHERE username = 'admin'")
        admin_row = cursor.fetchone()
        
        if admin_row:
            print("Found user 'admin'. Renaming to 'thanhnt' and granting admin rights...")
            cursor.execute("UPDATE users SET username = 'thanhnt', is_admin = 1 WHERE username = 'admin'")
        else:
            print("User 'admin' not found. Checking if 'thanhnt' exists...")
            cursor.execute("SELECT id FROM users WHERE username = 'thanhnt'")
            thanhnt_row = cursor.fetchone()
            if thanhnt_row:
                print("Found 'thanhnt'. Granting admin rights...")
                cursor.execute("UPDATE users SET is_admin = 1 WHERE username = 'thanhnt'")
            else:
                print("Warning: Neither 'admin' nor 'thanhnt' found. Check your database.")

        conn.commit()
        print("Migration and data update finished successfuly.")
    except Exception as e:
        print(f"An error occurred: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    fix_admin()
