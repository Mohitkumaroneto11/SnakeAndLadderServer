import 'reflect-metadata';
import express from 'express'
import * as socketIO from 'socket.io'
import * as http from 'http'
import { gameLog, setupLogger } from 'utils/logger';
import io from '@pm2/io';
import Counter from '@pm2/io/build/main/utils/metrics/counter';
import { User } from 'domain/operations/user/user';
import { RedisStorage } from 'database/redis/game.redis';
import { RabbitMQ } from 'infra/queue.context';
import { SocketServer } from 'socket.server';
import { IUser } from 'domain/entities/user/user.model';
import { AuthenticationService } from 'middleware/auth';
import { ContestMethod } from 'domain/methods/contest';
import { TransactionMethod } from 'domain/methods/transaction';
import { GameServices } from 'domain/operations/game/game.service';
abstract class Applicaton {
    constructor() {
        this.configureServices();
    }
    abstract configureServices(): void
}
export class GameServer extends Applicaton {
    private _userList: Map<string, User>;
    private _socketServer: SocketServer;
    private _gameRedis: RedisStorage
    private _rabbitMq: RabbitMQ
    private _activeGameCount: Counter;
    private _contestMethods: ContestMethod;
    private _transactionMethods: TransactionMethod;
    private _gameServices: GameServices;
    private _userCount: Counter;
    private static _instance: GameServer;
    constructor() {
        super();
        this._userList = new Map();
        
        this._gameRedis = RedisStorage.Instance;
        this._rabbitMq = new RabbitMQ();
        this._contestMethods = new ContestMethod();
        this._transactionMethods = new TransactionMethod();

        this._gameServices = new GameServices(this._gameRedis);
        this._activeGameCount = io.counter({
            name: 'Realtime game count',
        });
        this._userCount = io.counter({
            name: 'Realtime user connected',
        });


    }
    static get Instance() {
        if (!this._instance) {
            this._instance = new GameServer()
        }
        return this._instance
    }
    public configureServices() {
        setupLogger();
        const app = express();
        app.use(express.json())
        console.info('test');

        // routes(app);
        const httpServer = http.createServer(app);
        const instance = httpServer.listen(process.env.PORT, async () => {
            // Server Events

            console.log("Game Server started T on port ", process.env.PORT);
        });
        app.get('/', (request, response) => {
            response.send(`Casual Game server in running (${new Date()})`);
        });
        const socketPath = "/v1/game/socket.io";
        const socketOptions: any = { path: socketPath, pingTimeout: 6000, pingInterval: 1000 };
        this._socketServer = new SocketServer(instance, socketOptions, this.onSocketAuth.bind(this), this.onSocketConnect.bind(this));
    }

    private async onSocketAuth(socket: socketIO.Socket, next: any): Promise<any> {
        const token: string = socket.handshake.query.token as string;
        const profile: IUser = await AuthenticationService.validateToken(token);
        this.crudPlayer(profile, socket);
        console.log("Socket Auth called ", socket.id);
        next();
        return;
    }
    private onSocketConnect(socket: socketIO.Socket) {
        console.log("Socket connected ", socket.id);
        this.UserCount.inc();
    }
    private crudPlayer(user: IUser, socket: socketIO.Socket) {
        gameLog('connection', `${user.name} connected in Game socket`)
        if (this._userList.has(user._id)) {
            this._userList.get(user._id)?.onUpdatePlayer(user._id, socket, user)
        }
        else {
            this._userList.set(user._id, new User(socket, user));
        }
        gameLog('counters', 'User count', this._userList.size);
    }
    public playerInfo(playerId: string) {
        return this._userList.get(playerId)?.playerInfo();
    }
    public removePlayer(playerId: string) {
        this._userList.delete(playerId)
        return this._userList.size;
    }
    public removeFromSocketRoom(playerId: string, gameId: string) {
        gameLog(gameId, 'Removing player from socket room from main class', playerId)
        if (this._userList.has(playerId)) {
            this._userList.get(playerId).leaveRoom(gameId);
            return true
        }
        return false
    }
    public get socketServer() {
        return this._socketServer;
    }
    
    public get RabbitMQ() {
        return this._rabbitMq;
    }

    public get REDIS() {
        return this._gameRedis;
    }
    
    public get GameCount() {
        return this._activeGameCount;
    }
    public get UserCount() {
        return this._userCount;
    }
    
    public get ContestMethods(): ContestMethod {
        return this._contestMethods
    }

    public get TransactionMethods(): TransactionMethod {
        return this._transactionMethods
    }

    public get GameServices(): GameServices {
        return this._gameServices;
    }
}
GameServer.Instance