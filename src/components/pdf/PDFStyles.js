import { StyleSheet } from '@react-pdf/renderer';

export const styles = StyleSheet.create({
    page: {
        padding: 30,
        paddingBottom: 90, // Increased to provide more safety for the footer
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
        justifyContent: 'space-between',
        width: '100%',
    },
    imageContainer: {
        width: '49%', // 2 per row
        marginBottom: 10,
        alignItems: 'flex-start',
    },
    image: {
        width: '100%',
        height: 200, // Slightly more height
        objectFit: 'contain',
        objectPosition: 'left',
        borderRadius: 2,
    },
    imageDescription: {
        fontSize: 9,
        color: '#475569',
        marginTop: 4,
        textAlign: 'left',
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
        height: 60, // Increased more to be absolutely sure
        borderTopWidth: 0.5,
        borderTopColor: '#0369a1',
        paddingTop: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    footerText: {
        fontSize: 10,
        color: '#000000',
    },
    pageNumber: {
        position: 'absolute',
        bottom: 40,
        right: 30,
        fontSize: 10,
        color: '#000000',
        textAlign: 'right',
    }
});
