export const CAPTURE_WORKLET_NAME = 'murlan-capture';
export const CAPTURE_WORKLET_SAMPLES = 2048;

export const CAPTURE_WORKLET_SOURCE = `
class MurlanCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._target = ${CAPTURE_WORKLET_SAMPLES};
    this._buf = new Float32Array(this._target * 2);
    this._len = 0;
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel || channel.length === 0) {
      return true;
    }
    if (this._len + channel.length > this._buf.length) {
      const next = new Float32Array(Math.max(this._buf.length * 2, this._len + channel.length));
      next.set(this._buf.subarray(0, this._len));
      this._buf = next;
    }
    this._buf.set(channel, this._len);
    this._len += channel.length;
    while (this._len >= this._target) {
      const copy = this._buf.slice(0, this._target);
      this.port.postMessage(copy, [copy.buffer]);
      this._buf.copyWithin(0, this._target, this._len);
      this._len -= this._target;
    }
    return true;
  }
}
registerProcessor('${CAPTURE_WORKLET_NAME}', MurlanCaptureProcessor);
`;
