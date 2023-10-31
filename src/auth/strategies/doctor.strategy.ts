import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt"
import * as dotenv from 'dotenv'

dotenv.config()

export class DoctorStrategy extends PassportStrategy(Strategy, 'doctor') {
    constructor() {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.DOCTOR_SECRET,
        })
    }

    async validate(payload: any) {
        return {
            id: payload.id,
            phone: payload.phone
        }
    }
}