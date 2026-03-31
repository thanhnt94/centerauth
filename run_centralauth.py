from app import create_app, db
import os
from dotenv import load_dotenv

load_dotenv()

app = create_app()

if __name__ == '__main__':
    with app.app_context():
        # Ensure the database directory exists
        db_uri = app.config['SQLALCHEMY_DATABASE_URI']
        if db_uri.startswith('sqlite:///'):
            db_path = db_uri.replace('sqlite:///', '')
            # Handle Windows paths (might have extra slash)
            if db_path.startswith('/'):
                # Check if it's a drive letter (e.g., /C:/)
                import re
                if re.match(r'^/[a-zA-Z]:/', db_path):
                    db_path = db_path[1:]
            
            db_dir = os.path.dirname(db_path)
            if db_dir and not os.path.exists(db_dir):
                os.makedirs(db_dir, exist_ok=True)
                print(f'Created database directory: {db_dir}')

        # Ensure the database and tables exist
        db.create_all()
        
        # Seed default admin user
        from app.models.user import User
        admin_user = User.query.filter_by(username='admin').first()
        if not admin_user:
            admin_user = User(
                username='admin',
                email='admin@ecosystem.local',
                full_name='System Admin'
            )
            admin_user.set_password('admin')
            db.session.add(admin_user)
            db.session.commit()
            print('Admin user "admin" with password "admin" has been created.')
        else:
            print('Admin user already exists.')

        print('Database initialized.')
        
    print('Central Auth Server starting on http://127.0.0.1:5000')
    app.run(host='0.0.0.0', port=5000, debug=True)
