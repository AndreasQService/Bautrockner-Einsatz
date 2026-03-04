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
    const hasDescription = data.description && data.includeDescriptionInReport !== false;

    if (!data.exteriorPhoto && !hasDescription && !hasUnassignedImages) return null;

    return (
        <View wrap={false}>
            {/* Hero / Exterior Photo */}
            {data.exteriorPhoto && (
                <View style={{ marginBottom: 20, alignItems: 'flex-start' }} wrap={false}>
                    <View style={{ width: '100%' }}>
                        <View style={styles.imageContainer}>
                            <Image src={data.exteriorPhoto} style={[styles.image, { height: 250 }]} />
                            <Text style={styles.imageDescription}>Außenansicht / Übersicht</Text>
                        </View>
                    </View>
                </View>
            )}

            {/* Schadensbeschreibung */}
            {(hasDescription || hasUnassignedImages) && (
                <View style={{ marginBottom: 15 }} wrap={false}>
                    <View style={styles.divider} />
                    <Text style={styles.sectionTitle}>Schadenbeschreibung</Text>

                    {hasDescription && <Text style={styles.textBlock}>{data.description}</Text>}

                    {/* Images related to description (unassigned/initial images) */}
                    {hasUnassignedImages && (
                        <View style={{ marginTop: 10 }}>
                            <ImageGrid images={unassignedImages} wrap={false} />
                        </View>
                    )}
                </View>
            )}
        </View>
    );
};

export default DescriptionSection;
