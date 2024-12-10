import { quat } from 'glm';

import { Camera, Node, Light, Transform } from 'engine/core.js';

import { GLTFLoader } from 'engine/loaders/GLTFLoader.js';

import { ResizeSystem } from 'engine/systems/ResizeSystem.js';
import { UpdateSystem } from 'engine/systems/UpdateSystem.js';

import { UnlitRenderer } from 'engine/renderers/UnlitRenderer.js';
import { FirstPersonController } from './engine/controllers/FirstPersonController.js';

const canvas = document.querySelector('canvas');
const renderer = new UnlitRenderer(canvas);
await renderer.initialize();

const gltfLoader = new GLTFLoader();
await gltfLoader.load(new URL('./models/world/plane.gltf', import.meta.url));

const scene = gltfLoader.loadScene(gltfLoader.defaultScene);
const camera = scene.find(node => node.getComponentOfType(Camera));
camera.addComponent(new FirstPersonController(camera, canvas));

const light = new Node();
scene.addChild(light);
light.addComponent(new Transform({
    translate: [5, 5, 5],
}));
const lightTransform = light.getComponentOfType(Transform);
light.addComponent(new Light({
    //color: [1, 0, 0],
}));
light.addComponent({
    update(t, dt){
        //const lightComponent = light.getComponentOfType(Light);
        //lightComponent.color = [Math.sin(t) ** 2, 0, 0];
        lightTransform.translation = [5, 5, 5];
    }
})


function update(t, dt) {
    scene.traverse(node => {
        for (const component of node.components) {
            component.update?.(t, dt);
        }
    });
}

function render() {
    renderer.render(scene, camera);
}

function resize({ displaySize: { width, height }}) {
    camera.getComponentOfType(Camera).aspect = width / height;
}

new ResizeSystem({ canvas, resize }).start();
new UpdateSystem({ update, render }).start();
