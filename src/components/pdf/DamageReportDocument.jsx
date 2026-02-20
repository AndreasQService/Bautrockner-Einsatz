/* eslint-disable react/prop-types */
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';

// Create styles
const styles = StyleSheet.create({
    page: {
        padding: 30,
        paddingBottom: 80, // Space for footer
        fontFamily: 'Helvetica',
        fontSize: 10,
        color: '#000000',
        lineHeight: 1.5,
    },
    header: {
        marginBottom: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    logo: {
        width: 100,
        height: 40,
        objectFit: 'contain',
    },
    companyInfo: {
        textAlign: 'right',
        fontSize: 9,
        color: '#64748B',
        lineHeight: 1.2,
        marginLeft: 'auto',
    },
    titleSection: {
        marginBottom: 20,
    },
    mainTitle: {
        fontSize: 22,
        color: '#0369a1',
        fontWeight: 'bold',
        marginBottom: 12,
    },
    subTitle: {
        fontSize: 14,
        color: '#000000',
        marginBottom: 2,
    },
    projectTitle: {
        fontSize: 10,
        color: '#64748B',
    },
    metaSection: {
        marginBottom: 15,
        paddingBottom: 10,
        borderBottomWidth: 1.5,
        borderBottomColor: '#0369a1',
    },
    metaRow: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    metaLabel: {
        width: 100,
        fontWeight: 'bold', // Helvetica-Bold
        color: '#475569',
        fontSize: 10,
    },
    metaValue: {
        flex: 1,
        color: '#000000',
        fontSize: 10,
    },
    divider: {
        height: 0.5,
        backgroundColor: '#0369a1',
        marginVertical: 10,
    },
    sectionTitle: {
        fontSize: 16,
        color: '#0369a1',
        fontWeight: 'bold',
        marginTop: 15,
        marginBottom: 12,
    },
    textBlock: {
        marginBottom: 10,
        fontSize: 10,
        textAlign: 'justify',
    },

    // Apartment / Room Grouping
    apartmentHeader: {
        fontSize: 16,
        color: '#0369a1',
        fontWeight: 'bold',
        marginTop: 20,
        marginBottom: 5,
        borderBottomWidth: 0.5,
        borderBottomColor: '#0369a1',
        paddingBottom: 2,
    },
    floorHeader: {
        fontSize: 13,
        color: '#475569', // Slate-600
        fontWeight: 'bold',
        marginTop: 15,
        marginBottom: 5,
    },
    roomContainer: {
        marginBottom: 15,
    },
    roomHeader: {
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 5,
        color: '#000000',
    },

    // Images
    imageGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    imageContainer: {
        width: '48%', // 2 per row approx
        marginBottom: 10,
    },
    image: {
        width: '100%',
        height: 150,
        objectFit: 'contain',
        // backgroundColor: '#f1f5f9',
        borderRadius: 2,
    },
    imageDescription: {
        fontSize: 9,
        color: '#475569',
        marginTop: 4,
    },

    footer: {
        position: 'absolute',
        bottom: 30,
        left: 30,
        right: 30,
        height: 30,
        // backgroundColor: '#eeeeee', // Debug color removed
        borderTopWidth: 0.5,
        borderTopColor: '#0369a1',
        paddingTop: 10,

    },
    footerText: {
        fontSize: 8,
        color: '#000000', // Changed to black for visibility
    },
});

// Helper to sort rooms
const sortRooms = (rooms) => {
    if (!rooms) return [];
    return [...rooms].sort((a, b) => {
        const aptA = (a.apartment || '').toLowerCase();
        const aptB = (b.apartment || '').toLowerCase();
        if (aptA < aptB) return -1;
        if (aptA > aptB) return 1;

        const floorA = (a.stockwerk || '').toLowerCase();
        const floorB = (b.stockwerk || '').toLowerCase();
        if (floorA < floorB) return -1;
        if (floorA > floorB) return 1;

        return (a.name || '').localeCompare(b.name || '');
    });
};

const DamageReportDocument = ({ data }) => {
    // Filter rooms that have content (images or existing logic)
    // The previous logic filtered logic based on filtering dataToUse.images.
    // We should pre-process this OR do it here. 
    // Let's assume passed 'data.rooms' contains ALL rooms, so we filter here.

    const validRooms = React.useMemo(() => {
        if (!data.rooms || !data.images) return [];
        const roomsWithContent = data.rooms.filter(room => {
            // Check if room has images assigned and included in report
            const hasImages = data.images.some(img =>
                (img.roomId === room.id || img.assignedTo === room.name) &&
                img.includeInReport !== false
            );
            // Also check for measurements? Previous logic focused on images mostly for this filtering
            // But if room has only measurements, it should likely appear too?
            // Line 1489 in DamageForm.jsx only checked IMAGES. 
            // "dataToUse.images.some(img => ...)"
            // I will match that logic strictly for now.
            return hasImages;
        });
        return sortRooms(roomsWithContent);
    }, [data.rooms, data.images]);

    let currentApartment = null;
    let currentFloor = null;

    return (
        <Document>
            <Page size="A4" style={styles.page} wrap>





                {/* Header */}
                <View style={styles.header} fixed>
                    {data.logo && <Image src={data.logo} style={styles.logo} />}
                    <View style={styles.companyInfo}>
                        <Text>Q-Service AG</Text>
                        <Text>Kriesbachstrasse 30</Text>
                        <Text>8600 Dübendorf</Text>
                        <Text>www.q-service.ch</Text>
                    </View>
                </View>

                {/* Title */}
                <View style={styles.titleSection}>
                    <Text style={styles.mainTitle}>Schadensbericht</Text>
                    <Text style={styles.subTitle}>
                        {`${data.street || ''} ${data.city || ''} ${data.damageType ? '- ' + data.damageType : ''}`}
                    </Text>
                    {data.projectTitle && (
                        <Text style={styles.projectTitle}>{data.projectTitle}</Text>
                    )}
                </View>

                {/* Meta Data */}
                <View style={styles.metaSection}>
                    <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Strasse:</Text>
                        <Text style={styles.metaValue}>{data.street}</Text>
                    </View>
                    <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Ort:</Text>
                        <Text style={styles.metaValue}>{`${data.zip} ${data.city}`}</Text>
                    </View>
                    {/* Lage / Details combined with First Contact Name */}
                    {(data.locationDetails || (data.contacts && data.contacts.length > 0)) && (
                        <View style={styles.metaRow}>
                            <Text style={styles.metaLabel}>Lage / Details:</Text>
                            <Text style={styles.metaValue}>
                                {[
                                    data.locationDetails,
                                    data.contacts?.[0]?.floor,
                                    data.contacts?.[0]?.stockwerk,
                                    data.contacts?.[0]?.apartment,
                                    data.contacts?.[0]?.name
                                ].filter(p => p && p.trim()).join(' ')}
                            </Text>
                        </View>
                    )}
                    <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Datum:</Text>
                        <Text style={styles.metaValue}>{new Date().toLocaleDateString('de-CH')}</Text>
                    </View>
                    <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Sachbearbeiter:</Text>
                        <Text style={styles.metaValue}>{data.clientSource || 'Unbekannt'}</Text>
                    </View>
                    <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Auftraggeber:</Text>
                        <Text style={styles.metaValue}>{data.client || ''}</Text>
                    </View>
                </View>

                {/* Description */}
                {data.description && (
                    <View style={{ marginBottom: 15 }} wrap={false}>
                        <Text style={styles.sectionTitle}>Beschreibung:</Text>
                        <Text style={styles.textBlock}>{data.description}</Text>
                        <View style={styles.divider} />
                    </View>
                )}

                {/* Damage Type Image (ABOVE Cause if checked - Explicitly TRUE) */}
                {data.damageTypeImage && (data.damageTypeImageInReport === true) && (
                    <View style={{ marginBottom: 20 }} wrap={false}>
                        <Text style={styles.sectionTitle}>Schadenart (Bild):</Text>
                        <Image src={data.damageTypeImage} style={{ width: 300, height: 200, objectFit: 'contain' }} />
                        <View style={styles.divider} />
                    </View>
                )}

                {/* Cause and Bottom Image Combined to prevent page break split */}
                {((data.cause || data.damageType) || (data.damageTypeImage && data.damageTypeImageInReport !== true)) && (
                    <View style={{ marginBottom: 20 }} wrap={false}>
                        {(data.cause || data.damageType) && (
                            <View style={{ marginBottom: 10 }}>
                                <Text style={styles.sectionTitle}>Schadenursache:</Text>
                                <Text style={styles.textBlock}>{data.cause || data.damageType}</Text>
                            </View>
                        )}
                        {data.damageTypeImage && (data.damageTypeImageInReport !== true) && (
                            <View style={styles.imageGrid}>
                                <View style={styles.imageContainer}>
                                    <Image src={data.damageTypeImage} style={styles.image} />
                                </View>
                            </View>
                        )}
                        <View style={styles.divider} />
                    </View>
                )}

                {validRooms.map((room, index) => {
                    const isNewApt = room.apartment !== currentApartment;
                    const isNewFloor = room.stockwerk !== currentFloor || isNewApt;

                    if (isNewApt) currentApartment = room.apartment;
                    if (isNewFloor) currentFloor = room.stockwerk;

                    const roomImages = data.images.filter(img =>
                        (img.roomId === room.id || img.assignedTo === room.name) &&
                        img.includeInReport !== false
                    );

                    const firstImage = roomImages[0];
                    const restImages = roomImages.slice(1);

                    return (
                        <View key={room.id || index} style={styles.roomContainer}>
                            {/* Header Block - Keeps Header + 1st Image together */}
                            <View wrap={false}>
                                {isNewApt && room.apartment && (
                                    <Text style={styles.apartmentHeader}>Wohnung: {room.apartment}</Text>
                                )}
                                <Text style={styles.roomHeader}>{room.name}</Text>

                                {firstImage && (
                                    <View style={[styles.imageGrid, { marginBottom: 10 }]}>
                                        <View style={styles.imageContainer}>
                                            <Image src={firstImage.preview} style={styles.image} />
                                            {firstImage.description && (
                                                <Text style={styles.imageDescription}>{firstImage.description}</Text>
                                            )}
                                        </View>
                                    </View>
                                )}
                            </View>

                            {/* Remaining Images */}
                            {restImages.length > 0 && (
                                <View style={styles.imageGrid}>
                                    {restImages.map((img, i) => (
                                        <View key={i} style={styles.imageContainer} wrap={false}>
                                            <Image src={img.preview} style={styles.image} />
                                            {img.description && (
                                                <Text style={styles.imageDescription}>{img.description}</Text>
                                            )}
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    );
                })}

                {/* Findings */}
                {data.findings && (
                    <View style={{ marginBottom: 15, marginTop: 20 }} wrap={false}>
                        <Text style={styles.sectionTitle}>Feststellungen:</Text>
                        <Text style={styles.textBlock}>{data.findings}</Text>
                        <View style={styles.divider} />
                    </View>
                )}

                {/* Measures */}
                {data.measures && (
                    <View style={{ marginBottom: 15 }} wrap={false}>
                        <Text style={styles.sectionTitle}>Massnahmen:</Text>
                        <Text style={styles.textBlock}>{data.measures}</Text>
                        <View style={styles.divider} />
                    </View>
                )}

                {/* Footer - Moved to top to ensure 'fixed' behavior works reliably */}
                <View style={styles.footer} fixed>
                    <View style={{ width: '100%', alignItems: 'center' }}>
                        <Text style={styles.footerText}>Q-Service AG, Kriesbachstrasse 30, 8600 Dübendorf, www.q-service.ch, info@q-service.ch Tel. 043 819 14 18</Text>
                    </View>
                    <View style={{ position: 'absolute', right: 0, top: 10 }}>
                        <Text style={styles.footerText} render={({ pageNumber, totalPages }) => (
                            `Seite ${pageNumber} von ${totalPages}`
                        )} />
                    </View>
                </View>

                {/* Header */}



            </Page>
        </Document>
    );
};

export default DamageReportDocument;
