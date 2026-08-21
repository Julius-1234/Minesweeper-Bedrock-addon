import { world, system, BlockPermutation } from "@minecraft/server";
const chunkSize = 3000;
let grid = load();
const y_pos = -61;
const mineChance = 1 / 6.4;
const stackMaxLength = 1000;
const blocks = [
  "minecraft:gray_concrete", // 0
  "minecraft:blue_concrete", // 1
  "minecraft:green_concrete", // 2
  "minecraft:red_concrete", // 3
  "minecraft:purple_concrete", // 4
  "minecraft:brown_concrete", // 5
  "minecraft:cyan_concrete", // 6
  "minecraft:black_concrete", // 7
  "minecraft:lime_concrete", // 8
];
const unclearedBlock = "minecraft:light_gray_concrete";
const mineBlock = "minecraft:orange_concrete";

let renderIndex = 0;
const renderStackMax = 1000;
let renderStack = [];
const inRenderStack = new Set();
const blocksPerTick = 500;

class Block {
  constructor(x, z, dimension) {
    this.x = x;
    this.z = z;
    this.dimension = dimension;
    this.cleared = false;
    const isMine = Math.random() < mineChance;
    this.mine = isMine;
    this.surr = null;
    this.currentBlock = null;
  }
}
function setBlock(square) {
  const loc = { x: square.x, y: y_pos, z: square.z };
  const dimension = world.getDimension(square.dimension);
  const target = dimension.getBlock(loc);
  let newBlock = null;
  if (!target) return;
  if (!square.cleared) newBlock = unclearedBlock;
  if (square.mine && square.cleared) newBlock = mineBlock;
  if (square.surr !== null && !square.mine && square.cleared)
    newBlock = blocks[square.surr];

  if (square.currentBlock === newBlock) return;
  target.setPermutation(BlockPermutation.resolve(newBlock));
  square.currentBlock = newBlock;
}

function addToRenderStack(square) {
  if (!inRenderStack.has(square)) {
    renderStack.push(square);
    inRenderStack.add(square);
  }
}

const renderInterval = system.runInterval(() => {
  for (let i = 0; i < blocksPerTick; i++) {
    if (renderIndex >= renderStack.length) break;

    const square = renderStack[renderIndex];
    setBlock(square);
    inRenderStack.delete(square);

    renderIndex++;
  }

  if (renderIndex >= renderStackMax) {
    renderStack = renderStack.slice(renderIndex);
    renderIndex = 0;
  }
}, 1);

function clear(x, z, dimension) {
  const stack = [getSquare(x, z, dimension)];
  const inStack = new Set(stack);

  let index = -1;
  while (stack.length > ++index && index <= stackMaxLength) {
    const square = stack[index];
    const x = square.x;
    const z = square.z;
    if (square.cleared) continue;
    square.cleared = true;
    if (square.mine) {
      say("you hit a mine!");
      addToRenderStack(square);
      break;
    }
    const found = surr(x, z, dimension);
    let num = 0;
    found.forEach((i) => {
      addToRenderStack(i);
      if (i.mine) num += 1;
    });
    square.surr = num;
    if (num === 0)
      for (const i of found) {
        if (i.cleared || inStack.has(i)) continue;
        stack.push(i);
        inStack.add(i);
      }
    addToRenderStack(square);
  }
  save();

  say("cleared " + String(stack.length) + " squares");
}

function format(x, z, dimension) {
  return `${z.toString()}_${x.toString()}_${dimension}`;
}

function getSquare(x, z, dimension) {
  grid[format(x, z, dimension)] ??= new Block(x, z, dimension);
  return grid[format(x, z, dimension)];
}

function surr(x, z, dimension) {
  const found = [];
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      if (i === 0 && j === 0) continue;
      const square = getSquare(x + i, z + j, dimension);
      found.push(square);
    }
  }
  return found;
}

function say(message) {
  const players = world.getAllPlayers();
  if (players.length > 0) {
    players[0].sendMessage(message);
  }
}

const breakSignal =
  world.beforeEvents?.playerBreakBlock ?? world.events?.beforePlayerBreakBlock;
if (breakSignal) {
  breakSignal.subscribe((eventData) => {
    const block = eventData.block;
    if (block.y === y_pos) {
      eventData.cancel = true;
      system.run(() => {
        clear(block.x, block.z, block.dimension.id);
      });
    }
  });
}

function save() {
  const full = JSON.stringify(grid);
  let i = 0;
  while (i * chunkSize < full.length) {
    const sub = full.substring(i * chunkSize, (i + 1) * chunkSize);
    world.setDynamicProperty(`grid_${i}`, sub);
    i += 1;
  }
}

function load() {
  let i = 0;
  let full = [];
  while (true) {
    const data = world.getDynamicProperty(`grid_${i}`);
    if (data === undefined) break;
    full.push(data);
    i += 1;
  }
  return JSON.parse(full.length > 0 ? full.join("") : "{}");
}
