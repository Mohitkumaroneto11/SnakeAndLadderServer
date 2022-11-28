export class TransactionTokenRequest{
    cid: number;
    amt?: number;
    mba?: number;
    gameserverid:string;
    gameMode?: number;
    userList: Array<{UserId:string, UserLoginId: number, ReferCode: string}>;
    gameId: number
}

export class ContestWinnerRequest{
    RoomId:number;
    ContestId:number;
    ludoParticipantScore: Array<{UserId:number, Score: number}>;
}