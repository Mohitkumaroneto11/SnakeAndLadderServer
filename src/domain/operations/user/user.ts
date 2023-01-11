import * as socketIO from 'socket.io'
import { BaseHttpResponse } from 'utils/base.http.response'
import { GameServer } from 'application'
import { gameLog } from 'utils/logger'
import { MSG_STATUS, RabbitMQ } from 'infra/queue.context'
import { ExitReason, PlayerOpts, PlayerState, PlayerType } from 'domain/entities/player/player.model'
import { IUser } from 'domain/entities/user/user.model'
import { TableManager } from '../table/table.manager'
import { ERROR_CODE } from 'utils/error.dto'
import { GameConfig, GameState } from 'domain/entities/game/game.model'
import { Game } from '../game/game'
import { XFacAbstract } from '../xfac/xfac.abstract'
import { FruitCutXFac } from '../xfac/fruitcut.xfac'
import { XFacManager } from '../xfac/xfac.manager'
const WAITING_TIME = Number(process.env.WAITING_TIME);
export class User {
    private userId: string
    private name: string
    private did: string
    private mid: number;
    private referCode: string;
    private waitTimer: number;
    private socket: socketIO.Socket
    private waitingTimer: NodeJS.Timeout
    public game: Game
    public xfac: XFacAbstract
    private playerType: PlayerType;
    constructor(socket: socketIO.Socket, user: IUser, xfac: XFacAbstract = null) {
        this.userId = user._id;
        this.name = user.name;
        this.did = user.did;
        this.mid = user.mid;
        this.referCode = user.referCode
        this.waitTimer = WAITING_TIME;
        this.xfac = xfac;
        this.playerType = xfac ? PlayerType.XFAC : PlayerType.HUMAN;
        socket ? this.initSocketEvents(socket) : null;
    }
    private initSocketEvents(socket: socketIO.Socket) {
        this.socket = socket;
        this.socket.on("exitGame", this.onExitGame.bind(this));
        this.socket.on("gameSync", this.onGameSync.bind(this));
        this.socket.on("pingPong", this.onPingPong.bind(this));
        this.socket.on("disconnect", this.onDisconnect.bind(this));
        this.socket.on("disconnecting", this.onDisconnecting.bind(this));
        this.socket.on('joinGame', this.onJoinGame.bind(this));
        this.socket.on('gameEntry', this.onGameEntry.bind(this));
        this.socket.on("rollDice", this.onRollDice.bind(this));
        this.socket.on("movePawn", this.onMovePawn.bind(this));
        this.socket.on("usepowercard", this.onPowerCard.bind(this));
        
        //this.socket.on('updateScore', this.onUpdateScore.bind(this))
    }

    private startWaitingTimeout(time: number = 0) {
        this.waitTimer = time || this.waitTimer
        this.waitingTimer = setTimeout(this.onWaitingTimeout.bind(this), this.waitTimer);
    }

    private clearTimeout() {
        clearTimeout(this.waitingTimer);
    }
    private async onPingPong(body: any, callback: any) {
        console.log("onPingPong ", body);
        const clientTs = body.ts;
        if (callback) {
            callback({ ts: Date.now() });
        }
    }

    private async onDisconnect(reason: any) {
        try {
            console.log(this.name, 'disconnect');
            this.game?.log("\n user onDisconnect  reason ", this.name, reason);
            let remainingPlayerOnServer = GameServer.Instance.removePlayer(this.userId);
            if (this.game) {
                if (this.game.isFinished()) {
                    this.game.log('User disconnect and we removing game from memory ->', this.name, this.game.ID)
                    console.log("table id ", this.game.ID);
                    TableManager.deleteTableFromMap(this.game.ID);
                    TableManager.removeTableFromRunningGroup(this.game.ID);
                    this.game = null;
                } else if (this.game.isWaiting()) {
                    let game = this.game
                    // let resp = this.removeFromGameLobby()
                    game.log('User disconeect while game is in waiting', game.ID, this.name);
                }
                this.game?.log('Remaining player on sserve', remainingPlayerOnServer);

            }
            GameServer.Instance.UserCount.dec();

        } catch (error) {
            console.error(error);

        }
    }

    private async onDisconnecting(reason: any) {
        console.log('User is disconnecting')
        this.game?.log(`${this.name} is disconnecting`, reason);
    }

    private async onGameSync(body: any, callback: any) {
        gameLog(body.gameId, `Sync req come from ${this.name}`, body);
        const gameId = body.gameId || body.tableId || "";
        let game = this.game || TableManager.getTableFromMemory(gameId) || await TableManager.fetchTableStateRedis(gameId);
        game?.log('game object on game sync', game)
        let resp: any;
        if (!game) {
            resp = new BaseHttpResponse({}, "No Game Found", ERROR_CODE.GAME_ENDED, this.game?.ID);
        } else if (game.ID != gameId) {
            resp = new BaseHttpResponse({}, "Invalid Game Id", ERROR_CODE.DEFAULT, this.game?.ID);
        } else if (game.isDestroyed()) {
            resp = new BaseHttpResponse({}, "Opponent not found", ERROR_CODE.NO_OPPONENT_FOUND, this.game?.ID);
        } else if (game.isExpired()) {
            game.setState(GameState.DESTROYED);
            game.destroyRoom()
            resp = new BaseHttpResponse({}, "Opponent not found", ERROR_CODE.NO_OPPONENT_FOUND, this.game?.ID);
        } else if (game) {
            if (game.isFinished()) {
                const data = game.onGameSync(this.userId);
                resp = new BaseHttpResponse(data, null, 200, this.game?.ID);
                TableManager.deleteTableFromMap(game.ID)
            } else {
                const data = game.onGameSync(this.userId);
                resp = new BaseHttpResponse(data, null, 200, this.game?.ID);
                this.joinRoom(game.ID);
                this.game = game;
            }

        } else {
            resp = new BaseHttpResponse({}, "No game found", ERROR_CODE.DEFAULT, this.game?.ID);
        }
        gameLog(gameId, `${this.name} resp of sync is`, resp)
        return callback(resp);
    }
    private async onJoinGame(body: any, callback: any) {
        gameLog(body.gameId, `Join game req come from ${this.name}`, body);
        const gameId = body.gameId || body.tableId || "";
        const maxWaitingTime = body.gameServerTimeoutIn || WAITING_TIME;
        let gameObject = TableManager.getTableFromMemory(gameId);
        gameLog(body.gameId, `Join game req found game in memory for ${this.name}`, gameObject);

        if (!gameObject) {
            gameObject = await TableManager.fetchTableStateRedis(gameId);
        }
        if (!gameObject) {
            let gameStatusOnRabbitMq = await RabbitMQ.getMsgStatus(gameId);
            if (gameStatusOnRabbitMq == MSG_STATUS.CREATED || gameStatusOnRabbitMq == MSG_STATUS.RECEIVED) {
                let resp = new BaseHttpResponse({ tryAfter: 5 }, "Try after sometime", ERROR_CODE.RETRY, this.game?.ID);
                return callback(resp);
            }
        } 
        // else if (gameObject.IS_FULL && !gameObject.isPlayerExist(this.did)) {
        //     gameLog(gameId, 'User try to join game but game is full & user not exist in this game.');
        //     let resp = new BaseHttpResponse(null, "Opponent Not Found", ERROR_CODE.NO_OPPONENT_FOUND, this.game?.ID);
        //     return callback(resp);
        // }
        else if (!gameObject.isDestroyed()) {
            this.game = gameObject;
            let data: any = this.game.onGameSync(this.userId);
            data['syncAfter'] = 5000;
            console.log('Data on join game', data)
            const resp = new BaseHttpResponse(data, null, 200, this.game?.ID);
            console.log("gameObject ", this.game);
            this.joinRoom(this.game.ID);
            this.game.log(`On game join of ${this.name} resp=>`, resp)
            this.startWaitingTimeout(maxWaitingTime - 7000);
            return callback(resp);
        } else if (gameObject.isFinished() || gameObject.isDestroyed()) {
            return callback(new BaseHttpResponse({}, "Game Is Finsihed", ERROR_CODE.GAME_ENDED, this.game?.ID));
        }

        let error = new BaseHttpResponse({}, "No Game Found", ERROR_CODE.DEFAULT, this.game?.ID);
        return callback(error);
    }
    private async onExitGame(body: any, callback: any) {

        const gameId: string = body.gameId || "";
        let game = TableManager.getTableFromMemory(gameId) || await TableManager.fetchTableStateRedis(gameId);
        this.game = game;
        gameLog('common', "onExitGame event come from : ", this.name, body);
        if (this.game && this.game.isRunning()) {
            this.game.log('OnExit event come from=>', this.name);
            const data = await this.game.onExitGame(this.userId, PlayerState.EXIT, ExitReason.GAME_EXIT);

            const resp = new BaseHttpResponse(data, null, 200, this.game?.ID);
            this.game.log("onExitGame ", resp);
            callback(resp);
            // this.game.log(`OnExit resp=>`, resp)
            // GameServer.Instance.socketServer.emitToSocketRoom(this.game.ID, "exitGame", resp);
            this.game.log('Removing player from socket room on Gameexit', this.userId);
            this.leaveRoom(this.game.ID)

            // if(data.state != GameState.FINISHED){
            //     this.game?.log(`Send rollDice on playerexit ${this.name}`, resp);
            //     GameServer.Instance.socketServer.emitToSocketRoom(this.game.ID, "rollDice", resp);
            // }
        }
    }
    public async onRollDice(body: any, callback: any) {
        try {
            console.log("\n onRollDice Making body ", body);
            console.log(`Role dice event come from ${this.name} =>`, body);
            this.game.log(`Role dice event come from ${this.name} =>`, body);
            console.log("\n dice value ", body.diceValue);
            console.log("\n gameid value ", body.gameId);
            const dv: number = body.diceValue;
            const rollResponse = await this.game.onRollDice(this.userId, dv);
            console.log("\n onRollDice response ", rollResponse);
            const resp = new BaseHttpResponse(rollResponse, null, 200, this.game?.ID);
            callback(resp);
            this.game.log('rolldice resp=>', rollResponse);
            // console.log("\n onRollDice Making resp ", resp);
            GameServer.Instance.socketServer.emitToSocketRoom(this.game.ID, "rollDice", resp);
            return resp
        } catch (error) {
            console.error(error);
            const resp = new BaseHttpResponse(null, JSON.stringify(error), 400, this.game?.ID);
            this.game?.log('Error on rollDice=>', resp)
            callback(resp)
        }
    }
    private async exitBeforeMatchMaking() {
        if (this.game && this.game.isRunning()) {
            await this.game.onExitGame(this.userId, PlayerState.AUTOEXIT, ExitReason.EXIT_BEFORE_MATCH_MAKING);
            // this.game = null;
        }
    }
    public async onMovePawn(body: any, callback: any) {
        try {
            console.log("\n \n onMovePawn body, ", body);
            console.log("\n \n onMovePawn body type ", typeof body);
            this.game.log(`Move pawn event come from ${this.name} =>`, body);
            const pawnIndex = body.pawnIndex || 0;
            const playerPos = body.playerPos;
            const diceValueIndex = body.diceValueIndex || 0;
            if (!this.game) {
                return;
            }
            const moveResponse = await this.game.onMovePawn(this.userId, pawnIndex, diceValueIndex);
            console.log("onMovePawn", moveResponse);
            callback(moveResponse);
        } catch (error) {
            console.error(error);
            const resp = new BaseHttpResponse(null, JSON.stringify(error), 400, this.game?.ID);
            this.game?.log('Error on moveDice=>', resp)
            callback(resp)
        }
    }
    public async onPowerCard(body: any, callback: any) {
        try {
            console.log("\n \n onPowerCard body, ", body);
            console.log("\n \n onPowerCard body type ", typeof body);
            this.game.log(`power card event came from user ${this.name} =>`, body);
            const pawnIndex = body.pawnIndex || 0;
            const playerPos = body.playerPos;
            const powerIndex = body.powerIndex || 0;
            if (!this.game) {
                return;
            }
            const powerCardResponse = await this.game.onPowerCard(this.userId, pawnIndex, powerIndex);
            console.log("onPowerCard", powerCardResponse);
            callback(powerCardResponse);
        } catch (error) {
            console.error(error);
            const resp = new BaseHttpResponse(null, JSON.stringify(error), 400, this.game?.ID);
            this.game?.log('Error on moveDice=>', resp)
            callback(resp)
        }
    }
    private async onGetRoom(body: any, callback: any) {
        var resp = {}
        if (this.game && this.game.isRunning()) {

            resp = {
                _id: this.game.ID
            }
            this.game.log('User hit getRoom', resp)
        }
        console.log('Sending resp for getRoom event', resp)

        let httpResp = new BaseHttpResponse(resp, null, 200, this.game?.ID)
        callback(httpResp);
        this.send("getRoom", resp);
        return

    }
    private async onGameEntry(body: any, callback: any) {
        const gameId = body.gameId
        if (this.game && this.game.ID == gameId) {
            // await this.game.logGameEntry(this.userId);
            callback(new BaseHttpResponse(null, 'Success', 200, this.game.ID));
            return
        }
        callback(new BaseHttpResponse({}, "Something went wrong", ERROR_CODE.DEFAULT, this.game?.ID));
        return
    }

    public async onUpdateScore(body: any, callback: any) {
        let response
        try {
            gameLog(body.gameId, `Score update req come from ${this.name}`, body);
            const score = body.score || 0;
            // if (parseInt(score) <= 64) {
            response = this.game.updateScore(this.userId, score);
            // }
            // else {
            //     response = this.game.updateScore(this.userId, 64);
            // }

            console.log("\n onRollDice response ", response);

        } catch (err) {
            console.error('Error in onUpdateScore', err.toString())
            response = new BaseHttpResponse({}, "Error in updateScore", ERROR_CODE.DEFAULT, this.game?.ID);
        }
        callback(response);
    }
    public get playerOpts(): PlayerOpts {
        return {
            _id: this.userId,
            name: this.name,
            did: this.did,
            mid: this.mid,
            referCode: this.referCode,
            playerType: this.playerType,
            xfac: this.xfac
        }
    }
    private joinRoom(id: string) {
        this.socket.join(id);
    }

    public leaveRoom(id: string) {
        this.socket.leave(id)
    }
    public onUpdatePlayer(userId: string, socket: socketIO.Socket, user: IUser) {
        this.userId = userId;
        this.name = user.name;
        this.did = user.did;
        this.initSocketEvents(socket);
        console.log("\n \n On socket Reconnect ....Game Id ", this.game?.ID);
    }
    public isOnline(): Boolean {
        return (this.socket?.connected == true) ? true : false;
    }
    public playerInfo(): any {
        return {
            userId: this.userId,
            name: this.name
        }
    }

    private async onWaitingTimeout() {
        // return
        this.game?.log('Player wait timeout', this.userId, this.game?.IS_FULL)
        if (this.game && !this.game.IS_FULL) {
            let game = this.game;
            this.game.log('On waiting timeout contgitest data', this.game.gameConfig);
            console.log('On waiting timeout contgitest data', this.game.gameConfig);
            if (this.game.gameConfig == GameConfig.USER_FIRST) {
                this.game?.log('Creating xfac and joining him in match');
                try {
                    let xfac = XFacManager.getXFac(this.game);
                    xfac.joinMatch(this.mid)
                    return
                } catch (err) {
                    console.log(err)
                    this.game?.log('Error in creating xfac', err);
                }

            }
            // else{
            //     await ContestService.Instance.sendNoOpponentLog(this.mid.toString(), game.CONTEST_ID)
            // }

            game.log('Sending wait timeout')
            const resp = new BaseHttpResponse(null, null, 200, this.game?.ID);
            this.send('onWaitingTimeout', resp);
            this.game.setState(GameState.DESTROYED);
            this.game.destroyRoom();

        }
    }

    private send(eventName: string, resp: any) {
        this.socket.emit(eventName, resp);
    }
}