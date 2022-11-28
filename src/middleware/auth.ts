import { IUser, IUserRequest } from 'domain/entities/user/user.model';
import { NextFunction, Request, Response } from 'express';
import * as jwt from 'jsonwebtoken'
const fs = require("fs");
const privateKey = fs.readFileSync(__dirname + '/certs/jwt-token.pem');

// static class with no constructor
export class AuthenticationService {
    private static secret: string = fs.readFileSync(__dirname + '/certs/jwt-token.pem');
    public static validateToken(token: string): any {
        try {
            const tokenData: any = jwt.verify(token, this.secret, { algorithms: ['RS256'] });
            return {
                _id: tokenData.sub.toString().toLowerCase(),
                userId: tokenData.sub.toString().toLowerCase(),
                name: clearString(tokenData.FullName) || tokenData.rc,
                did: tokenData.sub.toString().toLowerCase(),
                mid: tokenData.mid,
                token: token,
                referCode: tokenData.rc
            }
        }
        catch (e) {
            console.error(e);
            return null
        }
    }
    public static createToken(data: any): string {
        const token: string = jwt.sign(data, this.secret, { expiresIn: "2h" });
        return token;
    }

    public static async authenticateApiRequest(req: IUserRequest, res: Response, next: NextFunction) {
        var token = req.headers["x-access-token"]?.toString();
        const profile: IUser = await AuthenticationService.validateToken(token);
        if (!profile) {
            return res.status(401).json({
                status: false,
                message: "Unauthorized"
            })
        }

        req.profile = profile;
        return next();

    }
}

function clearString(str: string){
    return str.replace(/\W/g, '');
}