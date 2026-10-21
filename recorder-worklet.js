class Recorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.active = false;
    this.left = [];
    this.right = [];
    this.port.onmessage = ({ data }) => {
      if (data === "start") {
        this.left = [];
        this.right = [];
        this.active = true;
      }
      if (data === "stop") {
        this.flush();
        this.active = false;
        this.port.postMessage({ done: true });
      }
    };
  }
  flush() {
    if (!this.left.length) return;
    const l = new Float32Array(this.left),
      r = new Float32Array(this.right);
    this.port.postMessage({ left: l, right: r }, [l.buffer, r.buffer]);
    this.left = [];
    this.right = [];
  }
  process(inputs) {
    const channels = inputs[0];
    if (this.active && channels[0]) {
      const l = channels[0],
        r = channels[1] || l;
      for (let i = 0; i < l.length; i++) {
        this.left.push(l[i]);
        this.right.push(r[i]);
      }
      if (this.left.length >= 2048) this.flush();
    }
    return true;
  }
}
registerProcessor("hichord-recorder", Recorder);
