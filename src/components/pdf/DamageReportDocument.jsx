/* eslint-disable react/prop-types */
import React from 'react';
import { Document, Page } from '@react-pdf/renderer';

// Import styles
import { styles } from './PDFStyles';
import PDFHeader from './layout/PDFHeader';
import PDFFooter from './layout/PDFFooter';
import PDFMetaData from './layout/PDFMetaData';
import DescriptionSection from './sections/DescriptionSection';
import RoomDocumentation from './sections/RoomDocumentation';
import PlansSection from './sections/PlansSection';
import CauseSection from './sections/CauseSection';
import MeasuresSection from './sections/MeasuresSection';
import MeasurementsSection from './sections/MeasurementsSection';

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


    return (
        <Document>
            <Page size="A4" style={styles.page} wrap>



                <PDFHeader data={data} />

                <PDFMetaData data={data} />

                <DescriptionSection data={data} />



                {/* Raumdokumentation Section */}
                <RoomDocumentation rooms={validRooms} images={data.images} />


                <PlansSection data={data} />



                <CauseSection data={data} />

                <MeasuresSection data={data} />

                <MeasurementsSection data={data} />

                <PDFFooter data={data} />

            </Page>
        </Document >
    );
};

export default DamageReportDocument;
