import os

path = r'c:\QTool\src\components\DamageForm.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Target the image description textarea block
# We replace the old simple textarea with the advanced one including Mic button
old_textarea_block = '''                                                                    {/* File Info & Description */}
                                                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                                                            <textarea
                                                                                placeholder="Beschreibung..."
                                                                                value={img.description || ''}
                                                                                onChange={(e) => {
                                                                                    const newImages = [...formData.images];
                                                                                    const index = newImages.findIndex(i => i.preview === img.preview);
                                                                                    newImages[index].description = e.target.value;
                                                                                    setFormData({ ...formData, images: newImages });
                                                                                }}
                                                                                style={{
                                                                                    fontSize: '0.9rem',
                                                                                    padding: '0.5rem',
                                                                                    flex: 1,
                                                                                    resize: 'none',
                                                                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                                                                    border: '1px solid var(--border)',
                                                                                    color: 'white'
                                                                                }}
                                                                                rows={2}
                                                                            />
                                                                        </div>
                                                                    </div>'''

new_textarea_block = '''                                                                    {/* File Info & Description */}
                                                                    <div style={{ flex: '0 1 auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                                                            <textarea
                                                                                placeholder="Beschreibung..."
                                                                                value={img.description || ''}
                                                                                onChange={(e) => {
                                                                                    const newImages = [...formData.images];
                                                                                    const index = newImages.findIndex(i => i.preview === img.preview);
                                                                                    newImages[index].description = e.target.value;
                                                                                    setFormData({ ...formData, images: newImages });
                                                                                }}
                                                                                style={{
                                                                                    fontSize: '0.9rem',
                                                                                    padding: '0.5rem',
                                                                                    flex: 1,
                                                                                    width: '100%',
                                                                                    maxWidth: '320px',
                                                                                    resize: 'none',
                                                                                    backgroundColor: isRecording === img.preview ? '#fef2f2' : '#ffffff',
                                                                                    borderColor: isRecording === img.preview ? '#EF4444' : 'var(--border)',
                                                                                    color: '#1e293b'
                                                                                }}
                                                                                rows={2}
                                                                            />
                                                                            {mode === 'technician' && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => toggleRecording(img.preview, (text) => {
                                                                                        const newImages = [...formData.images];
                                                                                        const index = newImages.findIndex(i => i.preview === img.preview);
                                                                                        newImages[index].description = (newImages[index].description || '') + (newImages[index].description ? ' ' : '') + text;
                                                                                        setFormData({ ...formData, images: newImages });
                                                                                    })}
                                                                                    style={{
                                                                                        padding: '0.6rem',
                                                                                        backgroundColor: isRecording === img.preview ? '#EF4444' : '#0f172a',
                                                                                        color: 'white',
                                                                                        border: 'none',
                                                                                        borderRadius: '50%',
                                                                                        cursor: 'pointer',
                                                                                        display: 'flex',
                                                                                        alignItems: 'center',
                                                                                        justifyContent: 'center',
                                                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                                                                        width: '36px',
                                                                                        height: '36px',
                                                                                        flexShrink: 0
                                                                                    }}
                                                                                >
                                                                                    <Mic size={18} />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>'''

if old_textarea_block in content:
    content = content.replace(old_textarea_block, new_textarea_block)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success")
else:
    # Try a slightly different version without the wrapper div if needed
    # (Sometimes indentation or comments vary)
    print("Pattern not found - trying fallback")
    if 'placeholder="Beschreibung..."' in content:
        # We find the specific style block and update it
        import re
        content = re.sub(
            r'style=\{\{\s+fontSize: \'0.9rem\',\s+padding: \'0.5rem\',\s+flex: 1,\s+resize: \'none\',\s+backgroundColor: \'rgba\(255,255,255,0.05\)\',\s+border: \'1px solid var\(--border\)\',\s+color: \'white\'\s+\}\}',
            "style={{ fontSize: '0.9rem', padding: '0.5rem', flex: 1, width: '100%', maxWidth: '320px', resize: 'none', backgroundColor: isRecording === img.preview ? '#fef2f2' : '#ffffff', borderColor: isRecording === img.preview ? '#EF4444' : 'var(--border)', color: '#1e293b' }}",
            content
        )
        # And we'll need to manually add the Mic button logic if the regex approach is too complex
        # For now, let's just use the first block as it matches what I just saw in view_file.
        print("Regex attempt not fully implemented yet - pattern matching failed")
