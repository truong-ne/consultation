import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from "typeorm";
import { nanoid } from "nanoid";
import { Prescription } from "./prescription.entiy";

@Entity({ name: 'Drugs' })
export class Drug {
    constructor() {
        this.id = nanoid()
    }

    @PrimaryColumn()
    id: string

    @Column()
    name: string

    @Column()
    code: string

    @Column()
    type: string

    @Column({ nullable: true })
    note: string

    @Column()
    quantity: number

    @ManyToOne(() => Prescription, p => p.id, { onDelete: 'NO ACTION' })
    @JoinColumn({ name: 'prescription_id' })
    prescription: Prescription
}