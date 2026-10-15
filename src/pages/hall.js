import React, { Suspense, useState, useEffect } from "react";
import { Canvas } from "react-three-fiber";
import Navbar from "../components/UI/Navbar";
import LoadingPage from "../components/UI/LoadingPage";
import Camera from "../components/Camera";
import FloorCircle from "../components/FloorCircle";
import Instructions from "../components/UI/Instructions";
import LoadingManager from "../components/LoadingManager";
import { useLoader } from "../state/Store";
import { withResizeDetector } from "react-resize-detector";
import Tour from "reactour";
import styled from "styled-components";
import Vistas, { VISTAS } from "../components/Vistas";
import { Habitacion, Limites, Velocidad } from "../components/Escena";
import { AvisoEscena } from "../components/SinRuptura";
import LogoFabrick from "../components/UI/LogoFabrick";

const Barra = styled.div`
  position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); z-index: 28;
  display: flex; gap: 6px; flex-wrap: wrap; justify-content: center;
  max-width: calc(100vw - 20px); padding: 9px 11px;
  background: rgba(18, 20, 16, 0.9); border: 1px solid rgba(212, 175, 55, 0.3);
  border-radius: 999px; box-shadow: 0 14px 44px rgba(0, 0, 0, 0.6);
  button {
    font: inherit; font-size: 12px; font-weight: 600; padding: 9px 14px; cursor: pointer;
    border-radius: 999px; border: 1px solid rgba(255, 255, 255, 0.2);
    background: transparent; color: #fff; white-space: nowrap;
  }
  button[aria-pressed='true'] { background: #d4af37; color: #111; border-color: #d4af37; font-weight: 700; }
`;
const Rotulo = styled.span`
  align-self: center; color: #d4af37; font-size: 10.5px; font-weight: 700;
  letter-spacing: .14em; text-transform: uppercase; padding: 0 6px;
`;

const Controls = React.lazy(() => import("../components/Controls"));
const Model = React.lazy(() => import("../models/Hall"));

const config = {
  controls: {
    floorCircle: { yLevel: -0.03 },
  },
  camera: {},
};

const steps = [
  {
    selector: ".first-step",
    content: "This is the first step",
  },
];

const Hall = ({ width }) => {
  const [fov, setFov] = useState(55);
  const [isTourOpen, setIsTourOpen] = useState(true);
  const [vista, setVista] = useState(null);
  const [cargando, setCargando] = useState(true);
  const progreso = useLoader((st) => st.progress);
  useEffect(() => { if (progreso >= 100) setCargando(false); }, [progreso]);

  // {!process.env.NODE_ENV || process.env.NODE_ENV === "development" ? (
  //   <>
  //     <Stats />
  //   </>
  // ) : (
  //   ""
  // )}

  useEffect(() => {
    if (width < 500) {
      setFov(85);
    } else {
      setFov(55);
    }
  }, [width]);

  return (
    <>
      <Canvas
        gl={{ antialias: true }}
        onCreated={(estado) => {
          /* Se deja el estado de three a mano en window. Sirve para mirar desde la consola
             del movil cuantos triangulos se estan dibujando de verdad, que es lo unico que
             distingue "la escena esta cargada" de "la escena se esta viendo". */
          window.__fabrick = estado;
        }}
      >
        <LoadingManager total={46} />
        <Camera fov={fov} position={[1, 1.37, 0]} lookAt={[0, 0, 10]} />
        <Vistas />
        <Limites />
        <Velocidad />
        <Suspense fallback={null}>
          <FloorCircle />
          <Model name={"Hall"} />
            <Habitacion />
          <Controls settings={config.controls} />
        </Suspense>
      </Canvas>
      <video
        id='video'
        loop
        crossOrigin='anonymous'
        style={{ display: "none" }}
      >
        <source
          src='/assets/video/promo_compressed.mp4'
          type='video/mp4; codecs="avc1.42E01E, mp4a.40.2"'
        />
      </video>
      <AvisoEscena />
      {cargando ? null : <LogoFabrick ancho={150} />}
      {cargando ? null : <Barra role="group" aria-label="Vistas cinematográficas">
        <Rotulo>Cámara</Rotulo>
        {VISTAS.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={vista === v.id}
            onClick={() => { setVista(vista === v.id ? null : v.id);
                             window.fabrickVolarA && window.fabrickVolarA(v.id); }}
          >
            {v.nombre}
          </button>
        ))}
      </Barra>}
      <Instructions />
      <LoadingPage />
      <Navbar active='room-1' />
      {/* <Tour
        steps={steps}
        isOpen={isTourOpen}
        onRequestClose={() => setIsTourOpen(false)}
      /> */}
    </>
  );
};

export default withResizeDetector(Hall);
