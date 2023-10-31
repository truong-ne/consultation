import { Column, Entity, JoinColumn, ManyToMany, ManyToOne, OneToMany, OneToOne, PrimaryColumn } from "typeorm";
import { Status } from "../../config/enum.constants";
import { Min } from "class-validator";
import { nanoid } from "nanoid";
import { User } from "./user.entity";
import { Doctor } from "./doctor.entity";
import { Feedback } from "src/feedback/entities/feedback.entity";
import { Discount } from "src/discount/entities/discount.entity";

@Entity({ name: 'Consultations' })
export class Consultation {
    constructor() {
        this.id = nanoid()
    }

    @PrimaryColumn()
    id: string

    @Column({ name: 'date' })
    date: string

    @Column({ name: 'expected_time' })
    expected_time: string

    @Column()
    price: number

    @Column({ type: 'enum', enum: Status, default: Status.pending })
    status: Status

    @ManyToOne(() => User, user => user.id, { onDelete: 'NO ACTION' })
    @JoinColumn({ name: 'user' })
    user: User

    @ManyToOne(() => Doctor, doctor => doctor.id, { onDelete: 'NO ACTION' })
    @JoinColumn({ name: 'doctor' })
    doctor: Doctor

    @OneToOne(() => Feedback, feedback => feedback.consultation)
    @JoinColumn({ name: 'feedback' })
    feedback: Feedback

    @ManyToOne(() => Discount, discount => discount.code)
    @JoinColumn({ name: 'discount' })
    discount_code: Discount

    @Column({ type: 'timestamp', name: 'update_at', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}