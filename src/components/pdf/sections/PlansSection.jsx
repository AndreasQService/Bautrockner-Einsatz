import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { styles } from '../PDFStyles';
import ImageGrid from '../components/ImageGrid';

const PlansSection = ({ data }) => {
    const plansImages = data.images ? data.images.filter(img => img.assignedTo === 'Pläne' && img.includeInReport !== false) : [];

    if (plansImages.length === 0) return null;

    return (
        <View style={{ marginBottom: 20 }} wrap={false}>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>PLÄNE & GRUNDRISSE</Text>
            <ImageGrid images={plansImages} showName={true} wrap={false} />
        </View>
    );
};

export default PlansSection;
