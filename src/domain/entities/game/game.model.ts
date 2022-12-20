import mongoose from 'mongoose'
export enum GameState {
    WAITING = 1,
    RUNNING = 2,
    FINISHED= 3,
    DESTROYED= 4
}
export const WINNING_POSITION = 30;

export type GameOpts = {
    _id: string
    capacity : number
    state : number
}
export enum ExitReason {
    GAME_EXIT = 1,
    EXIT_BEFORE_MATCH_MAKING = 2,
    TURN_SKIP_3 = 3
  }

export interface GameWinningData {
    RoomId: string,
    ContestId: string,
    participantScores: Array<{UserId: number, Score: number}>,
    ExitCount: number,
    AutoExitCount: number ,
    NormalCount: number,
    GameId:number

}

export enum MoveType{
    KILL = 1,
    HOME = 2,
    SAFE_POSITION = 3,
    NORMAL_SAFE = 4,
    NORMAL_RISK = 5

}
export enum GameType {
    NORMAL = 1,
    XFAC_EASY = 2,
    XFAC_MEDIUM = 3,
    XFAC_HARD = 4
}

export interface XFacMove{
    pawnIndex: number,
    moveType: MoveType,
    newPos: number
}

export enum GamePhase {
    ROLL_DICE = 1,
    MOVE_PAWN = 2
}

export enum TURN_SKIP_REASON {
    TURN_TIMEOUT = 1,
    TRIPPLE_SIX = 2,

}

export enum PAWN_COLOR {
    BLUE = 1,
    RED = 2,
    GREEN =3 ,
    YELLOW = 4
}
export const gameModel = new mongoose.Schema({
    players: {
        type: Array,
    },
    state: {
        type: Number,
        required: true,
        default : GameState.WAITING
    },
    capacity : Number,
    isFull : Boolean,
},{timestamps: true})

export enum GameMode{
    TIME_BASED = 1,
    TURN_BASED = 2
}

export interface GameTicketData {
    gameId: string,
    capacity: number,
    serverIp: string,
    playerPos: number,
    contestId: string,
    timeSlot: number,       // For contest room
    gameServerTimeoutIn: number,
    gamePlayTime?: number
    joiningAmount?: number,  // For personal room
    isPrivate?: boolean,
    uniqueId?: string,       // For contest room
    metaData?: any
}

export enum GameConfig{
    USER_FIRST = 1,
    XFAC_FIRST = 2,
    XFAC_OFF = 3
}
export interface ContestData {
    cid: string,
    total_joined: number,
    tt: number,
    mba: number,
    ja: number,
    isPrivate: boolean,
    Duration: number,
    StartTime: number,
    WaitingTime: number,
    DelayTime: number,
    IsXFac: boolean,
    XFacLevel: number,
    Highmultiple: number,
    Lowmultiple: number,
    cn: string,
    fw: string,
    wa: number,
    ba: boolean,
    cic: string,
    mea: boolean,
    mate: number,
    cc: number,
    total_winners: string,
    mp: number,
    jf: number,
    catid: string,
    IsConfirm: boolean,
    TurnTime: number,
    NoOfTurn: number,
    GameMode: number
}

export enum GameIds {
    LUDO = 1,
    FRUIT_CUT = 2,
    KNIFE_HIT = 3,
    RUMMY = 4
}

export type TGame = typeof gameModel

export class JoinContestResponse{
    ResponseStatus:number;
    RoomId: number;
}

export class Breakup{
    wf:number;
    wt:number;
    wa:number;
}

export class Category
{
    catid:number;
    cn:string;
    cm:string;
    tc:number;
    isprac:boolean;
}

export class PracticeContestUser{
    ContestId:number;
}

export class JoinedContest{
    contest_id: number;
    tc: number;
}

export enum GameLevel {
    NORMAL = 1,
    XFAC_EASY = 2,
    XFAC_MEDIUM = 3,
    XFAC_HARD = 4
}