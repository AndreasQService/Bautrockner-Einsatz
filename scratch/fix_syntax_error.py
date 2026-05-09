import os

path = r'c:\QTool\src\components\DamageForm.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# The broken block we need to target
broken_pattern = '''                                                                    {/* File Info & Description */}
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
                                                                                         ...prev,
                                                                                         images: prev.images.map(i => i === img ? { ...i, description: newDesc } : i)
                                                                                     }));
                                                                                 }}
                                                                             />'''

# The clean replacement
clean_replacement = '''                                                                    {/* File Info & Description */}
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
                                                                            />'''

if broken_pattern in content:
    content = content.replace(broken_pattern, clean_replacement)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success")
else:
    print("Pattern not found - check indentation or exact text")
