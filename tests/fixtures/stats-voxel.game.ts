// Minimal native voxel level for the stats/render realization parity regression.
// The test writes one occupied cell as a real TRTPROC asset in a temporary asset root.
import { PerspectiveCamera, Scene } from "@threert/scene";
import { defineGame } from "@threert/gameplay";
import { voxelLevel } from "@threert/voxel";

export default defineGame<Record<string, never>>({
  state: {},
  setup: () => {
    const scene = new Scene();
    const camera = new PerspectiveCamera(60, 1, 0.1, 10);
    camera.name = "camera";
    camera.position.set(0.5, 0.5, 3);
    camera.lookAt(0, 0, 0);
    scene.add(camera);
    voxelLevel({
      route: "mesh",
      physics: false,
      palette: [
        { name: "empty", color: [0, 0, 0], roughness: 1, metalness: 0 },
        { name: "solid", color: [1, 1, 1], roughness: 1, metalness: 0 },
      ],
      objects: [{ name: "single-voxel", uri: "stats-voxel/single.tpg", position: [0, 0, 0], anchor: true }],
    });
    return { scene, camera, options: { name: "stats-voxel", width: 64, height: 64, preset: "cinematic" as const } };
  },
  handlers: {},
});
