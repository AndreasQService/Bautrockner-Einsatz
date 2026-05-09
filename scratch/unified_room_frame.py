import os

path = r'c:\QTool\src\components\DamageForm.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Refactor the room mapping to include the shared wrapper
# We target the start of the room mapping
pattern = '''                    {formData.rooms.map(room => (
                        <div key={room.id} className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>'''

replacement = '''                    {formData.rooms.map(room => (
                        <div key={room.id} className="card" style={{ padding: 0, overflow: 'hidden', border: 'none', backgroundColor: 'transparent' }}>
                            <div style={{ 
                                border: mode === 'technician' ? '1px solid var(--border)' : 'none',
                                borderRadius: mode === 'technician' ? '8px' : '0',
                                overflow: 'hidden',
                                maxWidth: mode === 'technician' ? '800px' : 'none',
                                backgroundColor: mode === 'technician' ? 'var(--background)' : 'transparent'
                            }}>'''

if pattern in content:
    content = content.replace(pattern, replacement)
    
    # We also need to add the closing div for our new wrapper
    # It should go before the end of the room mapping
    end_pattern = '''                            </div>
                        </div>
                    ))}'''
    
    end_replacement = '''                                </div>
                            </div>
                        </div>
                    ))}'''
    
    content = content.replace(end_pattern, end_replacement)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success")
else:
    print("Pattern not found")
