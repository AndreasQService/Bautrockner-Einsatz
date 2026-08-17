import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import PDFHeader from './layout/PDFHeader';
import PDFFooter from './layout/PDFFooter';

const localStyles = StyleSheet.create({
  page: {
    padding: 30,
    paddingBottom: 80,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#0F172A',
    lineHeight: 1.4,
  },
  titleSection: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0F6EA3',
    paddingBottom: 6,
  },
  mainTitle: {
    fontSize: 18,
    color: '#0F6EA3',
    fontWeight: 'bold',
  },
  subTitle: {
    fontSize: 10,
    color: '#475569',
    marginTop: 2,
  },
  gridTwoCol: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  box: {
    flex: 1,
    padding: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#E2E8F0',
  },
  boxTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0F6EA3',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  metaLabel: {
    width: 90,
    fontWeight: 'bold',
    color: '#475569',
  },
  metaValue: {
    flex: 1,
    color: '#0F172A',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0F6EA3',
    marginTop: 10,
    marginBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#CBD5E1',
    paddingBottom: 2,
  },
  table: {
    width: '100%',
    borderWidth: 0.5,
    borderColor: '#CBD5E1',
    borderRadius: 3,
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 0.5,
    borderBottomColor: '#CBD5E1',
    padding: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E2E8F0',
    padding: 4,
  },
  th: {
    fontWeight: 'bold',
    color: '#334155',
  },
  td: {
    color: '#0F172A',
  },
  textBlock: {
    padding: 8,
    backgroundColor: '#FAF5FF',
    borderColor: '#E9D5FF',
    borderWidth: 0.5,
    borderRadius: 4,
    marginBottom: 10,
    minHeight: 40,
  },
  signatureContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    gap: 15,
  },
  signatureBox: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: '#CBD5E1',
    borderRadius: 4,
    padding: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  signatureLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 4,
  },
  signatureImage: {
    width: 140,
    height: 50,
    objectFit: 'contain',
  },
  signerText: {
    fontSize: 8,
    color: '#64748B',
    marginTop: 4,
  }
});

export default function ArbeitsrapportDocument({ rapportData, projectData }) {
  const data = projectData || {};
  const rapport = rapportData || {};

  return (
    <Document>
      <Page size="A4" style={localStyles.page}>
        <PDFHeader data={data} />

        {/* Titel */}
        <View style={localStyles.titleSection}>
          <Text style={localStyles.mainTitle}>ARBEITSRAPPORT / TAGESRAPPORT</Text>
          <Text style={localStyles.subTitle}>
            Rapport-Nr: {rapport.rapportNumber || 'DRAFT'} | Datum: {rapport.date || new Date().toLocaleDateString('de-CH')}
          </Text>
        </View>

        {/* Info-Boxen Grid */}
        <View style={localStyles.gridTwoCol}>
          <View style={localStyles.box}>
            <Text style={localStyles.boxTitle}>Projekt & Kunde</Text>
            <View style={localStyles.metaRow}>
              <Text style={localStyles.metaLabel}>Sorba-Projekt-Nr:</Text>
              <Text style={localStyles.metaValue}>{data.projectNumber || data.sorbaProjectNumber || '–'}</Text>
            </View>
            <View style={localStyles.metaRow}>
              <Text style={localStyles.metaLabel}>Objekt / Adresse:</Text>
              <Text style={localStyles.metaValue}>
                {data.street ? `${data.street}, ${data.zip || ''} ${data.city || ''}` : (data.address || '–')}
              </Text>
            </View>
            <View style={localStyles.metaRow}>
              <Text style={localStyles.metaLabel}>Kunde / Aufraggeber:</Text>
              <Text style={localStyles.metaValue}>{data.client || '–'}</Text>
            </View>
          </View>

          <View style={localStyles.box}>
            <Text style={localStyles.boxTitle}>Techniker & Zeiten</Text>
            <View style={localStyles.metaRow}>
              <Text style={localStyles.metaLabel}>Techniker / Monteur:</Text>
              <Text style={localStyles.metaValue}>{rapport.technicianName || data.assignedTo || 'Q-Service Techniker'}</Text>
            </View>
            <View style={localStyles.metaRow}>
              <Text style={localStyles.metaLabel}>Arbeitszeit:</Text>
              <Text style={localStyles.metaValue}>{rapport.workHours || '0'} Std.</Text>
            </View>
            <View style={localStyles.metaRow}>
              <Text style={localStyles.metaLabel}>Anfahrt / Abfahrt:</Text>
              <Text style={localStyles.metaValue}>{rapport.travelHours || '0'} Std. ({rapport.km || '0'} km)</Text>
            </View>
          </View>
        </View>

        {/* Ausgeführte Arbeiten */}
        <Text style={localStyles.sectionTitle}>Ausgeführte Arbeiten & Befunde</Text>
        <View style={localStyles.textBlock}>
          <Text>{rapport.performedTasks || 'Keine Arbeitsbeschreibung erfasst.'}</Text>
        </View>

        {/* Verbrauchtes Material */}
        {rapport.materials && rapport.materials.length > 0 && (
          <View>
            <Text style={localStyles.sectionTitle}>Verbrauchtes Material & Ersatzteile</Text>
            <View style={localStyles.table}>
              <View style={localStyles.tableHeader}>
                <Text style={[localStyles.th, { flex: 3 }]}>Materialbezeichnung</Text>
                <Text style={[localStyles.th, { flex: 1, textAlign: 'right' }]}>Menge</Text>
                <Text style={[localStyles.th, { flex: 1, textAlign: 'center' }]}>Einheit</Text>
              </View>
              {rapport.materials.map((mat, idx) => (
                <View key={idx} style={localStyles.tableRow}>
                  <Text style={[localStyles.td, { flex: 3 }]}>{mat.name}</Text>
                  <Text style={[localStyles.td, { flex: 1, textAlign: 'right' }]}>{mat.amount}</Text>
                  <Text style={[localStyles.td, { flex: 1, textAlign: 'center' }]}>{mat.unit || 'Stk'}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Eingesetzte Geräte */}
        {rapport.devices && rapport.devices.length > 0 && (
          <View>
            <Text style={localStyles.sectionTitle}>Eingesetzte Trocknungsgeräte & Zählerstände</Text>
            <View style={localStyles.table}>
              <View style={localStyles.tableHeader}>
                <Text style={[localStyles.th, { flex: 2 }]}>Gerät / Modell</Text>
                <Text style={[localStyles.th, { flex: 2 }]}>Seriennummer / ID</Text>
                <Text style={[localStyles.th, { flex: 1, textAlign: 'right' }]}>Zählerstand (kWh)</Text>
              </View>
              {rapport.devices.map((dev, idx) => (
                <View key={idx} style={localStyles.tableRow}>
                  <Text style={[localStyles.td, { flex: 2 }]}>{dev.name || dev.deviceType}</Text>
                  <Text style={[localStyles.td, { flex: 2 }]}>{dev.serialNumber || dev.id || '–'}</Text>
                  <Text style={[localStyles.td, { flex: 1, textAlign: 'right' }]}>{dev.counterReading || dev.kwh || '–'}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Unterschriften */}
        <Text style={localStyles.sectionTitle}>Visierung & Bestätigung</Text>
        <View style={localStyles.signatureContainer}>
          <View style={localStyles.signatureBox}>
            <Text style={localStyles.signatureLabel}>Kundenunterschrift / Bauleitung</Text>
            {rapport.customerSignature ? (
              <Image src={rapport.customerSignature} style={localStyles.signatureImage} />
            ) : (
              <Text style={{ height: 50, color: '#94A3B8', marginTop: 15 }}>Keine Unterschrift</Text>
            )}
            <Text style={localStyles.signerText}>
              {rapport.signerName ? `Gez. ${rapport.signerName}` : 'Kunde'} ({rapport.date || new Date().toLocaleDateString('de-CH')})
            </Text>
          </View>

          <View style={localStyles.signatureBox}>
            <Text style={localStyles.signatureLabel}>Visum Techniker Q-Service</Text>
            {rapport.technicianSignature ? (
              <Image src={rapport.technicianSignature} style={localStyles.signatureImage} />
            ) : (
              <Text style={{ height: 50, color: '#94A3B8', marginTop: 15 }}>Gez. {rapport.technicianName || 'Techniker'}</Text>
            )}
            <Text style={localStyles.signerText}>
              {rapport.technicianName || 'Techniker'} ({rapport.date || new Date().toLocaleDateString('de-CH')})
            </Text>
          </View>
        </View>

        <PDFFooter data={data} />
      </Page>
    </Document>
  );
}
