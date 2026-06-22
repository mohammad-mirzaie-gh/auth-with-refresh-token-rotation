import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { DeviceType } from 'generated/prisma';
import { ErrorMessages } from 'src/constant/message.errors';

export class LoginPasswordDto {
  @IsEmail({}, { message: ErrorMessages.EMAIL.INVALID_EMAIL })
  @Length(2, 254, { message: ErrorMessages.PUBLIC.LENGTH(2, 254) })
  @IsString({ message: ErrorMessages.TYPE.STRING.IS_STRING })
  @IsNotEmpty({ message: ErrorMessages.PUBLIC.IS_NOT_EMPTY })
  email: string;

  @Matches(/^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$ %^&*-]).{8,}$/, {
    message: ErrorMessages.AUTH.INVALID_PASSWORD,
  })
  @Length(8, 50, { message: ErrorMessages.PUBLIC.LENGTH(8, 50) })
  @IsString({ message: ErrorMessages.TYPE.STRING.IS_STRING })
  @IsNotEmpty({ message: ErrorMessages.PUBLIC.IS_NOT_EMPTY })
  password: string;

  @IsEnum(DeviceType, {
    message: ErrorMessages.TYPE.ARRAY.IS_ENUM(Object.values(DeviceType)),
  })
  @IsString({ message: ErrorMessages.TYPE.STRING.IS_STRING })
  @IsNotEmpty({ message: ErrorMessages.PUBLIC.IS_NOT_EMPTY })
  device: DeviceType;
}

export class ChangePasswordDto {
  @Matches(/^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$ %^&*-]).{8,}$/, {
    message: ErrorMessages.AUTH.INVALID_PASSWORD,
  })
  @Length(8, 50, { message: ErrorMessages.PUBLIC.LENGTH(8, 50) })
  @IsString({ message: ErrorMessages.TYPE.STRING.IS_STRING })
  @IsNotEmpty({ message: ErrorMessages.PUBLIC.IS_NOT_EMPTY })
  oldPassword: string;

  @Matches(/^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$ %^&*-]).{8,}$/, {
    message: ErrorMessages.AUTH.INVALID_PASSWORD,
  })
  @Length(8, 50, { message: ErrorMessages.PUBLIC.LENGTH(8, 50) })
  @IsString({ message: ErrorMessages.TYPE.STRING.IS_STRING })
  @IsNotEmpty({ message: ErrorMessages.PUBLIC.IS_NOT_EMPTY })
  newPassword: string;

  @IsEnum(DeviceType, {
    message: ErrorMessages.TYPE.ARRAY.IS_ENUM(Object.values(DeviceType)),
  })
  @IsString({ message: ErrorMessages.TYPE.STRING.IS_STRING })
  @IsNotEmpty({ message: ErrorMessages.PUBLIC.IS_NOT_EMPTY })
  device: DeviceType;
}

export class RefreshTokenDto {
  @IsEnum(DeviceType, {
    message: ErrorMessages.TYPE.ARRAY.IS_ENUM(Object.values(DeviceType)),
  })
  @IsString({ message: ErrorMessages.TYPE.STRING.IS_STRING })
  @IsNotEmpty({ message: ErrorMessages.PUBLIC.IS_NOT_EMPTY })
  device: DeviceType;
}
