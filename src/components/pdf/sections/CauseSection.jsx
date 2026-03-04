import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { styles } from '../PDFStyles';
import ImageGrid from '../components/ImageGrid';

const CauseSection = ({ data }) => {
    const findings = data.findings;
    const cause = data.cause;
    const causeImages = data.images ? data.images.filter(img => img.assignedTo === 'Schadenfotos' && img.includeInReport !== false) : [];

    const hasCause = cause || causeImages.length > 0;

    return (
        <>
            {/* Findings */}
            {findings && (
                <View style={{ marginBottom: 15, marginTop: 20 }} wrap={false}>
                    <View style={styles.divider} />
                    <Text style={styles.sectionTitle}>FESTSTELLUNGEN</Text>
                    <Text style={styles.textBlock}>{findings}</Text>
                </View>
            )}

            {/* Damage Cause Section & Hero Photos */}
            {hasCause && (
                <View style={{ marginBottom: 15 }} wrap={false}>
                    <View style={styles.divider} />
                    <View style={{ marginBottom: 10 }}>
                        <Text style={styles.sectionTitle}>SCHADENURSACHE</Text>
                        {cause && <Text style={styles.textBlock}>{cause}</Text>}
                    </View>

                    {/* Schadenfotos Grid (The "Selected Pics") */}
                    {causeImages.length > 0 && (
                        <View style={{ marginTop: 10 }}>
                            <Text style={[styles.imageDescription, { fontWeight: 'bold', marginBottom: 8, color: '#0F6EA3' }]}>FOTOS ZUR URSACHE</Text>
                            <ImageGrid images={causeImages} showName={false} wrap={false} />
                        </View>
                    )}
                </View>
            )}
        </>
    );
};

export default CauseSection;
