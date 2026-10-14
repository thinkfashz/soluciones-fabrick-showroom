import React, { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "react-three-fiber";
import {
  MEDIDAS,
  ESTANCIAS,
  MUROS,
  PUERTAS,
  PUERTA_PRINCIPAL,
  VENTANAS,
  murosInteriores,
  estanciaEn
} from "./Plano";
import { materialFabrick, pinturaFabrick } from "../utils/textureLoader";
import { registraColls, registraPuerta, quitaPuertas } from "../state/fabrick";

const ALTO = MEDIDAS.altoMuro;
const GROSOR = MEDIDAS.grosorMuro;

/* Muros con huecos: se parten en trozos para dejar cabida a puertas y ventanas sin usar
   CSG (que no existe en three). Cada hueco se come su trozo de muro. */
function segmentosConHuecos(desde, hasta, huecos) {
  const libres = huecos
    .map((h) => [Math.max(desde, h[0]), Math.min(hasta, h[1])])
    .filter((h) => h[1] > h[0])
    .sort((a, b) => a[0] - b[0]);

  const trozos = [];
  let cursor = desde;
  libres.forEach(([a, b]) => {
    if (a > cursor + 0.001) trozos.push([cursor, a]);
    cursor = Math.max(cursor, b);
  });
  if (cursor < hasta - 0.001) trozos.push([cursor, hasta]);
  return trozos;
}

function Muro({ eje, v, de, a, huecos, material, altura }) {
  const h = altura || ALTO;
  const trozos = useMemo(() => segmentosConHuecos(de, a, huecos || []), [de, a, huecos]);
  return (
    <group>
      {trozos.map((t, i) => {
        const largo = t[1] - t[0];
        const centro = (t[0] + t[1]) / 2;
        const dims =
          eje === "x"
            ? [largo, h, GROSOR]
            : [GROSOR, h, largo];
        const pos = eje === "x" ? [centro, h / 2, v] : [v, h / 2, centro];
        return (
          <mesh key={i} position={pos} material={material} castShadow receiveShadow>
            <boxGeometry args={dims} />
          </mesh>
        );
      })}
    </group>
  );
}

/* Ventana: hueco con cristal y marco negro. */
function Ventana({ muro, x, ancho, alto, y }) {
  const matCristal = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: "#9fd0e8", transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1
    }),
    []
  );
  const matMarco = useMemo(() => pinturaFabrick("#1c1c1c"), []);

  const rot = muro === "N" || muro === "S" ? 0 : Math.PI / 2;
  const pos =
    muro === "N" ? [x, y, 0]
    : muro === "S" ? [x, y, MEDIDAS.fondo]
    : muro === "O" ? [0, y, x]
    : [MEDIDAS.ancho, y, x];

  return (
    <group position={pos} rotation={[0, rot, 0]}>
      <mesh material={matCristal}>
        <planeGeometry args={[ancho, alto]} />
      </mesh>
      {/* marco: cuatro barras finas */}
      <mesh material={matMarco} position={[0, alto / 2, 0]}>
        <boxGeometry args={[ancho + 0.12, 0.08, 0.1]} />
      </mesh>
      <mesh material={matMarco} position={[0, -alto / 2, 0]}>
        <boxGeometry args={[ancho + 0.12, 0.08, 0.1]} />
      </mesh>
      <mesh material={matMarco} position={[ancho / 2, 0, 0]}>
        <boxGeometry args={[0.08, alto, 0.1]} />
      </mesh>
      <mesh material={matMarco} position={[-ancho / 2, 0, 0]}>
        <boxGeometry args={[0.08, alto, 0.1]} />
      </mesh>
      <mesh material={matMarco}>
        <boxGeometry args={[0.05, alto, 0.08]} />
      </mesh>
    </group>
  );
}

/* Puerta que gira 0 -> 90 grados con interpolación suave, y que se registra en el catálogo
   compartido para que el jugador sepa cuál tiene delante. */
export function Puerta({ id, posicion, giro, ancho, material }) {
  const hoja = useRef();
  const estado = useRef({ abierta: false, ang: 0 });

  useEffect(() => {
    registraPuerta(id, posicion[0], posicion[1], () => {
      estado.current.abierta = !estado.current.abierta;
    });
    // Ojo: `posicion` es una literal nueva en cada render, así que si fuera dependencia el
    // efecto se repetiría siempre y quitaPuertas() vaciaría el registro entero, dejando
    // registrada solo la última puerta. Se dependen las coordenadas sueltas, que no cambian.
    return () => quitaPuertas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, posicion[0], posicion[2]]);

  useFrame((_, delta) => {
    if (!hoja.current) return;
    const objetivo = estado.current.abierta ? (giro || 1) * Math.PI / 2 : 0;
    // el lerp hace que abra y cierre en unos 0,4 s, sin saltitos
    estado.current.ang += (objetivo - estado.current.ang) * Math.min(1, delta * 8);
    hoja.current.rotation.y = estado.current.ang;
  });

  return (
    <group position={posicion}>
      {/* la hoja pivota en la jamba, así que va desplazada media puerta */}
      <group ref={hoja} position={[ancho / 2, 0, 0]}>
        <mesh position={[-ancho / 2, MEDIDAS.altoPuerta / 2, 0]} material={material} castShadow>
          <boxGeometry args={[ancho, MEDIDAS.altoPuerta, 0.06]} />
        </mesh>
        <mesh position={[ancho / 2 - 0.12, 1.05, 0.05]}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshStandardMaterial color="#c9a24a" metalness={0.7} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

export function FabricaPuertas({ material }) {
  return (
    <group>
      {PUERTAS.map((p) => {
        const vertical = p.p[0] === 4 || p.p[0] === 8;   // el hueco está en un muro vertical
        return (
          <group key={p.id}>
            {/* jambas del hueco */}
            <mesh position={[p.p[0], MEDIDAS.altoPuerta / 2, p.p[1]]}>
              <boxGeometry
                args={
                  vertical
                    ? [MEDIDAS.anchoPuerta + 0.12, MEDIDAS.altoPuerta + 0.1, GROSOR + 0.06]
                    : [GROSOR + 0.06, MEDIDAS.altoPuerta + 0.1, MEDIDAS.anchoPuerta + 0.12]
                }
              />
              <meshStandardMaterial color="#f2efe8" />
            </mesh>
            <Puerta
              id={p.id}
              posicion={[p.p[0], 0, p.p[1]]}
              giro={p.g}
              ancho={MEDIDAS.anchoPuerta}
              material={material}
            />
          </group>
        );
      })}
    </group>
  );
}

export default function House({ pintura, piso, wpc, planta = [0, 0, 0] }) {
  const matPintura = useMemo(() => pinturaFabrick(pintura), [pintura]);
  const matSuelo = useMemo(
    () => materialFabrick("textura", { textura: piso, repeticion: [4, 3], rugosidad: 0.55 }),
    [piso]
  );
  const matWpc = useMemo(
    () => materialFabrick("textura", { textura: wpc, repeticion: [2, 1], rugosidad: 0.75 }),
    [wpc]
  );
  const matPuerta = useMemo(() => pinturaFabrick("#7a5c3e"), []);
  const matExterior = useMemo(() => pinturaFabrick("#ddd6c7"), []);

  const interiores = useMemo(() => murosInteriores(), []);

  // huecos de los muros exteriores
  const huecosPorMuro = useMemo(() => {
    const h = { N: [], S: [], O: [], E: [] };
    const dp = PUERTA_PRINCIPAL.ancho / 2;
    h.N.push([PUERTA_PRINCIPAL.p[0] - dp, PUERTA_PRINCIPAL.p[0] + dp]);
    VENTANAS.forEach((v) => {
      const c = v.muro === "N" || v.muro === "S" ? v.x : v.z;
      const a = v.ancho / 2 + 0.08;
      h[v.muro].push([c - a, c + a]);
    });
    return h;
  }, []);

  /* Para cada muro interior, las puertas que caen sobre él. Un muro 'x' va en horizontal
     sobre z = v; uno 'z', en vertical sobre x = v. El hueco se mide a lo largo del muro. */
  const huecosInteriores = useMemo(() => {
    const m = {};
    const w = MEDIDAS.anchoPuerta / 2 + 0.06;
    interiores.forEach((mu) => {
      m[mu.id] = PUERTAS
        .filter((p) => {
          const coord = mu.eje === "x" ? p.p[1] : p.p[0];      // la que debe coincidir con v
          const largo = mu.eje === "x" ? p.p[0] : p.p[1];      // la posición a lo largo
          return Math.abs(coord - mu.v) < 0.05 && largo >= mu.de && largo <= mu.a;
        })
        .map((p) => {
          const c = mu.eje === "x" ? p.p[0] : p.p[1];
          return [c - w, c + w];
        });
    });
    return m;
  }, [interiores]);

  return (
    <Colliders planta={planta} claves={pintura + "|" + piso + "|" + wpc}>
      {/* suelo de toda la planta */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[MEDIDAS.ancho / 2, 0.001, MEDIDAS.fondo / 2]} receiveShadow>
        <planeGeometry args={[MEDIDAS.ancho, MEDIDAS.fondo]} />
        <primitive object={matSuelo} attach="material" />
      </mesh>

      {/* techo */}
      <mesh position={[MEDIDAS.ancho / 2, ALTO, MEDIDAS.fondo / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[MEDIDAS.ancho, MEDIDAS.fondo]} />
        <meshStandardMaterial color="#f6f4ef" roughness={0.95} />
      </mesh>

      {/* muros exteriores */}
      {MUROS.map((m) => (
        <Muro
          key={m.id}
          eje={m.eje}
          v={m.v}
          de={m.de}
          a={m.a}
          huecos={huecosPorMuro[m.id[m.id.length - 1]]}
          material={matExterior}
        />
      ))}

      {/* muros interiores, con las puertas recortadas */}
      {interiores.map((m) => (
        <Muro
          key={m.id}
          eje={m.eje}
          v={m.v}
          de={m.de}
          a={m.a}
          huecos={huecosInteriores[m.id] || []}
          material={matPintura}
        />
      ))}

      {/* panel de wpc en las estancias */}
      {ESTANCIAS.map((e) => (
        <mesh
          key={e.id}
          position={[(e.caja[0] + e.caja[2]) / 2, 1.4, e.caja[1] + 0.011]}
          rotation={[0, 0, 0]}
        >
          <planeGeometry args={[e.caja[2] - e.caja[0] - 0.4, 1.1]} />
          <primitive object={matWpc} attach="material" />
        </mesh>
      ))}

      {VENTANAS.map((v) => <Ventana key={v.id} {...v} />)}
      <FabricaPuertas material={matPuerta} />
    </Colliders>
  );
}

/* Envuelve la casa y, un frame después de montada, mide los muros y los pasa al registro
   como cajas de colisión. Antes de eso, los muros son straight BoxGeometry: se mide el
   volume real de cada malla, no una tabla escrita a mano, así que si mueves un muro en
   Plano.js las colisiones se mueven con él. */
function Colliders({ children, planta, claves }) {
  const grupo = useRef();

  useEffect(() => {
    const t = setTimeout(() => {
      if (!grupo.current) return;
      const cajas = [];
      grupo.current.traverse((o) => {
        if (!o.isMesh) return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
        cajas.push(b);
      });
      registraColls(cajas);
    }, 60);
    return () => clearTimeout(t);
  }, [claves, planta]);

  return <group ref={grupo} position={planta}>{children}</group>;
}

export { estanciaEn };