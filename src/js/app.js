import Cropper from "cropperjs";
import "cropperjs/dist/cropper.css";

// canvasサイズ
const CANVAS_SIZE = 32;
// 表示時のグリッドのサイズ
const GRID_SIZE = 32;
// 表示用canvasサイズ
const CANVAS_DISP_SIZE = 1024;
// MGOでのカラーパレット用の除数
const DIVISOR = 8.21;

const worker = new Worker("worker.js");

window.addEventListener("DOMContentLoaded", () => {
  const uploadElm = document.getElementById("upload");
  const uploadedElm = document.getElementById("uploaded");
  const uploadArea = document.getElementById("upload-area");
  const originalImageFile = document.querySelector("#original-image-file");

  const closeBtn = document.querySelector("#close");
  const colorsElm = document.querySelector("#colors");

  // Step
  const stepCrop = document.querySelector("#step-crop");
  const stepResult = document.querySelector("#step-result");
  const nextBtnElm = document.querySelector("#next");
  const backBtnElm = document.querySelector("#back");

  const renderer = new Renderer({
    canvas: document.querySelector("#canvas"),
    canvasHighlight: document.getElementById("canvas-highlight"),
    canvasGrid: document.getElementById("canvas-grid"),
    canvasCropper: document.getElementById("cropper-canvas"),
  });

  uploadArea.addEventListener("change", (e) => {
    showCropArea();
    changeHandler({
      e,
      callback: (image) => {
        preview(image);
      },
    });
  });
  uploadArea.addEventListener("dragenter", (e) => {
    e.preventDefault();
  });
  uploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
  });
  uploadArea.addEventListener("dragleave", (e) => {
    e.preventDefault();
  });
  uploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    showCropArea();
    changeHandler({
      e,
      data: e.dataTransfer.files[0],
      callback: (image) => {
        preview(image);
      },
    });
  });

  colorsElm.addEventListener("click", (e) => {
    const index = Number(e.target.dataset.color);
    const colorsItem = document.querySelectorAll(".color");
    colorsItem.forEach((v, i) => {
      if (i === index) {
        v.classList.add("selected");
      } else {
        v.classList.remove("selected");
      }
    });
    if (index !== -1) {
      updateRGB(index);
    }
    renderer.highlightColor(index);
  });

  nextBtnElm.addEventListener("click", () => {
    stepCrop.classList.add("hidden");
    stepResult.classList.remove("hidden");
    renderer.reduce(15);
  });

  backBtnElm.addEventListener("click", () => {
    stepCrop.classList.remove("hidden");
    stepResult.classList.add("hidden");
  });

  closeBtn.addEventListener("click", () => {
    originalImageFile.value = "";
    resetPreview();
  });

  const showCropArea = () => {
    nextBtnElm.classList.remove("opacity-50");
    nextBtnElm.classList.remove("pointer-events-none");
    uploadElm.classList.add("hidden");
    uploadedElm.classList.remove("hidden");
  };

  const hideCropArea = () => {
    nextBtnElm.classList.add("opacity-50");
    nextBtnElm.classList.add("pointer-events-none");
    uploadElm.classList.remove("hidden");
    uploadedElm.classList.add("hidden");
  };

  const preview = (image) => {
    renderer.crop(image);
    showCropArea();
  };

  const resetPreview = () => {
    renderer.restore();
    hideCropArea();
  };

  const updateRGB = (index) => {
    const color = renderer.palette[index];
    const rBar = document.querySelector("#rgb-r__bar");
    const gBar = document.querySelector("#rgb-g__bar");
    const bBar = document.querySelector("#rgb-b__bar");
    const rNumber = document.querySelector("#rgb-r__number");
    const gNumber = document.querySelector("#rgb-g__number");
    const bNumber = document.querySelector("#rgb-b__number");
    rBar.style.width = `${(color[0] / 255) * 100}%`;
    gBar.style.width = `${(color[1] / 255) * 100}%`;
    bBar.style.width = `${(color[2] / 255) * 100}%`;
    rNumber.innerHTML = `${Math.round(color[0] / DIVISOR)} (${color[0]})`;
    gNumber.innerHTML = `${Math.round(color[1] / DIVISOR)} (${color[1]})`;
    bNumber.innerHTML = `${Math.round(color[2] / DIVISOR)} (${color[2]})`;
  };

  const showColors = (palette) => {
    const colors = document.querySelector("#colors");
    const colorsItem = colors.querySelectorAll(".color");
    colorsItem.forEach((v) => {
      v.parentNode.removeChild(v);
    });
    const fragment = document.createDocumentFragment();
    palette.forEach((v, i) => {
      const dom = document.createElement("div");
      dom.setAttribute("class", "color cursor-pointer");
      dom.dataset.color = i;
      dom.innerHTML = `<div class="aspect rounded-sm pointer-events-none" style="background-color: rgb(${v[0]}, ${v[1]}, ${v[2]})"></div>`;
      fragment.appendChild(dom);
    });
    colors.prepend(fragment);
  };

  worker.addEventListener("message", (response) => {
    renderer.draw(response.data.imageData, response.data.palette);
    renderer.drawGrid();
    showColors(response.data.palette);
  });
});

const changeHandler = ({ e, data, callback }) => {
  // drag and dropの場合は e.dataTransfer.files[0] を使用
  let file = data === undefined ? e.target.files[0] : data;

  // 拡張子チェック
  if (!file.type.match(/^image\/(png|jpg|jpeg|gif)$/)) {
    return;
  }

  // 容量チェック(10MB)
  if (10 * 1024 * 1024 <= file.size) {
    return;
  }

  let image = new Image();
  let fileReader = new FileReader();

  fileReader.onload = (e) => {
    let base64 = e.target.result;

    image.onload = () => {
      callback(image);
    };
    image.src = base64;
  };

  fileReader.readAsDataURL(file);
};

export default class Renderer {
  constructor({ canvas, canvasHighlight, canvasGrid, canvasCropper }) {
    // canvas
    this.canvasHidden = null;
    this.canvas = canvas;
    this.canvasHighlight = canvasHighlight;
    this.canvasGrid = canvasGrid;
    this.canvasCropper = canvasCropper;

    this.cropper = null;

    // カラーコードのリスト
    this.highlightList = [];
    this.colorList = [];

    this.palette = [];
  }

  restore() {
    const ctx = this.canvas.getContext("2d");
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const ccCtx = this.canvasCropper.getContext("2d");
    ccCtx.clearRect(0, 0, this.canvasCropper.width, this.canvasCropper.height);
    const chCtx = this.canvasHighlight.getContext("2d");
    chCtx.clearRect(
      0,
      0,
      this.canvasHighlight.width,
      this.canvasHighlight.height
    );
    const cgCtx = this.canvasGrid.getContext("2d");
    cgCtx.clearRect(0, 0, this.canvasGrid.width, this.canvasGrid.height);
    if (!!this.cropper) {
      this.cropper.destroy();
    }
  }

  crop(image) {
    this.canvasCropper.width = image.width;
    this.canvasCropper.height = image.height;
    let originalCtx = this.canvasCropper.getContext("2d");

    // s:sourceImage, d:destinationCanvas
    // ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh)
    originalCtx.drawImage(
      image,
      0,
      0,
      image.width,
      image.height,
      0,
      0,
      image.width,
      image.height
    );

    // cropperの設定
    this.cropper = new Cropper(this.canvasCropper, {
      aspectRatio: 1,
      viewMode: 2,
      scalable: false,
      zoomable: false,
      preview: ".cropper-preview__img",
      crop: (e) => {
        this.canvasHidden = document.createElement("canvas");
        this.canvasHidden.width = CANVAS_SIZE;
        this.canvasHidden.height = CANVAS_SIZE;
        let ctx = this.canvasHidden.getContext("2d");
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        ctx.drawImage(
          this.canvasCropper,
          e.detail.x,
          e.detail.y,
          e.detail.width,
          e.detail.height,
          0,
          0,
          CANVAS_SIZE,
          CANVAS_SIZE
        );
      },
    });
  }

  reduce(size = 2) {
    if (!this.canvasHidden) {
      return;
    }
    const ctx = this.canvasHidden.getContext("2d");
    let imageData = ctx.getImageData(
      0,
      0,
      this.canvasHidden.width,
      this.canvasHidden.height
    );
    worker.postMessage({ imageData, size }, [imageData.data.buffer]);
  }

  highlightColor(colorIndex) {
    // canvasの選択色のハイライト
    let ctx = this.canvasHighlight.getContext("2d");
    this.canvasHighlight.width = CANVAS_DISP_SIZE;
    this.canvasHighlight.height = CANVAS_DISP_SIZE;
    ctx.clearRect(0, 0, CANVAS_DISP_SIZE, CANVAS_DISP_SIZE);
    if (colorIndex === -1) {
      return;
    }
    ctx.beginPath();
    ctx.fillStyle = `rgba(0, 0, 0, .7)`;
    ctx.strokeStyle = "rgba(255, 255, 255, 1)";

    let len = CANVAS_SIZE * CANVAS_SIZE;
    for (let i = 0; i < len; i++) {
      if (this.highlightList[i] !== colorIndex) {
        ctx.fillRect(
          (i % CANVAS_SIZE) * GRID_SIZE,
          Math.floor(i / CANVAS_SIZE) * GRID_SIZE,
          GRID_SIZE,
          GRID_SIZE
        );
      } else {
        ctx.rect(
          (i % CANVAS_SIZE) * GRID_SIZE,
          Math.floor(i / CANVAS_SIZE) * GRID_SIZE,
          GRID_SIZE,
          GRID_SIZE
        );
        ctx.stroke();
      }
    }
  }

  /**
   * グリッドの描画
   */
  drawGrid() {
    let ctx = this.canvasGrid.getContext("2d");
    this.canvasGrid.width = CANVAS_DISP_SIZE;
    this.canvasGrid.height = CANVAS_DISP_SIZE;
    ctx.strokeStyle = "rgba(255, 255, 255, 1)";

    for (let i = 0; i <= CANVAS_DISP_SIZE; i += 32) {
      if (i !== 0 && i !== CANVAS_DISP_SIZE) {
        if (i % (CANVAS_DISP_SIZE / 4) === 0) {
          ctx.strokeStyle = "rgba(255, 255, 255, 1)";
          ctx.lineWidth = 6;
        } else {
          ctx.strokeStyle = "rgba(255, 255, 255, 1)";
          ctx.lineWidth = 1;
        }
        // 縦
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, CANVAS_DISP_SIZE);
        // 横
        ctx.moveTo(0, i);
        ctx.lineTo(CANVAS_DISP_SIZE, i);
        ctx.stroke();
      }
    }
  }

  draw(imageData, palette) {
    this.palette = palette;
    this.canvas.width = CANVAS_DISP_SIZE;
    this.canvas.height = CANVAS_DISP_SIZE;
    const ctx = this.canvas.getContext("2d");
    ctx.clearRect(0, 0, CANVAS_DISP_SIZE, CANVAS_DISP_SIZE);
    ctx.beginPath();

    for (let i = 0; i < CANVAS_DISP_SIZE; i++) {
      this.highlightList[i] = palette.findIndex((color) => {
        if (
          color[0] === imageData.data[i * 4] &&
          color[1] === imageData.data[i * 4 + 1] &&
          color[2] === imageData.data[i * 4 + 2]
        ) {
          return true;
        }
        return false;
      });

      ctx.fillStyle = `rgba(${imageData.data[i * 4]}, ${
        imageData.data[i * 4 + 1]
      }, ${imageData.data[i * 4 + 2]}, ${imageData.data[i * 4 + 3]})`;
      ctx.fillRect(
        (i % CANVAS_SIZE) * GRID_SIZE,
        Math.floor(i / CANVAS_SIZE) * GRID_SIZE,
        GRID_SIZE,
        GRID_SIZE
      );
    }
  }
}
