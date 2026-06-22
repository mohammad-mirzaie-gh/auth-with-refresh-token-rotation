import {
  ThrottlerGuard,
  ThrottlerLimitDetail,
} from '@nestjs/throttler';
import { ErrorMessages } from "./../../constant/message.errors";
import {
  Injectable,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: ErrorMessages.PUBLIC.MANY_REQUEST,
        limit: throttlerLimitDetail.limit,
        ttl: throttlerLimitDetail.ttl / 1000,
        
        tte : throttlerLimitDetail.timeToBlockExpire
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
