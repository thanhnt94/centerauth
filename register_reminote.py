# -*- coding: utf-8 -*-
from app import create_app, db
from app.models.client import Client

app = create_app()

def register_reminote():
    with app.app_context():
        # Check if client already exists
        existing_client = Client.query.filter_by(client_id="reminote-v1").first()
        
        if existing_client:
            print("[INFO] RemiNote client 'reminote-v1' already registered.")
            # Update redirect_uri just in case
            existing_client.redirect_uri = "http://127.0.0.1:5070/auth/sso/callback"
            existing_client.app_icon = "bell"
            existing_client.app_color_theme = "emerald"
            db.session.commit()
            print("[INFO] Updated RemiNote client configuration.")
            return

        # Register new client
        new_client = Client(
            name="RemiNote",
            client_id="reminote-v1",
            client_secret="reminote_secret_xxx",
            redirect_uri="http://127.0.0.1:5070/auth/sso/callback",
            app_icon="bell",
            app_color_theme="emerald",
            is_active=True,
            is_visible_on_portal=True
        )
        
        db.session.add(new_client)
        db.session.commit()
        print("[SUCCESS] Registered RemiNote client successfully.")

if __name__ == "__main__":
    register_reminote()
