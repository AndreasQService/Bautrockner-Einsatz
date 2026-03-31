import React from 'react';
import { View, Image, Text } from '@react-pdf/renderer';
import { styles } from '../PDFStyles';

const PDFHeader = ({ data }) => {
    return (
        <View style={styles.header} fixed>
            <View style={{ alignItems: 'flex-start' }}>
                {data.logo && <Image src={data.logo} style={styles.logo} />}
                {data.projectNumber && (
                    <Text
                        style={{ fontSize: 9, color: '#0F6EA3', fontWeight: 'bold', marginTop: 2 }}
                        render={({ pageNumber }) => (
                            pageNumber > 1 ? `Projekt-Nr: ${data.projectNumber}` : ''
                        )}
                    />
                )}
                {data.orderNumber && (
                    <Text
                        style={{ fontSize: 8, color: '#64748B', fontWeight: 'bold' }}
                        render={({ pageNumber }) => (
                            pageNumber > 1 ? `Auftrag: ${data.orderNumber}` : ''
                        )}
                    />
                )}
            </View>
            <View style={styles.companyInfo}>
                <Text>Q-Service AG</Text>
                <Text>Kriesbachstrasse 30</Text>
                <Text>8600 Dübendorf</Text>
                <Text>www.q-service.ch</Text>
            </View>
        </View>
    );
};

export default PDFHeader;
