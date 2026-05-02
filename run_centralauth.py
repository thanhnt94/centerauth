from app import create_app, db
import os
from dotenv import load_dotenv

load_dotenv()

app = create_app()

def apply_migrations(app):
    """
    Ecosystem Migration Engine v1.0
    Scans 'database_updates' folder and executes unapplied .sql or .py scripts.
    """
    import os
    from sqlalchemy import text
    
    updates_dir = os.path.join(os.path.dirname(__file__), 'database_updates')
    if not os.path.exists(updates_dir):
        os.makedirs(updates_dir, exist_ok=True)
        return

    with app.app_context():
        # 1. Ensure version tracking table exists
        db.session.execute(text("""
            CREATE TABLE IF NOT EXISTS _schema_versions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                version_name VARCHAR(255) UNIQUE,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        db.session.commit()

        # 2. Get list of applied migrations
        applied = [r[0] for r in db.session.execute(text("SELECT version_name FROM _schema_versions")).fetchall()]
        
        # 3. Scan for new migration files
        files = sorted([f for f in os.listdir(updates_dir) if f.endswith(('.sql', '.py'))])
        
        for filename in files:
            if filename not in applied:
                print(f" [MIGRATION] Applying {filename}...")
                file_path = os.path.join(updates_dir, filename)
                
                try:
                    if filename.endswith('.sql'):
                        with open(file_path, 'r', encoding='utf-8') as f:
                            sql = f.read()
                            # SQLite can only execute one statement at a time via execute(), 
                            # so we split if needed or use executescript via raw connection
                            db.session.execute(text(sql))
                    
                    elif filename.endswith('.py'):
                        # Support for complex migrations via Python scripts
                        import importlib.util
                        spec = importlib.util.spec_from_file_location("module.name", file_path)
                        mod = importlib.util.module_from_spec(spec)
                        spec.loader.exec_module(mod)
                        if hasattr(mod, 'run'):
                            mod.run(app, db)

                    # Mark as applied
                    db.session.execute(text("INSERT INTO _schema_versions (version_name) VALUES (:v)"), {"v": filename})
                    db.session.commit()
                    print(f" [MIGRATION] Success: {filename}")
                    
                except Exception as e:
                    db.session.rollback()
                    print(f" [!] MIGRATION FAILED ({filename}): {e}")
                    # We stop here to prevent inconsistent state
                    break
        
        print(" [SYSTEM] Database is up to date.")

if __name__ == '__main__':
    print('Central Auth Server starting on http://127.0.0.1:5000')
    apply_migrations(app)
    # Run server
    app.run(host='0.0.0.0', port=5000, debug=True)
