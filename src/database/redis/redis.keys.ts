import { GameIds } from "domain/entities/game/game.model";

export class RedisKeys{
    static NODE_ENV = process.env.NODE_ENV

    private static getNodeEnv(gameId: String){
        return this.NODE_ENV
    }
    
    public static getServerKey(serverIp: string){
        return `{${serverIp}}_server_detail_${this.NODE_ENV}`;
    }

    public static getActiveServerKey(){
        return `active_servers_${this.NODE_ENV}`
    }

    public static getRunningGameKey(serverIp: string){
        return `{${serverIp}}_running_game_${this.NODE_ENV}`;
    }

    public static getProfileKey(profileId: string){
        return `{${profileId}}_profile_data_${this.NODE_ENV}`
    }

    public static getContestDetailKey(contestId: string, gameId: GameIds){
        return `${this.getNodeEnv(gameId.toString())}_contest_detail:${gameId}:${contestId}`
    }

    public static ContestCategorization(gameId:string){
        return `${this.NODE_ENV}_Contest:Categorization:Game:${gameId}`
    }

    public static ContestDetails(gameId:string){
        return `${this.NODE_ENV}_Contest:ContestDetails:1`
    }

    public static PracticeContestUser(userId:string){
        return `${this.NODE_ENV}_PracticeContestUser:${userId}`
    }

    public static ContestPrizeBreakUp(contestId:string){
        return `${this.NODE_ENV}_Contest:PriceBreakup:Contest:${contestId}`
    }

    public static JoinedContestCount(gameId:string){
        return `${this.NODE_ENV}_JoinedContestCount:${gameId}`
    }

    public static AppGameSetting(){
        return `${this.NODE_ENV}_AppGameSetting:getappgamesetting`
    }
    public static getRabbitMqMsgKey(msgId: string){
        return `${this.NODE_ENV}:rabbitMqMsg:${msgId}`
    }

    public static getGameDataKey(){
        return `${this.NODE_ENV}:gameDataForcasualGame`;
    }

    public static gameKey(gameId: string){
        return `${this.NODE_ENV}:game:${gameId}`;
    }

    public static getGameBoard(boardId:number=1){
        return `${this.NODE_ENV}:BoardTable:${boardId}`;
    }

}