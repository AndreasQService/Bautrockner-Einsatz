import os
import re

path = r'c:\QTool\src\components\DamageForm.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Look for the closing of the images map description field
# pattern = r'description: newDesc\s*}\s*:\s*i\)\s*\}\)\);\s*}\s*}\s*/>\s*</div>'
pattern = re.compile(r'description:\s*newDesc\s*\}\s*:\s*i\)\s*\}\)\);\s*\}\s*\}\s*/>\s*</div>', re.MULTILINE)

replacement = '''description: newDesc } : i)
                                                                                     }));
                                                                                 }}
                                                                             />
                                                                             <button
                                                                                 type="button"
                                                                                 onClick={() => isRecording === img.preview ? stopRecording() : startRecording(img.preview)}
                                                                                 title={isRecording === img.preview ? "Aufnahme stoppen" : "Spracheingabe starten"}
                                                                                 style={{
                                                                                     border: isRecording === img.preview ? 'none' : '1px solid var(--border)',
                                                                                     backgroundColor: isRecording === img.preview ? '#EF4444' : 'var(--text-main)',
                                                                                     color: isRecording === img.preview ? 'white' : '#94A3B8',
                                                                                     width: '36px',
                                                                                     height: '36px',
                                                                                     borderRadius: '50%',
                                                                                     cursor: 'pointer',
                                                                                     display: 'flex',
                                                                                     alignItems: 'center',
                                                                                     justifyContent: 'center',
                                                                                     transition: 'all 0.2s',
                                                                                     boxShadow: isRecording === img.preview ? '0 0 0 4px rgba(239, 68, 68, 0.2)' : '0 1px 2px rgba(0,0,0,0.1)',
                                                                                     flexShrink: 0
                                                                                 }}
                                                                             >
                                                                                 <Mic size={20} className={isRecording === img.preview ? 'animate-pulse' : ''} />
                                                                             </button>
                                                                         </div>'''

match = pattern.search(content)
if match:
    new_content = content[:match.start()] + replacement + content[match.end():]
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Success with regex")
else:
    print("Regex failed to find pattern")
