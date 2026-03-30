# CentralAuth Ecosystem: Professional Integration Guide (V2 - Secure Flow)

CentralAuth V2 implements a secure **Authorization Code Flow** and **Dual-Token** (Access/Refresh) management system. This guide explains how to integrate your applications.

## 1. Registration
Register your app in the **Admin Dashboard**:
1.  **Client ID**: Unique slug.
2.  **Client Secret**: Private secret key.
3.  **Redirect URI**: The exact URL for the callback (must match exactly).

---

## 2. The SSO Handshake (Authorization Code Flow)

### Step A: Redirect to Login
Redirect the user to the CentralAuth login page with `client_id` and `return_to`:
```
GET http://127.0.0.1:5001/api/auth/login?client_id=YOUR_ID&return_to=YOUR_CALLBACK
```

### Step B: Receive the Code
CentralAuth redirects back with a short-lived `code`:
```
GET YOUR_CALLBACK?code=AUTH_CODE_123
```

### Step C: Exchange Code for Tokens (Server-to-Server)
Your server calls CentralAuth's token endpoint using your `client_secret`:
```python
import requests

response = requests.post(
    "http://127.0.0.1:5001/api/auth/token",
    json={
        "code": "AUTH_CODE_123",
        "client_id": "YOUR_ID",
        "client_secret": "YOUR_SECRET"
    }
)

tokens = response.json()
# Returns: { "access_token": "...", "refresh_token": "...", "expires_in": 3600 }
```

---

## 3. Token Management & Refresh

### Access Token
- Use this in the `Authorization: Bearer <token>` header for all API calls.
- Valid for 1 hour.

### Refresh Token
- Used to obtain a new Access Token when the old one expires.
- Valid for 7 days.
- **Token Rotation**: Every time you refresh, you get a new set of tokens.

```python
response = requests.post(
    "http://127.0.0.1:5001/api/auth/refresh",
    json={"refresh_token": "YOUR_REFRESH_TOKEN"}
)
```

---

## 4. Single Sign-Out (Global Logout)

### Initiating Logout
When a user logs out of your app, they should also call the CentralAuth logout:
```python
requests.post(
    "http://127.0.0.1:5001/api/auth/logout",
    headers={"Authorization": f"Bearer {current_access_token}"}
)
```

### Receiving Global Logout (Webhook)
CentralAuth can notify your app to clear local sessions. Implement a webhook that accepts POST requests from CentralAuth.
*(Implementation details for Webhooks coming in Requirements 3 & 4)*

---
*Created on 2026-03-30*
