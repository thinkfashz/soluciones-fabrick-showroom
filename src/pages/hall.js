import React, { Suspense, useState, useEffect, useRef } from "react";
import { Canvas } from "react-three-fiber";
import styled from "styled-components";

import House from "../models/House";
import { ESTANCIAS } from "../models/Plano";
import FirstPersonPlayer from "../components/FirstPersonPlayer";
import Joystick, { Mira, AvisoPuerta } from "../components/Joystick";
import LogoFabrick from "../components/UI/LogoFabrick";
import Navbar from "../components/UI/Navbar";
import LoadingPage from "../components/UI/LoadingPage";
import LoadingManager from "../components/LoadingManager";
import AvisoErrores from "../components/AvisoErrores";
import { precargarFabrick } from "../utils/textureLoader";
import { FABRICK, abreCercana } from "../state/fabrick";

/* Fabrica: la casa del plano, con geometría nuestra (1 unidad = 1 metro), recorrida en
   primera persona.
   REGLA IMPORTANTE: dentro de <Canvas> solo pueden ir objetos de three.js. React Three Fiber
   convierte cada elemento HTML en un objeto del espacio THREE, y si aparece uno salta:
     "Button" is not part of the THREE namespace!
   Por eso dentro va Contenido3D (que solo devuelve meshes) y todo el HTML —selector,
   joystick, etiquetas— va fuera, en el nivel de React normal. */

const Instruccion = styled.div`
  position: fixed; right: 20px; top: 16px; z-index: 26; max-width: 235px;
  background: rgba(20, 22, 18, 0.84); color: #fff; padding: 13px 15px; border-radius: 8px;
  font-size: 12.5px; line-height: 1.65;
  b { color: #d4af37; }
`;
const Etiqueta = styled.div`
  position: fixed; left: 50%; top: 30px; transform: translateX(-50%); z-index: 25;
  color: #fff; font-size: 13px; font-weight: 700; letter-spacing: 0.14em;
  text-transform: uppercase; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.9);
  pointer-events: none;
`;
const Panel = styled.aside`
  position: fixed; right: 16px; bottom: 16px; z-index: 26; width: 236px;
  background: rgba(20, 22, 18, 0.88); color: #fff; border-radius: 10px; padding: 14px;
  font-size: 12.5px; display: grid; gap: 9px;
  h3 { margin: 0; font-size: 10.5px; letter-spacing: 0.13em; text-transform: uppercase; color: #d4af37; }
`;
const Fila = styled.div`
  display: flex; gap: 5px; flex-wrap: wrap;
  button {
    font: inherit; font-size: 11px; padding: 6px 9px; cursor: pointer; border-radius: 5px;
    border: 1px solid rgba(255, 255, 255, 0.25); background: transparent; color: #fff;
  }
  button[aria-pressed='true'] { background: #d4af37; color: #111; border-color: #d4af37; font-weight: 700; }
`;

const PINTURAS = [
  { id: "blanco", color: "#FFFFFF", txt: "Blanco" },
  { id: "arena", color: "#EDE3D2", txt: "Arena" },
  { id: "perla", color: "#D6D8D5", txt: "Perla" },
  { id: "salvia", color: "#C9D3C0", txt: "Salvia" },
  { id: "cielo", color: "#C3D2DD", txt: "Cielo" },
  { id: "terracota", color: "#E4C9B4", txt: "Terracota" }
];
const WPC = [
  { id: "roble", txt: "Roble" },
  { id: "nogal", txt: "Nogal" },
  { id: "carbon", txt: "Carbón" },
  { id: "gris", txt: "Gris" }
];
const PISOS = [
  { id: "pisoMadera", txt: "Madera" },
  { id: "baldosa", txt: "Baldosa" },
  { id: "roble", txt: "Noble" }
];

function nombreDe(id) {
  const e = ESTANCIAS.find((s) => s.id === id);
  return e ? e.nombre : "";
}

/* --- esto va DENTRO del Canvas: solo objetos de three.js --- */

/* Luces, cielo y suelo. Sin luz, los MeshStandardMaterial no se ven. */
function Escena() {
  return (
    <>
      <color attach="background" args={["#bcd4e6"]} />
      <fog attach="fog" args={["#bcd4e6", 40, 160]} />
      <ambientLight intensity={0.5} />
      <hemisphereLight args={["#cfe0ea", "#8a7a5c", 0.55]} />
      <directionalLight
        position={[18, 24, -14]}
        intensity={1.15}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-bias={-0.0006}
      />
      <directionalLight position={[-16, 12, 18]} intensity={0.3} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[6, -0.03, 4]} receiveShadow>
        <planeGeometry args={[260, 260]} />
        <meshStandardMaterial color="#6f8f5a" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[6, -0.02, -9]} receiveShadow>
        <planeGeometry args={[3, 16]} />
        <meshStandardMaterial color="#c9c2b2" roughness={1} />
      </mesh>
    </>
  );
}

/* La casa y el jugador. Devuelve null (el jugador) y mallas (la casa): nada de HTML. */
function Contenido3D({ pintura, piso, wpc, entrada, onBloqueo }) {
  return (
    <>
      <House pintura={pintura} piso={piso} wpc={wpc} />
      <FirstPersonPlayer
        posicionInicial={[6, 1.65, -3]}
        entrada={entrada}
        onBloqueo={onBloqueo}
      />
    </>
  );
}

/* --- esto va FUERA del Canvas: HTML normal --- */

function Selector({ pintura, setPintura, wpc, setWpc, piso, setPiso }) {
  return (
    <Panel>
      <h3>Pintura Fabrick</h3>
      <Fila>
        {PINTURAS.map((p) => (
          <button key={p.id} type="button" aria-pressed={pintura === p.color}
            onClick={() => setPintura(p.color)}>
            <span style={{
              display: "inline-block", width: 10, height: 10, borderRadius: 2,
              background: p.color, marginRight: 5, verticalAlign: -1,
              border: "1px solid rgba(0,0,0,.4)"
            }} />{p.txt}
          </button>
        ))}
      </Fila>
      <h3>Wall panel WPC</h3>
      <Fila>
        {WPC.map((w) => (
          <button key={w.id} type="button" aria-pressed={wpc === w.id}
            onClick={() => setWpc(w.id)}>{w.txt}</button>
        ))}
      </Fila>
      <h3>Piso</h3>
      <Fila>
        {PISOS.map((p) => (
          <button key={p.id} type="button" aria-pressed={piso === p.id}
            onClick={() => setPiso(p.id)}>{p.txt}</button>
        ))}
      </Fila>
    </Panel>
  );
}

/* Lee el registro compartido unas 6 veces por segundo: bastante para la etiqueta y el aviso
   de la puerta, y mucho más barato que un setState por frame. */
function Hud() {
  const [, forzar] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forzar((n) => n + 1), 150);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.code === "KeyE") abreCercana(); };
    const onTap = () => abreCercana();
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerup", onTap);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerup", onTap);
    };
  }, []);

  const puerta = FABRICK.cercana;
  return (
    <>
      <Etiqueta>{FABRICK.estancia ? nombreDe(FABRICK.estancia) : "Exterior"}</Etiqueta>
      {puerta ? <AvisoPuerta>Pulsa E o toca para abrir</AvisoPuerta> : null}
    </>
  );
}

export default function Hall() {
  const [ancho, setAncho] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1280
  );
  const [pintura, setPintura] = useState(PINTURAS[0].color);
  const [wpc, setWpc] = useState("roble");
  const [piso, setPiso] = useState("pisoMadera");
  const [dentro, setDentro] = useState(false);
  const entrada = useRef({ x: 0, y: 0, correr: false });
  const pequeno = ancho < 500;

  useEffect(() => {
    const on = () => setAncho(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  useEffect(() => {
    precargarFabrick([...WPC.map((w) => w.id), ...PISOS.map((p) => p.id)]);
  }, []);

  return (
    <>
      <AvisoErrores />
      <Canvas
        gl={{ antialias: true }}
        camera={{ fov: pequeno ? 88 : 72, position: [6, 1.65, -3], rotation: [0, Math.PI, 0] }}
      >
        <LoadingManager total={8} />
        <Escena />
        <Suspense fallback={null}>
          <Contenido3D
            pintura={pintura}
            piso={piso}
            wpc={wpc}
            entrada={entrada}
            onBloqueo={setDentro}
          />
        </Suspense>
      </Canvas>

      {/* Todo lo que sigue es HTML y va FUERA del Canvas */}
      <Mira />
      {dentro ? (
        <Joystick onCambio={(v) => Object.assign(entrada.current, v)} />
      ) : null}
      <Hud />
      <Selector
        pintura={pintura} setPintura={setPintura}
        wpc={wpc} setWpc={setWpc}
        piso={piso} setPiso={setPiso}
      />
      <LogoFabrick ancho={pequeno ? 150 : 230} />
      <Instruccion>
        <b>WASD</b> andar · <b>ratón</b> mirar · <b>Shift</b> correr
        <br />
        <b>E</b> o toca para abrir la puerta
        <br />
        Móvil: arrastra para mirar y usa el joystick
      </Instruccion>
      <LoadingPage />
      <Navbar active='room-1' />
    </>
  );
}

export { Selector, PINTURAS, WPC, PISOS, nombreDe };