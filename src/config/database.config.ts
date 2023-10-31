import { redisStore } from 'cache-manager-redis-yet';
import * as dotenv from 'dotenv'

dotenv.config()

let extraOptions = {}
if (process.env.NODE_ENV !== "development") {
    extraOptions = {
        ssl: {
            rejectUnauthorized: false,
        },
    };
}

export const postgresOption: any = {
    type: 'postgres',
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    username: process.env.POSTGRES_USERNAME,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
    ssl: (process.env.NODE_ENV === "development") ? null : true,
    extra: extraOptions,
    synchronize: process.env.NODE_ENV !== "production"
}

export const redisClientOption: any = {
    store: redisStore,
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT
    },
    ttl: 2 * 60 * 60 * 1000  //default
}