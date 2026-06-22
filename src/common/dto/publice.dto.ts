import { ErrorMessages } from "./../../constant/message.errors";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsNumber, IsOptional, Min } from "class-validator";

export class PublicQueryDto {
  @Min(1, { message: ErrorMessages.TYPE.NUMBER.MIN(1) })
  @IsInt({ message: ErrorMessages.TYPE.NUMBER.IS_INT })
  @IsNumber({}, { message: ErrorMessages.TYPE.NUMBER.IS_NUMBER })
  @Type(() => Number)
  @IsOptional()
  page?: number;

  @IsIn([10, 20, 50], {
    message: ErrorMessages.TYPE.ENUM([10, 20, 50]),
  })
  @IsInt({ message: ErrorMessages.TYPE.NUMBER.IS_INT })
  @IsNumber({}, { message: ErrorMessages.TYPE.NUMBER.IS_NUMBER })
  @Type(() => Number)
  @IsOptional()
  limit?: number;
}
