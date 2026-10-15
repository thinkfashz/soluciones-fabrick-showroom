import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { useThree, useFrame } from "react-three-fiber";
import { NPC, PersonajeJugador } from "./Personajes";

/* ---- Qué se puede pisar dentro de la habitacion.
   En vez de escribir medidas a ojo, se mide la maqueta cuando ya esta cargada: se buscan las
   mallas del interior (paredes, suelo) y se saca su caja envolvente. Asi los limites se
   ajustan solos a la habitacion, Gabe la que sea, y no hay que volver a tocarlos. */
const RESGUARDO = 0.42;      // se deja este margen para que la camara no entre en la pared

function useRecinto() {
  const { scene } = useThree();
  const [caja, setCaja] = useState(null);
  const buscando = useRef(false);

  useFrame(() => {
    if (caja || buscando.current) return;
    buscando.current = true;

    const mallas = [];
    scene.traverse((o) => {
      if (o.isMesh && /interior|wall|floor|room/i.test(o.name || "")) mallas.push(o);
    });
    if (mallas.length) {
      const b = new THREE.Box3();
      mallas.forEach((o) => b.union(new THREE.Box3().setFromObject(o)));
      if (!b.isEmpty() && isFinite(b.min.x) && isFinite(b.max.x)) setCaja(b);
    } else {
      buscando.current = false;    // el modelo aun no ha llegado: se vuelve a intentar
    }
  });

  return caja;
}

/* ---- No dejar salir de la habitacion ------------------------------------
   Aprieta la camara dentro del interior. While vuela a una vista cinematografica no se toca,
   porque esas vistas pueden mirar desde otro sitio; ademas, en cuanto el usuario toca la
   pantalla, los limites vuelven a mandar. */
export function Limites() {
  const { camera } = useThree();
  const recinto = useRecinto();
  const libre = useRef(false);

  useEffect(() => {
    const alTocar = () => { libre.current = false; };
    document.addEventListener("pointerdown", alTocar);
    return () => document.removeEventListener("pointerdown", alTocar);
  }, []);

  useFrame(() => {
    if (window.fabrickVolando) { libre.current = true; return; }
    if (libre.current || !recinto) return;

    const minX = recinto.min.x + RESGUARDO;
    const maxX = recinto.max.x - RESGUARDO;
    const minZ = recinto.min.z + RESGUARDO;
    const maxZ = recinto.max.z - RESGUARDO;
    const p = camera.position;

    // si la caja medida sale rara (un solo objeto enorme), se deja pasar
    if (!(maxX > minX && maxZ > minZ)) return;

    const x = Math.max(minX, Math.min(maxX, p.x));
    const z = Math.max(minZ, Math.min(maxZ, p.z));
    if (x !== p.x || z !== p.z) {
      p.x = x;
      p.z = z;
      window.fabrickChocando = true;
      setTimeout(() => { window.fabrickChocando = false; }, 120);
    }
    // altura de ojos: entre el suelo y el techo
    if (p.y < recinto.min.y + 1.2) p.y = recinto.min.y + 1.2;
    if (p.y > recinto.max.y - 0.6) p.y = recinto.max.y - 0.6;
  });

  return null;
}

/* ---- A que velocidad anda el jugador, para animar al personaje ------------ */
export function Velocidad() {
  const { camera } = useThree();
  const antes = useRef(null);
  useFrame(() => {
    const a = antes.current;
    const ahora = { x: camera.position.x, z: camera.position.z, t: performance.now() };
    antes.current = ahora;
    if (window.fabrickVelocidad === undefined) window.fabrickVelocidad = 0;
    if (!a) return;
    const dt = Math.max(0.016, (ahora.t - a.t) / 1000);
    const s = Math.hypot(a.x - ahora.x, a.z - ahora.z) / dt;
    // suavizado: si no, la animacion cambia de clip a cada paso
    window.fabrickVelocidad += (s - window.fabrickVelocidad) * 0.15;
  });
  return null;
}

/* ---- Los personajes de la escena -----------------------------------------
   El del jugador va pegado a la camara (primera persona, con la cabeza oculta).
   Los otros dos se comportan solos con los clips del modelo:
     · uno va y viene por la habitacion, y cada tanto se sienta
     · el otro esta sentado a la mesa, se levanta, saluda, da el pulgar y se vuelve a sentar
   -------------------------------------------------------------------------- */

const MESA = [1.9, 0, 4.6];        // donde esta la mesa de la maqueta

export function Habitacion() {
  return (
    <>
      <PersonajeJugador />

      {/* el que recorre la habitacion */}
      <NPC
        inicio="Walking"
        guion={(api, dt, pon) => {
          const m = api.raiz;
          if (!m.userData.guion) {
            m.userData.guion = { t: 0, paso: 0, sentado: false };
            m.position.set(-1.4, 0, 2.2);
          }
          const g = m.userData.guion;
          g.t += dt;

          // cada 12 s se sienta un rato y se levanta
          const ciclo = g.t % 24;
          if (ciclo < 12) {
            if (g.paso !== 0) { g.paso = 0; g.sentado = false; pon("Walking"); }
            // va y viene por el centro de la habitacion
            const f = g.t * 0.55;
            const x = -1.4 + Math.sin(f) * 2.0;
            const z = 2.2 + Math.cos(f * 0.5) * 1.1;
            const dx = x - m.position.x;
            m.position.x = x;
            m.position.z = z;
            if (Math.abs(dx) > 0.0005) m.rotation.y = Math.atan2(dx, Math.cos(f * 0.5) * 0.55);
          } else {
            if (g.paso !== 1) { g.paso = 1; g.sentado = true; pon("Sitting"); }
            m.position.set(MESA[0] - 0.45, 0, MESA[2]);
            m.rotation.y = -Math.PI / 2;
          }
        }}
      />

      {/* el que esta a la mesa y va saludando */}
      <NPC
        inicio="Sitting"
        guion={(api, dt, pon) => {
          const m = api.raiz;
          if (!m.userData.guion) {
            m.userData.guion = { t: 0, paso: -1 };
            m.position.set(MESA[0], 0, MESA[2]);
            m.rotation.y = Math.PI;
          }
          const g = m.userData.guion;
          g.t += dt;
          const ciclo = g.t % 17;

          const pasos = [
            { a: 0,  d: 6.5, n: "Sitting"   },
            { a: 6.5, d: 7.4, n: "Standing"  },
            { a: 7.4, d: 10.0, n: "Wave"      },
            { a: 10.0, d: 13.5, n: "ThumbsUp"  },
            { a: 13.5, d: 17.0, n: "Sitting"   }
          ];
          const siguiente = pasos.filter((p) => ciclo >= p.a)[0];
          if (siguiente && siguiente.n !== g.paso) { g.paso = siguiente.n; pon(siguiente.n); }
        }}
      />
    </>
  );
}