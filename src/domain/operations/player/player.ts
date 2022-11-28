import { PlayerOpts, PlayerState, PlayerType } from "domain/entities/player/player.model"
import { Game } from "../game/game"
import { FruitCutXFac } from "../xfac/fruitcut.xfac"
import { XFacAbstract } from "../xfac/xfac.abstract"
import { XFacManager } from "../xfac/xfac.manager"

export class Player {
    private userId: string
    private name: string
    private pos: number
    private state: number
    private score: number
    private rank: number
    private did: string
    private mid: number;
    private referCode: string;
    private prize: number;
    private totalGameWinner: number;
    private playerType: PlayerType;
    public xfac: XFacAbstract;
    constructor(opts: PlayerOpts) {
        console.log("Player opts ", opts);
        this.userId = opts._id;
        this.mid = opts.mid
        this.did = opts.did
        this.name = opts.name;
        this.referCode = opts.referCode
        this.state = PlayerState.WAITING;
        this.score = 0;
        this.rank = -1;

        this.totalGameWinner = opts.totalGameWinners
        this.playerType = opts.playerType ? opts.playerType : PlayerType.HUMAN;
        this.xfac = opts.xfac;

        console.log("Position ", this.pos);
        console.log("Paws stack for pos ", this.pos);
    }
    public initOnRestart(opts: any, game: Game) {
        this.userId = opts.userId;
        this.name = opts.name;
        this.pos = opts.pos;
        this.state = opts.state;
        this.score = opts.score;
        this.rank = opts.rank;
        this.mid = opts.mid;
        this.did = opts.did;
        this.referCode = opts.referCode
        this.totalGameWinner = opts.totalGameWinner;
        this.playerType = opts.playerType || PlayerType.HUMAN
        if(this.playerType == PlayerType.XFAC){
            game.log('Creating xfac on playerInitOnRestart')
            this.xfac = XFacManager.getXFac(game);
            this.xfac.initOnRestart();
        }
    }
    public playerProperties(): any {
        const resp = {
            userId: this.userId,
            name: this.clearString(this.name),
            pos: this.pos,
            state: this.state,
            score: this.score,
            rank: this.rank,
            mid: this.mid,
            did: this.did,
            totalGameWinner: this.totalGameWinner,
            prize: this.prize,
            playerType: this.playerType,

        }
        // return JSON.stringify(resp);
        return resp;
    }

    public playerLogProperties(): any {
        const resp = {
            userId: this.userId,
            name: this.clearString(this.name),
            state: this.state,
            score: this.score,
            rank: this.rank
        }
        // return JSON.stringify(resp);
        return resp;
    }

    public get playerInfo(): any {
        if (this.rank >= 0) {
            if (![PlayerState.EXIT, PlayerState.AUTOEXIT].includes(this.state)) {
                if (this.rank <= 0) {
                    this.state = PlayerState.WON;
                }
                // Only change state to lost if user did not exit or auto exit
                else {
                    this.state = PlayerState.LOST;
                }
            }
        }
        const resp = {
            userId: this.userId,
            name: this.clearString(this.name),
            pos: this.pos,
            state: this.state,
            score: this.score,
            rank: this.rank,
            mid: this.mid,
            did: this.did,
            prize: this.prize,
            isExitPlayer: this.isExitPlayer
        }
        return resp;
    }

    public get scoreInfo(){
        const resp = {
            userId: this.userId,
            score: this.score,   
        }
        return resp;
    }

    public get logInfo(){
        const resp = {
            userId: this.userId,
            name: this.clearString(this.name),
            state: this.state,
            score: this.score,
            rank: this.rank,
            mid: this.mid,
            did: this.did,
            prize: this.prize,
        }
        return resp;
    }

    public get ID(): string {
        return this.userId;
    }

    public get DID(): string {
        return this.did;
    }

    public get MID(): number {
        return this.mid;
    }

    public get REFER_CODE(): string {
        return this.referCode;
    }

    public get RANK(): number {
        return this.rank;
    }

    public get State() {
        return this.state;
    }

    public get isExitPlayer() {
        return [PlayerState.EXIT, PlayerState.AUTOEXIT].includes(this.state);
    }

    public get SCORE(): number {
        return this.score;
    }
    public get isXFac() {
        return this.playerType == PlayerType.XFAC;
    }

    public set SCORE(val: number) {
        this.score += val;
        // Make sure score must not be negative
        if (this.score < 0) {
            this.score = 0
        }
    }

    public startGame(){
        this.xfac?.startGame();
    }

    public updatePlayerState(state: number, rank?: number, prize?: number): boolean {
        if (prize >= 0) {
            this.prize = prize;
        }
        if (this.rank === -1) {
            this.state = state;
            if (rank >= 0) {
                this.rank = rank;
            }
            return true;
        }
        return false;
    }

    public updateOnGameStart(state: number): boolean {
        this.state = state;
        return true;
    }

    private clearString(str: string) {
        return str.replace(/\W/g, '');
    }
}