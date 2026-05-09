import os
import re

path = r'c:\QTool\src\components\DamageForm.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Target the broken textarea specifically by looking for the corrupted style block
pattern = r'style=\{\{\s+fontSize: \'0.9rem\',\s+padding: \'0.5rem\',\s+flex: 1,\s+width: \'100%\',\s+maxWidth: \'320px\',\s+resize: \'none\',\s+\.\.\.prev,[\s\S]+?\}\s+\}\s+/\>'

replacement = "style={{ fontSize: '0.9rem', padding: '0.5rem', flex: 1, width: '100%', maxWidth: '320px', resize: 'none', backgroundColor: isRecording === img.preview ? '#fef2f2' : '#ffffff', borderColor: isRecording === img.preview ? '#EF4444' : 'var(--border)', color: '#1e293b' }} rows={2} />"

new_content = re.sub(pattern, replacement, content)

if new_content != content:
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Success")
else:
    print("Regex failed to find the broken block")
