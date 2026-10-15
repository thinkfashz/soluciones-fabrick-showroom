import React, { useRef, useEffect, useMemo } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { SkeletonUtils } from "three/examples/jsm/utils/SkeletonUtils";
import { useLoader, useFrame, useThree } from "react-three-fiber";

/* Personajes animados.
 *
 * Modelo: RobotExpressive, de los ejemplos oficiales de three.js (gratis, glTF, con esqueleto
 * y 14 animaciones). Justo las que hacen falta:
 *   Idle, Walking, Running   -> el que camina contigo
 *   Sitting, Standing        -> el que se sienta
 *   Wave, ThumbsUp, Yes, No  -> las reacciones
 *
 * El esqueleto se clona con SkeletonUtils, que es la forma correcta de tener varios del mismo
 * modelo: si se clona a lo bruto, todos mueven el mismo esqueleto y van sincronizados.
 *
 * Ojo con dos cosas de glTF: los clips viven en gltf.animations, no en la escena; y la escena
 * clonada se mete en el grafico con scene.add, que es mas fiable que <primitive>.
 */

export const MODELO = "/assets/personajes/RobotExpressive.glb";
const ALTO = 1.72;          // se normaliza para que el personaje mida como una persona

export function Personaje({ inicial = "Idle", api = null, ocultaCabeza = false, alPoner = null }) {
  const { scene } = useThree();
  const gltf = useLoader(GLTFLoader, MODELO);

  // una instancia propia, escalada a 1,72 m y con los pies en el suelo
  const raiz = useMemo(() => {
    const r = SkeletonUtils.clone(gltf.scene);
    const caja = new THREE.Box3().setFromObject(r);
    const alto = caja.max.y - caja.min.y;
    const escala = alto > 0 ? ALTO / alto : 1;
    r.scale.setScalar(escala);
    r.position.y = -caja.min.y * escala;
    r.traverse((o) => {
      if (o.isMesh && o.material) {
        o.castShadow = true;
        o.receiveShadow = false;
      }
    });
    r.updateMatrixWorld(true);
    return r;
  }, [gltf]);

  // los clips salen de gltf.animations; la escena clonada no los trae
  const mixer = useMemo(() => new THREE.AnimationMixer(raiz), [raiz]);
  const clips = useMemo(() => {
    const c = {};
    (gltf.animations || []).forEach((a) => { c[String(a.name).toLowerCase()] = a; });
    return c;
  }, [gltf]);
  const actual = useRef(null);

  const pon = (nombre, suave) => {
    const c = clips[String(nombre).toLowerCase()];
    if (!c || actual.current === nombre) return;
    const accion = mixer.clipAction(c);
    accion.enabled = true;
    accion.reset();
    if (suave === false) accion.play();
    else accion.fadeIn(0.3).play();
    if (actual.current && clips[String(actual.current).toLowerCase()]) {
      mixer.clipAction(clips[String(actual.current).toLowerCase()]).fadeOut(0.3);
    }
    actual.current = nombre;
    if (alPoner) alPoner(nombre);
  };

  // al grafico
  useEffect(() => {
    scene.add(raiz);
    return () => { scene.remove(raiz); mixer.stopAllAction(); };
  }, [scene, raiz, mixer]);

  useEffect(() => { pon(inicial, false); }, []); // eslint-disable-line

  // primera persona: la camara va en su sitio, asi que su cabeza se esconde
  useEffect(() => {
    if (!ocultaCabeza) return;
    const ocultas = [];
    raiz.traverse((o) => {
      if (o.isMesh && /head|neck|cara|face/i.test(o.name || "") && o.visible) {
        o.visible = false;
        ocultas.push(o);
      }
    });
    return () => ocultas.forEach((o) => { o.visible = true; });
  }, [raiz, ocultaCabeza]);

  useEffect(() => {
    if (api) api.current = { raiz, pon, mixer };
  }, [raiz, mixer, api]);

  useFrame((_, dt) => mixer.update(Math.min(0.05, dt)));

  return null;
}

/* ---- el del jugador: pegado a la camara, cambia de animacion segun lo que hagas ---- */
export function PersonajeJugador() {
  const { camera } = useThree();
  const api = useRef(null);
  const giro = useRef(0);
  const clip = useRef("Idle");

  useFrame((_, dt) => {
    const a = api.current;
    if (!a) return;
    const m = a.raiz;

    // en la posicion de la camara, pero apoyado en el suelo
    m.position.x = camera.position.x;
    m.position.z = camera.position.z;

    // mirando hacia donde mira la camara, con suavizado para que no gire a tirones
    const e = camera.matrixWorld.elements;
    const objetivo = Math.atan2(e[8], e[10]);
    let d = objetivo - giro.current;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    giro.current += d * Math.min(1, dt * 9);
    m.rotation.y = giro.current;

    const v = window.fabrickVelocidad || 0;
    const quiere = v < 0.18 ? "Idle" : v < 2.4 ? "Walking" : "Running";
    if (quiere !== clip.current) {
      clip.current = quiere;
      a.pon(quiere, false);
    }
  });

  return <Personaje inicial="Idle" api={api} ocultaCabeza />;
}

/* ---- personajes que se comportan solos ----
   `guion(api, dt, pon)` se llama cada frame y decide que hace el personaje. */
export function NPC({ guion, inicio = "Idle" }) {
  const api = useRef(null);
  useFrame((_, dt) => {
    if (api.current && guion) guion(api.current, dt, (n) => api.current.pon(n));
  });
  return <Personaje inicial={inicio} api={api} />;
}