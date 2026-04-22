import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { styles } from '../PDFStyles';

const PDFMetaData = ({ data }) => {
    return (
        <>
            {/* Title */}
            <View style={styles.titleSection}>
                <Text style={styles.mainTitle}>
                    {data.damageCategory === 'Leckortung' ? 'Leckortungsbericht' :
                        data.damageCategory === 'Trocknung' ? 'Trocknungsbericht' : 'Schadensbericht'}
                </Text>
                <Text style={styles.subTitle}>
                    {`${data.street || ''} ${data.zip || ''} ${data.city || ''} ${data.damageType ? '- ' + data.damageType : ''}`.trim()}
                </Text>
            </View>

            {/* Meta Data */}
            <View style={styles.divider} />
            <View style={styles.metaSection}>
                <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Projektnummer:</Text>
                    <Text style={styles.metaValue}>{data.projectNumber || ''}</Text>
                </View>
                {data.orderNumber && (
                    <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Auftragsnummer:</Text>
                        <Text style={styles.metaValue}>{data.orderNumber}</Text>
                    </View>
                )}
                {data.damageNumber && (
                    <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Schaden-Nr:</Text>
                        <Text style={styles.metaValue}>{data.damageNumber}</Text>
                    </View>
                )}
                <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Berichtsdatum:</Text>
                    <Text style={styles.metaValue}>{new Date().toLocaleDateString('de-CH')}</Text>
                </View>
                {data.damageReportDate && (
                    <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Eingangsdatum:</Text>
                        <Text style={styles.metaValue}>{new Date(data.damageReportDate).toLocaleDateString('de-CH')}</Text>
                    </View>
                )}
                {data.damageDate && (
                    <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Schadendatum:</Text>
                        <Text style={styles.metaValue}>{new Date(data.damageDate).toLocaleDateString('de-CH')}</Text>
                    </View>
                )}

                {data.street && (
                    <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Strasse:</Text>
                        <Text style={styles.metaValue}>{data.street}</Text>
                    </View>
                )}
                {(data.zip || data.city) && (
                    <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Ort:</Text>
                        <Text style={styles.metaValue}>{`${data.zip || ''} ${data.city || ''}`.trim()}</Text>
                    </View>
                )}
                {/* Lage / Details */}
                {data.locationDetails && String(data.locationDetails).trim() !== '' && (
                    <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Lage / Details:</Text>
                        <Text style={styles.metaValue}>{String(data.locationDetails).trim()}</Text>
                    </View>
                )}
                {data.clientSource && (
                    <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Sachbearbeiter:</Text>
                        <Text style={styles.metaValue}>{data.clientSource}</Text>
                    </View>
                )}
                {data.client && (
                    <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Auftraggeber:</Text>
                        <View style={{ flex: 1, flexDirection: 'column' }}>
                            <Text style={{ color: '#000000', fontSize: 10, lineHeight: 1.2 }}>{data.client}</Text>
                            {(data.clientStreet || data.clientZip || data.clientCity) && (
                                <Text style={{ color: '#000000', fontSize: 10, lineHeight: 1.2 }}>
                                    {`${data.clientStreet || ''}, ${data.clientZip || ''} ${data.clientCity || ''}`.trim().replace(/^,/, '').trim()}
                                </Text>
                            )}
                        </View>
                    </View>
                )}
                {data.insurance && (
                    <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Versicherung:</Text>
                        <Text style={styles.metaValue}>{data.insurance}</Text>
                    </View>
                )}
                {data.damageType && (
                    <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Schadenart:</Text>
                        <Text style={styles.metaValue}>{data.damageType}</Text>
                    </View>
                )}
            </View>
        </>
    );
};

export default PDFMetaData;
