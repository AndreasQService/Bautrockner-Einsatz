import os

path = r'c:\QTool\src\components\DamageForm.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# We want to move the padding from the wrapper down to the content area
# and make the header touch the edges
old_block = '''                            <div style={{ 
                                border: mode === 'technician' ? '1px solid var(--border)' : 'none',
                                borderRadius: mode === 'technician' ? '8px' : '0',
                                overflow: 'hidden',
                                maxWidth: mode === 'technician' ? '800px' : 'none',
                                backgroundColor: mode === 'technician' ? 'var(--background)' : 'transparent'
                            }}>
                            <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>'''

new_block = '''                            <div style={{ 
                                border: mode === 'technician' ? '1px solid var(--border)' : 'none',
                                borderRadius: mode === 'technician' ? '8px' : '0',
                                overflow: 'hidden',
                                maxWidth: mode === 'technician' ? '800px' : 'none',
                                backgroundColor: mode === 'technician' ? 'var(--background)' : 'transparent',
                                margin: mode === 'technician' ? '0 0 1.25rem 0.75rem' : '0'
                            }}>
                                {/* Header (Deckel) */}
                                <div style={{
                                    background: mode === 'technician' ? 'rgba(30, 64, 175, 0.1)' : 'rgba(255,255,255,0.05)',
                                    padding: '0.75rem 1.25rem',
                                    borderBottom: mode === 'technician' ? '1px solid var(--border)' : 'none',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    width: '100%'
                                }}>'''

# Also need to remove the internal header that is still there from the previous move
internal_header_pattern = '''                                <div style={{
                                    background: mode === 'technician' ? 'rgba(30, 64, 175, 0.1)' : 'rgba(255,255,255,0.05)',
                                    padding: '0.75rem 1.25rem',
                                    border: mode === 'technician' ? '1px solid var(--border)' : 'none',
                                    borderRadius: mode === 'technician' ? '8px' : '0',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    width: '100%'
                                }}>'''

if old_block in content:
    content = content.replace(old_block, new_block)
    
    if internal_header_pattern in content:
        # We replace the internal header with the padding start for photos
        content = content.replace(internal_header_pattern, '<div style={{ padding: \'0.75rem\', display: \'flex\', flexDirection: \'column\', gap: \'0.75rem\' }}>')
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success")
else:
    print("Pattern not found")
