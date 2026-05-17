import uvicorn
import os
import sys

# Ensure 'app' can be found
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    print("🚀 Starting CentralAuth FastAPI (Standard MindStack Architecture)...")
    uvicorn.run(
        "app.main:app", 
        host="127.0.0.1", 
        port=5000, 
        reload=True,
        log_level="info"
    )
