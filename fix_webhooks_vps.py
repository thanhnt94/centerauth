import sys
import os
from app import create_app, db
from app.models.client import Client

def fix_webhooks():
    app = create_app()
    with app.app_context():
        clients = Client.query.all()
        for client in clients:
            if client.backchannel_logout_uri and '127.0.0.1' in client.backchannel_logout_uri:
                old_uri = client.backchannel_logout_uri
                
                # Replace logic based on client_id
                if client.client_id == 'mindstack-v3':
                    client.backchannel_logout_uri = 'https://mindstack.click/auth-center/backchannel-logout'
                elif client.client_id == 'iptv-manager':
                    client.backchannel_logout_uri = 'https://iptv.mindstack.click/auth-center/backchannel-logout'
                elif client.client_id == 'podlearn-api':
                    client.backchannel_logout_uri = 'https://podlearn.mindstack.click/auth-center/backchannel-logout'
                
                print(f"Updated {client.client_id}: {old_uri} -> {client.backchannel_logout_uri}")
                
        db.session.commit()
        print("Database updated completely!")

if __name__ == '__main__':
    fix_webhooks()
