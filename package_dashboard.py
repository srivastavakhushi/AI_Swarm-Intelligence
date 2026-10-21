import os
import zipfile

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ZIP_OUTPUT = os.path.join(BASE_DIR, "vessel_crew_dashboard.zip")
STATIC_ZIP = os.path.join(BASE_DIR, "static", "vessel_crew_dashboard.zip")

# Explicit inclusion rules
INCLUDE_FILES = [
    "requirements.txt",
    "README.md",
    "start_dashboard.bat",
    "start_dashboard.sh",
    ".env",
    "users.db",
    "aco_engine.py",
    "ai.py",
    "database.py",
    "fleet_service.py",
    "maritime_environment.py",
    "pathfinding.py",
    "risk_classifier_ai.py",
    "run_prototype.py",
    "workflow_system.py",
    "aco_malacca_prototype.png",
    "ml_risk_prototype.png",
    "route_comparison.png",
]

INCLUDE_DIRS = [
    "app",
    "templates",
    ("static", ["css", "js"]), # only css and js inside static, exclude nested zip
]

def make_archive():
    print(f"Creating {ZIP_OUTPUT}...")
    with zipfile.ZipFile(ZIP_OUTPUT, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zipf:
        # Add root files
        for fname in INCLUDE_FILES:
            fpath = os.path.join(BASE_DIR, fname)
            if os.path.exists(fpath):
                print(f"Adding file: {fname}")
                zipf.write(fpath, arcname=fname)
            else:
                print(f"Warning: {fname} not found!")

        # Add directories
        for item in INCLUDE_DIRS:
            if isinstance(item, tuple):
                dir_name, subdirs = item
                for sub in subdirs:
                    full_sub = os.path.join(BASE_DIR, dir_name, sub)
                    for root, dirs, files in os.walk(full_sub):
                        # Skip pycache
                        dirs[:] = [d for d in dirs if d != "__pycache__"]
                        for f in files:
                            if f.endswith(('.pyc', '.zip')):
                                continue
                            fp = os.path.join(root, f)
                            arc = os.path.relpath(fp, BASE_DIR)
                            print(f"Adding: {arc}")
                            zipf.write(fp, arcname=arc)
            else:
                full_dir = os.path.join(BASE_DIR, item)
                for root, dirs, files in os.walk(full_dir):
                    dirs[:] = [d for d in dirs if d != "__pycache__"]
                    for f in files:
                        if f.endswith(('.pyc', '.zip')):
                            continue
                        fp = os.path.join(root, f)
                        arc = os.path.relpath(fp, BASE_DIR)
                        print(f"Adding: {arc}")
                        zipf.write(fp, arcname=arc)

    # Also copy to static folder so web clients can download it directly
    import shutil
    shutil.copy2(ZIP_OUTPUT, STATIC_ZIP)
    size_mb = os.path.getsize(ZIP_OUTPUT) / (1024 * 1024)
    print(f"\nSuccessfully generated {ZIP_OUTPUT} ({size_mb:.2f} MB)")
    print(f"Copied to {STATIC_ZIP}")

if __name__ == "__main__":
    make_archive()
