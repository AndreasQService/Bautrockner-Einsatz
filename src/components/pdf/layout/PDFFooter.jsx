import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { styles } from '../PDFStyles';

const PDFFooter = ({ data }) => {
    return (
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

            {/* Column 3: Buffer */}
            <View style={{ width: '25%' }}></View>

            {/* Page Number absolute to the footer container */}
            <Text
                style={{
                    position: 'absolute',
                    top: 10,
                    right: 0,
                    width: 100, // Fixed width prevents truncation when dynamic text evaluates
                    fontSize: 10,
                    color: '#000000',
                    textAlign: 'right'
                }}
                render={({ pageNumber, totalPages }) => `Seite ${pageNumber} von ${totalPages}`}
            />
        </View>
    );
};

export default PDFFooter;
