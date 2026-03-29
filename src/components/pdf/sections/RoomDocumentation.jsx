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
                        {/* Header Block + all images: keeps title with images on same page */}
                    <View wrap={true}>
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

                            {/* All room images – always 2 per row */}
                            {roomImages.length > 0 && (
                                <ImageGrid images={roomImages} />
                            )}
                        </View>
                    </View>
                );
            })}
        </>
    );
};

export default RoomDocumentation;
