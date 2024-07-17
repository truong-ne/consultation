import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsNumber, IsString, Max, Min } from "class-validator";

export class BookConsultation {
    @IsNotEmpty()
    @ApiProperty({ example: '0w3ovqa4ZbY-nEcLTTOBR' })
    @IsString()
    doctor_id: string

    @ApiProperty({ example: '0w3ovqa4ZbY-nEcLTTOBR' })
    @IsString()
    symptoms: string

    @ApiProperty({ example: '0w3ovqa4ZbY-nEcLTTOBR' })
    @IsString()
    medical_history: string

    @ApiProperty({ example: [] })
    @IsArray()
    patient_records: string[]

    @IsNotEmpty()
    @ApiProperty({ example: 'medical_id' })
    @IsString()
    medical_record: string

    @IsNotEmpty()
    @ApiProperty({ example: '20/10/2023' })
    @IsString()
    date: string

    @IsNotEmpty()
    @ApiProperty({ example: '14-15' })
    expected_time: string

    @ApiProperty({ example: null })
    @IsString()
    discount_code: string

    @ApiProperty({ example: false })
    @IsBoolean()
    usePoint: boolean
}

export class DateDto {
    @IsNotEmpty()
    @ApiProperty({ example: '12/12/2023' })
    date: string
}