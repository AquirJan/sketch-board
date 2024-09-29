import cloneDeep from './lodash.clonedeep.js';
export default class recordActionHistory {
  constructor(options) {
    this.options = Object.assign(
      {
        recordName: '', // 是否使用特定名字
        historyArray: null // 操作记录的历史数据
      },
      cloneDeep(options)
    );
    this.recordStep = 0;
    this.historyActionArray = null;
    this.init();
  }
  // 后退
  revoke() {
    this.recordStep = this.recordStep - 1;
    let _historyIndex = this.recordStep-1
    if (_historyIndex<0){
      this.recordStep = 1;
      _historyIndex=0
    }
    return cloneDeep(this.historyActionArray[_historyIndex])
  }
  // 前进
  onward() {
    this.recordStep = this.recordStep + 1;
    if (this.recordStep>this.historyActionArray.length){
      this.recordStep=this.historyActionArray.length
    }
    let _historyIndex = this.recordStep-1
    
    return cloneDeep(this.historyActionArray[_historyIndex])
  }
  // 获取显示的历史操作数组
  getHistoryArray() {
    return cloneDeep(this.historyActionArray);
  }
  // 获取显示的历史操作数组长度
  getHistoryArrayLength() {
    return this.historyActionArray.length;
  }
  // 获取最新一个
  getHistoryArrayFirst() {
    return this.historyActionArray && this.historyActionArray.length ? cloneDeep(this.historyActionArray[0]) : null;
  }
  // 获取当前步数
  getRecordStep() {
    return this.recordStep;
  }
  // 清空历史记录
  clearRecords(){
    this.historyActionArray = []
  }
  // 记录历史变化
  recordChange(data) {
    if (this.historyActionArray.length !== this.recordStep){
      this.historyActionArray = this.historyActionArray.slice(0, this.recordStep)
    } 
    this.recordStep = this.recordStep+1
    this.historyActionArray.push(cloneDeep(data))
  }
  // 初始化
  init() {
    this.historyActionArray = this.options.historyArray;
    if (this.historyActionArray!==null || this.historyActionArray!== undefined){
      this.recordStep = 1;
    }
    return this;
  }
  destroy() {
    this.options.historyArray = [];
    this.recordStep = 0;
    this.historyActionArray = [];
  }
}
