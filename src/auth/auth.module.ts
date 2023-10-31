import { Module } from '@nestjs/common';
import { DoctorStrategy } from './strategies/doctor.strategy';
import { UserStrategy } from './strategies/user.strategy';

@Module({
    providers: [
        DoctorStrategy,
        UserStrategy
    ],
})
export class AuthModule { }



