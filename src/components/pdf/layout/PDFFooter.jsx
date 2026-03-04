import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { styles } from '../PDFStyles';

const PDFFooter = ({ data }) => {
    return (
        <>
            <View style={styles.footer} fixed>
                {/* Column 1: Project Number */}
                <View style={{ width: '25%', alignItems: 'flex-start' }}>
                    <Text style={styles.footerText}>
                        {data.projectNumber ? `Projekt-Nr: ${data.projectNumber}` : ''}
                    </Text>
                </View>

                {/* Column 2: Company Info */}
                <View style={{ width: '50%', alignItems: 'center' }}>
                    <Text style={styles.footerText}>Q-Service AG • Kriesbachstrasse 30 • 8600 Dübendorf</Text>
                    <Text style={styles.footerText}>www.q-service.ch • Tel. 043 819 14 18</Text>
                </View>

                {/* Column 3: Buffer (Page number is now absolute for better reliability) */}
                <View style={{ width: '25%' }} />
            </View>

            <Text
                style={styles.pageNumber}
                render={({ pageNumber, totalPages }) => `${pageNumber} von ${totalPages}`}
                fixed
            />
        </>
    );
};

export default PDFFooter;
