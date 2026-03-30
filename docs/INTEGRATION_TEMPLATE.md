# CentralAuth Integration Template (Flask)

Copy this template to your project to quickly integrate with the Ecosystem SSO.

## 1. Copy the Client Library
Create `services/central_auth_client.py`:

```python
import requests

class CentralAuthClient:
    def __init__(self, api_url, web_url=None):
        self.api_url = api_url.rstrip('/') if api_url else None
        self.web_url = web_url.rstrip('/') if web_url else self.api_url

    def get_login_url(self, callback_url):
        connector = '&' if '?' in self.web_url else '?'
        return f"{self.web_url}/api/auth/login{connector}return_to={callback_url}"

    def check_health(self):
        try:
            response = requests.get(f"{self.api_url}/api/auth/health", timeout=2)
            return response.status_code == 200
        except:
            return False

    def verify_token(self, token):
        try:
            response = requests.get(
                f"{self.api_url}/api/auth/verify-token",
                headers={"Authorization": f"Bearer {token}"},
                timeout=5
            )
            return response.json().get('user') if response.status_code == 200 else None
        except:
            return None
```

## 2. Implement JIT Provisioning
In your `AuthService.py` or equivalent:

```python
def handle_sso_callback(token):
    client = CentralAuthClient(api_url=CONFIG['API_URL'], web_url=CONFIG['WEB_URL'])
    user_payload = client.verify_token(token)
    
    if not user_payload:
        return None
        
    # LOGIC: Check if user exists in YOUR DB, if not, create them (JIT)
    user = User.query.filter_by(central_auth_id=user_payload['id']).first()
    if not user:
        user = User(
            username=user_payload['username'],
            email=user_payload['email'],
            central_auth_id=user_payload['id']
        )
        db.session.add(user)
        db.session.commit()
    return user
```

## 3. Setup Routes
In your `routes.py`:

```python
@app.route('/auth/login')
def login():
    client = CentralAuthClient(api_url=CONFIG['API_URL'])
    if client.check_health():
        return redirect(client.get_login_url(url_for('auth_callback', _external=True)))
    return render_template('login_local.html')

@app.route('/auth/callback')
def auth_callback():
    token = request.args.get('token')
    user = handle_sso_callback(token)
    if user:
        login_user(user)
        return redirect(url_for('dashboard'))
    return "Auth Failed", 401
```
