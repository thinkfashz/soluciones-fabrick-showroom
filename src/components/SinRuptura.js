import React from "react";

/* React Three Fiber crea SU PROPIO root de React dentro de <Canvas>. Por eso el
 * ErrorBoundary que envuelve a la app (que vive en el DOM normal) NO se entera de nada de
 * lo que pase dentro del lienzo: el error muere allí y el canvas se queda en blanco, sin
 * decir absolutamente nada. Es lo que pasaba.
 *
 * Este es un ErrorBoundary que va DENTRO del Canvas. Al saltar no devuelve HTML (R3F no lo
 * acepta dentro de la escena), sino null, y deja el aviso en un almacén compartido que un
 * componente del DOM normal escucha y pinta. */

const oyentes = [];
let aviso = [];

export function errores() {
  return aviso;
}

export function limpiaErrores() {
  aviso = [];
  oyentes.forEach((f) => f());
}

export function avisa(texto) {
  aviso = aviso.concat(texto);
  oyentes.forEach((f) => f());
}

export class SinRuptura extends React.Component {
  constructor(p) {
    super(p);
    this.state = { roto: false };
  }

  static getDerivedStateFromError(e) {
    return { roto: true };
  }

  componentDidCatch(error, info) {
    const partes = ["ERROR EN LA ESCENA: " + (error && (error.message || String(error)))];
    if (error && error.stack) partes.push(error.stack);
    if (info && info.componentStack) partes.push("pila:\n" + info.componentStack);
    try {
      if (window.console) window.console.error("[Fabrica]", error, info);
    } catch (e) {}
    avisa(partes.join("\n"));
  }

  render() {
    // dentro del Canvas solo podemos devolver objetos de three.js o nada
    return this.state.roto ? null : this.props.children;
  }
}

/* Componente normal (fuera del Canvas) que pinta lo que SinRuptura ha reportado. */
export function AvisoEscena() {
  const [, forzar] = React.useState(0);
  React.useEffect(() => {
    const f = () => forzar((n) => n + 1);
    oyentes.push(f);
    return () => {
      const i = oyentes.indexOf(f);
      if (i >= 0) oyentes.splice(i, 1);
    };
  }, []);
  const lista = errores();
  if (!lista.length) return null;
  return React.createElement(
    "div",
    {
      style: {
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 2147483647,
        background: "#1a0f0f", color: "#ffb4b4", padding: "12px 14px",
        borderTop: "2px solid #ff5c5c", maxHeight: "60vh", overflow: "auto",
        font: "11.5px/1.5 ui-monospace,Menlo,Consolas,monospace", whiteSpace: "pre-wrap"
      }
    },
    "ERROR EN LA ESCENA\n\n" + lista.join("\n\n")
  );
}