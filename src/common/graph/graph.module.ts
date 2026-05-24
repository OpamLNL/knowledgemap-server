import { Module, Global } from '@nestjs/common';
import { GraphValidatorService } from './graph-validator.service';

@Global()
@Module({
    providers: [GraphValidatorService],
    exports: [GraphValidatorService],
})
export class GraphModule {}
