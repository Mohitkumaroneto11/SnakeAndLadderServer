import { PlayerOpts, PlayerState, PlayerType } from "domain/entities/player/player.model"
import { WINNING_POSITION } from '../../entities/game/game.model'
import { Game } from "../game/game"
import { FruitCutXFac } from "../xfac/fruitcut.xfac"
import { XFacAbstract } from "../xfac/xfac.abstract"
import { XFacManager } from "../xfac/xfac.manager"
import { pathValue, getPawnIndex, PLAYER_PATH, SAFE_CELLS, validateNewPosition, getRouteFirstValue, totalDistance } from '../game/path'
export const EXIT_COIN_POSITION = 0
export class Player {
    private userId: string
    private name: string
    private color: number
    private pos: number
    private sixers: number
    
    private pawnStack: Array<number>
    private state: number
    private hasKilled: boolean
    private score: number
    private rank: number
    private skip: number
    private initPosition: number
    private did: string
    private mid: number;
    private referCode: string;
    private prize: number;
    private totalGameWinner: number;
    private playerType: PlayerType;
    public xfac: XFacAbstract;
    private dvStack: Array<number>;
    constructor(opts: PlayerOpts) {
        console.log("Player opts ", opts);
        this.userId = opts._id;
        this.mid = opts.mid
        this.did = opts.did
        this.name = opts.name;
        this.referCode = opts.referCode
        this.color = opts.pos != undefined ? (opts.pos + 1) : undefined;
        this.pos = opts.pos;
        this.initPosition = opts.pos != undefined ? PLAYER_PATH[opts.pos][0] : undefined;
        this.pawnStack = opts.pos != undefined ? [this.initPosition, this.initPosition] : [];
        
        this.state = PlayerState.WAITING;
        this.score = 0;
        this.rank = -1;

        this.totalGameWinner = opts.totalGameWinners
        this.playerType = opts.playerType ? opts.playerType : PlayerType.HUMAN;
        this.xfac = opts.xfac;
        this.dvStack = [];
        console.log("Position ", this.pos);
        console.log("Paws stack for pos ", this.pos);
        console.log("Paws stack : ", this.pawnStack);
    }
    public initOnRestart(opts: any, game: Game) {
        this.userId = opts.userId;
        this.name = opts.name;
        this.color = (opts.pos + 1);
        this.pos = opts.pos;
        this.initPosition = opts.initPosition;
        this.pawnStack = opts.pawnStack;
        this.state = opts.state;
        this.hasKilled = opts.hasKilled;
        this.score = opts.score;
        this.rank = opts.rank;
        this.skip = opts.skip;
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
            color: this.color,
            pos: this.pos,
            pawnStack: this.pawnStack,
            state: this.state,
            hasKilled: this.hasKilled,
            skip: this.skip,
            score: this.SCORE,
            rank: this.rank,
            initPosition: this.initPosition,
            mid: this.mid,
            did: this.did,
            totalGameWinner: this.totalGameWinner,
            playerType: this.playerType,
            prize: this.prize

        }
        // return JSON.stringify(resp);
        return resp;
    }
    public skipped(yes: boolean): number {
        if (yes) {
            this.skip++;
        }
        else {
            // this.skip = 0;
        }
        return this.skip;
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
            color: this.color,
            pos: this.pos,
            pawnStack: this.pawnStack,
            state: this.state,
            hasKilled: this.hasKilled,
            skip: this.skip,
            score: this.SCORE,
            rank: this.rank,
            // mid: this.mid,
            did: this.did,
            referCode: this.referCode,
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

    public initPlayerPos(capacity: number, playerIndex: number): boolean {
        if (capacity == 2) {
            this.pos = playerIndex * 2;
        }
        else {
            this.pos = playerIndex
        }
        this.color = this.pos + 1
        this.initPosition = PLAYER_PATH[this.pos][0];
        this.pawnStack = [this.initPosition, this.initPosition, this.initPosition, this.initPosition];
        return true
    }
    public get POS(): number {
        return this.pos;
    }
    public get isPlaying(): boolean {
        return (this.state === PlayerState.PLAYING) ? true : false
    }
    public removePawnFromBoard() {
        this.pawnStack = [EXIT_COIN_POSITION, EXIT_COIN_POSITION, EXIT_COIN_POSITION, EXIT_COIN_POSITION]
    }
    public sixCounter(bool: boolean): number {
        if (bool) {
            this.sixers++;
            return this.sixers;
        }
        else {
            this.sixers = 0;
            return this.sixers;
        }
    }
    public get DiceValue() {
        return this.dvStack.pop()
    }
    public set DiceValueStack(values: Array<number>) {
        this.dvStack.push(...values);
    }
    public canMoveAnyPawn(diceValue: number) {
        const arr: any[] = this.pawnStack.map(pawnPos => {
            return validateNewPosition(this.pos, pawnPos, diceValue, this.hasKilled);
        })
        console.log("can Move Arr ", arr);
        const some = arr.some(isTrue => isTrue);
        console.log("some movable  ", some);
        return some;
    }

    public get DiceValueStack() {
        return this.dvStack;
    }
    public getPawnPosition(pawnIndex: number): number {
        return this.pawnStack[pawnIndex];
    }
    public updateHasKilled() {
        console.log("\n \n Hash Killed oppnent .......", this.ID);
        this.hasKilled = true;
    }
    public get killedBefore(): boolean {
        return this.hasKilled;
    }
    private updatePos(index: number, pos: number) {
        this.pawnStack[index] = pos;
    }
    private updateWinningStatus(): boolean {
        let homeTokens = 0;
        this.pawnStack.forEach(coin => {
            if (coin === WINNING_POSITION) {
                homeTokens++;
            }
        });
        console.log("\n Home tokens ", homeTokens);
        // const won = this.pawnStack.every(
        //     (coin) => coin === WINNING_POSITION
        // );
        if (homeTokens >= 4) {
            this.state = PlayerState.WON;
            return true;
        }
        return false;
    }
    public setCoinPosition(pawnIndex: number, diceValue: number): boolean {
        const position = this.pawnStack[pawnIndex];
        if (position) {
            const positionIndex = getPawnIndex(this.pos, position, this.hasKilled);
            const newPositionIndex = diceValue + positionIndex;
            const newPosition = pathValue(this.pos, newPositionIndex, this.hasKilled);
            this.updatePos(pawnIndex, newPosition);
            return this.updateWinningStatus();
            // return true;
            // 
        }
        else if (diceValue === 6) {
            const startPos = getRouteFirstValue(this.pos);
            this.updatePos(pawnIndex, startPos);
            return false;
        }
    }
    public get hasWon(): boolean {
        return (this.state === PlayerState.WON) ? true : false
    }
    public getPawnStack(): Array<any> {
        return this.pawnStack;
    }
    getHomeCoinsCount(): number {
        return this.pawnStack.filter((pos) => pos === 100).length;
    }
    public eliminateCoin(pawnPos: number): number {
        for (let i = 0; i < this.pawnStack.length; i++) {
            if (this.pawnStack[i] == pawnPos) {
                this.pawnStack[i] = this.initPosition;
                return i;
            }
        }
    }
}