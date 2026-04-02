import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '2rem', color: 'white', background: '#7F1D1D', border: '2px solid #EF4444', margin: '1rem', borderRadius: '8px' }}>
                    <h1 style={{ color: '#FCA5A5' }}>⚠️ Ein Fehler ist aufgetreten</h1>
                    <p>Bitte teilen Sie folgende Fehlermeldung mit:</p>
                    <pre style={{ background: '#450A0A', padding: '1rem', overflow: 'auto', color: '#FCA5A5', borderRadius: '4px', fontSize: '0.8rem' }}>
                        {this.state.error && this.state.error.toString()}
                    </pre>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
