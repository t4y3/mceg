// css
import "reset-css/reset.css";
import "cropperjs/dist/cropper.css";
import '../scss/style.scss';

import Cluster from './Cluster';

window.addEventListener('DOMContentLoaded', () => {
  let cluster = new Cluster();
  cluster.init();
});
