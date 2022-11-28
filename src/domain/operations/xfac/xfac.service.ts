import { GameServer } from "application";
import SQL from "database/sql";
import { GameIds } from "domain/entities/game/game.model";
import { XFacGameLog } from "domain/entities/xfac/xfac.dto";
import Redis from "ioredis";
import needle from "needle";
import { gameLog } from "utils/logger";

export class XFacService {
    sql: SQL;
    private static _instance: XFacService;
    constructor() {
        this.sql = SQL.Instance;
    }
    static get Instance() {
        if (!this._instance) {
            this._instance = new XFacService();
        }
        return this._instance;
    }

    async getUserToken(amount: number, mba: number, gameServerId: string, opponentId: number, gameId: number) {
        try {
            gameLog(gameServerId, 'req for xfac token', amount, mba)
            const proc_contest_name = gameId == GameIds.FRUIT_CUT ? "PROC_GetFruitCutUserForXFacPlay" : "PROC_GetKnifeHitUserForXFacPlay"
            let param_contest = `@Amount=${amount}, @BonusApplicable=${mba}, @UserId=${opponentId}, @RequestFrom='${gameServerId}'`;
            gameLog('xfacLog', 'Getting xfac for ', param_contest);
            let resp = await this.sql.GetDataFromTransaction(proc_contest_name, param_contest);
            gameLog('xfacLog', 'res xfac for ', param_contest, resp);
            gameLog(gameServerId, 'result from get user sp', resp);
            if (resp && resp.length > 0) {
                if(resp[0].ResponseStatus != 1){
                    // gameLog('Response status 0 in getUser SP', resp);
                    throw new Error("Unable to get xfac for user");
                }
                let token = await this.getToken(resp[0].UserId, gameServerId)
                return {
                    token: token,
                    xFacLevel: resp[0].XFacLevel,
                    xFacLogId: resp[0].XFacLogId
                }
            }
            throw new Error("Unable to fetch data from PROC_GetUserForXFacPlay_V2")
        } catch (err) {
            console.log('Error in get xfac user', err);
            throw err
        }
    }

    async getToken(userId: string, gameId: string='default') {
        let reqUrl = `${process.env.XFAC_TOKEN_URL}?UserId=${userId}`
        let resp = await needle('get', reqUrl);
        // console.log(resp)
        gameLog(gameId,  'token api resp', resp.body)
        if (resp.statusCode == 200) {
            return resp.body.access_token
        }
        throw new Error('Unable to get data from token API')
    }

    async saveXFacGameLog(data: XFacGameLog, gameId: number){
        try {
            const proc_contest_name = gameId == GameIds.FRUIT_CUT ? "PROC_CreateFruitCutXFacGameLog": "PROC_CreateKnifeHitXFacGameLog"
            let param_contest = `@UserId=${data.UserId}, @XFacId=${data.XFacId}, @XFacLevel=${data.XFacLevel}, @Result=${data.Result}, @RoomId=${data.RoomId}, @ContestId=${data.ContestId}, @XFacLogId=${data.xFacLogId}`;
            let resp = await this.sql.GetDataFromTransaction(proc_contest_name, param_contest);
        } catch (err) {
            console.log('Error in save xfac user log', err);
            throw err
        }       
    }
    async freeXfacUSer(userMid: string, gameId: string){
        try {
            const proc_contest_name = "PROC_UPDATE_LUDO_XFac_USER_STATUS"
            let param_contest = `@UserId=${userMid}`;
            gameLog(gameId, 'Freeing xfac user ');
            let resp = await this.sql.GetDataFromTransaction(proc_contest_name, param_contest);
            gameLog(gameId, 'Freeing xfac user resp ', resp);
            // if (resp && resp.length > 0) {
            //     if(resp[0].ResponseStatus != 1){
            //         throw new Error("Unable to free xfac for user");
            //     }
            //     return 
            // }
            // throw new Error("Unable to free xfac from PROC_UPDATE_LUDO_XFac_USER_STATUS")
        } catch (err) {
            gameLog(gameId, 'Error in Freeing xfac user ', err.toString());
            console.log('Error in free xfac user', err);
            throw err
        }
    }
}