import { gameLog } from "utils/logger"
import Mongoose from "mongoose"
import { GameOpts, GameState } from "../../entities/game/game.model"
import { Player } from "../player/player"
import { PlayerState } from "domain/entities/player/player.model"


export class Table {
    protected  _id : string
    protected players : Player[]
    protected capacity : number
    protected isFull : boolean
    protected state : number
    protected turnIndex : number
    protected contestId: string
    public constructor(opts : any) {
        this._id = opts._id || new Mongoose.Types.ObjectId().toString();
        this.capacity = 2;
        this.players = [];
        this.state = GameState.WAITING;
        this.isFull = false;
        this.turnIndex = 0;
        this.contestId = opts.contestId || ""
    }
    public get Capacity() {
        return this.capacity;
    }
    public initTable(capacity:number) {
        this.capacity = capacity || 2;
    }
    public get ID() : string {
        return this._id; 
    }
    setPlayerPos(i:number ) : number{
        if(this.capacity == 2) {
            console.log("\n Capacity is ", this.capacity);
            console.log("\n Capacity value is ", i*2);
            return i*2;
        }
        else{
            console.log("\n Capacity is ", this.capacity);
            console.log("\n Capacity value is ", i);
            return i;
        }
    }
    public onFullTable() : boolean{
        if(this.players.length === this.capacity) {
            this.isFull = true;
            this.players.forEach((p,i)=>{
                p.updateOnGameStart(PlayerState.PLAYING)
            //     // p.initPlayerPos(this.capacity, i)
            });
            return true;
        }
    }

    public get IS_FULL(): boolean{
        return this.isFull;
    }

    public canJoin(userId:string) : boolean {
        console.log(this.ID, this.players, userId)
        if(this.isFull) return false;
        for (let index = 0; index < this.players.length; index++) {
            console.log("playerID userID", this.players[index].ID, userId);
            if(this.players[index].ID.toString() == userId.toString()) {
                console.log("Return False ");
                return false;
            }
        }
        return true;
    }   
    public canLeave(userId: string): boolean {
        for (let index = 0; index < this.players.length; index++) {
            // Only player who are in game and game is not running can leave the game.
            // console.log(this.players[index].ID.toString(), userId.toString() ,this.isRunning())
            if(this.players[index].ID.toString() == userId.toString() && !this.isFull) {
                gameLog(this.ID,'Yes player can leae', this.state)
                return true
            }
        }
        gameLog(this.ID,'Player  cannot leave');
        return false
    }
    public isRunning() : boolean {
        if(this.state === GameState.RUNNING) {
            return true;
        }
        return false;
    }

    public isFinished(): boolean{
        return this.state == GameState.FINISHED
    }

    public isDestroyed(): boolean{
        return this.state == GameState.DESTROYED
    }

    public isWaiting(): boolean{
        return this.state == GameState.WAITING
    }

    public setState(state: GameState){
        this.state = state
    }


    public get CONTEST_ID(): string{
        return this.contestId;
    }
}