import os
import subprocess
import sys

def fix_lookbehinds(project_dir):
    """Replaces all positive lookbehinds with non-capturing groups to support older WebKit/iOS versions."""
    assets_dir = os.path.join(project_dir, "app", "static", "dist", "assets")
    if not os.path.exists(assets_dir):
        print(" [!] Assets directory not found for lookbehind fix.")
        return
    
    print(" [VITE] Post-processing assets to remove Regex Lookbehinds...")
    found = False
    for f in os.listdir(assets_dir):
        if f.endswith(".js"):
            path = os.path.join(assets_dir, f)
            try:
                with open(path, "r", encoding="utf-8") as file_obj:
                    content = file_obj.read()
                if "(?<=" in content:
                    print(f"  [+] Replacing lookbehinds in {f}")
                    content = content.replace("(?<=", "(?:")
                    with open(path, "w", encoding="utf-8") as file_obj:
                        file_obj.write(content)
                    found = True
            except Exception as e:
                print(f"  [-] Failed to process {f}: {e}")
    if not found:
        print("  [+] No lookbehinds found in assets.")

def build_frontend():
    """Builds the Vite frontend and outputs it to app/static/dist."""
    project_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.join(project_dir, "central-auth-studio")
    
    if not os.path.exists(frontend_dir):
        print(" [!] Frontend directory not found.")
        return False
        
    print(f" [VITE] Building CentralAuth Frontend at {frontend_dir}...")
    
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    npx_cmd = "npx.cmd" if sys.platform == "win32" else "npx"
    
    try:
        bin_vite = os.path.join(frontend_dir, "node_modules", ".bin", "vite.cmd" if sys.platform == "win32" else "vite")
        if not os.path.exists(bin_vite):
            print(" [VITE] Installing dependencies...")
            subprocess.run([npm_cmd, "install"], cwd=frontend_dir, check=True)
            
        # Run build
        try:
            subprocess.run([npm_cmd, "run", "build"], cwd=frontend_dir, check=True)
        except Exception:
            print(" [VITE] Retrying build with npx vite build...")
            subprocess.run([npx_cmd, "vite", "build"], cwd=frontend_dir, check=True)
        
        # Run lookbehind fix directly
        fix_lookbehinds(project_dir)
        
        print(" [VITE] Build successful!")
        return True
    except subprocess.CalledProcessError as e:
        print(f" [VITE] Build failed: {e}")
        return False
    except FileNotFoundError:
        print(" [!] 'npm' command not found. Is Node.js installed?")
        return False

if __name__ == "__main__":
    success = build_frontend()
    if not success:
        sys.exit(1)
