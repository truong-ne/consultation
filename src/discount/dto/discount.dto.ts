import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsNumber, IsString, Length, Min } from "class-validator";
import { DiscountType } from "../../config/enum.constants";

export class DiscountDto {
    @IsNotEmpty()
    @IsString()
    @ApiProperty({ example: 'NOEL_CHOPPER' })
    code: string

    @IsNotEmpty()
    @IsNumber()
    @ApiProperty({ example: 200000 })
    value: number

    @IsNotEmpty()
    @IsEnum(DiscountType)
    @ApiProperty({ enum: DiscountType })
    type: DiscountType

    @IsNotEmpty()
    @IsString()
    @ApiProperty({ example: '12/12/2023' })
    expiration_time: string

}