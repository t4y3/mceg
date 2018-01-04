export default class MedianCut {
  constructor(imagedata, colors) {
    this.raw = imagedata.data;
    this.width = imagedata.width;
    this.height = imagedata.height;
    this.msg = '';
    this.colors = colors;
  }

  _setProperty(color) {
    let total = 0;
    let maxR = 0,
    maxG = 0,
    maxB = 0;
    let minR = 255,
    minG = 255,
    minB = 255;

    // 立方体の1辺の長さ
    for (let i = 0; i < color.length; i++) {

      if (color[i].rgb.r > maxR) maxR = color[i].rgb.r;
      if (color[i].rgb.g > maxG) maxG = color[i].rgb.g;
      if (color[i].rgb.b > maxB) maxB = color[i].rgb.b;

      if (color[i].rgb.r < minR) minR = color[i].rgb.r;
      if (color[i].rgb.g < minG) minG = color[i].rgb.g;
      if (color[i].rgb.b < minB) minB = color[i].rgb.b;

      // キューブで使用している面積
      total += color[i].rgb.uses;
    }

    let dr = (maxR - minR) * 1.2;
    let dg = (maxG - minG) * 1.2;
    let db = (maxB - minB);

    // 同一の場合はrを優先する
    let colortype = 'r';

    // r
    if (dr > dg && dr > db) {
      colortype = 'r';
    }

    // g
    if (dg > dr && dg > db) {
      colortype = 'g';
    }

    // b
    if (db > dr && db > dg) {
      colortype = 'b';
    }

    return {
      'color': color, // キューブの各色情報
      'total': total, // キューブの総面積(総色数)
      'type': colortype, // キューブの種類(R/G/B)
      // キューブの体積用 'volume': dr * dg * db
    };
  }

  // メディアンカット
  _MedianCut(cubes, colorsize) {
    let count = 0;
    let index = 0;

    // 面積(色数)が最大のキューブを選択
    for (let i = 0; i < cubes.length; i++) {
      if (cubes[i].total > count) {
        // 1点は除く
        if (cubes[i].color.length != 1) {
          index = i;
          count = cubes[i].total;
        }
      }
    }

    // 体積が最大のキューブを選択
    //if(cubes[index].color.length == 1){
    //
    //  count =0;  index =0;
    //
    // for(let i = 0; i < cubes.length;i++){
    //    if(cubes[i].volume > count){
    //      index = i;
    //      count = cubes[i].volume;
    //    }
    //  }
    //}


    if (cubes[index].total == 1) {
      // Cube could not be split.
      this.msg += colorsize + '色までキューブを分割できませんでした。\n';
      return cubes;
    }

    if (cubes[index].color.length == 1) {
      // Cube could not be split.
      this.msg += colorsize + '色までキューブを分割できませんでした。\n';
      return cubes;
    }

    // メディアン由来の中央値を算出する
    let colortype = cubes[index].type;
    cubes[index].color.sort(function(a, b) {
      if (a.rgb[colortype] < b.rgb[colortype]) return -1;
      if (a.rgb[colortype] > b.rgb[colortype]) return 1;
      return 0;
    });
    let split_border = Math.floor((cubes[index].color.length + 1) / 2);

    // 分割の開始
    let split1 = new Array;
    let split2 = new Array;
    for (let i = 0; i < cubes[index].color.length; i++) {
      if (i < split_border) {
        split1[split1.length] = cubes[index].color[i];
      } else {
        split2[split2.length] = cubes[index].color[i];
      }
    }

    // プロパティの設定
    split1 = this._setProperty(split1);
    split2 = this._setProperty(split2);

    // キューブ配列の再編成
    let result = new Array();
    for (let i = 0; i < cubes.length; i++) {
      if (i != index) {
        result[result.length] = cubes[i];
      }
    }
    result[result.length] = split1;
    result[result.length] = split2;

    if (result.length < colorsize) {
      return this._MedianCut(result, colorsize);
    } else {
      return result;
    }
  }

  // 減色の実行
  // colorsize : 最大何色まで減色するかの色数(2- 256)
  // update    : true ピクセルデータを更新 false 更新しない
  run(colorsize, update) {

    if (this.colors.length <= colorsize) {
      // It has already been reduced color.
      this.msg = '既に' + this.colors.length + '色に減色されています。\n';
      //return;
    }

    // 1個目のキューブの作成
    let plane = new Array;
    for (let i = 0; i < this.colors.length; i++) {
      plane[plane.length] = {
        'rgb': this.colors[i]
      };
    }

    let dummy = new Array();
    dummy[0] = this._setProperty(plane);

    // キューブの分割
    let cubes = this._MedianCut(dummy, colorsize);

    // キューブ毎に代表色(重み係数による平均)を算出する
    let rep_color = new Array();
    for (let i = 0; i < cubes.length; i++) {
      let count = 0;
      let r = 0,
      g = 0,
      b = 0;
      for (let j = 0; j < cubes[i].color.length; j++) {
        r += cubes[i].color[j].rgb.r * cubes[i].color[j].rgb.uses;
        g += cubes[i].color[j].rgb.g * cubes[i].color[j].rgb.uses;
        b += cubes[i].color[j].rgb.b * cubes[i].color[j].rgb.uses;
        count += cubes[i].color[j].rgb.uses;
      }
      rep_color[i] = {
        'r': Math.round(r / count),
        'g': Math.round(g / count),
        'b': Math.round(b / count)
      };
    }

    // 代表色の保存
    this.rep_color = rep_color;

    // ピクセルデータの更新
    if (update) {

      // ピクセルデータ設定用の連想配列(高速化用)
      let pixels = new Object;
      for (let i = 0; i < cubes.length; i++) {
        for (let j = 0; j < cubes[i].color.length; j++) {
          pixels[cubes[i].color[j].rgb.r + ',' + cubes[i].color[j].rgb.g + ',' + cubes[i].color[j].rgb.b] = {
            'r': rep_color[i].r,
            'g': rep_color[i].g,
            'b': rep_color[i].b
          };
        }
      }

      // データの設定
      let key, cnt = 0;
      for (let i = 0; i < this.height; i++) {
        for (let j = 0; j < this.width; j++) {

          key = this.raw[cnt] + ',' + this.raw[cnt + 1] + ',' + this.raw[cnt + 2];

          this.raw[cnt] = pixels[key].r;
          this.raw[cnt + 1] = pixels[key].g;
          this.raw[cnt + 2] = pixels[key].b;

          cnt = cnt + 4;
        }
      }
    }
  }
}
