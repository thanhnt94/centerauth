import requests
try:
    from flask import session, redirect, url_for, request
except ImportError:
    # Support for non-flask environments if needed
    pass

class EcosystemAuth:
    """
    Standardized 'Power Pairing' Helper for Mindstack Satellite Apps.
    Simplifies OAuth2/OIDC flows to a few lines of code.
    """
    def __init__(self, server_url, client_id, client_secret):
        self.server_url = server_url.rstrip('/')
        self.client_id = client_id
        self.client_secret = client_secret

    def get_login_url(self, callback_url):
        """Generates the redirect URL to Central Auth."""
        return f"{self.server_url}/api/auth/login?client_id={self.client_id}&return_to={callback_url}"

    def handle_callback(self, code):
        """Exchanges authorization code for tokens and fetches user info."""
        # 1. Exchange Code for Tokens
        token_url = f"{self.server_url}/api/auth/token"
        payload = {
            "code": code,
            "client_id": self.client_id,
            "client_secret": self.client_secret
        }
        
        try:
            r = requests.post(token_url, json=payload, timeout=5)
            r.raise_for_status()
            tokens = r.json()
            
            # 2. Verify Token and get Profile
            verify_url = f"{self.server_url}/api/auth/verify-token"
            headers = {"Authorization": f"Bearer {tokens['access_token']}"}
            v = requests.get(verify_url, headers=headers, timeout=5)
            v.raise_for_status()
            
            return {
                "success": True,
                "user": v.json().get('user'),
                "tokens": tokens
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_logout_url(self, return_to=None):
        """Initiates Global Logout."""
        url = f"{self.server_url}/api/auth/logout"
        if return_to:
            url += f"?return_to={return_to}"
        return url

# --- USAGE EXAMPLE (Flask) ---
# sso = EcosystemAuth(CENTRAL_AUTH_SERVER, CLIENT_ID, CLIENT_SECRET)
#
# @app.route('/login')
# def login():
#     return redirect(sso.get_login_url(url_for('auth.callback', _external=True)))
#
# @app.route('/callback')
# def callback():
#     code = request.args.get('code')
#     result = sso.handle_callback(code)
#     if result['success']:
#         # Provision user locally...
#         pass
