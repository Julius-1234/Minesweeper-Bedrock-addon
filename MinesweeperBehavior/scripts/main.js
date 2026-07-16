import { world, system } from "@minecraft/server";
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

function clear(x, y, dimension) {
  const stack = [getSquare(x, y, false, dimension)];
  let index = -1;
  while (stack.length > ++index && stack.length <= stackMaxLength) {
    const square = stack[index];
    const x = square.x;
    const y = square.y;
    if (square.cleared) continue;
    square.cleared = true;
    if (square.mine) {
      mine(x, y, dimension);
      break;
    }
    const found = surr(x, y, dimension);
    let num = 0;
    found.forEach((i) => {
      if (i.mine) num += 1;
    });
    const loc = { x: x, y: y_pos, z: y };
    const target = dimension.getBlock(loc);
    if (target) target.setType(blocks[num]);
    if (num === 0)
      for (const i of found) {
        if (i.cleared || stack.includes(i)) continue;
        stack.push(i);
      }
  }
  save();
}

function format(x, y) {
  return `${y.toString()}_${x.toString()}`;
}

function getSquare(x, y, isStart, dimension) {
  if (!grid[format(x, y)]) {
    grid[format(x, y)] = {
      cleared: false,
      mine: isStart ? false : Math.random() < mineChance,
      x,
      y,
    };
    const loc = { x: x, y: y_pos, z: y };
    const target = dimension.getBlock(loc);
    if (target) target.setType(unclearedBlock);
  }
  return grid[format(x, y)];
}

function surr(x, y, dimension) {
  const found = [];
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      if (i === 0 && j === 0) continue;
      const square = getSquare(x + i, y + j, false, dimension);
      found.push(square);
    }
  }
  return found;
}

function mine(x, y, dimension) {
  const loc = { x: x, y: y_pos, z: y };
  const target = dimension.getBlock(loc);
  if (target) target.setType(mineBlock);
  say("you hit a mine!");
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
        clear(block.x, block.z, block.dimension);
      });
    }
  });
}

function save() {
  const full = JSON.stringify(grid);
  let i = 0;
  while (i < full.length) {
    const sub = full.substring(i * chunkSize, (i + 1) * chunkSize);
    world.setDynamicProperty(`grid_${i}`, sub);
    i += 1;
  }
  load();
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
