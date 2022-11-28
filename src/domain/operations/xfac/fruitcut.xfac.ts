import { GameServer } from "application";
import { ContestData } from "domain/entities/game/game.model";
import { IUser } from "domain/entities/user/user.model";
import { XFacGameLog } from "domain/entities/xfac/xfac.dto";
import { AuthenticationService } from "middleware/auth";
import { gameLog } from "utils/logger";
import { Game } from "../game/game";
import { User } from "../user/user";
import { XFacAbstract } from "./xfac.abstract";
import { XFacService } from "./xfac.service";

const enum LEVEL {
    EASY = 2,
    MEDIUM = 3,
    HARD = 4

}
export class FruitCutXFac extends XFacAbstract {
    private user: User
    private game: Game
    private opponentId: number;
    private level: number;
    private isResultLogged: boolean = false;
    private xFacLogId: number;
    private turnCount: number;
    private opponent: { lastScore: number, isPlaying: boolean } = { lastScore: 0, isPlaying: true }
    private speed = 1
    constructor(game: Game) {
        super(game);
        this.game = game;
        this.game.log('Xfac created', this.user)
    }

    public async initOnRestart() {
        let userData: IUser;
        console.log('Game object on restart=>', this.game)
        if (this.game?.xFacId) {
            userData = await this.getUserDataFromId(this.game.xFacId);
            this.level = this.game?.gameLevel;
            console.log('USER DATA ON restart=>', userData, this.game?.xFacId)
            this.user = new User(null, userData, this)
            this.user.game = this.game
            this.opponentId = this.game.getOpponentMid(this.user.playerOpts._id);
            this.startGame();
        }
    }

    public async joinMatch(opponentId: number, xFacId: string = null, level: number = null) {
        try {
            const contestData = await GameServer.Instance.ContestMethods.getContestById(this.game.CONTEST_ID, this.game.gameId);
            this.opponentId = opponentId;
            let userData: IUser;
            if (xFacId) {
                userData = await this.getUserDataFromId(xFacId);
                this.level = level
            } else {
                userData = await this.getUserDataForXFac(contestData)
            }
            // userData.name = 'x_'.repeat(this.level) + userData.name

            console.log('User data', userData)
            this.user = new User(null, userData, this)

            let joinResp = await this.game.join(this.user.playerOpts, contestData, this.level, this.user.playerOpts._id);
            this.game.log('XFac success in join match', joinResp);
            this.user.game = this.game
        } catch (err) {
            this.game.log('Error in XFac joining=>', err);
            this.freeSelf()
            throw err
        }

    }

    private async freeSelf() {
        await XFacService.Instance.freeXfacUSer(this.user?.playerOpts.did, this.game?.ID)
    }

    private async getUserToken(contestData: ContestData) {
        // Call method to get user id
        // Call method to get user token
        try {
            let xFacUserData = await XFacService.Instance.getUserToken(contestData.ja, contestData.mba, this.game.ID, this.opponentId, this.game.gameId);
            this.level = xFacUserData.xFacLevel;
            this.xFacLogId = xFacUserData.xFacLogId;
            this.game.xFacLogId = this.xFacLogId;
            return xFacUserData.token
        } catch (err) {
            this.game.log('Error in getUserToken', err);
            return null
        }

    }

    private async getUserDataForXFac(contestData: ContestData) {
        let userToken = await this.getUserToken(contestData);
        if (!userToken) throw new Error('Unable to create token for xfac')
        let user: IUser = AuthenticationService.validateToken(userToken);
        if (!user) throw new Error('Unable to create user for xfac')
        return user;
    }

    private async getUserDataFromId(userId: string) {
        let userToken = await XFacService.Instance.getToken(userId);
        let user: IUser = AuthenticationService.validateToken(userToken);

        if (!user) throw new Error('Unable to create user for xfac')
        return user;
    }

    private async playGame() {
        try {
            if (!this.game?.isRunning()) {
                return
            }
            this.turnCount++;
            this.game?.log('XFac play game=>', this.turnCount);
            const SCORE_LIST: any = {
                2: [1, 2, 4, 9],
                3: [1, 2, 4, 9, 16],
                4: [4, 9, 16, 25, 36]
            }
            if (!this.game.isRunning()) {
                console.log('Game is ended')
                return
            }
            let noOfCut = this.randomNumber(0, SCORE_LIST[this.level].length - 1)
            let score = SCORE_LIST[this.level][noOfCut]
            if (this.turnCount % 3 == 0) {
                this.game?.log('3rd chance come score =1');
                score = 1
            }
            let time = this.randomNumber(650, 750)
            let actualTime = Math.floor(time * Math.sqrt(score))
            this.log('Xfac playTurn=>', score, time, actualTime, this.speed, actualTime * this.speed);
            await this.updateScore(score, this.game.ID);
            setTimeout(this.playGame.bind(this), actualTime * this.speed);
        } catch (err) {
            this.log('Error in playturn=>', err.toString())
        }

    }

    public async startGame() {
        this.turnCount = 0;
        setTimeout(this.playGame.bind(this), 4000);
        // setInterval(this.checkOpponentStatus.bind(this), 5000);
        setInterval(this.ai.bind(this), 500);
    }



    private randomNumber(min: number, max: number) {
        if (min > max) {
            return 0
        }
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    private ai() {
        try {
            const DELTA = 50;
            const RETARDATION = 0.1
            const MIN_SPEED = 0.5
            const MAX_SPEED = 2.0

            const opponentScore = this.game?.getOpponentScore(this.user?.playerOpts._id)
            if (opponentScore == undefined) {
                return
            }

            const scoreDiff = this.game.getPlayerScore(this.user?.playerOpts._id) - opponentScore;
            this.log('Self score=>', this.game.getPlayerScore(this.user?.playerOpts._id), 'Opponent score=>', opponentScore, 'Score diff=>', scoreDiff, 'Level=>', this.level, 'Speed=>', this.speed)
            // this.log('Scores on ai=>', scoreDiff, opponentScore, this.level, this.speed);
            // Fast = speed - retardation
            // Slow = speed + retardation
            if (this.level == LEVEL.EASY) {
                if (scoreDiff >= -DELTA) {
                    this.log('Speed easy decrease')
                    this.speed = this.speed + RETARDATION
                } else {
                    this.log('Speed easy increase')
                    this.speed = this.speed - RETARDATION
                }
            } else if (this.level == LEVEL.MEDIUM) {
                if (scoreDiff > DELTA) {
                    this.log('Speed medium decrease')
                    this.speed = this.speed + RETARDATION
                } else if (scoreDiff < -DELTA) {
                    this.log('Speed medium increase')
                    this.speed = this.speed - RETARDATION
                }
            } else if (this.level == LEVEL.HARD) {
                if (scoreDiff < DELTA * 2) {
                    this.log('Speed hard increase')
                    this.speed = this.speed - RETARDATION
                } else {
                    this.log('Speed hard decrease')
                    this.speed = this.speed + RETARDATION
                }
            }
            if (this.speed < MIN_SPEED) {
                this.log('Speed found min speed')
                this.speed = MIN_SPEED
            } else if(this.speed > MAX_SPEED){
                this.log('Speed found max speed')
                this.speed = MAX_SPEED
            }
            this.speed = Math.round(this.speed * 10) / 10
            this.log('New speed is=>', this.speed);
        } catch (err) {
            this.log('Error in ai', err.toString())
        }

    }

    private checkOpponentStatus() {
        try {
            this.log('Checking opponent status')
            let currentScore = this.game.getOpponentScore(this.user?.playerOpts?._id);
            if (currentScore == this.opponent.lastScore) {
                this.log('Found player not playing')
                this.opponent.isPlaying = false
            } else {
                this.opponent.isPlaying = true;
            }
            this.opponent.lastScore = currentScore;
            return
        } catch (err) {
            this.log('Error in checkOpponentStatus', err.toString())
        }
    }

    private async updateScore(score: number, gameId: string) {
        await this.user.onUpdateScore({ score, gameId }, () => { })
    }

    private log(...args: any) {
        gameLog('xfac-' + this.game?.ID, args);
        return
    }

    public async destroyOnEnd(xFacLogId: number) {
        if (!this.isResultLogged) {
            let winnerId = this.game.getWinnerId();
            let result = winnerId == this.user.playerOpts.mid ? false : true
            let logData: XFacGameLog = {
                UserId: this.opponentId,
                XFacId: this.user.playerOpts.mid,
                XFacLevel: this.level,
                RoomId: this.game.roomId,
                Result: result,
                ContestId: this.game?.CONTEST_ID ? parseInt(this.game.CONTEST_ID) : null,
                xFacLogId: xFacLogId || this.xFacLogId
            }
            this.game.log('Send xfac logs', logData, winnerId, this.user.playerOpts.mid)
            await XFacService.Instance.saveXFacGameLog(logData, this.game.gameId)
        }
        this.user.game = null;
        this.game = null;
        this.user = null;
        return;
    }

}