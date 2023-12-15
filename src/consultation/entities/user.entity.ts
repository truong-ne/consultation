import { Column, Entity, OneToMany, PrimaryColumn } from "typeorm";
import { nanoid } from "nanoid";
import { Consultation } from "./consultation.entity";

@Entity({ name: 'Users' })
export class User {
    constructor() {
        this.id = nanoid()
    }

    @PrimaryColumn()
    id: string

    @Column()
    phone: string

    @Column({ nullable: true })
    email: string

    @Column()
    password: string

    @Column({ name: 'account_balance', default: 0 })
    account_balance: number

    @Column({ name: 'email_notification', default: false })
    email_notification: boolean

    @Column({ default: true })
    isActive: boolean

    @Column({ type: 'timestamp', name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date

    @Column({ type: 'timestamp', name: 'update_at', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date

    @OneToMany(() => Consultation, consultation => consultation.user, { onDelete: 'NO ACTION' })
    consultation: Consultation[]
}