import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt"
import * as dotenv from 'dotenv'
import { UnauthorizedException } from "@nestjs/common";

dotenv.config()

export class AdminStrategy extends PassportStrategy(Strategy, 'admin') {
    constructor() {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.ADMIN_SECRET,
        })
    }

    async validate(payload: any) {
        return {
            id: payload.id,
            username: payload.username
        }
    }
}