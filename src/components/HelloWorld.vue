<template>
  <div>
    <h1>Object Detection</h1>
    <section id="demos">
      <div ref="liveView">
        <button @click="enableCam" class="invisible" ref="enableWebcamButton">Loading...</button>
        <video ref="webcam" class="background" width="640" height="640" playsinline crossorigin="anonymous"></video>
      </div>
    </section>
  </div>
</template>


<script>
/* eslint-disable */
import * as tf from '@tensorflow/tfjs';
import { toRaw } from 'vue';
export default {
  name: 'HelloWorld',
  data() {
    return {
      vidWidth: 0,
      vidHeight: 0,
      xStart: 0,
      yStart: 0,
      model: null,
      children: [],
      enableWebcamButton: null, // Initialize enableWebcamButton
      vw: Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0),
      vh: Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0),
      names: [
        'capteur_infrarouge',
        'capteur_ultrason',
        'carte_L298',
        'carte_ULN2003',
        'carte_arduino',
        'moteur_courant_continu',
        'moteur_pas_a_pas'
      ],
    };
  },
  methods: {
    getUserMediaSupported() {
      return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    },
    async enableCam() {
      if (!this.model) {
        return;
      }
      this.enableWebcamButton.classList.add("removed");
      const constraints = {
        video: true,
      };

      navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
        },
      }).then((stream) => {
        let video = this.$refs.webcam;
        console.log("eee", video)
        video.srcObject = stream;
        video.onloadedmetadata = () => {
          this.vidWidth = 300;
          this.vidHeight = 640;
          this.xStart = Math.floor((this.vw - this.vidWidth) / 2);
          this.yStart = Math.floor((this.vh - this.vidHeight) / 2) >= 0 ? Math.floor((this.vh - this.vidHeight) / 2) : 0;
          video.play();
          video.addEventListener("loadeddata", this.predictWebcamTF);
        };
      });
    },
    async asyncLoadModel() {

      await tf.setBackend('webgl');

      // Add this line to configure TensorFlow.js to use the 'webgl' backend
      await tf.ready();



      const model_url = "http://127.0.0.1:8081/model.json";
      this.model = await tf.loadGraphModel(model_url);

      console.log("Model loaded");
      this.enableWebcamButton.classList.remove("invisible");
      this.enableWebcamButton.innerHTML = "Start camera";
    },
    async predictWebcamTF() {
      const video = this.$refs.webcam;
      console.log("hello prd", video);
      await tf.nextFrame();
      const tfImg = tf.browser.fromPixels(video);

      // Preprocess the image to match your model's input size
      const targetSize = [640, 640];
      const tf4d = tf.image.resizeBilinear(tfImg, targetSize).expandDims();
      // Get the raw model from Vue's reactive object
      let raw_model = toRaw(this.model);

      // Run inference using the raw model
      // Run inference using executeAsync
      let predictionsPromise = raw_model.executeAsync(tf4d);

      // Wait for the Promise to resolve
      let predictions = await predictionsPromise;
      console.log(predictions);
      // Run inference
      //  let predictions = await this.model.executeAsync(tf4d);
      // Post-process and render the predictions
      this.renderPredictionBoxes(predictions);

      // Dispose of tensors
      tfImg.dispose();
      tf4d.dispose();
      // Call predictWebcamTF again to continuously update predictions
      requestAnimationFrame(this.predictWebcamTF);

    },

    renderPredictionBoxes(predictions) {
  const liveView = this.$refs.liveView;
  console.log("liveView", this.$refs);
  for (let i = 0; i < this.children.length; i++) {
    liveView.removeChild(this.children[i]);
  }
  this.children.splice(0);
  console.log("child", this.children);

  // Unpack the prediction arrays
  const boxes = predictions[0].arraySync();
  const scores = predictions[1].arraySync();
  const classes = predictions[2].arraySync();
  const validPredictions = predictions[3].arraySync()[0];
  console.log("validPredictions"+validPredictions);
  for (let i = 0; i < validPredictions; ++i) {
    console.log("boxes["+i+"   "+boxes[i]);
    const currentBox = boxes[i];
    if (!currentBox) {
      console.warn(`Skipping invalid box at index ${i}.`);
      continue;
    }

    const [y1, x1, y2, x2] = currentBox;

    if (x1 === undefined || x2 === undefined || y1 === undefined || y2 === undefined) {
      console.warn(`Skipping invalid box at index ${i}.`);
      continue;
    }
   
    const score = scores[i];
    const klassIndex = classes[i];
    console.log("Klasss", klassIndex, classes[0][i]);
    console.log("box", boxes);
    console.log("class", classes);

    if (score > 0.7 && klassIndex >= 0 && klassIndex < this.names.length) {
      const klass = this.names[klassIndex];
      const width_ = (x2 - x1) * this.vidWidth;
      const height_ = (y2 - y1) * this.vidHeight;

      const minY = (y1 * this.vidHeight + this.yStart).toFixed(0);
      const minX = (x1 * this.vidWidth + this.xStart).toFixed(0);

      const highlighter = document.createElement("div");
      highlighter.setAttribute("class", "highlighter");
      highlighter.style = `left: ${minX}px; top: ${minY}px; width: ${width_}px; height: ${height_}px;`;
      highlighter.innerHTML = `<p>${Math.round(score * 100)}% ${klass}</p>`;
      liveView.appendChild(highlighter);
      this.children.push(highlighter);

      console.log("childern2", this.children);
    }
  }
},

  },
  async mounted() {
    this.enableWebcamButton = this.$refs.enableWebcamButton; // Assign this.enableWebcamButton
    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);

    if (this.getUserMediaSupported()) {
      this.enableWebcamButton.addEventListener("click", this.enableCam);
    } else {
      console.warn("getUserMedia() is not supported by your browser");
    }

    await this.asyncLoadModel();
    // Start the continuous prediction loop
    // requestAnimationFrame(this.predictWebcamTF);
  },
};
</script>



<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
body {
  font-family: sans-serif;
  margin: 0;
  background: black;
}

h1 {
  opacity: 0;
}

video {
  width: 100vw;
  height: 100vh;
}

button {
  border-radius: 4px;
  cursor: pointer;
  padding: 10px 30px;
  background-color: #0060DF;
  border: solid 1px #0060DF;
  color: #FFF;
  pointer-events: all;
  transition: .2s ease;
  position: absolute;
  top: 20px;
  left: 20px;
  position: fixed;
}

.removed {
  opacity: 0;
  pointer-events: none;
}

.invisible {
  border: 1px solid #B1B1B3;
  background: white;
  color: #000;
  cursor: default;
  pointer-events: none;
}

.camView {
  cursor: pointer;
}

.highlighter p {
  padding: 5px;
  z-index: 2;
  font-size: 30px;
  color: white;
  position: absolute;
}

.highlighter {
  border: 2px solid white;
  box-shadow: 0 0 50px 0 white;
  z-index: 1;
  position: fixed;
  display: grid;
  place-content: center;
}

.background {

  position: fixed;
  z-index: -1000;
  left: 0;
  top: 0;
  background: black;
}
</style>

