import React, { useRef, useState } from "react";
import styled from "styled-components";

/* Joystick táctil: aparece donde apoyas el pulgar y lee hasta donde llegas.
   Va en el DOM normal (FUERA del Canvas) y escribe en un ref compartido con el paseante.
   En pantallas táctiles se muestra siempre: el puntero capturado es cosa del ratón y en un
   móvil no existe, así que colgar el joystick de ahí era dejarlo sin aparecer nunca. */

const Zona = styled.div`
  position: fixed; left: 0; bottom: 0; width: 48vw; height: 66vh; z-index: 24;
  touch-action: none; -webkit-user-select: none; user-select: none;
`;
const Base = styled.div`
  position: absolute; width: 128px; height: 128px; margin: -64px 0 0 -64px;
  border-radius: 50%; border: 2px solid rgba(255, 255, 255, 0.42);
  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.4), inset 0 0 0 1px rgba(0, 0, 0, 0.2);
  opacity: 0; transition: opacity 0.15s; pointer-events: none;
  ${(p) => (p.on ? "opacity: 1;" : "")}
`;
const Aro = styled.div`
  position: absolute; inset: 9px; border-radius: 50%;
  border: 1.5px dashed rgba(255, 255, 255, 0.26);
`;
const Pomo = styled.div`
  position: absolute; left: 50%; top: 50%; width: 56px; height: 56px;
  margin: -28px 0 0 -28px; border-radius: 50%;
  background: radial-gradient(circle at 34% 28%, #fff, #d6d6d6 58%, #9c9c9c);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
`;
const PomoCorre = styled(Pomo)`
  background: radial-gradient(circle at 34% 28%, #fff, #d4af37 62%, #a8801d);
`;

const RADIO = 48;
const MUERTA = 0.14;

export function esTactil() {
  return (
    typeof window !== "undefined" &&
    (window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window)
  );
}

export default function Joystick({ salida }) {
  const [ver, setVer] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0, cx: 0, cy: 0, corre: false });
  const ref = useRef({ id: null, x0: 0, y0: 0 });

  const baja = (e) => {
    ref.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY };
    setPos({ x: 0, y: 0, cx: e.clientX, cy: e.clientY, corre: false });
    setVer(true);
  };

  const mueve = (e) => {
    if (ref.current.id !== e.pointerId) return;
    let dx = e.clientX - ref.current.x0;
    let dy = e.clientY - ref.current.y0;
    const n = Math.hypot(dx, dy);
    let x = 0, y = 0;
    if (n > 1) {
      const t = Math.min(1, n / RADIO);
      const l = (t - MUERTA) / (1 - MUERTA);
      if (l > 0) {
        x = (dx / n) * l;
        y = (dy / n) * l;
      }
      dx = (dx / n) * RADIO;
      dy = (dy / n) * RADIO;
    }
    const corre = Math.hypot(x, y) > 0.85;
    setPos({ cx: ref.current.x0, cy: ref.current.y0, x: dx, y: dy, corre });
    salida({ x, y, correr: corre });
  };

  const suelta = (e) => {
    if (ref.current.id !== e.pointerId) return;
    ref.current.id = null;
    setVer(false);
    salida({ x: 0, y: 0, correr: false });
  };

  return (
    <Zona onPointerDown={baja} onPointerMove={mueve} onPointerUp={suelta} onPointerCancel={suelta}>
      <Base on={ver} style={{ left: pos.cx, top: pos.cy }}>
        <Aro />
        {pos.corre ? (
          <PomoCorre style={{ transform: "translate(" + pos.x + "px," + pos.y + "px)" }} />
        ) : (
          <Pomo style={{ transform: "translate(" + pos.x + "px," + pos.y + "px)" }} />
        )}
      </Base>
    </Zona>
  );
}

export const Mira = styled.div`
  position: fixed; left: 50%; top: 50%; width: 5px; height: 5px; margin: -2.5px 0 0 -2.5px;
  z-index: 25; border-radius: 50%; background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 0 0 1.5px rgba(0, 0, 0, 0.55); pointer-events: none;
`;

export const AvisoPuerta = styled.div`
  position: fixed; left: 50%; top: 58%; transform: translateX(-50%); z-index: 25;
  background: rgba(18, 20, 16, 0.9); color: #fff; padding: 10px 18px; border-radius: 999px;
  font-size: 13px; font-weight: 600; pointer-events: none; white-space: nowrap;
  border: 1px solid rgba(212, 175, 55, 0.4);
`;