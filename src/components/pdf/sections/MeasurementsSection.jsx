import React from 'react';
import { View, Text, Image } from '@react-pdf/renderer';
import { styles } from '../PDFStyles';

const MeasurementsSection = ({ data }) => {
    const measurementImages = data.images ? data.images.filter(img => img.assignedTo === 'Messprotokolle' && img.includeInReport !== false) : [];

    if (measurementImages.length === 0) return null;

    return (
        <View style={{ marginBottom: 20 }} wrap={false}>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>MESSPROTOKOLLE</Text>
            <View style={styles.imageGrid}>
                {measurementImages.map((img, i) => (
                    <View key={i} style={{ width: '100%', marginBottom: 15 }}>
                        <Image src={img.preview} style={{ width: '100%', height: 500, objectFit: 'contain' }} />
                        {img.name && <Text style={styles.imageDescription}>{img.name}</Text>}
                    </View>
                ))}
            </View>
        </View>
    );
};

export default MeasurementsSection;
