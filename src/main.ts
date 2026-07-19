import {Game} from "./game.js";

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

const game = new Game(ctx, canvas);
game.start();