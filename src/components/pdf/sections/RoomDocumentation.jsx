/* eslint-disable react-hooks/immutability */
import React from 'react';
import { View, Image, Text } from '@react-pdf/renderer';
import { styles } from '../PDFStyles';
import ImageGrid from '../components/ImageGrid';

const RoomDocumentation = ({ rooms, images }) => {
    let currentApartment = null;
    let currentFloor = null;

    if (!rooms || rooms.length === 0) return null;

    return (
        <>
            {rooms.map((room, index) => {
                const isNewApt = room.apartment !== currentApartment || room.stockwerk !== currentFloor;
                const isFirstRoom = index === 0;

                if (isNewApt) {
                    currentApartment = room.apartment;
                    currentFloor = room.stockwerk;
                }

                const allRoomImages = (images || []).filter(img => {
                    const assignedTo = String(img.assignedTo || '').trim().toLowerCase();
                    const roomName = String(room.name || '').trim().toLowerCase();
                    return img.includeInReport !== false && (
                        (img.roomId && String(img.roomId) === String(room.id)) ||
                        (assignedTo === roomName)
                    );
                });

                const roomImages = allRoomImages
                    .filter(img => !img.linkedToOriginal)
                    .map(img => {
                        const thermal = allRoomImages.find(i => i.linkedToOriginal === img.id);
                        return thermal ? { ...img, thermalImage: thermal } : img;
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
                                    <Text style={styles.sectionTitle}>DOKUMENTATION</Text>
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
                                <View style={[styles.imageGrid, { flexWrap: 'nowrap', marginBottom: 10 }]}>
                                    <View style={styles.imageContainer}>
                                        {firstImage.preview ? (
                                            <Image src={firstImage.preview} style={styles.image} />
                                        ) : (
                                            <View style={[styles.image, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' }]}>
                                                <Text style={{ fontSize: 8, color: '#ef4444' }}>[ BILD NICHT VERFÜGBAR ]</Text>
                                            </View>
                                        )}
                                        {firstImage.description && (
                                            <Text style={styles.imageDescription}>{firstImage.description}</Text>
                                        )}
                                    </View>

                                    {firstImage.thermalImage && (
                                        <View style={styles.imageContainer}>
                                            {firstImage.thermalImage.preview ? (
                                                <Image src={firstImage.thermalImage.preview} style={styles.image} />
                                            ) : (
                                                <View style={[styles.image, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' }]}>
                                                    <Text style={{ fontSize: 8, color: '#ef4444' }}>[ BILD NICHT VERFÜGBAR ]</Text>
                                                </View>
                                            )}
                                            <Text style={[styles.imageDescription, { color: '#ef4444', fontWeight: 'bold' }]}>
                                                [Thermobild] {firstImage.thermalImage.description}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>

                        {/* Remaining Images */}
                        {restImages.length > 0 && (
                            <ImageGrid images={restImages} wrap={false} />
                        )}
                    </View>
                );
            })}
        </>
    );
};

export default RoomDocumentation;
