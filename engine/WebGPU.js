import { generateMipmaps2D, mipLevelCount } from './WebGPUMipmaps.js';

export function createBuffer(device, { data, usage }) {
    const buffer = device.createBuffer({
        size: Math.ceil(data.byteLength / 4) * 4,
        mappedAtCreation: true,
        usage,
    });
    if (ArrayBuffer.isView(data)) {
        new data.constructor(buffer.getMappedRange()).set(data);
    } else {
        new Uint8Array(buffer.getMappedRange()).set(new Uint8Array(data));
    }
    buffer.unmap();
    return buffer;
}

export function createTextureFromSource(device, {
    source,
    format = 'rgba8unorm',
    usage = 0,
    flipY = false,
}) {
    const size = [source.width, source.height];
    const texture = device.createTexture({
        format,
        size,
        usage: usage |
            GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_DST |
            GPUTextureUsage.RENDER_ATTACHMENT,
        mipLevelCount: 1,
    });
    device.queue.copyExternalImageToTexture(
        { source, flipY },
        { texture },
        size,
    );
    generateMipmaps2D(device, texture);
    return texture;
}

export function createTextureFromData(device, {
    data,
    size,
    bytesPerRow,
    rowsPerImage,
    format = 'rgba8unorm',
    dimension = '2d',
    usage = 0,
    flipY = false,
}) {
    const texture = device.createTexture({
        format,
        size,
        usage: usage | GPUTextureUsage.COPY_DST,
        mipLevelCount: mipLevelCount(size),
    });
    device.queue.writeTexture(
        { texture },
        data,
        { bytesPerRow, rowsPerImage },
        size,
    );
    generateMipmaps2D(device, texture);
    return texture;
}

export function createTexture(device, options) {
    if (options.source) {
        return createTextureFromSource(device, options);
    } else {
        return createTextureFromData(device, options);
    }
}
