// 残响 AFTERGLOW — 应用入口
// 职责：获取画布/根元素，装配游戏实例，处理窗口生命周期。
import { Game } from './core/Game.js';
import { AudioEngine } from './core/Audio.js';
import { SaveSystem } from './core/Save.js';

const canvas = document.getElementById('game-canvas');
const uiRoot = document.getElementById('ui-root');

const save = new SaveSystem();
const audio = new AudioEngine(save);

const game = new Game({ canvas, uiRoot, audio, save });
game.start();

window.addEventListener('beforeunload', () => {
  game.dispose();
});

// 便于调试与自动化测试暴露句柄
window.__AFTERGLOW__ = game;
