import React from 'react';
import { View, Image, Text } from '@react-pdf/renderer';
import { styles } from '../PDFStyles';

const ImageGrid = ({ images, showName = false, imageStyle = styles.image, containerStyle = styles.imageContainer, wrap = true }) => {
    if (!images || images.length === 0) return null;

    return (
        <View style={styles.imageGrid}>
            {images.map((img, i) => (
                <View key={i} style={containerStyle} wrap={wrap}>
                    {img.preview ? (
                        <Image src={img.preview} style={imageStyle} />
                    ) : (
                        <View style={[imageStyle, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' }]}>
                            <Text style={{ fontSize: 8, color: '#ef4444' }}>[ BILD NICHT VERFÜGBAR ]</Text>
                        </View>
                    )}
                    {showName ? (
                        img.name && <Text style={styles.imageDescription}>{img.name}</Text>
                    ) : (
                        img.description && <Text style={styles.imageDescription}>{img.description}</Text>
                    )}
                </View>
            ))}
        </View>
    );
};

export default ImageGrid;
