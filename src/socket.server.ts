import socketIO from 'socket.io'
import http from "http"


export class SocketServer {
    private server: socketIO.Server;
    private socketConnectCallback: (socket: socketIO.Socket) => any
    private socketAuthCallback: (socket: socketIO.Socket, next: () => any) => Promise<any>
    public constructor(private httpServer: http.Server, options: any = {}, onAuthCallback: any, onConnectCallback: any){
        this.socketConnectCallback = onConnectCallback;
        this.socketAuthCallback = onAuthCallback;
        this.server = new socketIO.Server(httpServer, options)
        this.initServer();
    }
    private initServer() {
        this.server.sockets.setMaxListeners(0);
        this.server.use(this.socketAuthorization.bind(this));
        this.server.on("connection", this.onSocketConnect.bind(this));
    }
    private socketAuthorization(socket: socketIO.Socket, next: any): Promise<any> {
        return this.socketAuthCallback(socket, next);
    }
    private onSocketConnect(socket: socketIO.Socket) {
        this.socketConnectCallback(socket);
    }
    public emitInSocketRoom(tableId: string, event: string, data: any) {
        this.server.in(tableId).emit(event, data);
    }

    public emitToSocketRoom(tableId: string, event: string, data: any) {
        this.server.to(tableId).emit(event, data)
    }
}