import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { styles } from '../PDFStyles';

const MeasuresSection = ({ data }) => {
    const hasMeasures = data.measures || (data.selectedMeasures && data.selectedMeasures.length > 0);

    if (!hasMeasures) return null;

    return (
        <View style={{ marginBottom: 15 }} wrap={false}>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>MASSNAHMEN</Text>
            {data.selectedMeasures && data.selectedMeasures.length > 0 && (
                <View style={{ marginBottom: data.measures ? 10 : 0 }}>
                    {data.selectedMeasures.map((measure, idx) => (
                        <Text key={idx} style={[styles.textBlock, { marginBottom: 2 }]}>• {measure}</Text>
                    ))}
                </View>
            )}
            {data.measures && <Text style={styles.textBlock}>{data.measures}</Text>}
        </View>
    );
};

export default MeasuresSection;
