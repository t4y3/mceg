import kmeans from 'node-kmeans';
import Cropper from 'cropperjs'

// canvasサイズ
const CANVAS_SIZE = 32;
// 表示時のグリッドのサイズ
const GRID_SIZE = 10;
// 表示用canvasサイズ
const CANVAS_DISP_SIZE = CANVAS_SIZE * GRID_SIZE;
// 減色時の色数
const K_NUM = 16;
// MGOでのカラーパレット用の除数
const DIVISOR = 8.21;

export default class Cluster {
  constructor() {
    this.cropper = null;
    this.uploadArea = document.getElementById('upload-area');
    this.runBtn = document.getElementById('run-btn');
    this.hiddenCanvas = null;
    this.highlightList = [];
    this.colorList = [];
  }

  /**
   * 初期化処理
   */
  init() {
    this.uploadArea.addEventListener('change', (e) => {
      this.changeHandler(e);
    });
    this.uploadArea.addEventListener('dragenter', (e) => { e.preventDefault(); });
    this.uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); });
    this.uploadArea.addEventListener('dragleave', (e) => { e.preventDefault(); });
    this.uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      this.changeHandler(e, e.dataTransfer.files[0]);
    });

    this.runBtn.addEventListener('click', (e) => {
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

    // ここから表示切り替え
    document.getElementById('upload-area').classList.add('hide');
    document.querySelector('.cropper-area').classList.add('show');
    document.querySelector('.run-btn-area').classList.add('show');
    document.querySelector('.result-area').classList.add('show');
    document.querySelector('.colors').classList.add('show');
    document.querySelector('.color-code').classList.add('show');
    // ここまで表示切り替え

    let image = new Image();
    let canvas = document.getElementById('cropper-canvas');
    let fileReader = new FileReader();

    fileReader.onload = (e) => {
      let base64 = e.target.result;

      image.onload = () => {
        canvas.width = image.width;
        canvas.height = image.height;
        let originalCtx = canvas.getContext('2d');

        // s:sourceImage, d:destinationCanvas
        // ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh)
        originalCtx.drawImage(image, 0, 0, image.width, image.height, 0, 0, image.width, image.height);

        this.cropper = new Cropper(canvas, {
          aspectRatio: 1,
          preview: '.cropper-preview__img',
          crop: (e) => {
            this.hiddenCanvas = document.createElement('canvas');
            let ctx = this.hiddenCanvas.getContext('2d');
            ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
            ctx.drawImage(canvas,
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

    let ctx = this.hiddenCanvas.getContext('2d');
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

    kmeans.clusterize(w, {k: K_NUM}, (err, res) => {
      if (err) {
        console.error(err);
      } else {

        // カラーコードを取得
        for (let k = 0; k < K_NUM; k++) {
          this.colorList[k] = res[k].centroid;
        }

        let resultCtx = document.querySelector('#result').getContext('2d');
        resultCtx.clearRect(0, 0, 320, 320);
        resultCtx.beginPath();

        let len = CANVAS_SIZE * CANVAS_SIZE;
        for (let i = 0; i < len; i++) {
          let color;
          for (let k = 0; k < K_NUM; k++) {
            if (res[k].cluster.includes(w[i])) {
              color = res[k].centroid;
              this.highlightList[i] = k;
              break;
            }
          }
          resultCtx.fillStyle = `rgba(${ color[0] }, ${ color[1] }, ${ color[2] }, ${ color[3] })`;
          resultCtx.fillRect((i % CANVAS_SIZE) * GRID_SIZE, Math.floor(i / CANVAS_SIZE) * GRID_SIZE, GRID_SIZE, GRID_SIZE);
        }

        // カラーリストの表示
        this.showColors(res);
      }
    });
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
      li.style.backgroundColor = `rgba(${ this.colorList[i][0] }, ${ this.colorList[i][1] }, ${ this.colorList[i][2] }, ${ this.colorList[i][3] })`
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
    let ctx = document.getElementById('result-grid').getContext('2d');
    ctx.strokeStyle = 'rgba(255, 255, 255, .4)';

    let size = CANVAS_DISP_SIZE;
    for (let i = 0; i <= size; i+=GRID_SIZE) {
      if (i != 0 && i != size) {
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
     let ctx = document.getElementById('result-highlight').getContext('2d');
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
    let color = this.colorList[colorIndex];
    let red = document.querySelector('.color-code-list__item--red');
    let green = document.querySelector('.color-code-list__item--green');
    let blue = document.querySelector('.color-code-list__item--blue');
    red.querySelector('.color-code__bar-inner').style.width = `${ (color[0] / 255) * 100}%`;
    red.querySelector('.color-code__number').innerHTML = `${ Math.round(color[0] / DIVISOR) } (${ color[0] })`;
    green.querySelector('.color-code__bar-inner').style.width = `${ (color[1] / 255) * 100}%`;
    green.querySelector('.color-code__number').innerHTML = `${ Math.round(color[1] / DIVISOR) } (${ color[1] })`;
    blue.querySelector('.color-code__bar-inner').style.width = `${ (color[2] / 255) * 100}%`;
    blue.querySelector('.color-code__number').innerHTML = `${ Math.round(color[2] / DIVISOR) } (${ color[2] })`;


    // canvasの選択色のハイライト
    let ctx = document.getElementById('result-highlight').getContext('2d');
    ctx.clearRect(0, 0, CANVAS_DISP_SIZE, CANVAS_DISP_SIZE);
    ctx.beginPath();
    ctx.fillStyle = `rgba(0, 0, 0, .7)`;

    let len = CANVAS_SIZE * CANVAS_SIZE;
    for (let i = 0; i < len; i++) {
      if (this.highlightList[i] != colorIndex) {
        ctx.fillRect((i % CANVAS_SIZE) * GRID_SIZE, Math.floor(i / CANVAS_SIZE) * GRID_SIZE, GRID_SIZE, GRID_SIZE);
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
        ctx.rect((i % CANVAS_SIZE) * GRID_SIZE, Math.floor(i / CANVAS_SIZE) * GRID_SIZE, GRID_SIZE, GRID_SIZE);
        ctx.stroke();
      }
    }
  }
}
