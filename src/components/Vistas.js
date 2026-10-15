import { useRef, useEffect } from "react";
import * as THREE from "three";
import { useThree, useFrame } from "react-three-fiber";

/* Vistas cinematograficas. Todas son interiores: el usuario pidio que el exterior no cuente,
   asi que no hay ninguna vista desde fuera ni desde arriba.
   La habitacion arranca en z = 0 mirando hacia +z, asi que las vistas van entrando en ella. */

export const VISTAS = [
  { id: "entrada",  nombre: "Entrada",  pos: [1.0, 1.55, 0.4],  mira: [0.0, 1.20, 5.0],  fov: 62 },
  { id: "centro",   nombre: "Centro",   pos: [0.0, 1.60, 3.2],  mira: [0.3, 1.10, 8.5],  fov: 58 },
  { id: "salon",    nombre: "Salón",    pos: [-1.6, 1.55, 5.4], mira: [1.8, 1.05, 8.2],  fov: 56 },
  { id: "comedor",  nombre: "Comedor",  pos: [2.4, 1.55, 6.8],  mira: [-1.6, 1.10, 9.4], fov: 55 },
  { id: "cocina",   nombre: "Cocina",   pos: [-2.2, 1.55, 8.2], mira: [1.2, 1.15, 4.6],  fov: 54 }
];

export default function Vistas() {
  const { camera } = useThree();
  const vuelo = useRef(null);

  useEffect(() => {
    window.fabrickVolarA = function (id) {
      const v = VISTAS.filter((x) => x.id === id)[0];
      if (!v || !camera) return;
      const destino = new THREE.Vector3(v.pos[0], v.pos[1], v.pos[2]);
      const mirar = new THREE.Vector3(v.mira[0], v.mira[1], v.mira[2]);
      // orientacion que hay que dejar en la camara para que mire a ese punto
      const m = new THREE.Matrix4().lookAt(destino, mirar, new THREE.Vector3(0, 1, 0));
      const e = new THREE.Euler().setFromRotationMatrix(m, "YXZ");

      window.fabrickVolando = true;
      window.fabrickMirarA = { x: e.x, y: e.y };
      vuelo.current = {
        t0: performance.now(),
        dur: 1500,
        desde: camera.position.clone(),
        hasta: destino,
        fov0: camera.fov,
        fov1: v.fov
      };
    };
    return () => {
      delete window.fabrickVolarA;
      delete window.fabrickMirarA;
    };
  }, [camera]);

  useFrame(() => {
    const v = vuelo.current;
    if (!v) return;
    const f = Math.min(1, (performance.now() - v.t0) / v.dur);
    // ease in-out: lo que hace que el movimiento se vea de pelicula y no a saltos
    const e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
    camera.position.lerpVectors(v.desde, v.hasta, e);
    camera.fov = v.fov0 + (v.fov1 - v.fov0) * e;
    camera.updateProjectionMatrix();
    if (f >= 1) {
      window.fabrickVolando = false;
      vuelo.current = null;
    }
  });

  return null;
}