import os

path = r'c:\QTool\src\components\DamageForm.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Look for the absolute smoking gun of the corruption
corruption = '''                                                                                    ...prev,
                                                                                         images: prev.images.map(i => i === img ? { ...i, description: newDesc } : i)
                                                                                     }));
                                                                                 }}'''

clean_fix = '''                                                                                    backgroundColor: isRecording === img.preview ? '#fef2f2' : '#ffffff',
                                                                                    borderColor: isRecording === img.preview ? '#EF4444' : 'var(--border)',
                                                                                    color: '#1e293b'
                                                                                }}
                                                                                rows={2}'''

if corruption in content:
    # We need to find the start of the style block too
    # Let's just do a direct replacement of the corrupted area
    # In the file it was:
    # resize: 'none',
    # ...prev, ...
    # />
    
    # I'll use a more liberal match
    import re
    # Match the corruption including the surrounding lines
    content = content.replace(corruption, "") # Remove the junk
    
    # Now fix the style object that was left open
    content = content.replace("resize: 'none',", clean_fix)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success")
else:
    print("Corruption not found")
