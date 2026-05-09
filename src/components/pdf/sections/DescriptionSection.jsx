import React from 'react';
import { View, Image, Text } from '@react-pdf/renderer';
import { styles } from '../PDFStyles';
import ImageGrid from '../components/ImageGrid';

const DescriptionSection = ({ data }) => {
    const allUnassignedImages = data.images ? data.images.filter(img => !img.roomId && img.assignedTo !== 'Schadenfotos' && img.assignedTo !== 'Pläne' && img.assignedTo !== 'Messprotokolle' && img.includeInReport !== false) : [];
    const unassignedImages = allUnassignedImages
        .filter(img => !img.linkedToOriginal)
        .map(img => {
            const thermal = allUnassignedImages.find(i => i.linkedToOriginal === img.id);
            return thermal ? { ...img, thermalImage: thermal } : img;
        });

    const hasUnassignedImages = unassignedImages.length > 0;
    const hasDescription = data.description && data.description.trim().length > 0 && data.includeDescriptionInReport !== false;

    if (!hasDescription && !hasUnassignedImages) return null;

    return (
        <View>

            {/* Images only (no description text) */}
            {hasUnassignedImages && !hasDescription && (
                <View style={{ marginBottom: 15 }}>
                    <View style={styles.divider} />
                    <ImageGrid images={unassignedImages} />
                </View>
            )}

            {/* Description + optional images */}
            {hasDescription && (
                <View style={{ marginBottom: 15 }}>
                    <View wrap={false}>
                        <View style={styles.divider} />
                        <Text style={styles.sectionTitle}>Schadenbeschreibung</Text>
                    </View>
                    <Text style={styles.textBlock}>{data.description.trim()}</Text>
                    {hasUnassignedImages && (
                        <View style={{ marginTop: 10 }}>
                            <ImageGrid images={unassignedImages} />
                        </View>
                    )}
                </View>
            )}
        </View>
    );
};

export default DescriptionSection;
