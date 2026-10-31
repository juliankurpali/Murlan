export const CAPTURE_WORKLET_NAME = 'murlan-capture';
export const CAPTURE_WORKLET_SAMPLES = 2048;

export const CAPTURE_WORKLET_SOURCE = `
class MurlanCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buf = new Float32Array(0);
    this._target = ${CAPTURE_WORKLET_SAMPLES};
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel || channel.length === 0) {
      return true;
    }
    const merged = new Float32Array(this._buf.length + channel.length);
    merged.set(this._buf);
    merged.set(channel, this._buf.length);
    let offset = 0;
    while (merged.length - offset >= this._target) {
      const copy = merged.slice(offset, offset + this._target);
      this.port.postMessage(copy, [copy.buffer]);
      offset += this._target;
    }
    this._buf = merged.slice(offset);
    return true;
  }
}
registerProcessor('${CAPTURE_WORKLET_NAME}', MurlanCaptureProcessor);
`;
