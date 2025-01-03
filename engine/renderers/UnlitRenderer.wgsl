struct VertexInput {
    @location(0) position: vec3f,
    @location(1) texcoords: vec2f,
    @location(2) normal: vec3f,
}

struct VertexOutput {
    @builtin(position) clipPosition: vec4f,
    @location(0) position: vec3f,
    @location(1) texcoords: vec2f,
    @location(2) normal: vec3f,
}

struct FragmentInput {
    @location(0) position: vec3f,
    @location(1) texcoords: vec2f,
    @location(2) normal: vec3f,
}

struct FragmentOutput {
    @location(0) color: vec4f,
}

struct CameraUniforms {
    viewMatrix: mat4x4f,
    projectionMatrix: mat4x4f,
    fogColor: vec4f,   // Add fog color
    fogNear: f32,      // Add fog near
    fogFar: f32,       // Add fog far
    padding: vec2f,    // Alignment padding
    cameraPosition: vec3f,
}

struct ModelUniforms {
    modelMatrix: mat4x4f,
    normalMatrix: mat3x3f,
}

struct MaterialUniforms {
    baseFactor: vec4f,
}

struct LightUniforms {
    color: vec3f,
    position: vec3f,
}

@group(0) @binding(0) var<uniform> camera: CameraUniforms;

@group(1) @binding(0) var<uniform> model: ModelUniforms;

@group(2) @binding(0) var<uniform> material: MaterialUniforms;
@group(2) @binding(1) var baseTexture: texture_2d<f32>;
@group(2) @binding(2) var baseSampler: sampler;

@group(3) @binding(0) var<uniform> light: LightUniforms;

@vertex
fn vertex(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    output.clipPosition = camera.projectionMatrix * camera.viewMatrix * model.modelMatrix * vec4(input.position, 1);
    output.position = (model.modelMatrix * vec4(input.position, 1)).xyz;
    output.texcoords = input.texcoords;
    output.normal = model.normalMatrix * input.normal;

    return output;
}

@fragment
fn fragment(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    let N = normalize(input.normal);
    let L = normalize(light.position - input.position);
    let lambert = max(dot(N, L), 0);
    let ambientLight = vec3f(0.3, 0.3, 0.3);

    let materialColor = textureSample(baseTexture, baseSampler, input.texcoords) * material.baseFactor;
    var color = materialColor * vec4f(light.color * lambert + ambientLight, 1);

    // Calculate the distance in the XY plane (movement-based)
    let distanceXY = length(vec2(input.position.x, input.position.y) - vec2(camera.cameraPosition.x, camera.cameraPosition.y));

    // Create a dome constraint for Z (fixed reference point for the dome)
    let domeZ = abs(input.position.z - camera.cameraPosition.z); // Absolute vertical distance

    // Combine XY movement with Z dome effect
    let combinedDistance = length(vec2(distanceXY, domeZ)); // Treat XY and Z as orthogonal components

    // Compute fog factor
    let fogFactor = clamp((combinedDistance - camera.fogNear) / (camera.fogFar - camera.fogNear), 0.0, 1.0);

    // Blend fog with the fragment color
    output.color = mix(color, camera.fogColor, fogFactor);

    return output;
}
