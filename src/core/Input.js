// 输入系统 — 键盘状态、鼠标增量、指针锁定。
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.justPressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.mouseJustDown = false;
    this.pointerLocked = false;
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.justPressed.add(e.code);
      if (this.pointerLocked && ['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Tab'].includes(e.code)) e.preventDefault();
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseMove = (e) => {
      // 锁定模式下持续跟踪；未锁定时（如嵌入式视图不支持 pointer lock）按住左键拖动转视角
      if (this.pointerLocked || this.mouseDown) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    };
    this._onMouseDown = (e) => {
      if (e.button === 0) { this.mouseDown = true; this.mouseJustDown = true; }
    };
    this._onMouseUp = (e) => {
      if (e.button === 0) this.mouseDown = false;
    };
    this._onPointerLockChange = () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
  }

  requestPointerLock() {
    if (!this.pointerLocked) this.canvas.requestPointerLock();
  }

  exitPointerLock() {
    if (this.pointerLocked) document.exitPointerLock();
  }

  isDown(code) { return this.keys.has(code); }
  justPressedCode(code) { return this.justPressed.has(code); }

  // 每帧末调用：清空一次性状态
  endFrame() {
    this.justPressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseJustDown = false;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
  }
}
