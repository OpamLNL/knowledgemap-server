import { Injectable } from '@nestjs/common';
import {AuthService} from "./auth/auth.service";

@Injectable()
export class AppService {
  getHello(): string {
    return 'GraphEdit Server!!';
  }

  getHealth() {
    return {
      status: 'ok',
      service: 'GraphEdit API',
      message: 'Сервер працює',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
