import { Module } from '@nestjs/common';
import { DoctorStrategy } from './strategies/doctor.strategy';
import { UserStrategy } from './strategies/user.strategy';
import { AdminStrategy } from './strategies/admin.strategy';

@Module({
    providers: [
        DoctorStrategy,
        UserStrategy,
        AdminStrategy
    ],
})
export class AuthModule { }



