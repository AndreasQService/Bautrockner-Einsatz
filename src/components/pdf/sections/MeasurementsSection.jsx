import React from 'react';
import { View, Text, Image } from '@react-pdf/renderer';
import { styles } from '../PDFStyles';

const MeasurementsSection = ({ data }) => {
    const measurementImages = data.images
        ? data.images.filter(img => img.assignedTo === 'Messprotokolle' && img.includeInReport !== false)
        : [];

    if (measurementImages.length === 0) return null;

    // Pair images into rows of 2
    const rows = [];
    for (let i = 0; i < measurementImages.length; i += 2) {
        rows.push(measurementImages.slice(i, i + 2));
    }

    const IMG_HEIGHT_PAIR   = 230; // height when 2 side-by-side
    const IMG_HEIGHT_SINGLE = 460; // height when alone
    const GAP = 10;                // gap between the two images (pt)

    return (
        <View style={{ marginBottom: 20 }}>
            <View wrap={false}>
                <View style={styles.divider} />
                <Text style={styles.sectionTitle}>MESSPROTOKOLLE</Text>
            </View>

            {rows.map((row, rowIdx) => {
                const isSingle = row.length === 1;
                return (
                    <View
                        key={rowIdx}
                        wrap={false}
                        style={{
                            flexDirection: 'row',
                            marginBottom: 14,
                        }}
                    >
                        {row.map((img, i) => {
                            const isFirst = i === 0;
                            return (
                                <View
                                    key={i}
                                    style={{
                                        flex: 1,
                                        marginRight: (!isSingle && isFirst) ? GAP : 0,
                                    }}
                                >
                                    <Image
                                        src={img.preview}
                                        style={{
                                            width: '100%',
                                            height: isSingle ? IMG_HEIGHT_SINGLE : IMG_HEIGHT_PAIR,
                                            objectFit: 'contain',
                                        }}
                                    />
                                    {img.name && (
                                        <Text style={{
                                            ...styles.imageDescription,
                                            textAlign: 'center',
                                            marginTop: 3,
                                            fontSize: 8,
                                        }}>
                                            {img.name}
                                        </Text>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                );
            })}
        </View>
    );
};

export default MeasurementsSection;
