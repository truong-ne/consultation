import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from "typeorm";
import { nanoid } from "nanoid";
import { Consultation } from "./consultation.entity";

@Entity({ name: 'Prescription' })
export class Prescription {
    constructor() {
        this.id = nanoid()
    }

    @PrimaryColumn()
    id: string

    @Column()
    name: string

    @Column()
    type: string

    @Column()
    note: string

    @Column()
    quantity: string

    @Column()
    unit: string

    @Column({ type: 'timestamp', name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date

    @Column({ type: 'timestamp', name: 'update_at', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;

    @ManyToOne(() => Consultation, c => c.id, { onDelete: 'NO ACTION' })
    @JoinColumn({ name: 'consultation_id' })
    consultation: Consultation
}