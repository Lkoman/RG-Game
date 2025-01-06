import { quat, vec3, mat4 } from 'glm';

import { Camera, Transform } from '../core.js';

import { maxSpeed } from './FirstPersonController.js';

export let camRigidBody;
export let AmmoLibExport;

export class CollisionDetection {

    constructor(scene) {
        this.scene = scene;
        this.staticModelsData = []; // za shranjevanje podatkov static meshov ki bodo combined
        this.modelsData = []; // za shranjevanje moving modelov, ki bodo seperate
        this.camera = scene.find(node => node.getComponentOfType(Camera));
        this.rigidBodyMap = new Map(); // btRigidBody -> { name, or some info }
        this.cameraRigidBody = null;

        this.handleInit();
    }

    handleInit() {

        ///////////////////
        // IMPORT MODELS //
        //////////////////

        var tmpData = [];

        // Dodamo vse nodes v sceni v tmpData, da jih potem razdelimo v modelsData in staticModelsData
        this.scene.traverse(node => {
            console.log(node);
            
            // Pogledamo če ima model komponento Mesh, če je nima, pomeni da je Camera ali Light in jih ne rabimo
            const meshPrimitives = node.components?.[1]?.primitives;
            meshPrimitives?.forEach(primitive => {
                if (primitive) {
                    // Pogledamo če model že obstaja v tmpData
                    const zeObstaja = tmpData.find(model => model.name === node.name);
                    if (zeObstaja) {
                        // Združimo indices and vertices
                        zeObstaja.vertices.push(...primitive.mesh.vertices);
                        const indexOffset = zeObstaja.vertices.length / 3; // Adjust indices for offset
                        const skupneIndices = primitive.mesh.indices.map(index => index + indexOffset);
                        zeObstaja.indices.push(...skupneIndices);
                    } else {
                        // Če še ne obstajamo, dodamo nov zapis v tmpData
                        tmpData.push({
                            name: node.name,
                            vertices: [...primitive.mesh.vertices],
                            indices: [...primitive.mesh.indices],
                            position: [...node.components[0].translation],
                            rotation: [...node.components[0].rotation],
                            scale: [...node.components[0].scale],
                            aabb: null,
                        });
                    }
                }
            });
        });
    
        //console.log("tmpData: ", tmpData);

        tmpData.forEach(model => {
            // Shranimo podatke za moving modele v modelsData
            if (model.name === "Stone dude") {
                this.modelsData.push(model);
            } 
            // Shranimo podatke za static modele v staticModelsData
            else {
                this.staticModelsData.push(model);
            }
        });

        console.log("modelsData: ", this.modelsData);
        console.log("staticModelsData: ", this.staticModelsData);

        /////////////////
        // IMPORT AMMO //
        ////////////////

        Ammo().then((AmmoLib) => {
            // Inicializacija Ammo.js
            // #1 Initialize the physics world
            const collisionConfiguration = new AmmoLib.btDefaultCollisionConfiguration();
            const dispatcher = new AmmoLib.btCollisionDispatcher(collisionConfiguration); // responsible for managing collision algorithms
            const broadphase = new AmmoLib.btDbvtBroadphase(); // broad-phase collision detection - checks potential collisions for simple objects
            const solver = new AmmoLib.btSequentialImpulseConstraintSolver(); // actual collision
            const physicsWorld = new AmmoLib.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, collisionConfiguration); // integrates all components and creates the physics worls, manages physics simulation
            physicsWorld.setGravity(new AmmoLib.btVector3(0, -5.81, 0));

            // Step 2: Add static objects (e.g., triangle mesh for the "plane")
            this.addAllObjects(physicsWorld, AmmoLib, this.modelsData, 0, 1); // flag = 0, mass = 1 for dynamic
            this.addAllObjects(physicsWorld, AmmoLib, this.staticModelsData, 1, 0); // flag = 1, mass = 0 for static

            this.cameraRigidBody = this.addPlayerCamera(physicsWorld, AmmoLib);
            if (!this.cameraRigidBody) {
                console.error("Failed to add camera rigid body.");
            } else {
                this.rigidBodyMap.set(this.cameraRigidBody, { name: "Camera" });
            }

            AmmoLibExport = AmmoLib;

            // Step 3: Run collision checks in your game loop
            this.setupGameLoop(physicsWorld, AmmoLib);
        }).catch((error) => {
            console.error('Failed to initialize Ammo.js:', error);
        });
    }

    setupGameLoop(physicsWorld, AmmoLib) {
        this.updatePhysics = (timeStep, maxSubSteps, dt) => {
            // Advances the physics world
            physicsWorld.stepSimulation(timeStep, maxSubSteps);

            // Set camera rigid body with application of pyhsics
            //this.clampCameraVelocity(AmmoLib); // before that clamp the velocity so it doesnt accelerate into neskončnost
            this.setPlayerCamera(this.cameraRigidBody, this.camera, AmmoLib, dt);

            // Synchronize objects in the scene with physics world
            this.syncObjects(AmmoLib);

            // Check for collisions
            this.checkCollisions(physicsWorld, AmmoLib);
        };
    }

    // Add all objects to the physics world, razdeljeni na static in dynamic
    addAllObjects(physicsWorld, AmmoLib, modelType, flag, mass) {
        modelType.forEach(model => {
            const { vertices, indices, name, position, rotation, scale } = model;
            console.log("--------------------------------");
            console.log(name);
            if (name == "Stone dude") {
                mass = 200;
                //console.log("Initial position of stone dude: " , position);
            }

            this.addObject(vertices, indices, AmmoLib, physicsWorld, flag, mass, position, rotation, scale)
            .then(rigidBody => {
                model.rigidBody = rigidBody;
                this.rigidBodyMap.set(rigidBody, { name: name });
                console.log("Object ", name, " added successfully.");
            })
            .catch((error) => {
                if (modelType === this.modelsData) console.error("Failed to add DYNAMIC object", name , error);
                else console.error("Failed to add STATIC object", name, error);
            });
        });
    }

    addObject(vertices, indices, AmmoLib, physicsWorld, flag, mass, initialPosition, initialRotation, initialScale) {
        return new Promise((resolve, reject) => {
            try {
                var shape;

                // --- STATIC body (flag == 1) ---
                /*if (flag == 1) {
                    // #1 Create btTriangleMesh
                    const triangleMesh = new AmmoLib.btTriangleMesh();

                    // #2 Add the triangles to the triangle mesh
                    for (let i = 0; i < indices.length; i += 3) {
                        const index0 = indices[i] * 3;
                        const index1 = indices[i + 1] * 3;
                        const index2 = indices[i + 2] * 3;

                        // Create Ammo vectors for each vertex
                        const vertex0 = new AmmoLib.btVector3(vertices[index0], vertices[index0 + 1], vertices[index0 + 2]);
                        const vertex1 = new AmmoLib.btVector3(vertices[index1], vertices[index1 + 1], vertices[index1 + 2]);
                        const vertex2 = new AmmoLib.btVector3(vertices[index2], vertices[index2 + 1], vertices[index2 + 2]);

                        // Add the triangles to the btTriangleMesh
                        triangleMesh.addTriangle(vertex0, vertex1, vertex2);

                        // Free the memory
                        AmmoLib.destroy(vertex0);
                        AmmoLib.destroy(vertex1);
                        AmmoLib.destroy(vertex2);
                    }

                    // #3 Create a collision shape (for static objects)
                    shape = new AmmoLib.btBvhTriangleMeshShape(triangleMesh, true);
                    
                } 

                // --- DYNAMIC body (flag == 0) ---
                else if (flag == 0) {*/
                    // For a dynamic mesh, we build a convex hull shape:
                    //shape = new AmmoLib.btConvexHullShape();

                    let min = [Infinity, Infinity, Infinity];
                    let max = [-Infinity, -Infinity, -Infinity];

                    for (let i = 0; i < vertices.length; i += 3) {
                        var vertexPos = vertices[i].position;
                        /*const vx = vertices[i];
                        const vy = vertices[i + 1];
                        const vz = vertices[i + 2];

                        // Create a temporary Ammo vector
                        const tempVec = new AmmoLib.btVector3(vx, vy, vz);

                        // Add point to the hull
                        shape.addPoint(tempVec, true);

                        // Destroy the temporary Ammo vector
                        AmmoLib.destroy(tempVec);*/

                        // AABB
                        min[0] = Math.min(min[0], vertexPos[0]);
                        min[1] = Math.min(min[1], vertexPos[1]);
                        min[2] = Math.min(min[2], vertexPos[2]);

                        max[0] = Math.max(max[0], vertexPos[0]);
                        max[1] = Math.max(max[1], vertexPos[1]);
                        max[2] = Math.max(max[2], vertexPos[2]);
                    }

                    const halfExtents = [
                        (max[0] - min[0]) / 2,
                        (max[1] - min[1]) / 2,
                        (max[2] - min[2]) / 2
                    ]

                    console.log(max[0] - min[0]);
                    console.log(max[1] - min[1]);
                    console.log(max[2] - min[2]);
                    console.log("--------------------------------");

                    shape = new AmmoLib.btBoxShape(new AmmoLib.btVector3(halfExtents[0], halfExtents[1], halfExtents[2]));
                //}

                // #4 Define the initial position, rotation, and scale of the object
                const transform = new AmmoLib.btTransform();
                transform.setIdentity();

                // Set initial position
                transform.setOrigin(new AmmoLib.btVector3(initialPosition[0], initialPosition[1], initialPosition[2]));

                // Set initial rotation
                const rotation = new AmmoLib.btQuaternion(initialRotation[0], initialRotation[1], initialRotation[2], initialRotation[3]);
                transform.setRotation(rotation);

                // Set the initial scale
                const scaling = new AmmoLib.btVector3(initialScale[0], initialScale[1], initialScale[2]);
                shape.setLocalScaling(scaling);

                const motionState = new AmmoLib.btDefaultMotionState(transform);

                // #6 If mass > 0, we need to calculate local inertia:
                const localInertia = new AmmoLib.btVector3(0, 0, 0);
                if (mass > 0) {
                    shape.calculateLocalInertia(mass, localInertia);
                }
                const rigidBodyInfo = new AmmoLib.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
                const rigidBody = new AmmoLib.btRigidBody(rigidBodyInfo);

                rigidBody.setCollisionFlags(flag); // flag = 1 for static objects, 2 for kinematic objects, 0 for dynamic

                console.log(rigidBody.getCenterOfMassTransform().getOrigin().x(), rigidBody.getCenterOfMassTransform().getOrigin().y(), rigidBody.getCenterOfMassTransform().getOrigin().z());

                // #5 Add the rigid body to the physics world
                physicsWorld.addRigidBody(rigidBody);

                // Resolve the promise
                resolve(rigidBody);

            } catch (error) {
                // Reject the promise if something goes wrong
                reject(error);
            }
        });
    }

    addPlayerCamera(physicsWorld, AmmoLib) {
        // Create a box collision shape
        const halfExtents = new AmmoLib.btVector3(0.3, 1, 0.3); // half dimensions of the box
        const boxShape = new AmmoLib.btBoxShape(halfExtents);
    
        // Create the rigid body
        const transform = new AmmoLib.btTransform();
        transform.setIdentity();
        transform.setOrigin(new AmmoLib.btVector3(50, 2, 50));

        const motionState = new AmmoLib.btDefaultMotionState(transform);
    
        const mass = 1;
        const localInertia = new AmmoLib.btVector3(0, 0, 0);
        boxShape.calculateLocalInertia(mass, localInertia);

        const rigidBodyInfo = new AmmoLib.btRigidBodyConstructionInfo(mass, motionState, boxShape, localInertia);
        const rigidBody = new AmmoLib.btRigidBody(rigidBodyInfo);
        rigidBody.setAngularFactor(new Ammo.btVector3(0, 0, 0)); // Prevent the camera from rotating / falling over
    
        rigidBody.setCollisionFlags(0); // dynamic
        rigidBody.setDamping(0.2, 0.0); // 50% linear damping, 0% angular damping

        rigidBody.setActivationState(4); // Disable deactivation for the camera
    
        // Add the rigid body to the physics world
        physicsWorld.addRigidBody(rigidBody);

        // Output bounding box coordinates
        const center = transform.getOrigin();
        console.log("--------------------------------");
        console.log("CAMERA");

        const min = new AmmoLib.btVector3(
            center.x() - halfExtents.x(),
            center.y() - halfExtents.y(),
            center.z() - halfExtents.z()
        );

        const max = new AmmoLib.btVector3(
            center.x() + halfExtents.x(),
            center.y() + halfExtents.y(),
            center.z() + halfExtents.z()
        );

        console.log("Bounding Box Min:", min.x(), min.y(), min.z());
        console.log("Bounding Box Max:", max.x(), max.y(), max.z());
        console.log("--------------------------------");
    
        // Clean up temporary Ammo.js objects
        AmmoLib.destroy(min);
        AmmoLib.destroy(max);    
        AmmoLib.destroy(halfExtents);
        AmmoLib.destroy(transform);
        AmmoLib.destroy(localInertia);

        camRigidBody = rigidBody;

        this.rigidBodyMap.set(rigidBody, { name: "Camera" });
        this.cameraRigidBody = rigidBody;
        return rigidBody;
    }

    setPlayerCamera(rigidBody, camera, AmmoLib, dt) {
        // preberemo from ammo/bullet kje je rigid body od kamere
        const transform = new AmmoLib.btTransform();
        rigidBody.getMotionState().getWorldTransform(transform);
    
        // preberemo koordinate rigid body od kamere
        const origin = transform.getOrigin();
        const rotation = transform.getRotation();

        // find the nodes transform component
        const cameraTransform  = camera.getComponentOfType(Transform);
        if (cameraTransform) {
            // nastavimo translation kamere na njen rigid body position
            cameraTransform.translation = [origin.x(), origin.y() + 0.8, origin.z()];
            cameraTransform.rotation = quat.fromValues(
                rotation.x(),
                rotation.y(),
                rotation.z(),
                rotation.w()
            );
        }

        //console.log("Camera pos:", cameraTransform.translation);
        //console.log("Camera rigid:", origin.x(), origin.y(), origin.z());
            
        AmmoLib.destroy(transform);
    }

    syncObjects(AmmoLib) {
        this.modelsData.forEach(model => {
            if (!model.rigidBody) {
                console.warn(`Rigid body not found for model: ${model.name}`);
                return;
            }
    
            const motionState = model.rigidBody.getMotionState();
            if (motionState) {
                const transform = new AmmoLib.btTransform();
                motionState.getWorldTransform(transform);
    
                const origin = transform.getOrigin();
                const rotation = transform.getRotation();
                //console.log("--------------------------------");
                //console.log("Stone Dude pos:", origin.x(), origin.y(), origin.z());
    
                const node = this.scene.find(node => node.name === model.name);
                const transformComponent = node.getComponentOfType(Transform);
    
                if (transformComponent) { // naj bodo vsi dynamic objects na tleh ali da padajo
                    /*if (origin.y() > 0) {
                        origin.setY(0);
                    }*/
                    transformComponent.translation = [origin.x(), origin.y(), origin.z()];
                    transformComponent.rotation = quat.fromValues(
                        rotation.x(),
                        rotation.y(),
                        rotation.z(),
                        rotation.w()
                    );
                }
                //console.log("--------------------------------");

                //console.log("Stone Dude pos:", origin.x(), origin.y(), origin.z());
                //console.log("Stone dude translation:", transformComponent.translation);

                /*this.rigidBodyMap.forEach((value, key) => {
                    console.log("Rigid body name: ", value.name);
                    if (value.name === "Stone dude") {
                        console.log(key.getCenterOfMassTransform().getOrigin().x(), key.getCenterOfMassTransform().getOrigin().y(), key.getCenterOfMassTransform().getOrigin().z());
                    }
                });*/


                AmmoLib.destroy(transform);
            }
        });
    }

    checkCollisions(physicsWorld) {
        const dispatcher = physicsWorld.getDispatcher();
        const numManifolds = dispatcher.getNumManifolds();
        //console.log(numManifolds);
    
        for (let i = 0; i < numManifolds; i++) {
            const contactManifold = dispatcher.getManifoldByIndexInternal(i);
            const bodyA = contactManifold.getBody0();
            const bodyB = contactManifold.getBody1();

            var objectA, objectB;

            this.rigidBodyMap.forEach((value, key) => {
                if (key.kB === bodyA.kB) {
                   objectA = value;
                }
                if (key.kB === bodyB.kB) {
                    objectB = value;
                }
            });

            //console.log("objectA ", objectA);
            //console.log("objectB ", objectB);
    
            const numContacts = contactManifold.getNumContacts();
            for (let j = 0; j < numContacts; j++) {
                const contactPoint = contactManifold.getContactPoint(j);
    
                if (contactPoint.getDistance() <= 0) {
                    //console.log("Collision detected between ", objectA.name, " and ", objectB.name);
                }
            }
        }
    }
}