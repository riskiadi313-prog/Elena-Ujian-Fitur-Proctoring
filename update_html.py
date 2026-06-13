import os
import glob

files = glob.glob('*.html')
replacement = """  <!-- Firebase Compat SDK -->
  <script src="https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore-compat.js"></script>
  <!-- Firebase Config -->
  <script src="js/firebase-config.js"></script>
  <script src="js/app.js"></script>"""

for f in files:
    with open(f, 'r') as file:
        content = file.read()
    
    if "firebase-app-compat" not in content:
        if '  <script src="js/app.js"></script>' in content:
            content = content.replace('  <script src="js/app.js"></script>', replacement)
        elif '<script src="js/app.js"></script>' in content:
            content = content.replace('<script src="js/app.js"></script>', replacement)
        
        with open(f, 'w') as file:
            file.write(content)
        print(f"Updated {f}")
