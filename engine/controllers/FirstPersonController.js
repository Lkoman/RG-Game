import { quat, vec3, vec4, mat4 } from 'glm';

import { Transform } from '../core/Transform.js';

import { camRigidBody, AmmoLibExport as AmmoLib } from './CollisionDetection.js';

export class FirstPersonController {

    constructor(node, domElement, {
        mass = 1,
        pitch = 0,
        yaw = 0,
        velocity = [0, 0, 0],
        acceleration = 5,
        maxSpeed = 3,
        decay = 0.99999,
        pointerSensitivity = 0.001,
        cameraRigidBody = null,
        gameMode = false,
        cursorX = 0,
        cursorY = 0
    } = {}) {
        this.node = node;
        this.domElement = domElement;

        this.cameraRigidBody = cameraRigidBody;

        this.keys = {};

        this.pitch = pitch;
        this.yaw = yaw;
        this.mass = mass;
        
        this.velocity = velocity;
        this.acceleration = acceleration;
        this.maxSpeed = maxSpeed;
        this.decay = decay;
        this.pointerSensitivity = pointerSensitivity;

        this.spacePressed = false;
        this.gameMode = gameMode;

        this.cursorX = cursorX;
        this.cursorY = cursorY;

        this.initHandlers();
    }

    initHandlers() {
        this.pointermoveHandler = this.pointermoveHandler.bind(this);
        this.keydownHandler = this.keydownHandler.bind(this);
        this.keyupHandler = this.keyupHandler.bind(this);

        const element = this.domElement;
        const doc = element.ownerDocument;

        doc.addEventListener('keydown', this.keydownHandler);
        doc.addEventListener('keyup', this.keyupHandler);

        element.addEventListener('click', e => element.requestPointerLock());
        doc.addEventListener('pointerlockchange', e => {
            if (doc.pointerLockElement === element) {
                doc.addEventListener('pointermove', this.pointermoveHandler);
            } else {
                doc.removeEventListener('pointermove', this.pointermoveHandler);
            }
        });
    }

    updateFPC(t, dt) {
        // Calculate forward and right vectors.
        const cos = Math.cos(this.yaw);
        const sin = Math.sin(this.yaw);
        const forward = [-sin, 0, -cos];
        const right = [cos, 0, -sin];
        const up = [0, 1, 0];

        // If shift is pressed, max speed is doubled.
        if (this.keys['ShiftLeft']) {
            this.maxSpeed = 5;
        } else {
            this.maxSpeed = 3;
        }
        // Map user input to the acceleration vector.
        const acc = vec3.create();
        if(this.gameMode === false){
            
            if (this.keys['KeyW']) {
                vec3.add(acc, acc, forward);
            }
            if (this.keys['KeyS']) {
                vec3.sub(acc, acc, forward);
            }
            if (this.keys['KeyD']) {
                vec3.add(acc, acc, right);
            }
            if (this.keys['KeyA']) {
                vec3.sub(acc, acc, right);
            }
            // Jump
            if (this.keys['Space'] && !this.spacePressed) {
                vec3.add(acc, acc, up);

                this.spacePressed = true;
            }
        }

        // Normalize direction, then multiply by maxSpeed
        const len = vec3.length(acc);
        if (len > 0) {
            vec3.scale(acc, acc, this.maxSpeed / len);
        }

        // Set the velocity on the cameraRigidBody
        if (camRigidBody) {
            // Read current velocity of the camera rigid body
            const currentVel = camRigidBody.getLinearVelocity();
        
            const currentVec = [currentVel.x(), currentVel.y(), currentVel.z()]; // Convert to vec3
            AmmoLib.destroy(currentVel);
        
            if (acc[1] === 0) {
                acc[1] = currentVec[1];
            }
            const desiredVec = [acc[0], acc[1], acc[2]]; // Only move in x and z, keep y/height
        
            // Compute the difference from the current velocity
            const diffX = desiredVec[0] - currentVec[0];
            const diffY = desiredVec[1] - currentVec[1];
            const diffZ = desiredVec[2] - currentVec[2];
        
            const impulse = new AmmoLib.btVector3(diffX * this.mass, diffY * this.mass, diffZ * this.mass);
            
            // Apply the impulse to adjust velocity
            camRigidBody.applyCentralImpulse(impulse);
            AmmoLib.destroy(impulse);
        } else {
            console.log("No camRigidBody found");
        }
        
        // handle camera orientation by directly setting node’s rotation
        const transform = this.node.getComponentOfType(Transform);
        if (transform) {
            // We'll let Bullet handle position, but we'll do rotation ourselves
            const rotation = quat.create();
            quat.rotateY(rotation, rotation, this.yaw);
            quat.rotateX(rotation, rotation, this.pitch);
            transform.rotation = rotation;
        }
    }

    pointermoveHandler(e) {
        //if(this.gameMode === false){
            const dx = e.movementX;
            const dy = e.movementY;

            this.pitch -= dy * this.pointerSensitivity;
            this.yaw   -= dx * this.pointerSensitivity;

            const twopi = Math.PI * 2;
            const halfpi = Math.PI / 2;

            this.pitch = Math.min(Math.max(this.pitch, -halfpi), halfpi);
            this.yaw = ((this.yaw % twopi) + twopi) % twopi;
        /*} 
        // Za izpisovanje cursorja na ekran pri gameMode
        else if (this.gameMode) {
            this.cursorX += e.movementX;
            this.cursorY += e.movementY;
    
            // Clamp cursor position to stay within canvas bounds (optional)
            this.cursorX = Math.max(0, Math.min(this.cursorX, window.innerWidth));
            this.cursorY = Math.max(0, Math.min(this.cursorY, window.innerHeight));
        }*/
    }

    keydownHandler(e) {
        this.keys[e.code] = true;
    }

    keyupHandler(e) {
        this.keys[e.code] = false;

        if (e.code === 'Space') {
            this.spacePressed = false;
        }
    }

}
