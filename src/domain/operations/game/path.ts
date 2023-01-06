
interface Map {
  [key: string]: any
}

export const SAFE_CELLS: Map = {
  0: [1, 9, 14, 22, 27, 35, 40, 48],
  1: [14, 22, 27, 35, 40, 48, 1, 9],
  2: [27, 35, 40, 48, 1, 9, 14, 22],
  3: [40, 48, 1, 9, 14, 22, 27, 35],
  universal: [1, 9, 14, 22, 27, 35, 40, 48]
};

export const HOME_PATH: Map = {
  "0": [
    53, 54, 55, 56, 57, 58
  ],
  "1": [
    59, 60, 61, 62, 63, 64
  ],
  "2": [
    65, 66, 67, 68, 69, 70
  ],
  "3": [
    71, 72, 73, 74, 75, 76
  ]
};

export const PLAYER_PATH: Map = {
  "0": [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30
  ,31,32,33,34,35,36,37,38,39,40,41,42],
  "1": [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30
  ,31,32,33,34,35,36,37,38,39,40,41,42],
  "safe": [1, 9, 14, 22, 27, 35, 30, 29],
  "totalBlocks": 30,
};

export function totalDistance() {
  return PLAYER_PATH["totalBlocks"];
}
export function getPawnIndex(playerPos: number, pawnPos: number, hasKilled?: boolean): any {
  let selectedRoute = PLAYER_PATH[playerPos];
  return selectedRoute.findIndex((x: number) => x === pawnPos);
}
export function pathValue(playerPos: number, index: number, hasKilled?: boolean): any {
  console.log("pathValue : has killed before ", hasKilled);
  const selectedRoute = PLAYER_PATH[playerPos];
  return selectedRoute[index];
}
export function validateNewPosition(playerPos: number, pawnPos: number, diceValue: number, hasKilled?: boolean): any {
  console.log("validateNewPosition : has killed before ", hasKilled);
  console.log("\n validateNewPosition \n Player index ", playerPos);
  console.log("pawn index ", pawnPos);
  console.log("dice  index ", diceValue);
  if (pawnPos == 0 && diceValue != 6) return false;
  const currentPawnIndex = getPawnIndex(playerPos, pawnPos, hasKilled);
  const newPawnIndex = diceValue + currentPawnIndex;
  const newPawsPos = pathValue(playerPos, newPawnIndex, hasKilled);
  console.log("Ivalid ", !!newPawsPos);
  return !!newPawsPos;
}

export function isSafePosition(position: number): any {
  return PLAYER_PATH.safe.includes(position);
}

export function isNearHome(playerPos: number, pawnPos: number) {
  let NEAREST_HOME_INDEX = 36
  let pawnDistance = PLAYER_PATH[playerPos].findIndex((x: number) => x === pawnPos) - NEAREST_HOME_INDEX
  return pawnDistance > 0 ? true : false
}

export function getPawnDistanceFromHome(playerPos: number, pawnPos: number) {
  let pawnDistance = PLAYER_PATH[playerPos].findIndex((x: number) => x === pawnPos)
  return pawnDistance
}

export function isValidPawnPosition(playerPos: number, diceValue: number, pawnPos: number, hasKilled?: boolean): boolean {
  if (!pawnPos && diceValue != 6) {
    return false;
  }
  return !!validateNewPosition(playerPos, pawnPos, diceValue, hasKilled);
}
export const getRouteFirstValue = (pos: number) => PLAYER_PATH[pos][0];