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
let onKeyDownBool = false;
let saveEvent;

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
camera.getComponentOfType(Transform).rotation = quat.fromEuler(quat.create(), 0, 0, 0);
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
        if (onKeyDownBool) {
            onKeydown(saveEvent);
            onKeyDownBool = false;
        }
        collisionDetection.setPositions(dt);
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

    // Napišemo število pobranih X-ov, numPoints dobimo iz CollisionDetection.js
    ctx.fillText("X", 50, 50);
    ctx.fillText(collisionDetection.numPobranihX, 100, 50);
    ctx.fillText("/ 5", 135, 50);

    // Napišemo text, ki se izpiše glede na collisionDetection (game mechanics)
    if (collisionDetection.pickUpObject) {
        ctx.fillText('Press E to pick up', textCanvas.width /2, textCanvas.height - 100);
    }
    else if (collisionDetection.teleport) {
        ctx.fillText('Press E to teleport', textCanvas.width /2, textCanvas.height - 100);
    }
    else if (collisionDetection.playLevel1) {
        ctx.fillText('Press E to play', textCanvas.width /2, textCanvas.height - 100);
    }
    else if(firstPerosnController.gameMode){
        ctx.fillText('press E to exit Game mode', textCanvas.width /2, textCanvas.height - 100);
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
    ctx.font = `${Math.round(height / 30)}px Arial`; // Font size is 1/30th of canvas height
    ctx.textAlign = 'center';
}

resizeCanvas();

const arrayOfX = Array(5);
function onKeydown(event) {
    if ((event.key === 'E') || (event.key === 'e')) {
        console.log('E key pressed');
       if(collisionDetection.pickUpObject){
            PickUpX();
       }
       else if(collisionDetection.teleport){
            console.log('Teleport');
       }
       else if(collisionDetection.playLevel1){
            console.log('Play level 1');
            firstPerosnController.gameMode = true;
            collisionDetection.syncPlayerCameraTR(collisionDetection.cameraRigidBody, collisionDetection.camera, ammoLib, 0);
            collisionDetection.updatePLayerPosition([-39, 16, -53], [0.7071, 0, 1, 0], ammoLib);
       }
       else if(firstPerosnController.gameMode){
            firstPerosnController.gameMode = false;
            collisionDetection.syncPlayerCameraTR(collisionDetection.cameraRigidBody, collisionDetection.camera, ammoLib, 1);
            collisionDetection.updatePLayerPosition([-40.38089370727539, 14, -55],[0.5126658082008362, -0.4870048761367798, 0.4870048463344574, 0.512665867805481],  ammoLib);
        }
    }
}

function PickUpX(){
    const names = ['dy_X1_trigger', 'dy_X2_trigger', 'dy_X3_trigger', 'dy_X4_trigger', 'dy_X5_trigger'];
    const x = scene.find(node => names.includes(node.name));
    if(x){
        console.log('X picked up');
        const transform = x.getComponentOfType(Transform);
        const position = transform.translation;
        transform.translation = [0,0,0];
        const rigidBody = collisionDetection.rigidBodyMap.get(x);
        if (rigidBody) {
            const physicsTransform = new Ammo.btTransform();
            rigidBody.getMotionState().getWorldTransform(physicsTransform);
            physicsTransform.setOrigin(new Ammo.btVector3(0, 0, 0));
            rigidBody.setWorldTransform(physicsTransform);
            rigidBody.getMotionState().setWorldTransform(physicsTransform);
            Ammo.destroy(physicsTransform);
            console.log("X is rigidBody")
        }
        collisionDetection.numPobranihX++;
    }
}

function setOnKeyDown(event) {
    onKeyDownBool = true;
    saveEvent = event;
}

document.addEventListener('keydown', setOnKeyDown);

new ResizeSystem({ canvas, resize }).start();
new UpdateSystem({ update, render }).start();
