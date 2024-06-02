import { Column, Entity, JoinColumn, ManyToMany, ManyToOne, OneToMany, OneToOne, PrimaryColumn } from "typeorm";
import { Status } from "../../config/enum.constants";
import { Min } from "class-validator";
import { nanoid } from "nanoid";
import { User } from "./user.entity";
import { Doctor } from "./doctor.entity";
import { Feedback } from "src/feedback/entities/feedback.entity";
import { Discount } from "src/discount/entities/discount.entity";
import { Prescription } from "./prescription.entiy";

@Entity({ name: 'Consultations' })
export class Consultation {
    constructor() {
        this.id = nanoid()
    }

    @PrimaryColumn()
    id: string

    @Column({ name: 'date' })
    date: Date

    @Column({ name: 'expected_time' })
    expected_time: string

    @Column()
    price: number

    @Column({ nullable: true })
    symptoms: string

    @Column({ name: 'medical_history', nullable: true })
    medical_history: string

    @Column({ name: 'medical_record', nullable: true })
    medical_record: string

    @Column("text", { name: 'patient_records', array: true, default: [] })
    patient_records: string[]

    @Column({ name: 'jisti_token', nullable: true })
    jisti_token: string

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

    @OneToOne(() => Prescription, p => p.consultation, { onDelete: 'NO ACTION' })
    prescription: Prescription

    @Column({ type: 'timestamp', name: 'update_at', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}