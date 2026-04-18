from app import create_app, db
from app.models.client import Client

def register_podlearn():
    app = create_app()
    with app.app_context():
        client = Client.query.filter_by(client_id='podlearn-v1').first()
        if not client:
            print("Registering PodLearn Client...")
            client = Client(
                name="PodLearn",
                client_id="podlearn-v1",
                client_secret="podlearn_secret_123",
                redirect_uri="http://127.0.0.1:5020/auth-center/callback",
                app_icon="graduation-cap",
                app_color_theme="indigo",
                is_active=True,
                is_visible_on_portal=True
            )
            db.session.add(client)
            db.session.commit()
            print("PodLearn registered successfully.")
        else:
            print("PodLearn already registered. Updating URI/Secret...")
            client.redirect_uri = "http://127.0.0.1:5020/auth-center/callback"
            client.client_secret = "podlearn_secret_123"
            db.session.commit()
            print("PodLearn updated.")

if __name__ == "__main__":
    register_podlearn()
