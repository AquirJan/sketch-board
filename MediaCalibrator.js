class Dispatcher {
  constructor() {
    this.handlers = [];
  }
  listen(handler) {
    this.handlers.push(handler);
  }
  emit(...args) {
    this.handlers.forEach(handler => {
      handler(...args);
    });
  }
}
export default class TimeLine {
  constructor(params) {
    this.initParams = {
      el: params.el,
      video_el: params.video_el,
      height: params.height || 130,
      region: params.region || false,
      background: params.background || '#F2F5F7',
      color: params.color || false,
      markColor: params.markColor || '#FF3030',
      isConstant: params.isConstant || false,
      observerMode: params.observerMode || false,
      success: params.success,
      emitEvent: params.event
    };
    this.slideOffset = 0; // 滑动偏移量，刻度为单位(正整数，如1,2,3,4....,)
    this.maxScale = 0; // 最大刻度（即最大时间）
    this.mediaDuration = 0;
    this.timelineWrapper = null;
    this.videoDom = null;
    this.canvas = null;
    this.containerWidth = null; //容器宽度
    this.division = 1; // 刻度间隔
    this.offsetLeft = 30; // 左偏移量
    this.offsetRight = 100; // 右偏移量
    this.offsetTop = 0; // 上偏移量
    this.accuracy = 100; // 精确度 0.1秒对应10，0.01秒对应100
    this.decimalPoint = 0; // 小数点后的数位
    this.stepByStep = 0.1; // 键盘 左右键 步进
    this.scaleValueList = [];
    this.ctx = null;
    this.mouseStatus = { down: false, move: false };
    this.selectTarget = {};
    this.playAxis = { _x: 0, _y: 0, type: 'play_axis' }; // 播放轴线
    this.slider = { _x: 0, _y: 0, _w: 0, _h: 10, type: 'slider' };
    this.scrollbar = { _x: 0, _y: 0, _w: 0, _h: 8, type: 'scrollbar' };
    this.timelineTotalWidth = 0; // 时间轴总长度
    this.fontStyle = {
      size: 14,
      fontFamily: 'PingFang SC, Microsoft YaHei, Helvetica, Helvetica Neue, Hiragino Sans GB, Arial, sans-serif'
    };
    this.overPoint = null;
    this.compensation = 0; // 点击补偿值
    this.originalData = []; // 原数据
    this.processedData = []; // 处理后数据
    this.thumbnailCollection = []; // 缩略图背景
    this.thumbnailSize = { w: 0, h: 0 };
    this.start_x = null;
    this.label_y = 35;
    this.tmpLabel_width = null;
    this.tmpStart_position = null;
    this.tmpLine = null;
    this.hoverTarget = null;
    this.hadChanged = false; // 标定数据是否发生更改
    this.isAdd = false;
    this.mediaPlaying = false;
    this.resizing = false;
    this.windowResizeFn = null;
    this.mousedownFn = null;
    this.mousemoveFn = null;
    this.mouseupFn = null;
    this.mouseleaveFn = null;
    this.wheelFn = null;
    this.dblclickFn = null;
    this.keydownFn = null;
    this.keyupFn = null;
    this.timeupdateFn = null;
    this.mediaStatusFn = null;
    this.windowMousemoveFn = null;
    this.firstCome = true;
    this.copyDataCache = [];
    this.init();

    this.editLabelBox = new Dispatcher();
    this.eventEmit = new Dispatcher();
  }
  async init() {
    this.decimalPoint = this.accuracy === 10 ? 1 : 2;
    // this.stepByStep = this.accuracy === 10 ? 0.1 : 0.01;
    await this.getMediaInfo();
    this.timelineWrapper = document.getElementById(this.initParams.el);
    if (this.timelineWrapper) {
      this.timelineWrapper.style.height = this.initParams.height + 'px';
      this.containerWidth = this.timelineWrapper.offsetWidth; //容器宽度
      this.timelineWrapper.oncontextmenu = e => {
        e.preventDefault();
      };
    }

    if (!this.canvas) {
      // 新建canvas
      this.canvas = document.createElement('canvas');
    }
    this.canvas.width = this.containerWidth;
    this.canvas.height = this.initParams.height;
    if (this.timelineWrapper && !this.timelineWrapper.hasChildNodes(this.canvas)) {
      this.timelineWrapper.appendChild(this.canvas);
    }
    this.ctx = this.canvas.getContext('2d');
    this.tmpLine = { _x: null, _y: this.label_y, _w: 2, type: 'tmp_line' };
    this.calcScrollbar();
    this.eventListeners();
    this.processDataFn();
    this.renderBoard();
  }
  async getMediaInfo() {
    this.videoDom = document.getElementById(this.initParams.video_el);
    if (this.videoDom) {
      this.videoDom.muted = true;
      const duration = await this.videoReadyState(this.videoDom);
      this.mediaDuration = duration;
      this.maxScale = this.time2Scale(duration) + this.offsetRight;
      this.timelineTotalWidth = this.scale2Width(this.maxScale); // 时间轴总长度
      this.firstCome = false;
      this.scaleValueList = [];
      for (let index = 0; index <= this.maxScale; index += this.accuracy) {
        if (index <= this.maxScale - this.offsetRight) {
          this.scaleValueList.push(index);
        }
      }
    }
  }
  calcScrollbar() {
    if (this.containerWidth < this.timelineTotalWidth) {
      this.slider._y = this.initParams.height - this.scrollbar._h;
      this.slider._w = (this.containerWidth / this.timelineTotalWidth) * this.containerWidth;
      this.scrollbar._y = this.initParams.height - this.scrollbar._h;
      this.scrollbar._w = this.containerWidth;
    } else {
      this.slider._w = 0;
      this.scrollbar._w = 0;
    }
  }
  videoReadyState(video_el) {
    return new Promise(resolve => {
      let timer = setInterval(() => {
        if (video_el.readyState > 0) {
          resolve(video_el.duration);
          clearInterval(timer);
        }
      }, 100);
    });
  }
  windowResize() {
    const wrap = document.getElementById(this.initParams.el);
    if (wrap) {
      this.containerWidth = this.timelineWrapper = wrap.clientWidth;
      this.timelineTotalWidth = this.scale2Width(this.maxScale); // 时间轴总长度
      if (!this.resizing) {
        this.resizing = true;
        if (this.canvas) {
          this.canvas.width = this.containerWidth;
          this.slider._w = (this.containerWidth / this.timelineTotalWidth) * this.containerWidth;
          this.scrollbar._w = this.containerWidth;
          this.resizing = false;
        }
      }
    }
  }
  // 原数据处理
  processDataFn() {
    this.processedData = [];
    this.originalData.forEach(item => {
      this.processedData.push({
        _x: this.time2Scale(item.position.start, 'fix'), // 位于时间轴刻度起始位置（时间只与精度有关）
        _y: this.label_y,
        _w: this.time2Width(item.position.end - item.position.start, 'fix'),
        id: item.id,
        classifyId: item.classifyId,
        color: item.color,
        name: item.classifyName,
        type: 'label',
        stretchPoint: null
      });
    });
  }
  renderBoard() {
    this.ctx.clearRect(0, 0, this.containerWidth, this.initParams.height);
    this.setBackground();
    this.setThumbnailsBackground();
    this.setTimeAxis();
    // this.setNumberScale();
    this.setScrollbar();
    this.setSlider();
    this.setBorder();
    this.setLabelPart();
    this.setStretchPoint();
    this.setPlayAxis();
    this.setTmpLine();
    window.requestAnimationFrame(() => this.renderBoard());
  }
  setBackground() {
    this.ctx.fillStyle = this.initParams.background;
    this.ctx.fillRect(0, 0, this.containerWidth, this.initParams.height);
  }
  setBorder() {
    this.ctx.strokeStyle = '#DBDEE4';
    this.ctx.strokeRect(0, 0, this.containerWidth, this.initParams.height);
  }
  
  setTimeAxis() {
    const { ctx } = this;
    for (let index = 0; index <= this.maxScale; index++) {
      const STEP = this.scale2Width(index) - this.scale2Width(this.slideOffset) + this.offsetLeft;
      if (index <= this.maxScale - this.offsetRight) {
        if (index % 2 !== 0 && index % 10 !== 0 && this.division !== 1) {
          ctx.beginPath();
          ctx.strokeStyle = this.initParams.color ? this.initParams.color : '#bbb';
          ctx.lineWidth = 1;
          ctx.lineCap = 'round';
          ctx.moveTo(STEP, this.offsetTop);
          ctx.lineTo(STEP, 4 + this.offsetTop);
          ctx.stroke();
          ctx.closePath();
        }
        if (index % 2 === 0 && index % 10 !== 0 && this.division !== 1) {
          ctx.beginPath();
          ctx.strokeStyle = this.initParams.color ? this.initParams.color : '#999';
          ctx.lineWidth = 1;
          ctx.lineCap = 'round';
          ctx.moveTo(STEP, this.offsetTop);
          ctx.lineTo(STEP, 6 + this.offsetTop);
          ctx.stroke();
          ctx.closePath();
        }
        if (index % 10 === 0) {
          ctx.beginPath();
          ctx.strokeStyle = this.initParams.color ? this.initParams.color : '#666';
          ctx.lineWidth = 1;
          ctx.lineCap = 'round';
          ctx.moveTo(STEP, this.offsetTop);
          ctx.lineTo(STEP, 8 + this.offsetTop);
          ctx.stroke();
          ctx.closePath();
        }
        // 设置终点
        if (index === this.realMaxScaleFloor()) {
          ctx.beginPath();
          ctx.strokeStyle = 'blue';
          ctx.lineWidth = 2;
          ctx.moveTo(STEP, this.offsetTop);
          ctx.lineTo(STEP, this.offsetTop + 100);
          ctx.stroke();
          ctx.closePath();
          ctx.font = `${this.fontStyle.size}px ${this.fontStyle.fontFamily}`;
          ctx.fillStyle = 'blue';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('end', STEP, 110 + this.offsetTop);
        }
      }
    }
  }
  setLabelPart() {
    const { ctx } = this;
    for (let index = 0; index <= this.maxScale; index++) {
      const STEP = this.scale2Width(index) - this.scale2Width(this.slideOffset) + this.offsetLeft;
      this.processedData.forEach(item => {
        const { _x, color, _y, _w, name } = item;
        if (_x === index) {
          // 设置 标签框
          ctx.beginPath();
          ctx.strokeStyle = name ? color : '#333';
          ctx.lineWidth = 2;
          ctx.rect(STEP, _y, _w, this.thumbnailSize.h - 2);
          ctx.stroke();
          // 设置 标签名
          if (name) {
            const FONT_WIDTH = ctx.measureText(name).width + 5;
            this.fillRoundRect(ctx, STEP - 1, this.thumbnailSize.h + _y + 5, FONT_WIDTH, 18, 3, color);
            ctx.font = `${this.fontStyle.size}px ${this.fontStyle.fontFamily}`;
            ctx.fillStyle = 'white';
            ctx.textAlign = 'left';
            ctx.fillText(name, STEP + 2, this.thumbnailSize.h + _y + 15);
            ctx.closePath();
          }
        }
      });
    }
  }
  setPlayAxis() {
    const { ctx } = this;
    for (let index = 0; index <= this.maxScale; index++) {
      const STEP = this.scale2Width(index) - this.scale2Width(this.slideOffset) + this.offsetLeft;
      if (index === this.playAxis._x && this.selectTarget.type !== 'label') {
        ctx.beginPath();
        ctx.strokeStyle = '#FF3030';
        ctx.lineWidth = 2;
        ctx.moveTo(STEP, this.offsetTop + 20);
        ctx.lineTo(STEP, this.playAxis._y);
        ctx.stroke();
        ctx.moveTo(STEP - 4, 4);
        ctx.lineTo(STEP - 4, 17);
        ctx.lineTo(STEP, 20);
        ctx.lineTo(STEP + 4, 17);
        ctx.lineTo(STEP + 4, 4);
        ctx.lineTo(STEP - 4, 4);
        ctx.stroke();
      }
    }
  }
  setNumberScale() {
    const { ctx } = this;
    ctx.font = `${this.fontStyle.size}px ${this.fontStyle.fontFamily}`;
    ctx.fillStyle = this.initParams.color ? this.initParams.color : '#333';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    this.scaleValueList.forEach((scale, index) => {
      ctx.fillText(this.scale2Time(scale).toString(), index * this.accuracy * this.division - this.scale2Width(this.slideOffset) + this.offsetLeft, 18);
    });
  }
  setScrollbar() {
    const { ctx } = this;
    const { _x, _y, _w, _h } = this.scrollbar;
    ctx.fillStyle = '#F2F5F7';
    ctx.fillRect(_x, _y, _w, _h);
  }
  setSlider() {
    const { ctx } = this;
    const { _x, _y, _w, _h } = this.slider;
    ctx.fillStyle = '#b5b7b9';
    ctx.fillRect(_x, _y, _w, _h);
  }
  // 标签伸缩点
  setStretchPoint() {
    const { ctx } = this;
    for (let index = 0; index <= this.maxScale; index++) {
      const STEP = this.scale2Width(index) - this.scale2Width(this.slideOffset) + this.offsetLeft;
      this.processedData.forEach(item => {
        if (item._x === index && this.selectTarget.id === item.id) {
          const selectedColor = '#7dabff';
          const defaultColor = '#4382F6';
          const leftPointSelectedColor = this.selectTarget.stretchPoint === 'left' ? selectedColor : defaultColor;
          const rightPointSelectedColor = this.selectTarget.stretchPoint === 'right' ? selectedColor : defaultColor;
          // 圆角矩形
          this.fillRoundRect(ctx, STEP - 7, 14, 14, 16, 4, leftPointSelectedColor);
          this.fillRoundRect(ctx, STEP + item._w - 7, 14, 14, 16, 4, rightPointSelectedColor);
          // 小倒三角
          ctx.beginPath();
          ctx.strokeStyle = leftPointSelectedColor;
          ctx.fillStyle = leftPointSelectedColor;
          ctx.moveTo(STEP - 1, 31);
          ctx.lineTo(STEP + 1, 31);
          ctx.lineTo(STEP, 33);
          ctx.closePath();
          ctx.stroke();
          ctx.fill();
          ctx.beginPath();
          ctx.strokeStyle = rightPointSelectedColor;
          ctx.fillStyle = rightPointSelectedColor;
          ctx.moveTo(STEP + item._w - 1, 31);
          ctx.lineTo(STEP + item._w + 1, 31);
          ctx.lineTo(STEP + item._w, 33);
          ctx.closePath();
          ctx.stroke();
          ctx.fill();
        }
      });
    }
  }
  // 临时线段
  setTmpLine() {
    const { ctx } = this;
    for (let index = 0; index <= this.maxScale; index++) {
      const STEP = this.scale2Width(index) - this.scale2Width(this.slideOffset) + this.offsetLeft;
      const { _x, _y, _w } = this.tmpLine;
      if (_x !== null && index === _x) {
        ctx.beginPath();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = _w;
        ctx.moveTo(STEP, _y);
        ctx.lineTo(STEP, _y + this.thumbnailSize.h - 2);
        ctx.stroke();
        ctx.closePath();
      }
    }
  }
  // 缩略图背景
  setThumbnailsBackground() {
    if (this.thumbnailCollection.length) {
      this.thumbnailCollection.forEach((item, index) => {
        const _x = item.index * this.accuracy * this.division - this.scale2Width(this.slideOffset) + this.offsetLeft;
        this.ctx.drawImage(item.img, _x, 34, this.thumbnailSize.w, this.thumbnailSize.h);
      });
      this.playAxis._y = this.label_y + this.thumbnailSize.h - 2;
    }
  }
  fillRoundRect(ctx, x, y, width, height, radius, color) {
    //圆的直径必然要小于矩形的宽高
    if (2 * radius > width || 2 * radius > height) {
      return false;
    }
    ctx.save();
    ctx.translate(x, y);
    //绘制圆角矩形的各个边
    this.drawRoundRectPath(ctx, width, height, radius);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }
  drawRoundRectPath(ctx, width, height, radius) {
    ctx.beginPath(0);
    //从右下角顺时针绘制，弧度从0到1/2PI
    ctx.arc(width - radius, height - radius, radius, 0, Math.PI / 2);
    //矩形下边线
    ctx.lineTo(radius, height);
    //左下角圆弧，弧度从1/2PI到PI
    ctx.arc(radius, height - radius, radius, Math.PI / 2, Math.PI);
    //矩形左边线
    ctx.lineTo(0, radius);
    //左上角圆弧，弧度从PI到3/2PI
    ctx.arc(radius, radius, radius, Math.PI, (Math.PI * 3) / 2);
    //上边线
    ctx.lineTo(width - radius, 0);
    //右上角圆弧
    ctx.arc(width - radius, radius, radius, (Math.PI * 3) / 2, Math.PI * 2);
    //右边线
    ctx.lineTo(width, height - radius);
    ctx.closePath();
  }
  // 鼠标/键盘监听事件
  eventListeners() {
    this.windowResizeFn = e => this.windowResize(e);
    this.mousedownFn = e => this.mousedownHandler(e);
    this.mousemoveFn = e => this.mousemoveHandler(e);
    this.windowMousemoveFn = e => this.windowMousemoveHandler(e);
    this.mouseupFn = e => this.mouseupHandler(e);
    this.mouseleaveFn = e => this.mouseleaveHandler(e);
    this.dblclickFn = e => this.updatePlayAxis(e);
    this.keydownFn = e => this.keydownHandler(e);
    this.keyupFn = e => this.keyupHandler(e);
    this.wheelFn = e => this.wheelHandler(e);
    this.timeupdateFn = e => this.timeupdateHandler(e);
    this.mediaStatusFn = e => this.mediaStatusHandler(e);
    this.canvas.addEventListener('mousedown', this.mousedownFn);
    this.canvas.addEventListener('mousemove', this.mousemoveFn);
    this.canvas.addEventListener('mouseleave', this.mouseleaveFn);
    this.canvas.addEventListener('dblclick', this.dblclickFn);
    this.canvas.addEventListener('wheel', this.wheelFn);
    this.videoDom.addEventListener('timeupdate', this.timeupdateFn);
    this.videoDom.addEventListener('play', this.mediaStatusFn);
    this.videoDom.addEventListener('pause', this.mediaStatusFn);
    window.addEventListener('mouseup', this.mouseupFn);
    window.addEventListener('resize', this.windowResizeFn);
    window.addEventListener('mousemove', this.windowMousemoveFn);
    document.addEventListener('keydown', this.keydownFn);
    document.addEventListener('keyup', this.keyupFn);
  }

  destroy() {
    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this.mousedownFn);
      this.canvas.removeEventListener('mousemove', this.mousemoveFn);
      this.canvas.removeEventListener('mouseleave', this.mouseleaveFn);
      this.canvas.removeEventListener('dblclick', this.dblclickFn);
      this.canvas.removeEventListener('wheel', this.wheelFn);
      this.canvas = null;
    }
    this.videoDom.removeEventListener('timeupdate', this.timeupdateFn);
    window.removeEventListener('mouseup', this.mouseupFn);
    window.removeEventListener('resize', this.windowResizeFn);
    window.removeEventListener('mousemove', this.windowMousemoveFn);
    document.removeEventListener('keydown', this.keydownFn);
    document.removeEventListener('keyup', this.keyupFn);
  }

  //判断鼠标over到哪个地方
  calcIsOverDraw({ x, y, w, h }, layerX, layerY, key = true) {
    return new Promise(resolve => {
      const tmp = new Path2D();
      tmp.rect(x, y, w, h);
      if (this.ctx.isPointInPath(tmp, layerX, layerY) && key) {
        resolve(true);
      }
    });
  }

  // calcIsOverPlayAxis(layerX, layerY, type) {
  //   const _tmpRect = new Path2D();
  //   _tmpRect.rect(this.scale2Width(this.playAxis._x) - this.scale2Width(this.slideOffset) + this.offsetLeft - 5, 3, 10, 17);
  //   if (this.ctx.isPointInPath(_tmpRect, layerX, layerY)) {
  //     if (!type) {
  //       this.selectTarget = this.playAxis;
  //       this.eventEmit.emit({ type: 'removeLabelMenu' });
  //     } else {
  //       document.documentElement.style.cursor = 'pointer';
  //     }
  //   } else {
  //     if (type === 'hover') {
  //       document.documentElement.style.cursor = 'default';
  //     }
  //   }
  // }

  calcIsOverScrollbar(layerX, layerY) {
    const _tmpRect = new Path2D();
    const { _x, _y, _w, _h } = this.scrollbar;
    _tmpRect.rect(_x, _y, _w, _h);
    if (this.ctx.isPointInPath(_tmpRect, layerX, layerY)) {
      this.hoverTarget = 'scrollbar';
    } else {
      this.hoverTarget = null;
    }
  }
  async calcIsOverLabel(e, type) {
    if (this.initParams.observerMode || this.hoverTarget === 'labelName') {
      return;
    }
    const { layerX, layerY } = e;
    for (let index = 0; index < this.processedData.length; index++) {
      const { _x, _w, _y } = this.processedData[index];
      const _tmpRect = new Path2D();
      const X = this.scale2Width(_x) - this.scale2Width(this.slideOffset) + this.offsetLeft;
      _tmpRect.rect(X, _y, _w, this.thumbnailSize.h - 2);
      if (this.ctx.isPointInPath(_tmpRect, layerX, layerY)) {
        if (type === 'hover') {
        }
        document.documentElement.style.cursor = 'e-resize';
        this.hoverTarget = 'label';
        this.tmpLine._x = null;
        if (!this.mouseStatus.move) {
          this.processedData.forEach(item => (item.stretchPoint = null));
          this.selectTarget = this.processedData[index];
          this.eventEmit.emit({ type: 'removeLabelMenu' });
        }
        if (this.selectTarget.type === 'label') {
          break;
        }
      } else {
        this.hoverTarget = null;
        document.documentElement.style.cursor = 'default';
      }
    }
  }

  async calcIsOverLabelPoint(e, direction) {
    const negative_direction = direction === 'left' ? 'right' : 'left'; // 反方向
    if (this.initParams.observerMode || this.hoverTarget === 'labelName' || this.overPoint === negative_direction) {
      return;
    }
    const { layerX, layerY } = e;
    const { _x, _w } = this.selectTarget;
    const X = this.scale2Width(_x) - this.scale2Width(this.slideOffset) + this.offsetLeft;
    const position = direction === 'left' ? X - 7 : X + _w - 7;
    const point = { x: position, y: 14, w: 14, h: 16 };
    const OVER_POINT = await this.calcIsOverDraw(point, layerX, layerY);
    if (OVER_POINT) {
      // document.documentElement.style.cursor = 'e-resize';
      this.tmpLabel_width = _w;
      this.tmpStart_position = _x;
      this.overPoint = direction;
      this.selectTarget.stretchPoint = direction;
      this.eventEmit.emit({ type: 'removeLabelMenu' });
    } else {
      this.overPoint = null;
    }
  }

  async calcIsOverLabelName(e, type) {
    if (this.initParams.observerMode || this.hoverTarget === 'label') {
      return;
    }
    const { layerX, layerY } = e;
    for (let index = 0; index < this.processedData.length; index++) {
      const { _x, _w, _y, name } = this.processedData[index];
      const X = this.scale2Width(_x) - this.scale2Width(this.slideOffset) + this.offsetLeft;
      const FONT_WIDTH = this.ctx.measureText(name).width + 5;
      const START_TIME = this.scale2Time(_x);
      const END_TIME = +(this.scale2Time(_x) + this.width2Time(_w)).toFixed(this.decimalPoint);
      const _tmpTextRect = new Path2D();
      _tmpTextRect.rect(X - 2, this.thumbnailSize.h + _y + 5, FONT_WIDTH, 18);
      if (this.ctx.isPointInPath(_tmpTextRect, layerX, layerY)) {
        if (type === 'hover') {
          document.documentElement.style.cursor = 'pointer';
          this.hoverTarget = 'labelName';
          break;
        } else {
          this.hoverTarget = null;
          this.selectTarget.stretchPoint = null;
          if (!this.hoverTarget) {
            this.hoverTarget = 'labelName';
            this.selectTarget = this.processedData[index];
          }
          if (this.hoverTarget) {
            this.editLabelBox.emit({ START_TIME, END_TIME, type: 'modify', $event: e, labelBox: this.processedData[index] });
            break;
          }
        }
      } else {
        this.hoverTarget = null;
        document.documentElement.style.cursor = 'default';
      }
    }
  }

  timeupdateHandler(e) {
    let currentTime = e.target.currentTime;
    // console.log(currentTime);
    if (this.mediaPlaying) {
      this.playAxis._x = Math.min(Math.round(this.time2Scale(currentTime)), this.realMaxScaleFloor());
      const PROGRESS = this.time2Width(currentTime) / this.time2Width(this.mediaDuration);
      const TIME_AXIS_MAX_MOVE_DISTANCE = this.timelineTotalWidth - this.containerWidth;
      const SLIDER_MAX_MOVE_DISTANCE = this.containerWidth - this.slider._w;
      this.slideOffset = TIME_AXIS_MAX_MOVE_DISTANCE > 0 ? TIME_AXIS_MAX_MOVE_DISTANCE * PROGRESS : 0;
      this.slider._x = SLIDER_MAX_MOVE_DISTANCE * PROGRESS;
      this.initParams.success && this.initParams.success(this.scale2Time(this.playAxis._x));
    }
  }

  mediaStatusHandler(e) {
    const { type } = e;
    this.mediaPlaying = type === 'play' ? true : false;
    this.eventEmit.emit({ type: 'removeLabelMenu' });
    this.resetOperation();
    this.selectTarget = {};
  }

  updateLabel(e) {
    const { layerX, layerY } = e;
    if (this.selectTarget.type === 'label') {
      this.compensation = layerX + this.scale2Width(this.slideOffset) - this.scale2Width(this.selectTarget['_x']);
    }
  }

  updateMouse() {
    if (this.mouseStatus.move) {
      setTimeout(() => {
        this.mouseStatus.move = false;
      }, 300);
    }
  }

  async updatePlayAxis(e) {
    const { layerX, ctrlKey, altKey } = e;
    // if (this.hoverTarget !== 'scrollbar' && !ctrlKey && !altKey) {
    if (!ctrlKey && !altKey) {
      const REAL_POSITION = this.scale2Width(this.slideOffset) + layerX - this.offsetLeft;
      let SELECT_TIME;
      if (REAL_POSITION < 0) {
        this.playAxis._x = 0;
        SELECT_TIME = 0;
      } else {
        const PLAY_AXIS = Math.round(this.width2Scale(REAL_POSITION));
        if (PLAY_AXIS > this.realMaxScaleFloor()) {
          this.playAxis._x = this.realMaxScaleFloor();
          SELECT_TIME = this.scale2Time(this.realMaxScaleFloor());
        } else {
          this.playAxis._x = PLAY_AXIS;
          SELECT_TIME = (REAL_POSITION / (this.division * this.accuracy)).toFixed(this.decimalPoint);
        }
      }
      this.videoDom.currentTime = SELECT_TIME;
      this.initParams.success && this.initParams.success(SELECT_TIME);
    }
  }

  async updateSlider(e) {
    const { layerX, layerY, clientX } = e;
    const { _x, _y, _w, _h } = this.slider;
    const slider = { x: _x, y: _y, w: _w, h: _h };
    const OVER_SLIDER = await this.calcIsOverDraw(slider, layerX, layerY);
    if (OVER_SLIDER) {
      this.selectTarget = this.slider;
    }
    if (this.selectTarget.type === 'slider') {
      this.compensation = clientX - this.slider._x;
      this.eventEmit.emit({ type: 'removeLabelMenu' });
    }
  }
  moveSlider(e) {
    const { clientX } = e;
    const DISTANCE = clientX - this.compensation; // 鼠标点击滑块内任意地方后，进行滑动的补偿
    if (DISTANCE >= 0 && DISTANCE + this.slider._w <= this.containerWidth) {
      this.slider._x = DISTANCE;
      const REAL_OFFSET = (DISTANCE / this.containerWidth) * this.timelineTotalWidth;
      this.slideOffset = Math.round(this.width2Scale(REAL_OFFSET));
    }
  }
  adjustLabelBoxWithMouse(e) {
    const { layerX } = e;
    const { LEFT_SIDE_LIMIT, RIGHT_SIDE_LIMIT } = this.getLimit();
    // console.log(LEFT_SIDE_LIMIT, RIGHT_SIDE_LIMIT);
    // 标签整体移动
    if (this.selectTarget.type === 'label') {
      if (this.hoverTarget === 'label' && !this.overPoint) {
        if (!this.mouseStatus.move) {
          this.selectTarget.stretchPoint = null;
        }
        const DISTANCE = layerX - this.compensation; // 鼠标点击滑块内任意地方后，进行滑动的补偿
        this.selectTarget._x = Math.floor(this.width2Scale(DISTANCE)) + this.slideOffset;
        if (this.selectTarget._x < LEFT_SIDE_LIMIT) {
          this.selectTarget._x = LEFT_SIDE_LIMIT;
        }
        // 无限制拖动
        // if (this.selectTarget._x < 0) {
        //   this.selectTarget._x = 0;
        // }
        const ALLOW_MOVE_DISTANCE = this.selectTarget._x + this.width2Scale(this.selectTarget._w);
        if (ALLOW_MOVE_DISTANCE > RIGHT_SIDE_LIMIT) {
          this.selectTarget._x = RIGHT_SIDE_LIMIT - this.width2Scale(this.selectTarget._w);
          // 无限制拖动
          // if (ALLOW_MOVE_DISTANCE > this.realMaxScaleFloor()) {
          //   this.selectTarget._x = this.realMaxScaleFloor() - this.width2Scale(this.selectTarget._w);
        }
        this.hadChanged = true;
      }
      // 标签左右伸缩
      if (this.overPoint) {
        const POINT_MOVE_DISTANCE = Math.floor(this.width2Scale(layerX - this.start_x));
        if (this.overPoint === 'left' && POINT_MOVE_DISTANCE < this.width2Scale(this.tmpLabel_width)) {
          this.selectTarget._x = this.tmpStart_position + POINT_MOVE_DISTANCE;
          if (this.selectTarget._x < LEFT_SIDE_LIMIT) {
            this.selectTarget._x = LEFT_SIDE_LIMIT;
            return;
          }
          // if (this.selectTarget._x < 0) { // 无限制伸缩
          // this.selectTarget._x = 0;
          // return;
          // }
          this.selectTarget._w = this.tmpLabel_width - this.scale2Width(POINT_MOVE_DISTANCE);
        }
        const END_POSITION = this.tmpStart_position + this.width2Scale(this.tmpLabel_width);
        // if (this.selectTarget.stretchPoint === 'right' && POINT_MOVE_DISTANCE <= this.realMaxScaleFloor() - END_POSITION) { // 无限制伸缩
        if (this.overPoint === 'right' && POINT_MOVE_DISTANCE + END_POSITION <= RIGHT_SIDE_LIMIT) {
          this.selectTarget._w = this.tmpLabel_width + this.scale2Width(POINT_MOVE_DISTANCE);
          if (this.selectTarget._w < this.division) {
            this.selectTarget._w = this.division;
          }
        }
        this.hadChanged = true;
      }
    }
  }
  adjustLabelBoxWithKeys(key) {
    const { LEFT_SIDE_LIMIT, RIGHT_SIDE_LIMIT } = this.getLimit();
    const STEP = this.stepByStep * 100;
    // this.selectTarget 最好不要做解构，要做实时更新，不能转存
    if (key === 'ArrowRight') {
      if (this.selectTarget.type === 'label' && !this.selectTarget.stretchPoint) {
        if (this.selectTarget._x < RIGHT_SIDE_LIMIT - this.selectTarget._w) {
          this.selectTarget._x += STEP;
          if (this.selectTarget._x > RIGHT_SIDE_LIMIT - this.selectTarget._w) {
            this.selectTarget._x = RIGHT_SIDE_LIMIT - this.selectTarget._w;
          }
        }

        // 无限制移动
        // if (_x > this.realMaxScaleFloor() - _w) {
        //   _x = this.realMaxScaleFloor() - _w;
        // }
      }
      if (this.selectTarget.stretchPoint === 'left') {
        if (this.selectTarget._x < RIGHT_SIDE_LIMIT - this.selectTarget._w && this.selectTarget._w > this.division) {
          this.selectTarget._x += this.selectTarget._w > STEP ? STEP : this.selectTarget._w - this.division;
          this.selectTarget._w -= this.selectTarget._w > STEP ? STEP : this.selectTarget._w - this.division;
        }
      }
      if (this.selectTarget.stretchPoint === 'right') {
        if (this.selectTarget._x + this.selectTarget._w < RIGHT_SIDE_LIMIT) {
          this.selectTarget._w += STEP;
        }
        const ALLOWANCE = RIGHT_SIDE_LIMIT - (this.selectTarget._x + this.selectTarget._w);
        if (this.selectTarget._x + this.selectTarget._w > RIGHT_SIDE_LIMIT) {
          this.selectTarget._w += ALLOWANCE;
        }
      }
    }
    if (key === 'ArrowLeft') {
      if (this.selectTarget.type === 'label' && !this.selectTarget.stretchPoint) {
        if (this.selectTarget._x > LEFT_SIDE_LIMIT) {
          this.selectTarget._x -= STEP;
          if (this.selectTarget._x < LEFT_SIDE_LIMIT) {
            this.selectTarget._x = LEFT_SIDE_LIMIT;
          }
        }

        // 无限制移动
        // if (_x < 0) {
        //   _x = 0;
        // }
      }
      if (this.selectTarget.stretchPoint === 'left') {
        this.selectTarget._x -= STEP;
        this.selectTarget._w += STEP;
        if (this.selectTarget._x - LEFT_SIDE_LIMIT < STEP) {
          const ALLOWANCE = this.selectTarget._x - LEFT_SIDE_LIMIT; // 余量
          if (this.selectTarget._x < LEFT_SIDE_LIMIT) {
            this.selectTarget._x = LEFT_SIDE_LIMIT;
            this.selectTarget._w += ALLOWANCE;
          }
        }
      }
      if (this.selectTarget.stretchPoint === 'right') {
        this.selectTarget._w -= this.selectTarget._w > STEP ? STEP : this.selectTarget._w - this.division;
      }
    }
    this.hadChanged = true;
  }
  mousedownHandler(e) {
    this.mouseStatus.down = true;
    const { layerX, layerY } = e;
    this.start_x = layerX;
    this.calcIsOverLabel(e);
    this.calcIsOverLabelName(e);
    this.calcIsOverLabelPoint(e, 'left');
    this.calcIsOverLabelPoint(e, 'right');
    // this.calcIsOverPlayAxis(layerX, layerY);
    // this.calcIsOverScrollbar(layerX, layerY);
    this.updateSlider(e);
    this.updateLabel(e);
    this.addLabelBox(e);
  }

  windowMousemoveHandler(e) {
    const { buttons } = e;
    if (this.selectTarget.type === 'slider') {
      this.mouseStatus.move = true;
      this.updateMouse();
      if (!this.mouseStatus.move) {
        return;
      }
      if (buttons === 1) {
        this.moveSlider(e);
      }
    }
  }

  async mousemoveHandler(e) {
    if (this.selectTarget.type === 'slider') {
      return;
    }
    const { layerX, buttons } = e;
    this.mouseStatus.move = true;
    this.updateMouse();
    await this.calcIsOverLabel(e, 'hover');
    await this.calcIsOverLabelName(e, 'hover');
    if (!this.mediaPlaying && !this.selectTarget.type) {
      this.updatePlayAxis(e); // 鼠标移动直接更改
    }
    if (layerX < 0 || layerX > this.containerWidth || !this.mouseStatus.move || this.initParams.observerMode) {
      return;
    }

    // this.calcIsOverPlayAxis(layerX, layerY, 'hover');
    if (buttons === 1) {
      this.adjustLabelBoxWithMouse(e);
    }
  }

  mouseupHandler() {
    this.mouseStatus.down = false;
    // 标签移动释放
    if (this.selectTarget.type === 'label') {
      const TARGET_END_REAL_POSITION = this.selectTarget._x + this.width2Scale(this.selectTarget._w);
      this.processedData.forEach(item => {
        if (item.id === this.selectTarget.id) {
          if (TARGET_END_REAL_POSITION > Math.floor(this.maxScale - this.offsetRight)) {
            item._x = Math.floor(this.maxScale - this.offsetRight) - this.width2Scale(this.selectTarget._w);
          }
        }
      });
    }
    if (this.selectTarget.type === 'play_axis') {
      this.selectTarget = {};
      this.tmpLine._x = null;
    }
    if (this.selectTarget.type === 'slider') {
      this.selectTarget = {};
    }
    if (this.hadChanged) {
      this.initParams.emitEvent && this.initParams.emitEvent(this.data2Json());
    }
    this.compensation = 0;
    this.overPoint = null;
    document.documentElement.style.cursor = 'default';
  }

  mouseleaveHandler() {
    document.documentElement.cursor = 'default';
  }

  keydownHandler(e) {
    const { key, ctrlKey, altKey } = e;
    if (this.initParams.observerMode) {
      return;
    }
    if (key === 'ArrowRight') {
      this.adjustLabelBoxWithKeys(key);
    }
    if (key === 'ArrowLeft') {
      this.adjustLabelBoxWithKeys(key);
    }
    if (key === 'Escape') {
      if (this.selectTarget.stretchPoint) {
        this.selectTarget.stretchPoint = null;
        return;
      } else {
        this.selectTarget = {};
      }
      this.tmpLine._x = null;
      this.eventEmit.emit({ type: 'removeLabelMenu' });
      this.resetOperation();
    }
    if (key === '`') {
      console.log('duration', this.mediaDuration);
      console.log('maxScale', this.maxScale);
      console.log('timelineTotalWidth', this.timelineTotalWidth);
      console.log('滑块信息_slider', this.slider);
      // console.log('播放轴信息_playAxis', this.playAxis);
      // console.log('鼠标信息_mouseStatus', this.mouseStatus);
      console.log('偏移值_slideOffset', this.slideOffset);
      console.log('选择目标_selectTarget', this.selectTarget);
      console.log('标签原信息_originalData', this.originalData);
      console.log('标签处理后信息_processedData', this.processedData);
      // console.log('上传的数据', this.data2Json());
      // console.log('鼠标悬停目标_hoverTarget', this.hoverTarget);
      console.log('标签伸缩点_overPoint', this.overPoint);
    }
    // if (key === 'c' && ctrlKey) {
    //   this.clearEventBubble(e);
    //   if (this.processedData.length) {
    //     this.copyDataHandler();
    //     // console.log(this.processedData);
    //     // console.log(this.copyDataCache);
    //     // console.log(this.data2Json());
    //   } else {
    //     console.warn('标定数据为空，无法进行复制');
    //   }
    // }
    // if (key === 'v' && ctrlKey) {
    //   this.clearEventBubble(e);
    //   if (this.copyDataCache.length) {
    //     this.pasteDataHandler();
    //     // this.processedData = this.initParams.emitEvent && this.initParams.emitEvent(this.data2Json());
    //   } else {
    //     console.warn('粘贴数据为空，无法进行粘贴');
    //   }
    // }
  }

  keyupHandler(e) {
    const { key } = e;
    if (['ArrowLeft', 'ArrowRight'].includes(key)) {
    }
    if (this.hadChanged) {
      this.initParams.emitEvent && this.initParams.emitEvent(this.data2Json());
    }
  }
  wheelHandler(e) {
    const { deltaY, altKey } = e;
    this.clearEventBubble(e);
    if (this.maxScale < this.containerWidth) {
      return;
    }
    const STEP = altKey ? 200 : 50;
    const ALLOWANCE = this.maxScale - this.containerWidth;
    if (deltaY > 0) {
      this.slideOffset += STEP;
      if (this.slideOffset > ALLOWANCE) {
        this.slideOffset = ALLOWANCE;
      }
    } else {
      this.slideOffset -= STEP;
      if (this.slideOffset < 0) {
        this.slideOffset = 0;
      }
    }
    const PROGRESS = this.slideOffset / ALLOWANCE;
    const SLIDER_MAX_MOVE_DISTANCE = this.containerWidth - this.slider._w;
    this.slider._x = SLIDER_MAX_MOVE_DISTANCE * PROGRESS;
  }
  uuidv4Short() {
    return 'xxxx-4xxxyx'.replace(/[xy]/g, function(c) {
      const r = (Math.random() * 16) | 0,
        v = c == 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  clearEventBubble(e) {
    if (e.stopPropagation) {
      e.stopPropagation();
    } else {
      e.cancelBubble = true;
    }

    if (e.preventDefault) {
      e.preventDefault();
    } else {
      e.returnValue = false;
    }
  }
  getLimit() {
    const INDEX = this.processedData.findIndex(item => item.id === this.selectTarget.id);
    const NEXT_INDEX = INDEX >= this.processedData.length - 1 ? this.processedData.length - 1 : INDEX + 1;
    const PREV_INDEX = INDEX <= 0 ? 0 : INDEX - 1;
    let LEFT_SIDE_LIMIT;
    let RIGHT_SIDE_LIMIT;
    if (PREV_INDEX === INDEX) {
      LEFT_SIDE_LIMIT = 0;
    } else {
      if (this.processedData[PREV_INDEX]) {
        LEFT_SIDE_LIMIT = this.processedData[PREV_INDEX]._x + this.processedData[PREV_INDEX]._w;
      }
    }
    if (NEXT_INDEX === INDEX) {
      RIGHT_SIDE_LIMIT = this.realMaxScaleFloor();
    } else {
      if (this.processedData[NEXT_INDEX]) {
        RIGHT_SIDE_LIMIT = this.processedData[NEXT_INDEX]._x;
      }
    }
    return { LEFT_SIDE_LIMIT, RIGHT_SIDE_LIMIT };
  }
  showLabelBox(data) {
    this.originalData = data;
    this.mediaChanged();
  }

  setThumbnails(thumbnailInfo) {
    const { data, pictureWidth, pictureHeight } = thumbnailInfo;
    this.thumbnailSize.w = 100; // 1秒 == 100px
    const _h = (this.thumbnailSize.w / pictureWidth) * pictureHeight;
    this.thumbnailSize.h = _h < 60 ? _h : 60;
    this.thumbnailCollection = [];
    data.forEach(item => {
      let img = new Image();
      img.src = item.imageSrc;
      img.onload = () => {
        this.thumbnailCollection.push({ img, index: item.index });
      };
    });
  }
  // 媒体更改后一些复位操作
  async mediaChanged() {
    if (!this.firstCome) {
      await this.getMediaInfo();
    }
    this.processedData = [];
    this.slideOffset = 0;
    this.slider._x = 0;
    this.playAxis._x = 0;
    this.selectTarget = {};
    this.hoverTarget = null;
    this.processDataFn();
    this.calcScrollbar();
  }

  async addLabelBox(e) {
    const { layerX, layerY, button, ctrlKey, altKey } = e;
    if (this.selectTarget.type || this.isAdd || this.initParams.observerMode) {
      return;
    }
    const labelArea = { x: 0, y: this.label_y, w: this.containerWidth, h: this.thumbnailSize.h - 2 };
    const OVER_LABEL_AREA = await this.calcIsOverDraw(labelArea, layerX, layerY);
    if (OVER_LABEL_AREA && !ctrlKey && !altKey && button === 0) {
      if (this.tmpLine._x === null) {
        const start = await this.checkLegitimacy(layerX, 'start');
        this.tmpLine._x = start;
      } else {
        let tmp_endLine;
        const end = await this.checkLegitimacy(layerX, 'end');
        tmp_endLine = end;
        if (tmp_endLine === this.tmpLine._x) {
          this.tmpLine._x = null;
          return;
        }
        const START_LINE = this.scale2Time(this.tmpLine._x);
        const END_LINE = this.scale2Time(tmp_endLine);
        const START_TIME = Math.min(START_LINE, END_LINE);
        const END_TIME = Math.max(START_LINE, END_LINE);
        // console.log(START_TIME, END_TIME);
        this.editLabelBox.emit({ START_TIME, END_TIME, type: 'add', $event: e, labelBox: null });
      }
    }
  }

  checkLegitimacy(layerX, type) {
    const REAL_POSITION = this.scale2Width(this.slideOffset) + layerX - this.offsetLeft;
    const TMP_LINE = Math.round(this.width2Scale(REAL_POSITION));
    const two_dimensional_array = this.processedData.map(i => [i._x, i._x + i._w]);
    const array = two_dimensional_array.flat();
    return new Promise(resolve => {
      let VALUE;
      if (layerX < this.offsetLeft) {
        VALUE = 0;
      } else {
        VALUE = TMP_LINE > this.realMaxScaleFloor() ? this.realMaxScaleFloor() : TMP_LINE;
      }
      let FOUND;
      if (type === 'start') {
        FOUND = two_dimensional_array.find(item => item[0] <= VALUE && VALUE <= item[1]);
      } else {
        FOUND = array.find(item => {
          if (this.tmpLine._x < VALUE) {
            return this.tmpLine._x <= item && item < VALUE;
          } else {
            return VALUE <= item && item < this.tmpLine._x;
          }
        });
      }
      if (FOUND) {
        if (FOUND.constructor === Array) {
          return this.eventEmit.emit({ type: 'addLabelBoxWarning', message: '请不要重复标注该区域' });
        } else if (FOUND.constructor === Number) {
          return this.eventEmit.emit({ type: 'addLabelBoxWarning', message: '将标注的区域含有已标注信息' });
        }
      } else {
        return resolve(VALUE);
      }
    });
  }

  async saveLabelBox(info, labelInfo) {
    const { START_TIME, END_TIME } = info;
    let array = JSON.parse(JSON.stringify(this.processedData));
    array.push({
      _x: this.time2Scale(START_TIME, 'fix'), // 位于时间轴刻度起始位置
      _w: this.time2Width(END_TIME - START_TIME, 'fix'),
      _y: this.label_y,
      id: this.uuidv4Short(),
      color: labelInfo.color,
      name: labelInfo.classifyName,
      type: 'label',
      classifyId: labelInfo.id
    });
    await array.sort((a, b) => a._x - b._x);
    this.processedData = array;
    this.tmpLine._x = null;
    this.initParams.emitEvent && this.initParams.emitEvent(this.data2Json());
  }

  confirmSaveLabelBox(info) {
    const { START_TIME, END_TIME, $event } = info;
    this.processedData.push({
      _x: this.time2Scale(START_TIME, 'fix'), // 位于时间轴刻度起始位置
      _w: this.time2Width(END_TIME - START_TIME, 'fix'),
      _y: this.label_y,
      id: this.uuidv4Short(),
      color: '',
      name: '',
      type: 'label',
      classifyId: ''
    });
    this.isAdd = true;
    this.tmpLine._x = null;
    this.editLabelBox.emit({ START_TIME, END_TIME, type: 'modify', $event, labelBox: this.processedData[this.processedData.length - 1] });
  }

  updateLabelBox(labelBox, labelInfo, color) {
    if (labelBox.classifyId === labelInfo.id) {
      return;
    }
    this.processedData.forEach(item => {
      if (item.id === labelBox.id) {
        item.classifyId = labelInfo.id;
        item.color = color;
        item.name = labelInfo.classifyName;
      }
    });
    this.isAdd = false;
    this.initParams.emitEvent && this.initParams.emitEvent(this.data2Json());
  }

  deleteLabel() {
    const index = this.processedData.findIndex(i => i.id === this.selectTarget.id);
    if (index > -1) {
      this.processedData.splice(index, 1);
      this.initParams.emitEvent && this.initParams.emitEvent(this.data2Json());
      this.selectTarget = {};
    } else {
      this.resetOperation();
    }
  }
  // 复位操作
  resetOperation() {
    this.processedData = this.processedData.filter(item => item.classifyId);
    this.isAdd = false;
    this.selectTarget = {};
  }
  // 步进更改
  stepChange(e) {
    this.stepByStep = e;
  }

  copyDataHandler() {
    this.copyDataCache = [];
    this.processedData.forEach(item => {
      this.copyDataCache.push({
        _x: item._x,
        _y: item._y,
        _w: item._w,
        id: this.uuidv4Short(),
        classifyId: item.classifyId,
        color: item.color,
        name: item.name,
        type: 'label',
        stretchPoint: null
      });
    });
  }

  pasteDataHandler() {
    console.log(this.copyDataCache);
    // this.processedData = [...this.copyDataCache];
  }

  data2Json() {
    let data = [];
    this.processedData.forEach(item => {
      if (item.classifyId && item._x >= 0 && item._w >= 0) {
        if (item._x < 0) {
          item._x = 0;
        }
        // if (item._x+item._w) {

        // }
        data.push({
          id: item.id,
          classifyId: item.classifyId,
          position: {
            start: this.scale2Time(item._x),
            end: +(this.scale2Time(item._x) + this.width2Time(item._w)).toFixed(this.decimalPoint)
          }
        });
      }
    });
    this.hadChanged = false;
    this.isAdd = false;
    return JSON.stringify(data);
  }

  scale2Time(scale) {
    // 刻度转时间
    return +(scale / this.accuracy).toFixed(this.decimalPoint);
  }

  scale2Width(scale, type) {
    if (type === 'fix') {
      return +(scale * this.division).toFixed(this.decimalPoint);
    } else {
      return scale * this.division;
    }
  }

  width2Time(width) {
    // 宽度转时间
    return +(width / this.division / this.accuracy).toFixed(this.decimalPoint);
  }

  width2Scale(width) {
    // 宽度转刻度
    return width / this.division;
  }

  time2Scale(time, type) {
    // 时间转刻度
    if (type === 'fix') {
      return +(time * this.accuracy).toFixed(this.decimalPoint);
    } else {
      return time * this.accuracy;
    }
  }

  time2Width(time, type) {
    // 时间转宽度
    if (type === 'fix') {
      return +(time * this.accuracy * this.division).toFixed(this.decimalPoint);
    } else {
      return time * this.accuracy * this.division;
    }
  }

  realMaxScaleFloor() {
    return Math.floor(this.time2Scale(this.mediaDuration));
  }

  throttle(fn, delay) {
    let timeout = true;
    return function() {
      if (!timeout) {
        return false;
      }
      timeout = false;
      setTimeout(() => {
        fn();
        timeout = true;
      }, delay);
    };
  }
}
