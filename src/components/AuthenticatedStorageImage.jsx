import React, { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { getCaseFileStoragePath } from '../lib/caseFilePhotoAccess';

const getImmediateSource = (photo) => {
    if (typeof photo?.preview === 'string' && photo.preview) return photo.preview;
    if (typeof photo?.url === 'string' && photo.url) return photo.url;
    return null;
};

const AuthenticatedStorageImage = ({ photo, alt = 'Foto', style, onClick }) => {
    const [source, setSource] = useState(() => getImmediateSource(photo));
    const [failed, setFailed] = useState(() => !getImmediateSource(photo));

    useEffect(() => {
        let cancelled = false;
        let objectUrl = null;
        const immediateSource = getImmediateSource(photo);
        const storagePath = getCaseFileStoragePath(photo);

        setSource(immediateSource);
        setFailed(!immediateSource);

        if (!storagePath) {
            return () => { cancelled = true; };
        }

        const loadPrivateStorageObject = async () => {
            try {
                const { data, error } = await supabase.storage
                    .from('case-files')
                    .download(storagePath);

                if (error || !data) throw error || new Error('STORAGE_DOWNLOAD_EMPTY');
                objectUrl = URL.createObjectURL(data);

                if (cancelled) {
                    URL.revokeObjectURL(objectUrl);
                    objectUrl = null;
                    return;
                }

                setSource(objectUrl);
                setFailed(false);
            } catch (error) {
                console.warn('Authenticated photo preview unavailable', {
                    storagePath,
                    message: error?.message
                });
                if (!cancelled && !immediateSource) setFailed(true);
            }
        };

        loadPrivateStorageObject();

        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [photo?.id, photo?.storagePath, photo?.supabasePath, photo?.url, photo?.preview]);

    if (failed || !source) {
        return (
            <div
                role="img"
                aria-label={`${alt}: Vorschau nicht verfügbar`}
                style={{
                    ...style,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    color: 'var(--text-muted)',
                    cursor: 'default'
                }}
            >
                <ImageOff size={30} aria-hidden="true" />
                <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Vorschau nicht verfügbar</span>
            </div>
        );
    }

    return (
        <img
            src={source}
            alt={alt}
            style={style}
            onClick={onClick}
            onError={() => setFailed(true)}
        />
    );
};

export default AuthenticatedStorageImage;
