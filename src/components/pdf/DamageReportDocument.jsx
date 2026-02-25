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
        color: '#0F6EA3',
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
    },
    metaRow: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    metaLabel: {
        width: 110,
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
        backgroundColor: '#0F6EA3',
        marginVertical: 10,
    },
    sectionTitle: {
        fontSize: 16,
        color: '#0F6EA3',
        fontWeight: 'bold',
        marginTop: 10,
        marginBottom: 8,
    },
    textBlock: {
        marginBottom: 10,
        fontSize: 10,
        textAlign: 'justify',
    },

    // Apartment / Room Grouping
    apartmentHeader: {
        fontSize: 16,
        color: '#0F6EA3',
        fontWeight: 'bold',
        marginTop: 10,
        marginBottom: 2,
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
        marginTop: 2,
        marginBottom: 4,
        color: '#0F6EA3',
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
        borderRadius: 2,
    },
    imageDescription: {
        fontSize: 9,
        color: '#475569',
        marginTop: 4,
    },
    // Table
    table: {
        width: '100%',
        borderWidth: 0.5,
        borderColor: '#E2E8F0',
        borderRadius: 4,
        overflow: 'hidden',
        marginTop: 10,
        marginBottom: 15,
    },
    tableHeaderRow: {
        flexDirection: 'row',
        backgroundColor: '#F8FAFC',
        borderBottomWidth: 0.5,
        borderBottomColor: '#E2E8F0',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 0.5,
        borderBottomColor: '#E2E8F0',
    },
    tableHeader: {
        padding: 5,
        fontSize: 8,
        fontWeight: 'bold',
        color: '#64748B',
    },
    tableCell: {
        padding: 5,
        fontSize: 8,
        color: '#334155',
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
        console.log("PDF Document: Checking rooms for content...");
        const roomsWithContent = data.rooms.filter(room => {
            // Check for visible images belonging to this room
            const hasImages = (data.images || []).some(img => {
                const assignedTo = String(img.assignedTo || '').trim().toLowerCase();
                const roomName = String(room.name || '').trim().toLowerCase();
                const imgRoomId = img.roomId ? String(img.roomId) : null;
                const roomId = room.id ? String(room.id) : null;

                // data.images is already pre-filtered for includeInReport in DamageForm.jsx,
                // but we double check here for safety.
                return img.includeInReport !== false && (
                    (imgRoomId && roomId && imgRoomId === roomId) ||
                    (assignedTo === roomName)
                );
            });

            // Check for textual content (Description or Notes)
            const hasTextContent =
                (room.description && String(room.description).trim() !== '') ||
                (room.notizen && String(room.notizen).trim() !== '');

            // Room is valid if it has images OR relevant text
            const isValid = hasImages || hasTextContent;

            if (isValid) {
                console.log(`PDF Document: Room '${room.name}' mapped (Images: ${hasImages}, Text: ${hasTextContent}).`);
            }
            return isValid;
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
                    <Text style={styles.mainTitle}>
                        {data.damageCategory === 'Leckortung' ? 'Leckortungsbericht' :
                            data.damageCategory === 'Trocknung' ? 'Trocknungsbericht' : 'Schadensbericht'}
                    </Text>
                    <Text style={styles.subTitle}>
                        {`${data.street || ''} ${data.zip || ''} ${data.city || ''} ${data.damageType ? '- ' + data.damageType : ''}`.trim()}
                    </Text>
                    {data.projectTitle && !data.projectTitle.startsWith('TMP-') && (
                        <Text style={styles.projectTitle}>Projekt: {data.projectTitle}</Text>
                    )}
                    {data.orderNumber && (
                        <Text style={styles.projectTitle}>Auftrag: {data.orderNumber}</Text>
                    )}
                </View>

                {/* Meta Data */}
                <View style={styles.divider} />
                <View style={styles.metaSection}>
                    <View style={{ flexDirection: 'row', gap: 20 }}>
                        <View style={{ flex: 1 }}>
                            {data.projectNumber && (
                                <View style={styles.metaRow}>
                                    <Text style={styles.metaLabel}>Projektnummer:</Text>
                                    <Text style={styles.metaValue}>{data.projectNumber}</Text>
                                </View>
                            )}
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
                        </View>
                        <View style={{ flex: 1 }}>
                            <View style={styles.metaRow}>
                                <Text style={styles.metaLabel}>Berichtsdatum:</Text>
                                <Text style={styles.metaValue}>{new Date().toLocaleString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} Uhr</Text>
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
                        </View>
                    </View>

                    <View style={{ height: 10 }} />

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
                    {/* Lage / Details - Improved Display */}
                    {(() => {
                        const details = [
                            data.locationDetails,
                            data.contacts?.[0]?.floor,
                            data.contacts?.[0]?.stockwerk,
                            data.contacts?.[0]?.apartment
                        ].filter(p => p !== null && p !== undefined && String(p).trim() !== '').map(p => String(p).trim());

                        if (details.length > 0) {
                            return (
                                <View style={styles.metaRow}>
                                    <Text style={styles.metaLabel}>Lage / Details:</Text>
                                    <Text style={styles.metaValue}>{details.join(', ')}</Text>
                                </View>
                            );
                        }
                        return null;
                    })()}
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

                {/* Hero / Exterior Photo */}
                {data.exteriorPhoto && (
                    <View style={{ marginBottom: 20, alignItems: 'center' }} wrap={false}>
                        <Image src={data.exteriorPhoto} style={{ width: '100%', height: 250, objectFit: 'contain', borderRadius: 4 }} />
                        <Text style={[styles.imageDescription, { textAlign: 'center', marginTop: 5 }]}>Außenansicht / Übersicht</Text>
                    </View>
                )}

                <View style={styles.divider} />

                {/* Description */}
                {data.description && (
                    <View style={{ marginBottom: 15 }} wrap={false}>
                        <View style={styles.divider} />
                        <Text style={styles.sectionTitle}>BESCHREIBUNG</Text>
                        <Text style={styles.textBlock}>{data.description}</Text>
                        <View style={styles.divider} />
                    </View>
                )}

                {/* Damage Cause Section & Hero Photos */}
                {(data.cause || (data.images && data.images.some(img => img.assignedTo === 'Schadenfotos' && img.includeInReport !== false))) && (
                    <View style={{ marginBottom: 20 }} wrap={false}>
                        <View style={styles.divider} />
                        <View style={{ marginBottom: 10 }}>
                            <Text style={styles.sectionTitle}>SCHADENURSACHE</Text>
                            {data.cause && <Text style={styles.textBlock}>{data.cause}</Text>}
                        </View>

                        {/* Schadenfotos Grid (The "Selected Pics") */}
                        {data.images && data.images.some(img => img.assignedTo === 'Schadenfotos' && img.includeInReport !== false) && (
                            <View style={{ marginTop: 10 }}>
                                <Text style={[styles.imageDescription, { fontWeight: 'bold', marginBottom: 8, color: '#0F6EA3' }]}>FOTOS ZUR URSACHE</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                                    {data.images.filter(img => img.assignedTo === 'Schadenfotos' && img.includeInReport !== false).map((img, i) => (
                                        <View key={i} style={{ width: '48%', marginBottom: 10 }}>
                                            <Image src={img.preview} style={{ width: '100%', height: 160, objectFit: 'contain' }} />
                                            {img.description && <Text style={[styles.imageDescription, { marginTop: 4 }]}>{img.description}</Text>}
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                        <View style={styles.divider} />
                    </View>
                )}


                {/* Raumdokumentation Section */}
                {validRooms.map((room, index) => {
                    const isNewApt = room.apartment !== currentApartment || room.stockwerk !== currentFloor;
                    const isFirstRoom = index === 0;

                    if (isNewApt) {
                        currentApartment = room.apartment;
                        currentFloor = room.stockwerk;
                    }

                    const roomImages = data.images.filter(img => {
                        const assignedTo = String(img.assignedTo || '').trim().toLowerCase();
                        const roomName = String(room.name || '').trim().toLowerCase();
                        return img.includeInReport !== false && (
                            (img.roomId && String(img.roomId) === String(room.id)) ||
                            (assignedTo === roomName)
                        );
                    });

                    const firstImage = roomImages[0];
                    const restImages = roomImages.slice(1);

                    return (
                        <View key={room.id || index} style={styles.roomContainer}>
                            {/* Header Block - Keeps Section Title + Room Header + 1st Image together */}
                            <View wrap={false}>
                                {isFirstRoom && (
                                    <View>
                                        <View style={styles.divider} />
                                        <Text style={styles.sectionTitle}>RAUMDOKUMENTATION</Text>
                                    </View>
                                )}

                                {isNewApt && (room.apartment || room.stockwerk) && (
                                    <View style={{ marginTop: 0 }}>
                                        <Text style={styles.apartmentHeader}>
                                            {(() => {
                                                const apt = room.apartment || '';
                                                const hasKeyword = apt.toLowerCase().includes('wohnung') || apt.toLowerCase().includes('whg');
                                                const displayApt = (apt && !hasKeyword) ? `Whg. ${apt}` : apt;

                                                if (room.stockwerk && displayApt && displayApt.toLowerCase().includes(room.stockwerk.toLowerCase())) {
                                                    return displayApt;
                                                }
                                                return [room.stockwerk, displayApt].filter(Boolean).join(', ');
                                            })()}
                                        </Text>
                                    </View>
                                )}
                                <Text style={styles.roomHeader}>{room.name}</Text>


                                {firstImage && (
                                    <View style={[styles.imageGrid, { marginBottom: 10 }]}>
                                        <View style={styles.imageContainer}>
                                            {firstImage.preview ? (
                                                <Image src={firstImage.preview} style={styles.image} />
                                            ) : (
                                                <View style={[styles.image, { alignItems: 'center', justifyContent: 'center' }]}>
                                                    <Text style={{ fontSize: 8, color: '#ef4444' }}>[ BILD NICHT VERFÜGBAR ]</Text>
                                                </View>
                                            )}
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
                                            {img.preview ? (
                                                <Image src={img.preview} style={styles.image} />
                                            ) : (
                                                <View style={[styles.image, { alignItems: 'center', justifyContent: 'center' }]}>
                                                    <Text style={{ fontSize: 8, color: '#ef4444' }}>[ BILD NICHT VERFÜGBAR ]</Text>
                                                </View>
                                            )}
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


                {/* Pläne & Grundrisse */}
                {data.images && data.images.some(img => img.assignedTo === 'Pläne' && img.includeInReport !== false) && (
                    <View style={{ marginBottom: 20 }} wrap={false}>
                        <View style={styles.divider} />
                        <Text style={styles.sectionTitle}>PLÄNE & GRUNDRISSE</Text>
                        <View style={styles.imageGrid}>
                            {data.images.filter(img => img.assignedTo === 'Pläne' && img.includeInReport !== false).map((img, i) => (
                                <View key={i} style={styles.imageContainer}>
                                    <Image src={img.preview} style={styles.image} />
                                    {img.name && <Text style={styles.imageDescription}>{img.name}</Text>}
                                </View>
                            ))}
                        </View>
                    </View>
                )}



                {/* Findings */}
                {data.findings && (
                    <View style={{ marginBottom: 15, marginTop: 20 }} wrap={false}>
                        <View style={styles.divider} />
                        <Text style={styles.sectionTitle}>FESTSTELLUNGEN</Text>
                        <Text style={styles.textBlock}>{data.findings}</Text>
                    </View>
                )}

                {/* Measures */}
                {(data.measures || (data.selectedMeasures && data.selectedMeasures.length > 0)) && (
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
        </Document >
    );
};

export default DamageReportDocument;
