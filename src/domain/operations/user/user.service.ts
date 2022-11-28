import { GameServer } from "application";
import { ContestData, GameConfig, GameTicketData } from "domain/entities/game/game.model";
import { PlayerOpts } from "domain/entities/player/player.model";
import { IUser } from "domain/entities/user/user.model";
import { BaseResponse } from "utils/base.response";
import { gameLog } from "utils/logger";
import { Game } from "../game/game";
import { TableManager } from "../table/table.manager";
import { FruitCutXFac } from "../xfac/fruitcut.xfac";
import { XFacManager } from "../xfac/xfac.manager";

class UserService {
    private static _instance: UserService;

    static get Instance() {
        if (!this._instance) {
            this._instance = new UserService();
        }
        return this._instance;
    }

    constructor() {
    }

    async joinGame(user: IUser, ticket: GameTicketData) {
        let httpResp;
        try {
            gameLog(ticket.gameId, 'User come rabbitmq to join=>', user.name, ticket)
            let contestData: ContestData;
            
            contestData = await GameServer.Instance.ContestMethods.getContestById(ticket.contestId, ticket.metaData?.gameId);
            
            gameLog(ticket.gameId, 'Contest data for ticket', contestData);

            const searchOpts = {
                gameLevel: '',
                userId: user._id,
                playerCount: ticket.capacity || 2,
                contestId: ticket.contestId,
                gameTime: ticket.gamePlayTime,
                _id: ticket.gameId,
                gameConfig: ticket.metaData?.gameConfig ? ticket.metaData?.gameConfig : GameConfig.XFAC_OFF,
                xFacLogId: ticket.metaData?.xFacLogId,
                gameMode: contestData.GameMode,
                gameTurnRemaining: contestData.NoOfTurn,
                turnTime: contestData.TurnTime,
                gameId: ticket.metaData?.gameId
                
            };


            let game: Game = TableManager.fetchTable(searchOpts);
            if (!game) {
                httpResp = new BaseResponse(0, null, null, "", 'Unable to create game');
                return httpResp
            }
            
            // Check user balance before joining
            await GameServer.Instance.ContestMethods.canUserJoinContest(user.mid, ticket.contestId, searchOpts.gameId)
            

            // gameLog(game.ID, `User come for join ${user.name}`, ticket)
            // Check user can join the game or not
            if (!game.canJoin(user._id)) {
                httpResp = new BaseResponse(0, null, null, "", 'User cannot join this game');
                return httpResp
            }

            // Join user the game
            let playerOpts: PlayerOpts = {
                _id: user._id,
                name: user.name,
                did: user.did,
                mid: user.mid,
                referCode: user.referCode,
                pos: ticket.playerPos,
                totalGameWinners: 1  
                
            }
            let joinResp = await game.join(playerOpts, contestData)
            if (!joinResp.joiningSuccess) {
                httpResp = new BaseResponse(0, null, null, "", 'Error while joining the user in game');
                return httpResp
            }

            if(ticket.metaData?.gameConfig == GameConfig.XFAC_FIRST && ticket.metaData?.xFacId){
                try {
                    let xfac = XFacManager.getXFac(game);
                    xfac.joinMatch(user.mid, ticket.metaData?.xFacId, ticket.metaData?.xFacLevel)
                } catch(err){
                    console.log(err)
                    game.GAME_CONFIG = GameConfig.USER_FIRST;
                    game?.log('Error in creating xfac', err);
                }
            }

            httpResp = new BaseResponse(1, joinResp, null, "", null);
            return httpResp
        }
        catch (e) {
            httpResp = new BaseResponse(0, null, null, "", (e as Error).message);
        }
        return httpResp;
    }
}

export default UserService;