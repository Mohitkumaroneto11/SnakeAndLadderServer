import { gameLog } from 'utils/logger'
import { Table } from '../table/table';
import { Player } from '../player/player';
import { PlayerOpts, PlayerState } from 'domain/entities/player/player.model';
import { ContestData, GameConfig, GameState, GameLevel, GameWinningData, JoinContestResponse } from 'domain/entities/game/game.model';
import { BaseHttpResponse } from 'utils';
import { GameServer } from 'application';
import { ContestWinnerRequest, TransactionTokenRequest } from 'domain/entities/transaction/transaction.dto';
import { sendGameEndEvent } from 'utils/game';
import { TableManager } from '../table/table.manager';
const TURN_TIME = 13000;
const GAME_TIME = 120000;
const DELAY_IN_GAME_END = 2000;
const DELAY_IN_GAME_START = 5000;
const DELAY_IN_PRE_GAME_START = 1000;
const TOTAl_GAME_TURNS = 5;

export class Game extends Table {
    private timeout: NodeJS.Timeout
    private gameStartTime: number
    public gameTime: number
    private gameTimer: NodeJS.Timeout
    private isGameTimeOver: boolean
    public roomId: number;
    private gameTurnRemaining: number;
    public gameConfig: GameConfig;
    public gameLevel: GameLevel;
    public xFacLogId: number;
    public xFacId: string;
    public gameId: number;

    private isOnGameEndCallbackCalled: boolean
    public constructor(opts: any) {
        super(opts);
        this.gameTime = opts.gameTime || GAME_TIME;
        this.gameStartTime = Date.now();
        this.isGameTimeOver = false;
        this.isOnGameEndCallbackCalled = false
        this.gameTurnRemaining = opts.gameTurnRemaining || TOTAl_GAME_TURNS;
        this.gameConfig = opts.gameConfig;
        this.gameLevel = GameLevel.NORMAL
        this.xFacLogId = opts.xFacLogId;
        this.gameId = opts.gameId;
    }
    public initTableOnRestart(opts: any) {
        this._id = opts._id;
        this.capacity = opts.capacity;
        this.state = opts.state;
        this.isFull = opts.isFull;
        this.gameTime = opts.gameTime;
        this.gameStartTime = opts.gameStartTime;
        this.isGameTimeOver = opts.isGameTimeOver;
        this.roomId = opts.roomId;
        this.contestId = opts.contestId;
        this.isOnGameEndCallbackCalled = opts.isOnGameEndCallbackCalled
        this.gameTurnRemaining = opts.gameTurnRemaining
        this.gameConfig = opts.gameConfig;
        this.gameLevel = opts.gameLevel || GameLevel.NORMAL;
        this.xFacLogId = opts.xFacLogId;
        this.xFacId = opts.xFacId;
        this.players = opts.players.map((p: any) => { const player = new Player(p); player.initOnRestart(p, this); return player; });
        this.reStartGameCountDown();
        gameLog('common', 'Game state reload=>', this);
    }

    public updateScore(playerId: string, score: number) {
        if (this.state != GameState.RUNNING) {
            const error = new BaseHttpResponse(null, "Game not in running state !" + this.state, 400, this.ID);
            return error;
        }
        let player = this.getPlayerById(playerId);
        player.SCORE = score;
        let resp = {
            _id: this._id,
            players: this.players.map(p => p.scoreInfo),
            playedBy: playerId
        }
        console.log('Resp of score update', resp);
        let httpResp = new BaseHttpResponse(resp, null, 200, this.ID)
        this.emit(httpResp, 'updateScore');
        this.sendLogInMongo('updateScore', playerId)
        this.gameSyncInRedis()
        return httpResp;
    }

    public async onExitGame(playerId: string): Promise<any> {
        this.log("Player exit from game reason -");
        const exitPlayer = this.players.filter(player => player.ID == playerId);
        if (exitPlayer && exitPlayer.length == 0) {
            console.error("Player Id doesnt exits ", playerId);
            return false
        }
        this.log(`Updateing player state on exit -`, exitPlayer[0].ID)
        exitPlayer[0].updatePlayerState(PlayerState.EXIT);

        let resp = {
            players: this.players.map(p => { const resp = p.playerInfo; console.log("player , ", resp); return resp; }),
            state: this.state,
            roomId: this.roomId,
        }
        this.log('Player exit successfully', exitPlayer[0].ID)
        var httpResp = new BaseHttpResponse(resp, null, 200, this.ID);
        GameServer.Instance.socketServer.emitToSocketRoom(this.ID, "exitGame", httpResp);

        await this.gameEnd();
        this.sendLogInMongo('exitGame', playerId);
        return httpResp
    }

    public onGameSync(playerId: string) {
        const diff = Date.now() - this.gameStartTime;
        let gameTimeRemain = (diff > this.gameTime) ? this.gameTime : diff;
        gameTimeRemain = this.gameTime - gameTimeRemain;

        console.log("game time Remaining...", gameTimeRemain);

        return {
            _id: this.ID,
            players: this.players.map(p => p.playerInfo),
            state: this.state,
            capacity: this.capacity,
            gameTimeRemaining: gameTimeRemain,
            gameTime: this.gameTime,
            roomId: this.roomId ? this.roomId.toString() : '',
            gameStartTime: this.gameStartTime,
            gameTurnRemaining: this.gameTurnRemaining,
        };
    }

    public async join(playerOpts: PlayerOpts, contestData: ContestData, gameLevel: GameLevel = GameLevel.NORMAL, xFacId: string = null): Promise<any> {
        let isRunning: boolean = false;
        let joiningSuccess: boolean = false;
        if (this.canJoin(playerOpts._id)) {
            const newPlayer = new Player(playerOpts);
            this.players.push(newPlayer);
            isRunning = this.onFullTable();
            this.gameLevel = gameLevel;
            this.xFacId = xFacId
            joiningSuccess = true
        }
        this.printPlayerArr();
        let resp = {
            _id: this._id,
            players: this.players.map(p => p.playerInfo),
            capacity: this.capacity,
            isFull: this.isFull,
            state: this.state,
            isRunning: isRunning,
            timeRemaining: -1,
            gameTime: this.gameTime,
            roomId: this.roomId,
            joiningSuccess: joiningSuccess,
            // waitingTime: contestData.GameStartInSeconds * 1000
        };
        if (resp.joiningSuccess == true) {
            const httpResp = new BaseHttpResponse(resp, null, 200, this.ID);
            this.log(`Joining success of user ${playerOpts.name} call matchInit on room. Game is running ${isRunning}`, httpResp)
            this.emit(httpResp, 'matchInit')
            if (isRunning) {
                await this.onPreGameStart(contestData);
            }
        }
        return resp
    }

    private async onPreGameStart(contestData: ContestData) {
        try {
            const deductBalanceResponse: JoinContestResponse = await GameServer.Instance.TransactionMethods.JoinContest(this.getTransactionData())
            this.log(`Deductig balance before start game`, deductBalanceResponse, deductBalanceResponse.RoomId);
            // await ServerService.Instance.addGame(deductBalanceResponse.RoomId.toString())
            this.roomId = deductBalanceResponse.RoomId


            const redisData: any = this.redisStartGameData();
            this.sendLogInMongo('preStartGame');
            const response = await GameServer.Instance.GameServices.createGameEntryOnStart(redisData);
            console.log("resp after updating....", response);
            let resp = {
                _id: this._id,
                players: this.players.map(p => p.playerInfo),
                capacity: this.capacity,
                isFull: this.isFull,
                state: this.state,
                isRunning: this.isRunning(),
                timeRemaining: -1,
                gameTime: this.gameTime,
                roomId: this.roomId,
                gameStartIn: DELAY_IN_GAME_START - DELAY_IN_PRE_GAME_START,
                gameTurnRemaining: this.gameTurnRemaining
            };
            const httpResp = new BaseHttpResponse(resp, null, 200, this.ID);
            this.log(`Sending prestartgame event`, httpResp);
            setTimeout((httpResp) => {
                GameServer.Instance.socketServer.emitToSocketRoom(this.ID, 'preStartGame', httpResp);
            }, 1000, httpResp)
            // this.emit(httpResp, 'preStartGame')

            setTimeout(this.onGameStart.bind(this, contestData), DELAY_IN_GAME_START - DELAY_IN_PRE_GAME_START);
        } catch (err) {
            this.state = GameState.WAITING
            this.log(`Error while onGameStart and destroying game`, err)
            this.destroyRoom();
            throw err;
        }
    }

    private async onGameStart(contestData: ContestData) {
        try {
            this.state = GameState.RUNNING;
            this.gameStartTime = Date.now();
            GameServer.Instance.GameCount.inc();
            this.startGameCountDown();
            let resp = {
                _id: this._id,
                players: this.players.map(p => p.playerInfo),
                capacity: this.capacity,
                isFull: this.isFull,
                state: this.state,
                isRunning: this.isRunning(),
                timeRemaining: -1,
                gameTime: this.gameTime,
                roomId: this.roomId,
                gameStartTime: this.gameStartTime,
                gameStartIn: DELAY_IN_GAME_START - DELAY_IN_PRE_GAME_START,
                gameTurnRemaining: this.gameTurnRemaining
            };
            this.sendLogInMongo('startGame');
            const httpResp = new BaseHttpResponse(resp, null, 200, this.ID);
            this.log('Sending startGame event ', httpResp);
            this.emit(httpResp, 'startGame')
            this.players.forEach(player=>{
                if(player.isXFac){
                    player.startGame();
                }
            })

        } catch (err) {
            this.state = GameState.WAITING
            console.log(err)
            this.log(`Error while onGameStart and destroying game`, err)
            this.destroyRoom();
            throw err;
        }
    }

    private printPlayerArr() {
        console.log("players info");
        this.players.forEach(player => {
            console.log("\n ", player.playerInfo);
        })
    }

    private getTransactionData() {
        var data: TransactionTokenRequest = {
            cid: Number(this.CONTEST_ID),
            userList: [],
            gameserverid: this.ID,
            gameId: this.gameId
        }
        for (let i = 0; i < this.players.length; i++) {
            let player = this.players[i]
            data.userList.push({
                UserId: player.DID,
                UserLoginId: player.MID,
                ReferCode: player.REFER_CODE
            })
        }
        return data
    }

    public canJoin(userId: string): boolean {
        console.log(this.ID, this.players, userId)
        if (this.isFull) return false;
        for (let index = 0; index < this.players.length; index++) {
            console.log("playerID userID", this.players[index].ID, userId);
            if (this.players[index].ID.toString() == userId.toString()) {
                console.log("Return False ");
                return false;
            }
        }
        return true;
    }

    private mongoStartGameData(): any {
        return {
            _id: this._id,
            state: this.state,
            startedAt: Date.now(),
            players: this.players.map(p => p.playerInfo),
            gameId: this.gameId
        }
    }

    private redisStartGameData(): any {
        const resp = {
            _id: this._id,
            capacity: this.capacity,
            isFull: this.isFull,
            state: this.state,
            startedAt: Date.now(),
            gameStartTime: this.gameStartTime,
            gameTime: this.gameTime,
            isGameTimeOver: this.isGameTimeOver,
            roomId: this.roomId,
            contestId: this.CONTEST_ID,
            isOnGameEndCallbackCalled: this.isOnGameEndCallbackCalled,
            players: JSON.stringify(this.players.map(p => p.playerProperties())),
            gameConfig: this.gameConfig,
            gameLevel: this.gameLevel,
            xFacLogId: this.xFacLogId,
            xFacId :this.xFacId,
            gameId: this.gameId
        }
        // return JSON.stringify(resp);
        return resp;
    }

    private mongoLogGameData(playedBy: string): any {
        const resp: any = {
            _id: this._id,
            state: this.state,
            startedAt: Date.now(),
            gameStartTime: this.gameStartTime,
            contestId: this.CONTEST_ID,
            players: this.players.map(p => p.playerLogProperties()),
            gameLevel: this.gameLevel,
            playedBy: playedBy
        }
        return resp;
    }

    private redisSyncGameData(): any {
        const resp = {
            state: this.state,
            gameTime: this.gameTime,
            isGameTimeOver: this.isGameTimeOver,
            isOnGameEndCallbackCalled: this.isOnGameEndCallbackCalled,
            players: JSON.stringify(this.players.map(p => p.playerProperties())),
        }
        gameLog('common', 'Game sync redis=>', resp)
        return resp;
    }

    private async sendLogInMongo(evName: string, playedBy: string = null) {
        let ack = await GameServer.Instance.RabbitMQ.pushToLogQueue({
            evName: evName,
            GameId: this.gameId,
            roomId: this.roomId,
            evTimestamp: Date.now(),
            data: this.mongoLogGameData(playedBy)
        })
        this.log('Rabbit log ack', evName, ack);
    }

    private startGameCountDown() {
        this.gameTimer = setTimeout(this.onGameCountDownCallback.bind(this), this.gameTime);

    }

    private reStartGameCountDown() {
        const timeRemaining = this.gameTime - (Date.now() - this.gameStartTime);
        this.gameTimer = setTimeout(this.onGameCountDownCallback.bind(this), timeRemaining);

    }

    private async onGameCountDownCallback() {
        this.log("\n \n \n Game time is over set isGameTimeOver=true\n \n \n ");
        console.log("\n \n \n GAME IS OVER \n \n \n ");
        this.isGameTimeOver = true;
        this.gameEnd();
    }

    private async gameEnd() {
        const userPrizes = await this.getContestPrize();
        this.log(`User prizes are(onTimeout) - `, userPrizes)
        const players = this.players.map(p => p.playerInfo).sort((a, b) => b.score - a.score);
        players.forEach(player => {
            console.log('Player data', player);
            let isExitPlayer = player.isExitPlayer
            const rank = this.assignRank(player.userId, isExitPlayer);
            const getPlayer = this.getPlayerById(player.userId);
            let state = isExitPlayer ? player.state : PlayerState.WON
            this.log(`Updateing player state on gametimeout -`, getPlayer.ID, state, rank, userPrizes[getPlayer.MID])
            getPlayer.updatePlayerState(state, rank, userPrizes[getPlayer.MID]);
        });
        console.log("players ", players);
        console.log("OnGame Time over ...");
        clearTimeout(this.gameTimer);
        // this.clearAllTimeouts();
        this.state = GameState.FINISHED;
        this.onGameEnd();
    }

    private async onGameEnd() {
        const redisData: any = this.redisStartGameData();
        this.sendLogInMongo('endGame');
        const resp = await GameServer.Instance.GameServices.createGameEntryOnEnd(redisData);
        console.log("resp after updating....", resp);


        if (!this.isOnGameEndCallbackCalled) {
            this.isOnGameEndCallbackCalled = true
            GameServer.Instance.GameCount.dec();
        }
        // this.log(`Decrease counter for contest - ${this.CONTEST_ID} at - ${-(this.Capacity)}`)
        // await GameServer.Instance.ContestMethods.incContestCounter(this.CONTEST_ID, -(this.Capacity));


        let winningData = this.getWinningUserData()
        let ack = await GameServer.Instance.RabbitMQ.pushToWinningQueue(winningData)
        this.log('Winning data ack of rabit mq', ack, winningData)
        this.sendGameEndResp();


    }
    
    private sendGameEndResp() {
        const gameEndResp = {
            players: this.players.map(p => { const resp = p.playerInfo; console.log("player , ", resp); return resp; }),
            state: this.state,
            roomId: this.roomId,
        }
        const httpResp = new BaseHttpResponse(gameEndResp, null, 200, this.ID, true)
        this.log('Set timout for gameEnd resp and destroy room');
        // setTimeout(sendGameEndEvent, DELAY_IN_GAME_END, httpResp, this.ID);
        sendGameEndEvent(httpResp, this.ID)

        this.destroyRoom();

    }

    private getWinningUserData() {
        var data: GameWinningData = {
            RoomId: this.roomId.toString(),
            ContestId: this.CONTEST_ID,
            participantScores: [],
            ExitCount: 0,
            AutoExitCount: 0,
            NormalCount: 0,
            GameId: this.gameId
        };
        let exitCount = 0;
        let autoExitCount = 0;
        let normalCount = 0;
        for (let i = 0; i < this.players.length; i++) {
            let player = this.players[i]
            let score = player.SCORE
            if (player.isExitPlayer) {
                if (player.State == PlayerState.EXIT) {
                    score = -1
                    exitCount++;
                } else {
                    score = -2
                    autoExitCount++;
                }

            } else {
                normalCount++
            }
            data.participantScores.push({
                UserId: player.MID,
                Score: score
            })
        }
        data.ExitCount = exitCount;
        data.NormalCount = normalCount;
        data.AutoExitCount = autoExitCount;
        return data
    }

    public async getContestPrize() {
        try {
            let userPrizes: any = {}
            const prizeReq: ContestWinnerRequest = {
                ContestId: Number(this.CONTEST_ID),
                RoomId: Number(this.roomId),
                ludoParticipantScore: []
            };
            for (let i = 0; i < this.players.length; i++) {
                let currentPlayer = this.players[i];
                // If player exit from game the send score -1 
                prizeReq.ludoParticipantScore.push({
                    UserId: Number(currentPlayer.MID),
                    Score: currentPlayer.isExitPlayer ? -1 : currentPlayer.SCORE
                })
                userPrizes[currentPlayer.MID] = 0;
            }
            let prizeResp;

            prizeResp = await GameServer.Instance.TransactionMethods.getContestWinners(prizeReq, this.ID);
            for (let i = 0; i < prizeResp.length; i++) {
                userPrizes[prizeResp[i]?.UserId] = prizeResp[i]?.Amount
            }
            this.log('User prize data=>', prizeReq, prizeResp, userPrizes);
            return userPrizes

        } catch (err) {
            this.log('Error while getting user prize', err);
            throw err;
        }

    }

    private assignRank(playerId: string, isExit: boolean): number {
        console.log("assignRank , playerid ", playerId);
        const data = this.players.filter(p => {
            console.log("p id player id ", p.ID, " - ", playerId);
            if (p.ID == playerId) {
                return p;
            }
        });
        console.log("data  ", data);
        if (data && data.length == 0) {
            const err = new Error();
            err.name = "1";
            err.message = "Invalid user found";
            throw err;
        }
        const player = data[0];
        if (player.RANK >= 0) {
            return player.RANK;
        }
        const ranks = this.players.map(p => p.RANK);
        console.log("ranks ", ranks);
        console.log("capcity ", this.capacity);
        if (isExit) {
            for (let i = this.capacity - 1; i >= 0; i--) {
                console.log("i ", i);
                const exist = ranks.includes(i);
                console.log("exist ", exist);
                if (exist == false) {
                    return i;
                }
                continue;
            }
        }
        else {
            for (let i = 0; i < this.capacity; i++) {
                console.log("i ", i);
                const exist = ranks.includes(i);
                console.log("exist ", exist);
                if (exist == false) {
                    return i;
                }
                continue;
            }
        }
    }

    private getPlayerById(playerId: string) {
        for (let i = 0; i < this.players.length; i++) {
            if (this.players[i].ID == playerId) {
                return this.players[i];
            }
        }
    }

    private async gameSyncInRedis() {
        const resp = await GameServer.Instance.GameServices.syncGameState(this._id, this.redisSyncGameData())
    }

    public destroyRoom() {
        this.log(`Destroy game`, this.gameLevel)
        if (this.gameLevel != GameLevel.NORMAL) {
            this.players.forEach((player) => {
                if (player.isXFac) {
                    player.xfac.destroyOnEnd(this.xFacLogId)
                }
            })
        }
        TableManager.deleteTableFromMap(this.ID);
        TableManager.removeTableFromRunningGroup(this.ID);
    }

    public isExpired() {
        return ((Date.now() - this.gameStartTime) > 60000) && this.isWaiting()
    }

    public getWinnerId(): number {
        this.log('Player at winnerId', this.players);
        let winnerId: number = null;
        this.players.forEach((player) => {
            if (player.State == PlayerState.WON) {
                winnerId = player.MID
            }
        })
        return winnerId
    }

    public set GAME_CONFIG(val: GameConfig) {
        this.gameConfig = val
    }

    private emit(data: any, event: string) {
        GameServer.Instance.socketServer.emitToSocketRoom(this.ID, event, data);
        return true;
    }

    private getPlayer(playerId: string){
        return this.players.find((p)=> p.ID == playerId)
    }

    public log(...args: any) {
        gameLog(this.ID, args);
        return
    }

    public getOpponentScore(playerId: string): number{
        return this.players.find((p)=> p.ID != playerId)?.SCORE
    }

    public getOpponentMid(playerId: string): number{
        return this.players.find((p)=> p.ID != playerId)?.MID
    }

    public getPlayerScore(playerId: string): number{
        return this.players.find((p)=> p.ID == playerId)?.SCORE
    }

    public isPlayerExist(playerId: string){
        let isExist = false;
        this.players.forEach((player)=>{
            if(player.ID.toString().toLowerCase() == playerId.toString().toLowerCase()){
                isExist = true
            }
        })
        return isExist
    }
}