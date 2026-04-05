from app import create_app, db
import os
from dotenv import load_dotenv

load_dotenv()

app = create_app()

if __name__ == '__main__':
    print('Central Auth Server starting on http://127.0.0.1:5000')
    # Run server - Database seeding is now handled exclusively by the app factory (create_app)
    app.run(host='0.0.0.0', port=5000, debug=True)
