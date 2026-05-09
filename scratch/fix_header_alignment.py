import os

path = r'c:\QTool\src\components\DamageForm.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# The specific block to replace
# We use a very targeted string that is unique but contains the structural issue
pattern = '''                            <div style={{
                                background: mode === 'technician' ? 'var(--background)' : 'rgba(255,255,255,0.05)',
                                padding: '1rem 1.25rem',
                                border: mode === 'technician' ? '1px solid var(--border)' : 'none',
                                borderRadius: mode === 'technician' ? '8px' : '0',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>'''

replacement = '''                            <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{
                                    background: mode === 'technician' ? 'rgba(30, 64, 175, 0.1)' : 'rgba(255,255,255,0.05)',
                                    padding: '0.75rem 1.25rem',
                                    border: mode === 'technician' ? '1px solid var(--border)' : 'none',
                                    borderRadius: mode === 'technician' ? '8px' : '0',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    width: '100%'
                                }}>'''

if pattern in content:
    content = content.replace(pattern, replacement)
    
    # Also need to remove the now redundant inner padding div opening tag
    # which comes after the button div
    redundant_div = '<div style={{ padding: \'0.75rem\' }}>'
    if redundant_div in content:
        # We only want to remove the first one after our replaced block
        content = content.replace(redundant_div, '', 1)
        
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success")
else:
    print("Pattern not found")
