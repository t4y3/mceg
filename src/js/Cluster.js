import Cropper from 'cropperjs'
import MedianCut from 'mediancut';

// canvasサイズ
const CANVAS_SIZE = 32;
// 表示時のグリッドのサイズ
const GRID_SIZE = 20;
// 表示用canvasサイズ
const CANVAS_DISP_SIZE = CANVAS_SIZE * GRID_SIZE;
// 減色時の色数
const K_NUM = 16;
// MGOでのカラーパレット用の除数
const DIVISOR = 8.21;

export default class Cluster {
  constructor() {
    this.cropper = null;

    // カラーコードのリスト
    this.highlightList = [];
    this.colorList = [];

    // canvas
    this.canvasHidden = null;
    this.canvasHighlight = document.getElementById('result-highlight');
    this.canvasGrid = document.getElementById('result-grid');
    this.canvasResult = document.querySelector('#result');
    this.canvasCropper = document.getElementById('cropper-canvas');
  }

  /**
   * 初期化処理
   */
  init() {
    let uploadArea = document.getElementById('upload-area');
    uploadArea.addEventListener('change', (e) => {
      this.changeHandler(e);
    });
    uploadArea.addEventListener('dragenter', (e) => { e.preventDefault(); });
    uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); });
    uploadArea.addEventListener('dragleave', (e) => { e.preventDefault(); });
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      this.changeHandler(e, e.dataTransfer.files[0]);
    });

    document.getElementById('run-btn').addEventListener('click', (e) => {
      this.run();
    });

    // グリッドの表示
    this.drawGrid();
  }

  /**
   * 画像アップロード時のcallback
   */
  changeHandler(e, data) {
    // drag and dropの場合は e.dataTransfer.files[0] を使用
    let file = data === undefined ? e.target.files[0] : data;

    // 拡張子チェック
    if (!file.type.match(/^image\/(png|jpg|jpeg|gif)$/)) {
      return;
    }

    // 容量チェック(5MB)
    if (5 * 1024 * 1024 <= file.size) {
      return;
    }

    let image = new Image();
    let fileReader = new FileReader();

    fileReader.onload = (e) => {
      let base64 = e.target.result;

      image.onload = () => {
        this.canvasCropper.width = image.width;
        this.canvasCropper.height = image.height;
        let originalCtx = this.canvasCropper.getContext('2d');

        // s:sourceImage, d:destinationCanvas
        // ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh)
        originalCtx.drawImage(image, 0, 0, image.width, image.height, 0, 0, image.width, image.height);

        // cropperの表示
        this.showResult();

        // cropperの設定
        this.cropper = new Cropper(this.canvasCropper, {
          aspectRatio: 1,
          preview: '.cropper-preview__img',
          crop: (e) => {
            this.canvasHidden = document.createElement('canvas');
            let ctx = this.canvasHidden.getContext('2d');
            ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
            ctx.drawImage(this.canvasCropper,
              e.detail.x,
              e.detail.y,
              e.detail.width,
              e.detail.height,
              0,
              0,
              CANVAS_SIZE,
              CANVAS_SIZE
            );
          }
        });
      };
      image.src = base64;
    };

    fileReader.readAsDataURL(file);
  }

  /**
   * 画像のクラスタリングを実行
   */
  run() {
    // 前のハイライトをクリア
    this.clearHighlight();

    let ctx = this.canvasHidden.getContext('2d');
    let data = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE).data;
    let len = CANVAS_SIZE * CANVAS_SIZE;
    let w = [];
    for (let i = 0; i < len; i++) {
      w[i] = [
        data[(i*4)],
        data[(i*4)+1],
        data[(i*4)+2],
        data[(i*4)+3]
      ];
    }

    let imagedata = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    // Obtain color information of image (画像のカラー情報の取得)
    // let colors = this.getColorInfo(imagedata);

    // reduced color (減色)
    let medianCut = new MedianCut(imagedata);
    imagedata = medianCut.run(16);
    // カラーリストの取得
    this.colorList = medianCut.getColors();

    let resultCtx = this.canvasResult.getContext('2d');
    resultCtx.clearRect(0, 0, 320, 320);
    resultCtx.beginPath();

    for (let i = 0; i < len; i++) {
      resultCtx.fillStyle = `rgba(${ imagedata.data[i*4] }, ${ imagedata.data[i*4+1] }, ${ imagedata.data[i*4+2] }, ${ imagedata.data[i*4+3] })`;
      resultCtx.fillRect((i % CANVAS_SIZE) * GRID_SIZE, Math.floor(i / CANVAS_SIZE) * GRID_SIZE, GRID_SIZE, GRID_SIZE);

      for (let j = 0, jLen = this.colorList.length; j < jLen; j++) {
        if (imagedata.data[i*4] == this.colorList[j]['r']
            && imagedata.data[i*4+1] == this.colorList[j]['g']
              && imagedata.data[i*4+2] == this.colorList[j]['b']) {
                this.highlightList[i] = j;
        }
      }
    }

    this.showColors();
  }

  /**
   * カラーリストの表示
   */
  showColors() {
    // カラーリストの削除
    let list = document.querySelector('.colors-list');
    let list_child = document.querySelectorAll('.colors-list li');
    if (list_child.length) {
      for (let i = 0; i < list_child.length; i++) {
        list.removeChild(list_child[i]);
      }
    }

    // カラーリストの追加処理
    let fragment = document.createDocumentFragment();
    for(let i = 0, len = this.colorList.length; i < len; i++){
      let li = document.createElement('li');
      li.style.backgroundColor = `rgba(${ this.colorList[i]['r'] }, ${ this.colorList[i]['g'] }, ${ this.colorList[i]['b'] }, 1)`
      fragment.appendChild(li); // fragmentの追加する
    }
    list.appendChild(fragment);

    // イベント設定
    let colors = document.querySelectorAll('.colors-list li');
    for (let i = 0; i < colors.length; i++) {
      colors[i].addEventListener('click', () => {
        this.highlightColor(i);
      })
    }
  }

  /**
   * グリッドの描画
   */
  drawGrid() {
    let ctx = this.canvasGrid.getContext('2d');
    ctx.strokeStyle = 'rgba(255, 255, 255, 1)';

    let size = CANVAS_DISP_SIZE;
    for (let i = 0; i <= size; i+=GRID_SIZE) {
      if (i != 0 && i != size) {
        if (i % 160 === 0) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
          ctx.lineWidth = 6;
        } else {
          ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
          ctx.lineWidth = 1;
        }
        // 縦
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, size);
        // 横
        ctx.moveTo(0, i);
        ctx.lineTo(size, i);
        ctx.stroke();
      }
    }
  }

  /**
   * ハイライトのクリア
   */
   clearHighlight() {
     let ctx = this.canvasHighlight.getContext('2d');
     ctx.clearRect(0, 0, CANVAS_DISP_SIZE, CANVAS_DISP_SIZE);
   }

  /**
   * 選択色のハイライト
   */
  highlightColor(colorIndex) {
    // アクティブ表示
    let colors = document.querySelectorAll('.colors-list li');
    for (let i = 0; i < colors.length; i++) {
      if (i == colorIndex) {
        colors[i].classList.add('active');
      } else {
        colors[i].classList.remove('active');
      }
    }

    // カラーコードの表示
    this.updateColorCode(this.colorList[colorIndex]);

    // canvasの選択色のハイライト
    let ctx = this.canvasHighlight.getContext('2d');
    ctx.clearRect(0, 0, CANVAS_DISP_SIZE, CANVAS_DISP_SIZE);
    ctx.beginPath();
    ctx.fillStyle = `rgba(0, 0, 0, .7)`;
    ctx.strokeStyle = 'rgba(255, 255, 255, 1)';

    let len = CANVAS_SIZE * CANVAS_SIZE;
    for (let i = 0; i < len; i++) {
      if (this.highlightList[i] != colorIndex) {
        ctx.fillRect((i % CANVAS_SIZE) * GRID_SIZE, Math.floor(i / CANVAS_SIZE) * GRID_SIZE, GRID_SIZE, GRID_SIZE);
      } else {
        ctx.rect((i % CANVAS_SIZE) * GRID_SIZE, Math.floor(i / CANVAS_SIZE) * GRID_SIZE, GRID_SIZE, GRID_SIZE);
        ctx.stroke();
      }
    }
  }

  /**
   * カラーコードの更新
   */
  updateColorCode(color) {
    document.getElementById('red-cc-bar').style.width = `${ (color['r'] / 255) * 100}%`;
    document.getElementById('red-cc-number').innerHTML = `${ Math.round(color['r'] / DIVISOR) } (${ color['r'] })`;
    document.getElementById('green-cc-bar').style.width = `${ (color['g'] / 255) * 100}%`;
    document.getElementById('green-cc-number').innerHTML = `${ Math.round(color['g'] / DIVISOR) } (${ color['g'] })`;
    document.getElementById('blue-cc-bar').style.width = `${ (color['b'] / 255) * 100}%`;
    document.getElementById('blue-cc-number').innerHTML = `${ Math.round(color['b'] / DIVISOR) } (${ color['b'] })`;
  }

  /**
   * 減色部分の表示
   */
  showResult() {
    document.getElementById('upload-area').classList.add('hide');
    document.getElementById('uploaded-area').classList.add('show');
  }


  /**
   * カラー情報の取得
   */
  getColorInfo(imagedata) {
    let height = imagedata.height;
    let width = imagedata.width;
    let raw = imagedata.data;

    // 使用色/使用回数(面積)を取得
    let cnt = 0;
    let uses_colors = new Object;

    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        let key = raw[cnt] + ',' + raw[cnt + 1] + ',' + raw[cnt + 2];
        if (!uses_colors[key]) uses_colors[key] = 1;
        else uses_colors[key] += 1;

        cnt = cnt + 4;
      }
    }

    // 連想配列を配列へ設定
    let rgb;
    let colors = new Array();
    for (let key in uses_colors) {
      rgb = key.split(",");
      colors[colors.length] = {
        'r': parseInt(rgb[0], 10),
        'g': parseInt(rgb[1], 10),
        'b': parseInt(rgb[2], 10),
        'uses': uses_colors[key]
      }; // 使用数
    }
    return colors;
  }
}
