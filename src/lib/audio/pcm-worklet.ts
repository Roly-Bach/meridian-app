/**
 * PCM_WORKLET_SOURCE
 *
 * AudioWorklet processor source as a string so it can be loaded via a Blob URL
 * at runtime (avoids a separate static file that breaks with bundler hashing).
 *
 * Behaviour:
 * - Resamples from browser AudioContext sample rate to TARGET_RATE (16 000 Hz)
 *   using linear interpolation.
 * - Converts Float32 [-1, 1] samples to Int16 PCM (Little-Endian, clamped).
 * - Posts each processed chunk as a transferable ArrayBuffer via this.port.
 */
export const PCM_WORKLET_SOURCE = /* js */ `
const TARGET_RATE = 16000;

class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // sampleRate is a global in AudioWorkletGlobalScope
    this._inputRate = sampleRate;
    this._ratio = this._inputRate / TARGET_RATE;
    this._remainder = [];
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const inSamples = input[0]; // Float32Array, mono (channelCount: 1)

    // Compute how many output samples result from this frame
    const outLen = Math.floor(inSamples.length / this._ratio);
    if (outLen === 0) return true;

    const int16 = new Int16Array(outLen);

    for (let i = 0; i < outLen; i++) {
      const srcIdx = i * this._ratio;
      const lo = Math.floor(srcIdx);
      const hi = Math.min(lo + 1, inSamples.length - 1);
      const frac = srcIdx - lo;

      // Linear interpolation
      const sample = inSamples[lo] * (1 - frac) + inSamples[hi] * frac;

      // Clamp to [-1, 1] then scale to Int16 range
      const clamped = Math.max(-1, Math.min(1, sample));
      int16[i] = Math.round(clamped * 0x7fff);
    }

    const buffer = int16.buffer;
    this.port.postMessage(buffer, [buffer]);

    return true;
  }
}

registerProcessor('pcm-processor', PcmProcessor);
`
