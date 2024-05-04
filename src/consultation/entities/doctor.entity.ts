import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from "typeorm";
import { Specialty } from "../../config/enum.constants";
import { Min } from "class-validator";
import { nanoid } from "nanoid";
import { Consultation } from "./consultation.entity";

@Entity({ name: 'Doctors' })
export class Doctor {
    constructor() {
        this.id = nanoid()
    }

    @PrimaryColumn()
    id: string

    @Column()
    phone: string

    @Column({ default: true })
    gender: boolean

    @Column({ name: 'day_of_birth', nullable: true })
    dayOfBirth: string

    @Column()
    password: string

    @Column({ nullable: true })
    email: string

    @Column({ nullable: true })
    introduce: string

    @Column({ default: false })
    isActive: boolean

    @Column({ name: 'full_name' })
    full_name: string

    @Column({ nullable: true })
    avatar: string

    @Column({ nullable: true })
    biography: string

    @Column({ name: 'account_balance', default: 0 })
    @Min(0)
    account_balance: number

    @Column({ default: 0 })
    @Min(0)
    fee_per_minutes: number

    @Column({ name: 'fixed_times', nullable: true })
    fixed_times: string

    @Column({ type: 'timestamp', name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date

    @Column({ type: 'timestamp', name: 'update_at', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;

    @OneToMany(() => Consultation, consultation => consultation.doctor, { onDelete: 'NO ACTION' })
    consultation: Consultation[]
}