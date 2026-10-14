import React from "react";

/* Si un componente revienta al dibujarse, React lo lanza hacia arriba y sin esto se queda la
   pantalla en blanco sin decir nada. Aquí se atrapa y se enseña qué pasó.
   Ojo: no todo lo que lanza React es un Error normal (a veces es undefined o un string), así
   que hay que convertirlo a texto y sacar también el componentStack de React, que es lo que
   dice qué componente falló. */

function textoError(e) {
  if (!e) return "sin valor (undefined o null)";
  if (typeof e === "string") return e;
  const partes = [];
  partes.push("tipo: " + typeof e);
  try {
    partes.push("mensaje: " + String(e.message !== undefined ? e.message : e));
  } catch (x) { partes.push("mensaje: <ilegible>"); }
  if (e.stack) partes.push(e.stack);
  else {
    partes.push("sin .stack");
    try { partes.push(JSON.stringify(e)); } catch (x) { partes.push("<no serializable>"); }
  }
  return partes.join("\n");
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, pila: "" };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (typeof console !== "undefined") console.error("Fabrica:", error, info);
    if (info && info.componentStack) {
      this.setState({ pila: info.componentStack });
    }
    if (window.__sfYaArranco) window.__sfYaArranco();
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 2147483647,
            background: "#1a0f0f", color: "#ffb4b4", padding: "14px 16px",
            borderTop: "2px solid #ff5c5c", maxHeight: "65vh", overflow: "auto",
            font: "11.5px/1.5 ui-monospace,Menlo,Consolas,monospace", whiteSpace: "pre-wrap"
          }}
        >
          <b style={{ color: "#ff5c5c" }}>La escena no se ha podido dibujar</b>
          {"\n\n--- error ---\n"}
          {textoError(this.state.error)}
          {"\n\n--- pila de React ---\n"}
          {this.state.pila || "(React no la dio)"}
        </div>
      );
    }
    return this.props.children;
  }
}