import { quat, mat4 } from 'glm';

import { Camera, Node, Light, Transform } from 'engine/core.js';

import { GLTFLoader } from 'engine/loaders/GLTFLoader.js';

import { ResizeSystem } from 'engine/systems/ResizeSystem.js';
import { UpdateSystem } from 'engine/systems/UpdateSystem.js';

import { UnlitRenderer } from 'engine/renderers/UnlitRenderer.js';
import { FirstPersonController } from './engine/controllers/FirstPersonController.js';
import { CollisionDetection } from './engine/controllers/CollisionDetection.js';
import { AmmoLibExport as ammoLib } from './engine/controllers/CollisionDetection.js';

////////////////
// VARIABLES //
///////////////

const timeStep = 1 / 60; // 60 FPS
const maxSubSteps = 10; // če zalagga

/////////////////
// SCENE SETUP //
/////////////////

// 
// Set up text canvases
//
const canvas = document.getElementById('webgpuCanvas'); // WebGPU canvas za izris igre
const textCanvas = document.getElementById('textCanvas'); // Text canvas za izpis texta nad igro

// Text canvas settings
const ctx = textCanvas.getContext('2d');
ctx.font = '15px Arial';
ctx.textAlign = 'center';
ctx.fillStyle = 'black';

// WebGPU canvas settings
const renderer = new UnlitRenderer(canvas);
await renderer.initialize();

//
// Load the world model
//
const worldLoader = new GLTFLoader();
await worldLoader.load(new URL('./models/world-fun/world.gltf', import.meta.url));
const scene = worldLoader.loadScene(worldLoader.defaultScene); // Add the model to the scene

//
// Set up collision detection
//
const collisionDetection = new CollisionDetection(scene);
scene.addComponent(collisionDetection);

//
// Set up the camera
//
const camera = scene.find(node => node.getComponentOfType(Camera));
const firstPerosnController = new FirstPersonController(camera, canvas);
camera.getComponentOfType(Transform).rotation = quat.fromEuler(quat.create(), 0, 70, 0);
camera.addComponent(firstPerosnController);


//
// Add a light - sun
//
const light = new Node();
scene.addChild(light);
light.addComponent(new Transform({
    translate: [0, 1000, 0],
}));
const lightTransform = light.getComponentOfType(Transform);
light.addComponent(new Light({
    type: 'directional', // Sun
    color: [1, 1, 1],
    intensity: 100.0,
}));
light.addComponent({
    update(t, dt) {
        lightTransform.translation = [0, 1000, 0];
    }
});

////////////////////////
// UPDATE AND RENDER //
///////////////////////

function update(t, dt) {
    // Update physics
    if (collisionDetection.updatePhysics) {
        collisionDetection.updatePhysics(timeStep, maxSubSteps);
    }

    // Update all components
    scene.traverse(node => {
        for (const component of node.components) {
            component.update?.(t, dt);
        }
    });
}

function render() {
    // Render the scene
    renderer.render(scene, camera);

    // Draw text on top of the scene, če je potrebno - podatke dobimo iz collisionDetection
    drawText();
}

function resize({ displaySize: { width, height }}) {
    camera.getComponentOfType(Camera).aspect = width / height;
}

function drawText() {
    ctx.clearRect(0, 0, textCanvas.width, textCanvas.height); // Clear previous text

    if (collisionDetection.pickUpObject) {
        ctx.fillText('Press E to pick up', textCanvas.width /2, textCanvas.height - 100);
    }
    else if (collisionDetection.teleport) {
        ctx.fillText('Press E to teleport', textCanvas.width /2, textCanvas.height - 100);
    }
    else if (collisionDetection.playLevel1) {
        ctx.fillText('Press E to play', textCanvas.width /2, textCanvas.height - 100);
    }
}

// To naredimo, da se text izpiše lepo in ne blurred
function resizeCanvas() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Match textCanvas resolution to screen size
    textCanvas.width = width;
    textCanvas.height = height;

    // Optional: Match webgpuCanvas size for consistency
    webgpuCanvas.width = width;
    webgpuCanvas.height = height;

    // Adjust font size dynamically based on canvas height
    ctx.font = `${Math.round(height / 30)}px Arial`; // Font size is 1/20th of canvas height
    ctx.textAlign = 'center';
}

resizeCanvas();

const arrayOfX = Array(5);
function onKeydown(event) {
    if ((event.key === 'E') || (event.key === 'e')) {
        console.log('E key pressed');
       if(collisionDetection.pickUpObject){
            console.log('Picking up object');
            
       }
       else if(collisionDetection.teleport){
            console.log('Teleport');
       }
       else if(collisionDetection.playLevel1){
            console.log('Play level 1');
            firstPerosnController.gameMode = true;
            collisionDetection.syncPlayerCameraTR(collisionDetection.cameraRigidBody, collisionDetection.camera, ammoLib, 0);
            collisionDetection.updatePLayerPosition([-39, 16, -53], [0.7071, 0, 0, 0], ammoLib);
       }
       else if(firstPerosnController.gameMode){
            firstPerosnController.gameMode = false;
            collisionDetection.syncPlayerCameraTR(collisionDetection.cameraRigidBody, collisionDetection.camera, ammoLib, 1);
            collisionDetection.updatePLayerPosition([-40.38089370727539, 14, -55],[0.5126658082008362, -0.4870048761367798, 0.4870048463344574, 0.512665867805481],  ammoLib);
        }
    }
}

document.addEventListener('keydown', onKeydown);



new ResizeSystem({ canvas, resize }).start();
new UpdateSystem({ update, render }).start();
