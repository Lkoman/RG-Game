import { quat, mat4, vec3 } from 'glm';
import { Camera, Node, Light, Transform } from 'engine/core.js';

import { GLTFLoader } from 'engine/loaders/GLTFLoader.js';
import { ImageLoader } from 'engine/loaders/ImageLoader.js';

import { ResizeSystem } from 'engine/systems/ResizeSystem.js';
import { UpdateSystem } from 'engine/systems/UpdateSystem.js';

import { UnlitRenderer } from 'engine/renderers/UnlitRenderer.js';

import { FirstPersonController } from './engine/controllers/FirstPersonController.js';
import { CollisionDetection } from './engine/controllers/CollisionDetection.js';
import { LevelController } from './engine/controllers/LevelController.js';

import { AmmoLibExport as ammoLib } from './engine/controllers/CollisionDetection.js';

////////////////
// VARIABLES //
///////////////

const timeStep = 1 / 60; // 60 FPS
const maxSubSteps = 2; // če FPS droppa, bo Ammo probu 2 koraka na frame, da ne zgleda preveč laggy
let onKeyDownBool = false;
let saveEvent;

let onClickSave = false; // to shrani, če je bila miška kliknjena, ko je bil gameMode true, da lahko uporabimo v CollisionDetection.js, da ugotovimo na kateri board je kliknil player
let canPlay = false; // če je igralec pobral vseh 5 X-ov lahko igra, drugače ne
let clickTeleportWin = false;

// Pointer
let pointerTexture;


/////////////
// SOUNDS //
////////////

const ambient = document.getElementById('ambient');
ambient.volume = 0.7;
const buttonClick = document.getElementById('button-click');
buttonClick.volume = 0.8;

/////////////////
// FRONT PAGE ///
/////////////////
const startButton = document.getElementById('start-button');
const frontPage = document.getElementById('front-page');
const instructions = document.getElementById('how-to-play-button');
const instructionCanvas = document.getElementById('instructionCanvas');
const canvas = document.getElementById('webgpuCanvas'); // WebGPU canvas za izris igre
const textCanvas = document.getElementById('textCanvas'); // Text canvas za izpis texta nad igro
const youWinCanvas = document.getElementById('you-won-canvas');
const gameOverCanvas = document.getElementById('game-over-canvas');
const resetButton = document.getElementById('main-menu-button');
const winResetButton = document.getElementById('win-main-menu-button');

document.addEventListener('DOMContentLoaded', () => {
    
    canvas.style.display = 'none';
    textCanvas.style.display = 'none';
    instructionCanvas.style.display = 'none';
    youWinCanvas.style.display = 'none';
    gameOverCanvas.style.display = 'none';
    

    startButton.addEventListener('click', () => {
        buttonClick.play();
        // Hide the front page and show the game canvas
        frontPage.style.display = 'none';
        webgpuCanvas.style.display = 'block';
        textCanvas.style.display = 'block';

        // Initialize and start the game
        render();
        ambient.play();
        
    });
    instructions.addEventListener('click', () => {
        buttonClick.play();
        frontPage.style.display = 'none';
        instructionCanvas.style.display = 'block';
    });

    instructionCanvas.addEventListener('click', () => {
        // Hide the instructions canvas and text when clicked
        instructionCanvas.style.display = 'none';
        frontPage.style.display = 'block';
    });

    resetButton.addEventListener('click', () => {
        setTimeout(function(){
            window.location.reload();
          });
    });
    winResetButton.addEventListener('click', () => {
        setTimeout(function(){
            window.location.reload();
          });
    });


});



/////////////////
// SCENE SETUP //
/////////////////

// 
// Set up text canvases
//

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
// Set up level controller
//
const levelController = new LevelController();

//
// Set up the camera
//
const camera = scene.find(node => node.getComponentOfType(Camera));
const firstPerosnController = new FirstPersonController(camera, canvas);
camera.getComponentOfType(Transform).rotation = quat.fromEuler(quat.create(), 0, 0, 0);
camera.addComponent(firstPerosnController);

//const levelController = new LevelController();

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
    name: 'Sun',
}));

light.addComponent({
    update(t, dt) {
        lightTransform.translation = [0, 1000, 0];
    }
});

collisionDetection.dynamicNodes.push(light);

 // load the image for the cursor
async function loadPointerTexture() {
    const imageLoader = new ImageLoader();
    pointerTexture = await imageLoader.load(new URL('./models/world-fun/Images/cursor.png', import.meta.url));
}

await loadPointerTexture();
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
        collisionDetection.setPositions(dt, levelController);
        if (firstPerosnController.gameMode) {
            collisionDetection.checkBoardCollisionsLevel1(onClickSave, levelController);
            onClickSave = false;
        }
        firstPerosnController.updateFPC(t, dt);
    }

    // Update all components
    if (collisionDetection.dynamicNodes) {
        collisionDetection.dynamicNodes.forEach(node => {
            for (const component of node.components) {
                component.update?.(t, dt);
            }
        });
    } else {
        scene.traverse(node => {
            for (const component of node.components) {
                component.update?.(t, dt);
            }
        });
    }

    if (levelController.gameOver){
        textCanvas.style.display = 'none';
        frontPage.style.display = 'none';
        gameOverCanvas.style.display = 'block';
    }
    if (levelController.playerWin && collisionDetection.teleport && clickTeleportWin){
        console.log ("player wins");
        textCanvas.style.display = 'none';
        frontPage.style.display = 'none';
        youWinCanvas.style.display = 'block';
    }
    
    //resizeCanvas();
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

export function drawText() {
    ctx.clearRect(0, 0, textCanvas.width, textCanvas.height); // Clear previous text

    // Napišemo število pobranih X-ov, numPoints dobimo iz CollisionDetection.js
    ctx.fillText("X", 150, 150);
    ctx.fillText(collisionDetection.numPobranihX, 200, 150);
    ctx.fillText("/ 5", 250, 150);
    ctx.fillText("Cats", 180, 250);
    ctx.fillText(collisionDetection.numPobranihCats, 260, 250);

    if (collisionDetection.portal2) {
        if (collisionDetection.pickUpObject) {
            collisionDetection.pickUpObject = collisionDetection.portal2Happy;
        }
    
        if (collisionDetection.portal2Happy == false) {
            ctx.fillText('I am an unused portal...I am sad and lonely. I want a cat.', textCanvas.width /2, textCanvas.height - 170);
            if (collisionDetection.numPobranihCats > 0) {
                ctx.fillText('Press E to give portal a cat', textCanvas.width /2, textCanvas.height - 100);
            }
        } else {
            ctx.fillText('Thank you! You can have this X.', textCanvas.width /2, textCanvas.height - 150);
            if (collisionDetection.portalGiveCat) {
                const x = scene.find(node => node.name === "dy_X2_trigger");
                collisionDetection.updateXPosition(x.name, [19.5,12,1.5], ammoLib, false);
                collisionDetection.portalGiveCat = false;
            }
        }
    }
    // Napišemo text, ki se izpiše glede na collisionDetection (game mechanics)
    else if (collisionDetection.pickUpObject) {
        ctx.fillText('Press E to pick up', textCanvas.width /2, textCanvas.height - 100);
    }
    else if (collisionDetection.teleport) {
        ctx.fillText('Press E to teleport', textCanvas.width /2, textCanvas.height - 100);
    }
    else if (collisionDetection.playLevel1) {
        if (collisionDetection.numPobranihX === 5) {
            canPlay = true;
        }
        if (canPlay) {
            ctx.fillText('Press E to play', textCanvas.width /2, textCanvas.height - 100);
        } else {
            let seZaPobrat = "You have to collect " + (5 - collisionDetection.numPobranihX) + " more Xs to play";
            ctx.fillText(seZaPobrat, textCanvas.width /2, textCanvas.height - 100);
        }
    }
    else if(firstPerosnController.gameMode){
        ctx.fillText('press E to exit Game mode', textCanvas.width /2, textCanvas.height - 100);

        // If gameMode is active, draw the cursor at the mouse coordinates
        if (pointerTexture) {
            ctx.drawImage(pointerTexture, canvas.width / 2, canvas.height / 2);
        }
    }
    if (levelController.playerWin) {
        ctx.fillText('You won! Go to the portal to finish the game.', textCanvas.width /2, textCanvas.height - 170);
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

    //console.log('Canvas resized to:', width, height);

    // Adjust font size dynamically based on canvas height
    ctx.font = `${Math.round(height / 30)}px Arial`; // Font size is 1/30th of canvas height
    ctx.textAlign = 'center';
}

resizeCanvas();

const arrayOfX = Array(5);
function onKeydown(event) {
    //console.log('E key pressed');

    if (collisionDetection.portal2Happy == false && collisionDetection.portal2 && collisionDetection.numPobranihCats > 0) {
        collisionDetection.portalGiveCat = true;
        collisionDetection.portal2Happy = true;
        collisionDetection.numPobranihCats--;
    }
    else if (collisionDetection.pickUpObject) {
        if (collisionDetection.pickedUpObjectName.includes('X')) {
            const x = scene.find(node => node.name === collisionDetection.pickedUpObjectName);
            
            // Now the node's transformation matrix is updated, so reapply it
            collisionDetection.updateXPosition(x.name, [0,0,0], ammoLib, true);
        } else {
            //console.log("Picked up a cat");
            const cat = scene.find(node => node.name === collisionDetection.pickedUpObjectName);
            collisionDetection.updateOPosition(cat.name, [0,0,0], "cat", ammoLib);
            collisionDetection.numPobranihCats++;
        }

    }
    else if (collisionDetection.teleport) {
        if (levelController.playerWin) {
            clickTeleportWin = true;
        }
    }
    else if (collisionDetection.playLevel1 /*&& canPlay*/) {
        // Če je gameMode true, dodamo cursor na mouse pointer
        firstPerosnController.gameMode = true;
        collisionDetection.updatePlayerPosition([-23.8624, 14, -35.993], [0, 0, 0], ammoLib);
    }
    else if (firstPerosnController.gameMode) {
        // Če je gameMode false, odstranimo cursor iz mouse pointerja
        firstPerosnController.gameMode = false;
        // Vn iz gameMode-a
        collisionDetection.updatePlayerPosition([-23.8624, 14, -35.993],[0.5126658082008362, -0.4870048761367798, 0.4870048463344574, 0.512665867805481],  ammoLib);
    }
}

document.addEventListener('click', function () {
    if (firstPerosnController.gameMode) {
        onClickSave = true;
    } else {
        onClickSave = false;
    }
});

function setOnKeyDown(event) {
    if ((event.key === 'E') || (event.key === 'e')) {
        onKeyDownBool = true;
        saveEvent = event;
    }
}   

document.addEventListener('keydown', setOnKeyDown);

new ResizeSystem({ canvas, resize }).start();
new UpdateSystem({ update, render }).start();
