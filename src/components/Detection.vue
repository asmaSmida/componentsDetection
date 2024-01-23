<template>
  <div>
    <div class="background" :style="{ backgroundImage: 'url(' + require('@/assets/robot.jpg') + ')' }">

  
    <h1>Object Detection</h1>
    <section id="demos">
      <div ref="liveView">
        <button @click="enableCam" class="invisible" ref="enableWebcamButton">Loading...</button>
        <video ref="webcam" class="video" width="640" height="640" playsinline crossorigin="anonymous"></video>
      </div>
    </section>
    </div>
  </div>
</template>


<script>
/* eslint-disable */
import * as tf from '@tensorflow/tfjs';
import { toRaw } from 'vue';
export default {
  name: 'Detection',
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
      ]
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
      this.enableWebcamButton.innerHTML = "Start Camera !";
    },
    async predictWebcamTF() {
      const video = this.$refs.webcam;
 
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

  for (let i = 0; i < this.children.length; i++) {
    liveView.removeChild(this.children[i]);
  }
  this.children.splice(0);


// Extract necessary information from predictions
const boxes = predictions[0].arraySync();
const scores = predictions[1].arraySync();
const classes = predictions[2].arraySync();
const validPredictions = predictions[3].arraySync()[0];

console.log("Valid Predictions: " + validPredictions);
console.log("scores" +scores+" scores 1 "+scores[1]);
console.log("classes" +classes+" classes 1 "+classes[1]);

//************************************ */
// Assuming this code is inside a non-async function or top-level code

(async () => {
  // Assuming boxes and scores are your bounding box coordinates and scores respectively
  const numBoxes = boxes[0].length;
  const boxesTensor = tf.tensor2d(boxes[0], [numBoxes, 4]);

  const nmsIndices = await tf.image.nonMaxSuppressionAsync(
    boxesTensor,
    tf.tensor1d(scores[0]),
    0.7, // Adjust the IoU threshold as needed
  );

  // Now nmsBoxes and nmsScores contain the non-maximum suppressed bounding boxes and scores

  // Iterate through valid predictions after NMS
  const nmsIndicesArray = await nmsIndices.array();

  nmsIndicesArray.forEach(i => {
    const currentBox = boxes[0][i];
    const score = scores[0][i];
    const klassIndex = classes[0][i];

    // Check if the current prediction is valid
    if (score > 0.7 && klassIndex >= 0 && klassIndex < this.names.length) {
      const klass = this.names[klassIndex];

      // Extract bounding box coordinates
      const [y1, x1, y2, x2] = currentBox;

      // Calculate dimensions and positions
      const width_ = (x2 - x1) * this.vidWidth;
      const height_ = (y2 - y1) * this.vidHeight;
      const minY = (y1 * this.vidHeight + this.yStart).toFixed(0);
      const minX = (x1 * this.vidWidth + this.xStart).toFixed(0);

      // Add constraint: Skip if width or height is too small
      const minWidthThreshold = '10px'; // Set your minimum width threshold
      const minHeightThreshold = '10px'; // Set your minimum height threshold
      if (width_ < minWidthThreshold || height_ < minHeightThreshold) {
        return; // Skip displaying this bounding box
      }
      // Create and append highlighter element for bounding box
      const highlighter = document.createElement("div");
      highlighter.setAttribute("class", "highlighter");
      highlighter.style = `
        left: ${minX}px;
        top: ${minY}px;
        width: ${width_}px;
        height: ${height_}px;
        border: 2px solid white;
        box-shadow: 0 0 50px 0 white;
        z-index: 1;
        position: fixed;
        display: grid;
        place-content: center;
      `;

      liveView.appendChild(highlighter);
      this.children.push(highlighter);


      // Create and append label element for the component name
      const label = document.createElement("div");
      label.setAttribute("class", "label");
      label.style = `
        left: ${minX}px;
        top: ${minY}px;
        color: white;
        position: fixed;  // Make sure the label is positioned relative to the document
        display: grid;
        place-content: center;
      `;
      label.innerHTML = `<p>${klass}</p>`;
      liveView.appendChild(label);
      this.children.push(label);
    }
  });
})();



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
  background-color: #1e5d87;
  border: solid 1px #1e5d87;
  color: #FFF;
  pointer-events: all;
  transition: .2s ease;
  position: absolute;
  top: 20px;
  left: 600px;
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
.label p {
  padding: 5px;
 
  font-size: 10px; /* Adjust font size as needed */
  color: white;
  position: absolute;
 
}.background {
  background-size: contain; /* Use "contain" to fit the entire image while maintaining its aspect ratio */
  background-position: center;
  background-repeat: no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
}



</style>

