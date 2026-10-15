import React, { useState, useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { Canvas, useThree, useFrame } from "react-three-fiber";
import styled from "styled-components";
import Joystick, { Mira, AvisoPuerta, esTactil } from "../components/Joystick";
import LogoFabrick from "../components/UI/LogoFabrick";
import { SinRuptura, AvisoEscena } from "../components/SinRuptura";
import { PonCenso, VerCenso } from "../components/Censo";

/* FABRICA — la casa del plano, en primera persona.
 *
 * Reglas que se han aprendido a la fuerza aquí, y que conviene no volver a romper:
 *  1. Dentro de <Canvas> SOLO objetos de three.js. Nada de HTML: si aparece un <div>, R3F
 *     lo busca en el espacio THREE y dice "X is not part of the THREE namespace!".
 *  2. Nada de <primitive attach="..."> ni de attach="background". Esos acoplamientos son
 *     frágiles en R3F 4 y revientan con "Cannot read __container" dentro de commitUpdate.
 *     Los materiales van como prop `material={...}`.
 *  3. Las colisiones seSacan de una lista de rectángulos escrita a mano, no de medir la
 *     geometría con Box3: es más rápido y no depende del orden de montaje.
 *
 * El resto —el joystick, la cámara, la lógica— es la del app original, que ya funcionaba. */

const M = {
  ancho: 12.0,
  fondo: 9.25,
  alto: 2.5,
  grosor: 0.22,
  puertaAncho: 0.95,
  puertaAlto: 2.1,
  ojos: 1.65
};

/* Muros: [cx, cz, largo, eje] — centro, y si el largo va en X o en Z. */
const MUROS_EXTERIORES = [
  [6.0, 0.0, 12.0, "x"],       // fachada
  [6.0, 9.25, 12.0, "x"],      // fondo
  [0.0, 4.625, 9.25, "z"],     // izquierda
  [12.0, 4.625, 9.25, "z"]     // derecha
];

const MUROS_INTERNOS = [
  [4.0, 4.625, 9.25, "z"],
  [8.0, 4.625, 9.25, "z"],
  [2.0, 4.0, 4.0, "x"],
  [2.0, 5.75, 4.0, "x"],
  [6.0, 4.0, 4.0, "x"],
  [10.0, 2.25, 4.0, "x"],
  [10.25, 3.125, 1.75, "z"],
  [6.0, 4.5, 4.0, "x"],
  [8.0, 4.5, 9.25, "z"]
];

/* Puertas internas: [x, z,_sentido]. El hueco se come el tramo de muro que las rodea. */
const PUERTAS_INT = [
  [6.0, 4.0, 1], [8.0, 6.5, 1], [4.0, 7.5, 1], [4.0, 4.875, 1],
  [8.0, 1.2, 1], [8.0, 3.1, 1], [10.25, 3.1, 1], [4.0, 2.0, 1], [2.0, 4.0, 1]
];
const PUERTA_PRINCIPAL = [6.0, 0.0, 1.2];

/* Ventanas: [x, z, ancho, alto, y] */
const VENTANAS = [
  [2.0, 0, 1.2, 1.2, 1.0], [8.5, 0, 1.4, 1.3, 0.9],
  [0, 2.0, 1.2, 1.2, 1.0], [0, 7.5, 1.4, 1.3, 0.9],
  [2.0, 9.25, 1.4, 1.3, 0.9], [6.0, 9.25, 1.6, 1.4, 0.9], [10.0, 9.25, 1.4, 1.3, 0.9],
  [12.0, 1.125, 1.0, 1.1, 1.0], [12.0, 6.5, 1.4, 1.3, 0.9]
];

const ESTANCIAS = [
  ["rec2", "Recámara 2", 0, 0, 4, 4], ["ban2", "Baño 2", 0, 4, 4, 5.75],
  ["rec3", "Recámara 3", 0, 5.75, 4, 9.25], ["comed", "Comedor", 4, 0, 8, 4],
  ["sala", "Sala", 4, 4, 8, 9.25], ["coc", "Cocina", 8, 0, 12, 2.25],
  ["lava", "Lavadero", 8, 2.25, 10.25, 4], ["ban1", "Baño 1", 10.25, 2.25, 12, 4],
  ["rec1", "Recámara 1", 8, 4, 12, 9.25]
];

/* Rectángulos que frenan al paseante. X: [minX, maxX, minZ, maxZ] */
function rectangulos() {
  const r = [];
  const t = M.grosor / 2;
  MUROS_EXTERIORES.forEach(([cx, cz, largo, eje]) => {
    if (eje === "x") r.push([cx - largo / 2, cx + largo / 2, cz - t, cz + t]);
    else r.push([cx - t, cx + t, cz - largo / 2, cz + largo / 2]);
  });
  MUROS_INTERNOS.forEach(([cx, cz, largo, eje]) => {
    if (eje === "x") r.push([cx - largo / 2, cx + largo / 2, cz - t, cz + t]);
    else r.push([cx - t, cx + t, cz - largo / 2, cz + largo / 2]);
  });
  return r;
}

/* Trozos de muro que quedan entre los huecos de esa pared. */
function trozos(de, hasta, huecos) {
  const libre = huecos.map(h => [Math.max(de, h[0]), Math.min(hasta, h[1])])
    .filter(h => h[1] > h[0]).sort((a, b) => a[0] - b[0]);
  const out = [];
  let c = de;
  libre.forEach(([a, b]) => { if (a > c) out.push([c, a]); c = Math.max(c, b); });
  if (c < hasta) out.push([c, hasta]);
  return out;
}

const huecosDe = { N: [], S: [], O: [], E: [] };
{
  const d = PUERTA_PRINCIPAL[2] / 2;
  huecosDe.N.push([PUERTA_PRINCIPAL[0] - d, PUERTA_PRINCIPAL[0] + d]);
  VENTANAS.forEach(([x, z, w]) => {
    if (z === 0) huecosDe.N.push([x - w / 2 - 0.08, x + w / 2 + 0.08]);
    else if (z === M.fondo) huecosDe.S.push([x - w / 2 - 0.08, x + w / 2 + 0.08]);
    else if (x === 0) huecosDe.O.push([z - w / 2 - 0.08, z + w / 2 + 0.08]);
    else if (x === M.ancho) huecosDe.E.push([z - w / 2 - 0.08, z + w / 2 + 0.08]);
  });
}

const huecosInt = MUROS_INTERNOS.map(m => {
  const [cx, cz, largo, eje] = m;
  return PUERTAS_INT
    .filter(p => Math.abs((eje === "x" ? p[1] : p[0]) - (eje === "x" ? cz : cx)) < 0.05 &&
      (eje === "x" ? p[0] : p[1]) >= cx - largo / 2 && (eje === "x" ? p[0] : p[1]) <= cx + largo / 2)
    .map(p => {
      const c = eje === "x" ? p[0] : p[1];
      return [c - M.puertaAncho / 2 - 0.06, c + M.puertaAncho / 2 + 0.06];
    });
});

/* ===================== dentro del Canvas ===================== */

function Paredes({ matPintura, matExt }) {
  const piezas = [];
  let k = 0;

  MUROS_EXTERIORES.forEach(([cx, cz, largo, eje], i) => {
    const huecos = huecosDe[cz === 0 ? "N" : cz === M.fondo ? "S" : cx === 0 ? "O" : "E"];
    trozos(eje === "x" ? cx - largo / 2 : cz - largo / 2,
           eje === "x" ? cx + largo / 2 : cz + largo / 2, huecos)
      .forEach(([a, b]) => {
        const L = b - a;
        const c = (a + b) / 2;
        piezas.push(
          <mesh key={"e" + i + k++} position={eje === "x" ? [c, M.alto / 2, cz] : [cx, M.alto / 2, c]}
            material={matExt} castShadow receiveShadow>
            <boxGeometry args={eje === "x" ? [L, M.alto, M.grosor] : [M.grosor, M.alto, L]} />
          </mesh>
        );
      });
  });

  MUROS_INTERNOS.forEach(([cx, cz, largo, eje], i) => {
    const huecos = huecosInt[i];
    trozos(eje === "x" ? cx - largo / 2 : cz - largo / 2,
           eje === "x" ? cx + largo / 2 : cz + largo / 2, huecos)
      .forEach(([a, b]) => {
        const L = b - a;
        const c = (a + b) / 2;
        piezas.push(
          <mesh key={"i" + i + k++} position={eje === "x" ? [c, M.alto / 2, cz] : [cx, M.alto / 2, c]}
            material={matPintura} castShadow receiveShadow>
            <boxGeometry args={eje === "x" ? [L, M.alto, M.grosor] : [M.grosor, M.alto, L]} />
          </mesh>
        );
      });
  });

  return <group>{piezas}</group>;
}

function Suelo({ mat }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[M.ancho / 2, 0, M.fondo / 2]}
      receiveShadow material={mat}>
      <planeGeometry args={[M.ancho, M.fondo]} />
    </mesh>
  );
}

function Techo({ mat }) {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[M.ancho / 2, M.alto, M.fondo / 2]} material={mat}>
      <planeGeometry args={[M.ancho, M.fondo]} />
    </mesh>
  );
}

function VentanaM({ x, z, w, h, y, marco, cristal }) {
  const horizontal = z === 0 || z === M.fondo;
  const pos = [horizontal ? x : (x === 0 ? -0.02 : M.ancho + 0.02), y, horizontal ? (z === 0 ? -0.02 : M.fondo + 0.02) : z];
  const rot = horizontal ? 0 : Math.PI / 2;
  return (
    <group position={pos} rotation={[0, rot, 0]}>
      <mesh material={cristal}>
        <planeGeometry args={[w, h]} />
      </mesh>
      <mesh position={[0, h / 2, 0]} material={marco}>
        <boxGeometry args={[w + 0.14, 0.09, 0.1]} />
      </mesh>
      <mesh position={[0, -h / 2, 0]} material={marco}>
        <boxGeometry args={[w + 0.14, 0.09, 0.1]} />
      </mesh>
      <mesh position={[w / 2, 0, 0]} material={marco}>
        <boxGeometry args={[0.09, h, 0.1]} />
      </mesh>
      <mesh position={[-w / 2, 0, 0]} material={marco}>
        <boxGeometry args={[0.09, h, 0.1]} />
      </mesh>
    </group>
  );
}

export const PUERTAS = {};

function Puerta({ x, z, giro, ancho, mat }) {
  const hoja = useRef();
  const st = useRef({ abierta: false, ang: 0 });
  const id = "p" + x + "_" + z;

  useEffect(() => {
    PUERTAS[id] = () => { st.current.abierta = !st.current.abierta; };
  }, [id]);

  useFrame((_, dt) => {
    if (!hoja.current) return;
    const obj = st.current.abierta ? giro * Math.PI / 2 : 0;
    st.current.ang += (obj - st.current.ang) * Math.min(1, dt * 8);
    hoja.current.rotation.y = st.current.ang;
  });

  return (
    <group position={[x, 0, z]}>
      <group ref={hoja} position={[ancho / 2, 0, 0]}>
        <mesh position={[-ancho / 2, M.puertaAlto / 2, 0]} material={mat} castShadow>
          <boxGeometry args={[ancho, M.puertaAlto, 0.06]} />
        </mesh>
        <mesh position={[ancho / 2 - 0.13, 1.05, 0.055]}>
          <sphereGeometry args={[0.045, 10, 10]} />
          <meshStandardMaterial color="#c9a24a" metalness={0.75} roughness={0.28} />
        </mesh>
      </group>
    </group>
  );
}

/* ===================== paseante ===================== */

function Paseante({ rects, entrada, onEstado }) {
  // Sin selector: el app original siempre desestructura el estado entero
  // (`const { camera, gl, scene } = useThree()`). Con selector, el estado devuelve
  // undefined mientras three no ha montado la camara, y entonces `camara.rotation`
  // no existe: "Cannot set properties of undefined (setting 'order')".
  const { camera: camara, gl } = useThree();
  const listo = useRef(false);
  const teclas = useRef({});
  const yaw = useRef(Math.PI);
  const pitch = useRef(-0.05);
  const arrastra = useRef({ id: null, x: 0, y: 0 });
  const cada = useRef(0);

  useEffect(() => {
    if (!camara) return;
    const kd = e => { teclas.current[e.code] = true; };
    const ku = e => { teclas.current[e.code] = false; };
    const ke = e => {
      if (e.code === "KeyE") {
        const id = idPuertaCerca();
        if (id && PUERTAS[id]) PUERTAS[id]();
      }
      if (e.code === "KeyQ") yaw.current += 0.18;
      if (e.code === "KeyA") yaw.current -= 0.18;
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    window.addEventListener("keydown", ke);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("keydown", ke);
    };
  }, [camara]);

  const idPuertaCerca = () => {
    let mejor = null, dm = 2.1;
    for (const id in PUERTAS) {
      const [px, pz] = id.slice(1).split("_").map(Number);
      const d = Math.hypot(px - camara.position.x, pz - camara.position.z);
      if (d < dm) { dm = d; mejor = id; }
    }
    return mejor;
  };

  /* Ratón capturado: se mira con el ratón. Táctil: arrastrando a la derecha. */
  useEffect(() => {
    const dom = document.querySelector("canvas");
    if (!dom || !camara) return;
    const bloqueado = () => document.pointerLockElement === dom;
    const move = e => {
      if (bloqueado()) {
        yaw.current -= e.movementX * 0.0022;
        pitch.current = Math.max(-1.3, Math.min(1.3, pitch.current - e.movementY * 0.0022));
      }
    };
    const down = e => {
      if (bloqueado() || e.pointerType !== "touch") return;
      const r = dom.getBoundingClientRect();
      if (e.clientX < r.left + r.width / 2) return;      // mitad izquierda = joystick
      arrastra.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    };
    const dm = e => {
      if (arrastra.current.id !== e.pointerId) return;
      yaw.current -= (e.clientX - arrastra.current.x) * 0.005;
      pitch.current = Math.max(-1.3, Math.min(1.3, pitch.current - (e.clientY - arrastra.current.y) * 0.005));
      arrastra.current.x = e.clientX;
      arrastra.current.y = e.clientY;
    };
    const up = e => { if (arrastra.current.id === e.pointerId) arrastra.current.id = null; };
    const lock = () => { if (onEstado) onEstado({ bloqueo: true }); };
    const un = () => { if (onEstado) onEstado({ bloqueo: false }); };

    window.addEventListener("mousemove", move);
    dom.addEventListener("pointerdown", down);
    dom.addEventListener("pointermove", dm);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    document.addEventListener("pointerlockchange", un);
    dom.addEventListener("click", () => {
      if (!bloqueado() && dom.requestPointerLock) {
        try { const p = dom.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
      }
    });
    document.addEventListener("pointerlockchange", lock);
    return () => {
      window.removeEventListener("mousemove", move);
      dom.removeEventListener("pointerdown", down);
      dom.removeEventListener("pointermove", dm);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      document.removeEventListener("pointerlockchange", lock);
      document.removeEventListener("pointerlockchange", un);
    };
  }, [camara, onEstado]);

  useFrame((_, delta) => {
    if (!camara || !camara.rotation) return;

    // La camara se coloca en el primer frame, cuando three ya la ha montado de verdad.
    if (!listo.current) {
      listo.current = true;
      camara.rotation.order = "YXZ";
      camara.position.set(6, M.ojos, -3.5);
      camara.fov = 72;
      camara.updateProjectionMatrix();
    }

    const dt = Math.min(0.05, delta);
    const t = teclas.current;
    const e = (entrada && entrada.current) || { x: 0, y: 0, correr: false };

    let ad = 0, lat = 0;
    if (t.KeyW || t.ArrowUp) ad += 1;
    if (t.KeyS || t.ArrowDown) ad -= 1;
    if (t.KeyA || t.ArrowLeft) lat -= 1;
    if (t.KeyD || t.ArrowRight) lat += 1;
    ad += -e.y;
    lat += e.x;
    const n = Math.hypot(ad, lat);
    if (n > 1) { ad /= n; lat /= n; }

    const v = ((t.ShiftLeft || t.ShiftRight || e.correr) ? 3.4 : 1.6) * dt;
    const sy = Math.sin(yaw.current), cy = Math.cos(yaw.current);
    const dx = (-sy * ad + cy * lat) * v;
    const dz = (-cy * ad - sy * lat) * v;

    const R = 0.3;
    const x0 = camara.position.x, z0 = camara.position.z;
    const choca = (nx, nz) => rects.some(r =>
      nx > r[0] - R && nx < r[1] + R && nz > r[2] - R && nz < r[3] + R);

    if (!choca(x0 + dx, z0 + dz)) { camara.position.x = x0 + dx; camara.position.z = z0 + dz; }
    else if (!choca(x0 + dx, z0)) camara.position.x = x0 + dx;
    else if (!choca(x0, z0 + dz)) camara.position.z = z0 + dz;

    if (camara.position.y < M.ojos) camara.position.y = M.ojos;
    camara.rotation.set(pitch.current, yaw.current, 0, "YXZ");

    cada.current += delta;
    if (cada.current > 0.15) {
      cada.current = 0;
      const x = camara.position.x, z = camara.position.z;
      const est = ESTANCIAS.find(s => x >= s[2] && x <= s[4] && z >= s[3] && z <= s[5]);
      if (onEstado) onEstado({ estancia: est ? est[1] : "Exterior", puerta: idPuertaCerca() });
    }
  });

  return null;
}

function Luces() {
  return (
    <group>
      <ambientLight intensity={0.45} />
      <hemisphereLight args={["#dcebf5", "#9c8a68", 0.5]} />
      <directionalLight
        position={[16, 22, -10]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-32}
        shadow-camera-right={32}
        shadow-camera-top={32}
        shadow-camera-bottom={-32}
        shadow-bias={-0.0007}
      />
      <directionalLight position={[-14, 10, 16]} intensity={0.28} />
      <pointLight position={[6, 2.2, 6]} intensity={0.35} distance={14} decay={1.4} />
    </group>
  );
}

const MARCO = new THREE.MeshStandardMaterial({ color: "#1b1b1b", roughness: 0.5, metalness: 0.2 });
const CRISTAL = new THREE.MeshStandardMaterial({
  color: "#a9d6ec", transparent: true, opacity: 0.26, roughness: 0.06, metalness: 0.1
});
const MADERA = new THREE.MeshStandardMaterial({ color: "#7d5c3d", roughness: 0.7 });

/* ===================== fuera del Canvas ===================== */


/* Ojo: styled-components va por la v5 y ahí `.extend` ya no existe (salía en la v3).
   Cada bloque es su propio styled.div. */
/* Abajo a la izquierda y plegable: antes estaba arriba a la derecha y se solapaba con el
   logo. Arriba solo queda el logo. */
const Ayuda = styled.div`
  position: fixed; left: 12px; bottom: 12px; z-index: 26; max-width: 52vw;
  background: rgba(18, 20, 16, 0.88); color: #fff; border-radius: 12px;
  padding: 12px 14px; font-size: 12px; line-height: 1.6;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(212, 175, 55, 0.25);
  b { color: #d4af37; }
  h4 { margin: 0 0 8px; font-size: 10.5px; letter-spacing: .14em;
       text-transform: uppercase; color: #d4af37; font-weight: 700; }
`;
const Etiqueta = styled.div`
  position: fixed; left: 50%; top: 26px; transform: translateX(-50%); z-index: 25;
  color: #fff; font-size: 13px; font-weight: 700; letter-spacing: 0.16em;
  text-transform: uppercase; text-shadow: 0 2px 10px rgba(0, 0, 0, 0.95); pointer-events: none;
`;
const Panel = styled.aside`
  position: fixed; right: 12px; bottom: 12px; z-index: 26; width: 232px;
  background: rgba(18, 20, 16, 0.9); color: #fff; border-radius: 12px; padding: 15px;
  font-size: 12.5px; display: grid; gap: 10px;
  border: 1px solid rgba(212, 175, 55, 0.28);
  h3 { margin: 0; font-size: 10.5px; letter-spacing: 0.15em; text-transform: uppercase; color: #d4af37; font-weight: 700; }
`;
const Chips = styled.div`
  display: flex; gap: 5px; flex-wrap: wrap;
  button {
    font: inherit; font-size: 11px; padding: 7px 10px; cursor: pointer; border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.22); background: transparent; color: #fff;
    transition: all .15s;
  }
  button:hover { border-color: #d4af37; }
  button[aria-pressed='true'] { background: #d4af37; color: #111; border-color: #d4af37; font-weight: 700; }
`;

const PINTURAS = [
  ["#FFFFFF", "Blanco"], ["#EDE3D2", "Arena"], ["#D6D8D5", "Perla"],
  ["#C9D3C0", "Salvia"], ["#C3D2DD", "Cielo"], ["#E4C9B4", "Terracota"]
];
const WPC = ["#a9763f", "#5c3d24", "#2f3237", "#8e8e8a"];
const PISOS = ["#a9763f", "#cfc7b8", "#5a4a3a"];

export default function Fabrica() {
  const [tactil, setTactil] = useState(false);
  useEffect(() => { setTactil(esTactil()); }, []);
  const [pintura, setPintura] = useState(PINTURAS[0][0]);
  const [wpc, setWpc] = useState(WPC[0]);
  const [piso, setPiso] = useState(PISOS[0]);
  const [est, setEst] = useState({ bloqueo: false, estancia: "Exterior", puerta: null });
  const entrada = useRef({ x: 0, y: 0, correr: false });
  const rects = useMemo(rectangulos, []);

  const matPiso = useMemo(() => new THREE.MeshStandardMaterial({ color: piso, roughness: 0.55 }), [piso]);
  const matWpc = useMemo(() => new THREE.MeshStandardMaterial({ color: wpc, roughness: 0.62 }), [wpc]);

  useEffect(() => {
    if (!est.bloqueo && est.puerta) PUERTAS[est.puerta] && PUERTAS[est.puerta]();
  }, [est.puerta]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#b9d0e2" }}>
      <Canvas gl={{ antialias: true }} camera={{ fov: 72, position: [6, M.ojos, -3.5] }}>        <SinRuptura>
          <PonCenso />
                  <Luces />
                  <Suelo mat={matPiso} />
                  <Techo mat={useMemo(() => new THREE.MeshStandardMaterial({ color: "#f7f5f0", roughness: 0.95 }), [])} />
                  <Paredes
                    matPintura={useMemo(() => new THREE.MeshStandardMaterial({ color: pintura, roughness: 0.94 }), [pintura])}
                    matExt={useMemo(() => new THREE.MeshStandardMaterial({ color: "#ded5c2", roughness: 0.88 }), [])}
                  />
                  {ESTANCIAS.map(s => (
                    <mesh key={s[0]} position={[(s[2] + s[4]) / 2, 1.35, s[3] + 0.015]} material={matWpc}>
                      <planeGeometry args={[s[4] - s[2] - 0.5, 1.0]} />
                    </mesh>
                  ))}
                  {VENTANAS.map((v, i) => (
                    <VentanaM key={i} x={v[0]} z={v[1]} w={v[2]} h={v[3]} y={v[4]} marco={MARCO} cristal={CRISTAL} />
                  ))}
                  {PUERTAS_INT.map((p, i) => (
                    <Puerta key={i} x={p[0]} z={p[1]} giro={p[2]} ancho={M.puertaAncho} mat={MADERA} />
                  ))}
                  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[M.ancho / 2, -0.04, 4]} receiveShadow>
                    <planeGeometry args={[300, 300]} />
                    <meshStandardMaterial color="#6d8d58" roughness={1} />
                  </mesh>
                  <Paseante rects={rects} entrada={entrada} onEstado={setEst} />
                
        </SinRuptura>
</Canvas>

      <AvisoEscena />
      <VerCenso />
      <LogoFabrick ancho={158} />
      <Ayuda>
        <b>WASD</b> andar · <b>ratón</b> mirar · <b>Shift</b> correr
        <br />
        <b>Clic</b> para capturar el ratón
        <br />
        <b>E</b> abre y cierra la puerta de enfrente
        <br />
        Móvil: joystick y arrastra a la derecha
      </Ayuda>
      <Etiqueta>{est.estancia}</Etiqueta>
      <Mira />
      {tactil ? <Joystick salida={(v) => Object.assign(entrada.current, v)} /> : null}
      {est.puerta ? <AvisoPuerta>Toca o pulsa E para abrir</AvisoPuerta> : null}
      
      <Panel>
        <h3>Pintura Fabrick</h3>
        <Chips>
          {PINTURAS.map(p => (
            <button key={p[0]} aria-pressed={pintura === p[0]} onClick={() => setPintura(p[0])}>{p[1]}</button>
          ))}
        </Chips>
        <h3>Wall panel WPC</h3>
        <Chips>
          {["Roble", "Nogal", "Carbón", "Gris"].map((n, i) => (
            <button key={n} aria-pressed={wpc === WPC[i]} onClick={() => setWpc(WPC[i])}>{n}</button>
          ))}
        </Chips>
        <h3>Piso</h3>
        <Chips>
          {["Madera", "Baldosa", "Noble"].map((n, i) => (
            <button key={n} aria-pressed={piso === PISOS[i]} onClick={() => setPiso(PISOS[i])}>{n}</button>
          ))}
        </Chips>
      </Panel>
    </div>
  );
}