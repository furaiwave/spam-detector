// apps/backend/src/pipes/zod-validation.pipe.ts
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ZodSchema, ZodError, z } from 'zod';

@Injectable()
export class ZodValidationPipe<TSchema extends ZodSchema>
  implements PipeTransform<unknown, z.infer<TSchema>>
{
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): z.infer<TSchema> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: this.formatErrors(result.error),
      });
    }
    return result.data;
  }

  private formatErrors(error: ZodError) {
    return error.issues.map(e => ({
      field:   e.path.join('.'),
      message: e.message,
    }));
  }
}