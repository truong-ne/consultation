import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsDateString, IsEnum, IsNotEmpty, IsNumber, IsString, Matches, Max, Min } from "class-validator";
import { DrugDto } from "./drug.dto";

export class PrescriptionDto {
    @IsNotEmpty()
    @ApiProperty({ example: 'pham nhat minh' })
    @IsString()
    patientName: string

    @IsNotEmpty()
    @ApiProperty({ example: 'hcm' })
    @IsString()
    patientAddress: string

    @IsNotEmpty()
    @ApiProperty({ example: 'nam' })
    @IsString()
    gender: string

    @IsNotEmpty()
    @ApiProperty({ example: 'tran huynh tan phat' })
    @IsString()
    doctorName: string

    @IsNotEmpty()
    @ApiProperty({ example: 'bi cảm' })
    @IsString()
    diagnosis: string

    @ApiProperty({ example: 'bi cảm' })
    @IsString()
    note: string

    drugs: DrugDto[]
}