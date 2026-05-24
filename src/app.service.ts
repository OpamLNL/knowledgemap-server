import { Injectable } from '@nestjs/common';
import {AuthService} from "./auth/auth.service";

@Injectable()
export class AppService {
  getHello(): string {


    // AuthService.

    return 'Knowledge Map Server!!';
  }
}
