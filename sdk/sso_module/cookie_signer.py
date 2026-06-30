import hmac
import hashlib
from typing import Optional

def sign_cookie(value: str, secret: str) -> str:
    """Signs a value using HMAC-SHA256 and returns value.signature."""
    if not value:
        return ""
    signature = hmac.new(secret.encode('utf-8'), value.encode('utf-8'), hashlib.sha256).hexdigest()
    return f"{value}.{signature}"

def verify_cookie(signed_value: str, secret: str) -> Optional[str]:
    """Verifies the HMAC-SHA256 signature and returns the original value if valid."""
    if not signed_value or "." not in signed_value:
        return None
    try:
        value, signature = signed_value.rsplit(".", 1)
        expected_signature = hmac.new(secret.encode('utf-8'), value.encode('utf-8'), hashlib.sha256).hexdigest()
        if hmac.compare_digest(signature, expected_signature):
            return value
    except Exception:
        pass
    return None
