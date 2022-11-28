import { GameServer } from "application";
import { gameLog } from "./logger";

export function sendGameEndEvent(resp: any, _id: string) {
    gameLog(_id, 'Sending game End event', resp);
    GameServer.Instance.socketServer.emitToSocketRoom(_id, "gameEnd", resp);
}