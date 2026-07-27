export default function DashboardReportTableHeader() {
    return (
        <thead>
            <tr>
                <th style={{ width: '36px', position: 'sticky', top: 0, zIndex: 20, backgroundColor: 'var(--background)' }}></th>
                <th style={{ width: '100px', position: 'sticky', top: 0, zIndex: 20, backgroundColor: 'var(--background)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Nr.</th>
                <th style={{ width: '100px', position: 'sticky', top: 0, zIndex: 20, backgroundColor: 'var(--background)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Datum</th>
                <th style={{ minWidth: '150px', position: 'sticky', top: 0, zIndex: 20, backgroundColor: 'var(--background)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Schadenort</th>
                <th style={{ minWidth: '180px', position: 'sticky', top: 0, zIndex: 20, backgroundColor: 'var(--background)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Adresse</th>
                <th style={{ minWidth: '140px', position: 'sticky', top: 0, zIndex: 20, backgroundColor: 'var(--background)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Auftraggeber</th>
                <th style={{ minWidth: '110px', position: 'sticky', top: 0, zIndex: 20, backgroundColor: 'var(--background)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Bewirtschafter/in</th>
                <th style={{ minWidth: '140px', position: 'sticky', top: 0, zIndex: 20, backgroundColor: 'var(--background)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Schaden</th>
                <th style={{ width: '130px', position: 'sticky', top: 0, zIndex: 20, backgroundColor: 'var(--background)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Status</th>
                <th style={{ minWidth: '120px', position: 'sticky', top: 0, zIndex: 20, backgroundColor: 'var(--background)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Kunde von</th>

                <th style={{ width: '80px', textAlign: 'center', position: 'sticky', top: 0, zIndex: 20, backgroundColor: 'var(--background)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Geräte</th>
                <th style={{ width: '90px', textAlign: 'center', position: 'sticky', top: 0, zIndex: 20, backgroundColor: 'var(--background)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Rechnung</th>
                <th style={{ width: '80px', position: 'sticky', top: 0, zIndex: 20, backgroundColor: 'var(--background)' }}></th>
            </tr>
        </thead>
    );
}
