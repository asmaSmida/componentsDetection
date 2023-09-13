<template>
  <div>
    <h1>Object Detection</h1>
    <section id="demos">
      <div id="liveView">
        <button @click="enableCam" class="invisible" ref="enableWebcamButton">Loading...</button>
        <video ref="webcam" class="background" playsinline crossorigin="anonymous"></video>
      </div>
    </section>
  </div>
</template>

<script>
 /* eslint-disable */ 
import * as tf from '@tensorflow/tfjs';

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
          this.vidWidth = video.videoHeight;
          this.vidHeight = video.videoWidth;
          this.xStart = Math.floor((vw - this.vidWidth) / 2);
          this.yStart = Math.floor((vh - this.vidHeight) / 2) >= 0 ? Math.floor((vh - this.vidHeight) / 2) : 0;
          video.play();
          video.addEventListener("loadeddata", this.predictWebcamTF);
        };
      });
    },
    async asyncLoadModel() {
      this.model = await tf.loadLayersModel('C:\Users\pc\Desktop\stage\vueJsLiveDetection\new-project\model\model.json');
   
      console.log("Model loaded");
      this.enableWebcamButton.classList.remove("invisible");
      this.enableWebcamButton.innerHTML = "Start camera";
    },
    async predictWebcamTF() {
      const video = this.$refs.webcam;
      await tf.nextFrame();
      const tfImg = tf.browser.fromPixels(video);
      const smallImg = tf.image.resizeBilinear(tfImg, [this.vidHeight, this.vidWidth]);
      const resized = tf.cast(smallImg, "int32");
      var tf4d_ = tf.tensor4d(Array.from(resized.dataSync()), [1, this.vidHeight, this.vidWidth, 3]);
      const tf4d = tf.cast(tf4d_, "int32");

      let predictions = await this.model.executeAsync(tf4d);
      this.renderPredictionBoxes(predictions[4].dataSync(), predictions[1].dataSync(), predictions[2].dataSync());
      tfImg.dispose();
      smallImg.dispose();
      resized.dispose();
      tf4d.dispose();
    },
    renderPredictionBoxes(predictionBoxes, predictionClasses, predictionScores) {
      const liveView = this.$refs.liveView; // Use this.$refs.liveView
      for (let i = 0; i < this.children.length; i++) {
        liveView.removeChild(this.children[i]);
      }
      this.children.splice(0);

      for (let i = 0; i < 99; i++) {
        const minY = (predictionBoxes[i * 4] * this.vidHeight + this.yStart).toFixed(0);
        const minX = (predictionBoxes[i * 4 + 1] * this.vidWidth + this.xStart).toFixed(0);
        const maxY = (predictionBoxes[i * 4 + 2] * this.vidHeight + this.yStart).toFixed(0);
        const maxX = (predictionBoxes[i * 4 + 3] * this.vidWidth + this.xStart).toFixed(0);
        const score = predictionScores[i * 3] * 100;
        const width_ = (maxX - minX).toFixed(0);
        const height_ = (maxY - minY).toFixed(0);

        if (score > 70 && score < 100) {
          const highlighter = document.createElement("div");
          highlighter.setAttribute("class", "highlighter");
          highlighter.style = "left: " + minX + "px; " + "top: " + minY + "px; " + "width: " + width_ + "px; " + "height: " + height_ + "px;";
          highlighter.innerHTML = "<p>" + Math.round(score) + "% " + predictionClasses[i*3] + "</p>";
          liveView.appendChild(highlighter);
          this.children.push(highlighter);
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
    width: 100%;
    position: fixed;
    z-index: -1000;
    left: 0;
    top: 0;
    background: black;
  }
</style>

