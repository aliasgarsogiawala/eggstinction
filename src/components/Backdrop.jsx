import { useEffect, useRef } from "react";
import { PrehistoricScene } from "../game/backdrop";

// Full-viewport animated Cretaceous backdrop, fixed behind the whole UI.
export default function Backdrop() {
  const ref = useRef(null);

  useEffect(() => {
    const scene = new PrehistoricScene(ref.current);
    scene.start();
    const onVis = () => (document.hidden ? scene.stop() : scene.start());
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      scene.destroy();
    };
  }, []);

  return <canvas ref={ref} className="backdrop" aria-hidden="true" />;
}
