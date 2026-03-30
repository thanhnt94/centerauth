import sqlite3
import os

# Database path
CENTRAL_AUTH_DB = r"c:\Code\Ecosystem\Storage\database\CentralAuth.db"

def update_mindstack_callback():
    print(f"Connecting to CentralAuth database: {CENTRAL_AUTH_DB}")
    if not os.path.exists(CENTRAL_AUTH_DB):
        print("Database not found!")
        return

    conn = sqlite3.connect(CENTRAL_AUTH_DB)
    cursor = conn.cursor()

    try:
        # 1. Update redirect_uri for MindStack client
        # The client_id is usually 'mindstack-v3' (as seen in earlier logs)
        new_callback = "http://127.0.0.1:5000/auth-center/callback"
        
        cursor.execute("UPDATE clients SET redirect_uri = ? WHERE client_id = ?", (new_callback, 'mindstack-v3'))
        
        if cursor.rowcount > 0:
            print(f"Successfully updated MindStack callback to: {new_callback}")
        else:
            print("MindStack client not found in database.")

        conn.commit()
    except Exception as e:
        print(f"An error occurred: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    update_mindstack_callback()
