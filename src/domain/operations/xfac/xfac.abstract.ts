import { Game } from "../game/game";
import { User } from "../user/user";

export abstract class XFacAbstract{

    constructor(game: Game){

    };

    abstract initOnRestart(): any;
    abstract joinMatch(opponentId: number, xFacId?: string, level?: number): any;
    abstract startGame(): any;
    abstract destroyOnEnd(xFacLogId: number): any;

}