import { Column, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryColumn } from "typeorm";
import { nanoid } from "nanoid";
import { Consultation } from "./consultation.entity";
import { Drug } from "./drug.entity";

@Entity({ name: 'Prescription' })
export class Prescription {
    constructor() {
        this.id = nanoid()
    }

    @PrimaryColumn()
    id: string

    @Column({ name: 'patient_name' })
    patientName: string

    @Column({ name: 'patient_address' })
    patientAddress: string

    @Column()
    gender: string

    @Column({ name: 'doctor_name' })
    doctorName: string

    @Column()
    diagnosis: string

    @Column({ nullable: true })
    note: string

    @Column({ type: 'timestamp', name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date

    @Column({ type: 'timestamp', name: 'update_at', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;

    @OneToMany(() => Drug, d => d.prescription, { onDelete: 'NO ACTION' })
    drugs: Drug[]

    @OneToOne(() => Consultation, c => c.id, { onDelete: 'NO ACTION' })
    @JoinColumn({ name: 'consultation_id' })
    consultation: Consultation
}