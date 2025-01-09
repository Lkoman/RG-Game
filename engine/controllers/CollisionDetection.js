import { quat, vec3, mat4 } from 'glm';

import { Camera, Transform } from '../core.js';

import { maxSpeed } from './FirstPersonController.js';

import { getGlobalModelMatrix } from '../core/SceneUtils.js';

export let camRigidBody;
export let AmmoLibExport;

export class CollisionDetection {

    constructor(scene) {
        this.scene = scene;
        this.staticModelsData = []; // za shranjevanje podatkov static meshov ki bodo combined
        this.modelsData = []; // za shranjevanje moving modelov, ki bodo seperate
        this.camera = scene.find(node => node.getComponentOfType(Camera));
        this.rigidBodyMap = new Map(); // map za collisione
        this.triggerRigidBodyMap = new Map(); // map za triggerje
        this.cameraRigidBody = null;
        this.regex = /\.\d{3}/; // za testiranje če je model an instance

        // Game mechanics
        this.pickUpObject = false;
        this.teleport = false;
        this.playLevel1 = false;

        // groups and masks
        this.GROUP_CAMERA = 1 << 0;
        this.GROUP_PLANE = 1 << 1;
        this.GROUP_STATIC = 1 << 2;
        this.GROUP_STATIC_TRIGGER = 1 << 3;
        this.GROUP_DYNAMIC = 1 << 4;
        this.GROUP_DYNAMIC_TRIGGER = 1 << 5;

        this.MASK_CAMERA = this.GROUP_PLANE | this.GROUP_STATIC | this.GROUP_STATIC_TRIGGER | this.GROUP_DYNAMIC | this.GROUP_DYNAMIC_TRIGGER;
        this.MASK_PLANE = this.GROUP_DYNAMIC | this.GROUP_CAMERA;
        this.MASK_STATIC = this.GROUP_CAMERA | this.GROUP_DYNAMIC;
        this.MASK_STATIC_TRIGGER = this.GROUP_CAMERA;
        this.MASK_DYNAMIC = this.GROUP_PLANE | this.GROUP_CAMERA | this.GROUP_STATIC;
        this.MASK_DYNAMIC_TRIGGER = this.GROUP_CAMERA;

        this.handleInit();
    }

    handleInit() {

        ///////////////////
        // IMPORT MODELS //
        //////////////////

        var tmpData = [];
        let instances = [];

        // Dodamo vse nodes v sceni v tmpData, da jih potem razdelimo v modelsData in staticModelsData
        this.scene.traverse(node => {
            //console.log(node);
            if (node.name && !node.name.startsWith("nc_")) { // nc pomeni no collision
                if (this.regex.test(node.name)) { // ČE JE INSTANCE
                    let imeOriginala = node.name;
                    imeOriginala = imeOriginala.replace(this.regex, ""); // naredimo ime originala

                    instances.push({
                        name: node.name,
                        original: imeOriginala,
                        position: [...this.clampToDecimals(node.components[0].translation, 5)],
                        rotation: [...this.clampToDecimals(node.components[0].rotation, 5)],
                        scale: [...this.clampToDecimals(node.components[0].scale, 5)]
                    });
                }

                // Pogledamo če ima model komponento Mesh, če je nima, pomeni da je Camera ali Light in jih ne rabimo
                const meshPrimitives = node.components?.[1]?.primitives;
                meshPrimitives?.forEach(primitive => {
                    if (primitive) {
                        // Pogledamo če model že obstaja v tmpData
                        let obstojeciModel;
                        let zeObstaja = false;
                        tmpData.forEach(model => {
                            if (model.name === node.name) {
                                obstojeciModel = tmpData.find(tmpData => tmpData.name === node.name);
                                zeObstaja = true;
                            }
                        });
                        if (zeObstaja) {
                            // Združimo indices and vertices
                            obstojeciModel.vertices.push(...primitive.mesh.vertices);
                            const indexOffset = obstojeciModel.vertices.length / 3; // Adjust indices for offset
                            const skupneIndices = primitive.mesh.indices.map(index => index + indexOffset);
                            obstojeciModel.indices.push(...skupneIndices);
                        } else {
                            // Če še ne obstajamo, dodamo nov zapis v tmpData
                            tmpData.push({
                                name: node.name,
                                vertices: [...primitive.mesh.vertices],
                                indices: [...primitive.mesh.indices],
                                position: [...this.clampToDecimals(node.components[0].translation, 5)],
                                rotation: [...this.clampToDecimals(node.components[0].rotation, 5)],
                                scale: [...this.clampToDecimals(node.components[0].scale, 5)],
                            });
                        }
                    }
                });
            }
            //console.log(node);
        });

        //console.log("instances: ", instances);

        tmpData.forEach(parentModel => {
            instances.forEach(instance => {
                if (parentModel.name === instance.original) {
                    
                    // Fucked, nevem zakaj??
                    /*console.log(instance.name);

                    // Parent TRS matrices
                    let parentTranslationM = this.createTranslationMatrix(parentModel.position);
                    let parentRotationM = this.clampMatrix(this.quaternionToMatrix(parentModel.rotation), 0);
                    let parentScaleM = this.createScaleMatrix(parentModel.scale);

                    let localRotationM = this.clampMatrix(this.quaternionToMatrix(instance.rotation), 0);
                    let localScaleM = this.createScaleMatrix(instance.scale);
                    console.log("localRotationM: ", localRotationM);
                    console.log("localScaleM: ", localScaleM);

                    let localTranslationM = this.createTranslationMatrix(instance.position);
                    console.log("localTranslationM: ", localTranslationM);

                    // vrstni red S * R * T obrnjen
                    let localTRS = this.multiplyMatrices(localTranslationM, this.multiplyMatrices(localRotationM, localScaleM));
                    console.log("localTRS: ", localTRS);

                    // vrstni red S * R * T obrnjen
                    let parentTRS = this.multiplyMatrices(parentTranslationM, this.multiplyMatrices(parentRotationM, parentScaleM));
                    console.log("parentTRS: ", parentTRS);

                    // MULTIPLY PARENT TRS * CHILD TRS to get child world coords
                    let worldMatrix = this.multiplyMatrices(parentTRS, localTRS);
                    console.log("worldMatrix: ", worldMatrix);

                    // DECOMPOSE WORLD MATRIX
                    let worldTrans = [worldMatrix[0][3], worldMatrix[1][3], worldMatrix[2][3]];
                    console.log("worldTrans: ", worldTrans);
                    let worldScale = [
                        Math.sqrt(worldMatrix[0][0] ** 2 + worldMatrix[0][1] ** 2 + worldMatrix[0][2] ** 2),
                        Math.sqrt(worldMatrix[1][0] ** 2 + worldMatrix[1][1] ** 2 + worldMatrix[1][2] ** 2),
                        Math.sqrt(worldMatrix[2][0] ** 2 + worldMatrix[2][1] ** 2 + worldMatrix[2][2] ** 2)
                    ];                    
                    console.log("worldScale: ", worldScale);
                    let worldRotation;
                    let normalizedMatrix = this.normalizeMatrix(worldScale[0], worldScale[1], worldScale[2], worldMatrix);
                    worldRotation = this.matrixToQuaternion(normalizedMatrix);
                    console.log("worldRotation: ", worldRotation);*/


                    // 5) Add the “instance” as a new model, but reusing the parent's geometry
                    tmpData.push({
                    name: instance.name,
                    vertices: [...parentModel.vertices],
                    indices: [...parentModel.indices],
                    position: instance.position,       // final world coords
                    rotation: instance.rotation,       // final world rotation (quaternion)
                    scale:    instance.scale      // final world scale
                    });

                    parentModel.isOriginal = true;
                }
            });
        });

        // Remove original models from tmpData
        tmpData = tmpData.filter(model => !model.isOriginal);

        console.log("tmpData: ", tmpData);
    
        tmpData.forEach(model => {
            // Shranimo podatke za moving modele v modelsData
            if (model.name.startsWith("dy_")) { // dy pomeni dynamic
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

    clampMatrix(matrix, decimal) {
        for (let i = 0; i < matrix.length; i++) {
            matrix[i] = this.clampToDecimals(matrix[i], decimal);
        }
        return matrix;
    }

    clampToDecimals(vector, decimal) {
        for (let i = 0; i < vector.length; i++) {
            vector[i] = parseFloat(vector[i].toFixed(decimal));
        }
        return vector;
    }

    normalizeMatrix(scaleX, scaleY, scaleZ, matrix) {
        return [
            [matrix[0][0] / scaleX, matrix[0][1] / scaleX, matrix[0][2] / scaleX],
            [matrix[1][0] / scaleY, matrix[1][1] / scaleY, matrix[1][2] / scaleY],
            [matrix[2][0] / scaleZ, matrix[2][1] / scaleZ, matrix[2][2] / scaleZ],
        ];
    }

    createTranslationMatrix(translation){
        return [
            [1, 0, 0, translation[0]],
            [0, 1, 0, translation[1]],
            [0, 0, 1, translation[2]],
            [0, 0, 0, 1]
        ];
    }

    createScaleMatrix(scale){
        return [
            [scale[0], 0, 0, 0],
            [0, scale[1], 0, 0],
            [0, 0, scale[2], 0],
            [0, 0, 0, 1]
        ];
    }
    
    // Utility function for matrix multiplication
    multiplyMatrices(a, b) {
        const result = Array(4).fill(null).map(() => Array(4).fill(0));
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                for (let k = 0; k < 4; k++) {
                    result[i][j] += a[i][k] * b[k][j];
                }
            }
        }
        return result;
    }

    quaternionToMatrix(q) {
        const [qx, qy, qz, qw] = q;

        console.log("q: ", q);
    
        const xx = qx * qx;
        const yy = qy * qy;
        const zz = qz * qz;
        const xy = qx * qy;
        const xz = qx * qz;
        const yz = qy * qz;
        const wx = qw * qx;
        const wy = qw * qy;
        const wz = qw * qz;
    
        return [
            [1 - 2 * (yy + zz), 2 * (xy - wz), 2 * (xz + wy), 0],
            [2 * (xy + wz), 1 - 2 * (xx + zz), 2 * (yz - wx), 0],
            [2 * (xz - wy), 2 * (yz + wx), 1 - 2 * (xx + yy), 0],
            [0, 0, 0, 1]
        ];
    }

    matrixToQuaternion(mat) {
        const m00 = mat[0][0], m01 = mat[0][1], m02 = mat[0][2];
        const m10 = mat[1][0], m11 = mat[1][1], m12 = mat[1][2];
        const m20 = mat[2][0], m21 = mat[2][1], m22 = mat[2][2];
    
        let w, x, y, z;
    
        const trace = m00 + m11 + m22;
    
        if (trace > 0) {
            const s = 0.5 / Math.sqrt(trace + 1.0);
            w = 0.25 / s;
            x = (m21 - m12) * s;
            y = (m02 - m20) * s;
            z = (m10 - m01) * s;
        } else if (m00 > m11 && m00 > m22) {
            const s = 2.0 * Math.sqrt(1.0 + m00 - m11 - m22);
            w = (m21 - m12) / s;
            x = 0.25 * s;
            y = (m01 + m10) / s;
            z = (m02 + m20) / s;
        } else if (m11 > m22) {
            const s = 2.0 * Math.sqrt(1.0 + m11 - m00 - m22);
            w = (m02 - m20) / s;
            x = (m01 + m10) / s;
            y = 0.25 * s;
            z = (m12 + m21) / s;
        } else {
            const s = 2.0 * Math.sqrt(1.0 + m22 - m00 - m11);
            w = (m10 - m01) / s;
            x = (m02 + m20) / s;
            y = (m12 + m21) / s;
            z = 0.25 * s;
        }
    
        return [x, y, z, w];
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

        console.log(this.rigidBodyMap);
    }

    // Add all objects to the physics world, razdeljeni na static in dynamic
    addAllObjects(physicsWorld, AmmoLib, modelType, flag, mass) {
        modelType.forEach(model => {
            const { vertices, indices, name, position, rotation, scale } = model;
            let aabb = false;
            let sphere = false;
            if (name == "dy_stone dude") {
                mass = 200;
                aabb = true;
            } else if (name.startsWith("aabb_")) {
                aabb = true;
            } else if (name.startsWith("sphere_")) {
                sphere = true;
            } else if (name.startsWith("dy_apple")) {
                mass = 0.3;
            }
            if (name.endsWith("_trigger")) {
                // flag = 4 je btCollisionObject.CF_NO_CONTACT_RESPONSE
                this.addObject(vertices, indices, AmmoLib, physicsWorld, 4, 0, position, rotation, scale, false, true, true, name)
                .then(rigidBody => {
                    model.triggerRigidBody = rigidBody;
                    this.triggerRigidBodyMap.set(rigidBody.kB, { name: name });
                    //console.log("Object ", name, " added successfully.");
                })
                .catch((error) => {
                    if (modelType === this.modelsData) console.error("Failed to add triggerRigidBody for DYNAMIC object", name , error);
                    else console.error("Failed to add triggerRigidBody for STATIC object", name, error);
                });
            }
            this.addObject(vertices, indices, AmmoLib, physicsWorld, flag, mass, position, rotation, scale, aabb, sphere, false, name)
            .then(rigidBody => {
                model.rigidBody = rigidBody;
                this.rigidBodyMap.set(rigidBody, { name: name });
                //console.log("Object ", name, " added successfully.");
            })
            .catch((error) => {
                if (modelType === this.modelsData) console.error("Failed to add rigidBody for DYNAMIC object", name , error);
                else console.error("Failed to add rigidBody for STATIC object", name, error);
            });

            this.delay(50);
        });
    }

    addObject(vertices, indices, AmmoLib, physicsWorld, flag, mass, initialPosition, initialRotation, initialScale, aabb, sphere, trigger, name) {
        return new Promise((resolve, reject) => {
            try {
                var shape;

                if (trigger) {
                    shape = this.aabb_sphere(AmmoLib, vertices, "sphere", 1, 3);
                } else if (aabb) {
                    shape = this.aabb_sphere(AmmoLib, vertices, "aabb", 0, 0);
                } else if (sphere) {
                    shape = this.aabb_sphere(AmmoLib, vertices, "sphere", 0, 0);
                }
                else {
                    // --- STATIC body (flag == 1) ---
                    if (flag == 1) {
                        shape = this.bvhStatic(AmmoLib, vertices, indices);
                    } 

                    // --- DYNAMIC body (flag == 0) ---
                    else if (flag == 0) {
                        shape = this.convexHull(AmmoLib, vertices);
                        //shape = this.aabb_sphere(AmmoLib, vertices, "aabb", 0, 0);
                    }
                }

                // če je ta rigid body a trigger mu dodamo margin
                if (trigger) {
                    shape.setMargin(20);
                }

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

                // #5 Add the rigid body to the physics world, with speicifc groups and masks, so they know how to interact with each other
                if (name.startsWith("Plane") || name.startsWith("Hell")) {
                    physicsWorld.addRigidBody(rigidBody, this.GROUP_PLANE, this.MASK_PLANE);
                }
                // dynamic objects (triggers and non triggers)
                else if (name.startsWith("dy_")) {
                    if (trigger) {
                        physicsWorld.addRigidBody(rigidBody, this.GROUP_DYNAMIC_TRIGGER, this.MASK_DYNAMIC_TRIGGER);
                    } else {
                        physicsWorld.addRigidBody(rigidBody, this.GROUP_DYNAMIC, this.MASK_DYNAMIC);
                    }
                }
                // static objects (triggers and non triggers)
                else {
                    if (trigger) {
                        physicsWorld.addRigidBody(rigidBody, this.GROUP_STATIC_TRIGGER, this.MASK_STATIC_TRIGGER);
                    } else {
                        physicsWorld.addRigidBody(rigidBody, this.GROUP_STATIC, this.MASK_STATIC);
                    }
                }

                // Resolve the promise
                resolve(rigidBody);

            } catch (error) {
                // Reject the promise if something goes wrong
                reject(error);
            }
        });
    }

    aabb_sphere(AmmoLib, vertices, type, trigger, triggerMargin) {
        let min = [Infinity, Infinity, Infinity];
        let max = [-Infinity, -Infinity, -Infinity];

        for (let i = 0; i < vertices.length; i ++) {
            var vertexPos = vertices[i].position;

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
        ];

        if (type == "aabb") {
            return (new AmmoLib.btBoxShape(new AmmoLib.btVector3(halfExtents[0], halfExtents[1], halfExtents[2])));
        } else if (type == "sphere") {
            if (trigger) {
                return (new AmmoLib.btSphereShape(triggerMargin));
            }
            return (new AmmoLib.btSphereShape(halfExtents[0]));
        } else {
            console.error("Invalid type for aabb_sphere function.");
        }
    }

    bvhStatic(AmmoLib, vertices, indices) {
        // #1 Create btTriangleMesh
        const triangleMesh = new AmmoLib.btTriangleMesh();

        // #2 Add the triangles to the triangle mesh
        for (let i = 0; i < indices.length; i += 3) {
            const index0 = indices[i];
            const index1 = indices[i + 1];
            const index2 = indices[i + 2];

            // Create Ammo vectors for each vertex
            const vertex0 = new AmmoLib.btVector3(vertices[index0].position[0], vertices[index0].position[1], vertices[index0].position[2]);
            const vertex1 = new AmmoLib.btVector3(vertices[index1].position[0], vertices[index1].position[1], vertices[index1].position[2]);
            const vertex2 = new AmmoLib.btVector3(vertices[index2].position[0], vertices[index2].position[1], vertices[index2].position[2]);

            // Add the triangles to the btTriangleMesh
            triangleMesh.addTriangle(vertex0, vertex1, vertex2);

            // Free the memory
            AmmoLib.destroy(vertex0);
            AmmoLib.destroy(vertex1);
            AmmoLib.destroy(vertex2);
        }

        // #3 Create a collision shape (for static objects)
        return(new AmmoLib.btBvhTriangleMeshShape(triangleMesh, true));
    }

    convexHull(AmmoLib, vertices) {
        // For a dynamic mesh, we build a convex hull shape:
        let shape = new AmmoLib.btConvexHullShape();

        for (let i = 0; i < vertices.length; i ++) {
            var vertexPos = vertices[i].position;
            const vx = vertexPos[0];
            const vy = vertexPos[1];
            const vz = vertexPos[2];

            // Create a temporary Ammo vector
            const tempVec = new AmmoLib.btVector3(vx, vy, vz);

            // Add point to the hull
            shape.addPoint(tempVec, true);

            // Destroy the temporary Ammo vector
            AmmoLib.destroy(tempVec);
        }

        return shape;
    }

    addPlayerCamera(physicsWorld, AmmoLib) {
        // Create a box collision shape
        const halfExtents = new AmmoLib.btVector3(0.3, 1, 0.3); // half dimensions of the box
        const boxShape = new AmmoLib.btBoxShape(halfExtents);

        /*const radius = 0.3;
        const sphereShape = new AmmoLib.btSphereShape(radius);

        const scale = new AmmoLib.btVector3(0.3, 2, 0.3);

        const scaleVector = new AmmoLib.btVector3(scale[0], scale[1], scale[2]);
        sphereShape.setLocalScaling(scaleVector);*/
    
        // Create the rigid body
        const transform = new AmmoLib.btTransform();
        transform.setIdentity();
        transform.setOrigin(new AmmoLib.btVector3(50, 20, 50));

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
        physicsWorld.addRigidBody(rigidBody, this.GROUP_CAMERA, this.MASK_CAMERA);
    
        // Clean up temporary Ammo.js objects
        AmmoLib.destroy(halfExtents);
        AmmoLib.destroy(transform);
        AmmoLib.destroy(localInertia);

        camRigidBody = rigidBody;

        this.camera.components[1].fovy = 0.7;

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

        //console.log(this.triggerRigidBodyMap);
        //console.log("Camera pos:", cameraTransform.translation);
        //console.log("Camera rigid:", origin.x(), origin.y(), origin.z());
        //console.log(this.camera); // Log camera to confirm it's the active one

            
        AmmoLib.destroy(transform);
    }

    syncObjects(AmmoLib) {
        this.modelsData.forEach(model => {
            // odstrani rigidBody če pade dol

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
        
                const node = this.scene.find(node => node.name === model.name);
                const transformComponent = node.getComponentOfType(Transform);
        
                if (transformComponent) { // naj bodo vsi dynamic objects na tleh ali da padajo
                    transformComponent.translation = [origin.x(), origin.y(), origin.z()];
                    transformComponent.rotation = quat.fromValues(
                        rotation.x(),
                        rotation.y(),
                        rotation.z(),
                        rotation.w()
                    );
                }

                // Če ima model tudi trigger body, mu nastavimo triggerBody = rigidBody position
                if (model.triggerRigidBody) {
                    //console.log("Setting trigger body position: ", origin.x(), origin.y(), origin.z());
                    const triggerBodyTransform = new AmmoLib.btTransform();
                    model.triggerRigidBody.getMotionState().getWorldTransform(triggerBodyTransform);

                    triggerBodyTransform.setOrigin(origin);
                    model.triggerRigidBody.setWorldTransform(triggerBodyTransform);
                    model.triggerRigidBody.getMotionState().setWorldTransform(triggerBodyTransform);

                    AmmoLib.destroy(triggerBodyTransform);
                }
        
                AmmoLib.destroy(transform);
            }
        });
    }

    checkCollisions(physicsWorld) {
        const dispatcher = physicsWorld.getDispatcher();
        const numManifolds = dispatcher.getNumManifolds();
        let triggerCollision = false;

        for (let i = 0; i < numManifolds; i++) {
            const contactManifold = dispatcher.getManifoldByIndexInternal(i);
            const bodyA = contactManifold.getBody0();
            const bodyB = contactManifold.getBody1();

            if (this.triggerRigidBodyMap.has(bodyA.kB)) {
                this.checkForTriggers(bodyA);
                triggerCollision = true;
            }
        }

        if (!triggerCollision) {
            this.pickUpObject = false;
            this.teleport = false;
            this.playLevel1 = false;
        }
    }

    checkForTriggers(body) {
        console.log(body.kB);
        console.log(this.triggerRigidBodyMap.get(body.kB));

        var triggeredObject = this.triggerRigidBodyMap.get(body.kB);

        if (triggeredObject) {
            if (triggeredObject.name.includes("PlayingBoard")) {
                this.playLevel1 = true;
                this.teleport = false;
                this.pickUpObject = false;
            }
            else if (triggeredObject.name.includes("dy_X")) {
                this.pickUpObject = true;
                this.teleport = false;
            }
            else if (triggeredObject.name.includes("Portal")) {
                this.teleport = true;
                this.pickUpObject = false;
                this.playLevel1 = false;
            }
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
}