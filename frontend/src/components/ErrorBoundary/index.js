import React from "react";

/**
 * Camada de segurança contra telas brancas.
 *
 * Sem um ErrorBoundary, qualquer exceção durante o render desmonta toda a
 * aplicação e o usuário vê uma página em branco. Este componente captura o
 * erro, registra informação útil para diagnóstico (console + sessionStorage)
 * e mostra uma mensagem amigável, sem expor detalhes técnicos sensíveis.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorId: null };
  }

  static getDerivedStateFromError() {
    return { hasError: true, errorId: `E${Date.now().toString(36).toUpperCase()}` };
  }

  componentDidCatch(error, errorInfo) {
    const scope = this.props.scope || "app";
    const route =
      typeof window !== "undefined" && window.location
        ? window.location.pathname
        : "";

    const report = {
      id: this.state.errorId,
      scope,
      route,
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      at: new Date().toISOString()
    };

    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", report);

    try {
      window.sessionStorage.setItem("lastRenderError", JSON.stringify(report));
    } catch (storageError) {
      // eslint-disable-next-line no-console
      console.warn("[ErrorBoundary] não foi possível persistir o diagnóstico", storageError);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorId: null });
  };

  handleGoHome = () => {
    window.location.assign("/");
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        role="alert"
        style={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          boxSizing: "border-box"
        }}
      >
        <div
          style={{
            maxWidth: 440,
            width: "100%",
            textAlign: "center",
            borderRadius: 14,
            padding: "32px 24px",
            border: "1px solid rgba(127,127,127,0.24)",
            background: "rgba(127,127,127,0.06)"
          }}
        >
          <h2 style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 600 }}>
            Ocorreu um erro inesperado
          </h2>
          <p style={{ margin: "0 0 24px", fontSize: 14, lineHeight: 1.6, opacity: 0.8 }}>
            Não foi possível carregar esta tela. Você pode tentar novamente ou
            voltar ao início.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={this.handleRetry}
              style={{
                cursor: "pointer",
                borderRadius: 8,
                border: "none",
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 600,
                color: "#fff",
                background: "#065183"
              }}
            >
              Tentar novamente
            </button>
            <button
              type="button"
              onClick={this.handleGoHome}
              style={{
                cursor: "pointer",
                borderRadius: 8,
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 600,
                background: "transparent",
                border: "1px solid rgba(127,127,127,0.4)",
                color: "inherit"
              }}
            >
              Voltar ao início
            </button>
          </div>
          {this.state.errorId && (
            <p style={{ margin: "20px 0 0", fontSize: 12, opacity: 0.55 }}>
              Código de referência: {this.state.errorId}
            </p>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
