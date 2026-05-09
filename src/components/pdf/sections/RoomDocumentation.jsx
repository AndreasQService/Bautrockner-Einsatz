/* eslint-disable react-hooks/immutability */
import React from 'react';
import { View, Image, Text } from '@react-pdf/renderer';
import { styles } from '../PDFStyles';
import ImageGrid from '../components/ImageGrid';
import { RoomService } from '../../../services/RoomService';

const RoomDocumentation = ({ rooms, images, contacts = [] }) => {
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

                const allRoomImages = RoomService.getRoomImages(room, images || [])
                    .filter(img => img.includeInReport !== false);

                const roomImages = allRoomImages
                    .filter(img => !img.linkedToOriginal)
                    .map(img => {
                        const thermal = allRoomImages.find(i => i.linkedToOriginal === img.id);
                        return thermal ? { ...img, thermalImage: thermal } : img;
                    });

                // First 2 images stay with header (wrap=false keeps them together)
                // Remaining images flow freely across pages
                const firstImages = roomImages.slice(0, 2);
                const restImages = roomImages.slice(2);

                return (
                    <View key={room.id || index} style={styles.roomContainer}>
                        {/* Header + first image pair: wrap=false keeps title with at least one row of images */}
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
                                            // Kontakt mit passendem Namen suchen → floor nehmen
                                            const matchingContact = contacts.find(c =>
                                                c.name && apt && c.name.toLowerCase().includes(apt.toLowerCase())
                                            );
                                            const floor = matchingContact?.floor || matchingContact?.apartment || room.stockwerk || '';
                                            const hasKeyword = apt.toLowerCase().includes('wohnung') || apt.toLowerCase().includes('whg');
                                            // Nur Nachname (letztes Wort) für die Anzeige
                                            const lastName = apt.trim().split(/\s+/).pop() || apt;
                                            const displayApt = (apt && !hasKeyword) ? `Whg. ${lastName}` : apt;
                                            if (room.stockwerk && displayApt && displayApt.toLowerCase().includes(room.stockwerk.toLowerCase())) {
                                                return displayApt;
                                            }
                                            return [room.stockwerk, displayApt].filter(Boolean).join(', ');
                                        })()}
                                    </Text>
                                </View>
                            )}
                            <Text style={styles.roomHeader}>{room.name}</Text>

                            {/* First image pair stays with header */}
                            {firstImages.length > 0 && (
                                <ImageGrid images={firstImages} />
                            )}
                        </View>

                        {/* Remaining images can flow across pages freely */}
                        {restImages.length > 0 && (
                            <ImageGrid images={restImages} />
                        )}
                    </View>
                );
            })}
        </>
    );
};

export default RoomDocumentation;
