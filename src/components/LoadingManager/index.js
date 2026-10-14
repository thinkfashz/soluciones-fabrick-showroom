import React from "react";
import { DefaultLoadingManager } from "three";
import { useLoader } from "../../state/Store";

/* Cuenta lo que three va cargando. El total se calcula con lo que el visor ha pedido, así que
   se ajusta solo; y si aun así se queda corto, un reloj lo cierra. Sin esto, si el progreso
   no llega a 100 el botón «Entrar» no aparece nunca y la pantalla de carga no se quita. */
export default function LoadingManager({ total = 40, segundos = 12 }) {
  const { setProgress, progress } = useLoader();

  React.useEffect(() => {
    // cuenta real de lo que se ha pedido, en vez de un total a ojo
    let pedidos = 0;
    const contar = () => { pedidos = Math.max(pedidos, DefaultLoadingManager.itemsTotal); };
    DefaultLoadingManager.onStart = contar;

    DefaultLoadingManager.onProgress = function (url, itemsLoaded) {
      contar();
      if (pedidos === 0) return;
      const pct = Math.floor((itemsLoaded / pedidos) * 100);
      // se queda en 99 hasta que se acaba del todo: mejor que mentir con un 100 antes de tiempo
      setProgress(Math.min(99, pct));
    };

    const fin = () => { setProgress(100); };
    DefaultLoadingManager.onLoad = fin;

    // red lenta, textura colgada o el total que no cuadra: a los `segundos`, se abre igual
    const reloj = setTimeout(() => setProgress(100), segundos * 1000);

    return () => {
      clearTimeout(reloj);
      DefaultLoadingManager.onStart = undefined;
      DefaultLoadingManager.onProgress = undefined;
      DefaultLoadingManager.onLoad = undefined;
    };
  }, [segundos]);

  // si ya está al 100, se queda
  React.useEffect(() => {
    if (progress >= 100) setProgress(100);
  }, [progress]);

  return <group />;
}