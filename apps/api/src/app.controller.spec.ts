import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService);
  });

  describe('root endpoint', () => {
    it('should be defined', () => {
      expect(appController).toBeDefined();
    });

    it('should return api info', () => {
      const result = appController.getApiInfo();
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should call AppService.getApiInfo()', () => {
      const getApiInfoSpy = jest.spyOn(appService, 'getApiInfo');
      appController.getApiInfo();
      expect(getApiInfoSpy).toHaveBeenCalled();
    });

    it('should return the same value as AppService.getApiInfo()', () => {
      const serviceResult = appService.getApiInfo();
      const controllerResult = appController.getApiInfo();
      expect(controllerResult).toEqual(serviceResult);
    });
  });

  describe('API documentation', () => {
    it('should be decorated with @ApiTags for Swagger', () => {
      const metadata = Reflect.getMetadata('swagger/apiUseTags', AppController);
      expect(metadata).toBeDefined();
      expect(metadata).toContain('api');
    });

    it('should have proper route mapping', () => {
      const routeMetadata = Reflect.getMetadata('path', AppController);
      expect(routeMetadata).toBeDefined();
    });
  });
});