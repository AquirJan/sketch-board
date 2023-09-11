/* sketch board */
// version 1.0.0
import recordActionHistory from './recordActionHistory.js';
import cloneDeep from './lodash.clonedeep.js';
export default class sketchBoard {
  constructor(options) {
    this.options = this.mergeDeep(
      {
        wrap: {
          innerHeight: 300,
          innerWidth: 400
        },
        style: {},
        wrapStyle: {},
        drawHistory: [],
        recordHistory: true,
        adjustDotStyle: {
          fillStyle: '#2ac2e4',
          strokeStyle: '#eee',
          lineWidth: 0,
        }, // 调整小点的样式
        pencilStyle: {
          fontSize: 14,
          strokeStyle: '#333',
          fillStyle: 'red',
          lineWidth: 0,
          brushSize: 10,
          brushColor: 'rgba(0, 195, 255, 0.5)',
          eraserSize: 10,
          lineJoin: 'bevel',
          lineCap: 'square'
        },
        render: true, // 是否停止渲染
        fontFamily: 'PingFang SC, Microsoft YaHei, Helvetica, Helvetica Neue, Hiragino Sans GB, Arial, sans-serif'
      },
      options
    );
    this.version='1.0.1'
    this.animationFrameId = undefined;
    this.sbCtx = null;
    this.sbDom = null;
    this.sbWrap = null;
    this.pencilPressing = false; // 是否画笔按压状态
    this.tinkerUp = null; // 是否处于调整尺寸状态
    this.clickTimeLogs = [];
    this.dragOffset = {
      x: 0,
      y: 0
    };
    this.dragDownPoint = {
      x: 0,
      y: 0
    };
    this.isObserver = false; // 是否观察者模式
    this.tmpRect = null;
    this.tmpArc = null;
    this.bgObj = undefined;
    this.existBrushObj = null; // 已有笔刷图
    this.existAlogrithmObj = null; // 已有算法特定图
    this.pencilPosition = null;
    this.btnScaleStep = 0.4;
    this.drawType = 'pointer'; // rect, polygon, brush, eraser, magnifier, arc, quadrangle
    this.tmpPolygon = null; // 存放临时 polygon 对象用
    this.zoomSize = 1;
    this.oldZoomSize = 1;
    this.originDraws = [];
    this.controlDots = [];
    this.selectedDraw = null;
    this.spaceBar = false;
    this.shiftKey = false;
    this.ctrlKey = false;
    this.altKey = false;
    this.draging = false;
    this.hoverPoint = {
      x: 0,
      y: 0
    };
    this.modifyRect = null;
    this.tmpPath2d = null;
    this.hoverDraw = null;

    this.pencilDownFn = null;
    this.pencilMoveFn = null;
    this.pencilUpFn = null;
    this.pencilOutFn = null;
    this.prevCursor = '';
    this.rightPressing = null;
    this.historyRecordHandler = null;
    this.shouldRecord = false;
    this.isHandMove = false;
    this.cursorDraw = null;
    this.specifyDrawId = null;
    this.windowResizeFn = null;
    this.resizing = false;
    this.sbDomKeydownFn = null;
    this.sbDomKeyupFn = null;
    this.sbDomWheelFn = null;
    this.magnifierDom = null; // 放大镜容器 
    this.preventDelete = false; // 是否阻止快捷键删除
    this.spliceBgList = []; // 拼接图片临时数组
    this.leftMouseDown = false; // 鼠标左键按下
    this.singleLog = false;
    this.loadingImg = false; // 加载中
    return this.init();
  }
  getVersion(){
    return this.version
  }
  // 深度合并对象
  mergeDeep(...objects) {
    // const isObject = obj => obj && typeof obj === 'object';
    const isObject = obj => obj && obj.constructor === Object;
    
    return objects.reduce((prev, obj) => {
      Object.keys(obj).forEach(key => {
        const pVal = prev[key];
        const oVal = obj[key];
        
        if (Array.isArray(pVal) && Array.isArray(oVal)) {
          prev[key] = pVal.concat(...oVal);
        }
        else if (isObject(pVal) && isObject(oVal)) {
          prev[key] = this.mergeDeep(pVal, oVal);
        }
        else {
          prev[key] = oVal;
        }
      });
      
      return prev;
    }, {});
  }
  // 初始化
  init() {
    let _wrapRect = null;
    if (this.options.wrap.innerWidth) {
      _wrapRect = { width: this.options.wrap.innerWidth, height: this.options.wrap.innerHeight };
    } else {
      _wrapRect = {
        width: this.options.wrap.clientWidth,
        height: this.options.wrap.clientHeight
      };
    }
    if (!_wrapRect) {
      return console.error('options.wrap error');
    }
    this.options['width'] = _wrapRect.width;
    this.options['height'] = _wrapRect.height;
    this.sbWrap = document.createElement('div');
    this.sbDom = document.createElement('canvas');
    this.sbDom.width = this.options.width;
    this.sbDom.height = this.options.height;
    let wrapDefaultStyle = {
      'user-select': 'none',
      width: '100%',
      height: '100%',
      position: 'relative',
      display: 'grid',
      'align-items': 'center',
      'justify-content': 'center'
    };
    let canvasDefaultStyle = {
      'user-select': 'none',
      overflow: 'auto'
    };
    if (this.options.wrapStyle.constructor === Object) {
      wrapDefaultStyle = this.mergeDeep(wrapDefaultStyle, this.options.wrapStyle);
    } else {
      console.warn('wrapStyle must be an object type');
    }
    if (this.options.style.constructor === Object) {
      canvasDefaultStyle = this.mergeDeep(canvasDefaultStyle, this.options.style);
    } else {
      console.warn('style must be an object type');
    }
    this.sbDom.style.cssText = JSON.stringify(canvasDefaultStyle)
      .replace(/"*,"/gi, ';')
      .replace(/({)|(})|(")/gi, '');
    this.sbWrap.style.cssText = JSON.stringify(wrapDefaultStyle)
      .replace(/"*,"/gi, ';')
      .replace(/({)|(})|(")/gi, '');
    this.sbCtx = this.sbDom.getContext('2d');
    this.sbWrap.appendChild(this.sbDom);

    if (this.options.recordHistory) {
      this.initActionHistory(this.options.drawHistory);
    }
    this.setDrawsData(this.options.drawHistory, false);

    this.setDrawType('pointer');

    this.sbDomKeydownFn = e => this.sbDomKeydown(e);
    this.sbDomKeyupFn = e => this.sbDomKeyup(e);
    this.sbDomWheelFn = e => this.sbDomWheel(e)

    this.bindGlobalKeyboard();

    this.sbDom.addEventListener('wheel', this.sbDomWheelFn, false);
    this.sbDom.oncontextmenu = e => {
      e.preventDefault();
    };

    

    if (this.options.render) {
      this.windowResizeFn = e => this.windowResize(e);
      window.addEventListener('resize', this.windowResizeFn, false);
      this.renderBoard();
      this.wrapSizeObserver();
    }
    
    return this;
  }
  wrapSizeObserver() {
    if (!this.sbWrap) {
      console.error('没有sbWrap');
      return;
    }
    const resizeObserver = new ResizeObserver(async entries => {
      this.windowResize();
    });
    resizeObserver.observe(this.sbWrap);
  }
  async windowResize(e) {
    // console.log(`windowResize`)
    if (!this.resizing) {
      if (!this.sbDom) {
        return;
      }
      this.resizing = true;
      this.sbDom.width = 0;
      this.sbDom.height = 0;
      const _wrapRect = this.sbWrap;
      this.options['width'] = _wrapRect.clientWidth;
      this.options['height'] = _wrapRect.clientHeight;
      this.sbDom.width = this.options.width;
      this.sbDom.height = this.options.height;

      if (this.spliceBgList && this.spliceBgList.length) {
        // const _lastChild = this.spliceBgList[this.spliceBgList.length-1]
        const _scaledList = this.spliceBgList.map(val => val.scaled)
        const _originScaled = Math.min(..._scaledList)
        this.zoomSize = _originScaled;
        this.dragOffset = {
          x: 0,
          y: 0
        };
      } else {
        let _bgObj = {
          success: true,
          fillStyle: this.bgObj && this.bgObj.fillStyle ? this.bgObj.fillStyle : 'transparent',
          scaled: 1,
          offsetX: 0,
          offsetY: 0,
          viewWidth: _wrapRect.clientWidth,
          viewHeight: _wrapRect.clientHeight,
          width: _wrapRect.clientWidth,
          height: _wrapRect.clientHeight
        };
        if (this.bgObj && this.bgObj.data) {
          const { height, width, scaled, offsetX, offsetY } = this.calcImageSize(this.bgObj.data.naturalWidth, this.bgObj.data.naturalHeight);
          _bgObj = {
            src: this.bgObj.src,
            success: true,
            msg: 'load image complite',
            data: this.bgObj.data,
            scaled,
            offsetX,
            offsetY,
            viewWidth: width,
            viewHeight: height,
            width: this.bgObj.data.naturalWidth,
            height: this.bgObj.data.naturalHeight
          };
        }
        _bgObj['degree'] = this.bgObj?.degree || 0;
        this.bgObj = _bgObj;
        this.zoomSize = this.bgObj.scaled;
        this.dragOffset = {
          x: this.bgObj.offsetX,
          y: this.bgObj.offsetY
        };
      }
      
      this.resizing = false;
    }
  }
  setPreventDelete(val) {
    this.preventDelete = val
  }
  setLoading(val) {
    this.loadingImg = val;
  }
  // 绑定键盘事件
  bindGlobalKeyboard() {
    document.body.addEventListener('keydown', this.sbDomKeydownFn, false);
    document.body.addEventListener('keyup', this.sbDomKeyupFn, false);
  }
  // 解除绑定键盘事件
  revokeGlobalKeyboard() {
    document.body.removeEventListener('keydown', this.sbDomKeydownFn, false);
    document.body.removeEventListener('keyup', this.sbDomKeyupFn, false);
  }
  // 设置光标位置
  setCursorPosition(x, y) {
    if (this.cursorDraw) {
      this.cursorDraw['width'] = this.cursorDraw.size;
      this.cursorDraw['height'] = this.cursorDraw.size;
      this.cursorDraw['x'] = x - this.cursorDraw.size / 2;
      this.cursorDraw['y'] = y - this.cursorDraw.size / 2;
    }
  }
  // 校验点超出范围
  detectIsPointOutsideLimit(options){
    const _options = this.mergeDeep({item:undefined},options)
    const {item} = _options;
    let _draws = this.originDraws
    let _limitPolygon = undefined;
    let _flag = false;
    const _removeList = ["rect"];
    for(let i=0;i<_draws.length;i++) {
      if (_draws[i].drawType === 'polygonClip') {
        _limitPolygon = _draws[i]
      }
    }
    if (_limitPolygon) {
      const _limitPath2d = this.drawToSvgPath(_limitPolygon)
      let _offsetX = this.dragOffset ? this.dragOffset.x : 0
      let _offsetY = this.dragOffset ? this.dragOffset.y : 0
      if (item && item.drawType && _removeList.includes(item.drawType)) {
        for (let j=0;j<_draws.length;j++) {
          const val = _draws[j]
          const _pointlt = {x: val.x, y: val.y}
          const _pointrt = {x: val.x+val.width, y: val.y}
          const _pointrb = {x: val.x+val.width, y: val.y+val.height}
          const _pointlb = {x: val.x, y: val.y+val.height}
          const _points = [_pointlt, _pointrt, _pointrb, _pointlb]
          let _is_overlap = false
          for (let i=0;i<_points.length;i++) {
            const _x = this.normalFloat(_points[i].x*this.zoomSize)+_offsetX
            const _y = this.normalFloat(_points[i].y*this.zoomSize)+_offsetY
            if (!this.sbCtx.isPointInPath(_limitPath2d, _x, _y))   {
              _is_overlap = true;
              break;
            }
          }
          if (val.id === item.id && _is_overlap) {
            _draws.splice(j, 1)
            _flag = true;
            break;
          }  
        }
      } else {
        this.originDraws = _draws.filter(val => {
          if (val.drawType && _removeList.includes(val.drawType)) {
            const _pointlt = {x: val.x, y: val.y}
            const _pointrt = {x: val.x+val.width, y: val.y}
            const _pointrb = {x: val.x+val.width, y: val.y+val.height}
            const _pointlb = {x: val.x, y: val.y+val.height}
            const _points = [_pointlt, _pointrt, _pointrb, _pointlb]
            let _is_overlap = false
            for (let i=0;i<_points.length;i++) {
              const _x = this.normalFloat(_points[i].x*this.zoomSize)+_offsetX
              const _y = this.normalFloat(_points[i].y*this.zoomSize)+_offsetY
              if (!this.sbCtx.isPointInPath(_limitPath2d, _x, _y))   {
                _is_overlap = true;
                break;
              }
            }
            if (!_is_overlap) {
              return val;
            }
          } else {
            return val;
          } 
        })
      }
    }
    return _flag
  }
  // 初始化cursor光标
  initCursor(strokeStyle, fillStyle) {
    this.cursorDraw = {
      x: 0,
      y: 0,
      size: 0,
      width: 0,
      height: 0
    };
    this.cursorDraw['strokeStyle'] = strokeStyle ? strokeStyle : '#333';
    this.cursorDraw['fillStyle'] = fillStyle ? fillStyle : '#efefef';
    let size = 10;
    if (this.drawType === 'brush') {
      size = this.options.pencilStyle.brushSize ? this.options.pencilStyle.brushSize : size;
    } else if (this.drawType === 'eraser') {
      size = this.options.pencilStyle.eraserSize ? this.options.pencilStyle.eraserSize : size;
    }
    this.cursorDraw['size'] = size;
  }
  // 历史记录初始化
  initActionHistory(historys) {
    this['historyRecordHandler'] = new recordActionHistory({
      historyArray: [historys]
    });
  }
  // 获取历史操作记录
  getHistoryRecords() {
    return this.historyRecordHandler ? this.historyRecordHandler.getHistoryArray() : [];
  }
  getHistoryRecordsLength() {
    return this.historyRecordHandler ? this.historyRecordHandler.getHistoryArrayLength() : 0;
  }
  // 获取历史操作记录
  getRevokedStep() {
    return this.historyRecordHandler ? this.historyRecordHandler.getRevokedStep() : 0;
  }
  // 清空历史操作
  reinitRecordHistory(historys) {
    this.historyRecordHandler.destroy();
  }
  // 历史记录操作,后退
  revoke() {
    if (!this.historyRecordHandler) {
      return console.error(`历史操作记录实例不存在`);
    }
    this.historyRecordHandler.revoke();
    const _data = this.historyRecordHandler.getHistoryArrayFirst();
    if (!_data) {
      console.error(`需要撤销的数据有异常`);
      return;
    }
    this.setDrawsData(_data, false);
  }
  // 历史记录操作,前进
  onward() {
    if (!this.historyRecordHandler) {
      return console.error(`历史操作记录实例不存在`);
    }
    this.historyRecordHandler.onward();
    const _data = this.historyRecordHandler.getHistoryArrayFirst();
    if (!_data) {
      console.error(`需要前进的数据有异常`);
      return;
    }
    this.setDrawsData(_data, false);
  }
  // 销毁
  destroy() {
    if (this.animationFrameId) {
      window.cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null;
    }
    window.removeEventListener('resize', this.windowResizeFn, false);
    this.revokeGlobalKeyboard();
    this.reinitRecordHistory()
    this.sbDom.remove();
    this.sbDom = null;
    this.sbWrap.remove();
    this.sbWrap = null;
    document.documentElement.style.cursor = 'default';
  }
  // 获取当前选中框框
  getSelectedDraw() {
    return this.selectedDraw;
  }
  // 获取画布dom
  getCanvasDom() {
    return this.sbDom;
  }
  // 获取容器dom
  getWrapDom() {
    return this.sbWrap;
  }
  // 获取画布ctx对象
  getCanavasCtx() {
    return this.sbCtx;
  }
  // 设置观察者模式, 鼠标hover会单独显示所选draw
  setObserverMode(isObserver = true) {
    this.selectedDraw = null;
    this.isObserver = isObserver;
  }
  // 清空背景列表数据
  clearBgList() {
    this.spliceBgList = []
  }
  // 获取spliceBgList总尺寸大小
  getSpliceBgListTotalSize(type="height") {
    let _totalWidth = 0;
    let _totalHeight = 0;
    if (this.spliceBgList && this.spliceBgList.length) {
      this.spliceBgList.forEach(val => {
        if (type === 'height') {
          _totalHeight = _totalHeight + Math.floor(val.height*this.zoomSize)
        }
        if (type === 'width') {
          _totalWdith = _totalWdith + Math.floor(val.width*this.zoomSize)
        }
      })
    }
    return {
      totalWidth: _totalWidth,
      totalHeight: _totalHeight
    }
  }
  // 撤销wheel监听
  revokeWheel() {
    this.sbDom.removeEventListener('wheel', this.sbDomWheelFn, false);
  }
  // 拼接背景图
  async spliceBackground(obj={}){
    return new Promise(async resolve=>{
      const _obj = this.mergeDeep({
        offsetX: 0,
        offsetY: 0,
        src: '',
        reverse: false,
      }, obj)
      if (_obj.src) {
        let _bgSection = await this.asyncLoadImage(_obj.src);
        if (_bgSection.success) {
          if (_obj.reverse) {
            // 倒序插入
            this.spliceBgList.unshift(_bgSection)
            this.spliceBgList[0].offsetX = 0;
            this.spliceBgList[0].offsetY = 0;
            if(this.spliceBgList.length) {
              for(let i=1;i<this.spliceBgList.length;i++) {
                const _prevItem = this.spliceBgList[i-1];
                this.spliceBgList[i].offsetY = _prevItem.height+_prevItem.offsetY
              }
            }
            let prevScaled = 1
            if (this.spliceBgList.length) {
              prevScaled = this.spliceBgList[0].scaled
            }
            this.zoomSize = Math.min(prevScaled, _bgSection.scaled);
            this.options.pencilStyle.lineWidth = 1/this.zoomSize*2.5
            this.options.adjustDotStyle.lineWidth = 1/this.zoomSize*3
          } else {
            // 顺序插入
            _bgSection = this.mergeDeep(_bgSection, {
              offsetX: _obj.offsetX,
              offsetY: _obj.offsetY,
            })
            this.spliceBgList.push(_bgSection)
            let prevScaled = 1
            if (this.spliceBgList.length>0) {
              prevScaled = this.spliceBgList[this.spliceBgList.length-1].scaled
            }
            this.zoomSize = Math.min(prevScaled, _bgSection.scaled);
            this.options.pencilStyle.lineWidth = 1/this.zoomSize*2.5
            this.options.adjustDotStyle.lineWidth = 1/this.zoomSize*3
          }
        }
        resolve()
      } else {
        resolve()
      }
    })
  }
  removeSpliceBackground() {
    this.dragOffset = {
      x: 0,
      y: 0
    }
    this.spliceBgList = []
    this.zoomSize = 1;
    this.options.pencilStyle.lineWidth = 1/this.zoomSize*2.5
    this.options.adjustDotStyle.lineWidth = 1/this.zoomSize*3
  }
  renderLoading() {
    this.setPencilStyle({
      ctx: this.sbCtx,
      fillStyle: 'rgba(0,0,0,.5)'
    })
    this.sbCtx.fillRect(0, 0, this.sbDom.width, this.sbDom.height)
    this.setPencilStyle({
      ctx: this.sbCtx,
      fillStyle: '#fff',
    })
    let _fontSize = 30;
    let _words = '加载中。。。'
    this.sbCtx.font = `${_fontSize}px ${this.options.fontFamily}`
    const _strWidth = Math.floor(this.sbCtx.measureText(_words).width);
    let _x = Math.floor((this.sbDom.width-_strWidth)/2)
    let _y = Math.floor((this.sbDom.height-_fontSize)/2)
    this.sbCtx.fillText(_words, _x, _y);
  }
  // 设置背景图的旋转角度
  setBackgroundDegree(degree) {
    if (this.bgObj) {
      this.bgObj['degree'] = degree;
    }
  }
  // 设置背景图
  async setBackground(obj) {
    return new Promise(async resolve => {
      this.loadingImg = true;
      const _obj = this.mergeDeep(
        {
          fillStyle: 'transparent',
          src: ''
        },
        obj
      );
      if (_obj.src) {
        this.bgObj = await this.asyncLoadImage(_obj.src);
        if (this.bgObj.success) {
          this.zoomSize = this.bgObj.scaled;
          this.dragOffset = {
            x: this.bgObj.offsetX,
            y: this.bgObj.offsetY
          };
          this.options.pencilStyle.lineWidth = 1/this.zoomSize*1.5
          this.options.adjustDotStyle.lineWidth = 1/this.zoomSize*3
        }
      } else {
        this.bgObj = {
          success: true,
          fillStyle: _obj.fillStyle,
          scaled: 1,
          offsetX: 0,
          offsetY: 0,
          degree: 0,
          viewWidth: this.options.width,
          viewHeight: this.options.height,
          width: this.options.width,
          height: this.options.height
        };
        this.dragOffset = {
          x: this.bgObj.offsetX,
          y: this.bgObj.offsetY
        };
        this.zoomSize = this.bgObj.scaled;
      }
      this.bgObj['degree'] = 0;
      this.loadingImg = false;
      resolve(this.bgObj);
    });
  }
  // 设置已有笔刷图
  async setExistBrushPic(obj) {
    const _obj = this.mergeDeep(
      {
        src: ''
      },
      obj
    );
    if (_obj.src) {
      this.existBrushObj = await this.asyncLoadImage(_obj.src, false);
    } else {
      this.existBrushObj = obj;
    }
  }
  // 找出4个极点
  findOut4Poles(selectedDraws, isOrigin = false) {
    let _drawers = [];
    if (selectedDraws.constructor === Array) {
      _drawers = selectedDraws;
    } else if (selectedDraws.constructor === Object) {
      _drawers = [selectedDraws];
    }
    let _x_coordinate = [];
    let _y_coordinate = [];

    _drawers.forEach(val => {
      const _item = isOrigin ? val : val.data;
      _x_coordinate.push(_item.x);
      _y_coordinate.push(_item.y);
      if (_item.width) {
        _x_coordinate.push(_item.x + _item.width);
      }
      if (_item.height) {
        _y_coordinate.push(_item.y + _item.height);
      }
      if (_item.ways) {
        _item.ways.forEach(wval => {
          _x_coordinate.push(wval.x);
          _y_coordinate.push(wval.y);
        });
      }
    });
    _x_coordinate.sort((a, b) => a - b);
    _y_coordinate.sort((a, b) => a - b);
    const modifyRect = {
      type: 'modifyRect',
      x: _x_coordinate[0],
      y: _y_coordinate[0],
      width: _x_coordinate[_x_coordinate.length - 1] - _x_coordinate[0],
      height: _y_coordinate[_y_coordinate.length - 1] - _y_coordinate[0]
    };
    return modifyRect;
  }
  waitToBlob(canvas, type = 'image/jpeg', quality = 0.95) {
    return new Promise(resolve => {
      if (!canvas) {
        resolve(false);
      }
      canvas.toBlob(
        blob => {
          resolve(blob);
        },
        type,
        quality
      );
    });
  }
  async exportBuffer(type = 'image/jpeg', quality = 0.95, origin = true) {
    let _canvas = this.getCanvasDom();
    if (origin && this.bgObj) {
      _canvas = document.createElement('canvas');
      _canvas.width = this.bgObj.width;
      _canvas.height = this.bgObj.height;
      const _canvasCtx = _canvas.getContext('2d');
      _canvasCtx.drawImage(this.bgObj.data, 0, 0);
    }
    const blob = await this.waitToBlob(_canvas, type, quality);
    const buff = await blob.arrayBuffer();
    return buff;
  }
  // 框框外部调整控制器
  drawOutsideAddon() {
    const _selectedIndex = this.selectedDraw.map(val => val.index);
    let _canAdjust = true;
    let _selectedOrigins = this.originDraws.filter((val, index) => {
      if (_selectedIndex.includes(index)) {
        if (val.type !== 'rect') {
          _canAdjust = false;
        }
        return val;
      }
    });

    this.modifyRect = this.findOut4Poles(_selectedOrigins, true);

    // const _gap = 5/this.zoomSize;
    const _gap = 0;
    const _x = this.modifyRect.x - _gap;
    const _y = this.modifyRect.y - _gap;
    const _width = this.modifyRect.width + _gap * 2;
    const _height = this.modifyRect.height + _gap * 2;
    this.sbCtx.beginPath();
    this.sbCtx.moveTo(_x, _y);
    this.sbCtx.lineTo(_x + _width, _y);
    this.sbCtx.lineTo(_x + _width, _y + _height);
    this.sbCtx.lineTo(_x, _y + _height);
    this.sbCtx.closePath();
    this.sbCtx.setLineDash([20, 12]);
    this.sbCtx.strokeStyle = '#f79262';
    this.sbCtx.stroke();
    this.sbCtx.setLineDash([]);
    // 多draws调整大小
    // if (_canAdjust) {
    //   this.adjustmentAddon(this.modifyRect, _gap)
    // }
  }
  // 对比两图是否有改动
  compareDiff(referenceB64, compareType = 'algorithm') {
    return new Promise(async resolve => {
      const _currentB64 = await this.exportPic({
        type: compareType,
        file: false
      });
      resolve({
        reference: referenceB64,
        current: _currentB64,
        isDiff: _currentB64 !== referenceB64
      });
    });
  }
  // 加载图promise
  asyncLoadImage(src, calcScaled = true) {
    return new Promise(resolve => {
      if (!src) {
        resolve({
          success: false,
          msg: 'no src'
        });
      }
      if (!this.sbDom){
        return;
      }
      const image = new Image();
      image.crossOrigin = 'Anonymous';
      image.src = src;
      image.onload = () => {
        if (calcScaled) {
          const { height, width, scaled, offsetX, offsetY } = this.calcImageSize(image.naturalWidth, image.naturalHeight);
          resolve({
            src,
            success: true,
            msg: 'load image complite',
            data: image,
            scaled,
            offsetX,
            offsetY,
            viewWidth: width,
            viewHeight: height,
            width: image.naturalWidth,
            height: image.naturalHeight
          });
        } else {
          resolve({
            src,
            success: true,
            msg: 'load image complite',
            data: image,
            width: image.naturalWidth,
            height: image.naturalHeight
          });
        }
      };
      image.onerror = () => {
        resolve({
          success: false,
          msg: 'load image error',
          src
        });
      };
    });
  }
  // 工具栏用方法
  // 清除
  clearWhole(publicUse = true) {
    if (publicUse) {
      this.originDraws = [];
      this.selectedDraw = null;
      this.bgObj = null;
      this.existBrushObj = null;
      this.existAlogrithmObj = null;
    }
    let _width = this.sbDom.width
    let _height = this.sbDom.height
    if (this.bgObj && this.bgObj.success) {
      _width = this.bgObj.width
      _height = this.bgObj.height
    }
    if (this.spliceBgList && this.spliceBgList.length) {
      const _lastChild = this.spliceBgList[this.spliceBgList.length-1]
      _width = _lastChild.offsetX + _lastChild.width
      _height = _lastChild.offsetY + _lastChild.height
    }
    let clearSize = {
      width: Math.ceil(_width / this.zoomSize),
      height: Math.ceil(_height / this.zoomSize)
    };
    if (clearSize.width <= this.sbDom.width) {
      clearSize['width'] = this.sbDom.width
    }
    if (clearSize.height <= this.sbDom.height) {
      clearSize['height'] = this.sbDom.height
    }
    this.sbCtx.clearRect(-clearSize.width, -clearSize.height, clearSize.width*3, clearSize.height*3)
  }
  // 规范小数
  normalFloat(floatNumber = 0, fixed = 0) {
    return parseFloat(floatNumber.toFixed(fixed));
  }
  // 计算当前缩放尺寸
  calcCurrentZoomSize(size, plus = true, step = 0.01, min = 0.15, max = 2) {
    if (isNaN(size)) {
      console.warn('size param is not a number');
      return null;
    }
    this.oldZoomSize = size;
    size = plus ? size + step : size - step;
    let _originScaled = 1;
    if (this.bgObj.scaled) {
      _originScaled = this.bgObj.scaled
    }
    if (this.spliceBgList && this.spliceBgList.length) {
      _originScaled = this.spliceBgList[this.spliceBgList.length-1].scaled
    }
    const _min = Math.min(_originScaled, 1);
    return Math.max(_min, Math.min(parseFloat(size.toFixed(3)), max));
  }
  // 转换至用户的笔刷图
  changeToPreviewBrush(imgObj, r = 0, g = 0, b = 0, a = 255, quality = 1) {
    return new Promise(async resolve => {
      // console.log(imgObj)
      if (!imgObj || !imgObj.data) {
        console.log('---没有找到图像数据---');
        resolve({
          success: false,
          msg: '---没有找到图像数据---'
        });
      }
      const _canvas = document.createElement('canvas');
      _canvas.width = imgObj.width;
      _canvas.height = imgObj.height;
      const _canvasCtx = _canvas.getContext('2d');
      _canvasCtx.drawImage(imgObj.data, 0, 0);
      let _imgData = _canvasCtx.getImageData(0, 0, _canvas.width, _canvas.height);
      // console.log(_imgData.data)
      if (_imgData && _imgData.data) {
        for (let i = 0; i < _imgData.data.length; i += 4) {
          // 根据白色转其他颜色
          if (_imgData.data[i] !== 0 && _imgData.data[i + 1] !== 0 && _imgData.data[i + 2] !== 0) {
            _imgData.data[i] = r;
            _imgData.data[i + 1] = g;
            _imgData.data[i + 2] = b;
            _imgData.data[i + 3] = 255 * a;
          } else if (_imgData.data[i] === 0 && _imgData.data[i + 1] === 0 && _imgData.data[i + 2] === 0) {
            _imgData.data[i] = 255;
            _imgData.data[i + 1] = 255;
            _imgData.data[i + 2] = 255;
            _imgData.data[i + 3] = 0;
          }
        }
        _canvasCtx.putImageData(_imgData, 0, 0);
        const _img = _canvas.toDataURL('image/png', quality || 1);
        const _imgdata = await this.asyncLoadImage(_img, false);
        // resolve(_img)
        resolve(_imgdata);
      } else {
        resolve({
          success: false,
          msg: '---没有找到图像数据---'
        });
      }
    });
  }
  // 判断图片是否有标注
  detectIsMarked(imgObj) {
    return new Promise(async resolve => {
      // console.log(imgObj)
      if (!imgObj || !imgObj.data) {
        console.log('---没有找到图像数据---');
        resolve(false);
      }
      const _canvas = document.createElement('canvas');
      _canvas.width = imgObj.width;
      _canvas.height = imgObj.height;
      const _canvasCtx = _canvas.getContext('2d');
      _canvasCtx.drawImage(imgObj.data, 0, 0);
      const _imgData = _canvasCtx.getImageData(0, 0, _canvas.width, _canvas.height);
      // console.log(_imgData.data)
      if (_imgData && _imgData.data) {
        let _flag = false;
        for (let i = 0; i < _imgData.data.length; i++) {
          // 不是alpha值也不是黑色, 表明有标注
          if ((i + 1) % 4 !== 0 && _imgData.data[i] !== 0) {
            // console.log(i)
            _flag = true;
            break;
          }
        }
        resolve(_flag);
      } else {
        resolve(false);
      }
    });
  }
  // 计算缩放后拖拉后的差值
  calcZoomedDragoffsetDeltaSize(zoomin = true) {
    let _width = this.options.width;
    let _height = this.options.height;
    if (this.bgObj) {
      _width = this.bgObj.width;
      _height = this.bgObj.height;
    }
    if (this.spliceBgList && this.spliceBgList.length) {
      const _lastChild = this.spliceBgList[this.spliceBgList.length - 1]
      _width = _lastChild.width + _lastChild.offsetX;
      _height = _lastChild.height + _lastChild.offsetY;
    }
    
    let _deltaWidth = Math.abs(_width * this.zoomSize - _width * this.oldZoomSize) / 2;
    let _deltaHeight = Math.abs(_height * this.zoomSize - _height * this.oldZoomSize) / 2;
    let x = 0;
    let y = 0;
    if (zoomin) {
      x = this.dragOffset.x - _deltaWidth;
      y = this.dragOffset.y - _deltaHeight;
    } else {
      x = this.dragOffset.x + _deltaWidth;
      y = this.dragOffset.y + _deltaHeight;
    }
    this.dragOffset = {
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
    };
    return this.dragOffset;
  }
  // 还原缩放
  zoomReset() {
    // this.calcZoomedDragoffsetDeltaSize(false);
    if (this.bgObj && this.bgObj.data) {
      this.dragOffset = {
        x: this.bgObj.offsetX,
        y: this.bgObj.offsetY
      };
      this.zoomSize = this.bgObj.scaled;
    } else {
      this.dragOffset = {
        x: 0,
        y: 0
      };
      this.zoomSize = this.spliceBgList && this.spliceBgList.length ? this.spliceBgList[this.spliceBgList.length-1].scaled : 1;
    }
  }
  // 获取缩放倍数
  getZoomSize() {
    return {
      current: this.zoomSize,
      default: this.bgObj ? this.bgObj.scaled : 1
    };
  }
  // 放大
  zoomIn(step = 0.05) {
    this.zoomSize = this.calcCurrentZoomSize(this.zoomSize, true, step);
    if (this.oldZoomSize !== this.zoomSize) {
      this.calcZoomedDragoffsetDeltaSize();
    }
  }
  // 缩小
  zoomOut(step = 0.05) {
    this.zoomSize = this.calcCurrentZoomSize(this.zoomSize, false, step);
    if (this.oldZoomSize !== this.zoomSize) {
      this.calcZoomedDragoffsetDeltaSize(false);
    }
  }
  getAllDraws() {
    return this.originDraws;
  }
  // 切割图片部分区域
  clipImgSection(coordinate) {
    return new Promise(resolve => {
      const _canvas = document.createElement('canvas');
      _canvas.width = coordinate.width;
      _canvas.height = coordinate.height;
      const _canvasCtx = _canvas.getContext('2d');
      _canvasCtx.drawImage(this.bgObj.data, coordinate.x, coordinate.y, coordinate.width, coordinate.height, 0, 0, this.bgObj.width, this.bgObj.height);
      const _img = _canvas.toDataURL('image/png', coordinate.quality || 1);
      return resolve(_img);
    });
  }
  // 转换图片至base64
  imageToBase64(imgObj) {
    return new Promise(resolve => {
      const _canvas = document.createElement('canvas');
      _canvas.width = imgObj.width;
      _canvas.height = imgObj.height;
      const _canvasCtx = _canvas.getContext('2d');
      _canvasCtx.drawImage(imgObj.data, 0, 0);
      const _img = _canvas.toDataURL('image/png', imgObj.quality || 1);
      return resolve(_img);
    });
  }
  // 工具栏用方法end
  // 设置画图类型
  setDrawType(params, publicUse = true, options = {}) {
    if (publicUse) {
      this.selectedDraw = null;
      this.tmpPolygon = null;
      this.tmpPath2d = null;
      this.tmpRect = null;
      this.tmpArc = null;
    }
    this.drawType = params;
    if (!['pointer', 'magnifier'].includes(this.drawType) ) {
      document.documentElement.style.cursor = 'crosshair';
    }
    if (this.pencilDownFn) {
      this.sbDom.removeEventListener('mousedown', this.pencilDownFn, false);
      this.pencilDownFn = null;
    }
    if (this.pencilMoveFn) {
      this.sbDom.removeEventListener('mousemove', this.pencilMoveFn, false);
      this.pencilMoveFn = null;
    }
    if (this.pencilUpFn) {
      this.sbDom.removeEventListener('mouseup', this.pencilUpFn, false);
      // this.sbDom.removeEventListener('mouseout', this.pencilUpFn, false);
      this.pencilUpFn = null;
    }
    if (this.pencilOutFn) {
      this.sbDom.removeEventListener('mouseout', this.pencilOutFn, false);
      this.pencilOutFn = null;
    }
    if (this.drawType !== 'pointer' && this.isObserver) {
      return false;
    }
    
    // 各类型自动绑定事件
    if (this[`${this.drawType}DownFn`]) {
      if (options.id) {
        this.specifyDrawId = options.id;
      }
      delete options.id;
      this.options['adjustDotStyle'] = this.mergeDeep(this.options.adjustDotStyle, options.adjustDotStyle || {});
      this.options['pencilStyle'] = this.mergeDeep(this.options.pencilStyle, options.pencilStyle || {});
      
      if (this[`${this.drawType}DownFn`]) {
        this.pencilDownFn = e => this[`${this.drawType}DownFn`](e, options);
        this.sbDom.addEventListener('mousedown', this.pencilDownFn, false);
      }
      
      if (this[`${this.drawType}MoveFn`]) {
        this.pencilMoveFn = e => this[`${this.drawType}MoveFn`](e, options);
        this.sbDom.addEventListener('mousemove', this.pencilMoveFn, false);  
      }
      
      if (this[`${this.drawType}UpFn`]) {
        this.pencilUpFn = e => this[`${this.drawType}UpFn`](e, options);
        this.sbDom.addEventListener('mouseup', this.pencilUpFn, false);
        // this.sbDom.addEventListener('mouseout', this.pencilUpFn, false);
      }
      
      if (this[`${this.drawType}OutFn`]) {
        this.pencilOutFn = e => this[`${this.drawType}OutFn`](e, options);
        this.sbDom.addEventListener('mouseout', this.pencilOutFn, false);
      }
      
      // 更改鼠标样式，暂时只做了brush和eraser两个类型的自定义
      if (['brush', 'eraser'].includes(this.drawType)) {
        this.initCursor();
      } else {
        this.cursorDraw = null;
      }
    }
  }
  getPointerPosition() {
    return this.hoverPoint;
  }
  findOutFoucusDraw(e) {
    this.tinkerUp = null;
    if (this.selectedDraw) {
      // 判断是否单选情况
      if (this.selectedDraw.constructor === Object) {
        const _item = this.calcIsOverDraws({x:this.hoverPoint.x, y:this.hoverPoint.y})
        if (_item && _item.data && !_item.data.lock) {
          if (_item && (this.selectedDraw.index !== _item.index || this.selectedDraw.pointIn !== _item.pointIn)) {
            this.selectedDraw = cloneDeep(_item);
          } else if (this.selectedDraw.pointIn && _item === null) {
            delete this.selectedDraw.pointIn;
          }
        }
      }
      for (let i = 0; i < this.controlDots.length; i++) {
        const _dot = this.controlDots[i];
        const _dotPath2d = this.drawModifyDot(_dot);
        if (this.sbCtx.isPointInPath(_dotPath2d, this.hoverPoint.x, this.hoverPoint.y)) {
          document.documentElement.style.cursor = _dot.cursor;
          this.tinkerUp = { code: _dot.code };
          if (_dot.wayIndex !== undefined && _dot.wayIndex !== null && _dot.wayIndex.constructor === Number) {
            this.tinkerUp['wayIndex'] = _dot.wayIndex;
          }
          break;
        }
      }
    } else {
      const _draw = this.calcIsOverDraws({x:this.hoverPoint.x, y:this.hoverPoint.y})
      if (_draw && _draw.data && !_draw.data.lock) {
        this.selectedDraw = cloneDeep(_draw);
      }
    }

    if (this.selectedDraw && !this.calcIsOnModifyRect(this.hoverPoint.x, this.hoverPoint.y) && !this.tinkerUp && !this.calcIsOverDraws({x:this.hoverPoint.x, y:this.hoverPoint.y})) {
      this.selectedDraw = null;
      this.modifyRect = null;
    }
  }
  // 程序方式选定draw
  selectDrawAction(i) {
    if (this.originDraws[i] && !this.originDraws[i].lock) {
      this.selectedDraw = cloneDeep({
        data: this.originDraws[i],
        index: i,
        pointIn: 'inside'
      })
    }
  }
  // 修正翻转调整后的坐标错误偏差
  validateRect() {
    if (this.selectedDraw.constructor === Object) {
      let _item = this.originDraws[this.selectedDraw.index];
      if (this.tinkerUp) {
        switch (this.tinkerUp.code) {
          case 'tm':
          case 'bm':
            if (_item.height < 0) {
              // [a, b] = [b, a]; // es6 对调两个值
              _item.y = _item.y + _item.height;
              _item.height = Math.abs(_item.height);
            }
            if (this.bgObj.height < _item.height) {
              _item.height = this.bgObj.height;
            }
            break;
          case 'lm':
          case 'rm':
            if (_item.width < 0) {
              _item.x = _item.x + _item.width;
              _item.width = Math.abs(_item.width);
            }
            if (this.bgObj.width < _item.width) {
              _item.width = this.bgObj.width;
            }
            break;
          case 'tr':
          case 'bl':
          case 'tl':
          case 'br':
            if (_item.width < 0) {
              _item.x = _item.x + _item.width;
              _item.width = Math.abs(_item.width);
            }
            if (_item.height < 0) {
              _item.y = _item.y + _item.height;
              _item.height = Math.abs(_item.height);
            }
            if (this.bgObj.height < _item.height) {
              _item.height = this.bgObj.height;
            }
            if (this.bgObj.width < _item.width) {
              _item.width = this.bgObj.width;
            }
            break;
        }
      }
    }
  }
  // 初始化放大镜canvas
  initMagnifier(options){
    if (!this.magnifierDom && document) {
      const _options = this.mergeDeep({
        width: '200px',
        height: '200px'
      }, options)
      this.magnifierDom = document.createElement('canvas');
      let _style = [];
      for(let key in _options) {
        _style.push(`${key}:${_options[key]}`)
      }
      _style = _style.join(';')
      this.magnifierDom.style.cssText = _style
    }
    return this.magnifierDom
  }
  // 放大镜
  magnifierDownFn(e){
    this.sbDom.dispatchEvent(
      new CustomEvent('magnifierDown', {
        bubbles: true,
        detail: {
          point: {
            x: e.clientX,
            y: e.clientY
          }
        }
      })
    );
  }
  magnifierMoveFn(e){
    if (!this.magnifierDom) {
      console.log('return')
      return;
    }
    // console.log(e)
    console.log(this.magnifierDom.getBoundingClientRect())
    const _magnifierRect = this.magnifierDom.getBoundingClientRect();
    this.sbDom.dispatchEvent(
      new CustomEvent('magnifierMove', {
        bubbles: true,
        detail: {
          point: {
            x: e.clientX,
            y: e.clientY
          }
        }
      })
    );
  }
  magnifierUpFn(e){
    console.log('magnifier up')
    this.sbDom.dispatchEvent(
      new CustomEvent('magnifierUp', {
        bubbles: true,
        detail: {
          point: {
            x: e.clientX,
            y: e.clientY
          }
        }
      })
    );
  }
  // 指针状态事件
  pointerDownFn(e) {
    if (this.pencilPressing) {
      return;
    }
    if (e.button === 0) {
      this.leftMouseDown = true;
      if (this.isObserver) {
        return;
      }
      this.hoverPoint = {
        x: e.offsetX,
        y: e.offsetY
      };
      // const _limitPath2d = this.drawToSvgPath(this.originDraws[0])
      // console.log('pointerdown')
      // console.log(this.sbCtx.isPointInPath(_limitPath2d, this.hoverPoint.x, this.hoverPoint.y))
      // console.log(this.hoverPoint.x, this.hoverPoint.y)
      // console.log('\n')
      if (this.selectedDraw) {
        this.selectedDraw['changed'] = false;
        this.selectedDraw['moved'] = false;
      }

      if (this.spaceBar && !this.draging) {
        this.pencilPressing = true;
        this.draging = true;
        this.dragDownPoint = {
          x: e.offsetX - this.dragOffset.x,
          y: e.offsetY - this.dragOffset.y
        };
        return;
      }
      this.findOutFoucusDraw(e);

      this.setPencilPosition(this.hoverPoint.x, this.hoverPoint.y);

    }
    if (e.button === 2) {
      if (this.detectIsDBClick(e.timeStamp)) {
        this.zoomReset();
      } else {
        document.documentElement.style.cursor = 'grabbing';
        if (!this.draging) {
          this.rightPressing = true;
          this.pencilPressing = true;
          this.draging = true;
          this.dragDownPoint = {
            x: e.offsetX - this.dragOffset.x,
            y: e.offsetY - this.dragOffset.y
          };
          return;
        }
        
        if (this.pencilPressing) {
          return;
        }
        this.pencilPressing = true;
        this.setPencilPosition(this.hoverPoint.x, this.hoverPoint.y);
      }
    }
  }
  pointerMoveFn(e) {
    this.hoverDraw = null;
    document.documentElement.style.cursor = 'default'
    if (this.leftMouseDown) {
      this.pencilPressing = true;
    }
    if ((this.spaceBar || this.rightPressing) && this.pencilPressing && this.draging) {
      this.dragOffset['x'] = e.offsetX - this.dragDownPoint.x;
      this.dragOffset['y'] = e.offsetY - this.dragDownPoint.y;
      return;
    }
    this.hoverPoint = {
      x: e.offsetX,
      y: e.offsetY
    };
    if (this.isObserver) {
      this.hoverDraw = this.calcIsOverDraws({x:this.hoverPoint.x, y:this.hoverPoint.y});
      return;
    }
    if (!this.pencilPressing) {
      if (!this.pencilPosition) {
        const _draw = this.calcIsOverDraws({
          x: this.hoverPoint.x, 
          y: this.hoverPoint.y, 
          // filterList:{ rect: {is_stroke:true} }
        });
        if (_draw && _draw.data && !_draw.data.lock) {
          const _modify = this.calcIsOnModifyRect(this.hoverPoint.x, this.hoverPoint.y)
          document.documentElement.style.cursor = _modify || _draw ? 'move' : 'default'
        }

        if (this.selectedDraw) {
          for (let i = 0; i < this.controlDots.length; i++) {
            const _dot = this.controlDots[i];
            const _dotPath2d = this.drawModifyDot(_dot);
            if (this.sbCtx.isPointInPath(_dotPath2d, this.hoverPoint.x, this.hoverPoint.y)) {
              document.documentElement.style.cursor = _dot.cursor;
              break;
            }
          }
        }
      }
    } else {
      // console.log(this.selectedDraw)
      if (this.selectedDraw) {
        if (this.tinkerUp) {
          // console.log('调整尺寸')
          // 调整尺寸
          if (this.selectedDraw.constructor === Object) {
            this.selectedDraw['changed'] = true;
            this.adjustSize(this.selectedDraw);
          }
        } else {
          // 整体移动
          if (this.selectedDraw.constructor === Object) {
            this.selectedDraw['moved'] = true;
            this.selectedDraw['changed'] = true;
            this.drawPointsWholeMove(this.selectedDraw, this.hoverPoint.x, this.hoverPoint.y);
          }
          if (this.selectedDraw.constructor === Array) {
            this.selectedDraw.forEach(val => {
              val['changed'] = true;
              val['moved'] = true;
              this.drawPointsWholeMove(val, this.hoverPoint.x, this.hoverPoint.y);
            });
          }
        }
      } else {
        this.drawRect({x:this.hoverPoint.x, y:this.hoverPoint.y});
        this.tmpRect['fillStyle'] = 'rgba(187, 224, 255, 0.4)';
        this.tmpRect['strokeStyle'] = 'transparent';
        this.tmpRect['type'] = 'select';
        this.tmpRect['lineWidth'] = 1;
      }
      this.shouldRecord = true;
    }
  }
  pointerUpFn(e) {
    this.leftMouseDown = false;
    if (this.rightPressing) {
      this.rightPressing = false;
    }
    
    if (this.pencilPressing && this.draging) {
      this.dragOffset['x'] = e.offsetX - this.dragDownPoint.x;
      this.dragOffset['y'] = e.offsetY - this.dragDownPoint.y;
      this.draging = false;
      this.pencilPressing = false;
      return;
    }
    if (this.isObserver) {
      return;
    }
    this.hoverPoint = {
      x: e.offsetX,
      y: e.offsetY
    };
    // this.pencilPressing 代表有鼠标按着
    if (this.pencilPressing) {
      if (this.selectedDraw) {
        this.validateRect();
        this.detectDrawsIsOverSize();
        // 记录操作
        if (this.shouldRecord && this.historyRecordHandler) {
          if (this.options.recordWithLabel) {
            if (this.selectedDraw && this.selectedDraw.constructor === Object && this.selectedDraw.data.label) {
              this.historyRecordHandler.recordChange(this.getAllDraws());
            }
          } else {
            this.historyRecordHandler.recordChange(this.getAllDraws());
          }
          this.shouldRecord = false;
        }
      } else {
        if (this.tmpRect) {
          const _dx = this.tmpRect.x + this.tmpRect.width;
          if (this.tmpRect.x > _dx) {
            this.tmpRect.x = _dx;
          }
          const _dy = this.tmpRect.y + this.tmpRect.height;
          if (this.tmpRect.y > _dy) {
            this.tmpRect.y = _dy;
          }
          this.tmpRect['width'] = Math.abs(this.tmpRect.width);
          this.tmpRect['height'] = Math.abs(this.tmpRect.height);

          // 检测有哪些draw在框选框内
          this.selectedDraw = this.detectDrawsOver();
          this.tmpRect = null;
        }
      }
      this.pencilPressing = false;
      this.tinkerUp = null;
    }

    this.pencilPosition = null;

    this.sbDom.dispatchEvent(
      new CustomEvent('pointerUp', {
        bubbles: true,
        detail: {
          draw: this.selectedDraw,
          point: {
            x: e.clientX,
            y: e.clientY
          }
        }
      })
    );
  }
  // quadrangle Draw事件
  quadrangleDownFn(e, options) {
    // if (options.lockDraw) {
    //   return;
    // }
    this.hoverPoint = {
      x: e.offsetX,
      y: e.offsetY
    };
    if (e.button === 0) {
      if (this.pencilPressing) {
        return;
      }
      this.pencilPressing = true;
      this.setPencilPosition(this.hoverPoint.x, this.hoverPoint.y);
      if (this.selectedDraw) {
        this.selectedDraw['changed'] = false;
        this.selectedDraw['moved'] = false;
      }
    } else if (e.button === 2) {
      if (this.detectIsDBClick(e.timeStamp)) {
        this.zoomReset();
      } else {
        document.documentElement.style.cursor = 'grabbing';
        if (!this.draging) {
          this.rightPressing = true;
          this.pencilPressing = true;
          this.draging = true;
          this.dragDownPoint = {
            x: e.offsetX - this.dragOffset.x,
            y: e.offsetY - this.dragOffset.y
          };
          return;
        }
        
        if (this.pencilPressing) {
          return;
        }
        this.pencilPressing = true;
        this.setPencilPosition(this.hoverPoint.x, this.hoverPoint.y);
      }
    }
    this.sbDom.dispatchEvent(
      new CustomEvent('quadrangleDown', {
        bubbles: true,
        detail: {
          point: {
            x: e.clientX,
            y: e.clientY
          }
        }
      })
    );
  }
  quadrangleMoveFn(e, options) {
    this.hoverPoint = {
      x: e.offsetX,
      y: e.offsetY
    };
    if (this.pencilPressing && this.draging) {
      this.dragOffset['x'] = e.offsetX - this.dragDownPoint.x;
      this.dragOffset['y'] = e.offsetY - this.dragDownPoint.y;
      return;
    }
    
    if (!this.pencilPosition) {
      // 没有点击移动的时候
      
      if (this.selectedDraw && !this.selectedDraw.lock) {
        this.selectedDraw = null;
      }
      const _onSomeOneRectFlag = this.calcIsOverDraws({
        x: this.hoverPoint.x, 
        y: this.hoverPoint.y, 
        // filterList:{ quadrangle: {is_stroke:true} }
      });
      // const _onSomeOneRectFlag = this.calcIsOverDraw(this.hoverPoint.x,this.hoverPoint.y, false);
      
      let _cursorStyle = _onSomeOneRectFlag ? 'move' : 'crosshair';
      if (_onSomeOneRectFlag && _onSomeOneRectFlag.data ) {
        if (_onSomeOneRectFlag.data.lock) {
          _cursorStyle = 'pointer';
        } else {
          _cursorStyle = 'move'
        }
      } else {
        if (options.lockDraw) {
          _cursorStyle = 'pointer';
        } else {
          _cursorStyle = 'crosshair'
        }
      }
      document.documentElement.style.cursor = _cursorStyle
      
      if (_onSomeOneRectFlag) {
        if (!this.selectedDraw || (this.selectedDraw && !this.selectedDraw.data.lock) || (this.selectedDraw && this.selectedDraw.data.lock && (this.selectedDraw.data.id !== _onSomeOneRectFlag.data.id || (this.selectedDraw.data.id === _onSomeOneRectFlag.data.id && this.selectedDraw.pointIn !== _onSomeOneRectFlag.pointIn)))) {
          this.selectedDraw = cloneDeep(_onSomeOneRectFlag);
        }
        
        if (_onSomeOneRectFlag.data) {
          this.tinkerUp = null;
          for (let i = 0; i < this.controlDots.length; i++) {
            const _dot = this.controlDots[i];
            const _dotPath2d = this.drawModifyDot(_dot);
            if (this.sbCtx.isPointInPath(_dotPath2d, this.hoverPoint.x, this.hoverPoint.y)) {
              document.documentElement.style.cursor = _dot.cursor;
              this.tinkerUp = { code: _dot.code };
              break;
            }
          }
        }
      }
    } else {
      if (!this.pencilPressing || options.lockDraw) {
        return;
      }
      const {pencilStyle} = this.options
      const {label} = options
      if (this.selectedDraw && !this.selectedDraw.data.lock) {
        if (this.tinkerUp) {
          // console.log('调整尺寸')
          // 调整尺寸
          if (this.selectedDraw.constructor === Object) {
            this.selectedDraw['changed'] = true;
            this.adjustSize(this.selectedDraw);
          }
        } else {
          // 整体移动
          if (this.selectedDraw.constructor === Object) {
            this.selectedDraw['moved'] = true;
            this.selectedDraw['changed'] = true;
            this.drawPointsWholeMove(this.selectedDraw, this.hoverPoint.x, this.hoverPoint.y);
          }
        }
      } else {
        this.drawQuadrangle({x: this.hoverPoint.x, y:this.hoverPoint.y, label: label, strokeStyle:pencilStyle.strokeStyle, fillStyle: pencilStyle.fillStyle});
      }
    }
    this.sbDom.dispatchEvent(
      new CustomEvent('quadrangleMove', {
        bubbles: true,
        detail: {
          point: {
            x: e.clientX,
            y: e.clientY
          }
        }
      })
    );
  }
  quadrangleUpFn(e, options) {
    if (!this.pencilPressing) {
      return;
    }
    this.hoverPoint = {
      x: e.offsetX,
      y: e.offsetY
    };
    if (this.pencilPressing && this.draging) {
      this.dragOffset['x'] = e.offsetX - this.dragDownPoint.x;
      this.dragOffset['y'] = e.offsetY - this.dragDownPoint.y;
      this.draging = false;
      this.pencilPressing = false;
      this.sbDom.dispatchEvent(
        new CustomEvent('quadrangleUp', {
          bubbles: true,
          detail: {
            point: {
              x: e.clientX,
              y: e.clientY
            }
          }
        })
      );
      return;
    }
    const {pencilStyle} = this.options;
    const {label, lockDraw, drawType} = options;
    
    if (!lockDraw) { // 没有禁止画框
      if (this.selectedDraw && !this.selectedDraw.data.lock) {
        // this.validateRect();
        this.detectDrawsIsOverSize();
        if (this.selectedDraw.changed && this.historyRecordHandler) {
          this.historyRecordHandler.recordChange(this.getAllDraws());
        }
      } else {
        let someOneRect = this.drawQuadrangle({x:this.hoverPoint.x, y:this.hoverPoint.y, label:label, strokeStyle:pencilStyle.strokeStyle, fillStyle: pencilStyle.fillStyle, drawType: drawType});
        // console.log(someOneRect)
        // debugger
        // const _dx = someOneRect.x + someOneRect.width;
        // if (someOneRect.x > _dx) {
        //   someOneRect.x = _dx;
        // }
        // const _dy = someOneRect.y + someOneRect.height;
        // if (someOneRect.y > _dy) {
        //   someOneRect.y = _dy;
        // }
        someOneRect['width'] = Math.abs(someOneRect.width);
        someOneRect['height'] = Math.abs(someOneRect.height);
        someOneRect = this.detectIsOverBgSize(someOneRect)
        this.tmpPolygon = null;
        const _minSize = 5 / this.zoomSize;

        this.setDrawType('pointer', false);
        // if (someOneRect.width > _minSize && someOneRect.height > _minSize) {
          // 记录已经画的rects
          someOneRect['id'] = this.specifyDrawId ? this.specifyDrawId : this.uuidv4Short();
          this.specifyDrawId = null;
          this.originDraws.push(someOneRect);
          this.detectDrawsIsOverSize();
          this.selectedDraw = cloneDeep({
            data: this.originDraws[this.originDraws.length - 1],
            index: this.originDraws.length - 1,
            newadd: true
          });
          // 是否需要记录操作
          if (this.selectedDraw.data.label && this.historyRecordHandler) {
            this.historyRecordHandler.recordChange(this.getAllDraws());
          }
        // }
      }
    }

    this.pencilPressing = false;
    this.pencilPosition = null;

    this.sbDom.dispatchEvent(
      new CustomEvent('quadrangleUp', {
        bubbles: true,
        detail: {
          draw: this.selectedDraw,
          point: {
            x: e.clientX,
            y: e.clientY
          }
        }
      })
    );
  }
  // 圆形Draw事件
  arcDownFn(e, options) {
    this.hoverPoint = {
      x: e.offsetX,
      y: e.offsetY
    };
    if (e.button === 0) {
      if (this.pencilPressing) {
        return;
      }
      this.pencilPressing = true;
      this.setPencilPosition(this.hoverPoint.x, this.hoverPoint.y);
      if (this.selectedDraw) {
        this.selectedDraw['changed'] = false;
        this.selectedDraw['moved'] = false;
      }
    } else if (e.button === 2) {
      if (this.detectIsDBClick(e.timeStamp)) {
        this.zoomReset();
      } else {
        document.documentElement.style.cursor = 'grabbing';
        if (!this.draging) {
          this.rightPressing = true;
          this.pencilPressing = true;
          this.draging = true;
          this.dragDownPoint = {
            x: e.offsetX - this.dragOffset.x,
            y: e.offsetY - this.dragOffset.y
          };
          return;
        }
        
        if (this.pencilPressing) {
          return;
        }
        this.pencilPressing = true;
        this.setPencilPosition(this.hoverPoint.x, this.hoverPoint.y);
      }
    }
    this.sbDom.dispatchEvent(
      new CustomEvent('arcDown', {
        bubbles: true,
        detail: {
          point: {
            x: e.clientX,
            y: e.clientY
          }
        }
      })
    );
  }
  arcMoveFn(e, options) {
    this.hoverPoint = {
      x: e.offsetX,
      y: e.offsetY
    };
    if (this.pencilPressing && this.draging) {
      this.dragOffset['x'] = e.offsetX - this.dragDownPoint.x;
      this.dragOffset['y'] = e.offsetY - this.dragDownPoint.y;
      return;
    }
    if (!this.pencilPosition) {
      // 没有点击移动的时候
      if (this.selectedDraw && !this.selectedDraw.lock) {
        this.selectedDraw = null;
      }
      const _onSomeOneRectFlag = this.calcIsOverDraws({
        x: this.hoverPoint.x, 
        y: this.hoverPoint.y, 
        // filterList:{ rect: {is_stroke:false} }
      });
      // const _onSomeOneRectFlag = this.calcIsOverDraw(this.hoverPoint.x,this.hoverPoint.y, false);
      
      let _cursorStyle = _onSomeOneRectFlag ? 'move' : 'crosshair';
      if (_onSomeOneRectFlag && _onSomeOneRectFlag.data ) {
        if (_onSomeOneRectFlag.data.lock) {
          _cursorStyle = 'pointer';
        } else {
          _cursorStyle = 'move'
        }
      } else {
        if (options.lockDraw) {
          _cursorStyle = 'pointer';
        } else {
          _cursorStyle = 'crosshair'
        }
      }
      document.documentElement.style.cursor = _cursorStyle
      
      if (_onSomeOneRectFlag) {
        if (!this.selectedDraw || (this.selectedDraw && !this.selectedDraw.data.lock) || (this.selectedDraw && this.selectedDraw.data.lock && (this.selectedDraw.data.id !== _onSomeOneRectFlag.data.id || (this.selectedDraw.data.id === _onSomeOneRectFlag.data.id && this.selectedDraw.pointIn !== _onSomeOneRectFlag.pointIn)))) {
          this.selectedDraw = cloneDeep(_onSomeOneRectFlag);
        }
        
        if (_onSomeOneRectFlag.data) {
          this.tinkerUp = null;
          for (let i = 0; i < this.controlDots.length; i++) {
            const _dot = this.controlDots[i];
            const _dotPath2d = this.drawModifyDot(_dot);
            if (this.sbCtx.isPointInPath(_dotPath2d, this.hoverPoint.x, this.hoverPoint.y)) {
              document.documentElement.style.cursor = _dot.cursor;
              this.tinkerUp = { code: _dot.code };
              break;
            }
          }
        }
      }
    } else {
      if (!this.pencilPressing || options.lockDraw) {
        return;
      }
      
      if (this.selectedDraw && !this.selectedDraw.data.lock) {
        if (this.tinkerUp) {
          // console.log('调整尺寸')
          // 调整尺寸
          if (this.selectedDraw.constructor === Object) {
            this.selectedDraw['changed'] = true;
            this.adjustSize(this.selectedDraw);
          }
        } else {
          // 整体移动
          if (this.selectedDraw.constructor === Object) {
            this.selectedDraw['moved'] = true;
            this.selectedDraw['changed'] = true;
            this.drawPointsWholeMove(this.selectedDraw, this.hoverPoint.x, this.hoverPoint.y);
          }
        }
      } else {
        this.drawArc({x: this.hoverPoint.x, y:this.hoverPoint.y, label: options.label, strokeStyle:options.strokeStyle, fillStyle: options.fillStyle, drawType: 'circle'});
      }
    }
    this.sbDom.dispatchEvent(
      new CustomEvent('arcMove', {
        bubbles: true,
        detail: {
          point: {
            x: e.clientX,
            y: e.clientY
          }
        }
      })
    );
  }
  arcUpFn(e, options) {
    if (!this.pencilPressing) {
      return;
    }
    this.hoverPoint = {
      x: e.offsetX,
      y: e.offsetY
    };
    if (this.pencilPressing && this.draging) {
      this.dragOffset['x'] = e.offsetX - this.dragDownPoint.x;
      this.dragOffset['y'] = e.offsetY - this.dragDownPoint.y;
      this.draging = false;
      this.pencilPressing = false;
      this.sbDom.dispatchEvent(
        new CustomEvent('arcUp', {
          bubbles: true,
          detail: {
            point: {
              x: e.clientX,
              y: e.clientY
            }
          }
        })
      );
      return;
    }
    
    const {label, lockDraw, drawType, fillStyle, strokeStyle, id} = options;
    
    if (!lockDraw) { // 没有禁止画框
      if (this.selectedDraw && !this.selectedDraw.data.lock) {
        // this.validateRect();
        this.detectDrawsIsOverSize();
        if (this.selectedDraw.changed && this.historyRecordHandler) {
          this.historyRecordHandler.recordChange(this.getAllDraws());
        }
      } else {
        let _tmpArc = this.drawArc({x:this.hoverPoint.x, y:this.hoverPoint.y, label:label, strokeStyle:strokeStyle, fillStyle: fillStyle, drawType: drawType});
        // const _dx = _tmpArc.x + _tmpArc.radius;
        // if (_tmpArc.x > _dx) {
        //   _tmpArc.x = _dx;
        // }
        // const _dy = _tmpArc.y + _tmpArc.radius;
        // if (_tmpArc.y > _dy) {
        //   _tmpArc.y = _dy;
        // }
        _tmpArc['radius'] = _tmpArc.radius;
        // _tmpArc['height'] = Math.abs(_tmpArc.height);
        _tmpArc = this.detectIsOverBgSize(_tmpArc)
        this.tmpArc = null;
        const _minSize = 5 / this.zoomSize;
        if (Math.abs(_tmpArc.radius) > _minSize) {
          // 记录已经画的arcs
          _tmpArc['id'] = this.specifyDrawId ? this.specifyDrawId : this.uuidv4Short();
          this.specifyDrawId = null;
          this.originDraws.push(_tmpArc);
          // this.detectDrawsIsOverSize();
          this.selectedDraw = cloneDeep({
            data: this.originDraws[this.originDraws.length - 1],
            index: this.originDraws.length - 1,
            newadd: true
          });
          // 是否需要记录操作
          if (this.selectedDraw.data.label && this.historyRecordHandler) {
            this.historyRecordHandler.recordChange(this.getAllDraws());
          }
        }
      }
    }

    this.pencilPressing = false;
    this.pencilPosition = null;

    this.sbDom.dispatchEvent(
      new CustomEvent('arcUp', {
        bubbles: true,
        detail: {
          draw: this.selectedDraw,
          point: {
            x: e.clientX,
            y: e.clientY
          }
        }
      })
    );
  }
  // 矩形Draw事件
  rectDownFn(e, options) {
    // if (options.lockDraw) {
    //   return;
    // }
    this.hoverPoint = {
      x: e.offsetX,
      y: e.offsetY
    };
    if (e.button === 0) {
      if (this.pencilPressing) {
        return;
      }
      this.pencilPressing = true;
      this.setPencilPosition(this.hoverPoint.x, this.hoverPoint.y);
      if (this.selectedDraw) {
        this.selectedDraw['changed'] = false;
        this.selectedDraw['moved'] = false;
      }
    } else if (e.button === 2) {
      if (this.detectIsDBClick(e.timeStamp)) {
        this.zoomReset();
      } else {
        document.documentElement.style.cursor = 'grabbing';
        if (!this.draging) {
          this.rightPressing = true;
          this.pencilPressing = true;
          this.draging = true;
          this.dragDownPoint = {
            x: e.offsetX - this.dragOffset.x,
            y: e.offsetY - this.dragOffset.y
          };
          return;
        }
        
        if (this.pencilPressing) {
          return;
        }
        this.pencilPressing = true;
        this.setPencilPosition(this.hoverPoint.x, this.hoverPoint.y);
      }
    }
    this.sbDom.dispatchEvent(
      new CustomEvent('rectDown', {
        bubbles: true,
        detail: {
          point: {
            x: e.clientX,
            y: e.clientY
          }
        }
      })
    );
  }
  rectMoveFn(e, options) {
    this.hoverPoint = {
      x: e.offsetX,
      y: e.offsetY
    };
    if (this.pencilPressing && this.draging) {
      this.dragOffset['x'] = e.offsetX - this.dragDownPoint.x;
      this.dragOffset['y'] = e.offsetY - this.dragDownPoint.y;
      return;
    }
    if (!this.pencilPosition) {
      // 没有点击移动的时候
      if (this.selectedDraw && !this.selectedDraw.lock) {
        this.selectedDraw = null;
      }
      const _onSomeOneRectFlag = this.calcIsOverDraws({
        x: this.hoverPoint.x, 
        y: this.hoverPoint.y, 
        // filterList:{ rect: {is_stroke:false} }
      });
      // const _onSomeOneRectFlag = this.calcIsOverDraw(this.hoverPoint.x,this.hoverPoint.y, false);
      
      let _cursorStyle = _onSomeOneRectFlag ? 'move' : 'crosshair';
      if (_onSomeOneRectFlag && _onSomeOneRectFlag.data ) {
        if (_onSomeOneRectFlag.data.lock) {
          _cursorStyle = 'pointer';
        } else {
          _cursorStyle = 'move'
        }
      } else {
        if (options.lockDraw) {
          _cursorStyle = 'pointer';
        } else {
          _cursorStyle = 'crosshair'
        }
      }
      document.documentElement.style.cursor = _cursorStyle
      
      if (_onSomeOneRectFlag) {
        if (!this.selectedDraw || (this.selectedDraw && !this.selectedDraw.data.lock) || (this.selectedDraw && this.selectedDraw.data.lock && (this.selectedDraw.data.id !== _onSomeOneRectFlag.data.id || (this.selectedDraw.data.id === _onSomeOneRectFlag.data.id && this.selectedDraw.pointIn !== _onSomeOneRectFlag.pointIn)))) {
          this.selectedDraw = cloneDeep(_onSomeOneRectFlag);
        }
        
        if (_onSomeOneRectFlag.data) {
          this.tinkerUp = null;
          for (let i = 0; i < this.controlDots.length; i++) {
            const _dot = this.controlDots[i];
            const _dotPath2d = this.drawModifyDot(_dot);
            if (this.sbCtx.isPointInPath(_dotPath2d, this.hoverPoint.x, this.hoverPoint.y)) {
              document.documentElement.style.cursor = _dot.cursor;
              this.tinkerUp = { code: _dot.code };
              break;
            }
          }
        }
      }
    } else {
      if (!this.pencilPressing || options.lockDraw) {
        return;
      }
      
      if (this.selectedDraw && !this.selectedDraw.data.lock) {
        if (this.tinkerUp) {
          // console.log('调整尺寸')
          // 调整尺寸
          if (this.selectedDraw.constructor === Object) {
            this.selectedDraw['changed'] = true;
            this.adjustSize(this.selectedDraw);
          }
        } else {
          // 整体移动
          if (this.selectedDraw.constructor === Object) {
            this.selectedDraw['moved'] = true;
            this.selectedDraw['changed'] = true;
            this.drawPointsWholeMove(this.selectedDraw, this.hoverPoint.x, this.hoverPoint.y);
          }
        }
      } else {
        this.drawRect({x: this.hoverPoint.x, y:this.hoverPoint.y, label: options.label, strokeStyle:options.strokeStyle, fillStyle: options.fillStyle});
      }
    }
    this.sbDom.dispatchEvent(
      new CustomEvent('rectMove', {
        bubbles: true,
        detail: {
          point: {
            x: e.clientX,
            y: e.clientY
          }
        }
      })
    );
  }
  rectUpFn(e, options) {
    if (!this.pencilPressing) {
      return;
    }
    this.hoverPoint = {
      x: e.offsetX,
      y: e.offsetY
    };
    if (this.pencilPressing && this.draging) {
      this.dragOffset['x'] = e.offsetX - this.dragDownPoint.x;
      this.dragOffset['y'] = e.offsetY - this.dragDownPoint.y;
      this.draging = false;
      this.pencilPressing = false;
      this.sbDom.dispatchEvent(
        new CustomEvent('rectUp', {
          bubbles: true,
          detail: {
            point: {
              x: e.clientX,
              y: e.clientY
            }
          }
        })
      );
      return;
    }
    
    const {label, lockDraw, drawType, fillStyle, strokeStyle, id} = options;
    
    if (!lockDraw) { // 没有禁止画框
      if (this.selectedDraw && !this.selectedDraw.data.lock) {
        this.validateRect();
        this.detectDrawsIsOverSize();
        if (this.selectedDraw.changed && this.historyRecordHandler) {
          this.historyRecordHandler.recordChange(this.getAllDraws());
        }
      } else {
        let someOneRect = this.drawRect({x:this.hoverPoint.x, y:this.hoverPoint.y, label:label, strokeStyle:strokeStyle, fillStyle: fillStyle, drawType: drawType});
        const _dx = someOneRect.x + someOneRect.width;
        if (someOneRect.x > _dx) {
          someOneRect.x = _dx;
        }
        const _dy = someOneRect.y + someOneRect.height;
        if (someOneRect.y > _dy) {
          someOneRect.y = _dy;
        }
        someOneRect['width'] = Math.abs(someOneRect.width);
        someOneRect['height'] = Math.abs(someOneRect.height);
        someOneRect = this.detectIsOverBgSize(someOneRect)
        this.tmpRect = null;
        const _minSize = 5 / this.zoomSize;
        if (someOneRect.width > _minSize && someOneRect.height > _minSize) {
          // 记录已经画的rects
          someOneRect['id'] = this.specifyDrawId ? this.specifyDrawId : this.uuidv4Short();
          this.specifyDrawId = null;
          this.originDraws.push(someOneRect);
          this.detectDrawsIsOverSize();
          this.selectedDraw = cloneDeep({
            data: this.originDraws[this.originDraws.length - 1],
            index: this.originDraws.length - 1,
            newadd: true
          });
          // 是否需要记录操作
          if (this.selectedDraw.data.label && this.historyRecordHandler) {
            this.historyRecordHandler.recordChange(this.getAllDraws());
          }
        }
      }
    }

    this.pencilPressing = false;
    this.pencilPosition = null;

    this.sbDom.dispatchEvent(
      new CustomEvent('rectUp', {
        bubbles: true,
        detail: {
          draw: this.selectedDraw,
          point: {
            x: e.clientX,
            y: e.clientY
          }
        }
      })
    );
  }
  // 多边形填充事件
  polygonDownFn(e, options) {
    if (e.button === 0) {
      this.hoverPoint = {
        x: e.offsetX,
        y: e.offsetY
      };
      this.setPencilPosition(this.hoverPoint.x, this.hoverPoint.y);
    }
    if (e.button === 2) {
      if (this.detectIsDBClick(e.timeStamp)) {
        this.zoomReset();
      } else {
        document.documentElement.style.cursor = 'grabbing';
        if (!this.draging) {
          this.rightPressing = true;
          this.pencilPressing = true;
          this.draging = true;
          this.dragDownPoint = {
            x: e.offsetX - this.dragOffset.x,
            y: e.offsetY - this.dragOffset.y
          };
        }
      }
    }
    this.sbDom.dispatchEvent(
      new CustomEvent('polygonDown', {
        bubbles: true,
        detail: {
          point: {
            x: e.clientX,
            y: e.clientY
          }
        }
      })
    );
  }
  polygonMoveFn(e, options) {
    if ((this.spaceBar || this.rightPressing) && this.pencilPressing && this.draging) {
      this.dragOffset['x'] = e.offsetX - this.dragDownPoint.x;
      this.dragOffset['y'] = e.offsetY - this.dragDownPoint.y;
      return;
    }
    this.hoverPoint = {
      x: e.offsetX,
      y: e.offsetY
    };
    const _x = (this.hoverPoint.x - this.dragOffset.x) / this.zoomSize;
    const _y = (this.hoverPoint.y - this.dragOffset.y) / this.zoomSize;
    if (this.detectTwoPointClose(this.tmpPolygon, { x: _x, y: _y }, this.zoomSize)) {
      document.documentElement.style.cursor = 'all-scroll';
    } else {
      document.documentElement.style.cursor = 'crosshair';
    }
    this.drawPolygon({moving:true, ...options})
    this.sbDom.dispatchEvent(
      new CustomEvent('polygonMove', {
        bubbles: true,
        detail: {
          point: {
            x: e.clientX,
            y: e.clientY
          }
        }
      })
    );
  }
  polygonUpFn(e, options) {
    if (this.rightPressing) {
      this.rightPressing = false;
    }
    if (this.pencilPressing && this.draging) {
      this.dragOffset['x'] = e.offsetX - this.dragDownPoint.x;
      this.dragOffset['y'] = e.offsetY - this.dragDownPoint.y;
      this.draging = false;
      this.pencilPressing = false;
      return;
    }
    const {label, lockDraw, drawType, fillStyle, strokeStyle, id, gco} = options;
    this.hoverPoint = {
      x: e.offsetX,
      y: e.offsetY
    };
    const _x = (this.hoverPoint.x - this.dragOffset.x) / this.zoomSize;
    const _y = (this.hoverPoint.y - this.dragOffset.y) / this.zoomSize;
    if (!this.tmpPolygon) {
      this.drawPolygon(options)
    } else {
      if (this.tmpPolygon.ways.length > 1) {
        if (this.detectTwoPointClose(this.tmpPolygon, { x: _x, y: _y }, this.zoomSize)) {
          this.setDrawType('pointer', false);
          this.tmpPolygon['id'] = this.specifyDrawId ? this.specifyDrawId : this.uuidv4Short();
          this.specifyDrawId = null;
          this.tmpPolygon['closed'] = true;
          if (fillStyle) {
            this.tmpPolygon['fillStyle'] = fillStyle;
          }
          this.tmpPolygon['strokeStyle'] = strokeStyle
          
          this.detectDrawsIsOverSize();
          
          if (this.tmpPolygon.drawType === 'polygonClip') {
            this.originDraws.unshift(this.tmpPolygon);
            this.selectedDraw = cloneDeep({
              data: this.originDraws[0],
              index: 0
            });
          } else {
            this.originDraws.push(this.tmpPolygon);
            this.selectedDraw = cloneDeep({
              data: this.originDraws[this.originDraws.length - 1],
              index: this.originDraws.length - 1
            });
          }
          this.pencilPosition = null;
          this.tmpPolygon = null;

          // 记录操作
          if (this.historyRecordHandler) {
            this.historyRecordHandler.recordChange(this.getAllDraws());
          }
        } else {
          if (!this.detectTwoPointIsNearby(this.tmpPolygon, { x: _x, y: _y }, this.zoomSize)) {
            this.drawPolygon(options)
          }
        }
        this.sbDom.dispatchEvent(
          new CustomEvent('polygonUp', {
            bubbles: true,
            detail: {
              draw: this.selectedDraw,
              point: {
                x: e.clientX,
                y: e.clientY
              }
            }
          })
        );
        return;
      }
      if (!this.tmpPolygon.ways.length || !this.detectTwoPointIsNearby(this.tmpPolygon, { x: _x, y: _y }, this.zoomSize)) {
        this.drawPolygon(options)
      }
    }
    this.sbDom.dispatchEvent(
      new CustomEvent('polygonUp', {
        bubbles: true,
        detail: {
          point: {
            x: e.clientX,
            y: e.clientY
          }
        }
      })
    );
  }
  // 笔刷事件
  brushDownFn(e) {
    if (e.button === 0 && !this.pencilPressing) {
      this.hoverPoint = {
        x: e.offsetX,
        y: e.offsetY
      };
      this.pencilPressing = true;
      this.tmpPath2d = new Path2D();
      let _x = (this.hoverPoint.x - this.dragOffset.x) / this.zoomSize;
      let _y = (this.hoverPoint.y - this.dragOffset.y) / this.zoomSize;
      this.tmpPath2d.moveTo(_x, _y);
    }
    if (e.button === 2) {
      if (this.detectIsDBClick(e.timeStamp)) {
        this.zoomReset();
      } else {
        document.documentElement.style.cursor = 'grabbing';
        if (!this.draging) {
          this.rightPressing = true;
          this.pencilPressing = true;
          this.draging = true;
          this.dragDownPoint = {
            x: e.offsetX - this.dragOffset.x,
            y: e.offsetY - this.dragOffset.y
          };
        }
      }
    }
  }
  brushMoveFn(e) {
    // document.documentElement.style.cursor = 'crosshair'
    document.documentElement.style.cursor = 'none';
    if ((this.spaceBar || this.rightPressing) && this.pencilPressing && this.draging) {
      this.dragOffset['x'] = e.offsetX - this.dragDownPoint.x;
      this.dragOffset['y'] = e.offsetY - this.dragDownPoint.y;
      return;
    }
    this.hoverPoint = {
      x: e.offsetX,
      y: e.offsetY
    };
    let _x = (this.hoverPoint.x - this.dragOffset.x) / this.zoomSize;
    let _y = (this.hoverPoint.y - this.dragOffset.y) / this.zoomSize;
    this.setCursorPosition(_x, _y);
    if (this.pencilPressing) {
      if (this.tmpPath2d) {
        this.tmpPath2d.lineTo(_x, _y);
      }
    }
  }
  brushUpFn(e) {
    if (this.pencilPressing) {
      if (this.rightPressing) {
        this.rightPressing = false;
      }
      if (this.draging) {
        this.dragOffset['x'] = e.offsetX - this.dragDownPoint.x;
        this.dragOffset['y'] = e.offsetY - this.dragDownPoint.y;
        this.draging = false;
        this.pencilPressing = false;
        return;
      }
      this.hoverPoint = {
        x: e.offsetX,
        y: e.offsetY
      };
      if (this.tmpPath2d) {
        let _x = (this.hoverPoint.x - this.dragOffset.x) / this.zoomSize;
        let _y = (this.hoverPoint.y - this.dragOffset.y) / this.zoomSize;
        this.tmpPath2d.lineTo(_x, _y);
        this.originDraws.push({
          type: 'brush',
          path: this.tmpPath2d,
          lineWidth: this.options.pencilStyle.brushSize,
          strokeStyle: this.options.pencilStyle.brushColor
        });
        this.tmpPath2d = null;
        // 记录操作
        if (this.historyRecordHandler) {
          this.historyRecordHandler.recordChange(this.getAllDraws());
        }
      }
      this.pencilPressing = false;
    }
  }
  // 橡皮檫事件
  eraserDownFn(e) {
    if (e.button === 0 && !this.pencilPressing) {
      this.hoverPoint = {
        x: e.offsetX,
        y: e.offsetY
      };
      this.tmpPath2d = new Path2D();
      this.tmpPath2d.moveTo((this.hoverPoint.x - this.dragOffset.x) / this.zoomSize, (this.hoverPoint.y - this.dragOffset.y) / this.zoomSize);
      this.pencilPressing = true;
    }
    if (e.button === 2) {
      if (this.detectIsDBClick(e.timeStamp)) {
        this.zoomReset();
      } else {
        document.documentElement.style.cursor = 'grabbing';
        if (!this.draging) {
          this.rightPressing = true;
          this.pencilPressing = true;
          this.draging = true;
          this.dragDownPoint = {
            x: e.offsetX - this.dragOffset.x,
            y: e.offsetY - this.dragOffset.y
          };
        }
      }
    }
  }
  eraserMoveFn(e) {
    // document.documentElement.style.cursor = 'crosshair'
    document.documentElement.style.cursor = 'none';
    if ((this.spaceBar || this.rightPressing) && this.pencilPressing && this.draging) {
      this.dragOffset['x'] = e.offsetX - this.dragDownPoint.x;
      this.dragOffset['y'] = e.offsetY - this.dragDownPoint.y;
      return;
    }
    this.hoverPoint = {
      x: e.offsetX,
      y: e.offsetY
    };
    let _x = (this.hoverPoint.x - this.dragOffset.x) / this.zoomSize;
    let _y = (this.hoverPoint.y - this.dragOffset.y) / this.zoomSize;
    this.setCursorPosition(_x, _y);
    if (this.pencilPressing && this.tmpPath2d) {
      this.tmpPath2d.lineTo(_x, _y);
    }
  }
  eraserUpFn(e) {
    if (this.pencilPressing) {
      if (this.rightPressing) {
        this.rightPressing = false;
      }
      if (this.draging) {
        this.dragOffset['x'] = e.offsetX - this.dragDownPoint.x;
        this.dragOffset['y'] = e.offsetY - this.dragDownPoint.y;
        this.draging = false;
        this.pencilPressing = false;
        return;
      }
      if (this.tmpPath2d) {
        this.originDraws.push({
          type: 'eraser',
          path: this.tmpPath2d,
          lineWidth: this.options.pencilStyle.eraserSize
        });
        let _x = (this.hoverPoint.x - this.dragOffset.x) / this.zoomSize;
        let _y = (this.hoverPoint.y - this.dragOffset.y) / this.zoomSize;
        this.tmpPath2d.lineTo(_x, _y);
        this.tmpPath2d = null;
        // 记录操作
        if (this.historyRecordHandler) {
          this.historyRecordHandler.recordChange(this.getAllDraws());
        }
      }
      this.pencilPressing = false;
    }
  }
  // 设定画笔点击坐标
  setPencilPosition(x, y) {
    this.pencilPosition = {
      x: Number(x),
      y: Number(y)
    };
  }
  // 检测有哪些draw在框选框内
  detectDrawsOver() {
    let tmp_selectedDraw = [];
    if (this.tmpRect && this.originDraws && this.originDraws.constructor === Array && this.originDraws.length) {
      this.originDraws.forEach((val, index) => {
        if (!val.lock) {
          if (val.type === 'rect') {
            if (val.x >= this.tmpRect.x && this.tmpRect.x + this.tmpRect.width >= val.x + val.width && val.y >= this.tmpRect.y && this.tmpRect.y + this.tmpRect.height >= val.y + val.height) {
              tmp_selectedDraw.push({ data: val, index: index });
            }
          }
          if (val.type === 'polygon') {
            const _modifyRect = this.findOut4Poles(val, true);
            if (_modifyRect.x >= this.tmpRect.x && this.tmpRect.x + this.tmpRect.width >= _modifyRect.x + _modifyRect.width && _modifyRect.y >= this.tmpRect.y && this.tmpRect.y + this.tmpRect.height >= _modifyRect.y + _modifyRect.height) {
              tmp_selectedDraw.push({ data: val, index: index });
            }
          }
        }
      });
    }
    if (tmp_selectedDraw.length) {
      if (tmp_selectedDraw.length === 1) {
        tmp_selectedDraw = tmp_selectedDraw[0];
      }
      return cloneDeep(tmp_selectedDraw);
    } else {
      return null;
    }
  }
  // 导出draws数据
  exportDrawsData() {
    return this.originDraws.filter(val => {
      // if (val.type !== 'brush' && val.type !== 'eraser') {
      val['x'] = this.normalFloat(val.x);
      val['y'] = this.normalFloat(val.y);
      val['width'] = val.width ? this.normalFloat(val.width) : undefined;
      val['height'] = val.height ? this.normalFloat(val.height) : undefined;
      if (val.ways) {
        val.ways.forEach(wval => {
          wval['x'] = this.normalFloat(wval.x);
          wval['y'] = this.normalFloat(wval.y);
        });
      }
      return val;
      // }
    });
  }
  // 获取起点与终点之间的尺寸
  getDeltaSize(x, y) {
    let _deltas = {
      width: (x - this.pencilPosition.x) / this.zoomSize,
      height: (y - this.pencilPosition.y) / this.zoomSize
    };
    return _deltas;
  }
  // 调整框框插件
  adjustmentAddon(item, gap = 0) {
    switch (item.type) {
      case 'modifyRect':
        this.controlDots = [
          {
            x: item.x - gap,
            y: item.y - gap,
            cursor: 'nwse-resize',
            code: 'tl'
          },
          {
            x: item.x + item.width + gap,
            y: item.y - gap,
            cursor: 'nesw-resize',
            code: 'tr'
          },
          {
            x: item.x + item.width + gap,
            y: item.y + item.height + gap,
            cursor: 'nwse-resize',
            code: 'br'
          },
          {
            x: item.x - gap,
            y: item.y + item.height + gap,
            cursor: 'nesw-resize',
            code: 'bl'
          }
        ];
        break;
      case 'rect':
        this.controlDots = [
          {
            x: item.x - gap,
            y: item.y - gap,
            cursor: 'nwse-resize',
            code: 'tl'
          },
          {
            x: item.x + (item.width + gap) / 2,
            y: item.y - gap,
            cursor: 'ns-resize',
            code: 'tm'
          },
          {
            x: item.x + item.width + gap,
            y: item.y - gap,
            cursor: 'nesw-resize',
            code: 'tr'
          },
          {
            x: item.x + item.width + gap,
            y: item.y + (item.height + gap) / 2,
            cursor: 'ew-resize',
            code: 'rm'
          },
          {
            x: item.x + item.width + gap,
            y: item.y + item.height + gap,
            cursor: 'nwse-resize',
            code: 'br'
          },
          {
            x: item.x + (item.width + gap) / 2,
            y: item.y + item.height + gap,
            cursor: 'ns-resize',
            code: 'bm'
          },
          {
            x: item.x - gap,
            y: item.y + item.height + gap,
            cursor: 'nesw-resize',
            code: 'bl'
          },
          {
            x: item.x - gap,
            y: item.y + (item.height + gap) / 2,
            cursor: 'ew-resize',
            code: 'lm'
          }
        ];
        break;
      case 'quadrangle':
        this.controlDots = [
          {
            x: item.x,
            y: item.y,
            cursor: 'ns-resize',
            code: 'qlt'
          }
        ];
        if (item.ways) {
          item.ways.forEach((val, index) => {
            let _pp = 'qrt';
            if (index === 1) {
              _pp = 'qrb'
            } else if(index === 2) {
              _pp = 'qlb'
            }
            this.controlDots.push({
              x: val.x,
              y: val.y,
              cursor: 'ns-resize',
              code: _pp,
              wayIndex: index
            });
          });
        }
        break;
      case 'polygon':
        this.controlDots = [
          {
            x: item.x,
            y: item.y,
            cursor: 'ns-resize',
            code: 'pp'
          }
        ];
        if (item.ways) {
          item.ways.forEach((val, index) => {
            this.controlDots.push({
              x: val.x,
              y: val.y,
              cursor: 'ns-resize',
              code: `pp`,
              wayIndex: index
            });
          });
        }
        break;
    }
    
    // if (item.drawType === 'polygonClip') {
    //   this.setPencilStyle({
    //     ctx: this.sbCtx,
    //     gco: 'source-over',
    //     fillStyle: 'transparent', 
    //     lineWidth: item.lineWidth,
    //     strokeStyle: item.strokeStyle
    //   });
    //   this.sbCtx.beginPath();
    //   this.sbCtx.moveTo(item.x, item.y);
    //   item.ways.forEach(wval => {
    //     this.sbCtx.lineTo(wval.x, wval.y);
    //   });
    //   this.sbCtx.closePath();
    // }

    const {fillStyle, strokeStyle} = this.options.adjustDotStyle;
    this.setPencilStyle({
      ctx: this.sbCtx,
      strokeStyle,
      fillStyle,
      lineWidth: this.options.pencilStyle.lineWidth
    })
    this.controlDots.forEach(val => {
      const circle = this.drawModifyDot(val);
      // const ring = this.drawModifyDot(val);
      // this.sbCtx.globalCompositeOperation = 'source-over';
      this.sbCtx.lineWidth = this.options.adjustDotStyle.lineWidth*0.6
      this.sbCtx.fill(circle);
      this.sbCtx.stroke(circle);
    });
  }
  // 初始化画笔样式
  setCtxStyle(ctx, stroke, size, fill, lineJoin) {
    // this.sbCtx.setLineDash([]);
    ctx.lineJoin = lineJoin !== undefined ? lineJoin : 'bevel';
    ctx.strokeStyle = stroke !== undefined ? stroke : this.options.pencilStyle.strokeStyle;
    ctx.lineWidth = (size !== undefined ? size : this.options.pencilStyle.lineWidth) / this.zoomSize;
    ctx.fillStyle = fill !== undefined ? fill : 'transparent';
  }
  // 设定Ctx样式，替换setCtxStyle用
  setPencilStyle({ drawType, ctx, strokeStyle, lineDash=[], lineWidth, fillStyle, lineJoin, lineCap, gco='source-over', rotate=0 }) {
    ctx.rotate(rotate* Math.PI / 180)
    ctx.setLineDash(lineDash);
    ctx.globalCompositeOperation = gco;
    const _style = this.mergeDeep({
      strokeStyle: 'black', 
      lineWidth: 3, 
      fillStyle: 'transparent', 
      lineJoin: 'bevel',
      lineCap: 'square'
    }, {strokeStyle, lineWidth, fillStyle, lineJoin, lineCap})
    ctx.lineJoin = _style.lineJoin || this.options.pencilStyle.lineJoin;
    ctx.strokeStyle = _style.strokeStyle || this.options.pencilStyle.strokeStyle;
    ctx.lineWidth = _style.lineWidth || this.options.pencilStyle.lineWidth
    
    let _fillStyle = _style.fillStyle || this.options.pencilStyle.fillStyle
    // if (drawType === 'polygonClip') {
    //   console.log(_style.fillStyle, this.options.pencilStyle.fillStyle)
    // }
    ctx.fillStyle = _fillStyle
  }
  setBrushStyle(size, color) {
    if (size) {
      this.options.pencilStyle['brushSize'] = size;
    }
    if (color) {
      this.options.pencilStyle['brushColor'] = color;
    }
  }
  // 检测是否框框大小超出背景图大小
  detectIsOverBgSize(item){
    let edgeLength = Math.max(this.bgObj.width,this.bgObj.height);
    let offsetX = (edgeLength - this.bgObj.width)/2;
    let offsetY = (edgeLength - this.bgObj.height)/2;
    // const _finalWidth = this.bgObj.width;
    // const _finalHeight = this.bgObj.height; 
    const _finalWidth = edgeLength;
    const _finalHeight = edgeLength; 


    let _item = cloneDeep(item)
    if (this.bgObj.success && this.bgObj.data) {
      if (_item.width > _finalWidth) {
        _item.width = _finalWidth
        _item.x = 0;
      } else {
        if (_item.x+_item.width - offsetX  > _finalWidth) {
          _item.width = _finalWidth - _item.x + offsetX
        }
      }
      if (_item.height > _finalHeight) {
        _item.height = _finalHeight
        _item.y = 0;
      } else {
        if (_item.y+_item.height - offsetY > _finalHeight) {
          _item.height = _finalHeight - _item.y + offsetY
        }
      }
    }
    return _item;
  }
  // 设置draws数据(外部接口)
  setDrawsData(data, record = true) {
    if (data && data.constructor === Array ) {
      this.selectedDraw = null;
      this.originDraws = data;
      // 重置zIndex
      // this.originDraws.forEach((val, vIndex) => {
      //   val['zIndex'] = vIndex+1
      // })
      if (record && this.historyRecordHandler) {
        this.historyRecordHandler.recordChange(this.getAllDraws());
      }
    }
  }
  // 绘制标签
  labelRect(rect, zoomSize = 1, ctx) {
    const _ctx = ctx ? ctx : this.sbCtx;
    let _finalText = rect.label.constructor === Array ? rect.label.join(',') : rect.label;
    if (_finalText) {
      _ctx.fillStyle = rect.strokeStyle || this.options.pencilStyle.strokeStyle;
      const _fontSize = this.options?.pencilStyle?.fontSize || 14;
      const _height = (_fontSize + 4) / zoomSize;
      const _fontOriginSize = Math.floor(_fontSize / zoomSize);
      const _paddingLeft = 2 / zoomSize;
      const _y = rect.y + _fontSize / zoomSize;
      let _x = 0;
      let _width = 0;
      if (rect.width) {
        _width = rect.width < Math.floor(50 / zoomSize) ? rect.width :  Math.floor(rect.width / 2)
        _x = rect.width <  Math.floor(50 / zoomSize) ? rect.x : rect.x + _width
        // const fontWidth = Math.floor(_ctx.measureText(_finalText).width/ zoomSize); // 文字的宽度
        // const width_array = [fontWidth, Math.floor(rect.width / 2 / zoomSize)];
        // _width = Math.max(...width_array);
        // _x = rect.x + rect.width - _width;
        const _fx = _x + _paddingLeft;
        _ctx.fillRect(_x, rect.y, _width, _height);
        _ctx.font = `${_fontOriginSize}px ${this.options.fontFamily}`;
        _ctx.fillStyle = '#fff';
        _ctx.fillText(this.fittingString(_ctx, _finalText, _width - _paddingLeft), _fx, _y);
      } else if (!rect.width) {
        const _strWidth = _ctx.measureText(_finalText).width;
        _width = _strWidth + 6 / zoomSize;
        _x = rect.x;
        const _fx = _x + _paddingLeft;
        _ctx.fillRect(_x, rect.y, _width, _height);
        _ctx.font = `${_fontOriginSize}px ${this.options.fontFamily}`;
        _ctx.fillStyle = '#fff';
        _ctx.fillText(_finalText, _fx, _y);
      }
      const _coordinate = {
        x: _x,
        y: rect.y,
        width: _width,
        height: _height
      };
      return _coordinate;
    } else {
      return null;
    }
  }
  // 在Draw外绘制标签
  labelOutsideDraw(rect, zoomSize = 1, isObserver) {
    if (rect.label && isObserver) {
      this.sbCtx.fillStyle = rect.strokeStyle || this.options.pencilStyle.strokeStyle;
      const _fontSize = 18;
      const _height = (_fontSize + 6) / zoomSize;
      const _fontOriginSize = _fontSize / zoomSize;
      const _strWidth = this.sbCtx.measureText(rect.label).width + 6 / zoomSize;
      const _x = rect.x <= 0 ? 0 : rect.x - 3 / zoomSize;
      const _paddingLeft = 2 / zoomSize;
      const _fx = _x + _paddingLeft;
      const _y = rect.y - _height + _fontSize / zoomSize;
      this.sbCtx.fillRect(_x, rect.y - _height, _strWidth, _height);

      this.sbCtx.font = `${_fontOriginSize}px ${this.options.fontFamily}`;
      this.sbCtx.fillStyle = '#fff';
      this.sbCtx.fillText(rect.label, _fx, _y);
    }
  }
  // 重组显示文字
  fittingString(_ctx, str, maxWidth) {
    let strWidth = _ctx.measureText(str).width;
    const ellipsis = '...';
    const ellipsisWidth = _ctx.measureText(ellipsis).width;
    if (strWidth < maxWidth) {
      return str;
    } else {
      let len = str.length;
      while (strWidth >= maxWidth - ellipsisWidth && len-- > 0) {
        str = str.slice(0, len);
        strWidth = _ctx.measureText(str).width;
      }
      return str + ellipsis;
    }
  }
  // 渲染单个draw
  renderSingleOriginDraws(ctx, val) {
    ctx.setLineDash([0]);
    switch (val.type) {
      case 'arc':
        this.setPencilStyle({
          ctx,
          strokeStyle: val.strokeStyle,
          lineWidth: val.lineWidth,
          fillStyle: val.fillStyle,
          gco: val.gco || 'source-over'
        })
        ctx.beginPath();
        ctx.arc(val.x, val.y, Math.abs(val?.radius)||3, val.startAngle||0, val.endAngle||2*Math.PI, val.anticlockwise||false);
        if (val.fillStyle) {
          ctx.fill()
        }
        ctx.stroke()
        if (val.label) {
          this.labelRect(val, this.zoomSize);
        }
        break;
      case 'rect':
        if (val.drawType && val.drawType.match(/clip/gi)) {
          if (this.bgObj) {
            this.setPencilStyle({
              ctx,
              fillStyle: 'rgba(0, 0, 0, .6)',
              gco: 'source-over'
            });
            ctx.fillRect(0, 0, this.bgObj.width, this.bgObj.height);
          }
          this.setPencilStyle({
            ctx,
            gco: 'source-over',
            fillStyle: 'transparent', 
            lineWidth: val.lineWidth,
            strokeStyle: val.strokeStyle
          });
          ctx.strokeRect(val.x, val.y, val.width, val.height);
          this.setPencilStyle({
            ctx,
            gco: 'destination-out',
          });
          ctx.fillRect(val.x, val.y, val.width, val.height)
        } else {
          this.setPencilStyle({
            ctx,
            strokeStyle: val.strokeStyle, 
            lineWidth: val.lineWidth,
            fillStyle: val.fillStyle,
            gco: val.gco ? val.gco : 'source-over'
          })
          if (val.fillStyle) {
            ctx.fillRect(val.x, val.y, val.width, val.height)
          }
          ctx.strokeRect(val.x, val.y, val.width, val.height);
          if (val.label) {
            this.labelRect(val, this.zoomSize);
          }
        }
        break;
      case 'polygon':
        if (val.drawType === 'polygonClip') {
          if (this.bgObj) {
            this.setPencilStyle({
              ctx,
              fillStyle: 'rgba(0, 0, 0, .6)',
              gco: 'source-over'
            });
            ctx.fillRect(0, 0, this.bgObj.width, this.bgObj.height);
          }

          this.setPencilStyle({
            ctx,
            gco: 'source-over',
            fillStyle: 'transparent', 
            lineWidth: val.lineWidth,
            strokeStyle: val.strokeStyle
          });
          ctx.beginPath();
          ctx.moveTo(val.x, val.y);
          val.ways.forEach(wval => {
            ctx.lineTo(wval.x, wval.y);
          });
          ctx.closePath();
          ctx.stroke();

          this.setPencilStyle({
            ctx,
            gco: 'destination-out',
          });
          ctx.beginPath();
          ctx.moveTo(val.x, val.y);
          val.ways.forEach(wval => {
            ctx.lineTo(wval.x, wval.y);
          });
          ctx.closePath();
          ctx.fill();
          
        } else {
          ctx.globalCompositeOperation = val.gco ? val.gco : 'source-over';
          if (val.label) {
            this.labelRect(val, this.zoomSize);
          }
          ctx.beginPath();
          ctx.moveTo(val.x, val.y);
          val.ways.forEach(wval => {
            ctx.lineTo(wval.x, wval.y);
          });
          ctx.closePath();
          if (val.fillStyle) {
            this.setCtxStyle(ctx, val.fillStyle, val.lineWidth, val.fillStyle);
            ctx.fill();
          } else {
            this.setCtxStyle(ctx, val.strokeStyle, val.lineWidth);
            ctx.stroke();
          }
        }
        break;
      case 'eraser':
        // this.setPencilStyle({ 
        //   ctx: ctx, 
        //   lineCap: 'square',
        //   lineJoin: 'miter',
        //   strokeStyle: '#fff', 
        //   lineWidth: val.lineWidth, 
        //   fillStyle: undefined,
        //   gco: 'destination-out'
        // })
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = '#fff';
        ctx.lineCap = 'square';
        ctx.lineJoin = 'miter';
        ctx.lineWidth = val.lineWidth;
        ctx.stroke(val.path);
        ctx.globalCompositeOperation = 'source-over';
        break;
      case 'brush':
        ctx.globalCompositeOperation = 'xor';
        ctx.lineCap = 'square';
        ctx.lineJoin = 'miter';
        ctx.lineWidth = val.lineWidth;
        ctx.strokeStyle = val.strokeStyle;
        ctx.stroke(val.path);
        break;
    }
  }
  // 绘制画面
  renderBoard() {
    this.clearWhole(false);
    this.sbCtx.setTransform(1, 0, 0, 1, 0, 0);
    // 默认状态
    this.sbCtx.globalCompositeOperation = 'source-over';
    if (this.loadingImg) {
      this.zoomSize = 1;
      this.sbCtx.scale(this.zoomSize, this.zoomSize);
      this.renderLoading()
    } else {
      this.sbCtx.scale(this.zoomSize, this.zoomSize);
      this.sbCtx.translate(this.dragOffset.x / this.zoomSize, this.dragOffset.y / this.zoomSize);
      // 添加已有brush
      if (this.existBrushObj && this.existBrushObj.success) {
        this.sbCtx.drawImage(this.existBrushObj.data, 0, 0);
      }

      // 已有draws
      if (this.isObserver && this.hoverDraw) {
        const _draw = this.hoverDraw.data;
        this.renderSingleOriginDraws(this.sbCtx, _draw);
      } else {
        if (this.originDraws && this.originDraws.length) {
          this.originDraws.forEach(val => {
            this.renderSingleOriginDraws(this.sbCtx, val);
          });
        }
      }

      // 临时笔刷
      if (this.tmpPath2d) {
        if (this.drawType === 'eraser') {
          this.sbCtx.globalCompositeOperation = 'destination-out';
          this.sbCtx.lineWidth = this.options.pencilStyle.eraserSize;
          this.sbCtx.strokeStyle = '#fff';
          this.sbCtx.stroke(this.tmpPath2d);
        }
        if (this.drawType === 'brush') {
          this.sbCtx.globalCompositeOperation = 'xor';
          this.sbCtx.lineWidth = this.options.pencilStyle.brushSize;
          this.sbCtx.strokeStyle = this.options.pencilStyle.brushColor;
          this.sbCtx.stroke(this.tmpPath2d);
        }
      }

      // 临时矩形
      if (this.tmpRect) {
        const _tmpRect = new Path2D();
        _tmpRect.rect(this.tmpRect.x, this.tmpRect.y, this.tmpRect.width, this.tmpRect.height);
        // this.setCtxStyle(this.sbCtx, this.tmpRect.strokeStyle, this.tmpRect.lineWidth, this.tmpRect.fillStyle);
        this.setPencilStyle({ 
          ctx: this.sbCtx, 
          strokeStyle: this.tmpRect.strokeStyle, 
          lineWidth: this.tmpRect.lineWidth, 
          fillStyle: this.tmpRect.fillStyle,
          gco:'source-over' 
        })
        if (this.tmpRect.fillStyle) {
          this.sbCtx.fill(_tmpRect);
        }
        this.sbCtx.stroke(_tmpRect);
      }
      // 临时圆形
      if (this.tmpArc) {
        const _tmpArc = new Path2D();
        _tmpArc.arc(this.tmpArc.x, this.tmpArc.y, Math.abs(this.tmpArc.radius), 0, 2 * Math.PI);
        this.setPencilStyle({ 
          ctx: this.sbCtx, 
          strokeStyle: this.tmpArc.strokeStyle, 
          lineWidth: this.tmpArc.lineWidth, 
          fillStyle: this.tmpArc.fillStyle,
          gco:'source-over' 
        })
        if (this.tmpArc.fillStyle) {
          this.sbCtx.fill(_tmpArc);
        }
        this.sbCtx.stroke(_tmpArc);
      }
      // 临时多边形
      if (this.tmpPolygon) {
        this.setPencilStyle({
          ctx: this.sbCtx,
          strokeStyle: this.tmpPolygon.strokeStyle,
          lineWidth: this.tmpPolygon.lineWidth,
          fillStyle: this.tmpPolygon.fillStyle
        })
        this.sbCtx.beginPath();
        this.sbCtx.moveTo(this.tmpPolygon.x, this.tmpPolygon.y);
        this.tmpPolygon.ways.forEach(val => {
          this.sbCtx.lineTo(val.x, val.y);
        });
        if (this.tmpPolygon.closed) {
          this.sbCtx.closePath();
        } else {
          this.sbCtx.lineTo((this.hoverPoint.x - this.dragOffset.x) / this.zoomSize, (this.hoverPoint.y - this.dragOffset.y) / this.zoomSize);
        }
        this.sbCtx.stroke();
      }
      // 已选中的Draw，加入可控制点
      if (this.selectedDraw) {
        if (this.selectedDraw.constructor === Object) {
          const item = this.originDraws[this.selectedDraw.index];
          if (item && !item.lock) {
            this.adjustmentAddon(item);
          }
        }
        if (this.selectedDraw.constructor === Array) {
          this.drawOutsideAddon();
        }
      }
      // this.scrollbarSystem()
      // 渲染拼接图
      this.renderSpliceBackground(this.sbCtx)
      // 渲染背景图
      this.renderBackground(this.sbCtx);
      this.renderCursor(this.sbCtx);
    }
    
    this.animationFrameId = window.requestAnimationFrame(() => this.renderBoard());
  }
  // 渲染拼接图
  renderSpliceBackground(ctx) {
    if (this.spliceBgList && this.spliceBgList.length) {
      this.spliceBgList.forEach(val => {
        ctx.globalCompositeOperation = 'destination-over';
        if (val.success && val.data) {
          ctx.drawImage(val.data, val.offsetX, val.offsetY);
        }
      })
    }
  }
  // 渲染背景图
  renderBackground(ctx) {
    if (this.bgObj) {
      ctx.globalCompositeOperation = 'destination-over';
      if (this.bgObj.success && this.bgObj.data) {
        ctx.save();
        const _center = {
          x: Math.floor(this.bgObj.width/2),
          y: Math.floor(this.bgObj.height/2)
        }
        ctx.translate(_center.x, _center.y)
        ctx.rotate(this.bgObj.degree * Math.PI /180)
        ctx.translate(-_center.x, -_center.y)
        
        ctx.drawImage(this.bgObj.data, 0, 0);
        ctx.restore();
      } else {
        ctx.fillStyle = this.bgObj.fillStyle;
        ctx.fillRect(0, 0, this.bgObj.width, this.bgObj.height);
      }
    }
  }
  // 光标渲染
  renderCursor(ctx) {
    const _draw = this.cursorDraw;
    if (_draw) {
      ctx.globalCompositeOperation = 'source-over';
      this.setCtxStyle(ctx, _draw.strokeStyle, _draw.lineWidth, _draw.fillStyle);
      ctx.fillRect(_draw.x, _draw.y, _draw.width, _draw.height);
    }
  }
  // 导出图片
  exportPic(options) {
    this.setDrawType('pointer');
    const _options = this.mergeDeep(
      {},
      {
        type: 'origin', // draws, fusion, algorithm, leiLine-algorithm
        quality: 1,
        // width: this.sbDom.width,
        // height: this.sbDom.height,
        file: {
          name: 'exportPicture.png',
          options: {
            type: 'image/png'
          }
        },
        zoomSize: this.zoomSize,
      },
      options
    );
    
    return new Promise(resolve => {
      try {
        const _canvas = document.createElement('canvas');
        const _width = this.bgObj ? this.bgObj.width : this.sbDom.width;
        const _height = this.bgObj ? this.bgObj.height : this.sbDom.height;
        const _zoomSize = _options.zoomSize
        
        _canvas.width = _width;
        _canvas.height = _height;
        const _canvasCtx = _canvas.getContext('2d');
        
        if (this.existBrushObj && this.existBrushObj.success && _options.type !== 'origin') {
          _canvasCtx.drawImage(this.existBrushObj.data, 0, 0);
        }
        
        if (_options.type === 'draws' || _options.type === 'fusion') {
          this.originDraws.forEach(val => {
            switch (val.type) {
              case 'rect':
                const _lineWidth = val.lineWidth ? Math.floor(val.lineWidth/_zoomSize) : Math.floor(this.options.pencilStyle.lineWidth/_zoomSize)
                const _strokeStyle = val.strokeStyle ? val.strokeStyle : this.options.pencilStyle.strokeStyle;
                _canvasCtx.lineWidth = _lineWidth
                _canvasCtx.globalCompositeOperation = 'source-over';
                _canvasCtx.strokeStyle = _strokeStyle
                if (val.fillStyle) {
                  _canvasCtx.fillStyle = val.fillStyle
                  _canvasCtx.fillRect(val.x, val.y, val.width, val.height);  
                }
                _canvasCtx.strokeRect(val.x, val.y, val.width, val.height);
                if (val.label) {
                  this.labelRect(val, _zoomSize, _canvasCtx);
                }
                break;
              case 'arc':
                const _arcLineWidth = val.lineWidth ? Math.floor(val.lineWidth/_zoomSize) : Math.floor(this.options.pencilStyle.lineWidth/_zoomSize)
                const _arcStrokeStyle = val.strokeStyle ? val.strokeStyle : this.options.pencilStyle.strokeStyle;
                _canvasCtx.lineWidth = _arcLineWidth
                _canvasCtx.globalCompositeOperation = 'source-over';
                _canvasCtx.strokeStyle = _arcStrokeStyle
                _canvasCtx.beginPath();
                _canvasCtx.arc(val.x, val.y, Math.abs(val?.radius)||3, val?.startAngle||0, val?.endAngle||2*Math.PI, val?.anticlockwise||false);
                _canvasCtx.stroke()
                break;
              case 'eraser':
                _canvasCtx.globalCompositeOperation = 'destination-out';
                _canvasCtx.lineCap = 'square';
                _canvasCtx.lineJoin = 'miter';
                _canvasCtx.strokeStyle = '#fff';
                _canvasCtx.lineWidth = val.lineWidth;
                _canvasCtx.stroke(val.path);
                _canvasCtx.globalCompositeOperation = 'source-over';
                break;
              case 'brush':
                _canvasCtx.globalCompositeOperation = 'xor';
                _canvasCtx.lineWidth = val.lineWidth;
                _canvasCtx.lineCap = 'square';
                _canvasCtx.lineJoin = 'miter';
                _canvasCtx.strokeStyle = val.strokeStyle;
                _canvasCtx.stroke(val.path);
                break;
              case 'polygon':
                if (val.drawType === 'polygonClip') {
                  this.setPencilStyle({
                    ctx:_canvasCtx,
                    fillStyle: 'black',
                    gco: 'source-over'
                  });
                  _canvasCtx.fillRect(0, 0, this.bgObj.width, this.bgObj.height);
                  this.setPencilStyle({
                    ctx:_canvasCtx,
                    gco: 'destination-out'
                  });
                  _canvasCtx.beginPath();
                  _canvasCtx.moveTo(val.x, val.y);
                  val.ways.forEach(wval => {
                    _canvasCtx.lineTo(wval.x, wval.y);
                  });
                  _canvasCtx.closePath();
                  _canvasCtx.fill();
                } else {
                  _canvasCtx.globalCompositeOperation = val.gco ? val.gco : 'source-over';
                  _canvasCtx.beginPath();
                  _canvasCtx.moveTo(val.x, val.y);
                  val.ways.forEach(wval => {
                    _canvasCtx.lineTo(wval.x, wval.y);
                  });
                  _canvasCtx.closePath();
                  _canvasCtx.lineWidth = val.lineWidth;
                  if (val.fillStyle) {
                    _canvasCtx.fillStyle = val.fillStyle;
                    _canvasCtx.fill();
                  } else {
                    _canvasCtx.strokeStyle = val.strokeStyle;
                    _canvasCtx.stroke();
                  }
                }
                break;
            }
          });
        }
        if (_options.type === 'polygonClip') {
          this.originDraws.forEach(val => {
            switch (val.drawType) {
              case 'polygonClip':
                this.setPencilStyle({
                  ctx:_canvasCtx,
                  fillStyle: 'black',
                  gco: 'source-over'
                });
                _canvasCtx.fillRect(0, 0, this.bgObj.width, this.bgObj.height);
                this.setPencilStyle({
                  ctx:_canvasCtx,
                  gco: 'destination-out'
                });
                _canvasCtx.beginPath();
                _canvasCtx.moveTo(val.x, val.y);
                val.ways.forEach(wval => {
                  _canvasCtx.lineTo(wval.x, wval.y);
                });
                _canvasCtx.closePath();
                _canvasCtx.fill();
                break;
            }
          })
        }
        if (_options.type === 'splice' && this.spliceBgList && this.spliceBgList.length) {
          const _lastChild = this.spliceBgList[this.spliceBgList.length - 1]
          const _finalWidth = _lastChild.offsetX + _lastChild.width;
          const _finalHeight = _lastChild.offsetY+_lastChild.height;
          const _zoomSize = _options.zoomSize ? _options.zoomSize : 0.5
          _canvas.width = _finalWidth*_zoomSize
          _canvas.height = _finalHeight*_zoomSize
          _canvasCtx.setTransform(1, 0, 0, 1, 0, 0);
          _canvasCtx.scale(_zoomSize, _zoomSize);
          _canvasCtx.translate(0, 0);
          this.spliceBgList.forEach(val => {
            _canvasCtx.globalCompositeOperation = 'destination-over';
            if (val.success && val.data) {
              _canvasCtx.drawImage(val.data, val.offsetX, val.offsetY);
            }
          })
          _canvas.toBlob((blob) => {
            if (blob) {
              resolve({
                success: true,
                data: this.blobToFile(blob, _options.file.name, _options.file.options),
                message: 'export pic file success'
              });
            } else {
              resolve({
                success: false,
                data: null,
                message: 'export pic file failure [oversize]'
              });
            }
          });
        }
        if (['origin', 'fusion', 'polygonClip'].includes(_options.type)) {
          // 导出只有底图的图片
          if (this.bgObj) {
            _canvasCtx.globalCompositeOperation = 'destination-over';
            if (this.bgObj.data) {
              _canvasCtx.save();
              const _center = {
                x: Math.floor(this.bgObj.width/2),
                y: Math.floor(this.bgObj.height/2)
              }
              _canvasCtx.translate(_center.x, _center.y)
              _canvasCtx.rotate(this.bgObj.degree * Math.PI /180)
              _canvasCtx.translate(-_center.x, -_center.y)
              
              _canvasCtx.drawImage(this.bgObj.data, 0, 0, _width, _height);
              _canvasCtx.restore();
            } else {
              _canvasCtx.fillStyle = this.bgObj.fillStyle;
              _canvasCtx.fillRect(0, 0, this.bgObj.width, this.bgObj.height);
            }
          }
          const _img = _canvas.toDataURL('image/png', _options.quality);
          
          if (_img) {
            if (_options.buffer) {
              const imageData = _canvasCtx.getImageData(0, 0, this.bgObj.width, this.bgObj.height);
              const data = imageData.data;
              let buffer = new ArrayBuffer(data.length);
              let binary = new Uint8Array(buffer);
              for (let i=0; i<binary.length; i++) {
                binary[i] = data[i];
              }
              resolve({
                success: true,
                data: binary,
                message: 'export pic buffer success'
              })
            }
            if (_options.file) {
              resolve({
                success: true,
                data: this.blobToFile(this.b64toBlob(_img), _options.file.name, _options.file.options),
                message: 'export pic file success'
              })
              
              // _canvas.toBlob((blob) => {
              //   console.log(blob)
              //   resolve({
              //     success: true,
              //     data: this.blobToFile(blob, _options.file.name, _options.file.options),
              //     message: 'export pic file success'
              //   })
              // });
            }
            return resolve({
              success: true,
              data: _img,
              message: 'export base64 pic success'
            });
          }
        }
        
      } catch(err) {
        resolve({
          success: false,
          data: err,
          message: 'export pic error'
        })
      }
    });
  }
  // 滚动缩放
  sbDomWheel(e) {
    const _wheelDelta = e.wheelDelta;
    // console.log(`this.ctrlKey: ${this.ctrlKey}, this.altKey: ${this.altKey}`)
    if ((e.ctrlKey || e.altKey) && Math.abs(_wheelDelta) > 0) {
      if (_wheelDelta > 0) {
        this.zoomIn(0.02);
      } else {
        this.zoomOut(0.02);
      }
      e.preventDefault();
      e.stopPropagation();
    }
  }
  // 侦测被选中draw
  deleteSelectedDraw() {
    if (this.preventDelete) {
      return;
    }
    if (this.selectedDraw) {
      if (this.selectedDraw.constructor === Object) {
        this.originDraws.splice(this.selectedDraw.index, 1);
      }
      if (this.selectedDraw.constructor === Array) {
        const _indexs = this.selectedDraw.map(val => val.index);
        this.originDraws = this.originDraws.filter((val, index) => {
          if (!_indexs.includes(index)) {
            return val;
          }
        });
      }

      this.sbDom.dispatchEvent(
        new CustomEvent('deleteDraw', {
          bubbles: true,
          detail: {
            draw: this.selectedDraw
          }
        })
      );

      this.selectedDraw = null;
      this.modifyRect = null;
      if (this.historyRecordHandler) {
        this.historyRecordHandler.recordChange(this.getAllDraws());
      }
    }
  }
  changeDrawPoints(index, coordinate = 'x', delta) {
    let _item = this.originDraws[index];
    _item[coordinate] = _item[coordinate] + delta;
    if (_item.ways) {
      _item.ways.forEach(val => {
        val[coordinate] = val[coordinate] + delta;
      });
    }
  }
  renewSelectedDraw() {
    if (this.selectedDraw) {
      if (this.selectedDraw.constructor === Object) {
        this.selectedDraw['data'] = cloneDeep(this.originDraws[this.selectedDraw.index]);
      }
      if (this.selectedDraw.constructor === Array) {
        const _selectedIndex = this.selectedDraw.map(val => val.index);
        let _selectedOrigins = [];
        this.originDraws.forEach((val, index) => {
          if (_selectedIndex.includes(index)) {
            _selectedOrigins.push({
              data: val,
              index
            });
          }
        });
        this.selectedDraw = cloneDeep(_selectedOrigins);
      }
    }
  }
  // 监听键盘按键释放
  sbDomKeyup(e) {
    const keycode = e.keyCode;
    // console.log(`keyup: ${keycode}`)
    // if (keycode === 32){
    //   // 空格
    //   this.spaceBar = false;
    //   document.documentElement.style.cursor = 'default'
    //   e.preventDefault()
    //   e.stopPropagation()
    //   return;
    // }
    if (keycode === 9) {
      // tab 当用户使用alt+tab或者ctrl+tab切换的时候会产生alt和ctrl键锁定
      this.altKey = false;
      this.ctrlKey = false;
    }
    if (keycode === 18) {
      // alt
      this.altKey = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (keycode === 17) {
      // ctrl || command 91
      this.ctrlKey = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (keycode === 16) {
      // ctrl
      this.shiftKey = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (keycode === 8 || keycode === 46) {
      this.deleteSelectedDraw();
    }
    this.detectDrawsIsOverSize();
    if (this.shouldRecord && this.historyRecordHandler) {
      if (this.options.recordWithLabel) {
        if (this.selectedDraw && this.selectedDraw.constructor === Object && this.selectedDraw.data && this.selectedDraw.data.label) {
          this.historyRecordHandler.recordChange(this.getAllDraws());
        }
      } else {
        this.historyRecordHandler.recordChange(this.getAllDraws());
      }
      this.shouldRecord = false;
    }
  }
  // 监听键盘按键按下
  sbDomKeydown(e) {
    const keycode = e.keyCode;
    console.log(`sbDomKeydown: ${keycode}`)
    // alt
    if (keycode === 18) {
      this.altKey = true;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    // shift
    if (keycode === 16) {
      this.shiftKey = true;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (keycode === 17 || keycode === 91) {
      // ctrl || command 91
      this.ctrlKey = true;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (keycode === 27) {
      // esc
      this.selectedDraw = null;
      if (this.drawType !== 'pointer') {
        this.modifyRect = null;
        this.setDrawType('pointer');
        document.documentElement.style.cursor = 'default';
      }
      return;
    }
    // if (keycode === 32){
    //   // 空格
    //   this.spaceBar = true;
    //   document.documentElement.style.cursor = 'grabbing'
    //   if (this.drawType!=='pointer'){
    //     this.setDrawType('pointer')
    //   }
    //   e.preventDefault()
    //   e.stopPropagation()
    //   return;
    // }
    if (this.selectedDraw) {
      const _stepDelta = e.shiftKey ? 10 : 1;
      const _step = this.normalFloat(_stepDelta / this.zoomSize);
      switch (keycode) {
        case 37:
          // 左
          if (this.selectedDraw.constructor === Object) {
            this.changeDrawPoints(this.selectedDraw.index, 'x', -_step);
          }
          if (this.selectedDraw.constructor === Array) {
            this.selectedDraw.forEach(val => {
              this.changeDrawPoints(val.index, 'x', -_step);
            });
          }
          break;
        case 39:
          // 右
          if (this.selectedDraw.constructor === Object) {
            this.changeDrawPoints(this.selectedDraw.index, 'x', _step);
          }
          if (this.selectedDraw.constructor === Array) {
            this.selectedDraw.forEach(val => {
              this.changeDrawPoints(val.index, 'x', _step);
            });
          }
          break;
        case 38:
          // 上
          if (this.selectedDraw.constructor === Object) {
            this.changeDrawPoints(this.selectedDraw.index, 'y', -_step);
          }
          if (this.selectedDraw.constructor === Array) {
            this.selectedDraw.forEach(val => {
              this.changeDrawPoints(val.index, 'y', -_step);
            });
          }
          break;
        case 40:
          // 下
          if (this.selectedDraw.constructor === Object) {
            this.changeDrawPoints(this.selectedDraw.index, 'y', _step);
          }
          if (this.selectedDraw.constructor === Array) {
            this.selectedDraw.forEach(val => {
              this.changeDrawPoints(val.index, 'y', _step);
            });
          }
          break;
      }
    }
  }
  // 调整点的path2d
  drawModifyDot(dot) {
    const _dotPath2d = new Path2D();
    let _lineWidth = this.options.adjustDotStyle.lineWidth
    _dotPath2d.arc(dot.x, dot.y, _lineWidth, 0, 2 * Math.PI);
    return _dotPath2d;
  }
  // 滚动条系统
  scrollbarSystem() {}
  // 单个draw整体移动
  drawPointsWholeMove(item, x, y) {
    let _sditem = item.data;
    let _ds = this.getDeltaSize(x, y);
    let _item = this.originDraws[item.index];
    _item.x = _sditem.x + _ds.width;
    _item.y = _sditem.y + _ds.height;
    // 兼容多边形
    if (_item.ways) {
      _item.ways.forEach((val, index) => {
        val['x'] = _sditem.ways[index].x + _ds.width;
        val['y'] = _sditem.ways[index].y + _ds.height;
      });
    }
    return _item;
  }
  // 单控制点调整尺寸
  adjustSize(sdItem) {
    // 调整尺寸
    const _sditem = sdItem.data;
    const _ds = this.getDeltaSize(this.hoverPoint.x, this.hoverPoint.y);

    let _item = this.originDraws[sdItem.index];
    switch (this.tinkerUp.code) {
      case 'bm':
        _item.height = _sditem.height + _ds.height;
        break;
      case 'rm':
        _item.width = _sditem.width + _ds.width;
        break;
      case 'br':
        _item.height = this.shiftKey ? _sditem.width + _ds.width : _sditem.height + _ds.height;
        _item.width = _sditem.width + _ds.width;
        break;
      case 'tm':
        _item.height = _sditem.height - _ds.height;
        _item.y = _sditem.y + _ds.height;
        break;
      case 'lm':
        _item.width = _sditem.width - _ds.width;
        _item.x = _sditem.x + _ds.width;
        break;
      case 'tl':
        _item.height = _sditem.height - _ds.height;
        _item.y = _sditem.y + _ds.height;
        _item.width = _sditem.width - _ds.width;
        _item.x = _sditem.x + _ds.width;
        break;
      case 'tr':
        _item.width = _sditem.width + _ds.width;
        _item.height = _sditem.height - _ds.height;
        _item.y = _sditem.y + _ds.height;
        break;
      case 'bl':
        _item.height = _sditem.height + _ds.height;
        _item.width = _sditem.width - _ds.width;
        _item.x = _sditem.x + _ds.width;
        break;
      case 'pp':
        if (this.tinkerUp.wayIndex !== undefined && this.tinkerUp.wayIndex !== null && this.tinkerUp.wayIndex.constructor === Number) {
          _item.ways[this.tinkerUp.wayIndex].x = _sditem.ways[this.tinkerUp.wayIndex].x + _ds.width;
          _item.ways[this.tinkerUp.wayIndex].y = _sditem.ways[this.tinkerUp.wayIndex].y + _ds.height;
        } else {
          _item.x = _sditem.x + _ds.width;
          _item.y = _sditem.y + _ds.height;
        }
        break;
    }
  }
  // 侦测draw组是否超出底图范围
  detectDrawsIsOverSize() {
    // return true
    if (this.spliceBgList && this.spliceBgList.length) {
      const _lastChild = this.spliceBgList[this.spliceBgList.length - 1]
      // let edgeLength = Math.max(_lastChild.width,_lastChild.height);
      // const _finalWidth = _lastChild.offsetX + edgeLength;
      // const _finalHeight = _lastChild.offsetY + edgeLength;

      const _finalWidth = _lastChild.offsetX + _lastChild.width;
      const _finalHeight = _lastChild.offsetY + _lastChild.height;
      let _flag = true;
      this.originDraws.forEach((oval, oindex) => {
        switch (oval.type) {
          case 'rect':
            // 右尽头
            if (oval.x + oval.width > _finalWidth) {
              const _delta = Math.abs(_finalWidth - oval.width);
              oval['x'] = _delta;
            }
            // 下尽头
            if (oval.y + oval.height > _finalHeight) {
              const _delta = Math.abs(_finalHeight - oval.height);
              oval['y'] = _delta;
            }
            // 上尽头
            if (oval.x < 0) {
              oval['x'] = 0;
            }
            // 左尽头
            if (oval.y < 0) {
              oval['y'] = 0;
            }
            break;
        }
      });
      if (_flag) {
        this.renewSelectedDraw();
      }
      return _flag; 
    } else {
      if (!this.bgObj) {
        return false;
      }
      let edgeLength = Math.max(this.bgObj.width,this.bgObj.height);
      let offsetX = (edgeLength - this.bgObj.width)/2;
      let offsetY = (edgeLength - this.bgObj.height)/2;
      // const _finalWidth = this.bgObj.width;
      // const _finalHeight = this.bgObj.height; 
      const _finalWidth = edgeLength;
      const _finalHeight = edgeLength; 

      let _flag = true;
      this.originDraws.forEach((oval, oindex) => {
        switch (oval.type) {
          case 'rect':
            // 右尽头
            if (oval.x + oval.width + offsetX > _finalWidth) {
              const _delta = Math.abs(_finalWidth - offsetX - oval.width);
              oval['x'] = _delta;
            }
            // 下尽头
            if (oval.y + oval.height + offsetY > _finalHeight) {
              const _delta = Math.abs(_finalHeight-offsetY - oval.height);
              console.log(_delta)
              oval['y'] = _delta;
            }
            // 上尽头
            if (oval.x < -offsetX) {
              oval['x'] = -offsetX;
            }
            // 左尽头
            if (oval.y < -offsetY) {
              oval['y'] = -offsetY;
            }
            break;
        }
      });
      if (_flag) {
        this.renewSelectedDraw();
      }
      return _flag;
    }
  }
  // 文件转base64
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  }
  // blob 转成文件
  blobToFile(theBlob, fileName = 'exportPicture.png', options = { type: 'image/png' }) {
    return new File([theBlob], fileName, options);
  }
  // base64 to blob数据
  b64toBlob(base64Data) {
    let byteString = atob(base64Data.split(',')[1]);
    let ab = new ArrayBuffer(byteString.length);
    let ia = new Uint8Array(ab);

    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: 'image/png' });
  }
  // 计算画笔是否在modifyRect上
  calcIsOnModifyRect(x, y) {
    if (!this.modifyRect) {
      return false;
    }
    const _tmpRect = new Path2D();
    _tmpRect.rect(this.modifyRect.x, this.modifyRect.y, this.modifyRect.width, this.modifyRect.height);
    return this.sbCtx.isPointInStroke(_tmpRect, x, y) || this.sbCtx.isPointInPath(_tmpRect, x, y);
  }
  // 计算鼠标落在哪个Draw上
  calcIsOverDraw(x, y, isStroke=true) {
    let _flag = undefined;
    for (let i = 0; i < this.originDraws.length; i++) {
      const _item = this.originDraws[i];
      switch (_item.type) {
        case 'rect':
          // 判断鼠标是否在label上
          if (_item.label) {
            const _tmpLabelRect = new Path2D();
            const labelRect = this.labelRect(_item, this.zoomSize);
            if (labelRect) {
              _tmpLabelRect.rect(labelRect.x, labelRect.y, labelRect.width, labelRect.height);
              if (this.sbCtx.isPointInPath(_tmpLabelRect, x, y)) {
                _flag = {
                  data: _item,
                  index: i,
                  pointIn: 'label'
                };
              }
            }
          }
          if (!_flag) {
            const _tmpRect = new Path2D();
            _tmpRect.rect(_item.x, _item.y, _item.width, _item.height);
            if (isStroke) {
              if (this.sbCtx.isPointInStroke(_tmpRect, x, y)) {
                // 边缘检测
                _flag = {
                  data: _item,
                  index: i,
                  // pointIn: 'inside'
                  pointIn: 'stroke'
                };
              }
            } else {
              // 整个检测
              if(this.sbCtx.isPointInPath(_tmpRect, x, y)){ 
                _flag = {
                  data: _item,
                  index: i,
                  pointIn: 'inside'
                  // pointIn: 'stroke'
                };
              }
            }
          }
          break;
        case 'polygon':
          const _svgPath2d = this.drawToSvgPath(_item);
          if (this.sbCtx.isPointInStroke(_svgPath2d, x, y)) {
            _flag = {
              data: _item,
              index: i,
              pointIn: 'stroke'
            };
          }
          break;
      }
      
      if (_flag) {
        break;
      }
    }
    return _flag;
  }
  // 计算鼠标落在哪些Draws上
  calcIsOverDraws({x=0, y=0, filterList=undefined, returnType='array', lock=false}) {
    let _matchedDraw = undefined;
    let _need_match_type = filterList ? true : false;
    for (let i = (this.originDraws.length-1); i>=0; i--) {
      const _item = this.originDraws[i];
      if (!_item.lock) {
        // 判断是否有特定drawtype判断
        if ( !_need_match_type || (_need_match_type && filterList[_item.drawType])) {
          let _is_stroke = _need_match_type && filterList[_item.drawType] && filterList[_item.drawType].is_stroke ? filterList[_item.drawType].is_stroke : true;
          switch (_item.type) {
            case 'arc':
            case 'rect':
              // 判断鼠标是否在label上
              if (_item.label) {
                const _tmpLabelRect = new Path2D();
                const labelRect = this.labelRect(_item, this.zoomSize);
                if (labelRect) {
                  _tmpLabelRect.rect(labelRect.x, labelRect.y, labelRect.width, labelRect.height);
                  if (this.sbCtx.isPointInPath(_tmpLabelRect, x, y)) {
                    _matchedDraw = {
                      data: _item,
                      index: i,
                      pointIn: 'label'
                    };
                  }
                }
              }
              if (!_matchedDraw) {
                const _tmpDraw = new Path2D();
                if (_item.type.match(/arc/gi)) {
                  _tmpDraw.arc(_item.x, _item.y, _item.radius, 0, 2 * Math.PI)
                } else {
                  _tmpDraw.rect(_item.x, _item.y, _item.width, _item.height);
                }
                if (_is_stroke) {
                  if (this.sbCtx.isPointInStroke(_tmpDraw, x, y)) {
                    // 边缘检测
                    _matchedDraw = {
                      data: _item,
                      index: i,
                      pointIn: 'stroke'
                    };
                  }
                } else {
                  // 整个检测
                  if(this.sbCtx.isPointInPath(_tmpDraw, x, y)){ 
                    _matchedDraw = {
                      data: _item,
                      index: i,
                      pointIn: 'inside'
                    };
                  }
                }
              }
              break;
            case 'quadrangle':
            case 'polygon':
              const _svgPath2d = this.drawToSvgPath(_item);
              if (_is_stroke) {
                if (this.sbCtx.isPointInStroke(_svgPath2d, x, y)) {
                  _matchedDraw = {
                    data: _item,
                    index: i,
                    pointIn: 'stroke'
                  };
                }
              } else {
                // 整个检测
                if(this.sbCtx.isPointInPath(_svgPath2d, x, y)){ 
                  _matchedDraw = {
                    data: _item,
                    index: i,
                    pointIn: 'inside'
                  };
                }
              }
              break;
          }
        } else {
          let _is_stroke = is_stroke
        }
      }
      
      if (_matchedDraw) {
        break;
      }
    }
    return _matchedDraw;
  }
  // 获取最大zindex
  // getMaxZIndex() {
  //   let _max = 1;
  //   if (this.originDraws && this.originDraws.length) {
  //     const _maxArray = this.originDraws.map(val => val.zIndex)
  //     _max = Math.max(..._maxArray);
  //     _max = _max + 1;
  //   }
  //   return _max
  // }
  // canvas路径转svg路径
  drawToSvgPath(polygon, svgout=false) {
    let _svg_path = [`M${polygon.x} ${polygon.y}`];
    polygon.ways.forEach(val => {
      _svg_path.push(`L${val.x} ${val.y}`);
    });
    _svg_path.push('Z');
    _svg_path = _svg_path.join(' ');
    // console.log(`_svg_path: ${_svg_path}`)
    if (svgout) {
      return _svg_path
    } else {
      return new Path2D(_svg_path);
    }
  }
  drawToPath(polygon) {
    let _path2dIns = new Path2D()
    _path2dIns.moveTo(polygon.x, polygon.y)
    polygon.ways.forEach(val => {
      _path2dIns.lineTo(val.x, val.y)
    });
    _path2dIns.closePath()
    // console.log(_path2dIns)
    return _path2dIns;
  }
  // 计算图片显示宽高
  calcImageSize(width, height) {
    let _obj = {
      width: 0,
      height: 0,
      offsetX: 0,
      offsetY: 0,
      scaled: 1
    };
    if (width && height && this.sbDom) {
      if (this.sbDom.width > width && this.sbDom.height > height) {
        _obj.width = width;
        _obj.height = height;
        _obj.offsetX = this.normalFloat((this.sbDom.width - _obj.width) / 2);
        _obj.offsetY = this.normalFloat((this.sbDom.height - _obj.height) / 2);
        _obj.scaled = 1;
      } else {
        _obj.width = Math.round(width * (this.sbDom.height / height));
        if (_obj.width > this.sbDom.width) {
          _obj.width = this.sbDom.width;
          _obj.height = Math.round(height * (this.sbDom.width / width));
          _obj.offsetX = 0;
          _obj.offsetY = this.normalFloat((this.sbDom.height - _obj.height) / 2);
          _obj.scaled = this.normalFloat(this.sbDom.width / width, 3);
        } else {
          _obj.height = this.sbDom.height;
          _obj.offsetY = 0;
          _obj.offsetX = this.normalFloat((this.sbDom.width - _obj.width) / 2);
          _obj.scaled = this.normalFloat(this.sbDom.height / height, 3);
        }
      }
    }
    return _obj;
  }
  // 检验是否双击
  detectIsDBClick(ctime) {
    this.clickTimeLogs.unshift(ctime);
    if (this.clickTimeLogs.length > 2) {
      this.clickTimeLogs = this.clickTimeLogs.slice(0, 2);
    }
    if (this.clickTimeLogs.length !== 2) {
      return false;
    }
    const _deltaTime = Math.abs(this.clickTimeLogs[0] - this.clickTimeLogs[1]);

    if (_deltaTime <= 200) {
      return true;
    } else {
      return false;
    }
  }
  // 产生短id
  uuidv4Short() {
    return 'xxxx-4xxxyx'.replace(/[xy]/g, function(c) {
      const r = (Math.random() * 16) | 0,
        v = c == 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  // 产生id
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      let r = (Math.random() * 16) | 0,
        v = c == 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  // 检测相近点击的两点是否接近
  detectTwoPointIsNearby(reference, point, zoomSize, gap = 5) {
    let flagX = false;
    let flagY = false;

    if (!point || !reference) {
      return false;
    }
    // let _offsetX = this.bgObj ? this.bgObj.offsetX/zoomSize : 0
    // let _offsetY = this.bgObj ? this.bgObj.offsetY/zoomSize : 0
    const _gapSzie = gap / zoomSize;
    let _referencePoint = { x: 0, y: 0 };
    if (reference.ways && reference.ways.length) {
      const _lastPoint = reference.ways[reference.ways.length - 1];
      _referencePoint = { x: _lastPoint.x, y: _lastPoint.y };
    } else {
      _referencePoint = { x: reference.x, y: reference.y };
    }
    const _maxX = _referencePoint.x + _gapSzie;
    const _minX = _referencePoint.x - _gapSzie;
    const _maxY = _referencePoint.y + _gapSzie;
    const _minY = _referencePoint.y - _gapSzie;
    if (_maxX >= point.x && point.x >= _minX) {
      flagX = true;
    }
    if (_maxY >= point.y && point.y >= _minY) {
      flagY = true;
    }
    if (flagX && flagY) {
      return true;
    } else {
      return false;
    }
  }
  // 判断开始和结束点是否接近
  detectTwoPointClose(reference, point, zoomSize, gap = 5) {
    let flagX = false;
    let flagY = false;

    if (!point || !reference) {
      return false;
    }
    let _offsetX = this.bgObj ? this.bgObj.offsetX / zoomSize : 0;
    let _offsetY = this.bgObj ? this.bgObj.offsetY / zoomSize : 0;
    const _gapSzie = gap / zoomSize;

    const _maxX = reference.x + _gapSzie + _offsetX;
    const _minX = reference.x - (_gapSzie + _offsetX);
    const _maxY = reference.y + _gapSzie + _offsetY;
    const _minY = reference.y - (_gapSzie + _offsetY);

    if (_maxX >= point.x && point.x >= _minX) {
      flagX = true;
    }
    if (_maxY >= point.y && point.y >= _minY) {
      flagY = true;
    }
    if (flagX && flagY) {
      return true;
    } else {
      return false;
    }
  }
  // 绘画多边形
  drawPolygon({closed=false, moving=false, gco='source-over', drawType='polygon', fillStyle='red', strokeStyle='gray'}) {
    if (!this.pencilPosition) {
      return;
    }
    const _x = (this.pencilPosition.x - this.dragOffset.x) / this.zoomSize;
    const _y = (this.pencilPosition.y - this.dragOffset.y) / this.zoomSize;

    if (!this.tmpPolygon) {
      this.tmpPolygon = {
        x: _x,
        y: _y,
        ways: [],
        gco,
        type: 'polygon',
        drawType,
        closed: false,
        fillStyle,
        strokeStyle
      };
    } else {
      if (!moving) {
        this.tmpPolygon['ways'].push({
          x: _x,
          y: _y
        });
      }
    }
    this.tmpPolygon['closed'] = closed;
  }
  // 绘画圆形
  drawArc({x, y, label, strokeStyle, fillStyle, zIndex = 1, gco = 'source-over', drawType=""}) {
    const _ds = this.getDeltaSize(x, y);
    const _radius = Math.abs(Math.floor(Math.max(_ds.width, _ds.height)/2))
    const _x = (this.pencilPosition.x - this.dragOffset.x) / this.zoomSize;
    const _y = (this.pencilPosition.y - this.dragOffset.y) / this.zoomSize;
    this.tmpArc = {
      x: _x,
      y: _y,
      radius: _radius,
      type: 'arc',
      drawType: drawType,
      gco: gco,
      zIndex,
      label,
      strokeStyle,
      fillStyle
    };
    return this.tmpArc;
  }
  // 绘画矩形
  drawRect({x, y, label, strokeStyle, fillStyle, zIndex = 1, gco = 'source-over', drawType=""}) {
    const _ds = this.getDeltaSize(x, y);
    const _x = (this.pencilPosition.x - this.dragOffset.x) / this.zoomSize;
    const _y = (this.pencilPosition.y - this.dragOffset.y) / this.zoomSize;
    this.tmpRect = {
      x: _x,
      y: _y,
      width: _ds.width,
      height: _ds.height,
      type: 'rect',
      drawType: drawType,
      gco: gco,
      zIndex,
      label,
      strokeStyle,
      fillStyle
    };
    return this.tmpRect;
  }
}