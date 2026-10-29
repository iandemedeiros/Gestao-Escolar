import { Test } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('comunicacao health', () => {
  it('returns the service identity and status', async () => {
    const module = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();
    try {
      expect(module.get(AppController).getHealth()).toEqual({
        service: 'comunicacao',
        status: 'ok',
      });
    } finally {
      await module.close();
    }
  });
});
