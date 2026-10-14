/* Pinta en pantalla cualquier error, para no depender de la consola: si la app se rompe se
   lee aquí qué pasó, en vez de quedarse en blanco sin decir nada. */
import React from "react";

export default function AvisoErrores() {
  React.useEffect(() => {
    const pon = (msg) => {
      let caja = document.getElementById("fabrick-error");
      if (!caja) {
        caja = document.createElement("div");
        caja.id = "fabrick-error";
        caja.style.cssText = [
          "position:fixed", "left:12px", "right:12px", "bottom:12px", "z-index:9999",
          "max-height:45vh", "overflow:auto", "background:#2a0e0e", "color:#ff9d9d",
          "border:1px solid #ff6b6b", "border-radius:8px", "padding:12px 14px",
          "font:12px/1.5 ui-monospace,Menlo,monospace", "white-space:pre-wrap",
          "box-shadow:0 10px 30px rgba(0,0,0,.5)"
        ].join(";");
        document.body.appendChild(caja);
      }
      caja.textContent = (caja.textContent + "\n" + msg).slice(-2500);
    };

    const onError = (e) => {
      const msg = e.message || String(e.reason || e);
      pon(msg + "\n  " + (e.filename || "?").split("/").pop() + ":" + e.lineno);
      if (e.error && e.error.stack) pon(e.error.stack);
    };
    const onRechazo = (ev) => {
      const razon = ev.reason && (ev.reason.message || ev.reason);
      if (razon) pon("promesa rechazada: " + razon);
    };

    addEventListener("error", onError);
    addEventListener("unhandledrejection", onRechazo);
    return () => {
      removeEventListener("error", onError);
      removeEventListener("unhandledrejection", onRechazo);
    };
  }, []);

  return null;
}