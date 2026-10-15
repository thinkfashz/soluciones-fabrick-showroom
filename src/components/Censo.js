import React from "react";
import * as THREE from "three";
import { useThree, useFrame } from "react-three-fiber";

/* Censo de la escena: cuenta qué hay realmente dentro del lienzo y lo escribe en un texto
   que se ve en pantalla. Sirve para saber si el problema es que no hay objetos, si la cámara
   mira al sitio equivocado o si el lienzo no tiene tamaño. */
const oyentes = [];
let ultimo = "";

export function censo() {
  return ultimo;
}

export function PonCenso() {
  const { scene, camera, size, gl } = useThree();
  const n = React.useRef(0);
  const ref = React.useRef({ frame: -1 });

  useFrame(() => {
    n.current += 1;
    if (n.current % 30 !== 0) return;              // unas 5 veces por segundo, no en cada frame

    let mallas = 0, luces = 0, conMaterial = 0;
    scene.traverse((o) => {
      if (o.isMesh) {
        mallas += 1;
        if (o.material && o.material.visible !== false) conMaterial += 1;
      }
      if (o.isLight) luces += 1;
    });

    const c = gl.domElement;

    // ¿está de verdad renderizando? three lleva la cuenta en info.render.frame
    const info = gl.info.render;
    const dibuja = info.frame;
    const antes = ref.current.frame;
    const cambia = dibuja !== antes;
    ref.current.frame = dibuja;

    // ¿la fachada está delante de la cámara? la proyectamos a coordenadas de pantalla
    const centro = new THREE.Vector3(6, 1.25, 0).project(camera);
    const dentro = Math.abs(centro.x) < 1 && Math.abs(centro.y) < 1 && centro.z < 1;

    ultimo =
      "lienzo " + (c ? c.clientWidth + "x" + c.clientHeight : "?") +
      " | frame " + dibuja + (cambia ? " (sube)" : " (PARADO)") +
      "\ntriangulos " + info.triangles + " | llamadas " + info.calls +
      "\nscene: " + scene.children.length + " hijos | " + mallas + " mallas | " + luces + " luces" +
      "\ncamara " + camera.position.x.toFixed(1) + "," + camera.position.y.toFixed(1) + "," +
      camera.position.z.toFixed(1) + " rotY=" + camera.rotation.y.toFixed(2) +
      "\nfrente de la camara en pantalla: " + centro.x.toFixed(2) + ", " + centro.y.toFixed(2) +
      ", " + centro.z.toFixed(2) + (dentro ? "  SI se ve" : "  NO se ve") +
      "\ncanvas en el DOM: " + (c && c.parentNode ? "si" : "NO") +
      " | alpha " + (gl.getContext() ? gl.getContext().getContextAttributes().alpha : "?") +
      " | clear " + (() => { const col = new THREE.Color(); gl.getClearColor(col);
          return col.getHexString(); })() +
      "\nwebgl lost: " + (gl.getContext() ? String(gl.getContext().isContextLost()) : "?");
    oyentes.forEach((f) => f());
  });

  return null;
}

export function VerCenso() {
  const [, f] = React.useState(0);
  React.useEffect(() => {
    const fn = () => f((n) => n + 1);
    oyentes.push(fn);
    return () => {
      const i = oyentes.indexOf(fn);
      if (i >= 0) oyentes.splice(i, 1);
    };
  }, []);
  return React.createElement(
    "div",
    {
      style: {
        position: "fixed", right: 8, top: 8, zIndex: 2147483646,
        background: "rgba(0,0,0,.78)", color: "#8ef58e", padding: "8px 10px",
        borderRadius: 8, font: "11px/1.45 ui-monospace,Menlo,monospace", whiteSpace: "pre",
        maxWidth: "80vw"
      }
    },
    censo() || "censando…"
  );
}