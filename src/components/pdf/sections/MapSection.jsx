import React from 'react';
import { View, Image, Text } from '@react-pdf/renderer';
import { styles } from '../PDFStyles';

const MapSection = ({ mapImageUrl }) => {
    if (!mapImageUrl) return null;

    return (
        <View wrap={false} style={{ marginBottom: 20 }}>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Standort</Text>
            <View style={{ width: '100%', marginBottom: 6 }}>
                <Image
                    src={mapImageUrl}
                    style={{ width: '100%', height: 220 }}
                />
                <Text style={styles.imageDescription}>Standortkarte</Text>
            </View>
        </View>
    );
};

export default MapSection;
